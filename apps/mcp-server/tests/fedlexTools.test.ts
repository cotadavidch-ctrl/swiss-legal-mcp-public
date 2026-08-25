import { describe, expect, it, vi } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  LegislationProviderRegistry,
  ProviderRegistry,
  ToolRegistry,
  type LegislationProvider,
} from "@swiss-legal-mcp/core";
import { createLogger } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { registerFedlexTools } from "../src/tools/fedlexTools.js";
import { FEDLEX_CAPABILITIES } from "@swiss-legal-mcp/provider-fedlex";

const logger = createLogger({ level: "silent" });

function fakeNormalizedLaw() {
  return {
    id: "fedlex:test",
    provider: "fedlex",
    documentType: "legislation_law" as const,
    jurisdiction: { level: "federal" as const },
    sourceOriginalId: "eli/cc/1999/404/20240303/de",
    date: { publicationDate: "2024-03-03" },
    language: "de" as const,
    title: "Bundesverfassung der Schweizerischen Eidgenossenschaft",
    legislation: {
      eli: "https://fedlex.data.admin.ch/eli/cc/1999/404/20240303/de",
      systematicNumber: "101",
      workTitle: "Bundesverfassung der Schweizerischen Eidgenossenschaft",
      expressionLanguage: "de" as const,
      version: { date: "2024-03-03", isHistorical: false, structuredFormatAvailable: true },
      inForceStatus: "in_force" as const,
    },
    provenance: {
      sourceUrl: "https://www.fedlex.admin.ch/eli/cc/1999/404/de",
      retrievedAt: "2026-07-26T00:00:00.000Z",
      contentHash: "abc123",
      officialCharacter: "official" as const,
    },
    rawMetadata: {},
    contentNature: "literal" as const,
  };
}

function makeFakeProvider(overrides: Partial<LegislationProvider> = {}): LegislationProvider {
  return {
    id: "fedlex",
    capabilities: FEDLEX_CAPABILITIES,
    searchLegislation: vi.fn(async () => ({
      items: [],
      pagination: { page: 1, pageSize: 20 },
      appliedFilters: {},
      officialAttribution: {
        sourceUrl: "https://www.fedlex.admin.ch/",
        officialCharacter: "official" as const,
      },
      capabilities: FEDLEX_CAPABILITIES,
      warnings: [],
    })),
    getLaw: vi.fn(async () => fakeNormalizedLaw()),
    getArticle: vi.fn(async () => ({
      ...fakeNormalizedLaw(),
      documentType: "legislation_article" as const,
    })),
    getArticleAtDate: vi.fn(async () => ({
      document: { ...fakeNormalizedLaw(), documentType: "legislation_article" as const },
      evidence: {
        chosenEli: "https://fedlex.data.admin.ch/eli/cc/1999/404/20240303",
        reason: "test",
      },
      warnings: [],
    })),
    compareArticleVersions: vi.fn(async () => ({
      articleNumber: "1",
      language: "de" as const,
      before: {
        eli: "https://fedlex.data.admin.ch/eli/cc/1999/404/20000101/de",
        date: "2000-01-01",
        text: "a",
      },
      after: {
        eli: "https://fedlex.data.admin.ch/eli/cc/1999/404/20240303/de",
        date: "2024-03-03",
        text: "b",
      },
      changes: [{ kind: "modified" as const, beforeText: "a", afterText: "b" }],
      comparisonNature: "literal" as const,
    })),
    getAmendmentHistory: vi.fn(async () => [
      {
        eli: "https://fedlex.data.admin.ch/eli/cc/1999/404/20240303",
        date: "2024-03-03",
        amendingActs: [],
      },
    ]),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    ...overrides,
  };
}

