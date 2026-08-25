import { describe, expect, it } from "vitest";
import { buildBsvDocumentId, mapBsvVersionToNormalizedDocument } from "./mapper.js";
import type { BsvVersionDetail } from "./documentPageParser.js";

const CURRENT_VERSION: BsvVersionDetail = {
  version: 6,
  documentNumber: "318.507.31",
  changedDate: "2026-07-14",
  downloadUrl: "https://sozialversicherungen.admin.ch/de/d/18452/download",
  isCurrent: true,
  effectiveDate: "2022-01-01",
  standDate: "2026-01-01",
  freeText: "Kreisschreiben über Invalidität und Rente (KSIR) (gültig ab 1.1.2022; Stand 1.1.2026)",
};

const HISTORICAL_VERSION: BsvVersionDetail = {
  ...CURRENT_VERSION,
  version: 5,
  isCurrent: false,
  downloadUrl: "https://sozialversicherungen.admin.ch/de/d/18452/download?version=5",
  standDate: "2025-01-01",
};

describe("buildBsvDocumentId", () => {
  it("id sin sufijo de version para la version vigente", () => {
    expect(buildBsvDocumentId("18452", 6, true)).toBe("bsv:18452");
  });

  it("id con sufijo :vN para una version historica", () => {
    expect(buildBsvDocumentId("18452", 5, false)).toBe("bsv:18452:v5");
  });
});

describe("mapBsvVersionToNormalizedDocument", () => {
  it("normaliza la version vigente con status='current'", () => {
    const doc = mapBsvVersionToNormalizedDocument(CURRENT_VERSION, {
      docId: "18452",
      abbreviation: "KSIR",
      description: CURRENT_VERSION.freeText,
      folderUrl: "https://sozialversicherungen.admin.ch/de/f/5661",
      retrievedAt: "2026-07-26T10:00:00.000Z",
      contentHash: "a".repeat(64),
    });

    expect(doc.id).toBe("bsv:18452");
    expect(doc.documentType).toBe("administrative_circular");
    expect(doc.provenance.officialCharacter).toBe("official");
    expect(doc.administrativeCircular?.status).toBe("current");
    expect(doc.administrativeCircular?.referenceNumber).toBe("318.507.31");
    expect(doc.administrativeCircular?.version).toBe("6");
    expect(doc.administrativeCircular?.effectiveDate).toBe("2022-01-01");
    expect(doc.date.inForceFrom).toBe("2022-01-01");
    expect(doc.rawMetadata["standDate"]).toBe("2026-01-01");
  });

  it("normaliza una version historica con status='superseded' (por version, no por sustitucion inter-documento)", () => {
    const doc = mapBsvVersionToNormalizedDocument(HISTORICAL_VERSION, {
      docId: "18452",
      abbreviation: "KSIR",
      description: HISTORICAL_VERSION.freeText,
      folderUrl: "https://sozialversicherungen.admin.ch/de/f/5661",
      retrievedAt: "2026-07-26T10:00:00.000Z",
      contentHash: "b".repeat(64),
    });
    expect(doc.id).toBe("bsv:18452:v5");
    expect(doc.administrativeCircular?.status).toBe("superseded");
    expect(doc.administrativeCircular?.supersededByDocument).toBeUndefined();
    expect(doc.administrativeCircular?.supersedesDocuments).toBeUndefined();
  });
});
