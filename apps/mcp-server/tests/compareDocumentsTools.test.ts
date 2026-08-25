import { describe, expect, it, vi } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  LegislationProviderRegistry,
  ProviderRegistry,
  ToolRegistry,
  type LegislationProvider,
} from "@swiss-legal-mcp/core";
import { FEDLEX_CAPABILITIES } from "@swiss-legal-mcp/provider-fedlex";
import { createLogger } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { registerCompareDocumentsTools } from "../src/tools/compareDocumentsTools.js";

const logger = createLogger({ level: "silent" });

function fakeDoc(
  id: string,
  fullText: string | undefined,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    provider: "fedlex",
    documentType: "legislation_law" as const,
    jurisdiction: { level: "federal" as const },
    sourceOriginalId: id,
    date: {},
    language: "de" as const,
    title: `Documento ${id}`,
    fullText,
    provenance: {
      sourceUrl: `https://fedlex.example.test/${id}`,
      retrievedAt: "2026-07-28T00:00:00.000Z",
      contentHash: "a".repeat(64),
      officialCharacter: "official" as const,
    },
    rawMetadata: {},
    contentNature: fullText ? ("literal" as const) : ("summary" as const),
    ...overrides,
  };
}

function fakeFedlexProvider(overrides: Partial<LegislationProvider> = {}): LegislationProvider {
  return {
    id: "fedlex",
    capabilities: FEDLEX_CAPABILITIES,
    searchLegislation: vi.fn(),
    getLaw: vi.fn(async () => fakeDoc("220", "Parrafo uno.\n\nParrafo dos.\n\nParrafo tres.")),
    getArticle: vi.fn(),
    getArticleAtDate: vi.fn(),
    compareArticleVersions: vi.fn(),
    getAmendmentHistory: vi.fn(async () => []),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    ...overrides,
  };
}

async function buildServer(fedlex: LegislationProvider) {
  const providers = new ProviderRegistry();
  const legislationProviders = new LegislationProviderRegistry();
  legislationProviders.register(
    {
      id: "fedlex",
      provider: fedlex,
      officialCharacter: "official",
      jurisdictions: ["federal"],
      enabledInEnv: ["test"],
    },
    "test",
  );
  await legislationProviders.checkHealth("fedlex");

  const tools = new ToolRegistry(providers, legislationProviders);
  registerCompareDocumentsTools(tools);

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
  return client;
}

describe("compare_legal_documents (proveedores falsos, sin red)", () => {
  it("tools/list expone compare_legal_documents", async () => {
    const client = await buildServer(fakeFedlexProvider());
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("compare_legal_documents");
  });

  it("calcula un diff real de parrafos con contenido distinto", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi
        .fn()
        .mockResolvedValueOnce(fakeDoc("220-v1", "Parrafo uno.\n\nParrafo dos.\n\nParrafo tres."))
        .mockResolvedValueOnce(
          fakeDoc("220-v2", "Parrafo uno.\n\nParrafo modificado.\n\nParrafo tres."),
        ),
    });
    const client = await buildServer(fedlex);
    const result = await client.callTool({
      name: "compare_legal_documents",
      arguments: {
        documentA: { provider: "fedlex", documentId: "https://fedlex.example.test/220-v1" },
        documentB: { provider: "fedlex", documentId: "https://fedlex.example.test/220-v2" },
      },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      status: string;
      comparisonNature: string;
      summary: { added: number; removed: number; unchanged: number };
      changes: Array<{ kind: string; text: string }>;
    };
    expect(structured.status).toBe("compared");
    expect(structured.comparisonNature).toBe("paragraph_diff");
    expect(structured.summary.unchanged).toBe(2);
    expect(structured.summary.added).toBe(1);
    expect(structured.summary.removed).toBe(1);
    expect(structured.changes.some((c) => c.kind === "removed" && c.text === "Parrafo dos.")).toBe(
      true,
    );
    expect(
      structured.changes.some((c) => c.kind === "added" && c.text === "Parrafo modificado."),
    ).toBe(true);
  });

  it("documentos identicos: todo 'unchanged', sin added ni removed", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async () => fakeDoc("220", "Parrafo uno.\n\nParrafo dos.")),
    });
    const client = await buildServer(fedlex);
    const result = await client.callTool({
      name: "compare_legal_documents",
      arguments: {
        documentA: { provider: "fedlex", documentId: "https://fedlex.example.test/220" },
        documentB: { provider: "fedlex", documentId: "https://fedlex.example.test/220" },
      },
    });
    const structured = result.structuredContent as {
      summary: { added: number; removed: number; unchanged: number };
    };
    expect(structured.summary).toEqual({ added: 0, removed: 0, unchanged: 2 });
  });

  it("devuelve insufficient_source_text cuando un documento no tiene texto completo real", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi
        .fn()
        .mockResolvedValueOnce(fakeDoc("220-a", "Parrafo real."))
        .mockResolvedValueOnce(fakeDoc("220-b", undefined)),
    });
    const client = await buildServer(fedlex);
    const result = await client.callTool({
      name: "compare_legal_documents",
      arguments: {
        documentA: { provider: "fedlex", documentId: "https://fedlex.example.test/220-a" },
        documentB: { provider: "fedlex", documentId: "https://fedlex.example.test/220-b" },
      },
    });
    const structured = result.structuredContent as { status: string; warnings: string[] };
    expect(structured.status).toBe("insufficient_source_text");
    expect(structured.warnings.join(" ")).toContain("documentB");
  });

  it("devuelve unsupported cuando un documento no se puede resolver (proveedor no disponible)", async () => {
    const client = await buildServer(fakeFedlexProvider());
    const result = await client.callTool({
      name: "compare_legal_documents",
      arguments: {
        documentA: { provider: "fedlex", documentId: "https://fedlex.example.test/220" },
        documentB: { provider: "seco", documentId: "seco:1" },
      },
    });
    const structured = result.structuredContent as { status: string; warnings: string[] };
    expect(structured.status).toBe("unsupported");
    expect(structured.warnings.join(" ")).toContain("documentB");
  });
});
