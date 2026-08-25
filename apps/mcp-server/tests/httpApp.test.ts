import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { ProviderRegistry, ToolRegistry } from "@swiss-legal-mcp/core";
import {
  createLogger,
  InvalidEnvironmentError,
  loadEnv,
  loadHttpEnv,
} from "@swiss-legal-mcp/shared";
import { createHttpApp, type HttpApp } from "../src/httpApp.js";
import { buildRegistries } from "../src/registry.js";

const logger = createLogger({ level: "silent" });

async function initializedAgent(app: HttpApp["app"]) {
  const agent = request(app);
  await agent
    .post("/mcp")
    .set("Accept", "application/json, text/event-stream")
    .send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.0" },
      },
    });
  await agent
    .post("/mcp")
    .set("Accept", "application/json, text/event-stream")
    .send({ jsonrpc: "2.0", method: "notifications/initialized" });
  return agent;
}

describe("HTTP app (NODE_ENV=test): health, ready, mcp", () => {
  let httpApp: HttpApp;

  beforeEach(async () => {
    const settings = loadEnv({ NODE_ENV: "test" });
    const { providers, tools } = buildRegistries(settings);
    await providers.checkAllHealth();
    httpApp = createHttpApp({ config: settings, logger, providers, tools });
  });

  afterEach(async () => {
    await httpApp.close();
  });

  it("GET /health responde 200 sin comprobar dependencias", async () => {
    const response = await request(httpApp.app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("GET /ready responde 200 cuando el unico proveedor registrado (fixture) esta sano", async () => {
    const response = await request(httpApp.app).get("/ready");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ready");
    expect(response.body.providers[0].id).toBe("fixture");
  });

  it("responde 404 en JSON para una ruta desconocida", async () => {
    const response = await request(httpApp.app).get("/no-existe");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("no exige bearer token en NODE_ENV=test", async () => {
    const response = await request(httpApp.app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test-client", version: "0.0.0" },
        },
      });
    expect(response.status).toBe(200);
  });

  it("flujo completo: initialize -> tools/list -> tools/call sobre fixture_search_cases", async () => {
    const agent = await initializedAgent(httpApp.app);

    const listResponse = await agent
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    expect(listResponse.status).toBe(200);
    const listBody = parseSseJson(listResponse.text);
    expect(listBody.result.tools.map((t: { name: string }) => t.name)).toContain(
      "fixture_search_cases",
    );

    const callResponse = await agent
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "fixture_search_cases", arguments: { query: "cantonal" } },
      });
    expect(callResponse.status).toBe(200);
    const callBody = parseSseJson(callResponse.text);
    expect(callBody.result.isError).toBeFalsy();
    expect(callBody.result.structuredContent.result[0].id).toBe("fixture:case-2");
  });

  it("tools/call con entrada invalida segun el inputSchema es rechazado antes de llegar a nuestro handler", async () => {
    // El SDK valida contra el inputSchema declarado antes de invocar nuestro
    // handler, por eso el rechazo llega como CallToolResult.isError con el
    // mensaje de validacion propio del SDK, no con nuestro codigo
    // VALIDATION_ERROR (esa ruta de ToolRegistry.call() ya se prueba
    // directamente en packages/core/src/toolRegistry.test.ts).
    const agent = await initializedAgent(httpApp.app);
    const response = await agent
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "fixture_search_cases", arguments: { query: "" } },
      });
    expect(response.status).toBe(200);
    const body = parseSseJson(response.text);
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("Invalid arguments");
  });
});

describe("HTTP app (NODE_ENV=production): autenticacion bearer obligatoria", () => {
  let httpApp: HttpApp;

  beforeEach(async () => {
    const settings = loadHttpEnv({
      NODE_ENV: "production",
      MCP_HTTP_BEARER_TOKEN: "a-real-secret-token",
    });
    const providers = new ProviderRegistry();
    const tools = new ToolRegistry(providers);
    httpApp = createHttpApp({ config: settings, logger, providers, tools });
  });

  afterEach(async () => {
    await httpApp.close();
  });

  it("la configuracion HTTP production falla sin bearer token", () => {
    expect(() => loadHttpEnv({ NODE_ENV: "production" })).toThrow(InvalidEnvironmentError);
  });

  it("rechaza POST /mcp sin Authorization con 401", async () => {
    const response = await request(httpApp.app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    expect(response.status).toBe(401);
  });

  it("rechaza POST /mcp con token incorrecto con 401", async () => {
    const response = await request(httpApp.app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", "Bearer token-equivocado")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    expect(response.status).toBe(401);
  });

  it("acepta POST /mcp con el token correcto", async () => {
    const response = await request(httpApp.app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", "Bearer a-real-secret-token")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test-client", version: "0.0.0" },
        },
      });
    expect(response.status).toBe(200);
  });

  it("GET /ready responde 200 sin proveedores registrados (nada que exigir todavia en produccion)", async () => {
    const response = await request(httpApp.app).get("/ready");
    expect(response.status).toBe(200);
    expect(response.body.providers).toEqual([]);
  });

  it("no exige Authorization para /health ni /ready", async () => {
    const health = await request(httpApp.app).get("/health");
    const ready = await request(httpApp.app).get("/ready");
    expect(health.status).toBe(200);
    expect(ready.status).toBe(200);
  });
});

describe("HTTP app: limite de tamano de peticion", () => {
  it("responde 413 cuando el cuerpo supera MCP_HTTP_MAX_REQUEST_BYTES", async () => {
    const settings = loadEnv({ NODE_ENV: "test", MCP_HTTP_MAX_REQUEST_BYTES: "10" });
    const providers = new ProviderRegistry();
    const tools = new ToolRegistry(providers);
    const httpApp = createHttpApp({ config: settings, logger, providers, tools });

    const response = await request(httpApp.app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });

    expect(response.status).toBe(413);
    await httpApp.close();
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSseJson(sseBody: string): { result?: any; error?: any } {
  const dataLine = sseBody.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) {
    throw new Error(`No se encontro linea 'data:' en la respuesta SSE: ${sseBody}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return JSON.parse(dataLine.slice("data:".length).trim()) as { result?: any; error?: any };
}
