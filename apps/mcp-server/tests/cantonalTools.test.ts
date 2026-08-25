import { describe, expect, it, vi } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { LegislationProviderRegistry, ProviderRegistry, ToolRegistry } from "@swiss-legal-mcp/core";
import type { LegalSourceProvider } from "@swiss-legal-mcp/core";
import { createLogger } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { registerCantonalTools } from "../src/tools/cantonalTools.js";

const logger = createLogger({ level: "silent" });

function fakeDocument(provider: string, id: string) {
  return {
    id,
    provider,
    documentType: "official_publication" as const,
    jurisdiction: { level: "cantonal" as const, canton: provider === "cantonal-be" ? "BE" : "ZH" },
    sourceOriginalId: id,
    date: {},
    language: "de" as const,
    title: `Documento de prueba de ${provider}`,
    fullText: "Texto completo de prueba.",
    provenance: {
      sourceUrl: `https://example-${provider}.test/`,
      retrievedAt: "2026-07-27T00:00:00.000Z",
      contentHash: "a".repeat(64),
      officialCharacter: "official" as const,
    },
    rawMetadata: {},
    contentNature: "literal" as const,
  };
}

interface FakeLexWorkProvider extends LegalSourceProvider {
  searchDocuments: ReturnType<typeof vi.fn>;
  getArticle: ReturnType<typeof vi.fn>;
}
interface FakeZhProvider extends LegalSourceProvider {
  searchDocuments: ReturnType<typeof vi.fn>;
  fetchDocument: ReturnType<typeof vi.fn>;
}

function makeFakeLexWorkProvider(): FakeLexWorkProvider {
  const doc = fakeDocument("cantonal-be", "cantonal-be:324.111");
  const articleDoc = fakeDocument("cantonal-be", "cantonal-be:324.111#1");
  return {
    id: "cantonal-be",
    search: vi.fn(async () => []),
    getDocument: vi.fn(async () => doc),
    getMetadata: vi.fn(async () => ({})),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    normalize: vi.fn(() => doc),
    getSourceAttribution: vi.fn(() => ({
      sourceUrl: doc.provenance.sourceUrl,
      retrievedAt: doc.provenance.retrievedAt,
      officialCharacter: "official" as const,
    })),
    searchDocuments: vi.fn(async () => ({
      results: [doc],
      pagination: { page: 1, pageSize: 20, total: 1 },
      appliedFilters: {},
      sourceAttribution: {
        sourceUrl: doc.provenance.sourceUrl,
        retrievedAt: doc.provenance.retrievedAt,
        officialCharacter: "official" as const,
      },
      coverageWarnings: ["aviso de cobertura de cantonal-be"],
    })),
    getArticle: vi.fn(async () => articleDoc),
  };
}

interface FakeSzProvider extends LegalSourceProvider {
  searchDocuments: ReturnType<typeof vi.fn>;
  getArticle: ReturnType<typeof vi.fn>;
}
interface FakeSilProvider extends LegalSourceProvider {
  searchDocuments: ReturnType<typeof vi.fn>;
  getArticle: ReturnType<typeof vi.fn>;
}
// JU no expone searchDocuments/getArticle: solo getDocument (ver CantonalJuProvider real).
type FakeJuProvider = LegalSourceProvider;

function fakeDocumentWithFormat(
  provider: string,
  id: string,
  canton: string,
  contentFormat: string,
) {
  return {
    ...fakeDocument(provider, id),
    jurisdiction: { level: "cantonal" as const, canton },
    language: "fr" as const,
    provenance: {
      sourceUrl: `https://example-${provider}.test/doc`,
      retrievedAt: "2026-07-27T00:00:00.000Z",
      contentHash: "b".repeat(64),
      officialCharacter: "official" as const,
    },
    rawMetadata: { contentFormat },
  };
}

function makeFakeSzProvider(): FakeSzProvider {
  const doc = fakeDocumentWithFormat("cantonal-sz", "cantonal-sz:100.100", "SZ", "pdf");
  return {
    id: "cantonal-sz",
    search: vi.fn(async () => []),
    getDocument: vi.fn(async () => doc),
    getMetadata: vi.fn(async () => ({})),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    normalize: vi.fn(() => doc),
    getSourceAttribution: vi.fn(() => ({
      sourceUrl: doc.provenance.sourceUrl,
      retrievedAt: doc.provenance.retrievedAt,
      officialCharacter: "official" as const,
    })),
    searchDocuments: vi.fn(async () => ({
      results: [doc],
      pagination: { page: 1, pageSize: 20, total: 1 },
      sourceAttribution: {
        sourceUrl: doc.provenance.sourceUrl,
        retrievedAt: doc.provenance.retrievedAt,
        officialCharacter: "official" as const,
      },
      coverageWarnings: ["aviso de cobertura de cantonal-sz"],
    })),
    getArticle: vi.fn(async () => {
      throw new Error("no soportado");
    }),
  };
}

