import {
  ProviderResponseError,
  ProviderUnavailableError,
  RateLimitedError,
} from "@swiss-legal-mcp/core";
import { CircuitBreaker, TtlCache } from "@swiss-legal-mcp/shared";
import type { ReadableStreamDefaultReader, ReadableStreamReadResult } from "node:stream/web";
import type { FedlexConfig } from "./config.js";
import { FedlexSourceResolver } from "./officialSourceResolver.js";
import {
  sparqlAskResultSchema,
  sparqlJsonResultSchema,
  type SparqlJsonResult,
} from "./remoteTypes.js";

const PROVIDER_ID = "fedlex";
const TRANSIENT_HTTP_STATUS_CODES = new Set([429, 502, 503, 504]);

export const JOLUX = "http://data.legilux.public.lu/resource/ontology/jolux#";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff exponencial "full jitter" (AWS Architecture Blog), identico al usado en entscheidsuche. */
function backoffWithJitter(attempt: number, baseMs: number, maxMs: number): number {
  const cap = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.random() * cap;
}

/**
 * Valida que un IRI sea una URL https sintacticamente valida y sin
 * caracteres capaces de romper fuera de los angle-brackets `<...>` de una
 * consulta SPARQL. No es una allowlist de dominio (eso es
 * FedlexSourceResolver, usado al DESCARGAR manifestaciones, no al construir
 * IRIs de consulta) -- es la unica defensa necesaria aqui porque los IRIs
 * consultados siempre se construyen a partir de datos ya verificados como
 * reales (resultados previos de Fedlex), nunca de texto libre de usuario.
 */
