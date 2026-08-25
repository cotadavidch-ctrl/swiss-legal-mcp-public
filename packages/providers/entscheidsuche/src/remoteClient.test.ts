import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderResponseError,
  ProviderUnavailableError,
  RateLimitedError,
} from "@swiss-legal-mcp/core";
import { EntscheidsucheRemoteClient } from "./remoteClient.js";
import type { EntscheidsucheConfig } from "./config.js";

const ENDPOINT = "https://mock.entscheidsuche.test/mcp";

function baseConfig(overrides: Partial<EntscheidsucheConfig> = {}): EntscheidsucheConfig {
  return {
    endpoint: ENDPOINT,
    timeoutMs: 200,
    maxRetries: 2,
    retryBaseDelayMs: 5,
    retryMaxDelayMs: 20,
    circuitBreakerFailureThreshold: 2,
    circuitBreakerResetMs: 200,
    cacheTtlServerInfoMs: 0,
    cacheTtlHierarchyMs: 0,
    cacheTtlFacetsMs: 0,
    cacheTtlDocumentMs: 0,
    maxResponseBytes: 5_000_000,
    allowedOfficialDomains: ["bger.ch"],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

interface MockFetchOptions {
  onPost: (body: {
    method: string;
    id?: number;
    params?: Record<string, unknown>;
  }) => Response | Promise<Response>;
}

function installMockFetch(options: MockFetchOptions): { calls: number } {
  const state = { calls: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: string | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return new Response(null, { status: 405 });
      }
      state.calls += 1;
      // El transporte real siempre envia el body como string JSON (nunca un
      // stream u otro BodyInit), por eso el cast directo es seguro aqui.
      const parsedBody = JSON.parse((init?.body as string | undefined) ?? "{}") as {
        method: string;
        id?: number;
        params?: Record<string, unknown>;
      };
      if (parsedBody.method === "initialize") {
        return jsonResponse({
          jsonrpc: "2.0",
          id: parsedBody.id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "mock-entscheidsuche", version: "0.0.0" },
          },
        });
      }
      if (parsedBody.method === "notifications/initialized") {
        return new Response(null, { status: 202 });
      }
      return options.onPost(parsedBody);
    }),
  );
  return state;
}

function toolCallResult(id: number | undefined, payload: unknown, isError = false) {
  return jsonResponse({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: isError ? undefined : payload,
      isError,
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EntscheidsucheRemoteClient (transporte mockeado, sin red real)", () => {
  it("conecta y llama una tool con exito en el primer intento", async () => {
    const mock = installMockFetch({
      onPost: (body) => toolCallResult(body.id, { total: 0, hits: [] }),
    });
    const client = new EntscheidsucheRemoteClient(baseConfig());
    const result = await client.callTool("search", { query: "*" });
    expect(result.isError).toBeFalsy();
    expect(mock.calls).toBeGreaterThanOrEqual(2); // initialize + tools/call
    await client.close();
  });

  it("reintenta tras un 503 transitorio y termina en exito", async () => {
    let attempt = 0;
    installMockFetch({
      onPost: (body) => {
        attempt += 1;
        if (attempt === 1) {
          return new Response("service unavailable", { status: 503 });
        }
        return toolCallResult(body.id, { total: 0, hits: [] });
      },
    });
    const client = new EntscheidsucheRemoteClient(baseConfig());
    const result = await client.callTool("search", { query: "*" });
    expect(result.isError).toBeFalsy();
    expect(attempt).toBe(2);
    await client.close();
  });

  it("clasifica 429 como RateLimitedError cuando se agotan los reintentos", async () => {
    installMockFetch({
      onPost: () => new Response("too many requests", { status: 429 }),
    });
    const client = new EntscheidsucheRemoteClient(baseConfig({ maxRetries: 1 }));
    await expect(client.callTool("search", { query: "*" })).rejects.toThrow(RateLimitedError);
    await client.close();
  });

  it("no reintenta un isError:true del proveedor remoto (error de validacion)", async () => {
    let calls = 0;
    installMockFetch({
      onPost: (body) => {
        calls += 1;
        return toolCallResult(body.id, "size must be <= 100", true);
      },
    });
    const client = new EntscheidsucheRemoteClient(baseConfig());
    await expect(client.callTool("search", { query: "*", size: 99999 })).rejects.toThrow(
      ProviderResponseError,
    );
    expect(calls).toBe(1);
    await client.close();
  });

  it("abre el circuit breaker tras fallos consecutivos y deja de llamar a fetch", async () => {
    let calls = 0;
    installMockFetch({
      onPost: () => {
        calls += 1;
        return new Response("bad gateway", { status: 502 });
      },
    });
    const client = new EntscheidsucheRemoteClient(
      baseConfig({ maxRetries: 0, circuitBreakerFailureThreshold: 1 }),
    );
    await expect(client.callTool("search", { query: "*" })).rejects.toThrow(
      ProviderUnavailableError,
    );
    const callsAfterFirstFailure = calls;
    await expect(client.callTool("search", { query: "*" })).rejects.toThrow(
      ProviderUnavailableError,
    );
    expect(calls).toBe(callsAfterFirstFailure); // el segundo intento no debe llamar a fetch
    await client.close();
  });

  it("agota reintentos por timeout y termina en ProviderUnavailableError", async () => {
    installMockFetch({
      onPost: async (body) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return toolCallResult(body.id, { total: 0, hits: [] });
      },
    });
    const client = new EntscheidsucheRemoteClient(
      baseConfig({ timeoutMs: 30, maxRetries: 1, retryBaseDelayMs: 5, retryMaxDelayMs: 10 }),
    );
    await expect(client.callTool("search", { query: "*" })).rejects.toThrow(
      ProviderUnavailableError,
    );
    await client.close();
  }, 10_000);

  it("close() permite un cierre ordenado sin dejar la conexion colgando", async () => {
    installMockFetch({
      onPost: (body) => toolCallResult(body.id, { total: 0, hits: [] }),
    });
    const client = new EntscheidsucheRemoteClient(baseConfig());
    await client.callTool("search", { query: "*" });
    await expect(client.close()).resolves.toBeUndefined();
  });

  it("respeta el limite de tamano de respuesta (Content-Length)", async () => {
    installMockFetch({
      onPost: (body) =>
        jsonResponse(
          {
            jsonrpc: "2.0",
            id: body.id,
            result: { content: [], structuredContent: {}, isError: false },
          },
          200,
          { "content-length": "999999999" },
        ),
    });
    const client = new EntscheidsucheRemoteClient(
      baseConfig({ maxResponseBytes: 1000, maxRetries: 0 }),
    );
    await expect(client.callTool("search", { query: "*" })).rejects.toThrow(
      ProviderUnavailableError,
    );
    await client.close();
  });
});
