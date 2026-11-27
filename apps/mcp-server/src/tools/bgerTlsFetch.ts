import https from "node:https";
import tls from "node:tls";
import {
  assertBgerNotCoolingDown,
  looksLikeBgerChallenge,
  recordBgerChallenge,
  recordBgerSuccess,
} from "./bgerGuard.js";
import { readBgerCache, writeBgerCache } from "./bgerCache.js";

/**
 * www.bger.ch (y search.bger.ch) no envian el certificado intermedio en el handshake TLS
 * (cadena incompleta: UNABLE_TO_VERIFY_LEAF_SIGNATURE en Node, aunque curl/navegadores la
 * completan via AIA). La verificacion TLS NO se desactiva: se anade como CA adicional el
 * intermedio publico de DigiCert que firma el certificado del tribunal, que a su vez esta
 * firmado por DigiCert Global Root G2 (ya presente en las raices de Node).
 * Intermedio: DigiCert Global G2 TLS RSA SHA256 2020 CA1, caduca 2031-03-29,
 * SHA-256 C8:02:5F:9F:C6:5F:DF:C9:5B:3C:A8:CC:78:67:B9:A5:87:B5:27:79:73:95:79:17:46:3F:C8:13:D0:B6:25:A9
 * (origen: http://cacerts.digicert.com/DigiCertGlobalG2TLSRSASHA2562020CA1-1.crt).
 */
const DIGICERT_G2_TLS_RSA_SHA256_2020_CA1 = `-----BEGIN CERTIFICATE-----
MIIEyDCCA7CgAwIBAgIQDPW9BitWAvR6uFAsI8zwZjANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0yMTAzMzAwMDAwMDBaFw0zMTAzMjkyMzU5NTlaMFkxCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxMzAxBgNVBAMTKkRpZ2lDZXJ0IEdsb2Jh
bCBHMiBUTFMgUlNBIFNIQTI1NiAyMDIwIENBMTCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAMz3EGJPprtjb+2QUlbFbSd7ehJWivH0+dbn4Y+9lavyYEEV
cNsSAPonCrVXOFt9slGTcZUOakGUWzUb+nv6u8W+JDD+Vu/E832X4xT1FE3LpxDy
FuqrIvAxIhFhaZAmunjZlx/jfWardUSVc8is/+9dCopZQ+GssjoP80j812s3wWPc
3kbW20X+fSP9kOhRBx5Ro1/tSUZUfyyIxfQTnJcVPAPooTncaQwywa8WV0yUR0J8
osicfebUTVSvQpmowQTCd5zWSOTOEeAqgJnwQ3DPP3Zr0UxJqyRewg2C/Uaoq2yT
zGJSQnWS+Jr6Xl6ysGHlHx+5fwmY6D36g39HaaECAwEAAaOCAYIwggF+MBIGA1Ud
EwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFHSFgMBmx9833s+9KTeqAx2+7c0XMB8G
A1UdIwQYMBaAFE4iVCAYlebjbuYP+vq5Eu0GF485MA4GA1UdDwEB/wQEAwIBhjAd
BgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwdgYIKwYBBQUHAQEEajBoMCQG
CCsGAQUFBzABhhhodHRwOi8vb2NzcC5kaWdpY2VydC5jb20wQAYIKwYBBQUHMAKG
NGh0dHA6Ly9jYWNlcnRzLmRpZ2ljZXJ0LmNvbS9EaWdpQ2VydEdsb2JhbFJvb3RH
Mi5jcnQwQgYDVR0fBDswOTA3oDWgM4YxaHR0cDovL2NybDMuZGlnaWNlcnQuY29t
L0RpZ2lDZXJ0R2xvYmFsUm9vdEcyLmNybDA9BgNVHSAENjA0MAsGCWCGSAGG/WwC
ATAHBgVngQwBATAIBgZngQwBAgEwCAYGZ4EMAQICMAgGBmeBDAECAzANBgkqhkiG
9w0BAQsFAAOCAQEAkPFwyyiXaZd8dP3A+iZ7U6utzWX9upwGnIrXWkOH7U1MVl+t
wcW1BSAuWdH/SvWgKtiwla3JLko716f2b4gp/DA/JIS7w7d7kwcsr4drdjPtAFVS
slme5LnQ89/nD/7d+MS5EHKBCQRfz5eeLjJ1js+aWNJXMX43AYGyZm0pGrFmCW3R
bpD0ufovARTFXFZkAdl9h6g4U5+LXUZtXMYnhIHUfoyMo5tS58aI7Dd8KvvwVVo4
chDYABPPTHPbqjc1qCmBaZx2vN4Ye5DUys/vZwP9BFohFrH/6j/f3IL16/RZkiMN
JCqVJUzKoZHm1Lesh3Sz8W2jmdv51b2EQJ8HmA==
-----END CERTIFICATE-----
`;

