import { describe, expect, it } from "vitest";
import {
  aggregateEvidentiaryAssessment,
  analyzeContemporaneousEvidence,
  analyzeContradictoryEvidence,
  analyzeEvidenceControl,
  analyzeSelectiveEvidence,
  analyzeSignificantDocumentaryAbsence,
  assessClaimElementEvidence,
  assessEvidenceStrength,
  buildEvidenceMap,
  calibrateEvidentiaryLanguage,
  classifyMissingEvidence,
  createEvidenceRelationship,
  protectHumanReviewedFinding,
  recommendEvidenceRequest,
  type EvidenceRelationship,
  type EvidenceStrengthAssessment,
} from "./evidenceEngine.js";
import {
  parseMatterModel,
  type BurdenAssessment,
  type Evidence,
  type EvidenceControlAssessment,
  type FactualFinding,
  type MatterModel,
  type Proposition,
  type ProvenanceRef,
} from "./matterModel.js";

const provenance: ProvenanceRef[] = [
  {
    type: "SYSTEM_DERIVATION",
    system_derivation_input_ids: ["evidence-1", "proposition-1"],
  },
];

const documentProvenance: ProvenanceRef[] = [
  {
    type: "DOCUMENT_PASSAGE",
    document_id: "document-1",
    passage_id: "passage-1",
    system_derivation_input_ids: [],
  },
];

function model(): MatterModel {
  return parseMatterModel({
    matter: { id: "matter-1", title: "Synthetic evidence matter" },
    actors: [
      {
        id: "actor-a",
        matter_id: "matter-1",
        kind: "Actor",
        name: "Party A",
        actor_type: "PERSON",
      },
      {
        id: "actor-b",
        matter_id: "matter-1",
        kind: "Actor",
        name: "Authority B",
        actor_type: "AUTHORITY",
      },
    ],
    documents: [
      {
        id: "document-1",
        matter_id: "matter-1",
        kind: "Document",
        title: "Contemporaneous record",
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
        provenance: [{ type: "OFFICIAL_SOURCE", official_source_id: "official-record" }],
      },
      {
        id: "document-2",
        matter_id: "matter-1",
        kind: "Document",
        title: "Later submission",
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
        provenance: [{ type: "PARTY_SUBMISSION", party_submission_id: "later-submission" }],
      },
    ],
    passages: [
      {
        id: "passage-1",
        matter_id: "matter-1",
        kind: "Passage",
        document_id: "document-1",
        text: "The relevant request was filed.",
        provenance: documentProvenance,
      },
    ],
    propositions: [
      proposition("proposition-1", "The request was filed."),
      proposition("proposition-2", "The claim element is only partly supported."),
    ],
    assertions: [
      {
        id: "assertion-later",
        matter_id: "matter-1",
        kind: "Assertion",
        actor_id: "actor-b",
        proposition_id: "proposition-1",
        stance: "DENIES",
        procedural_context: { stage: "ADMINISTRATIVE_APPEAL", date: "2026-02-01" },
        provenance: [{ type: "PARTY_SUBMISSION", party_submission_id: "later-submission" }],
      },
    ],
    evidence: [
      evidence("evidence-1", "document-1", ["proposition-1"]),
      evidence("evidence-2", "document-2", ["proposition-1"]),
    ],
  });
}

function proposition(id: string, text: string): Proposition {
  return {
    id,
    matter_id: "matter-1",
    kind: "Proposition",
    text,
    scope: "synthetic scope",
    legal_or_factual_domain: "FACTUAL",
    granularity: "ATOMIC",
    source_passage_ids: ["passage-1"],
    provenance: documentProvenance,
  };
}

function evidence(id: string, documentId: string, propositionIds: string[]): Evidence {
  return {
    id,
    matter_id: "matter-1",
    kind: "Evidence",
    evidence_type: "DOCUMENT",
    document_id: documentId,
    source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
    supported_proposition_ids: propositionIds,
    evidence_use: "SUPPORT",
    procedural_context: { stage: "FIRST_INSTANCE", date: "2026-01-01" },
    provenance: documentProvenance,
  };
}

