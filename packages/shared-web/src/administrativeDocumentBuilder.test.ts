import { describe, expect, it } from "vitest";
import { buildAdministrativeCircularDocument } from "./administrativeDocumentBuilder.js";

function baseInput() {
  return {
    id: "seco:kae",
    provider: "seco",
    authority: "SECO",
    sourceOriginalId: "kae",
    title: "Weisung AVIG KAE (Kurzarbeitsentschadigung)",
    language: "de" as const,
    jurisdiction: { level: "federal" as const },
    fullText: "Texto completo real de la weisung.",
    administrativeCircular: {
      administrativeDocumentType: "practice" as const,
      status: "current" as const,
      referenceNumber: "AVIG-Praxis KAE",
      effectiveDate: "2026-07-01",
    },
    provenance: {
      sourceUrl: "https://www.arbeit.swiss/de/informationszentrum/publikationen",
      downloadUrl: "https://www.arbeit.swiss/api/media/fileservice/x.pdf",
      retrievedAt: new Date().toISOString(),
      contentHash: "a".repeat(64),
    },
  };
}

describe("buildAdministrativeCircularDocument", () => {
  it("construye un NormalizedDocument valido con officialCharacter='official'", () => {
    const doc = buildAdministrativeCircularDocument(baseInput());
    expect(doc.documentType).toBe("administrative_circular");
    expect(doc.provenance.officialCharacter).toBe("official");
    expect(doc.administrativeCircular?.referenceNumber).toBe("AVIG-Praxis KAE");
    expect(doc.contentNature).toBe("literal");
  });

  it("marca contentNature='summary' cuando no hay fullText", () => {
    const input = baseInput();
    const { fullText: _omitted, ...withoutFullText } = input;
    const doc = buildAdministrativeCircularDocument(withoutFullText);
    expect(doc.contentNature).toBe("summary");
    expect(doc.fullText).toBeUndefined();
  });

  it("nunca rellena declaredBindingCharacter ni relaciones de sustitucion si no se pasan", () => {
    const doc = buildAdministrativeCircularDocument(baseInput());
    expect(doc.administrativeCircular?.declaredBindingCharacter).toBeUndefined();
    expect(doc.administrativeCircular?.supersedesDocuments).toBeUndefined();
    expect(doc.administrativeCircular?.supersededByDocument).toBeUndefined();
  });

  it("propaga rawMetadata cuando se proporciona", () => {
    const input = { ...baseInput(), rawMetadata: { footerReference: "1-050a-D-2023-d" } };
    const doc = buildAdministrativeCircularDocument(input);
    expect(doc.rawMetadata).toEqual({ footerReference: "1-050a-D-2023-d" });
  });
});
