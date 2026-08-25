import { describe, expect, it } from "vitest";
import { parseNormalizedDocument } from "./normalizedDocument.js";
import { computeContentHash } from "./contentHash.js";
import { parseArticleVersionComparison } from "./articleComparison.js";

function validFixture() {
  return {
    id: "fixture:1",
    provider: "fixture",
    documentType: "case" as const,
    jurisdiction: { level: "federal" as const },
    sourceOriginalId: "fixture-1",
    date: { decisionOrEnactment: "2024-01-15" },
    language: "de" as const,
    title: "Sentencia de prueba",
    fullText: "Texto literal completo.",
    provenance: {
      sourceUrl: "https://example.test/fixture-1",
      retrievedAt: "2026-07-25T00:00:00.000Z",
      contentHash: computeContentHash("Texto literal completo."),
      officialCharacter: "official" as const,
    },
    contentNature: "literal" as const,
  };
}

describe("normalizedDocumentSchema", () => {
  it("acepta un documento federal valido", () => {
    const doc = parseNormalizedDocument(validFixture());
    expect(doc.id).toBe("fixture:1");
    expect(doc.rawMetadata).toEqual({});
  });

  it("rechaza jurisdiccion cantonal sin canton", () => {
    const fixture = validFixture();
    fixture.jurisdiction = { level: "cantonal" } as never;
    expect(() => parseNormalizedDocument(fixture)).toThrow();
  });

  it("rechaza fullText literal con contentNature distinto de literal", () => {
    const fixture = validFixture();
    (fixture as { contentNature: string }).contentNature = "summary";
    expect(() => parseNormalizedDocument(fixture)).toThrow();
  });

  it("exige aggregatorName cuando officialCharacter es unofficial_aggregator", () => {
    const fixture = validFixture();
    (fixture as { provenance: Record<string, unknown> }).provenance = {
      ...fixture.provenance,
      officialCharacter: "unofficial_aggregator",
    };
    expect(() => parseNormalizedDocument(fixture)).toThrow();
  });

  it("acepta unofficial_aggregator con aggregatorName y aggregatorUrl", () => {
    const fixture = validFixture();
    (fixture as { provenance: Record<string, unknown> }).provenance = {
      ...fixture.provenance,
      officialCharacter: "unofficial_aggregator",
      aggregatorName: "entscheidsuche.ch",
      aggregatorUrl: "https://mcp.entscheidsuche.ch/case/1",
    };
    const doc = parseNormalizedDocument(fixture);
    expect(doc.provenance.aggregatorName).toBe("entscheidsuche.ch");
    expect(doc.provenance.aggregatorUrl).toBe("https://mcp.entscheidsuche.ch/case/1");
  });

  it("rechaza unofficial_aggregator sin aggregatorUrl", () => {
    const fixture = validFixture();
    (fixture as { provenance: Record<string, unknown> }).provenance = {
      ...fixture.provenance,
      officialCharacter: "unofficial_aggregator",
      aggregatorName: "entscheidsuche.ch",
    };
    expect(() => parseNormalizedDocument(fixture)).toThrow();
  });

  it("acepta officialSourceUrl junto a aggregatorUrl cuando ambos se conocen", () => {
    const fixture = validFixture();
    (fixture as { provenance: Record<string, unknown> }).provenance = {
      ...fixture.provenance,
      officialCharacter: "unofficial_aggregator",
      aggregatorName: "entscheidsuche.ch",
      aggregatorUrl: "https://mcp.entscheidsuche.ch/case/1",
      officialSourceUrl: "https://www.bger.ch/some-real-decision",
    };
    const doc = parseNormalizedDocument(fixture);
    expect(doc.provenance.officialSourceUrl).toBe("https://www.bger.ch/some-real-decision");
  });
});

function validLegislationLawFixture() {
  return {
    id: "fedlex:eli/cc/1999/404/20240303/de",
    provider: "fedlex",
    documentType: "legislation_law" as const,
    jurisdiction: { level: "federal" as const },
    sourceOriginalId: "eli/cc/1999/404/20240303/de",
    date: { inForceFrom: "2024-03-03" },
    language: "de" as const,
    title: "Bundesverfassung der Schweizerischen Eidgenossenschaft",
    fullText: "Art. 1 ...",
    legislation: {
      eli: "https://fedlex.data.admin.ch/eli/cc/1999/404/20240303/de",
      systematicNumber: "101",
      workTitle: "Bundesverfassung der Schweizerischen Eidgenossenschaft",
      expressionLanguage: "de" as const,
      version: {
        date: "2024-03-03",
        isHistorical: false,
        structuredFormatAvailable: true,
      },
      manifestation: {
        format: "xml" as const,
        url: "https://fedlex.data.admin.ch/filestore/some-real-file.xml",
      },
      inForceStatus: "in_force" as const,
      entryIntoForceDate: "2000-01-01",
    },
    provenance: {
      sourceUrl: "https://www.fedlex.admin.ch/eli/cc/1999/404/de",
      retrievedAt: "2026-07-26T00:00:00.000Z",
      contentHash: computeContentHash("Art. 1 ..."),
      officialCharacter: "official" as const,
    },
    contentNature: "literal" as const,
  };
}

