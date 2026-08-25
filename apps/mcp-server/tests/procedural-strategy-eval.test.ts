import { describe, expect, it } from "vitest";
import {
  adjustConfidenceAfterLive,
  averageConfidence,
  buildComparableCases,
  deduplicateLiveResults,
  evaluateProceduralStrategy,
  validateLivePrivacy,
} from "../scripts/procedural-strategy-eval.js";

describe("procedural-strategy evaluation harness", () => {
  it("evaluates the anonymized Appenzell Ausserrhoden pilot without critical errors", async () => {
    const report = await evaluateProceduralStrategy({
      caseId: "legal-aid-ar",
      all: false,
      json: false,
      updateReport: false,
      live: false,
    });

    expect(report.corpusSize).toBe(1);
    expect(report.summary.criticalErrors).toBe(0);
    expect(report.summary.materialFabricatedFacts).toBe(0);
    expect(report.summary.inventedDeadlines).toBe(0);
    expect(report.summary.privacyLeaks).toBe(0);
    expect(report.cases[0]?.outputSummary.warnings).toContain("uncertain_deadline");
    expect(report.cases[0]?.outputSummary.warnings).toContain("missing_documents");
  });

  it("keeps the full corpus diverse and offline-deterministic", async () => {
    const report = await evaluateProceduralStrategy({
      all: true,
      json: false,
      updateReport: false,
      live: false,
    });

    expect(report.corpusSize).toBe(15);
    expect(report.anonymizedControlledCases).toBe(1);
    expect(report.syntheticControlledCases).toBe(14);
    expect(report.summary.inventedCaseLaw).toBe(0);
    expect(report.liveEvaluation.enabled).toBe(false);
  });

  it("writes release reports on request", async () => {
    const report = await evaluateProceduralStrategy({
      caseId: "legal-aid-ar",
      all: false,
      json: false,
      updateReport: true,
      live: false,
    });

    expect(report.summary.result).toBe("pass");
    expect(report.cases[0]?.caseId).toBe("legal-aid-ar");
  });

  it("detects private live-query material before execution artifacts are trusted", () => {
    const validation = validateLivePrivacy([
      {
        caseId: "legal-aid-ar",
        operation: "search_across_sources",
        query: "unentgeltliche Rechtspflege named bank CH9300762011623852957",
        filters: {},
        timestamp: "2026-08-03T00:00:00.000Z",
        latencyMs: 0,
        retries: 0,
        resultCount: 0,
        results: [],
        providersConsulted: [],
        warnings: [],
        status: "failed",
      },
    ]);

    expect(validation.passed).toBe(false);
    expect(validation.findings).toContain("bank_account_detected");
    expect(validation.findings).toContain("private_financial_context_detected");
  });

  it("classifies comparable and adverse live authorities from provider-returned metadata", () => {
    const comparable = buildComparableCases([
      {
        caseId: "legal-aid-ar",
        operation: "search_across_sources",
        query: "Art. 56 ZPO gerichtliche Fragepflicht",
        filters: {},
        timestamp: "2026-08-03T00:00:00.000Z",
        latencyMs: 10,
        retries: 1,
        resultCount: 2,
        results: [
          {
            providerId: "entscheidsuche",
            documentId: "entscheidsuche:favorable",
            title: "Rechtliches Gehoer und Rueckweisung bei Art. 56 ZPO",
          },
        ],
        providersConsulted: [{ providerId: "entscheidsuche", queried: true, resultCount: 1 }],
        warnings: [],
        status: "success",
      },
      {
        caseId: "legal-aid-ar",
        operation: "search_across_sources",
        query: "Mitwirkungspflicht fehlende Unterlagen unentgeltliche Rechtspflege",
        filters: {},
        timestamp: "2026-08-03T00:00:00.000Z",
        latencyMs: 10,
        retries: 1,
        resultCount: 1,
        results: [
          {
            providerId: "entscheidsuche",
            documentId: "entscheidsuche:adverse",
            title: "Mitwirkungspflicht und fehlende Unterlagen bei unentgeltlicher Rechtspflege",
          },
        ],
        providersConsulted: [{ providerId: "entscheidsuche", queried: true, resultCount: 1 }],
        warnings: [],
        status: "success",
      },
    ]);

    expect(comparable.some((item) => item.classification === "favorable")).toBe(true);
    expect(comparable.some((item) => item.classification === "unfavorable")).toBe(true);
    expect(comparable.every((item) => item.basis.length > 0)).toBe(true);
  });

  it("deduplicates live results and adjusts confidence conservatively", () => {
    const results = deduplicateLiveResults([
      { providerId: "entscheidsuche", documentId: "a", title: "A" },
      { providerId: "entscheidsuche", documentId: "a", title: "A duplicate" },
      { providerId: "entscheidsuche", documentId: "b", title: "B" },
    ]);

    expect(results).toHaveLength(2);
    expect(averageConfidence({ route: 0.4, evidence: 0.6 })).toBe(0.5);
    expect(averageConfidence({})).toBe(0.5);
    expect(
      adjustConfidenceAfterLive(
        0.6,
        [
          {
            caseId: "legal-aid-ar",
            providerId: "entscheidsuche",
            documentId: "a",
            title: "A",
            query: "q",
            classification: "unfavorable",
            basis: "adverse",
            matter: "civil",
            procedure: "civil",
            instance: "court",
            appliedNorm: "ZPO",
            determinativeFacts: "documents",
            burdenOfProof: "cooperation",
            missingDocuments: "yes",
            ratioDecidendi: "review needed",
            outcome: "risk",
            similarities: [],
            differences: [],
            proceduralRelevance: "risk",
          },
        ],
        [
          {
            caseId: "legal-aid-ar",
            operation: "search",
            query: "q",
            filters: {},
            timestamp: "2026-08-03T00:00:00.000Z",
            latencyMs: 1,
            retries: 1,
            resultCount: 1,
            results: [],
            providersConsulted: [],
            warnings: [],
            status: "success",
          },
        ],
      ),
    ).toBe(0.5);
    expect(
      adjustConfidenceAfterLive(
        0.6,
        [],
        [
          {
            caseId: "legal-aid-ar",
            operation: "search",
            query: "q",
            filters: {},
            timestamp: "2026-08-03T00:00:00.000Z",
            latencyMs: 1,
            retries: 0,
            resultCount: 0,
            results: [],
            providersConsulted: [],
            warnings: [],
            status: "failed",
          },
        ],
      ),
    ).toBe(0.4);
  });
});
