import { describe, expect, it, vi } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  LegislationProviderRegistry,
  ProviderRegistry,
  ToolRegistry,
  type LegalSourceProvider,
} from "@swiss-legal-mcp/core";
import { createLogger } from "@swiss-legal-mcp/shared";
import { ShabProvider } from "@swiss-legal-mcp/provider-shab";
import { createMcpServer } from "../src/mcpServer.js";
import { registerShabTools } from "../src/tools/shabTools.js";

const logger = createLogger({ level: "silent" });

async function buildServer() {
  const providers = new ProviderRegistry();
  const legislationProviders = new LegislationProviderRegistry();
  providers.register(
    {
      id: "shab",
      provider: new ShabProvider(),
      officialCharacter: "official",
      capabilities: [],
      languages: ["de"],
      jurisdictions: ["federal"],
      enabledInEnv: ["test"],
    },
    "test",
  );
  await providers.checkHealth("shab");

  const tools = new ToolRegistry(providers, legislationProviders);
  registerShabTools(tools);

  const server = createMcpServer({
    name: "swiss-legal-mcp-test",
    version: "0.0.0",
    tools,
    providers,
    legislationProviders,
    logger,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, providers };
}

function parseErrorPayload(result: CallToolResult): Record<string, unknown> {
  const text = result.content.find(
    (item): item is { type: "text"; text: string } => item.type === "text",
  )?.text;
  if (!text) throw new Error("resultado de error sin contenido de texto");
  return JSON.parse(text) as Record<string, unknown>;
}

describe("Herramientas SHAB (Fase 5): registradas y visibles, bloqueadas por politica en la invocacion", () => {
  it("tools/list expone search_shab_publications", async () => {
    const { client } = await buildServer();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("search_shab_publications");
  });

  it("tools/list expone get_shab_publication", async () => {
    const { client } = await buildServer();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("get_shab_publication");
  });

  it("tools/list expone exactamente las 2 herramientas SHAB en este servidor aislado", async () => {
    const { client } = await buildServer();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_shab_publication",
      "search_shab_publications",
    ]);
  });

  it("invocar search_shab_publications devuelve provider_unavailable_by_policy sin llamar a fetch", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.reject(new Error("fetch NUNCA debe llamarse para SHAB")));
    try {
      const { client } = await buildServer();
      const result = await client.callTool({ name: "search_shab_publications", arguments: {} });
      expect(result.isError).toBe(true);
      const payload = parseErrorPayload(result as CallToolResult);
      expect(payload.code).toBe("PROVIDER_UNAVAILABLE_BY_POLICY");
      expect(payload.provider).toBe("shab");
      expect(payload.retryable).toBe(false);
      const details = payload.details as Record<string, unknown>;
      expect(details.reason).toBe("robots_txt_disallow");
      expect(details.networkRequestPerformed).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("invocar get_shab_publication devuelve provider_unavailable_by_policy sin llamar a fetch", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.reject(new Error("fetch NUNCA debe llamarse para SHAB")));
    try {
      const { client } = await buildServer();
      const result = await client.callTool({
        name: "get_shab_publication",
        arguments: { publicationNumber: "HR02-1006716804" },
      });
      expect(result.isError).toBe(true);
      const payload = parseErrorPayload(result as CallToolResult);
      expect(payload.code).toBe("PROVIDER_UNAVAILABLE_BY_POLICY");
      expect(payload.provider).toBe("shab");
      expect(payload.retryable).toBe(false);
      const details = payload.details as Record<string, unknown>;
      expect(details.reason).toBe("robots_txt_disallow");
      expect(details.networkRequestPerformed).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("healthCheck de SHAB sigue unhealthy/unavailable_by_policy tras el registro (no se falsea como healthy)", async () => {
    const { providers } = await buildServer();
    const info = providers.info("shab");
    expect(info?.status).toBe("unhealthy");
    expect(info?.unavailableByPolicy?.reason).toBe("robots_txt_disallow");
  });

  it("el servidor arranca y responde normalmente pese a tener SHAB permanentemente bloqueado", async () => {
    const { client } = await buildServer();
    await expect(client.listTools()).resolves.toBeDefined();
  });

  it("un proveedor unhealthy SIN bloqueo por politica sigue sin exponerse en tools/list (sin regresion en el filtrado general de caidas transitorias)", async () => {
    const providers = new ProviderRegistry();
    const legislationProviders = new LegislationProviderRegistry();
    const brokenProvider: LegalSourceProvider = {
      id: "fixture-broken",
      search: async () => [],
      getDocument: async () => {
        throw new Error("no deberia llamarse");
      },
      getMetadata: async () => ({}),
      healthCheck: async () => ({ healthy: false, checkedAt: new Date().toISOString() }),
      normalize: (raw: unknown) => raw as never,
      getSourceAttribution: () => {
        throw new Error("no deberia llamarse");
      },
    };
    providers.register(
      {
        id: "fixture-broken",
        provider: brokenProvider,
        officialCharacter: "official",
        capabilities: [],
        languages: ["de"],
        jurisdictions: ["federal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth("fixture-broken");
    const tools = new ToolRegistry(providers, legislationProviders);
    tools.register({
      name: "fixture_broken_tool",
      description: "herramienta de prueba con proveedor transitoriamente caido",
      inputSchema: {},
      requiredProviderIds: ["fixture-broken"],
      handler: async () => ({}),
    });
    const server = createMcpServer({
      name: "swiss-legal-mcp-test-transient",
      version: "0.0.0",
      tools,
      providers,
      legislationProviders,
      logger,
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client-transient", version: "0.0.0" });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    await expect(client.listTools()).rejects.toThrow("Method not found");
  });
});
