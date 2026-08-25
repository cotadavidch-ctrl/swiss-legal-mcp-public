import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  mapEntscheidsucheDocumentToNormalizedDocument,
  EntscheidsucheMappingError,
} from "./mapper.js";
import { OfficialSourceResolver } from "./officialSourceResolver.js";
import type { RemoteSearchHit } from "./remoteTypes.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/entscheidsuche",
);

function loadFetchDocumentHit(fixtureName: string): RemoteSearchHit {
  const raw = JSON.parse(readFileSync(path.join(fixturesDir, `${fixtureName}.json`), "utf8")) as {
    parsed: { result: { structuredContent: { result: RemoteSearchHit } } };
  };
  return raw.parsed.result.structuredContent.result;
}

const resolver = new OfficialSourceResolver(["bger.ch", "admin.ch"]);

describe("mapEntscheidsucheDocumentToNormalizedDocument (documentos reales)", () => {
  it("mapea una sentencia federal en aleman (BGE 142 III 1) con fetch_document", () => {
    const hit = loadFetchDocumentHit("fetch_document_bge_142_III_1");
    const doc = mapEntscheidsucheDocumentToNormalizedDocument(hit, {
      isFullText: true,
      resolver,
      retrievedAt: "2026-07-26T00:00:00.000Z",
    });

    expect(doc.id).toBe("entscheidsuche:CH_BGE_005_BGE-142-III-1_2016");
    expect(doc.provider).toBe("entscheidsuche");
    expect(doc.jurisdiction).toEqual({ level: "federal" });
    expect(doc.bgeAtfDtf).toBe("BGE 142 III 1");
    expect(doc.fullText).toBeDefined();
    expect(doc.fullText).not.toMatch(/<\/?em>/);
    expect(doc.contentNature).toBe("literal");
    expect(doc.excerptOnly).toBe(false);
    expect(doc.provenance.officialCharacter).toBe("unofficial_aggregator");
    expect(doc.provenance.aggregatorName).toBe("entscheidsuche.ch");
    expect(doc.provenance.aggregatorUrl).toContain("entscheidsuche.ch");
    expect(doc.provenance.officialSourceUrl).toBeUndefined();
    expect(doc.language).toBe("de");
    expect(doc.date.decisionOrEnactment).toBe("2016-01-01");
  });

  it("mapea una sentencia cantonal en frances (Vaud) con fetch_document", () => {
    const hit = loadFetchDocumentHit("fetch_document_vd_fr_cantonal");
    const doc = mapEntscheidsucheDocumentToNormalizedDocument(hit, {
      isFullText: true,
      resolver,
      inferredLanguage: "fr",
    });

    expect(doc.jurisdiction).toEqual({ level: "cantonal", canton: "VD" });
    expect(doc.authority).toBe("VD_TC");
    expect(doc.language).toBe("fr");
    expect(doc.fullText).toBeDefined();
    expect(doc.bgeAtfDtf).toBeUndefined();
  });

  it("mapea una sentencia cantonal en italiano (Ticino) con fetch_document", () => {
    const hit = loadFetchDocumentHit("fetch_document_ti_it_cantonal");
    const doc = mapEntscheidsucheDocumentToNormalizedDocument(hit, {
      isFullText: true,
      resolver,
      inferredLanguage: "it",
    });

    expect(doc.jurisdiction).toEqual({ level: "cantonal", canton: "TI" });
    expect(doc.language).toBe("it");
    expect(doc.summary).toContain("Contratto");
  });

  it("mapea una segunda sentencia cantonal en aleman (Basilea-Campana) con fetch_document", () => {
    const hit = loadFetchDocumentHit("fetch_document_bl_de_cantonal");
    const doc = mapEntscheidsucheDocumentToNormalizedDocument(hit, {
      isFullText: true,
      resolver,
      inferredLanguage: "de",
    });

    expect(doc.jurisdiction).toEqual({ level: "cantonal", canton: "BL" });
    expect(doc.provenance.downloadUrl).toBeDefined();
    expect(doc.rawMetadata["is_pdf"]).toBe(true);
  });

  it("marca excerptOnly:true y no rellena fullText cuando viene de search (no fetch_document)", () => {
    const hit = loadFetchDocumentHit("fetch_document_bge_142_III_1");
    const doc = mapEntscheidsucheDocumentToNormalizedDocument(hit, {
      isFullText: false,
      resolver,
    });
    expect(doc.excerptOnly).toBe(true);
    expect(doc.fullText).toBeUndefined();
    expect(doc.contentNature).toBe("literal");
  });

  it("conserva integramente el hit original en rawMetadata", () => {
    const hit = loadFetchDocumentHit("fetch_document_bge_142_III_1");
    const doc = mapEntscheidsucheDocumentToNormalizedDocument(hit, { isFullText: true, resolver });
    expect(doc.rawMetadata["id"]).toBe(hit.id);
    expect(doc.rawMetadata["scrape_date"]).toBe(hit.scrape_date);
  });

  it("el hash de contenido es deterministico sobre el mismo texto", () => {
    const hit = loadFetchDocumentHit("fetch_document_bge_142_III_1");
    const doc1 = mapEntscheidsucheDocumentToNormalizedDocument(hit, { isFullText: true, resolver });
    const doc2 = mapEntscheidsucheDocumentToNormalizedDocument(hit, { isFullText: true, resolver });
    expect(doc1.provenance.contentHash).toBe(doc2.provenance.contentHash);
  });

  it("lanza EntscheidsucheMappingError si el hit no trae document_url", () => {
    const hit = loadFetchDocumentHit("fetch_document_bge_142_III_1");
    const brokenHit: RemoteSearchHit = { ...hit, document_url: null };
    expect(() =>
      mapEntscheidsucheDocumentToNormalizedDocument(brokenHit, { isFullText: true, resolver }),
    ).toThrow(EntscheidsucheMappingError);
  });

  it("rellena officialSourceUrl solo cuando original_url resuelve como candidato oficial", () => {
    const hit = loadFetchDocumentHit("fetch_document_bge_142_III_1");
    const withOfficialUrl: RemoteSearchHit = {
      ...hit,
      original_url: "https://www.bger.ch/ext/eurospider/live/de/php/aza/http/index.php",
    };
    const doc = mapEntscheidsucheDocumentToNormalizedDocument(withOfficialUrl, {
      isFullText: true,
      resolver,
    });
    expect(doc.provenance.officialSourceUrl).toBe(
      "https://www.bger.ch/ext/eurospider/live/de/php/aza/http/index.php",
    );
  });

  it("no rellena officialSourceUrl cuando original_url no esta en la allowlist", () => {
    const hit = loadFetchDocumentHit("fetch_document_bge_142_III_1");
    const withUntrustedUrl: RemoteSearchHit = { ...hit, original_url: "https://evil.example/x" };
    const doc = mapEntscheidsucheDocumentToNormalizedDocument(withUntrustedUrl, {
      isFullText: true,
      resolver,
    });
    expect(doc.provenance.officialSourceUrl).toBeUndefined();
  });
});