export function isBgerHost(hostname: string): boolean {
  return hostname === "bger.ch" || hostname.endsWith(".bger.ch");
}

let cachedCa: string[] | undefined;
function bgerCa(): string[] {
  cachedCa ??= [...tls.rootCertificates, DIGICERT_G2_TLS_RSA_SHA256_2020_CA1];
  return cachedCa;
}

export interface TlsAwareInit {
  /** El llamador ya espero su turno con paceBgerRequest (fuera de su limite de tiempo). */
  readonly paced?: boolean;
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
  readonly signal?: AbortSignal;
  /** Maximo de bytes del cuerpo; se aplica DURANTE la descarga (por defecto 8 MB). */
  readonly maxBytes?: number;
}

export const DEFAULT_MAX_RESPONSE_BYTES = 8_000_000;

export class ResponseTooLargeError extends Error {
  constructor() {
    super("response_too_large");
    this.name = "ResponseTooLargeError";
  }
}

/** Presupuesto de bytes: se consume por trozos y falla en cuanto se supera, sin acumular de mas. */
export function createByteBudget(max: number): (chunkBytes: number) => void {
  let total = 0;
  return (chunkBytes: number): void => {
    total += chunkBytes;
    if (total > max) throw new ResponseTooLargeError();
  };
}

function declaredLength(headers: Headers): number {
  const n = Number(headers.get("content-length") ?? "0");
  return Number.isFinite(n) ? n : 0;
}

/** Envuelve el cuerpo de una respuesta fetch para que el flujo falle al superar el maximo. */
function limitFetchBody(res: Response, max: number): Response {
  if (declaredLength(res.headers) > max) {
    void res.body?.cancel();
    throw new ResponseTooLargeError();
  }
  if (!res.body) return res;
  const consume = createByteBudget(max);
  const limited = res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        try {
          consume(chunk.byteLength);
          controller.enqueue(chunk);
        } catch (error) {
          controller.error(error);
        }
      },
    }),
  );
  const out = new Response(limited, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
  Object.defineProperty(out, "url", { value: res.url });
  return out;
}

/**
 * Ritmo educado hacia *.bger.ch. El portal responde con un reto antibots (Incapsula) cuando
 * recibe muchas peticiones seguidas, y eso dejaba sin corpus justo cuando hacian falta mas
 * paginas. Se reserva una franja de tiempo por peticion (separacion minima entre peticiones
 * a cualquier host bger.ch), incluso si varias llamadas concurrentes compiten. No es una
 * forma de eludir el reto: reduce la carga que lo provoca. Ajustable con
 * SWISS_LEGAL_BGER_MIN_INTERVAL_MS (0 = sin espera; en NODE_ENV=test es 0).
 */
const DEFAULT_BGER_MIN_INTERVAL_MS = 2500;
let nextBgerSlotAt = 0;

export function bgerMinIntervalMs(): number {
  if (process["env"]["NODE_ENV"] === "test") return 0;
  const raw = process["env"]["SWISS_LEGAL_BGER_MIN_INTERVAL_MS"];
  const value = raw === undefined ? Number.NaN : Number(raw);
  if (Number.isFinite(value) && value >= 0) return value;
  // Un poco de variacion (0-700 ms) para que las peticiones no lleguen con cadencia de reloj.
  return DEFAULT_BGER_MIN_INTERVAL_MS + Math.floor(Math.random() * 700);
}

/**
 * Tope por ventana (por defecto 10 peticiones por minuto): una racha larga de sentencias nuevas
 * (corpus de decenas) con solo ~1 s entre peticiones volvio a provocar el reto antibots. Con el
 * tope, una racha se reparte (~6 s por peticion) y lo ya descargado sale de la cache.
 * SWISS_LEGAL_BGER_MAX_PER_MINUTE lo ajusta (0 = sin tope; en NODE_ENV=test es 0).
 */
const DEFAULT_BGER_MAX_PER_MINUTE = 8;
const recentBgerStarts: number[] = [];

export function bgerMaxPerMinute(): number {
  if (process["env"]["NODE_ENV"] === "test") return 0;
  const raw = process["env"]["SWISS_LEGAL_BGER_MAX_PER_MINUTE"];
  const value = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_BGER_MAX_PER_MINUTE;
}

export function resetBgerPacingForTests(): void {
  nextBgerSlotAt = 0;
  recentBgerStarts.length = 0;
}

