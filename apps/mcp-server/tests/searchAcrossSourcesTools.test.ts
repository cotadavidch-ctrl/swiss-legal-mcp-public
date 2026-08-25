import { describe, expect, it, vi } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  LegislationProviderRegistry,
  ProviderRegistry,
  ToolRegistry,
  type LegalSourceProvider,
  type LegislationProvider,
  type OfficialCharacter,
} from "@swiss-legal-mcp/core";
import { FEDLEX_CAPABILITIES } from "@swiss-legal-mcp/provider-fedlex";
import { createLogger } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { registerSearchAcrossSourcesTools } from "../src/tools/searchAcrossSourcesTools.js";

const logger = createLogger({ level: "silent" });

function fakeLegalSourceProvider(
  id: string,
  searchResults: Array<{ id: string; title: string; snippet?: string }>,
): LegalSourceProvider {
  return {
    id,
    search: vi.fn(async () => searchResults),
    getDocument: vi.fn(),
    getMetadata: vi.fn(async () => ({})),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    normalize: vi.fn(),
    getSourceAttribution: vi.fn(),
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
    getLaw: vi.fn(),
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
  entscheidsuche?: LegalSourceProvider;
  seco?: LegalSourceProvider;
  cantonalSz?: LegalSourceProvider & { searchDocuments: ReturnType<typeof vi.fn> };
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

  const registerLegalSource = async (
    id: string,
    provider: LegalSourceProvider,
    officialCharacter: OfficialCharacter,
    jurisdictions: string[],
  ) => {
    providers.register(
      {
        id,
        provider,
        officialCharacter,
        capabilities: ["search"],
        languages: ["de", "fr", "it"],
        jurisdictions,
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth(id);
  };

  if (options.entscheidsuche) {
    await registerLegalSource("entscheidsuche", options.entscheidsuche, "unofficial_aggregator", [
      "federal",
      "cantonal",
    ]);
  }
  if (options.seco) {
    await registerLegalSource("seco", options.seco, "official", ["federal"]);
  }
  if (options.cantonalSz) {
    await registerLegalSource("cantonal-sz", options.cantonalSz, "official", ["cantonal"]);
  }

  const tools = new ToolRegistry(providers, legislationProviders);
  registerSearchAcrossSourcesTools(tools);

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

describe("search_across_sources (proveedores falsos, sin red)", () => {
  it("tools/list expone search_across_sources", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("search_across_sources");
  });

  it("una consulta de texto libre real consulta entscheidsuche/seco pero omite Fedlex (sin busqueda de texto libre real)", async () => {
    const entscheidsuche = fakeLegalSourceProvider("entscheidsuche", [
      { id: "e:1", title: "Sentencia sobre responsabilidad civil" },
    ]);
    const seco = fakeLegalSourceProvider("seco", [{ id: "seco:1", title: "Weisung AVIG" }]);
    const fedlex = fakeFedlexProvider();
    const client = await buildServer({ fedlex, entscheidsuche, seco });
    const result = await client.callTool({
      name: "search_across_sources",
      arguments: { query: "responsabilidad civil" },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      results: Array<{ providerId: string }>;
      providersConsulted: Array<{ providerId: string; queried: boolean; warning?: string }>;
    };
    expect(structured.results.some((r) => r.providerId === "entscheidsuche")).toBe(true);
    expect(structured.results.some((r) => r.providerId === "seco")).toBe(true);
    expect(fedlex.searchLegislation).not.toHaveBeenCalled();
    const fedlexConsultation = structured.providersConsulted.find((c) => c.providerId === "fedlex");
    expect(fedlexConsultation?.queried).toBe(false);
    expect(fedlexConsultation?.warning).toContain("fullTextSearch");
  });

  it("una consulta con forma de numero RS real consulta Fedlex via systematicNumber", async () => {
    const fedlex = fakeFedlexProvider();
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "search_across_sources",
      arguments: { query: "RS 220", sources: ["fedlex"] },
    });
    const structured = result.structuredContent as { results: Array<{ providerId: string }> };
    expect(structured.results.some((r) => r.providerId === "fedlex")).toBe(true);
    expect(fedlex.searchLegislation).toHaveBeenCalledWith({
      systematicNumber: "220",
      language: "de",
    });
  });

  it("deduplica resultados con el mismo titulo real de fuentes distintas", async () => {
    const entscheidsuche = fakeLegalSourceProvider("entscheidsuche", [
      { id: "e:1", title: "Weisung AVIG KAE" },
    ]);
    const seco = fakeLegalSourceProvider("seco", [{ id: "seco:1", title: "Weisung AVIG KAE" }]);
    const client = await buildServer({ fedlex: fakeFedlexProvider(), entscheidsuche, seco });
    const result = await client.callTool({
      name: "search_across_sources",
      arguments: { query: "Weisung AVIG", sources: ["entscheidsuche", "seco"] },
    });
    const structured = result.structuredContent as {
      results: unknown[];
      duplicatesRemoved: number;
    };
    expect(structured.results).toHaveLength(1);
    expect(structured.duplicatesRemoved).toBe(1);
  });

  it("ordena de forma deterministica: fuentes oficiales antes que agregadores no oficiales", async () => {
    const entscheidsuche = fakeLegalSourceProvider("entscheidsuche", [
      { id: "e:1", title: "Zeta agregada" },
    ]);
    const seco = fakeLegalSourceProvider("seco", [{ id: "seco:1", title: "Alfa oficial" }]);
    const client = await buildServer({ fedlex: fakeFedlexProvider(), entscheidsuche, seco });
    const result = await client.callTool({
      name: "search_across_sources",
      arguments: { query: "a", sources: ["entscheidsuche", "seco"] },
    });
    const structured = result.structuredContent as { results: Array<{ providerId: string }> };
    expect(structured.results[0]?.providerId).toBe("seco");
    expect(structured.results[1]?.providerId).toBe("entscheidsuche");
  });

  it("omite la fuente 'cantonal' con advertencia explicita cuando no se indica 'canton'", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const result = await client.callTool({
      name: "search_across_sources",
      arguments: { query: "gesetz", sources: ["cantonal"] },
    });
    const structured = result.structuredContent as {
      results: unknown[];
      providersConsulted: Array<{ providerId: string; queried: boolean; warning?: string }>;
    };
    expect(structured.results).toHaveLength(0);
    expect(structured.providersConsulted[0]?.warning).toContain("sin indicar 'canton'");
  });

  it("consulta el proveedor cantonal correcto cuando se indica 'canton'", async () => {
    const cantonalSz = {
      ...fakeLegalSourceProvider("cantonal-sz", []),
      searchDocuments: vi.fn(async () => ({
        results: [{ id: "cantonal-sz:100.100", title: "Verfassung des Kantons Schwyz" }],
        pagination: { page: 1, pageSize: 20, total: 1 },
        sourceAttribution: {
          sourceUrl: "https://www.sz.ch/",
          retrievedAt: "2026-07-28T00:00:00.000Z",
          officialCharacter: "official" as const,
        },
        coverageWarnings: [],
      })),
    };
    const client = await buildServer({ fedlex: fakeFedlexProvider(), cantonalSz });
    const result = await client.callTool({
      name: "search_across_sources",
      arguments: { query: "Verfassung", sources: ["cantonal"], canton: "SZ" },
    });
    const structured = result.structuredContent as { results: Array<{ providerId: string }> };
    expect(structured.results.some((r) => r.providerId === "cantonal-sz")).toBe(true);
    expect(cantonalSz.searchDocuments).toHaveBeenCalledWith({ query: "Verfassung" });
  });
});