function makeFakeSilProvider(cantonCode: "GE" | "NE"): FakeSilProvider {
  const providerId = `cantonal-${cantonCode.toLowerCase()}`;
  const doc = fakeDocumentWithFormat(providerId, `${providerId}:rsg_a1_01`, cantonCode, "html");
  return {
    id: providerId,
    search: vi.fn(async () => []),
    getDocument: vi.fn(async () => doc),
    getMetadata: vi.fn(async () => ({})),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    normalize: vi.fn(() => doc),
    getSourceAttribution: vi.fn(() => ({
      sourceUrl: doc.provenance.sourceUrl,
      retrievedAt: doc.provenance.retrievedAt,
      officialCharacter: "official" as const,
    })),
    searchDocuments: vi.fn(async () => ({
      results: [doc],
      pagination: { page: 1, pageSize: 20, total: 1 },
      sourceAttribution: {
        sourceUrl: doc.provenance.sourceUrl,
        retrievedAt: doc.provenance.retrievedAt,
        officialCharacter: "official" as const,
      },
      coverageWarnings: [`aviso de cobertura de ${providerId}`],
    })),
    getArticle: vi.fn(async () => {
      throw new Error("no soportado");
    }),
  };
}

function makeFakeJuProvider(): FakeJuProvider {
  const doc = fakeDocumentWithFormat("cantonal-ju", "cantonal-ju:20002:36641", "JU", "pdf");
  return {
    id: "cantonal-ju",
    search: vi.fn(async () => {
      throw new Error("busqueda no soportada en Jura");
    }),
    getDocument: vi.fn(async () => doc),
    getMetadata: vi.fn(async () => ({})),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    normalize: vi.fn(() => doc),
    getSourceAttribution: vi.fn(() => ({
      sourceUrl: doc.provenance.sourceUrl,
      retrievedAt: doc.provenance.retrievedAt,
      officialCharacter: "official" as const,
    })),
  };
}

function makeFakeZhProvider(): FakeZhProvider {
  const doc = fakeDocument("cantonal-zh", "cantonal-zh:131.1:2015-04-20:2018-01-01:105");
  return {
    id: "cantonal-zh",
    search: vi.fn(async () => []),
    getDocument: vi.fn(async () => doc),
    getMetadata: vi.fn(async () => ({})),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    normalize: vi.fn(() => doc),
    getSourceAttribution: vi.fn(() => ({
      sourceUrl: doc.provenance.sourceUrl,
      retrievedAt: doc.provenance.retrievedAt,
      officialCharacter: "official" as const,
    })),
    searchDocuments: vi.fn(async () => ({
      results: [doc],
      pagination: {
        page: 1,
        numberOfResults: 1,
        numberOfResultPages: 1,
        moreSearchResultsThanAllowed: false,
      },
      sourceAttribution: {
        sourceUrl: doc.provenance.sourceUrl,
        retrievedAt: doc.provenance.retrievedAt,
        officialCharacter: "official" as const,
      },
      coverageWarnings: ["aviso de cobertura de cantonal-zh"],
    })),
    fetchDocument: vi.fn(async () => doc),
  };
}

