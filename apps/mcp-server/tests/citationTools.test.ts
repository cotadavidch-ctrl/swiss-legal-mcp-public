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
import { registerCitationTools } from "../src/tools/citationTools.js";

const logger = createLogger({ level: "silent" });

function fakeFedlexDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "fedlex:220",
    provider: "fedlex",
    documentType: "legislation_law" as const,
    jurisdiction: { level: "federal" as const },
    sourceOriginalId: "eli/cc/220",
    date: {},
    language: "de" as const,
    title: "Bundesgesetz betreffend die Ergänzung des Schweizerischen Zivilgesetzbuches (OR)",
    legislation: {
      eli: "https://fedlex.data.admin.ch/eli/cc/220",
      systematicNumber: "220",
      workTitle: "OR",
      expressionLanguage: "de" as const,
      version: { date: "2020-01-01", isHistorical: false, structuredFormatAvailable: true },
      inForceStatus: "in_force" as const,
    },
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
    searchLegislation: vi.fn(async () => ({
      items: [
        {
          id: "220",
          eli: "https://fedlex.data.admin.ch/eli/cc/220",
          title: "OR",
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
    getLaw: vi.fn(async () => fakeFedlexDoc()),
    getArticle: vi.fn(),
    getArticleAtDate: vi.fn(),
    compareArticleVersions: vi.fn(),
    getAmendmentHistory: vi.fn(async () => []),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    ...overrides,
  };
}

interface FakeEntscheidsuche extends LegalSourceProvider {
  searchByCaseNumber: ReturnType<typeof vi.fn>;
}

function fakeEntscheidsucheProvider(results?: unknown[]): FakeEntscheidsuche {
  const doc = {
    id: "entscheidsuche:1",
    provider: "entscheidsuche",
    documentType: "case" as const,
    jurisdiction: { level: "federal" as const },
    sourceOriginalId: "1",
    date: {},
    title: "ATF 142 III 1",
    bgeAtfDtf: "BGE 142 III 1",
    provenance: {
      sourceUrl: "https://entscheidsuche.ch/1",
      retrievedAt: "2026-07-28T00:00:00.000Z",
      contentHash: "b".repeat(64),
      officialCharacter: "unofficial_aggregator" as const,
      aggregatorName: "entscheidsuche.ch",
    },
    rawMetadata: {},
    contentNature: "summary" as const,
  };
  return {
    id: "entscheidsuche",
    search: vi.fn(async () => []),
    getDocument: vi.fn(async () => doc),
    getMetadata: vi.fn(async () => ({})),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    normalize: vi.fn(() => doc),
    getSourceAttribution: vi.fn(() => ({
      sourceUrl: doc.provenance.sourceUrl,
      retrievedAt: doc.provenance.retrievedAt,
      officialCharacter: "unofficial_aggregator" as const,
    })),
    searchByCaseNumber: vi.fn(async () => ({
      results: results ?? [doc],
      pagination: {
        page: 1,
        pageSize: 20,
        total: results?.length ?? 1,
        hasNextPage: false,
      },
      filtersApplied: {},
    })),
  };
}

async function buildServer(options: {
  fedlex?: LegislationProvider;
  entscheidsuche?: FakeEntscheidsuche;
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
  if (options.entscheidsuche) {
    providers.register(
      {
        id: "entscheidsuche",
        provider: options.entscheidsuche,
        officialCharacter: "unofficial_aggregator",
        aggregatorName: "entscheidsuche.ch",
        capabilities: ["search"],
        languages: ["de", "fr", "it"],
        jurisdictions: ["federal", "cantonal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth("entscheidsuche");
  }
  if (options.cantonalSz) {
    providers.register(
      {
        id: "cantonal-sz",
        provider: options.cantonalSz,
        officialCharacter: "official",
        capabilities: ["search", "getDocument"],
        languages: ["de"],
        jurisdictions: ["cantonal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth("cantonal-sz");
  }

  const tools = new ToolRegistry(providers, legislationProviders);
  registerCitationTools(tools);

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

describe("verify_legal_citation (proveedores falsos, sin red)", () => {
  it("tools/list expone verify_legal_citation cuando fedlex esta sano", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("verify_legal_citation");
  });

  it("resuelve 'exact' para un numero RS real con un unico resultado de Fedlex", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const result = await client.callTool({
      name: "verify_legal_citation",
      arguments: { citation: "RS 220" },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      match: string;
      normalized: string;
      document: { systematicNumber: string } | null;
      source_quality: string;
      material_verification: { status: string; citation_quality: string };
    };
    expect(structured.match).toBe("exact");
    expect(structured.normalized).toBe("220");
    expect(structured.document?.systematicNumber).toBe("220");
    expect(structured.source_quality).toBe("OFFICIAL_PRIMARY");
    expect(structured.material_verification.status).toBe("not_requested");
    expect(structured.material_verification.citation_quality).toBe("UNABLE_TO_VERIFY");
  });

  it("devuelve not_found cuando el texto no contiene ninguna cita reconocible", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const result = await client.callTool({
      name: "verify_legal_citation",
      arguments: { citation: "Il fait beau à Genève." },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { match: string; warnings: string[] };
    expect(structured.match).toBe("not_found");
    expect(structured.warnings.join(" ")).toContain("No se reconocio");
  });

  it("nunca verifica un ECLI: siempre not_found con advertencia explicita", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const result = await client.callTool({
      name: "verify_legal_citation",
      arguments: { citation: "ECLI:CH:BGer:2020:6B_1234_2019" },
    });
    const structured = result.structuredContent as {
      match: string;
      type: string;
      warnings: string[];
    };
    expect(structured.match).toBe("not_found");
    expect(structured.type).toBe("ecli");
    expect(structured.warnings.join(" ")).toContain("ningun tribunal suizo indexado");
  });

  it("declina resolver una cita solo por abreviatura (sin numero RS)", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const result = await client.callTool({
      name: "verify_legal_citation",
      arguments: { citation: "art. 41 CO" },
    });
    const structured = result.structuredContent as { match: string; warnings: string[] };
    expect(structured.match).toBe("not_found");
    expect(structured.warnings.join(" ")).toContain("searchByAbbreviation");
  });

  it("resuelve una referencia BGE/ATF/DTF real contra entscheidsuche.ch (probable, un resultado)", async () => {
    const entscheidsuche = fakeEntscheidsucheProvider();
    const client = await buildServer({ fedlex: fakeFedlexProvider(), entscheidsuche });
    const result = await client.callTool({
      name: "verify_legal_citation",
      arguments: { citation: "ATF 142 III 1" },
    });
    const structured = result.structuredContent as {
      match: string;
      document: { id: string } | null;
      source_quality: string;
      citation_identity: { status: string };
      material_verification: { status: string; citation_quality: string };
      recommended_use: { use: string };
      liveOfficialCaseResolution?: {
        legal_use?: { official_verification_status?: string };
      };
    };
    expect(structured.match).toBe("probable");
    expect(structured.document?.id).toBe("entscheidsuche:1");
    if (
      structured.liveOfficialCaseResolution?.legal_use?.official_verification_status ===
      "full_text_verified_official"
    ) {
      expect(structured.source_quality).toBe("OFFICIAL_PRIMARY");
      expect(structured.citation_identity.status).toBe("identity_verified");
      expect(structured.recommended_use.use).toBe("official_citation");
    } else {
      expect(structured.source_quality).toBe("SECONDARY_REFERENCE");
      expect(structured.citation_identity.status).toBe("reference_located");
      expect(structured.material_verification.status).toBe("unable_to_verify");
      expect(structured.material_verification.citation_quality).toBe("UNABLE_TO_VERIFY");
      expect(structured.recommended_use.use).toBe("discovery_only");
    }
    expect(entscheidsuche.searchByCaseNumber).toHaveBeenCalledWith({ caseNumber: "BGE 142 III 1" });
  });

  it.each([
    ["1B_352/2019", "2019-10-30", "Strafverfahren; Kontosperre"],
    ["4A_97/2026", "2026-05-07", "Rechtsoeffnung"],
    ["9C_785/2018", "2019-05-10", "Invalidenversicherung"],
  ])(
    "does not treat legacy Bundesgericht metadata alone as official verification for %s",
    async (reference, date) => {
      const doc = {
        id: `entscheidsuche:${reference}`,
        provider: "entscheidsuche",
        documentType: "case" as const,
        jurisdiction: { level: "federal" as const },
        sourceOriginalId: reference,
        date: { decisionOrEnactment: date },
        title: `${reference} official metadata mirrored by aggregator`,
        provenance: {
          sourceUrl: `https://entscheidsuche.ch/${reference}`,
          retrievedAt: "2026-07-28T00:00:00.000Z",
          contentHash: "d".repeat(64),
          officialCharacter: "unofficial_aggregator" as const,
          aggregatorName: "entscheidsuche.ch",
        },
        rawMetadata: {},
        contentNature: "summary" as const,
      };
      const client = await buildServer({
        fedlex: fakeFedlexProvider(),
        entscheidsuche: fakeEntscheidsucheProvider([doc]),
      });

      const result = await client.callTool({
        name: "verify_legal_citation",
        arguments: { citation: reference },
      });
      const structured = result.structuredContent as {
        officialSource: string;
        officialCaseVerification: {
          status: string;
          officialSourceUrl: string;
          aggregatorSourceUrl: string;
          metadata: { date: string; matter: string };
          evidence: Array<{ source: string; sourceCharacter: string }>;
          warnings: string[];
        };
        liveOfficialCaseResolution?: {
          legal_use?: { official_verification_status?: string };
        };
      };

      if (
        structured.liveOfficialCaseResolution?.legal_use?.official_verification_status ===
        "full_text_verified_official"
      ) {
        expect(["officially_verified", "official_mismatch"]).toContain(
          structured.officialCaseVerification.status,
        );
        expect(structured.officialSource).toContain("bger.ch");
      } else {
        expect(structured.officialCaseVerification.status).toBe("not_verified");
        expect(structured.officialCaseVerification.warnings).toContain(
          "legacy_verification_without_fetch_blocked",
        );
        expect(structured.officialSource).toContain("entscheidsuche.ch");
      }
      expect(structured.officialCaseVerification.aggregatorSourceUrl).toContain(
        "entscheidsuche.ch",
      );
    },
  );

  it("reports official_not_found for a nonexistent federal case reference", async () => {
    const client = await buildServer({
      fedlex: fakeFedlexProvider(),
      entscheidsuche: fakeEntscheidsucheProvider([]),
    });

    const result = await client.callTool({
      name: "verify_legal_citation",
      arguments: { citation: "4A_9999/2099" },
    });
    const structured = result.structuredContent as {
      match: string;
      officialCaseVerification: { status: string; warnings: string[] };
    };

    expect(structured.match).toBe("not_found");
    expect(structured.officialCaseVerification.status).toBe("not_verified");
    expect(structured.officialCaseVerification.warnings).toContain(
      "legacy_verification_without_fetch_blocked",
    );
  });

  it("returns official_mismatch when aggregator metadata conflicts with bger.ch metadata", async () => {
    const doc = {
      id: "entscheidsuche:4A_97/2026",
      provider: "entscheidsuche",
      documentType: "case" as const,
      jurisdiction: { level: "federal" as const },
      sourceOriginalId: "4A_97/2026",
      date: { decisionOrEnactment: "2026-05-08" },
      title: "4A_97/2026 aggregator date mismatch",
      provenance: {
        sourceUrl: "https://entscheidsuche.ch/4A_97-2026",
        retrievedAt: "2026-07-28T00:00:00.000Z",
        contentHash: "e".repeat(64),
        officialCharacter: "unofficial_aggregator" as const,
        aggregatorName: "entscheidsuche.ch",
      },
      rawMetadata: {},
      contentNature: "summary" as const,
    };
    const client = await buildServer({
      fedlex: fakeFedlexProvider(),
      entscheidsuche: fakeEntscheidsucheProvider([doc]),
    });

    const result = await client.callTool({
      name: "verify_legal_citation",
      arguments: { citation: "4A_97/2026" },
    });
    const structured = result.structuredContent as {
      officialCaseVerification: { status: string; warnings: string[]; metadata: { date: string } };
      warnings: string[];
      liveOfficialCaseResolution?: {
        legal_use?: { official_verification_status?: string };
      };
    };

    if (
      structured.liveOfficialCaseResolution?.legal_use?.official_verification_status ===
      "full_text_verified_official"
    ) {
      expect(structured.officialCaseVerification.status).toBe("official_mismatch");
    } else {
      expect(structured.officialCaseVerification.status).toBe("not_verified");
      expect(structured.warnings).toContain("legacy_verification_without_fetch_blocked");
    }
  });

  it("resuelve una referencia DTF real (italiano) normalizandola al mismo prefijo canonico 'BGE'", async () => {
    const entscheidsuche = fakeEntscheidsucheProvider();
    const client = await buildServer({ fedlex: fakeFedlexProvider(), entscheidsuche });
    const result = await client.callTool({
      name: "verify_legal_citation",
      arguments: { citation: "DTF 142 III 1" },
    });
    const structured = result.structuredContent as {
      match: string;
      normalized: string;
      type: string;
    };
    expect(structured.type).toBe("bge_atf_dtf");
    expect(structured.normalized).toBe("BGE 142 III 1");
    expect(structured.match).toBe("probable");
    expect(entscheidsuche.searchByCaseNumber).toHaveBeenCalledWith({ caseNumber: "BGE 142 III 1" });
  });

  it("resuelve 'ambiguous' cuando Fedlex y un canton real (con 'canton' explicito) devuelven candidatos distintos", async () => {
    const cantonalSz = {
      id: "cantonal-sz",
      search: vi.fn(async () => []),
      getDocument: vi.fn(),
      getMetadata: vi.fn(async () => ({})),
      healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
      normalize: vi.fn(),
      getSourceAttribution: vi.fn(),
      searchDocuments: vi.fn(async () => ({
        results: [
          {
            id: "cantonal-sz:220",
            provider: "cantonal-sz",
            documentType: "official_publication" as const,
            jurisdiction: { level: "cantonal" as const, canton: "SZ" },
            sourceOriginalId: "220",
            date: {},
            language: "de" as const,
            title: "Kantonales Gesetz 220",
            provenance: {
              sourceUrl: "https://www.sz.ch/220",
              retrievedAt: "2026-07-28T00:00:00.000Z",
              contentHash: "c".repeat(64),
              officialCharacter: "official" as const,
            },
            rawMetadata: {},
            contentNature: "summary" as const,
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 1 },
        sourceAttribution: {
          sourceUrl: "https://www.sz.ch/220",
          retrievedAt: "2026-07-28T00:00:00.000Z",
          officialCharacter: "official" as const,
        },
        coverageWarnings: [],
      })),
    };
    const client = await buildServer({ fedlex: fakeFedlexProvider(), cantonalSz });
    const result = await client.callTool({
      name: "verify_legal_citation",
      arguments: { citation: "RS 220", canton: "SZ" },
    });
    const structured = result.structuredContent as {
      match: string;
      alternativeCandidates: unknown[];
    };
    expect(structured.match).toBe("ambiguous");
    expect(structured.alternativeCandidates).toHaveLength(2);
  });

  it("sin 'canton' explicito, nunca consulta proveedores cantonales (evita fuerza bruta contra 26 fuentes)", async () => {
    const cantonalSz = {
      id: "cantonal-sz",
      search: vi.fn(async () => []),
      getDocument: vi.fn(),
      getMetadata: vi.fn(async () => ({})),
      healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
      normalize: vi.fn(),
      getSourceAttribution: vi.fn(),
      searchDocuments: vi.fn(async () => ({
        results: [],
        pagination: { page: 1, pageSize: 20, total: 0 },
        sourceAttribution: {
          sourceUrl: "https://www.sz.ch/",
          retrievedAt: "2026-07-28T00:00:00.000Z",
          officialCharacter: "official" as const,
        },
        coverageWarnings: [],
      })),
    };
    const client = await buildServer({ fedlex: fakeFedlexProvider(), cantonalSz });
    await client.callTool({ name: "verify_legal_citation", arguments: { citation: "RS 220" } });
    expect(cantonalSz.searchDocuments).not.toHaveBeenCalled();
  });
});

describe("identify_applicable_version (proveedores falsos, sin red)", () => {
  it("resuelve la version de una ley completa en una fecha real via Fedlex.getLaw", async () => {
    const fedlex = fakeFedlexProvider();
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "identify_applicable_version",
      arguments: { citation: "RS 220", date: "2020-06-15" },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      status: string;
      document: { systematicNumber: string } | null;
    };
    expect(structured.status).toBe("applicable_version_found");
    expect(structured.document?.systematicNumber).toBe("220");
    expect(fedlex.getLaw).toHaveBeenCalledWith({
      systematicNumber: "220",
      language: "de",
      date: "2020-06-15",
    });
  });

  it("resuelve la version de un articulo concreto via Fedlex.getArticleAtDate", async () => {
    const fedlex = fakeFedlexProvider({
      getArticleAtDate: vi.fn(async () => ({
        document: { ...fakeFedlexDoc(), documentType: "legislation_article" as const },
        evidence: {
          chosenEli: "https://fedlex.data.admin.ch/eli/cc/220/20200101",
          reason: "consolidacion vigente en la fecha real solicitada",
        },
        warnings: [],
      })),
    });
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "identify_applicable_version",
      arguments: { citation: "RS 220 art. 41", date: "2020-06-15" },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      status: string;
      article: { articleNumber: string } | null;
      chosenEli: string;
    };
    expect(structured.status).toBe("applicable_version_found");
    expect(structured.article?.articleNumber).toBe("41");
    expect(structured.chosenEli).toBe("https://fedlex.data.admin.ch/eli/cc/220/20200101");
    expect(fedlex.getArticleAtDate).toHaveBeenCalledWith(
      {
        lawRef: { systematicNumber: "220", language: "de", date: "2020-06-15" },
        articleNumber: "41",
      },
      "2020-06-15",
    );
  });

  it.each([
    ["2020-01-01", "covers_requested_date"],
    ["2026-08-03", "covers_requested_date"],
  ])("separa la temporalidad de Art. 29 Abs. 3 BV para %s", async (date, temporalStatus) => {
    const fedlex = fakeFedlexProvider({
      getArticleAtDate: vi.fn(async () => ({
        document: {
          ...fakeFedlexDoc({
            id: "fedlex:101:art-29",
            title: "Bundesverfassung der Schweizerischen Eidgenossenschaft",
            sourceOriginalId: "eli/cc/1999/404",
            legislation: {
              eli: "https://fedlex.data.admin.ch/eli/cc/1999/404",
              systematicNumber: "101",
              workTitle: "BV",
              expressionLanguage: "de" as const,
              version: {
                date: "1999-01-01",
                isHistorical: false,
                structuredFormatAvailable: true,
              },
              inForceStatus: "in_force" as const,
            },
            provenance: {
              sourceUrl: "https://www.fedlex.admin.ch/eli/cc/1999/404/de",
              retrievedAt: "2026-07-28T00:00:00.000Z",
              contentHash: "f".repeat(64),
              officialCharacter: "official" as const,
            },
          }),
          documentType: "legislation_article" as const,
        },
        evidence: {
          chosenEli: "https://fedlex.data.admin.ch/eli/cc/1999/404/19990101",
          reason: "consolidacion vigente en la fecha real solicitada",
        },
        warnings: [],
      })),
    });
    const client = await buildServer({ fedlex });

    const result = await client.callTool({
      name: "identify_applicable_version",
      arguments: { citation: "RS 101 art. 29", date },
    });
    const structured = result.structuredContent as {
      status: string;
      temporalAssessment: {
        source_metadata: { versionDate: string; isHistorical: boolean };
        calculated_temporal_status: string;
        legal_applicability: string;
        future_version_confirmation: string;
        confidence: {
          identity_confidence: number;
          temporal_applicability_confidence: number;
          future_version_confidence: number;
        };
        warnings: string[];
      };
    };

    expect(structured.status).toBe("applicable_version_found");
    expect(structured.temporalAssessment.source_metadata.versionDate).toBe("1999-01-01");
    expect(structured.temporalAssessment.source_metadata.isHistorical).toBe(false);
    expect(structured.temporalAssessment.calculated_temporal_status).toBe(temporalStatus);
    expect(structured.temporalAssessment.legal_applicability).toBe("not_determined");
    expect(structured.temporalAssessment.future_version_confirmation).toBe(
      "no_future_version_confirmed",
    );
    expect(structured.temporalAssessment.confidence.identity_confidence).toBeGreaterThan(
      structured.temporalAssessment.confidence.future_version_confidence,
    );
    expect(structured.temporalAssessment.warnings).toContain(
      "legal_applicability_requires_contextual_legal_review",
    );
  });

  it("no convierte endDate en prueba de version futura sustitutiva", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async () =>
        fakeFedlexDoc({
          legislation: {
            eli: "https://fedlex.data.admin.ch/eli/cc/101",
            systematicNumber: "101",
            workTitle: "BV",
            expressionLanguage: "de" as const,
            version: {
              date: "1999-01-01",
              endDate: "2026-12-31",
              isHistorical: false,
              structuredFormatAvailable: true,
            },
            inForceStatus: "in_force" as const,
          },
        }),
      ),
    });
    const client = await buildServer({ fedlex });

    const result = await client.callTool({
      name: "identify_applicable_version",
      arguments: { citation: "RS 101", date: "2026-08-03" },
    });
    const structured = result.structuredContent as {
      temporalAssessment: {
        future_version_confirmation: string;
        inference: string[];
        warnings: string[];
      };
      warnings: string[];
    };

    expect(structured.temporalAssessment.future_version_confirmation).toBe("not_verified");
    expect(structured.temporalAssessment.inference.join(" ")).toContain("endDate alone");
    expect(structured.warnings).toContain("future_version_not_confirmed_by_endDate_alone");
  });

  it("no usa isHistorical como conclusion juridica automatica para una fecha pasada", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async () =>
        fakeFedlexDoc({
          legislation: {
            eli: "https://fedlex.data.admin.ch/eli/cc/101",
            systematicNumber: "101",
            workTitle: "BV",
            expressionLanguage: "de" as const,
            version: {
              date: "1999-01-01",
              endDate: "2020-12-31",
              isHistorical: true,
              structuredFormatAvailable: true,
            },
            inForceStatus: "not_in_force" as const,
          },
        }),
      ),
    });
    const client = await buildServer({ fedlex });

    const result = await client.callTool({
      name: "identify_applicable_version",
      arguments: { citation: "RS 101", date: "2020-01-01" },
    });
    const structured = result.structuredContent as {
      temporalAssessment: {
        calculated_temporal_status: string;
        legal_applicability: string;
        inference: string[];
      };
    };

    expect(structured.temporalAssessment.calculated_temporal_status).toBe("covers_requested_date");
    expect(structured.temporalAssessment.legal_applicability).toBe("not_determined");
    expect(structured.temporalAssessment.inference.join(" ")).toContain("isHistorical");
  });

  it("marca la aplicabilidad temporal como no determinada cuando la fuente no aporta version", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async () =>
        fakeFedlexDoc({
          legislation: {
            eli: "https://fedlex.data.admin.ch/eli/cc/101",
            systematicNumber: "101",
            workTitle: "BV",
            expressionLanguage: "de" as const,
            inForceStatus: "in_force" as const,
          },
        }),
      ),
    });
    const client = await buildServer({ fedlex });

    const result = await client.callTool({
      name: "identify_applicable_version",
      arguments: { citation: "RS 101", date: "2026-08-03" },
    });
    const structured = result.structuredContent as {
      temporalAssessment: {
        calculated_temporal_status: string;
        legal_applicability: string;
        confidence: { temporal_applicability_confidence: number };
      };
    };

    expect(structured.temporalAssessment.calculated_temporal_status).toBe("not_verified");
    expect(structured.temporalAssessment.legal_applicability).toBe("not_determined");
    expect(structured.temporalAssessment.confidence.temporal_applicability_confidence).toBeLessThan(
      0.5,
    );
  });

  it("devuelve 'insufficient_history' explicito para una cita cantonal (nunca inventa una version)", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const result = await client.callTool({
      name: "identify_applicable_version",
      arguments: { citation: "RS 100.100", date: "2020-06-15", canton: "SZ" },
    });
    const structured = result.structuredContent as { status: string; warnings: string[] };
    expect(structured.status).toBe("insufficient_history");
    expect(structured.warnings.join(" ")).toContain("historial de versiones");
  });

  it("devuelve not_found cuando la cita no tiene numero sistematico", async () => {
    const client = await buildServer({ fedlex: fakeFedlexProvider() });
    const result = await client.callTool({
      name: "identify_applicable_version",
      arguments: { citation: "ATF 142 III 1", date: "2020-06-15" },
    });
    const structured = result.structuredContent as { status: string };
    expect(structured.status).toBe("not_found");
  });

  it("devuelve not_found cuando Fedlex no puede resolver la fecha real (documento inexistente)", async () => {
    const fedlex = fakeFedlexProvider({
      getLaw: vi.fn(async () => {
        throw new Error("no existe ninguna version real para esa fecha");
      }),
    });
    const client = await buildServer({ fedlex });
    const result = await client.callTool({
      name: "identify_applicable_version",
      arguments: { citation: "RS 999.999", date: "1800-01-01" },
    });
    const structured = result.structuredContent as { status: string; warnings: string[] };
    expect(structured.status).toBe("not_found");
    expect(structured.warnings.join(" ")).toContain("no existe ninguna version real");
  });
});