export async function waitForBgerSlot(
  intervalMs: number = bgerMinIntervalMs(),
  signal?: AbortSignal,
  window: { readonly max: number; readonly ms: number } = {
    max: bgerMaxPerMinute(),
    ms: 60_000,
  },
): Promise<void> {
  if (intervalMs <= 0 && window.max <= 0) return;
  const now = Date.now();
  let start = Math.max(now, nextBgerSlotAt);
  if (window.max > 0 && recentBgerStarts.length >= window.max) {
    // la peticion (max) posiciones atras debe haber salido de la ventana
    const blocking = recentBgerStarts[recentBgerStarts.length - window.max]!;
    start = Math.max(start, blocking + window.ms);
  }
  nextBgerSlotAt = start + Math.max(0, intervalMs);
  if (window.max > 0) {
    recentBgerStarts.push(start);
    if (recentBgerStarts.length > window.max * 4) recentBgerStarts.splice(0, window.max * 2);
  }
  const wait = start - now;
  if (wait <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, wait);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
      },
      { once: true },
    );
  });
}

/**
 * Espera el turno de ritmo ANTES de que el llamador arranque su limite de tiempo. Si la espera
 * (p. ej. por el tope de 10 peticiones por minuto) corriera dentro de ese limite (15-30 s),
 * abortaria la peticion: "fetch_failed: This operation was aborted" y lotes a medias. Lo que ya
 * esta en la cache en disco no espera. Despues se llama a tlsAwareFetch con `paced: true`.
 */
export async function paceBgerRequest(url: string, signal?: AbortSignal): Promise<void> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }
  if (!isBgerHost(host)) return;
  if (await readBgerCache(url)) return;
  assertBgerNotCoolingDown();
  await waitForBgerSlot(undefined, signal);
}

/**
 * Como fetch (sin seguir redirecciones), pero para hosts *.bger.ch completa la cadena TLS
 * con el intermedio pinneado. Para el resto de hosts delega en fetch global.
 */
export async function tlsAwareFetch(url: string, init: TlsAwareInit = {}): Promise<Response> {
  const parsed = new URL(url);
  const maxBytes = init.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (!isBgerHost(parsed.hostname)) {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      redirect: "manual",
      ...(init.signal ? { signal: init.signal } : {}),
      ...(init.headers ? { headers: init.headers } : {}),
      ...(init.body === undefined ? {} : { body: init.body }),
    });
    return limitFetchBody(res, maxBytes);
  }
  const method = init.method ?? "GET";
  const cacheable = method === "GET" && init.body === undefined;
  if (cacheable) {
    // La cache va antes de la pausa: lo ya descargado se sirve aunque el portal bloquee.
    const hit = await readBgerCache(url);
    if (hit) {
      const headers = new Headers({ "x-swiss-legal-cache": "hit" });
      if (hit.contentType) headers.set("content-type", hit.contentType);
      const cached = new Response(hit.body, { status: hit.status, headers });
      Object.defineProperty(cached, "url", { value: url });
      return cached;
    }
  }
  assertBgerNotCoolingDown();
  if (!init.paced) await waitForBgerSlot(undefined, init.signal);
  return new Promise<Response>((resolve, reject) => {
    const req = https.request(
      parsed,
      {
        method: init.method ?? "GET",
        headers: init.headers ?? {},
        ca: bgerCa(),
        rejectUnauthorized: true,
        ...(init.signal ? { signal: init.signal } : {}),
      },
      (res) => {
        const declared = Number(res.headers["content-length"] ?? "0");
        if (Number.isFinite(declared) && declared > maxBytes) {
          res.destroy();
          reject(new ResponseTooLargeError());
          return;
        }
        const consume = createByteBudget(maxBytes);
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          try {
            consume(chunk.byteLength);
            chunks.push(chunk);
          } catch (error) {
            chunks.length = 0;
            res.destroy();
            reject(error instanceof Error ? error : new ResponseTooLargeError());
          }
        });
        res.on("error", reject);
        res.on("end", () => {
          const headers = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (Array.isArray(value)) for (const v of value) headers.append(key, v);
            else if (value !== undefined) headers.set(key, value);
          }
          const status = res.statusCode ?? 0;
          const nullBody = [101, 204, 205, 304].includes(status);
          // https.request no descomprime: se pide identidad (ver cabecera Accept-Encoding).
          const bodyBuffer = nullBody ? null : Buffer.concat(chunks);
          let toCache: Buffer | null = null;
          if (status === 200 && bodyBuffer) {
            if (looksLikeBgerChallenge(bodyBuffer)) {
              // El reto se devuelve tal cual (los llamadores lo clasifican), pero se pausa el acceso.
              recordBgerChallenge();
            } else {
              recordBgerSuccess();
              if (cacheable) toCache = bodyBuffer;
            }
          }
          const response = new Response(bodyBuffer, { status, headers });
          Object.defineProperty(response, "url", { value: url });
          if (toCache) {
            // Se espera a que termine de guardarse: una segunda peticion inmediata debe ya encontrarla.
            void writeBgerCache(url, status, headers.get("content-type"), toCache).then(() =>
              resolve(response),
            );
          } else {
            resolve(response);
          }
        });
      },
    );
    req.on("error", reject);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}
