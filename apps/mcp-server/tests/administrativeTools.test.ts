import { describe, expect, it, vi } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { LegislationProviderRegistry, ProviderRegistry, ToolRegistry } from "@swiss-legal-mcp/core";
import type { LegalSourceProvider } from "@swiss-legal-mcp/core";
import { createLogger } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { registerAdministrativeTools } from "../src/tools/administrativeTools.js";

const logger = createLogger({ level: "silent" });

function fakeAdministrativeDocument(provider: string, id: string) {
  return {
    id,
    provider,
    documentType: "administrative_circular" as const,
    jurisdiction: { level: "federal" as const },
    sourceOriginalId: id,
    date: {},
    language: "de" as const,
    title: `Documento de prueba de ${provider}`,
    fullText: "Texto completo de prueba.",
    administrativeCircular: {
      administrativeDocumentType: "circular" as const,
      status: "current" as const,
    },
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

interface FakeAdministrativeProvider extends LegalSourceProvider {
  searchDocuments: ReturnType<typeof vi.fn>;
  fetchDocument: ReturnType<typeof vi.fn>;
  fetchDocumentByUrl: ReturnType<typeof vi.fn>;
}

function makeFakeProvider(id: string): FakeAdministrativeProvider {
  const doc = fakeAdministrativeDocument(id, `${id}:test-doc`);
  return {
    id,
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
      coverageWarnings: [`aviso de cobertura de ${id}`],
    })),
    fetchDocument: vi.fn(async () => doc),
    fetchDocumentByUrl: vi.fn(async () => doc),
  };
}

async function buildServerWithProviders(providersToRegister: FakeAdministrativeProvider[]) {
  const providers = new ProviderRegistry();
  const legislationProviders = new LegislationProviderRegistry();
  for (const provider of providersToRegister) {
    providers.register(
      {
        id: provider.id,
        provider,
        officialCharacter: "official",
        capabilities: ["search", "getDocument", "getMetadata"],
        languages: ["de"],
        jurisdictions: ["federal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth(provider.id);
  }

  const tools = new ToolRegistry(providers, legislationProviders);
  registerAdministrativeTools(tools);

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

describe("Herramientas administrativas de Fase 4 (SECO/BSV/ESTV, proveedores falsos, sin red)", () => {
  it("tools/list expone las 4 herramientas cuando los tres proveedores estan sanos", async () => {
    const client = await buildServerWithProviders([
      makeFakeProvider("seco"),
      makeFakeProvider("bsv"),
      makeFakeProvider("estv"),
    ]);
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "get_official_document",
      "search_bsv_documents",
      "search_estv_documents",
      "search_seco_documents",
    ]);
  });

  it("search_seco_documents solo se activa si el proveedor seco esta registrado", async () => {
    const client = await buildServerWithProviders([makeFakeProvider("bsv")]);
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).not.toContain("search_seco_documents");
    expect(names).toContain("search_bsv_documents");
  });

  it("search_seco_documents delega en el proveedor y devuelve resultados/atribucion/avisos", async () => {
    const seco = makeFakeProvider("seco");
    const client = await buildServerWithProviders([seco]);
    const result = await client.callTool({
      name: "search_seco_documents",
      arguments: { query: "KAE" },
    });
    expect(result.isError).toBeFalsy();
    expect(seco.searchDocuments).toHaveBeenCalledWith({ query: "KAE" });
    const structured = result.structuredContent as { coverageWarnings?: string[] };
    expect(structured.coverageWarnings?.[0]).toContain("aviso de cobertura");
  });

  it("get_official_document con documentId delega en fetchDocument del proveedor indicado", async () => {
    const bsv = makeFakeProvider("bsv");
    const client = await buildServerWithProviders([bsv]);
    const result = await client.callTool({
      name: "get_official_document",
      arguments: { provider: "bsv", documentId: "bsv:18452" },
    });
    expect(result.isError).toBeFalsy();
    expect(bsv.fetchDocument).toHaveBeenCalledWith("bsv:18452");
  });

  it("get_official_document con officialUrl delega en fetchDocumentByUrl", async () => {
    const estv = makeFakeProvider("estv");
    const client = await buildServerWithProviders([estv]);
    const result = await client.callTool({
      name: "get_official_document",
      arguments: { provider: "estv", officialUrl: "https://www.estv.admin.ch/dam/de/x.pdf" },
    });
    expect(result.isError).toBeFalsy();
    expect(estv.fetchDocumentByUrl).toHaveBeenCalledWith("https://www.estv.admin.ch/dam/de/x.pdf");
  });

  it("get_official_document sin documentId ni officialUrl devuelve error de validacion", async () => {
    const seco = makeFakeProvider("seco");
    const client = await buildServerWithProviders([seco]);
    const result = await client.callTool({
      name: "get_official_document",
      arguments: { provider: "seco" },
    });
    expect(result.isError).toBe(true);
  });

  it("get_official_document con un proveedor caido/no registrado devuelve error, no lanza una excepcion no controlada", async () => {
    // get_official_document tiene requiredProviderIds:[] (se resuelve el
    // proveedor concreto dentro del handler, no en la activacion del
    // ToolRegistry) -- por eso la herramienta sigue listada aunque "bsv" no
    // este registrado, y la caida debe reflejarse como isError:true.
    const client = await buildServerWithProviders([makeFakeProvider("seco")]);
    const result = await client.callTool({
      name: "get_official_document",
      arguments: { provider: "bsv", documentId: "bsv:18452" },
    });
    expect(result.isError).toBe(true);
  });
});
