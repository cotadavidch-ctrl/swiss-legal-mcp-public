import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ProviderRegistry, ToolRegistry } from "@swiss-legal-mcp/core";
import { createLogger } from "@swiss-legal-mcp/shared";
import {
  EntscheidsucheMcpProvider,
  loadEntscheidsucheConfig,
  type RemoteSearchHit,
} from "@swiss-legal-mcp/provider-entscheidsuche";
import type { EntscheidsucheRemoteClient } from "@swiss-legal-mcp/provider-entscheidsuche";
import { createMcpServer } from "../src/mcpServer.js";
import { registerEntscheidsucheTools } from "../src/tools/entscheidsucheTools.js";

const logger = createLogger({ level: "silent" });

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../tests/fixtures/entscheidsuche",
);

function loadFetchDocumentHit(name: string): RemoteSearchHit {
  const raw = JSON.parse(readFileSync(path.join(fixturesDir, `${name}.json`), "utf8")) as {
    parsed: { result: { structuredContent: { result: RemoteSearchHit } } };
  };
  return raw.parsed.result.structuredContent.result;
}

function loadSearchStructuredContent(name: string): unknown {
  const raw = JSON.parse(readFileSync(path.join(fixturesDir, `${name}.json`), "utf8")) as {
    parsed: { result: { content: [{ text: string }] } };
  };
  return JSON.parse(raw.parsed.result.content[0].text) as unknown;
}

function toolResult(structuredContent: unknown, isError = false): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
    structuredContent: isError ? undefined : (structuredContent as Record<string, unknown>),
    isError,
  };
}

function makeFakeRemoteClient(
  handler: (
    name: string,
    args: Record<string, unknown>,
  ) => CallToolResult | Promise<CallToolResult>,
) {
  return {
    callTool: vi.fn(handler),
    close: vi.fn(async () => {}),
  };
}