describe("normalizedDocumentSchema (legislacion, Fase 3)", () => {
  it("acepta legislation_law con bloque legislation completo", () => {
    const doc = parseNormalizedDocument(validLegislationLawFixture());
    expect(doc.legislation?.systematicNumber).toBe("101");
  });

  it("rechaza legislation_law sin bloque legislation", () => {
    const fixture = validLegislationLawFixture();
    delete (fixture as { legislation?: unknown }).legislation;
    expect(() => parseNormalizedDocument(fixture)).toThrow();
  });

  it("rechaza documentType 'case' con bloque legislation presente", () => {
    const fixture = { ...validLegislationLawFixture(), documentType: "case" as const };
    expect(() => parseNormalizedDocument(fixture)).toThrow();
  });

  it("rechaza legislation_law con articleLocation (eso corresponde a legislation_article)", () => {
    const fixture = validLegislationLawFixture();
    (fixture as { legislation: Record<string, unknown> }).legislation = {
      ...fixture.legislation,
      articleLocation: { articleNumber: "1" },
    };
    expect(() => parseNormalizedDocument(fixture)).toThrow();
  });

  it("acepta legislation_article con articleLocation", () => {
    const fixture = validLegislationLawFixture();
    const doc = parseNormalizedDocument({
      ...fixture,
      documentType: "legislation_article" as const,
      legislation: {
        ...fixture.legislation,
        articleLocation: { articleNumber: "1", paragraph: "1" },
      } as Record<string, unknown>,
    });
    expect(doc.legislation?.articleLocation?.articleNumber).toBe("1");
  });

  it("rechaza legislation_article sin articleLocation", () => {
    const fixture = validLegislationLawFixture();
    expect(() =>
      parseNormalizedDocument({ ...fixture, documentType: "legislation_article" as const }),
    ).toThrow();
  });
});

describe("articleVersionComparisonSchema", () => {
  it("acepta una comparacion literal valida", () => {
    const comparison = parseArticleVersionComparison({
      articleNumber: "1",
      language: "de",
      before: {
        eli: "https://fedlex.data.admin.ch/eli/cc/1999/404/20000101/de",
        date: "2000-01-01",
        text: "Texto anterior.",
      },
      after: {
        eli: "https://fedlex.data.admin.ch/eli/cc/1999/404/20240303/de",
        date: "2024-03-03",
        text: "Texto posterior.",
      },
      changes: [{ kind: "modified", beforeText: "Texto anterior.", afterText: "Texto posterior." }],
      comparisonNature: "literal",
    });
    expect(comparison.comparisonNature).toBe("literal");
  });

  it("rechaza un kind de cambio invalido", () => {
    expect(() =>
      parseArticleVersionComparison({
        articleNumber: "1",
        language: "de",
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
        changes: [{ kind: "rewritten", afterText: "b" }],
        comparisonNature: "literal",
      }),
    ).toThrow();
  });
});

function validAdministrativeCircularFixture() {
  return {
    id: "seco:kreisschreiben-alv-2024-01",
    provider: "seco",
    documentType: "administrative_circular" as const,
    jurisdiction: { level: "federal" as const },
    authority: "SECO",
    sourceOriginalId: "AVIG-Praxis-ALE-C1",
    date: { publicationDate: "2024-01-01" },
    language: "de" as const,
    title: "Kreisschreiben über die Arbeitslosenentschädigung (AVIG-Praxis ALE), Kapitel C1",
    fullText: "Ziff. 1: ...",
    administrativeCircular: {
      administrativeDocumentType: "circular" as const,
      referenceNumber: "ALE-C1",
      status: "current" as const,
    },
    provenance: {
      sourceUrl: "https://www.arbeit.swiss/secoalv/de/home/service/publikationen.html",
      retrievedAt: "2026-07-26T00:00:00.000Z",
      contentHash: computeContentHash("Ziff. 1: ..."),
      officialCharacter: "official" as const,
    },
    contentNature: "literal" as const,
  };
}