function relationship(
  evidenceId: string,
  relationType: EvidenceRelationship["relation_type"],
): EvidenceRelationship {
  return createEvidenceRelationship({
    evidence_id: evidenceId,
    proposition_id: "proposition-1",
    relation_type: relationType,
    scope: "synthetic proposition",
    confidence: 0.82,
    provenance,
    procedural_context: { stage: "FIRST_INSTANCE", date: "2026-01-01" },
    assessment_status: "ASSESSED",
  });
}

function strength(
  evidenceId: string,
  evidenceStrength: EvidenceStrengthAssessment["strength"],
): EvidenceStrengthAssessment {
  return assessEvidenceStrength({
    evidence_id: evidenceId,
    proposition_id: "proposition-1",
    strength: evidenceStrength,
    authenticity_status: "AUTHENTICATED",
    content_verification_status: "FULL_TEXT_VERIFIED",
    admissibility_status: "LIKELY_ADMISSIBLE",
    availability_status: "AVAILABLE_TO_SYSTEM",
    contemporaneous_factor: "CONTEMPORANEOUS_PRIMARY_RECORD",
    explanation: "Synthetic direct record.",
    confidence: 0.86,
    provenance,
    procedural_context: { stage: "FIRST_INSTANCE", date: "2026-01-01" },
  });
}

function burden(): BurdenAssessment {
  return {
    id: "burden-1",
    matter_id: "matter-1",
    kind: "BurdenAssessment",
    issue_id: "issue-1",
    proposition_id: "proposition-1",
    burden_type: "BURDEN_OF_SUBSTANTIATION",
    bearer_actor_id: "actor-a",
    bearer_status: "KNOWN",
    status: "ASSESSED",
    legal_basis: "synthetic procedural basis",
    provenance,
  };
}

function control(): EvidenceControlAssessment {
  return {
    id: "control-1",
    matter_id: "matter-1",
    kind: "EvidenceControlAssessment",
    actor_id: "actor-b",
    document_id: "document-1",
    proposition_id: "proposition-1",
    control_type: "ADMINISTRATIVE_FILE_CONTROL",
    basis: "document belongs to the administrative file",
    requested_status: "REQUESTED",
    production_status: "NOT_PRODUCED",
    pending_status: "PENDING",
    confidence: 0.88,
    provenance,
  };
}