async function buildServerWithProvider(provider: LegislationProvider | undefined) {
  const providers = new ProviderRegistry();
  const legislationProviders = new LegislationProviderRegistry();
  if (provider) {
    legislationProviders.register(
      {
        id: "fedlex",
        provider,
        officialCharacter: "official",
        jurisdictions: ["federal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await legislationProviders.checkHealth("fedlex");
  }

  const tools = new ToolRegistry(providers, legislationProviders);
  registerFedlexTools(tools);

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

describe("Herramientas de Fedlex en apps/mcp-server (proveedor falso, sin red)", () => {
  it("tools/list expone exactamente las 6 herramientas activadas cuando el proveedor esta sano", async () => {
    const client = await buildServerWithProvider(makeFakeProvider());
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "compare_article_versions",
      "get_amendment_history",
      "get_article",
      "get_article_at_date",
      "get_law",
      "search_legislation",
    ]);
  });

  it("no expone ninguna herramienta si el proveedor no esta registrado", async () => {
    const client = await buildServerWithProvider(undefined);
    await expect(client.listTools()).rejects.toThrow("Method not found");
  });

  it("proveedor caido: si el healthCheck falla, las 6 herramientas quedan desactivadas", async () => {
    const provider = makeFakeProvider({
      healthCheck: vi.fn(async () => ({ healthy: false, checkedAt: new Date().toISOString() })),
    });
    const client = await buildServerWithProvider(provider);
    await expect(client.listTools()).rejects.toThrow("Method not found");
  });

  it("tools/call get_law delega en el proveedor y devuelve el documento normalizado", async () => {
    const provider = makeFakeProvider();
    const client = await buildServerWithProvider(provider);
    const result = await client.callTool({
      name: "get_law",
      arguments: { systematicNumber: "101", language: "de" },
    });
    expect(result.isError).toBeFalsy();
    expect(provider.getLaw).toHaveBeenCalledTimes(1);
    const callArgs = provider.getLaw.mock.calls[0];
    expect(callArgs[0]).toEqual({ systematicNumber: "101", language: "de" });
    const structured = result.structuredContent as { legislation?: { systematicNumber?: string } };
    expect(structured.legislation?.systematicNumber).toBe("101");
  });

  it("tools/call get_article delega articleNumber y lawRef correctamente", async () => {
    const provider = makeFakeProvider();
    const client = await buildServerWithProvider(provider);
    await client.callTool({
      name: "get_article",
      arguments: {
        eli: "https://fedlex.data.admin.ch/eli/cc/1999/404",
        language: "de",
        articleNumber: "1",
      },
    });
    expect(provider.getArticle).toHaveBeenCalledTimes(1);
    const callArgs = provider.getArticle.mock.calls[0];
    expect(callArgs[0]).toEqual({
      lawRef: { eli: "https://fedlex.data.admin.ch/eli/cc/1999/404", language: "de" },
      articleNumber: "1",
    });
  });

  it("tools/call get_article_at_date delega la fecha correctamente", async () => {
    const provider = makeFakeProvider();
    const client = await buildServerWithProvider(provider);
    const result = await client.callTool({
      name: "get_article_at_date",
      arguments: {
        systematicNumber: "101",
        language: "de",
        articleNumber: "1",
        atDate: "2005-01-01",
      },
    });
    expect(result.isError).toBeFalsy();
    expect(provider.getArticleAtDate).toHaveBeenCalledTimes(1);
    const callArgs = provider.getArticleAtDate.mock.calls[0];
    expect(callArgs[0]).toEqual({
      lawRef: { systematicNumber: "101", language: "de" },
      articleNumber: "1",
    });
    expect(callArgs[1]).toBe("2005-01-01");
  });

  it("tools/call compare_article_versions devuelve el resultado de comparacion", async () => {
    const provider = makeFakeProvider();
    const client = await buildServerWithProvider(provider);
    const result = await client.callTool({
      name: "compare_article_versions",
      arguments: {
        systematicNumber: "101",
        language: "de",
        articleNumber: "1",
        dateBefore: "2000-01-01",
        dateAfter: "2024-03-03",
      },
    });
    expect(result.isError).toBeFalsy();
    expect(provider.compareArticleVersions).toHaveBeenCalledTimes(1);
    const callArgs = provider.compareArticleVersions.mock.calls[0];
    expect(callArgs[0]).toEqual({
      lawRef: { systematicNumber: "101", language: "de" },
      articleNumber: "1",
    });
    expect(callArgs[1]).toBe("2000-01-01");
    expect(callArgs[2]).toBe("2024-03-03");
    const structured = result.structuredContent as { comparisonNature?: string };
    expect(structured.comparisonNature).toBe("literal");
  });

  it("tools/call get_amendment_history nunca inventa amendingActs", async () => {
    const provider = makeFakeProvider();
    const client = await buildServerWithProvider(provider);
    const result = await client.callTool({
      name: "get_amendment_history",
      arguments: { systematicNumber: "101", language: "de" },
    });
    expect(result.isError).toBeFalsy();
    expect(provider.getAmendmentHistory).toHaveBeenCalledTimes(1);
    const callArgs = provider.getAmendmentHistory.mock.calls[0];
    expect(callArgs[0]).toEqual({ systematicNumber: "101", language: "de" });
    const structured = result.structuredContent as { result: unknown[] } | unknown[];
    const list = Array.isArray(structured) ? structured : structured.result;
    expect(Array.isArray(list)).toBe(true);
  });

  it("tools/call search_legislation con abbreviation devuelve error de herramienta desactivada", async () => {
    const provider = makeFakeProvider();
    const client = await buildServerWithProvider(provider);
    const result = await client.callTool({
      name: "search_legislation",
      arguments: { abbreviation: "CO" },
    });
    expect(result.isError).toBe(true);
  });

  it("tools/call search_legislation por texto delega correctamente", async () => {
    const provider = makeFakeProvider();
    const client = await buildServerWithProvider(provider);
    const result = await client.callTool({
      name: "search_legislation",
      arguments: { query: "Obligationenrecht", language: "de", relevantDate: "2020-06-15" },
    });
    expect(result.isError).toBeFalsy();
    expect(provider.searchLegislation).toHaveBeenCalledTimes(1);
    const callArgs = provider.searchLegislation.mock.calls[0];
    expect(callArgs[0]).toEqual({
      text: "Obligationenrecht",
      language: "de",
    });
    const structured = result.structuredContent as {
      legalCalibration: {
        source_quality: string;
        jurisdiction_level: string;
        relevant_date: string;
        relevant_date_assessment: string;
        warnings: string[];
      };
    };
    expect(structured.legalCalibration.source_quality).toBe("OFFICIAL_PRIMARY");
    expect(structured.legalCalibration.jurisdiction_level).toBe("federal");
    expect(structured.legalCalibration.relevant_date).toBe("2020-06-15");
    expect(structured.legalCalibration.relevant_date_assessment).toBe(
      "requires_get_law_or_get_article_at_date",
    );
    expect(structured.legalCalibration.warnings.join(" ")).toContain("exact version");
  });
});
