import { describe, expect, it, vi } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  LegislationProviderRegistry,
  NotFoundError,
  ProviderRegistry,
  ToolRegistry,
  type LegalSourceProvider,
  type LegislationProvider,
} from "@swiss-legal-mcp/core";
import { FEDLEX_CAPABILITIES } from "@swiss-legal-mcp/provider-fedlex";
import { createLogger } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { registerExtractPassagesTools } from "../src/tools/extractPassagesTools.js";

const logger = createLogger({ level: "silent" });

function fakeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "fedlex:220",
    provider: "fedlex",
    documentType: "legislation_law" as const,
    jurisdiction: { level: "federal" as const },
    sourceOriginalId: "eli/cc/220",
    date: {},
    language: "de" as const,
    title: "Code des obligations",
    fullText:
      "Art. 1 Vertragsabschluss im Allgemeinen. Zum Abschlusse eines Vertrages ist die übereinstimmende Willensäusserung der Parteien erforderlich. Art. 41 Voraussetzungen der Haftung. Wer einem andern widerrechtlich Schaden zufügt, wird zum Ersatze verpflichtet.",
    provenance: {
      sourceUrl: "https://www.fedlex.admin.ch/eli/cc/220/de",
      retrievedAt: "2026-07-28T00:00:00.000Z",
      contentHash: "a".repeat(64),
      officialCharacter: "official" as const,
    },
    rawMetadata: {},
    contentNature: "literal" as const,
    ...overrides,
  };
}

function fakeFedlexProvider(overrides: Partial<LegislationProvider> = {}): LegislationProvider {
  return {
    id: "fedlex",
    capabilities: FEDLEX_CAPABILITIES,
    searchLegislation: vi.fn(),
    getLaw: vi.fn(async () => fakeDoc()),
    getArticle: vi.fn(async () => ({
      ...fakeDoc(),
      id: "fedlex:220#41",
      documentType: "legislation_article" as const,
      fullText:
        "Art. 41 Voraussetzungen der Haftung. Wer einem andern widerrechtlich Schaden zufügt...",
    })),
    getArticleAtDate: vi.fn(),
    compareArticleVersions: vi.fn(),
    getAmendmentHistory: vi.fn(async () => []),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    ...overrides,
  };
}

interface FakeLexWork extends LegalSourceProvider {
  getArticle: ReturnType<typeof vi.fn>;
}

