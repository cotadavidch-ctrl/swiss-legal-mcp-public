import { describe, expect, it } from "vitest";
import { buildSecoDocumentId, mapSecoItemToNormalizedDocument } from "./mapper.js";
import type { SecoListingItem } from "./listingParser.js";

const ITEM: SecoListingItem = {
  title: "Weisung AVIG KAE (Kurzarbeitsentschädigung) (AVIG-Praxis KAE) gültig ab 1.7.2026",
  downloadUrl:
    "https://www.arbeit.swiss/api/media/fileservice/sdweb-docs-prod-arbeitswiss-files/files/2026/06/24/f134ea35-f4ff-4127-88de-1dca50b0267d.pdf",
  publicationDate: "2026-06-25",
};

describe("buildSecoDocumentId", () => {
  it("deriva un id estable a partir del idioma y el path de descarga", () => {
    const id = buildSecoDocumentId("de", ITEM.downloadUrl);
    expect(id).toBe("seco:de:f134ea35-f4ff-4127-88de-1dca50b0267d");
  });
});

describe("mapSecoItemToNormalizedDocument", () => {
  it("normaliza un item real a administrative_circular con officialCharacter='official'", () => {
    const doc = mapSecoItemToNormalizedDocument(ITEM, {
      language: "de",
      listingUrl: "https://www.arbeit.swiss/de/informationszentrum/publikationen",
      retrievedAt: "2026-07-26T10:00:00.000Z",
      contentHash: "a".repeat(64),
    });

    expect(doc.documentType).toBe("administrative_circular");
    expect(doc.provider).toBe("seco");
    expect(doc.authority).toBe("SECO");
    expect(doc.provenance.officialCharacter).toBe("official");
    expect(doc.provenance.downloadUrl).toBe(ITEM.downloadUrl);
    expect(doc.administrativeCircular?.administrativeDocumentType).toBe("practice");
    expect(doc.administrativeCircular?.referenceNumber).toBe("AVIG-Praxis KAE");
    expect(doc.administrativeCircular?.effectiveDate).toBe("2026-07-01");
    expect(doc.administrativeCircular?.status).toBe("current");
    expect(doc.date.inForceFrom).toBe("2026-07-01");
    expect(doc.date.publicationDate).toBe("2026-06-25");
    expect(doc.contentNature).toBe("summary");
    expect(doc.fullText).toBeUndefined();
  });

  it("marca contentNature='literal' cuando se incluye el texto completo del PDF", () => {
    const doc = mapSecoItemToNormalizedDocument(ITEM, {
      language: "de",
      listingUrl: "https://www.arbeit.swiss/de/informationszentrum/publikationen",
      retrievedAt: "2026-07-26T10:00:00.000Z",
      contentHash: "a".repeat(64),
      fullText: "Texto real completo del PDF de 111 paginas.",
    });
    expect(doc.contentNature).toBe("literal");
    expect(doc.fullText).toContain("111 paginas");
  });

  it("nunca inventa declaredBindingCharacter ni relaciones de sustitucion", () => {
    const doc = mapSecoItemToNormalizedDocument(ITEM, {
      language: "de",
      listingUrl: "https://www.arbeit.swiss/de/informationszentrum/publikationen",
      retrievedAt: "2026-07-26T10:00:00.000Z",
      contentHash: "a".repeat(64),
    });
    expect(doc.administrativeCircular?.declaredBindingCharacter).toBeUndefined();
    expect(doc.administrativeCircular?.supersedesDocuments).toBeUndefined();
    expect(doc.administrativeCircular?.supersededByDocument).toBeUndefined();
  });
});
