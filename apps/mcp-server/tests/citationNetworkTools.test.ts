import { describe, expect, it, vi } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  LegislationProviderRegistry,
  ProviderRegistry,
  ToolRegistry,
  type LegalSourceProvider,
  type LegislationProvider,
} from "@swiss-legal-mcp/core";
import { FEDLEX_CAPABILITIES } from "@swiss-legal-mcp/provider-fedlex";
import { createLogger } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { registerCitationNetworkTools } from "../src/tools/citationNetworkTools.js";

const logger = createLogger({ level: "silent" });

function fakeFedlexDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    provider: "fedlex",
    documentType: "legislation_law" as const,
    jurisdiction: { level: "federal" as const },
    sourceOriginalId: id,
    date: {},
    language: "de" as const,
    title: `Documento ${id}`,
    fullText: "Texto real sin citas reconocibles.",
    provenance: {
      sourceUrl: `https://fedlex.example.test/${id}`,
      retrievedAt: "2026-07-28T00:00:00.000Z",
      contentHash: "a".repeat(64),
      officialCharacter: "official" as const,
    },
    rawMetadata: {},
    contentNature: "literal" as const,
    ...overrides,
  };
}

interface FakeEntscheidsuche extends LegalSourceProvider {
  searchByCaseNumber: ReturnType<typeof vi.fn>;
}

function fakeEntscheidsucheProvider(matchDoc?: unknown): FakeEntscheidsuche {
  return {
    id: "entscheidsuche",
    search: vi.fn(async () => []),
    getDocument: vi.fn(),
    getMetadata: vi.fn(async () => ({})),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    normalize: vi.fn(),
    getSourceAttribution: vi.fn(),
    searchByCaseNumber: vi.fn(async () => ({
      results: matchDoc ? [matchDoc] : [],
      pagination: { page: 1, pageSize: 20, total: matchDoc ? 1 : 0, hasNextPage: false },
      filtersApplied: {},
    })),
  };
}

function fakeFedlexProvider(overrides: Partial<LegislationProvider> = {}): LegislationProvider {
  return {
    id: "fedlex",
    capabilities: FEDLEX_CAPABILITIES,
    searchLegislation: vi.fn(async () => ({
      items: [
        {
          id: "220",
          eli: "https://fedlex.data.admin.ch/eli/cc/220",
          title: "Code des obligations",
          systematicNumber: "220",
          language: "de" as const,
          inForceStatus: "in_force",
        },
      ],
      pagination: { page: 1, pageSize: 20 },
      appliedFilters: {},
      officialAttribution: {
        sourceUrl: "https://www.fedlex.admin.ch/",
        officialCharacter: "official" as const,
      },
      capabilities: FEDLEX_CAPABILITIES,
      warnings: [],
    })),
    getLaw: vi.fn(async () => fakeFedlexDoc("fedlex:220")),
    getArticle: vi.fn(),
    getArticleAtDate: vi.fn(),
    compareArticleVersions: vi.fn(),
    getAmendmentHistory: vi.fn(async () => []),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    ...overrides,
  };
}