async function buildServer(options: {
  fedlex?: LegislationProvider;
  entscheidsuche?: LegalSourceProvider;
  cantonalBe?: FakeLexWork;
  cantonalZh?: LegalSourceProvider;
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
  if (options.cantonalBe) {
    providers.register(
      {
        id: "cantonal-be",
        provider: options.cantonalBe,
        officialCharacter: "official",
        capabilities: ["search", "getDocument", "getArticle"],
        languages: ["de"],
        jurisdictions: ["cantonal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth("cantonal-be");
  }
  if (options.cantonalZh) {
    providers.register(
      {
        id: "cantonal-zh",
        provider: options.cantonalZh,
        officialCharacter: "official",
        capabilities: ["search", "getDocument"],
        languages: ["de"],
        jurisdictions: ["cantonal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth("cantonal-zh");
  }

  const tools = new ToolRegistry(providers, legislationProviders);
  registerExtractPassagesTools(tools);

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

describe("extract_legal_passages (proveedores falsos, sin red)", () => {
  it("tools/list expone extract_legal_passages", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("extract_legal_passages");
  });

  it("extraccion estructurada real via Fedlex.getArticle (confianza 'exact')", async () => {
    const fedlex = fakeFedlexProvider();
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "extract_legal_passages",
      arguments: {
        provider: "fedlex",
        documentId: "https://fedlex.data.admin.ch/eli/cc/220",
        articleNumber: "41",
      },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      status: string;
      extractionMethod: string;
      confidence: string;
      passage: string;
    };
    expect(structured.status).toBe("extracted");
    expect(structured.extractionMethod).toBe("structured_article");
    expect(structured.confidence).toBe("exact");
    expect(structured.passage).toContain("Art. 41");
  });

  it("propaga NotFoundError real de Fedlex.getArticle para un articulo inexistente (nunca lo aproxima)", async () => {
    const fedlex = fakeFedlexProvider({
      getArticle: vi.fn(async () => {
        throw new NotFoundError(
          "fedlex:220#999",
          "No existe el articulo 999 en la version vigente.",
        );
      }),
    });
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "extract_legal_passages",
      arguments: {
        provider: "fedlex",
        documentId: "https://fedlex.data.admin.ch/eli/cc/220",
        articleNumber: "999",
      },
    });
    const structured = result.structuredContent as { status: string; warnings: string[] };
    expect(structured.status).toBe("not_found_in_text");
    expect(structured.warnings.join(" ")).toContain("No existe el articulo 999");
  });

  it("busqueda de texto heuristica encuentra un termino real (confianza 'probable')", async () => {
    const fedlex = fakeFedlexProvider();
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "extract_legal_passages",
      arguments: {
        provider: "fedlex",
        documentId: "https://fedlex.data.admin.ch/eli/cc/220",
        searchTerm: "widerrechtlich Schaden",
      },
    });
    const structured = result.structuredContent as {
      status: string;
      extractionMethod: string;
      confidence: string;
      passage: string;
    };
    expect(structured.status).toBe("extracted");
    expect(structured.extractionMethod).toBe("text_search_heuristic");
    expect(structured.confidence).toBe("probable");
    expect(structured.passage).toContain("widerrechtlich Schaden");
  });

  it("devuelve not_found_in_text cuando el termino real no aparece en el documento", async () => {
    const fedlex = fakeFedlexProvider();
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "extract_legal_passages",
      arguments: {
        provider: "fedlex",
        documentId: "https://fedlex.data.admin.ch/eli/cc/220",
        searchTerm: "termino que no existe en el texto",
      },
    });
    const structured = result.structuredContent as { status: string };
    expect(structured.status).toBe("not_found_in_text");
  });

  it("devuelve insufficient_source_text cuando el documento no tiene texto completo real", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async () => ({
        ...fakeDoc(),
        fullText: undefined,
        contentNature: "summary" as const,
      })),
    });
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "extract_legal_passages",
      arguments: {
        provider: "fedlex",
        documentId: "https://fedlex.data.admin.ch/eli/cc/220",
        searchTerm: "cualquier cosa",
      },
    });
    const structured = result.structuredContent as { status: string };
    expect(structured.status).toBe("insufficient_source_text");
  });

  it("devuelve unsupported cuando no se indica ni articleNumber ni searchTerm", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const result = await client.callTool({
      name: "extract_legal_passages",
      arguments: { provider: "fedlex", documentId: "https://fedlex.data.admin.ch/eli/cc/220" },
    });
    const structured = result.structuredContent as { status: string };
    expect(structured.status).toBe("unsupported");
  });

  it("extraccion estructurada real via getArticle de un canton LexWork", async () => {
    const cantonalBe: FakeLexWork = {
      id: "cantonal-be",
      search: vi.fn(),
      getDocument: vi.fn(),
      getMetadata: vi.fn(async () => ({})),
      healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
      normalize: vi.fn(),
      getSourceAttribution: vi.fn(),
      getArticle: vi.fn(async () => ({
        ...fakeDoc(),
        id: "cantonal-be:324.111#1",
        provider: "cantonal-be",
        jurisdiction: { level: "cantonal", canton: "BE" },
        fullText: "Art. 1 texto real del articulo cantonal.",
      })),
    };
    const client = await buildServer({ fedlex: fakeFedlexProvider(), cantonalBe });
    const result = await client.callTool({
      name: "extract_legal_passages",
      arguments: {
        provider: "cantonal",
        canton: "BE",
        documentId: "cantonal-be:324.111",
        articleNumber: "1",
      },
    });
    const structured = result.structuredContent as { status: string; extractionMethod: string };
    expect(structured.status).toBe("extracted");
    expect(structured.extractionMethod).toBe("structured_article");
    expect(cantonalBe.getArticle).toHaveBeenCalledWith("324.111", "1");
  });

  it("devuelve unsupported para articleNumber en un canton sin estructura de articulo real (ZH)", async () => {
    const cantonalZh: LegalSourceProvider = {
      id: "cantonal-zh",
      search: vi.fn(),
      getDocument: vi.fn(),
      getMetadata: vi.fn(async () => ({})),
      healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
      normalize: vi.fn(),
      getSourceAttribution: vi.fn(),
    };
    const client = await buildServer({ fedlex: fakeFedlexProvider(), cantonalZh });
    const result = await client.callTool({
      name: "extract_legal_passages",
      arguments: {
        provider: "cantonal",
        canton: "ZH",
        documentId: "cantonal-zh:131.1",
        articleNumber: "1",
      },
    });
    const structured = result.structuredContent as { status: string; warnings: string[] };
    expect(structured.status).toBe("unsupported");
    expect(structured.warnings.join(" ")).toContain("no soporta extraccion estructurada");
  });

  it("devuelve unsupported para articleNumber sobre entscheidsuche.ch (sin estructura de articulo)", async () => {
    const entscheidsuche: LegalSourceProvider = {
      id: "entscheidsuche",
      search: vi.fn(),
      getDocument: vi.fn(),
      getMetadata: vi.fn(async () => ({})),
      healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
      normalize: vi.fn(),
      getSourceAttribution: vi.fn(),
    };
    const client = await buildServer({ fedlex: fakeFedlexProvider(), entscheidsuche });
    const result = await client.callTool({
      name: "extract_legal_passages",
      arguments: { provider: "entscheidsuche", documentId: "entscheidsuche:1", articleNumber: "1" },
    });
    const structured = result.structuredContent as { status: string };
    expect(structured.status).toBe("unsupported");
  });

  it("propaga NotFoundError como not_found_in_text", async () => {
    const entscheidsuche: LegalSourceProvider = {
      id: "entscheidsuche",
      search: vi.fn(),
      getDocument: vi.fn(async () => {
        throw new NotFoundError("entscheidsuche:999", "no existe");
      }),
      getMetadata: vi.fn(async () => ({})),
      healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
      normalize: vi.fn(),
      getSourceAttribution: vi.fn(),
    };
    const client = await buildServer({ fedlex: fakeFedlexProvider(), entscheidsuche });
    const result = await client.callTool({
      name: "extract_legal_passages",
      arguments: {
        provider: "entscheidsuche",
        documentId: "entscheidsuche:999",
        searchTerm: "algo",
      },
    });
    const structured = result.structuredContent as { status: string };
    expect(structured.status).toBe("not_found_in_text");
  });
});
