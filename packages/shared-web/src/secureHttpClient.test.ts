import { afterEach, describe, expect, it, vi } from "vitest";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import {
  ParseError,
  ProviderUnavailableError,
  RateLimitedError,
  ResponseTooLargeError,
  SsrfBlockedError,
  UnexpectedContentTypeError,
} from "@swiss-legal-mcp/core";
import { SecureHttpClient, type SecureHttpClientConfig } from "./secureHttpClient.js";

function baseConfig(overrides: Partial<SecureHttpClientConfig> = {}): SecureHttpClientConfig {
  return {
    providerId: "test-provider",
    allowedDomains: ["example.test"],
    dnsLookup: async () => ["93.184.216.34"],
    timeoutMs: 200,
    maxResponseBytes: 1_000_000,
    maxRetries: 2,
    retryBaseDelayMs: 1,
    retryMaxDelayMs: 5,
    circuitBreakerFailureThreshold: 2,
    circuitBreakerResetMs: 100,
    ...overrides,
  };
}

function installQueuedFetch(responses: ReadonlyArray<Response | (() => Response)>): {
  calls: string[];
} {
  const state = { calls: [] as string[] };
  let index = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      state.calls.push(input.toString());
      const entry = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return typeof entry === "function" ? entry() : entry;
    }),
  );
  return state;
}

/**
 * Simula un servidor que acepta la conexion pero retrasa la respuesta
 * `delayMs` antes de resolverla -- respetando el AbortSignal exactamente
 * como lo hace el `fetch` nativo de Node (verificado empiricamente: aborta
 * con `DOMException(..., "AbortError")`, `instanceof Error === true`). No
 * se puede usar un servidor HTTP local real para esto: DomainAllowlistResolver
 * rechaza explicitamente `localhost`/`127.0.0.1`/IPs privadas (proteccion
 * SSRF real, ver packages/shared/src/domainAllowlistResolver.ts) y no debe
 * tocarse solo para poder probar el timeout.
 */