async function buildServer(providersToRegister: LegalSourceProvider[]) {
  const providers = new ProviderRegistry();
  const legislationProviders = new LegislationProviderRegistry();
  for (const provider of providersToRegister) {
    providers.register(
      {
        id: provider.id,
        provider,
        officialCharacter: "official",
        capabilities: [],
        languages: ["de"],
        jurisdictions: ["cantonal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth(provider.id);
  }

  const tools = new ToolRegistry(providers, legislationProviders);
  registerCantonalTools(tools);

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

describe("Herramientas cantonales canton-aware (Fase 5B, proveedores falsos, sin red)", () => {
  it("tools/list expone las 3 herramientas cuando al menos un proveedor cantonal esta sano", async () => {
    const client = await buildServer([makeFakeLexWorkProvider(), makeFakeZhProvider()]);
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "get_cantonal_article",
      "get_cantonal_law",
      "search_cantonal_legislation",
    ]);
  });

  it("search_cantonal_legislation resuelve el proveedor por 'canton' y devuelve el envelope canton-aware", async () => {
    const lexwork = makeFakeLexWorkProvider();
    const client = await buildServer([lexwork]);
    const result = await client.callTool({
      name: "search_cantonal_legislation",
      arguments: { canton: "BE", systematicNumber: "324.111" },
    });
    expect(result.isError).toBeFalsy();
    expect(lexwork.searchDocuments).toHaveBeenCalledWith({ systematicNumber: "324.111" });
    const structured = result.structuredContent as {
      canton: string;
      provider: string;
      technicalFamily: string;
      capabilities: unknown;
      limitations: string[];
      officialSource: string;
      retrievedAt: string;
      result: { coverageWarnings?: string[] };
    };
    expect(structured.canton).toBe("BE");
    expect(structured.provider).toBe("cantonal-be");
    expect(structured.technicalFamily).toBe("lexwork");
    expect(structured.result.coverageWarnings?.[0]).toContain("aviso de cobertura");
    expect(typeof structured.retrievedAt).toBe("string");
  });

  it("search_cantonal_legislation para ZH traduce systematicNumber/query a referenceNumber/title", async () => {
    const zh = makeFakeZhProvider();
    const client = await buildServer([zh]);
    const result = await client.callTool({
      name: "search_cantonal_legislation",
      arguments: { canton: "ZH", systematicNumber: "131.1" },
    });
    expect(result.isError).toBeFalsy();
    expect(zh.searchDocuments).toHaveBeenCalledWith({ referenceNumber: "131.1" });
  });

  it("un canton sin proveedor registrado devuelve un error explicito (no generico)", async () => {
    const client = await buildServer([makeFakeLexWorkProvider()]);
    const result = await client.callTool({
      name: "search_cantonal_legislation",
      arguments: { canton: "TI" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text?: string }>)[0]?.text ?? "";
    expect(text).toContain("TI");
    expect(text).toContain("Cantones soportados");
  });

  it("get_cantonal_law delega en CantonalZhProvider con el id construido a partir de los campos reales", async () => {
    const zh = makeFakeZhProvider();
    const client = await buildServer([zh]);
    const result = await client.callTool({
      name: "get_cantonal_law",
      arguments: {
        canton: "ZH",
        systematicNumber: "131.1",
        effectiveFrom: "2015-04-20",
        effectiveTo: "2018-01-01",
        internalId: "105",
      },
    });
    expect(result.isError).toBeFalsy();
    expect(zh.fetchDocument).toHaveBeenCalledWith("cantonal-zh:131.1:2015-04-20:2018-01-01:105");
  });

  it("get_cantonal_law para ZH sin effectiveFrom/internalId devuelve error explicito", async () => {
    const zh = makeFakeZhProvider();
    const client = await buildServer([zh]);
    const result = await client.callTool({
      name: "get_cantonal_law",
      arguments: { canton: "ZH", systematicNumber: "131.1" },
    });
    expect(result.isError).toBe(true);
    expect(zh.fetchDocument).not.toHaveBeenCalled();
  });

  it("get_cantonal_law para un canton LexWork solo requiere systematicNumber", async () => {
    const lexwork = makeFakeLexWorkProvider();
    const client = await buildServer([lexwork]);
    const result = await client.callTool({
      name: "get_cantonal_law",
      arguments: { canton: "BE", systematicNumber: "324.111" },
    });
    expect(result.isError).toBeFalsy();
    expect(lexwork.getDocument).toHaveBeenCalledWith("cantonal-be:324.111");
  });

  it("get_cantonal_article funciona para un canton LexWork", async () => {
    const lexwork = makeFakeLexWorkProvider();
    const client = await buildServer([lexwork]);
    const result = await client.callTool({
      name: "get_cantonal_article",
      arguments: { canton: "BE", systematicNumber: "324.111", articleNumber: "1" },
    });
    expect(result.isError).toBeFalsy();
    expect(lexwork.getArticle).toHaveBeenCalledWith("324.111", "1");
  });

  it("get_cantonal_article para ZH devuelve error explicito (familia no soportada)", async () => {
    // get_cantonal_article solo se activa si al menos un canton LexWork esta
    // sano (requireAnyProviderIds); se registra tambien cantonal-be para que
    // la herramienta este activa y podamos probar el rechazo especifico de ZH.
    const zh = makeFakeZhProvider();
    const client = await buildServer([makeFakeLexWorkProvider(), zh]);
    const result = await client.callTool({
      name: "get_cantonal_article",
      arguments: { canton: "ZH", systematicNumber: "131.1", articleNumber: "1" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text?: string }>)[0]?.text ?? "";
    expect(text).toContain("ZH");
  });

  it("search_cantonal_legislation para Schwyz (SZ) filtra por systematicNumber igual que SIL", async () => {
    const sz = makeFakeSzProvider();
    const client = await buildServer([sz]);
    const result = await client.callTool({
      name: "search_cantonal_legislation",
      arguments: { canton: "SZ", systematicNumber: "100.100" },
    });
    expect(result.isError).toBeFalsy();
    expect(sz.searchDocuments).toHaveBeenCalledWith({ systematicNumber: "100.100" });
    const structured = result.structuredContent as { technicalFamily: string; canton: string };
    expect(structured.technicalFamily).toBe("sz");
    expect(structured.canton).toBe("SZ");
  });

  it("search_cantonal_legislation para Geneve/Neuchatel (plataforma SIL compartida) enruta con family 'sil'", async () => {
    const ge = makeFakeSilProvider("GE");
    const client = await buildServer([ge]);
    const result = await client.callTool({
      name: "search_cantonal_legislation",
      arguments: { canton: "GE", query: "union" },
    });
    expect(result.isError).toBeFalsy();
    expect(ge.searchDocuments).toHaveBeenCalledWith({ query: "union" });
    const structured = result.structuredContent as { technicalFamily: string };
    expect(structured.technicalFamily).toBe("sil");
  });

  it("search_cantonal_legislation para Jura (JU) devuelve error explicito: sin mecanismo de busqueda", async () => {
    const ju = makeFakeJuProvider();
    const client = await buildServer([ju]);
    const result = await client.callTool({
      name: "search_cantonal_legislation",
      arguments: { canton: "JU", query: "constitution" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text?: string }>)[0]?.text ?? "";
    expect(text).toContain("Jura");
    expect(ju.search).not.toHaveBeenCalled();
  });

  it("get_cantonal_law para Schwyz (SZ) delega en getDocument y expone contentFormat/contentHash reales", async () => {
    const sz = makeFakeSzProvider();
    const client = await buildServer([sz]);
    const result = await client.callTool({
      name: "get_cantonal_law",
      arguments: { canton: "SZ", systematicNumber: "100.100" },
    });
    expect(result.isError).toBeFalsy();
    expect(sz.getDocument).toHaveBeenCalledWith("cantonal-sz:100.100");
    const structured = result.structuredContent as {
      technicalFamily: string;
      language: string;
      documentIdentifier: string;
      canonicalOfficialUrl: string;
      contentFormat: string;
      contentHash: string;
    };
    expect(structured.technicalFamily).toBe("sz");
    expect(structured.language).toBe("fr");
    expect(structured.documentIdentifier).toBe("cantonal-sz:100.100");
    expect(structured.canonicalOfficialUrl).toBe("https://example-cantonal-sz.test/doc");
    expect(structured.contentFormat).toBe("pdf");
    expect(structured.contentHash).toBe("b".repeat(64));
  });

  it("get_cantonal_law para Geneve (SIL) usa 'systematicNumber' como docKey interno", async () => {
    const ge = makeFakeSilProvider("GE");
    const client = await buildServer([ge]);
    const result = await client.callTool({
      name: "get_cantonal_law",
      arguments: { canton: "GE", systematicNumber: "rsg_a1_01" },
    });
    expect(result.isError).toBeFalsy();
    expect(ge.getDocument).toHaveBeenCalledWith("cantonal-ge:rsg_a1_01");
  });

  it("get_cantonal_law para Jura (JU) requiere 'idn' ademas de 'systematicNumber' (id)", async () => {
    const ju = makeFakeJuProvider();
    const client = await buildServer([ju]);
    const withoutIdn = await client.callTool({
      name: "get_cantonal_law",
      arguments: { canton: "JU", systematicNumber: "36641" },
    });
    expect(withoutIdn.isError).toBe(true);
    expect(ju.getDocument).not.toHaveBeenCalled();

    const withIdn = await client.callTool({
      name: "get_cantonal_law",
      arguments: { canton: "JU", systematicNumber: "36641", idn: "20002" },
    });
    expect(withIdn.isError).toBeFalsy();
    expect(ju.getDocument).toHaveBeenCalledWith("cantonal-ju:20002:36641");
  });

  it("get_cantonal_article devuelve error explicito para SZ/SIL/JU (ninguno soporta articulo individual)", async () => {
    const sz = makeFakeSzProvider();
    const ge = makeFakeSilProvider("GE");
    const ju = makeFakeJuProvider();
    const client = await buildServer([makeFakeLexWorkProvider(), sz, ge, ju]);

    for (const [canton, provider] of [
      ["SZ", sz],
      ["GE", ge],
    ] as const) {
      const result = await client.callTool({
        name: "get_cantonal_article",
        arguments: { canton, systematicNumber: "100.100", articleNumber: "1" },
      });
      expect(result.isError).toBe(true);
      expect(provider.getArticle).not.toHaveBeenCalled();
      const text = (result.content as Array<{ text?: string }>)[0]?.text ?? "";
      expect(text).toContain(canton);
    }

    const juResult = await client.callTool({
      name: "get_cantonal_article",
      arguments: { canton: "JU", systematicNumber: "36641", articleNumber: "1" },
    });
    expect(juResult.isError).toBe(true);
    const text = (juResult.content as Array<{ text?: string }>)[0]?.text ?? "";
    expect(text).toContain("JU");
  });
});