async function buildServer(options: {
  fedlex?: LegislationProvider;
  entscheidsuche?: FakeEntscheidsuche;
}) {
  const providers = new ProviderRegistry();
  const legislationProviders = new LegislationProviderRegistry();

  if (options.fedlex) {
    legislationProviders.register(
      {
        id: "fedlex",
        provider: options.fedlex,
        officialCharacter: "official",
        jurisdictions: ["federal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await legislationProviders.checkHealth("fedlex");
  }
  if (options.entscheidsuche) {
    providers.register(
      {
        id: "entscheidsuche",
        provider: options.entscheidsuche,
        officialCharacter: "unofficial_aggregator",
        aggregatorName: "entscheidsuche.ch",
        capabilities: ["search", "getDocument"],
        languages: ["de", "fr", "it"],
        jurisdictions: ["federal", "cantonal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth("entscheidsuche");
  }

  const tools = new ToolRegistry(providers, legislationProviders);
  registerCitationNetworkTools(tools);

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

describe("find_cited_sources (proveedores falsos, sin red)", () => {
  it("tools/list expone find_cited_sources y build_case_citation_network", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("find_cited_sources");
    expect(names).toContain("build_case_citation_network");
  });

  it("detecta y resuelve una cita real de texto (origin='text_extraction')", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async () =>
        fakeFedlexDoc("fedlex:101", { fullText: "Referencia real a RS 220 en este texto." }),
      ),
    });
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "find_cited_sources",
      arguments: { provider: "fedlex", documentId: "https://fedlex.example.test/101" },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      status: string;
      citations: Array<{ raw: string; origin: string; match: string }>;
    };
    expect(structured.status).toBe("extracted");
    expect(structured.citations).toHaveLength(1);
    expect(structured.citations[0]?.origin).toBe("text_extraction");
    expect(structured.citations[0]?.match).toBe("exact");
  });

  it("incluye citas de metadatos reales con origin='explicit_metadata' cuando el proveedor las trae pobladas", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async () =>
        fakeFedlexDoc("fedlex:102", {
          fullText: "Texto sin citas reconocibles por regex.",
          articlesCited: ["OR Art. 41"],
        }),
      ),
    });
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "find_cited_sources",
      arguments: { provider: "fedlex", documentId: "https://fedlex.example.test/102" },
    });
    const structured = result.structuredContent as {
      citations: Array<{ raw: string; origin: string }>;
    };
    expect(
      structured.citations.some((c) => c.origin === "explicit_metadata" && c.raw === "OR Art. 41"),
    ).toBe(true);
  });

  it("devuelve insufficient_source_text cuando el documento no tiene texto completo real", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async () =>
        fakeFedlexDoc("fedlex:103", { fullText: undefined, contentNature: "summary" }),
      ),
    });
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "find_cited_sources",
      arguments: { provider: "fedlex", documentId: "https://fedlex.example.test/103" },
    });
    const structured = result.structuredContent as { status: string };
    expect(structured.status).toBe("insufficient_source_text");
  });

  it("devuelve unsupported cuando el documento no se puede resolver", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const result = await client.callTool({
      name: "find_cited_sources",
      arguments: { provider: "seco", documentId: "seco:999" },
    });
    const structured = result.structuredContent as { status: string };
    expect(structured.status).toBe("unsupported");
  });

  it("nunca afirma aplicacion/seguimiento juridico: solo expone match/origin, nunca un campo de veredicto", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async () =>
        fakeFedlexDoc("fedlex:104", { fullText: "Cita real ATF 142 III 1 en el texto." }),
      ),
    });
    const entscheidsuche = fakeEntscheidsucheProvider({
      id: "entscheidsuche:1",
      provider: "entscheidsuche",
      documentType: "case" as const,
      jurisdiction: { level: "federal" as const },
      sourceOriginalId: "1",
      date: {},
      title: "ATF 142 III 1",
      provenance: {
        sourceUrl: "https://entscheidsuche.ch/1",
        retrievedAt: "2026-07-28T00:00:00.000Z",
        contentHash: "b".repeat(64),
        officialCharacter: "unofficial_aggregator" as const,
        aggregatorName: "entscheidsuche.ch",
      },
      rawMetadata: {},
      contentNature: "summary" as const,
    });
    const client = await buildServer({ fedlex, entscheidsuche });
    const result = await client.callTool({
      name: "find_cited_sources",
      arguments: { provider: "fedlex", documentId: "https://fedlex.example.test/104" },
    });
    const structured = result.structuredContent as {
      citations: Array<Record<string, unknown>>;
    };
    const keys = Object.keys(structured.citations[0] ?? {});
    expect(keys).not.toContain("applied");
    expect(keys).not.toContain("followed");
    expect(keys).not.toContain("verdict");
    expect(keys).toContain("match");
    expect(keys).toContain("origin");
  });
});

describe("build_case_citation_network (proveedores falsos, sin red)", () => {
  it("construye una red de un solo salto a partir de dos documentos semilla reales", async () => {
    // getLaw se llama tanto para recuperar cada semilla como, por separado,
    // para resolver la cita 'RS 220' detectada dentro de cada una -- el mock
    // debe responder segun el 'eli' pedido, no segun el orden de llamada.
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async (ref: { eli?: string }) => {
        if (ref.eli === "https://fedlex.example.test/a") {
          return fakeFedlexDoc("fedlex:a", { fullText: "Cita real RS 220 aqui." });
        }
        if (ref.eli === "https://fedlex.example.test/b") {
          return fakeFedlexDoc("fedlex:b", { fullText: "Otra cita real RS 220 tambien." });
        }
        return fakeFedlexDoc("fedlex:220");
      }),
    });
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "build_case_citation_network",
      arguments: {
        documents: [
          { provider: "fedlex", documentId: "https://fedlex.example.test/a" },
          { provider: "fedlex", documentId: "https://fedlex.example.test/b" },
        ],
      },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      status: string;
      nodes: Array<{ id: string; kind: string }>;
      edges: Array<{ from: string; to: string; origin: string }>;
    };
    expect(structured.status).toBe("built");
    expect(structured.nodes.filter((n) => n.kind === "seed")).toHaveLength(2);
    expect(structured.edges.length).toBeGreaterThan(0);
    expect(structured.edges.every((e) => e.origin === "text_extraction")).toBe(true);
  });

  it("devuelve insufficient_source_text cuando ningun documento semilla tiene texto completo real", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async () =>
        fakeFedlexDoc("fedlex:x", { fullText: undefined, contentNature: "summary" }),
      ),
    });
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "build_case_citation_network",
      arguments: {
        documents: [{ provider: "fedlex", documentId: "https://fedlex.example.test/x" }],
      },
    });
    const structured = result.structuredContent as { status: string };
    expect(structured.status).toBe("insufficient_source_text");
  });

  it("registra un documento semilla no resoluble en unresolvedSeeds sin bloquear el resto", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async () =>
        fakeFedlexDoc("fedlex:ok", { fullText: "Sin citas reconocibles." }),
      ),
    });
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "build_case_citation_network",
      arguments: {
        documents: [
          { provider: "fedlex", documentId: "https://fedlex.example.test/ok" },
          { provider: "seco", documentId: "seco:999" },
        ],
      },
    });
    const structured = result.structuredContent as {
      unresolvedSeeds: Array<{ documentId: string }>;
    };
    expect(structured.unresolvedSeeds.some((s) => s.documentId === "seco:999")).toBe(true);
  });
});
