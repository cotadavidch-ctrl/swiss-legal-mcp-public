import { describe, expect, it } from "vitest";
import {
  FedlexMappingError,
  mapFedlexArticleToNormalizedDocument,
  mapFedlexLawToNormalizedDocument,
  type FedlexLawMappingInput,
} from "./mapper.js";

function baseInput(overrides: Partial<FedlexLawMappingInput> = {}): FedlexLawMappingInput {
  return {
    workEli: "https://fedlex.data.admin.ch/eli/cc/1999/404",
    workTitle: "Bundesverfassung der Schweizerischen Eidgenossenschaft vom 18. April 1999",
    systematicNumber: "101",
    consolidation: {
      consolidationEli: "https://fedlex.data.admin.ch/eli/cc/1999/404/20240303",
      dateApplicability: "2024-03-03",
    },
    isHistorical: false,
    language: "de",
    entryIntoForceDate: "2000-01-01",
    inForceStatus: "in_force",
    manifestation: {
      format: "xml",
      url: "https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1999/404/20240303/de/xml/fedlex-data-admin-ch-eli-cc-1999-404-20240303-de-xml-10.xml",
    },
    structuredFormatAvailable: true,
    retrievedAt: "2026-07-26T00:00:00.000Z",
    ...overrides,
  };
}

describe("mapFedlexLawToNormalizedDocument (Constitucion federal real)", () => {
  it("mapea la version vigente (2024-03-03) con todos los campos reales", () => {
    const doc = mapFedlexLawToNormalizedDocument(baseInput());

    expect(doc.provider).toBe("fedlex");
    expect(doc.documentType).toBe("legislation_law");
    expect(doc.jurisdiction).toEqual({ level: "federal" });
    expect(doc.language).toBe("de");
    expect(doc.legislation?.systematicNumber).toBe("101");
    expect(doc.legislation?.workTitle).toBe(
      "Bundesverfassung der Schweizerischen Eidgenossenschaft vom 18. April 1999",
    );
    expect(doc.legislation?.version.date).toBe("2024-03-03");
    expect(doc.legislation?.version.isHistorical).toBe(false);
    expect(doc.legislation?.version.structuredFormatAvailable).toBe(true);
    expect(doc.legislation?.inForceStatus).toBe("in_force");
    expect(doc.legislation?.manifestation?.format).toBe("xml");
    expect(doc.provenance.officialCharacter).toBe("official");
    expect(doc.provenance.officialSourceUrl).toBeDefined();
  });

  it("mapea la version historica (2000-01-01) sin manifestacion estructurada", () => {
    const doc = mapFedlexLawToNormalizedDocument(
      baseInput({
        consolidation: {
          consolidationEli: "https://fedlex.data.admin.ch/eli/cc/1999/404/20000101",
          dateApplicability: "2000-01-01",
          dateEndApplicability: "2001-06-09",
        },
        isHistorical: true,
        structuredFormatAvailable: false,
        manifestation: {
          format: "pdf",
          url: "https://fedlex.data.admin.ch/filestore/some-real-pdf.pdf",
        },
      }),
    );

    expect(doc.legislation?.version.isHistorical).toBe(true);
    expect(doc.legislation?.version.structuredFormatAvailable).toBe(false);
    expect(doc.legislation?.version.endDate).toBe("2001-06-09");
    expect(doc.legislation?.manifestation?.format).toBe("pdf");
  });

  it("mapea la KVG derogada de 1911 (RS 832.10 ambiguo) con repealDate real", () => {
    const doc = mapFedlexLawToNormalizedDocument(
      baseInput({
        workEli: "https://fedlex.data.admin.ch/eli/cc/28/353_351_341",
        workTitle: "Bundesgesetz betreffend die Kranken- und Unfallversicherung",
        systematicNumber: "832.10",
        consolidation: {
          consolidationEli: "https://fedlex.data.admin.ch/eli/cc/28/353_351_341/19110613",
          dateApplicability: "1911-06-13",
          dateEndApplicability: "1996-01-01",
        },
        isHistorical: true,
        entryIntoForceDate: "1911-06-13",
        repealDate: "1996-01-01",
        inForceStatus: "no_longer_in_force",
        structuredFormatAvailable: false,
        manifestation: undefined,
      }),
    );

    expect(doc.legislation?.inForceStatus).toBe("no_longer_in_force");
    expect(doc.legislation?.repealDate).toBe("1996-01-01");
    expect(doc.legislation?.manifestation).toBeUndefined();
  });

  it("rechaza un workTitle vacio en vez de aceptar un documento sin titulo real", () => {
    expect(() => mapFedlexLawToNormalizedDocument(baseInput({ workTitle: "  " }))).toThrow(
      FedlexMappingError,
    );
  });
});

describe("mapFedlexArticleToNormalizedDocument (Art. 1 real de la Constitucion)", () => {
  it("mapea un articulo con texto literal extraido del Akoma Ntoso real", () => {
    const doc = mapFedlexArticleToNormalizedDocument({
      ...baseInput(),
      articleNumber: "1",
      articleText:
        "Das Schweizervolk und die Kantone Zürich, Bern, Luzern... bilden die Schweizerische Eidgenossenschaft.",
    });

    expect(doc.documentType).toBe("legislation_article");
    expect(doc.legislation?.articleLocation?.articleNumber).toBe("1");
    expect(doc.fullText).toContain("Schweizerische Eidgenossenschaft");
    expect(doc.title).toContain("Art. 1");
  });

  it("incluye el heading real cuando esta presente", () => {
    const doc = mapFedlexArticleToNormalizedDocument({
      ...baseInput(),
      articleNumber: "104a",
      articleHeading: "Ernährungssicherheit",
      articleText: "Der Bund schafft Voraussetzungen für...",
    });
    expect(doc.title).toContain("Ernährungssicherheit");
  });

  it("rechaza un texto de articulo vacio", () => {
    expect(() =>
      mapFedlexArticleToNormalizedDocument({
        ...baseInput(),
        articleNumber: "9999",
        articleText: "  ",
      }),
    ).toThrow(FedlexMappingError);
  });
});
