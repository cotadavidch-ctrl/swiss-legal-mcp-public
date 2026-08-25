import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  ProviderResponseError,
  ProviderUnavailableError,
  RateLimitedError,
} from "@swiss-legal-mcp/core";
import type { ReadableStreamDefaultReader, ReadableStreamReadResult } from "node:stream/web";
import type { EntscheidsucheConfig } from "./config.js";
import { CircuitBreaker } from "@swiss-legal-mcp/shared";

const PROVIDER_ID = "entscheidsuche";
const TRANSIENT_HTTP_STATUS_CODES = new Set([429, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Backoff exponencial "full jitter" (ver AWS Architecture Blog,
 * "Exponential Backoff And Jitter"): espera un valor aleatorio entre 0 y
 * min(maxMs, baseMs * 2^intento), en vez de un valor fijo creciente. Evita
 * que reintentos de múltiples clientes se sincronicen entre si.
 */
function backoffWithJitter(attempt: number, baseMs: number, maxMs: number): number {
  const cap = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.random() * cap;
}

// McpError.code se declara como `number` plano en el SDK (no como el tipo del
// enum ErrorCode), asi que se comparan como numeros explicitamente en vez de
// comparar directamente contra los miembros del enum.
const REQUEST_TIMEOUT_CODE: number = ErrorCode.RequestTimeout;
const CONNECTION_CLOSED_CODE: number = ErrorCode.ConnectionClosed;

function isTransientError(error: unknown): boolean {
  if (error instanceof StreamableHTTPError) {
    return error.code !== undefined && TRANSIENT_HTTP_STATUS_CODES.has(error.code);
  }
  if (error instanceof McpError) {
    return error.code === REQUEST_TIMEOUT_CODE || error.code === CONNECTION_CLOSED_CODE;
  }
  return false;
}

function extractErrorText(result: CallToolResult): string {
  const texts = result.content
    .filter((item): item is { type: "text"; text: string } => item.type === "text")
    .map((item) => item.text);
  return texts.join(" ") || "el proveedor remoto no incluyo detalle del error.";
}

function toTypedError(error: unknown, toolName: string): Error {
  if (error instanceof StreamableHTTPError && error.code === 429) {
    return new RateLimitedError(PROVIDER_ID);
  }
  const message = error instanceof Error ? error.message : String(error);
  return new ProviderUnavailableError(
    PROVIDER_ID,
    `Fallo llamando a la herramienta remota '${toolName}': ${message}`,
  );
}

/**
 * Envuelve `fetch` para imponer un limite maximo de bytes de respuesta,
 * antes de que el transporte del SDK intente parsear el cuerpo. Comprueba
 * primero Content-Length (rapido) y, si no esta presente o es incorrecto,
 * cuenta bytes reales mientras lee el stream.
 */
function createSizeLimitedFetch(maxBytes: number): FetchLike {
  return async (url, init) => {
    const response = await fetch(url, init);

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > maxBytes) {
      throw new Error(
        `Respuesta remota rechazada: Content-Length=${contentLength} supera el limite de ${maxBytes} bytes.`,
      );
    }

    if (!response.body) return response;

    // Los tipos globales de Node para ReadableStream no parametrizan
    // getReader() con precision en esta version de @types/node (devuelve
    // ReadableStreamDefaultReader<any>), asi que se afirma explicitamente el
    // tipo real (Uint8Array) en el propio getReader(); a partir de ahi
    // read() ya queda correctamente tipado sin necesitar otra afirmacion.
    const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const chunkResult: ReadableStreamReadResult<Uint8Array> = await reader.read();
      if (chunkResult.done) break;
      const value: Uint8Array = chunkResult.value;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error(`Respuesta remota rechazada: supera el limite de ${maxBytes} bytes.`);
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new Response(merged, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

/**
 * Cliente MCP remoto resiliente contra entscheidsuche.ch: timeout
 * configurable, reintentos con backoff+jitter solo para errores transitorios
 * (timeout, ConnectionClosed, HTTP 429/502/503/504), y circuit breaker.
 * No cachea nada por si mismo -- eso es responsabilidad de quien lo use
 * (ver entscheidsucheProvider.ts), que solo cachea resultados exitosos.
 */
export class EntscheidsucheRemoteClient {
  private readonly client: Client;
  private readonly transport: StreamableHTTPClientTransport;
  private readonly breaker: CircuitBreaker;
  private connectPromise: Promise<void> | undefined;

  constructor(private readonly config: EntscheidsucheConfig) {
    this.client = new Client({ name: "swiss-legal-mcp-entscheidsuche-client", version: "1.0.0" });
    this.transport = new StreamableHTTPClientTransport(new URL(config.endpoint), {
      fetch: createSizeLimitedFetch(config.maxResponseBytes),
    });
    this.breaker = new CircuitBreaker(
      config.circuitBreakerFailureThreshold,
      config.circuitBreakerResetMs,
    );
  }

  get circuitState() {
    return this.breaker.currentState;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connectPromise) {
      this.connectPromise = this.client.connect(this.transport).catch((error: unknown) => {
        this.connectPromise = undefined;
        throw error;
      });
    }
    await this.connectPromise;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    if (!this.breaker.canAttempt()) {
      throw new ProviderUnavailableError(
        PROVIDER_ID,
        `Circuit breaker abierto para '${PROVIDER_ID}': demasiados fallos recientes contra el servidor remoto.`,
      );
    }

    for (let attempt = 0; ; attempt += 1) {
      this.breaker.beginAttempt();
      try {
        await this.ensureConnected();
        const result = (await this.client.callTool({ name, arguments: args }, undefined, {
          timeout: this.config.timeoutMs,
        })) as CallToolResult;
        this.breaker.recordSuccess();

        if (result.isError) {
          // Conexion correcta, pero el servidor remoto rechazo la peticion
          // (validacion, herramienta desconocida...). Nunca reintentable.
          throw new ProviderResponseError(PROVIDER_ID, name, extractErrorText(result));
        }
        return result;
      } catch (error) {
        if (error instanceof ProviderResponseError) {
          throw error;
        }
        this.breaker.recordFailure();
        const transient = isTransientError(error);
        if (!transient || attempt >= this.config.maxRetries) {
          throw toTypedError(error, name);
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

  /** Cierre ordenado del cliente MCP remoto. */
  async close(): Promise<void> {
    await this.client.close();
    this.connectPromise = undefined;
  }
}