export function assertSafeIri(iri: string): void {
  let parsed: URL;
  try {
    parsed = new URL(iri);
  } catch {
    throw new Error(`IRI invalido: '${iri}'.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`IRI rechazado: protocolo '${parsed.protocol}' no permitido (solo https).`);
  }
  if (/[<>"\s]/.test(iri)) {
    throw new Error(`IRI rechazado: contiene caracteres no permitidos en una consulta SPARQL.`);
  }
}

/**
 * Escapa un literal de texto para insertarlo entre comillas dobles en una
 * consulta SPARQL (prevencion de inyeccion SPARQL: nunca se concatena texto
 * de usuario sin escapar). Sigue el escapado de cadenas de SPARQL 1.1
 * (ECHAR: \\, \", \n, \r, \t).
 */
export function sparqlEscapeString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/** Numero RS/SR real observado: digitos con puntos y guiones opcionales (p.ej. "101", "832.10", "822.11"). */
const SYSTEMATIC_NUMBER_PATTERN = /^[0-9]+(?:\.[0-9]+)*(?:-[0-9]+)?$/;

export function assertSafeSystematicNumber(value: string): void {
  if (!SYSTEMATIC_NUMBER_PATTERN.test(value)) {
    throw new Error(`Numero sistematico (RS/SR) con formato no reconocido: '${value}'.`);
  }
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function assertSafeIsoDate(value: string): void {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`Fecha con formato no reconocido (se espera YYYY-MM-DD): '${value}'.`);
  }
}

export function buildDescribeQuery(iri: string): string {
  assertSafeIri(iri);
  return `SELECT DISTINCT ?p ?o WHERE { <${iri}> ?p ?o }`;
}

export function buildFindWorksBySystematicNumberQuery(rsNumber: string): string {
  assertSafeSystematicNumber(rsNumber);
  return `
PREFIX jolux: <${JOLUX}>
SELECT DISTINCT ?work WHERE {
  ?work a jolux:ConsolidationAbstract .
  ?work jolux:historicalLegalId "${sparqlEscapeString(rsNumber)}" .
}`;
}

export function buildListConsolidationsQuery(workEli: string): string {
  assertSafeIri(workEli);
  return `
PREFIX jolux: <${JOLUX}>
SELECT DISTINCT ?consolidation ?dateApplicability ?dateEndApplicability WHERE {
  ?consolidation jolux:isMemberOf <${workEli}> .
  ?consolidation jolux:dateApplicability ?dateApplicability .
  OPTIONAL { ?consolidation jolux:dateEndApplicability ?dateEndApplicability . }
}
ORDER BY ?dateApplicability`;
}

/**
 * Busqueda de texto sobre titulos reales (nivel Work/ConsolidationAbstract).
 * Verificado en vivo (Fase 3): `FILTER(CONTAINS(...))` con LIMIT responde en
 * menos de un segundo; SIN limite puede tardar decenas de segundos (ver
 * docs/provider-contracts/fedlex.md). Por eso `limit` es obligatorio aqui.
 * `bif:contains` (busqueda de texto propia de Virtuoso) se probo en vivo y
 * el endpoint publico la rechaza con HTTP 400 "Illegal requests in query" --
 * no esta disponible, documentado como limitacion real.
 */
export function buildSearchByTitleQuery(text: string, languageCode: string, limit: number): string {
  return `
PREFIX jolux: <${JOLUX}>
SELECT DISTINCT ?work ?title ?rsNumber WHERE {
  ?work a jolux:ConsolidationAbstract .
  ?work jolux:isRealizedBy ?expr .
  ?expr jolux:language <http://publications.europa.eu/resource/authority/language/${languageCode}> .
  ?expr jolux:title ?title .
  OPTIONAL { ?work jolux:historicalLegalId ?rsNumber . }
  FILTER(CONTAINS(LCASE(STR(?title)), LCASE("${sparqlEscapeString(text)}")))
}
LIMIT ${Math.max(1, Math.min(200, Math.trunc(limit)))}`;
}

interface FetchResult {
  readonly status: number;
  readonly contentType: string | null;
  readonly bodyText: string;
}

/** fetch con limite de tamano de respuesta y timeout via AbortController. */
async function sizeLimitedFetch(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  maxBytes: number,
  externalSignal?: AbortSignal,
): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Handle external signal
  let removeExternalListener: (() => void) | null = null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      // If already aborted, abort our controller immediately.
      controller.abort();
    } else {
      const listener = () => {
        controller.abort();
      };
      externalSignal.addEventListener("abort", listener);
      removeExternalListener = () => {
        externalSignal.removeEventListener("abort", listener);
      };
    }
  }

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > maxBytes) {
      throw new Error(
        `Respuesta rechazada: Content-Length=${contentLength} supera el limite de ${maxBytes} bytes.`,
      );
    }
    if (!response.body) {
      return {
        status: response.status,
        contentType: response.headers.get("content-type"),
        bodyText: "",
      };
    }
    // Los tipos globales de Node para ReadableStream no parametrizan
    // getReader() con precision en esta version de @types/node (devuelve
    // ReadableStreamDefaultReader<any>), asi que se afirma explicitamente el
    // tipo real (Uint8Array) aqui, igual que en
    // packages/providers/entscheidsuche/src/remoteClient.ts.
    const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const result: ReadableStreamReadResult<Uint8Array> = await reader.read();
      if (result.done) break;
      const value: Uint8Array = result.value;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error(`Respuesta rechazada: supera el limite de ${maxBytes} bytes.`);
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
      bodyText: Buffer.from(merged).toString("utf8"),
    };
  } finally {
    clearTimeout(timer);
    if (removeExternalListener) {
      removeExternalListener();
    }
  }
}

function isTransientFetchError(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return true;
  if (error instanceof Error && /^HTTP \d+/.test(error.message)) {
    const status = Number(error.message.slice(5, 8));
    return TRANSIENT_HTTP_STATUS_CODES.has(status);
  }
  return false;
}

/**
 * Cliente SPARQL resiliente contra el endpoint publico de Fedlex: timeout
 * configurable, reintentos con backoff+jitter solo para errores transitorios,
 * circuit breaker, cache TTL en memoria (nunca cachea errores), limite de
 * tamano de respuesta, validacion Zod de la respuesta. Consultas
 * parametrizadas (ver sparqlEscapeString/assertSafe*) para prevenir
 * inyeccion SPARQL.
 */
export class FedlexSparqlClient {
  private readonly breaker: CircuitBreaker;
  private readonly queryCache: TtlCache<SparqlJsonResult>;
  private readonly manifestationCache: TtlCache<string>;
  readonly sourceResolver: FedlexSourceResolver;

  constructor(private readonly config: FedlexConfig) {
    this.breaker = new CircuitBreaker(
      config.circuitBreakerFailureThreshold,
      config.circuitBreakerResetMs,
    );
    this.queryCache = new TtlCache<SparqlJsonResult>(config.cacheTtlSparqlMs);
    this.manifestationCache = new TtlCache<string>(config.cacheTtlManifestationMs);
    this.sourceResolver = new FedlexSourceResolver(config.allowedOfficialDomains);
  }

  get circuitState() {
    return this.breaker.currentState;
  }

  private async withResilience<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!this.breaker.canAttempt()) {
      throw new ProviderUnavailableError(
        PROVIDER_ID,
        `Circuit breaker abierto para '${PROVIDER_ID}': demasiados fallos recientes contra el endpoint SPARQL.`,
      );
    }
    for (let attempt = 0; ; attempt += 1) {
      // Check if operation was aborted
      if (signal?.aborted) {
        throw new Error("Aborted due to external signal");
      }

      this.breaker.beginAttempt();
      try {
        const result = await operation();
        this.breaker.recordSuccess();
        return result;
      } catch (error) {
        // Check if operation was aborted after the operation completed
        if (signal?.aborted) {
          throw new Error("Aborted due to external signal", { cause: error });
        }

        if (error instanceof ProviderResponseError) {
          // Respuesta recibida correctamente pero con forma/Content-Type
          // invalido: nunca es transitorio, no debe reintentarse.
          this.breaker.recordFailure();
          throw error;
        }
        this.breaker.recordFailure();
        const transient = isTransientFetchError(error);
        if (!transient || attempt >= this.config.maxRetries) {
          if (error instanceof Error && /^HTTP 429/.test(error.message)) {
            throw new RateLimitedError(PROVIDER_ID);
          }
          throw error instanceof ProviderUnavailableError
            ? error
            : new ProviderUnavailableError(
                PROVIDER_ID,
                `Fallo consultando Fedlex: ${error instanceof Error ? error.message : String(error)}`,
              );
        }
        await sleep(
          backoffWithJitter(attempt, this.config.retryBaseDelayMs, this.config.retryMaxDelayMs),
        );
        if (!this.breaker.canAttempt()) {
          throw new ProviderUnavailableError(
            PROVIDER_ID,
            `Circuit breaker abierto para '${PROVIDER_ID}' tras reintentos fallidos.`,
          );
        }
      }
    }
  }

  /** Ejecuta la peticion HTTP compartida por SELECT/ASK: fetch, status, Content-Type, JSON.parse. */
  private async executeRawQuery(
    sparql: string,
    operationName: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const url = `${this.config.sparqlEndpoint}?query=${encodeURIComponent(sparql)}`;
    const response = await sizeLimitedFetch(
      url,
      { Accept: "application/sparql-results+json" },
      this.config.timeoutMs,
      this.config.maxResponseBytes,
      signal,
    );
    if (response.status !== 200) {
      throw new Error(
        `HTTP ${response.status} del endpoint SPARQL de Fedlex: ${response.bodyText.slice(0, 300)}`,
      );
    }
    if (response.contentType && !response.contentType.includes("json")) {
      throw new ProviderResponseError(
        PROVIDER_ID,
        operationName,
        `Content-Type inesperado: '${response.contentType}' (se esperaba JSON).`,
      );
    }
    try {
      return JSON.parse(response.bodyText);
    } catch {
      throw new ProviderResponseError(PROVIDER_ID, operationName, "Respuesta no es JSON valido.");
    }
  }

  /** Ejecuta una consulta SPARQL SELECT ya construida (ver builders arriba) y valida el resultado con Zod. */
  async query(sparql: string, cacheKey?: string, signal?: AbortSignal): Promise<SparqlJsonResult> {
    if (cacheKey) {
      const cached = this.queryCache.get(cacheKey);
      if (cached) return cached;
    }

    const result = await this.withResilience(async () => {
      const parsedJson = await this.executeRawQuery(sparql, "sparql_query", signal);
      const validated = sparqlJsonResultSchema.safeParse(parsedJson);
      if (!validated.success) {
        throw new ProviderResponseError(
          PROVIDER_ID,
          "sparql_query",
          `Respuesta SPARQL con forma inesperada: ${validated.error.issues.map((i) => i.message).join("; ")}`,
        );
      }
      return validated.data;
    }, signal);

    if (cacheKey) {
      this.queryCache.set(cacheKey, result);
    }
    return result;
  }

  /**
   * Ejecuta una consulta SPARQL ASK. Forma de respuesta real verificada en
   * vivo: `{ head: { link: [] }, boolean: true }` -- distinta de SELECT, por
   * eso usa su propio schema (`sparqlAskResultSchema`) en vez de reutilizar
   * `query()`.
   */
  async ask(sparql: string, signal?: AbortSignal): Promise<boolean> {
    return this.withResilience(async () => {
      const parsedJson = await this.executeRawQuery(sparql, "sparql_ask", signal);
      const validated = sparqlAskResultSchema.safeParse(parsedJson);
      if (!validated.success) {
        throw new ProviderResponseError(
          PROVIDER_ID,
          "sparql_ask",
          `Respuesta ASK con forma inesperada: ${validated.error.issues.map((i) => i.message).join("; ")}`,
        );
      }
      return validated.data.boolean;
    }, signal);
  }

  /**
   * Descarga una manifestacion (XML/HTML/PDF) de Fedlex. SOLO acepta URLs
   * que `FedlexSourceResolver` confirme como dominio oficial (rechaza
   * dominios internos como intranet.fedlex.admin.ch, IPs privadas,
   * localhost, protocolo distinto de https).
   */
  async fetchManifestation(url: string, signal?: AbortSignal): Promise<string> {
    const resolution = this.sourceResolver.resolve(url);
    if (!resolution.isOfficialCandidate) {
      throw new Error(
        `URL de manifestacion rechazada (${resolution.reason ?? "motivo desconocido"}): ${url}`,
      );
    }

    const cached = this.manifestationCache.get(url);
    if (cached) return cached;

    const body = await this.withResilience(async () => {
      const response = await sizeLimitedFetch(
        url,
        {},
        this.config.timeoutMs,
        this.config.maxXmlBytes,
        signal,
      );
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status} descargando manifestacion de Fedlex: ${url}`);
      }
      return response.bodyText;
    }, signal);

    this.manifestationCache.set(url, body);
    return body;
  }
}
