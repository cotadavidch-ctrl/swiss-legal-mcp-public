import { describe, expect, it } from "vitest";
import {
  assessAbsenceOfEvidence,
  buildCitationCalibration,
  buildSearchCaseCalibration,
  classifyEvidenceStrength,
  classifyPrecedentUse,
  classifySourceQuality,
} from "../src/tools/legalCalibration.js";

describe("legalCalibration guardrails", () => {
  it("A: no convierte falta de localizacion de delegacion en inexistencia de delegacion", () => {
    const assessment = assessAbsenceOfEvidence({
      searchedAvailableRecord: true,
      authorityControlledDocument: true,
    });

    expect(assessment.absence_status).toBe("NO_EVIDENCE_IDENTIFIED");
    expect(assessment.evidence_strength).toBe("AUTHORITY_CONTROLLED_DOCUMENT");
    expect(assessment.legal_calibration.procedural_formulation).toContain(
      "keinen positiven Nachweis ihres Nichtbestehens",
    );
    expect(assessment.legal_calibration.risk_calibration).toBe("EVIDENTIARY_REQUEST");
  });

  it("B: factura dirigida a autoridad sigue siendo inferencia si se usa para organizacion material", () => {
    const strength = classifyEvidenceStrength({ inferentialOnly: true });

    expect(strength).toBe("INFERENCE");
  });

  it("C: existencia de sentencia no verifica la proposicion juridica material", () => {
    const calibration = buildCitationCalibration({
      normalized: "4A_97/2026",
      type: "case_number",
      match: "probable",
      warnings: [],
    });

    expect(calibration.citation_identity.status).toBe("reference_located");
    expect(calibration.material_verification.status).toBe("unable_to_verify");
    expect(calibration.material_verification.citation_quality).toBe("UNABLE_TO_VERIFY");
    expect(
      calibration.verification_stages.find(
        (stage) => stage.stage === "material_proposition_verified",
      )?.status,
    ).toBe("not_requested");
  });

  it("D: frase favorable con recurso rechazado genera adverse_aspects", () => {
    const precedent = classifyPrecedentUse({
      supportsRequestedProposition: true,
      appealRejected: true,
      additionalRequirements: ["separate statutory prerequisite"],
    });

    expect(precedent.treatment).toBe("MIXED");
    expect(precedent.citation_quality).toBe("PARTIALLY_SUPPORTED");
    expect(precedent.adverse_aspects).toContain("appeal_rejected_or_complaint_dismissed");
  });

  it("E: fecha de nombre de archivo no sustituye automaticamente la fecha real de sentencia", () => {
    const calibration = buildCitationCalibration({
      normalized: "1B_352/2019",
      type: "case_number",
      match: "probable",
      document: {
        id: "test",
        provider: "entscheidsuche",
        documentType: "case",
        jurisdiction: { level: "federal" },
        sourceOriginalId: "1B_352/2019",
        date: {},
        language: "de",
        title: "1B_352/2019",
        provenance: {
          sourceUrl: "https://entscheidsuche.ch/test",
          retrievedAt: "2026-08-15T00:00:00.000Z",
          contentHash: "a".repeat(64),
          officialCharacter: "unofficial_aggregator",
        },
        rawMetadata: { filenameDate: "2020-01-01" },
        contentNature: "summary",
      },
      warnings: [],
    });

    expect(calibration.citation_identity.decision_date).toBeNull();
    expect(calibration.citation_identity.metadata_validation.warnings).toContain(
      "filename_date_not_used_as_decision_date",
    );
  });

  it("F: busqueda fallida no degrada automaticamente documento primario ya existente", () => {
    const strength = classifyEvidenceStrength({
      primaryDirectEvidence: true,
      searchMissOnly: true,
    });

    expect(strength).toBe("PRIMARY_DIRECT_EVIDENCE");
  });

  it("G: agregador se diferencia de fuente oficial", () => {
    const sourceQuality = classifySourceQuality({
      document: {
        id: "test",
        provider: "entscheidsuche",
        documentType: "case",
        jurisdiction: { level: "federal" },
        sourceOriginalId: "x",
        date: {},
        language: "de",
        title: "Aggregator hit",
        provenance: {
          sourceUrl: "https://entscheidsuche.ch/test",
          retrievedAt: "2026-08-15T00:00:00.000Z",
          contentHash: "b".repeat(64),
          officialCharacter: "unofficial_aggregator",
        },
        rawMetadata: {},
        contentNature: "summary",
      },
    });
    const searchCalibration = buildSearchCaseCalibration({
      query: "rechtliches Gehoer",
      resultCount: 0,
      sourceName: "entscheidsuche.ch",
    });

    expect(sourceQuality).toBe("SECONDARY_REFERENCE");
    expect(searchCalibration.official_verification_required).toBe(true);
    expect(searchCalibration.absence_status).toBe("NOT_IN_AVAILABLE_RECORD");
  });
});
