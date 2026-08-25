import { describe, expect, it } from "vitest";
import { buildEstvDocumentId, mapEstvItemToNormalizedDocument } from "./mapper.js";
import type { EstvListingItem } from "./listingParser.js";

const ITEM: EstvListingItem = {
  title: "Kreisschreiben Nr. 50a: Unzulässigkeit des steuerlichen Abzugs von Bestechungsgeldern",
  description:
    "Unzulässigkeit des steuerlichen Abzugs von Bestechungsgeldern vom 05.12.2023 (Direkte Bundessteuer)",
  downloadUrl: "https://www.estv.admin.ch/dam/de/sd-web/ueIUB1Kh5VCK/dbst-ks-2020-1-050a-d-de.pdf",
  filename: "dbst-ks-2020-1-050a-d-de.pdf",
  circularNumber: "50a",
  issuedDate: "2023-12-05",
  publicationDate: "2023-12-05",
};

describe("buildEstvDocumentId", () => {
  it("deriva el id a partir del nombre de archivo (mas estable que el hash del path DAM)", () => {
    expect(buildEstvDocumentId(ITEM)).toBe("estv:dbst-ks-2020-1-050a-d-de");
  });
});

describe("mapEstvItemToNormalizedDocument", () => {
  it("normaliza un item real a administrative_circular con officialCharacter='official'", () => {
    const doc = mapEstvItemToNormalizedDocument(ITEM, {
      listingUrl: "https://www.estv.admin.ch/de/kreisschreiben-direkten-bundessteuer",
      retrievedAt: "2026-07-27T10:00:00.000Z",
      contentHash: "a".repeat(64),
    });

    expect(doc.documentType).toBe("administrative_circular");
    expect(doc.provider).toBe("estv");
    expect(doc.authority).toBe("ESTV/AFC");
    expect(doc.provenance.officialCharacter).toBe("official");
    expect(doc.administrativeCircular?.administrativeDocumentType).toBe("circular");
    expect(doc.administrativeCircular?.referenceNumber).toBe("Nr. 50a");
    expect(doc.administrativeCircular?.status).toBe("current");
    expect(doc.date.decisionOrEnactment).toBe("2023-12-05");
    expect(doc.date.publicationDate).toBe("2023-12-05");
    expect(doc.summary).toContain("Bestechungsgeldern");
  });

  it("nunca inventa declaredBindingCharacter ni relaciones de sustitucion", () => {
    const doc = mapEstvItemToNormalizedDocument(ITEM, {
      listingUrl: "https://www.estv.admin.ch/de/kreisschreiben-direkten-bundessteuer",
      retrievedAt: "2026-07-27T10:00:00.000Z",
      contentHash: "a".repeat(64),
    });
    expect(doc.administrativeCircular?.declaredBindingCharacter).toBeUndefined();
    expect(doc.administrativeCircular?.supersedesDocuments).toBeUndefined();
    expect(doc.administrativeCircular?.supersededByDocument).toBeUndefined();
  });
});