async function buildServerWithProvider(provider: EntscheidsucheMcpProvider | undefined) {
  const providers = new ProviderRegistry();
  if (provider) {
    providers.register(
      {
        id: "entscheidsuche",
        provider,
        officialCharacter: "unofficial_aggregator",
        aggregatorName: "entscheidsuche.ch",
        capabilities: ["search", "getDocument", "getMetadata"],
        languages: ["de", "fr", "it"],
        jurisdictions: ["federal", "cantonal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth("entscheidsuche");
  }

  const tools = new ToolRegistry(providers);
  registerEntscheidsucheTools(tools);

  const server = createMcpServer({
    name: "swiss-legal-mcp-test",
    version: "0.0.0",
    tools,
    providers,
    logger,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe("Herramientas de entscheidsuche en apps/mcp-server (proveedor falso, sin red)", () => {
  it("tools/list expone exactamente las 4 herramientas activadas cuando el proveedor esta sano", async () => {
    const fake = makeFakeRemoteClient(() => toolResult({ name: "entscheidsuche-mcp" }));
    const provider = new EntscheidsucheMcpProvider(
      loadEntscheidsucheConfig({}),
      fake as unknown as EntscheidsucheRemoteClient,
    );
    const client = await buildServerWithProvider(provider);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "get_case",
      "get_case_metadata",
      "search_cases",
      "search_cases_by_reference",
    ]);
  });

  it("no expone ninguna herramienta si el proveedor no esta registrado", async () => {
    // Con cero herramientas registradas, el McpServer no declara capacidad
    // "tools" en absoluto (mismo comportamiento verificado en Fase 1,
    // apps/mcp-server/tests/mcpServer.test.ts): listTools() lanza un error
    // de protocolo "Method not found" en vez de devolver un array vacio.
    const client = await buildServerWithProvider(undefined);
    await expect(client.listTools()).rejects.toThrow("Method not found");
  });

  it("proveedor caido: si el healthCheck falla, las 4 herramientas quedan desactivadas", async () => {
    const fake = makeFakeRemoteClient(() => {
      throw new Error("ECONNREFUSED simulado");
    });
    const provider = new EntscheidsucheMcpProvider(
      loadEntscheidsucheConfig({}),
      fake as unknown as EntscheidsucheRemoteClient,
    );
    const client = await buildServerWithProvider(provider);
    await expect(client.listTools()).rejects.toThrow("Method not found");
  });

  it("tools/call search_cases devuelve resultados, paginacion y advertencia no oficial", async () => {
    const fake = makeFakeRemoteClient((name) => {
      if (name === "server_info") return toolResult({ name: "entscheidsuche-mcp" });
      expect(name).toBe("search");
      return toolResult(loadSearchStructuredContent("search_de_mietrecht"));
    });
    const provider = new EntscheidsucheMcpProvider(
      loadEntscheidsucheConfig({}),
      fake as unknown as EntscheidsucheRemoteClient,
    );
    const client = await buildServerWithProvider(provider);

    const result = await client.callTool({
      name: "search_cases",
      arguments: { query: "Mietrecht", language: "de" },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      results: Array<{ legalCalibration?: { source_quality: string; recommended_use: string } }>;
      warning: { aggregatorName: string };
      legalCalibration: {
        source_quality: string;
        citation_quality: string;
        official_verification_required: boolean;
        ranking_policy: string[];
      };
    };
    expect(structured.results.length).toBeGreaterThan(0);
    expect(structured.warning.aggregatorName).toBe("entscheidsuche.ch");
    expect(structured.legalCalibration.source_quality).toBe("NON_OFFICIAL_FULL_TEXT");
    expect(structured.legalCalibration.citation_quality).toBe("UNABLE_TO_VERIFY");
    expect(structured.legalCalibration.official_verification_required).toBe(true);
    expect(structured.legalCalibration.ranking_policy).toContain("material_legal_match");
    expect(structured.results[0]?.legalCalibration?.source_quality).toBe("NON_OFFICIAL_FULL_TEXT");
    expect(structured.results[0]?.legalCalibration?.recommended_use).toBe("discovery_only");
  });

  it("tools/call get_case devuelve el documento con texto completo", async () => {
    const hit = loadFetchDocumentHit("fetch_document_bge_142_III_1");
    const fake = makeFakeRemoteClient((name) => {
      if (name === "server_info") return toolResult({ name: "entscheidsuche-mcp" });
      expect(name).toBe("fetch_document");
      return toolResult({ result: hit });
    });
    const provider = new EntscheidsucheMcpProvider(
      loadEntscheidsucheConfig({}),
      fake as unknown as EntscheidsucheRemoteClient,
    );
    const client = await buildServerWithProvider(provider);

    const result = await client.callTool({ name: "get_case", arguments: { id: hit.id } });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { fullText?: string; bgeAtfDtf?: string };
    expect(structured.fullText).toBeDefined();
    expect(structured.bgeAtfDtf).toBe("BGE 142 III 1");
  });

  it("tools/call get_case_metadata no incluye fullText", async () => {
    const hit = loadFetchDocumentHit("fetch_document_vd_fr_cantonal");
    const fake = makeFakeRemoteClient(() => toolResult({ result: hit }));
    const provider = new EntscheidsucheMcpProvider(
      loadEntscheidsucheConfig({}),
      fake as unknown as EntscheidsucheRemoteClient,
    );
    const client = await buildServerWithProvider(provider);

    const result = await client.callTool({ name: "get_case_metadata", arguments: { id: hit.id } });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { fullText?: string };
    expect(structured.fullText).toBeUndefined();
  });

  it("tools/call search_cases_by_reference advierte de ambiguedad cuando hay mas de un resultado", async () => {
    const fake = makeFakeRemoteClient((name) => {
      if (name === "server_info") return toolResult({ name: "entscheidsuche-mcp" });
      expect(name).toBe("search_by_case_number");
      return toolResult(loadSearchStructuredContent("search_by_case_number_bge"));
    });
    const provider = new EntscheidsucheMcpProvider(
      loadEntscheidsucheConfig({}),
      fake as unknown as EntscheidsucheRemoteClient,
    );
    const client = await buildServerWithProvider(provider);

    const result = await client.callTool({
      name: "search_cases_by_reference",
      arguments: { reference: "BGE 142 III 1" },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      ambiguityNotice?: string;
      legalCalibration: { official_verification_required: boolean };
    };
    expect(structured.ambiguityNotice).toBeDefined();
    expect(structured.legalCalibration.official_verification_required).toBe(true);
  });

  it("cierre ordenado: provider.close() delega en el cliente remoto falso", async () => {
    const fake = makeFakeRemoteClient(() => toolResult({}));
    const provider = new EntscheidsucheMcpProvider(
      loadEntscheidsucheConfig({}),
      fake as unknown as EntscheidsucheRemoteClient,
    );
    await provider.close();
    expect(fake.close).toHaveBeenCalledTimes(1);
  });
});
