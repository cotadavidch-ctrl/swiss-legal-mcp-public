import { describe, expect, it, vi } from "vitest";
import { LegislationProviderRegistry, type LegislationProvider } from "@swiss-legal-mcp/core";
import type { NormalizedDocument } from "@swiss-legal-mcp/documents";
import { parseCitations } from "./parser.js";
import {
  resolveCitation,
  type CantonalCitationLookupPort,
  type CaseLawCitationLookupPort,
} from "./resolver.js";

function fakeDocument(id: string, title: string): NormalizedDocument {
  return {
    id,
    provider: "fedlex",
    documentType: "legislation_law",
    jurisdiction: { level: "federal" },
    sourceOriginalId: id,
    date: {},
    language: "de",
    title,
    provenance: {
      sourceUrl: `https://fedlex.example.test/${id}`,
      retrievedAt: "2026-07-28T00:00:00.000Z",
      contentHash: "a".repeat(64),
      officialCharacter: "official",
    },
    rawMetadata: {},
    contentNature: "summary",
    legislation: {
      eli: `https://fedlex.example.test/eli/${id}`,
      systematicNumber: "220",
      workTitle: title,
      expressionLanguage: "de",
      version: { date: "2020-01-01", isHistorical: false, structuredFormatAvailable: true },
      inForceStatus: "in_force",
    },
  };
}

function fakeFedlexProvider(overrides: Partial<LegislationProvider> = {}): LegislationProvider {
  return {
    id: "fedlex",
    capabilities: {
      fullTextSearch: false,
      searchByTitle: false,
      searchByAbbreviation: false,
      searchBySystematicNumber: true,
      searchByEli: true,
      getCurrentVersion: true,
      getHistoricalVersion: true,
      compareVersions: true,
      getArticle: true,
      getArticleAtDate: true,
      amendmentHistory: true,
      transitionalProvisions: false,
      entryIntoForce: true,
      repealInformation: true,
      multilingual: true,
      rdf: true,
      xml: true,
      akomaNtoso: true,
      html: true,
      pdf: true,
    },
    searchLegislation: vi.fn(async () => ({
      items: [],
      pagination: { page: 1, pageSize: 20 },
      appliedFilters: {},
      officialAttribution: {
        sourceUrl: "https://fedlex.example.test/sparqlendpoint",
        officialCharacter: "official" as const,
      },
      capabilities: {} as LegislationProvider["capabilities"],
      warnings: [],
    })),
    getLaw: vi.fn(async () => fakeDocument("220", "Code des obligations")),
    getArticle: vi.fn(async () => fakeDocument("220#1", "Art. 1")),
    getArticleAtDate: vi.fn(),
    compareArticleVersions: vi.fn(),
    getAmendmentHistory: vi.fn(async () => []),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
    ...overrides,
  };
}

function buildRegistry(provider: LegislationProvider): LegislationProviderRegistry {
  const registry = new LegislationProviderRegistry();
  registry.register(
    {
      id: "fedlex",
      provider,
      officialCharacter: "official",
      jurisdictions: ["federal"],
      enabledInEnv: ["test"],
    },
    "test",
  );
  return registry;
}