describe("normalizedDocumentSchema (administrative_circular, Fase 4)", () => {
  it("acepta administrative_circular con bloque administrativeCircular completo", () => {
    const doc = parseNormalizedDocument(validAdministrativeCircularFixture());
    expect(doc.administrativeCircular?.administrativeDocumentType).toBe("circular");
    expect(doc.administrativeCircular?.status).toBe("current");
  });

  it("rechaza administrative_circular sin bloque administrativeCircular", () => {
    const fixture = validAdministrativeCircularFixture();
    delete (fixture as { administrativeCircular?: unknown }).administrativeCircular;
    expect(() => parseNormalizedDocument(fixture)).toThrow();
  });

  it("rechaza documentType 'case' con bloque administrativeCircular presente", () => {
    const fixture = { ...validAdministrativeCircularFixture(), documentType: "case" as const };
    expect(() => parseNormalizedDocument(fixture)).toThrow();
  });

  it("nunca infiere caracter vinculante: declaredBindingCharacter ausente por defecto", () => {
    const doc = parseNormalizedDocument(validAdministrativeCircularFixture());
    expect(doc.administrativeCircular?.declaredBindingCharacter).toBeUndefined();
  });

  it("acepta declaredBindingCharacter solo cuando se declara explicitamente", () => {
    const fixture = validAdministrativeCircularFixture();
    const doc = parseNormalizedDocument({
      ...fixture,
      administrativeCircular: {
        ...fixture.administrativeCircular,
        declaredBindingCharacter: "administrative_guidance_only" as const,
      },
    });
    expect(doc.administrativeCircular?.declaredBindingCharacter).toBe(
      "administrative_guidance_only",
    );
  });

  it("acepta un documento sustituido con referencia al documento sustitutorio", () => {
    const fixture = validAdministrativeCircularFixture();
    const doc = parseNormalizedDocument({
      ...fixture,
      administrativeCircular: {
        ...fixture.administrativeCircular,
        status: "superseded" as const,
        supersededByDocument: "AVIG-Praxis-ALE-C1-2025",
        supersededDate: "2025-01-01",
      },
    });
    expect(doc.administrativeCircular?.status).toBe("superseded");
    expect(doc.administrativeCircular?.supersededByDocument).toBe("AVIG-Praxis-ALE-C1-2025");
  });

  it("rechaza un administrativeDocumentType no reconocido", () => {
    const fixture = validAdministrativeCircularFixture();
    expect(() =>
      parseNormalizedDocument({
        ...fixture,
        administrativeCircular: {
          ...fixture.administrativeCircular,
          administrativeDocumentType: "law",
        },
      }),
    ).toThrow();
  });
});

function validShabPublicationFixture() {
  return {
    id: "shab:HR02-1006716804",
    provider: "shab",
    documentType: "shab_entry" as const,
    jurisdiction: { level: "federal" as const },
    authority: "SHAB",
    sourceOriginalId: "6eda8016-3fb4-48e6-8eba-599cb35b3c95",
    date: { publicationDate: "2026-07-27" },
    language: "de" as const,
    title: "Mutation AD Astra Research AG, Zug",
    shabPublication: {
      publicationNumber: "HR02-1006716804",
      rubric: "HR",
      subRubric: "HR02",
      publicationState: "published" as const,
      cantons: ["ZG"],
    },
    provenance: {
      sourceUrl: "https://www.shab.ch/api/v1/publications",
      retrievedAt: "2026-07-27T00:00:00.000Z",
      contentHash: computeContentHash("Mutation AD Astra Research AG, Zug"),
      officialCharacter: "official" as const,
    },
    contentNature: "summary" as const,
  };
}

describe("normalizedDocumentSchema (shab_entry, Fase 5)", () => {
  it("acepta shab_entry con bloque shabPublication completo", () => {
    const doc = parseNormalizedDocument(validShabPublicationFixture());
    expect(doc.shabPublication?.rubric).toBe("HR");
    expect(doc.shabPublication?.publicationState).toBe("published");
    expect(doc.shabPublication?.cantons).toEqual(["ZG"]);
  });

  it("rechaza shab_entry sin bloque shabPublication", () => {
    const fixture = validShabPublicationFixture();
    delete (fixture as { shabPublication?: unknown }).shabPublication;
    expect(() => parseNormalizedDocument(fixture)).toThrow();
  });

  it("rechaza documentType 'case' con bloque shabPublication presente", () => {
    const fixture = { ...validShabPublicationFixture(), documentType: "case" as const };
    expect(() => parseNormalizedDocument(fixture)).toThrow();
  });

  it("nunca infiere entidad afectada ni relaciones: ausentes por defecto", () => {
    const doc = parseNormalizedDocument(validShabPublicationFixture());
    expect(doc.shabPublication?.affectedEntity).toBeUndefined();
    expect(doc.shabPublication?.relatedPublicationIds).toBeUndefined();
  });

  it("acepta affectedEntity de tipo 'person' solo cuando se declara explicitamente (rubrica KK)", () => {
    const fixture = validShabPublicationFixture();
    const doc = parseNormalizedDocument({
      ...fixture,
      shabPublication: {
        ...fixture.shabPublication,
        rubric: "KK",
        subRubric: "KK04",
        affectedEntity: { type: "person" as const, displayName: "REDACTED" },
      },
    });
    expect(doc.shabPublication?.affectedEntity?.type).toBe("person");
  });

  it("rechaza un publicationState no reconocido", () => {
    const fixture = validShabPublicationFixture();
    expect(() =>
      parseNormalizedDocument({
        ...fixture,
        shabPublication: { ...fixture.shabPublication, publicationState: "draft" },
      }),
    ).toThrow();
  });
});

describe("computeContentHash", () => {
  it("es deterministico", () => {
    expect(computeContentHash("abc")).toBe(computeContentHash("abc"));
  });

  it("cambia si el contenido cambia", () => {
    expect(computeContentHash("abc")).not.toBe(computeContentHash("abd"));
  });
});
