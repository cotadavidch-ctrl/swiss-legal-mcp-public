import {
  ContentTypeError,
  ParseError,
  ProviderResponseError,
  ProviderUnavailableError,
  RateLimitedError,
  ResponseTooLargeError,
  SsrfBlockedError,
  UnexpectedContentTypeError,
} from "@swiss-legal-mcp/core";
import { CircuitBreaker, DomainAllowlistResolver } from "@swiss-legal-mcp/shared";
import { lookup } from "node:dns/promises";
import type { ReadableStreamDefaultReader, ReadableStreamReadResult } from "node:stream/web";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { sha256Hex } from "./contentHash.js";

const TRANSIENT_HTTP_STATUS_CODES = new Set([429, 502, 503, 504]);
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_COMPRESSION_RATIO = 20;

/**
 * User-Agent por defecto para los proveedores de documentacion administrativa
 * (SECO/BSV/ESTV, Fase 4): se identifica honestamente como un cliente
 * automatizado (patron "Mozilla/5.0 (compatible; ...)" usado por crawlers
 * legitimos como Googlebot), nunca simula ser un navegador real -- ninguna de
 * las tres fuentes exige un User-Agent de navegador (robots.txt de las tres
 * permite crawling completo sobre las rutas usadas, ver
 * docs/provider-contracts/{seco,bsv,estv}.md).
 */
export const DEFAULT_ADMINISTRATIVE_USER_AGENT =
  "Mozilla/5.0 (compatible; swiss-legal-mcp/0.1; +https://github.com/swiss-legal-mcp)";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff exponencial "full jitter" (AWS Architecture Blog), identico al de entscheidsuche/fedlex. */