describe("resolveCitation: systematic_number", () => {
  it("resuelve exact cuando Fedlex devuelve un unico resultado real", async () => {
    const provider = fakeFedlexProvider({
      searchLegislation: vi.fn(async () => ({
        items: [
          {
            id: "220",
            eli: "https://fedlex.example.test/eli/220",
            title: "Code des obligations",
            systematicNumber: "220",
            language: "de" as const,
            inForceStatus: "in_force",
          },
        ],
        pagination: { page: 1, pageSize: 20 },
        appliedFilters: {},
        officialAttribution: {
          sourceUrl: "https://fedlex.example.test/sparqlendpoint",
          officialCharacter: "official" as const,
        },
        capabilities: {} as LegislationProvider["capabilities"],
        warnings: [],
      })),
    });
    const [citation] = parseCitations("RS 220");
    const resolution = await resolveCitation(citation!, {
      legislationProviders: buildRegistry(provider),
    });
    expect(resolution.match).toBe("exact");
    expect(resolution.document?.title).toBe("Code des obligations");
    expect(resolution.evidence[0]?.providerConsulted).toBe("fedlex");
  });

  it("resuelve not_found cuando ninguna fuente real devuelve resultados", async () => {
    const provider = fakeFedlexProvider();
    const [citation] = parseCitations("RS 999.999");
    const resolution = await resolveCitation(citation!, {
      legislationProviders: buildRegistry(provider),
    });
    expect(resolution.match).toBe("not_found");
    expect(resolution.warnings.join(" ")).toContain("ninguna fuente real");
  });

  it("resuelve ambiguous cuando Fedlex y un canton real devuelven candidatos distintos", async () => {
    const provider = fakeFedlexProvider({
      searchLegislation: vi.fn(async () => ({
        items: [
          {
            id: "220",
            eli: "https://fedlex.example.test/eli/220",
            title: "Code des obligations",
            systematicNumber: "220",
            language: "de" as const,
            inForceStatus: "in_force",
          },
        ],
        pagination: { page: 1, pageSize: 20 },
        appliedFilters: {},
        officialAttribution: {
          sourceUrl: "https://fedlex.example.test/sparqlendpoint",
          officialCharacter: "official" as const,
        },
        capabilities: {} as LegislationProvider["capabilities"],
        warnings: [],
      })),
    });
    const cantonalLookup: CantonalCitationLookupPort = {
      resolveBySystematicNumber: vi.fn(async () => [
        {
          document: fakeDocument("cantonal-sz:220", "Ley cantonal 220"),
          providerId: "cantonal-sz",
        },
      ]),
    };
    const [citation] = parseCitations("RS 220");
    const resolution = await resolveCitation(citation!, {
      legislationProviders: buildRegistry(provider),
      cantonalLookup,
    });
    expect(resolution.match).toBe("ambiguous");
    expect(resolution.alternativeCandidates).toHaveLength(2);
    expect(resolution.warnings.join(" ")).toContain("ambiguo");
  });

  it("nunca convierte un candidato cantonal unico (sin ELI) en 'exact', solo en 'probable'", async () => {
    const cantonalLookup: CantonalCitationLookupPort = {
      resolveBySystematicNumber: vi.fn(async () => [
        {
          document: fakeDocument("cantonal-sz:100.100", "Verfassung SZ"),
          providerId: "cantonal-sz",
        },
      ]),
    };
    const [citation] = parseCitations("RS 100.100");
    const resolution = await resolveCitation(citation!, {
      legislationProviders: buildRegistry(fakeFedlexProvider()),
      cantonalLookup,
    });
    expect(resolution.match).toBe("probable");
  });
});

describe("resolveCitation: bge_atf_dtf y case_number", () => {
  it("resuelve probable con un unico resultado real de entscheidsuche", async () => {
    const caseLawLookup: CaseLawCitationLookupPort = {
      resolveByReference: vi.fn(async () => [
        {
          document: fakeDocument("entscheidsuche:1", "ATF 142 III 1"),
          providerId: "entscheidsuche",
        },
      ]),
    };
    const [citation] = parseCitations("ATF 142 III 1");
    const resolution = await resolveCitation(citation!, { caseLawLookup });
    expect(resolution.match).toBe("probable");
    expect(caseLawLookup.resolveByReference).toHaveBeenCalledWith("BGE 142 III 1");
  });

  it("resuelve ambiguous cuando la busqueda real devuelve varias sentencias que citan la misma referencia", async () => {
    const caseLawLookup: CaseLawCitationLookupPort = {
      resolveByReference: vi.fn(async () => [
        { document: fakeDocument("e:1", "Sentencia A"), providerId: "entscheidsuche" },
        { document: fakeDocument("e:2", "Sentencia B"), providerId: "entscheidsuche" },
      ]),
    };
    const [citation] = parseCitations("6B_1234/2025");
    const resolution = await resolveCitation(citation!, { caseLawLookup });
    expect(resolution.match).toBe("ambiguous");
    expect(resolution.alternativeCandidates).toHaveLength(2);
  });

  it("resuelve not_found sin caseLawLookup configurado (no inventa un proveedor)", async () => {
    const [citation] = parseCitations("ATF 142 III 1");
    const resolution = await resolveCitation(citation!, {});
    expect(resolution.match).toBe("not_found");
    expect(resolution.warnings.join(" ")).toContain("No hay ningun proveedor");
  });
});

describe("resolveCitation: ecli", () => {
  it("nunca verifica un ECLI: siempre not_found con advertencia explicita, sin intentar ningun proveedor", async () => {
    const [citation] = parseCitations("ECLI:CH:BGer:2020:6B_1234_2019");
    const resolution = await resolveCitation(citation!, {});
    expect(resolution.match).toBe("not_found");
    expect(resolution.evidence).toHaveLength(0);
    expect(resolution.warnings.join(" ")).toContain("ningun tribunal suizo indexado");
  });
});

describe("resolveCitation: unresolvable (solo abreviatura)", () => {
  it("declina resolver una cita por abreviatura y explica por que (searchByAbbreviation=false)", async () => {
    const [citation] = parseCitations("art. 41 CO");
    const resolution = await resolveCitation(citation!, {});
    expect(resolution.match).toBe("not_found");
    expect(resolution.warnings.join(" ")).toContain("searchByAbbreviation");
  });
});