describe("Evidence Engine Phase 2", () => {
  it("A - direct evidence supports proposition without automatic FactualFinding", () => {
    const matter = model();
    const assessment = aggregateEvidentiaryAssessment({
      proposition: matter.propositions[0]!,
      relationships: [relationship("evidence-1", "STRONGLY_SUPPORTS")],
      strengths: [strength("evidence-1", "PRIMARY_DIRECT")],
      provenance,
    });

    expect(assessment.status).toBe("SUPPORTED");
    expect(assessment.supporting_evidence_ids).toEqual(["evidence-1"]);
    expect(matter.factual_findings).toHaveLength(0);
  });

  it("B - conflicting evidence remains disputed and is not resolved arbitrarily", () => {
    const matter = model();
    const assessment = aggregateEvidentiaryAssessment({
      proposition: matter.propositions[0]!,
      relationships: [
        relationship("evidence-1", "SUPPORTS"),
        relationship("evidence-2", "CONTRADICTS"),
      ],
      strengths: [strength("evidence-1", "DIRECT"), strength("evidence-2", "DIRECT")],
      provenance,
    });
    const conflict = analyzeContradictoryEvidence({
      evidenceA: matter.evidence[0]!,
      evidenceB: matter.evidence[1]!,
      relationshipA: relationship("evidence-1", "SUPPORTS"),
      relationshipB: relationship("evidence-2", "CONTRADICTS"),
      provenance,
    });

    expect(assessment.status).toBe("DISPUTED");
    expect(conflict.status).toBe("CONFLICTING_EVIDENCE");
    expect(conflict.unresolved_point).toContain("must not be resolved");
  });

  it("keeps PROVEN reachable only for high-confidence direct and corroborated evidence", () => {
    const matter = model();
    const strong = {
      ...relationship("evidence-1", "STRONGLY_SUPPORTS"),
      confidence: 0.97,
    };
    const corroborating = {
      ...relationship("evidence-2", "CORROBORATES"),
      confidence: 0.96,
    };
    const assessment = aggregateEvidentiaryAssessment({
      proposition: matter.propositions[0]!,
      relationships: [strong, corroborating],
      strengths: [
        { ...strength("evidence-1", "PRIMARY_DIRECT"), confidence: 0.98 },
        { ...strength("evidence-2", "CORROBORATIVE"), confidence: 0.96 },
      ],
      provenance,
    });

    expect(assessment.status).toBe("PROVEN");
    expect(matter.factual_findings).toHaveLength(0);
  });

  it("C - burden and evidence control stay separated with a possible request", () => {
    const request = analyzeEvidenceControl({
      control: control(),
      missingEvidenceStatus: "EVIDENCE_REQUESTED_NOT_PRODUCED",
      provenance,
    });

    expect(burden().bearer_actor_id).toBe("actor-a");
    expect(control().actor_id).toBe("actor-b");
    expect(request.recommendation).toBe("REQUEST_AKTENEDITION");
    expect(request.consequence_if_not_produced).toContain("proven nonexistence");
  });

  it("D - requested but not produced evidence is not proven nonexistence", () => {
    const status = classifyMissingEvidence({
      requested: true,
      produced: false,
      controlledBy: "AUTHORITY",
      provenance,
      explanation: "The requested file was not produced.",
    });

    expect(status).toBe("EVIDENCE_REQUESTED_NOT_PRODUCED");
    expect(status).not.toBe("PROVEN_NONEXISTENCE");
  });

  it("E - unavailable to system is not treated as nonexistent", () => {
    const status = classifyMissingEvidence({
      evidenceAvailableToSystem: false,
      provenance,
      explanation: "The MCP has no file content.",
    });

    expect(status).toBe("EVIDENCE_NOT_AVAILABLE_TO_SYSTEM");
    expect(status).not.toBe("PROVEN_NONEXISTENCE");
  });

  it("F - significant absence requests explanation without bad-faith inference", () => {
    const analysis = analyzeSignificantDocumentaryAbsence({
      documentNormallyExpected: true,
      actorControlsIt: true,
      specificallyRequested: true,
      actorAnsweredSameComplex: true,
      relatedDocumentsProduced: true,
      materialToNarrative: true,
      provenance,
    });

    expect(analysis.outcome).toBe("DOCUMENTARY_GAP_REQUIRES_EXPLANATION");
    expect(analysis.explanation).toContain("not as concealment");
    expect(analysis.alternative_explanations.length).toBeGreaterThan(0);
  });

  it("G - selective evidence flags record completeness without concealment conclusion", () => {
    const analysis = analyzeSelectiveEvidence({
      producedEvidenceIds: ["evidence-a", "evidence-b"],
      missingExpectedEvidence: ["document-c"],
      missingWasRequested: true,
      sameController: true,
      provenance,
    });

    expect(analysis.status).toBe("REQUIRES_DOCUMENT_PRODUCTION");
    expect(analysis.prohibited_conclusion).toBe("NO_CONCEALMENT_INFERENCE");
  });

  it("H - contemporaneous record versus later assertion requires reconciliation, not lie accusation", () => {
    const analysis = analyzeContemporaneousEvidence({
      contemporaneousEvidenceId: "evidence-1",
      laterAssertionId: "assertion-later",
      contradicts: true,
      provenance,
    });

    expect(analysis.status).toBe("REQUIRES_RECONCILIATION");
    expect(analysis.prohibited_conclusion).toBe("NO_LIE_INFERENCE");
  });

  it("I - claim element follows partial support as partial satisfaction or gap", () => {
    const matter = model();
    const assessment = aggregateEvidentiaryAssessment({
      proposition: matter.propositions[1]!,
      relationships: [
        createEvidenceRelationship({
          evidence_id: "evidence-1",
          proposition_id: "proposition-2",
          relation_type: "PARTIALLY_SUPPORTS",
          scope: "claim element",
          confidence: 0.62,
          provenance,
          assessment_status: "ASSESSED",
        }),
      ],
      strengths: [],
      provenance,
    });
    const link = assessClaimElementEvidence({
      claimElement: {
        id: "claim-element-1",
        proposition_id: "proposition-2",
        status: "UNKNOWN",
        provenance,
      },
      assessment,
      provenance,
    });

    expect(link.status).toBe("PARTIALLY_SATISFIED");
    expect(link.evidence_ids).toContain("evidence-1");
  });

  it("J - human-locked finding receives contrary evidence as review required", () => {
    const finding: FactualFinding = {
      id: "finding-1",
      matter_id: "matter-1",
      kind: "FactualFinding",
      proposition_id: "proposition-1",
      finding_source_type: "HUMAN_VERIFIED",
      scope: "human review",
      status: "ASSESSED_AS_PROVEN",
      provenance,
      reviewed_state: {
        status: "HUMAN_LOCKED",
        locked_by: "reviewer-1",
        locked_at: "2026-08-15T00:00:00.000Z",
      },
    };

    expect(protectHumanReviewedFinding({ finding, contraryEvidenceIds: ["evidence-2"] })).toEqual({
      status: "REVIEW_REQUIRED",
      overwriteAllowed: false,
    });
  });

  it("K - derived assessments without input provenance fail validation", () => {
    expect(() =>
      createEvidenceRelationship({
        evidence_id: "evidence-1",
        proposition_id: "proposition-1",
        relation_type: "SUPPORTS",
        scope: "bad provenance",
        confidence: 0.5,
        provenance: [],
        assessment_status: "ASSESSED",
      }),
    ).toThrow();
    expect(() =>
      aggregateEvidentiaryAssessment({
        proposition: proposition("proposition-1", "The request was filed."),
        relationships: [],
        strengths: [],
        provenance: [{ type: "SYSTEM_DERIVATION", system_derivation_input_ids: [] }],
      }),
    ).toThrow(/SYSTEM_DERIVATION provenance requires input ids/i);
  });

  it("L - evidence assessments survive serialize and deserialize", () => {
    const matter = parseMatterModel({
      ...model(),
      burden_assessments: [burden()],
      evidence_control_assessments: [control()],
    });
    const assessment = aggregateEvidentiaryAssessment({
      proposition: matter.propositions[0]!,
      relationships: [relationship("evidence-1", "SUPPORTS")],
      strengths: [strength("evidence-1", "DIRECT")],
      missingEvidence: ["EVIDENCE_REQUESTED_NOT_PRODUCED"],
      evidenceControl: matter.evidence_control_assessments,
      burdenAssessments: matter.burden_assessments,
      provenance,
    });
    const map = buildEvidenceMap({
      model: matter,
      propositionId: "proposition-1",
      relationships: [relationship("evidence-1", "SUPPORTS")],
      strengths: [strength("evidence-1", "DIRECT")],
      missingEvidence: ["EVIDENCE_REQUESTED_NOT_PRODUCED"],
      provenance,
    });

    const roundtripped = JSON.parse(JSON.stringify({ assessment, map })) as {
      assessment: typeof assessment;
      map: typeof map;
    };

    expect(roundtripped.assessment.proposition_id).toBe("proposition-1");
    expect(roundtripped.assessment.evidence_control[0]?.actor_id).toBe("actor-b");
    expect(roundtripped.map.view_type).toBe("EVIDENCE_MAP");
    expect(roundtripped.map.source_of_truth).toBe(false);
  });

  it("calibrates language without accusing people", () => {
    expect(calibrateEvidentiaryLanguage("DISPUTED", "en")).toBe("remains disputed");
    expect(calibrateEvidentiaryLanguage("CONTRADICTED", "de")).not.toMatch(/false|lie|hidden/i);
  });

  it("recommends requests from gap, control, burden and significance", () => {
    const recommendation = recommendEvidenceRequest({
      missingEvidence: "EVIDENCE_REQUESTED_NOT_PRODUCED",
      control: control(),
      burden: burden(),
      significance: "HIGH",
      what: "administrative file document",
      provenance,
    });

    expect(recommendation.recommendation).toBe("REQUEST_AKTENEINSICHT");
    expect(recommendation.why).toContain("without inventing legal burden");
  });
});