function backoffWithJitter(attempt: number, baseMs: number, maxMs: number): number {
  const cap = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.random() * cap;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

function startsWithPdfMagic(bytes: Uint8Array): boolean {
  if (bytes.byteLength < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Decide si unos bytes que NO se pudieron descomprimir ya son, en realidad,
 * el contenido final valido -- porque el fetch nativo de Node los descomprimio
 * de forma transparente antes de que este cliente los viera (ver comentario en
 * decodeBoundedBody). No es una deteccion perfecta: es la misma heuristica que
 * usan otros clientes HTTP frente a esta peculiaridad de undici. Un payload
 * realmente corrupto (truncado, generado al azar, etc.) casi nunca coincide
 * con la firma PDF ni es UTF-8 valido, asi que sigue rechazandose.
 */
function isAlreadyDecodedContent(bytes: Uint8Array, contentType: string | null): boolean {
  if (bytes.byteLength === 0) return true;
  if (contentType?.toLowerCase().includes("pdf")) return startsWithPdfMagic(bytes);
  return isValidUtf8(bytes);
}

export interface SecureHttpClientConfig {
  readonly providerId: string;
  readonly allowedDomains: readonly string[];
  readonly blockedSubdomainLabels?: readonly string[];
  readonly allowedPorts?: readonly number[];
  readonly dnsLookup?: (hostname: string) => Promise<readonly string[]>;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly maxCompressedResponseBytes?: number;
  readonly maxDecompressedResponseBytes?: number;
  readonly maxCompressionRatio?: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  readonly retryMaxDelayMs: number;
  readonly circuitBreakerFailureThreshold: number;
  readonly circuitBreakerResetMs: number;
  readonly maxRedirects?: number;
  readonly userAgent?: string;
}

export interface SecureFetchOptions {
  /** Subcadenas aceptadas del header Content-Type devuelto (p.ej. ["text/html"], ["application/pdf"]). Sin validar si se omite. */
  readonly expectedContentTypeIncludes?: readonly string[];
  readonly headers?: Record<string, string>;
}

export interface SecureFetchResult {
  /** URL final tras seguir redirecciones controladas (igual a la solicitada si no hubo redireccion). */
  readonly finalUrl: string;
  readonly status: number;
  readonly contentType: string | null;
  readonly bytes: Uint8Array;
  readonly contentHash: string;
  readonly retrievedAt: string;
}

function isTransientError(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return true;
  if (error instanceof Error && /^HTTP \d+/.test(error.message)) {
    const status = Number(error.message.slice(5, 8));
    return TRANSIENT_HTTP_STATUS_CODES.has(status);
  }
  return false;
}

/**
 * Cliente HTTP seguro compartido para los proveedores de documentacion
 * administrativa de Fase 4 (SECO, BSV, ESTV) -- ver la instruccion explicita
 * de "no copies-pega" en IMPLEMENTATION_STATUS.md. Generaliza la logica ya
 * existente (y hasta ahora duplicada por proveedor) de
 * packages/providers/fedlex/src/sparqlClient.ts y
 * packages/providers/entscheidsuche/src/remoteClient.ts:
 *
 * - Solo https; dominio validado contra una allowlist por proveedor
 *   (DomainAllowlistResolver, packages/shared) -- proteccion SSRF real,
 *   incluida en CADA salto de redireccion, no solo en la URL inicial.
 * - Timeout configurable via AbortController.
 * - Limite de tamano de respuesta (Content-Length y bytes reales leidos).
 * - Reintentos con backoff+jitter solo para errores transitorios (timeout,
 *   HTTP 429/502/503/504).
 * - Circuit breaker de 3 estados (packages/shared).
 * - Validacion opcional de Content-Type.
 * - Hash sha256 del cuerpo descargado, para poblar `provenance.contentHash`.
 *
 * No persiste cookies entre peticiones: cada llamada usa un `fetch` nuevo sin
 * un cookie jar, por disenio -- las cookies de sesion observadas en BSV/ESTV
 * (DNN, GA, F5/WAF) no son de autenticacion y no deben reenviarse.
 */
export class SecureHttpClient {
  private readonly breaker: CircuitBreaker;
  private readonly resolver: DomainAllowlistResolver;
  private readonly maxRedirects: number;

  constructor(private readonly config: SecureHttpClientConfig) {
    this.breaker = new CircuitBreaker(
      config.circuitBreakerFailureThreshold,
      config.circuitBreakerResetMs,
    );
    this.resolver = new DomainAllowlistResolver(
      config.allowedDomains,
      config.blockedSubdomainLabels ?? [],
      { allowedPorts: config.allowedPorts },
    );
    this.maxRedirects = config.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  }

  get circuitState() {
    return this.breaker.currentState;
  }

  async get(url: string, options: SecureFetchOptions = {}): Promise<SecureFetchResult> {
    if (!this.breaker.canAttempt()) {
      throw new ProviderUnavailableError(
        this.config.providerId,
        `Circuit breaker abierto para '${this.config.providerId}': demasiados fallos recientes.`,
      );
    }

    for (let attempt = 0; ; attempt += 1) {
      this.breaker.beginAttempt();
      try {
        const result = await this.followRedirectsAndFetch(url, options);
        this.breaker.recordSuccess();
        return result;
      } catch (error) {
        if (
          error instanceof SsrfBlockedError ||
          error instanceof UnexpectedContentTypeError ||
          error instanceof ProviderResponseError ||
          error instanceof ParseError
        ) {
          // Nunca transitorio: la fuente respondio, o la URL nunca debio
          // solicitarse. Reintentar no cambiaria el resultado.
          this.breaker.recordFailure();
          throw error;
        }
        this.breaker.recordFailure();
        const transient = isTransientError(error);
        if (!transient || attempt >= this.config.maxRetries) {
          if (error instanceof Error && /^HTTP 429/.test(error.message)) {
            throw new RateLimitedError(this.config.providerId);
          }
          if (error instanceof ResponseTooLargeError) throw error;
          throw error instanceof ProviderUnavailableError
            ? error
            : new ProviderUnavailableError(
                this.config.providerId,
                `Fallo descargando '${url}': ${error instanceof Error ? error.message : String(error)}`,
              );
        }
        await sleep(
          backoffWithJitter(attempt, this.config.retryBaseDelayMs, this.config.retryMaxDelayMs),
        );
        if (!this.breaker.canAttempt()) {
          throw new ProviderUnavailableError(
            this.config.providerId,
            `Circuit breaker abierto para '${this.config.providerId}' tras reintentos fallidos.`,
          );
        }
      }
    }
  }

  private async followRedirectsAndFetch(
    initialUrl: string,
    options: SecureFetchOptions,
  ): Promise<SecureFetchResult> {
    let currentUrl = initialUrl;

    for (let hop = 0; ; hop += 1) {
      const resolution = this.resolver.resolve(currentUrl);
      if (!resolution.isAllowed) {
        throw new SsrfBlockedError(currentUrl, resolution.reason ?? "motivo desconocido");
      }
      const resolvedAddresses = await this.resolveHostnameForPolicy(currentUrl);
      const dnsResolution = this.resolver.resolve(currentUrl, { resolvedAddresses });
      if (!dnsResolution.isAllowed) {
        throw new SsrfBlockedError(currentUrl, dnsResolution.reason ?? "motivo desconocido");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      let response: Response;
      try {
        response = await fetch(currentUrl, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            ...(this.config.userAgent ? { "User-Agent": this.config.userAgent } : {}),
            "Accept-Encoding": "gzip, deflate, br",
            ...options.headers,
          },
        });
      } finally {
        clearTimeout(timer);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error(`HTTP ${response.status} sin cabecera Location en: ${currentUrl}`);
        }
        if (hop >= this.maxRedirects) {
          throw new Error(
            `Demasiadas redirecciones (>${this.maxRedirects}) siguiendo ${initialUrl}`,
          );
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status} descargando ${currentUrl}`);
      }

      const contentType = response.headers.get("content-type");
      if (
        options.expectedContentTypeIncludes &&
        (!contentType ||
          !options.expectedContentTypeIncludes.some((expected) => contentType.includes(expected)))
      ) {
        throw new UnexpectedContentTypeError(
          currentUrl,
          options.expectedContentTypeIncludes.join(" | "),
          contentType,
        );
      }

      const compressedLimit =
        this.config.maxCompressedResponseBytes ?? this.config.maxResponseBytes;
      const contentLength = response.headers.get("content-length");
      if (contentLength && Number(contentLength) > compressedLimit) {
        throw new ResponseTooLargeError(currentUrl, compressedLimit);
      }

      const compressedBytes = await this.readBoundedBody(response, currentUrl, compressedLimit);
      const bytes = this.decodeBoundedBody(response, compressedBytes, currentUrl);
      return {
        finalUrl: currentUrl,
        status: response.status,
        contentType,
        bytes,
        contentHash: sha256Hex(bytes),
        retrievedAt: new Date().toISOString(),
      };
    }
  }

  private async resolveHostnameForPolicy(url: string): Promise<readonly string[]> {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".localhost")) {
      return [];
    }
    if (parsed.hostname.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
      return [];
    }
    const resolver = this.config.dnsLookup ?? defaultDnsLookup;
    return resolver(parsed.hostname);
  }

  private async readBoundedBody(
    response: Response,
    url: string,
    maxBytes: number,
  ): Promise<Uint8Array> {
    if (!response.body) return new Uint8Array(0);

    // Ver nota identica en packages/providers/entscheidsuche/src/remoteClient.ts:
    // los tipos globales de Node no parametrizan getReader() con precision.
    const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const chunkResult: ReadableStreamReadResult<Uint8Array> = await reader.read();
      if (chunkResult.done) break;
      const value: Uint8Array = chunkResult.value;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new ResponseTooLargeError(url, maxBytes);
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged;
  }

  private decodeBoundedBody(response: Response, bytes: Uint8Array, url: string): Uint8Array {
    const encoding = response.headers.get("content-encoding")?.trim().toLowerCase();
    if (!encoding || encoding === "identity") {
      return this.assertDecompressedLimit(bytes, bytes.byteLength, url);
    }

    let decoded: Uint8Array;
    try {
      if (encoding === "gzip" || encoding === "x-gzip") {
        decoded = gunzipSync(bytes);
      } else if (encoding === "deflate") {
        decoded = inflateSync(bytes);
      } else if (encoding === "br") {
        decoded = brotliDecompressSync(bytes);
      } else {
        throw new ContentTypeError(url, "identity | gzip | deflate | br", encoding);
      }
    } catch (error) {
      if (error instanceof ContentTypeError) throw error;
      // El fetch nativo de Node (undici) puede haber descomprimido este cuerpo
      // de forma transparente durante la peticion de red real, conservando
      // intacto el header Content-Encoding del servidor (asi lo exige el
      // Fetch Standard: los headers reflejan la respuesta HTTP real, no el
      // post-procesado del body). Verificado empiricamente (2026-08-04) contra
      // sozialversicherungen.admin.ch, arbeit.swiss y estv.admin.ch: las tres
      // devuelven Content-Encoding: br/gzip con el cuerpo ya en HTML plano.
      // Solo se aceptan los bytes sin descomprimir si tienen la firma
      // esperada segun Content-Type (vease isAlreadyDecodedContent) -- un
      // payload realmente corrupto no suele coincidir, asi que sigue
      // rechazandose exactamente igual que antes.
      if (isAlreadyDecodedContent(bytes, response.headers.get("content-type"))) {
        return this.assertDecompressedLimit(bytes, bytes.byteLength, url);
      }
      throw new ParseError(`Respuesta comprimida invalida en '${url}'.`, {
        url,
        contentEncoding: encoding,
      });
    }

    const maxRatio = this.config.maxCompressionRatio ?? DEFAULT_MAX_COMPRESSION_RATIO;
    const ratio =
      bytes.byteLength === 0 ? decoded.byteLength : decoded.byteLength / bytes.byteLength;
    if (ratio > maxRatio) {
      throw new ResponseTooLargeError(
        url,
        this.config.maxDecompressedResponseBytes ?? this.config.maxResponseBytes,
      );
    }
    return this.assertDecompressedLimit(decoded, bytes.byteLength, url);
  }

  private assertDecompressedLimit(
    bytes: Uint8Array,
    compressedByteLength: number,
    url: string,
  ): Uint8Array {
    const maxBytes = this.config.maxDecompressedResponseBytes ?? this.config.maxResponseBytes;
    if (bytes.byteLength > maxBytes) {
      throw new ResponseTooLargeError(url, maxBytes);
    }
    const ratioLimit = this.config.maxCompressionRatio ?? DEFAULT_MAX_COMPRESSION_RATIO;
    if (compressedByteLength > 0 && bytes.byteLength / compressedByteLength > ratioLimit) {
      throw new ResponseTooLargeError(url, maxBytes);
    }
    return bytes;
  }
}

async function defaultDnsLookup(hostname: string): Promise<readonly string[]> {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((result) => result.address);
}