function installDelayedFetch(delayMs: number, response: () => Response): { calls: string[] } {
  const state = { calls: [] as string[] };
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL, init?: RequestInit) => {
      state.calls.push(input.toString());
      return new Promise<Response>((resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new DOMException("This operation was aborted.", "AbortError"));
          return;
        }
        const timer = setTimeout(() => resolve(response()), delayMs);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("This operation was aborted.", "AbortError"));
        });
      });
    }),
  );
  return state;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SecureHttpClient", () => {
  it("descarga correctamente y calcula hash/contentType", async () => {
    installQueuedFetch([
      new Response(new TextEncoder().encode("hola mundo"), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    const result = await client.get("https://example.test/pagina");
    expect(result.status).toBe(200);
    expect(result.contentType).toContain("text/html");
    expect(new TextDecoder().decode(result.bytes)).toBe("hola mundo");
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rechaza un dominio fuera de la allowlist sin llegar a llamar a fetch", async () => {
    const calls = installQueuedFetch([new Response("no deberia llegar aqui")]);
    const client = new SecureHttpClient(baseConfig());
    await expect(client.get("https://evil.test/x")).rejects.toThrow(SsrfBlockedError);
    expect(calls.calls).toHaveLength(0);
  });

  it("sigue una redireccion hacia un dominio permitido", async () => {
    installQueuedFetch([
      new Response(null, { status: 302, headers: { location: "https://example.test/final" } }),
      new Response(new TextEncoder().encode("contenido final"), {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    const result = await client.get("https://example.test/inicial");
    expect(result.finalUrl).toBe("https://example.test/final");
    expect(new TextDecoder().decode(result.bytes)).toBe("contenido final");
  });

  it("bloquea una redireccion hacia un dominio fuera de la allowlist", async () => {
    installQueuedFetch([
      new Response(null, { status: 302, headers: { location: "https://evil.test/x" } }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    await expect(client.get("https://example.test/inicial")).rejects.toThrow(SsrfBlockedError);
  });

  it("bloquea DNS rebinding antes de llamar a fetch", async () => {
    const calls = installQueuedFetch([new Response("no deberia llegar aqui")]);
    const client = new SecureHttpClient(baseConfig({ dnsLookup: async () => ["10.0.0.1"] }));
    await expect(client.get("https://example.test/x")).rejects.toThrow(SsrfBlockedError);
    expect(calls.calls).toHaveLength(0);
  });

  it("valida DNS despues de cada redirect", async () => {
    const calls = installQueuedFetch([
      new Response(null, { status: 302, headers: { location: "https://example.test/final" } }),
      new Response("no deberia llegar aqui", { status: 200 }),
    ]);
    let lookupCount = 0;
    const client = new SecureHttpClient(
      baseConfig({
        dnsLookup: async () => {
          lookupCount += 1;
          return lookupCount === 1 ? ["93.184.216.34"] : ["127.0.0.1"];
        },
      }),
    );
    await expect(client.get("https://example.test/inicial")).rejects.toThrow(SsrfBlockedError);
    expect(calls.calls).toHaveLength(1);
  });

  it("valida Content-Type esperado y rechaza uno inesperado", async () => {
    installQueuedFetch([
      new Response(new TextEncoder().encode("<html></html>"), {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    await expect(
      client.get("https://example.test/x", { expectedContentTypeIncludes: ["application/pdf"] }),
    ).rejects.toThrow(UnexpectedContentTypeError);
  });

  it("rechaza una respuesta que supera Content-Length maximo", async () => {
    installQueuedFetch([
      new Response(new TextEncoder().encode("x"), {
        status: 200,
        headers: { "content-length": "999999999" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig({ maxResponseBytes: 10 }));
    await expect(client.get("https://example.test/grande")).rejects.toThrow(ResponseTooLargeError);
  });

  it("rechaza una respuesta cuyo cuerpo real (sin Content-Length declarado) supera el limite", async () => {
    const bigBody = new Uint8Array(50);
    installQueuedFetch([new Response(bigBody, { status: 200 })]);
    const client = new SecureHttpClient(baseConfig({ maxResponseBytes: 10 }));
    await expect(client.get("https://example.test/grande")).rejects.toThrow(ResponseTooLargeError);
  });

  it("descomprime gzip valido dentro de limites", async () => {
    installQueuedFetch([
      new Response(gzipSync("hola comprimido"), {
        status: 200,
        headers: { "content-encoding": "gzip" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    const result = await client.get("https://example.test/gzip");
    expect(new TextDecoder().decode(result.bytes)).toBe("hola comprimido");
  });

  it("acepta un cuerpo ya descomprimido por fetch aunque el header siga anunciando gzip", async () => {
    // Reproduce el comportamiento real de undici: en una peticion de red
    // autentica, Node ya descomprime el body de forma transparente y deja el
    // header Content-Encoding tal cual lo envio el servidor. Aqui se simula
    // pasando texto plano (NO gzipSync) con content-encoding: gzip -- que es
    // exactamente lo que devuelve `fetch` real contra estv.admin.ch.
    installQueuedFetch([
      new Response(new TextEncoder().encode("<html>contenido ya plano</html>"), {
        status: 200,
        headers: { "content-encoding": "gzip", "content-type": "text/html" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    const result = await client.get("https://example.test/gzip-ya-plano");
    expect(new TextDecoder().decode(result.bytes)).toBe("<html>contenido ya plano</html>");
  });

  it("descomprime brotli valido dentro de limites", async () => {
    installQueuedFetch([
      new Response(brotliCompressSync("hola brotli"), {
        status: 200,
        headers: { "content-encoding": "br" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    const result = await client.get("https://example.test/brotli");
    expect(new TextDecoder().decode(result.bytes)).toBe("hola brotli");
  });

  it("acepta un cuerpo ya descomprimido por fetch aunque el header siga anunciando brotli", async () => {
    // Reproduce el caso real de sozialversicherungen.admin.ch y arbeit.swiss:
    // ambos responden con Content-Encoding: br pero el body que entrega
    // `fetch` ya es HTML plano (brotli no tiene magic bytes verificables, por
    // eso el fallback usa validez UTF-8 en vez de una firma de formato).
    installQueuedFetch([
      new Response(new TextEncoder().encode("<html>contenido ya plano brotli</html>"), {
        status: 200,
        headers: { "content-encoding": "br", "content-type": "text/html" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    const result = await client.get("https://example.test/br-ya-plano");
    expect(new TextDecoder().decode(result.bytes)).toBe("<html>contenido ya plano brotli</html>");
  });

  it("descomprime deflate valido dentro de limites", async () => {
    installQueuedFetch([
      new Response(deflateSync("hola deflate"), {
        status: 200,
        headers: { "content-encoding": "deflate" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    const result = await client.get("https://example.test/deflate");
    expect(new TextDecoder().decode(result.bytes)).toBe("hola deflate");
  });

  it("rechaza un payload binario invalido que no es ni brotli valido ni UTF-8 valido", async () => {
    // Bytes aleatorios que ni brotliDecompressSync acepta ni son UTF-8 valido
    // (0xff/0xfe son secuencias de continuacion invalidas sin byte lider) --
    // no debe confundirse silenciosamente con "ya descomprimido".
    installQueuedFetch([
      new Response(new Uint8Array([0xff, 0xfe, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05]), {
        status: 200,
        headers: { "content-encoding": "br", "content-type": "text/html" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    await expect(client.get("https://example.test/br-corrupto")).rejects.toThrow(ParseError);
  });

  it("acepta un PDF ya descomprimido por fetch validando la firma %PDF- en vez de UTF-8", async () => {
    const fakePdfBytes = new TextEncoder().encode("%PDF-1.4\n%binary-ish-pdf-content");
    installQueuedFetch([
      new Response(fakePdfBytes, {
        status: 200,
        headers: { "content-encoding": "gzip", "content-type": "application/pdf" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    const result = await client.get("https://example.test/pdf-ya-plano");
    expect(new TextDecoder().decode(result.bytes)).toBe(new TextDecoder().decode(fakePdfBytes));
  });

  it("rechaza gzip truncado como parseo invalido", async () => {
    installQueuedFetch([
      new Response(gzipSync("contenido").subarray(0, 4), {
        status: 200,
        headers: { "content-encoding": "gzip" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    await expect(client.get("https://example.test/gzip-roto")).rejects.toThrow(ParseError);
  });

  it("rechaza una expansion comprimida excesiva", async () => {
    installQueuedFetch([
      new Response(gzipSync("x".repeat(10_000)), {
        status: 200,
        headers: { "content-encoding": "gzip" },
      }),
    ]);
    const client = new SecureHttpClient(
      baseConfig({ maxCompressionRatio: 2, maxDecompressedResponseBytes: 1_000_000 }),
    );
    await expect(client.get("https://example.test/bomba")).rejects.toThrow(ResponseTooLargeError);
  });

  it("rechaza Content-Length comprimido enganoso si supera el limite", async () => {
    installQueuedFetch([
      new Response(gzipSync("ok"), {
        status: 200,
        headers: { "content-encoding": "gzip", "content-length": "999999" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig({ maxCompressedResponseBytes: 10 }));
    await expect(client.get("https://example.test/content-length")).rejects.toThrow(
      ResponseTooLargeError,
    );
  });

  it("limita respuestas chunked comprimidas sin Content-Length", async () => {
    installQueuedFetch([
      new Response(gzipSync("x".repeat(200)), {
        status: 200,
        headers: { "content-encoding": "gzip" },
      }),
    ]);
    const client = new SecureHttpClient(
      baseConfig({ maxCompressionRatio: 100, maxDecompressedResponseBytes: 50 }),
    );
    await expect(client.get("https://example.test/chunked-gzip")).rejects.toThrow(
      ResponseTooLargeError,
    );
  });

  it("rechaza content-encoding desconocido", async () => {
    installQueuedFetch([
      new Response(new TextEncoder().encode("abc"), {
        status: 200,
        headers: { "content-encoding": "compress" },
      }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    await expect(client.get("https://example.test/encoding")).rejects.toThrow(
      UnexpectedContentTypeError,
    );
  });

  it("reintenta un 503 transitorio y luego tiene exito", async () => {
    const calls = installQueuedFetch([
      new Response("no disponible", { status: 503 }),
      new Response(new TextEncoder().encode("ok"), { status: 200 }),
    ]);
    const client = new SecureHttpClient(baseConfig());
    const result = await client.get("https://example.test/x");
    expect(new TextDecoder().decode(result.bytes)).toBe("ok");
    expect(calls.calls).toHaveLength(2);
  });

  it("traduce un 429 persistente a RateLimitedError tras agotar reintentos", async () => {
    installQueuedFetch([new Response("limite", { status: 429 })]);
    const client = new SecureHttpClient(baseConfig({ maxRetries: 1 }));
    await expect(client.get("https://example.test/x")).rejects.toThrow(RateLimitedError);
  });

  it("abre el circuit breaker tras fallos consecutivos y deja de intentar", async () => {
    installQueuedFetch([new Response("error", { status: 502 })]);
    const client = new SecureHttpClient(
      baseConfig({ maxRetries: 0, circuitBreakerFailureThreshold: 1 }),
    );
    await expect(client.get("https://example.test/x")).rejects.toThrow(ProviderUnavailableError);
    expect(client.circuitState).toBe("open");
    await expect(client.get("https://example.test/x")).rejects.toThrow(ProviderUnavailableError);
  });

  describe("timeout y limpieza del AbortController", () => {
    it("A: aborta cuando el servidor retrasa la respuesta mas alla de timeoutMs, y devuelve el error estructurado esperado", async () => {
      installDelayedFetch(500, () => new Response("tarde", { status: 200 }));
      const client = new SecureHttpClient(baseConfig({ timeoutMs: 30, maxRetries: 0 }));
      const error = await client.get("https://example.test/lento").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderUnavailableError);
      const providerError = error as ProviderUnavailableError;
      // El contrato actual de ProviderUnavailableError marca retryable:true
      // (fallo transitorio de red) -- se conserva, no se inventa uno nuevo.
      expect(providerError.retryable).toBe(true);
      // No debe filtrar stack trace ni ruta local en el mensaje estructurado.
      expect(providerError.message).not.toMatch(/\/Users\//);
      expect(providerError.message).not.toMatch(/\bat \S+:\d+:\d+/);
    });

    it("A: no espera a que la respuesta tardia realmente llegue -- se resuelve en cuanto vence timeoutMs, no cuando vence el retraso simulado", async () => {
      installDelayedFetch(1000, () => new Response("muy tarde", { status: 200 }));
      const client = new SecureHttpClient(baseConfig({ timeoutMs: 30, maxRetries: 0 }));
      const start = Date.now();
      await expect(client.get("https://example.test/lento")).rejects.toThrow(
        ProviderUnavailableError,
      );
      const elapsedMs = Date.now() - start;
      expect(elapsedMs).toBeLessThan(500); // muy por debajo de los 1000ms del retraso simulado
    });

    it("B: limpia el timer del timeout cuando la peticion termina correctamente", async () => {
      installQueuedFetch([new Response("ok", { status: 200 })]);
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
      const client = new SecureHttpClient(baseConfig({ timeoutMs: 5000 }));
      await client.get("https://example.test/rapido");
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it("B: limpia el timer del timeout cuando la peticion falla (no-timeout)", async () => {
      installQueuedFetch([new Response("error servidor", { status: 502 })]);
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
      const client = new SecureHttpClient(baseConfig({ timeoutMs: 5000, maxRetries: 0 }));
      await expect(client.get("https://example.test/falla")).rejects.toThrow();
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it("B: una peticion exitosa con timeout corto no deja un timer tardio que afecte a peticiones posteriores", async () => {
      // timeoutMs muy corto pero la respuesta llega antes: exito. Si el timer
      // no se limpiase, dispararia despues y podria interferir con llamadas
      // siguientes del mismo test runner (mismo proceso, mismo event loop).
      for (let i = 0; i < 3; i += 1) {
        installQueuedFetch([new Response(`ok-${i}`, { status: 200 })]);
        const client = new SecureHttpClient(baseConfig({ timeoutMs: 20 }));
        const result = await client.get(`https://example.test/rapido-${i}`);
        expect(new TextDecoder().decode(result.bytes)).toBe(`ok-${i}`);
      }
      // Margen generoso por encima de los timeoutMs de las 3 llamadas: si
      // algun timer hubiese quedado vivo, ya deberia haber disparado.
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it("C: respuesta justo antes del limite tiene exito (margen generoso, no flaky)", async () => {
      installDelayedFetch(20, () => new Response("a tiempo", { status: 200 }));
      const client = new SecureHttpClient(baseConfig({ timeoutMs: 300, maxRetries: 0 }));
      const result = await client.get("https://example.test/justo-a-tiempo");
      expect(new TextDecoder().decode(result.bytes)).toBe("a tiempo");
    });

    it("C: respuesta despues del limite provoca timeout (margen generoso, no flaky)", async () => {
      installDelayedFetch(300, () => new Response("demasiado tarde", { status: 200 }));
      const client = new SecureHttpClient(baseConfig({ timeoutMs: 20, maxRetries: 0 }));
      await expect(client.get("https://example.test/demasiado-tarde")).rejects.toThrow(
        ProviderUnavailableError,
      );
    });

    // D. Abort externo: SecureFetchOptions no admite actualmente una señal
    // externa (solo `expectedContentTypeIncludes`/`headers`) -- no se añade
    // esa superficie nueva aqui: no es "estrictamente necesario para probar
    // timeout" (el timeout interno ya funciona y esta cubierto arriba), y el
    // contrato publico no cambia salvo que exista un bug real, que no es el
    // caso. Documentado en vez de implementado, tal como se pidio.
  });
});
