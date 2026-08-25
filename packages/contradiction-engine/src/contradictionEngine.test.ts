import { describe, expect, it } from "vitest";
import {
  analyzeAuthoritySupport,
  analyzeContemporaryLaterPosition,
  analyzeContradiction,
  analyzeDocumentaryGapContext,
  analyzePositionChange,
  analyzePrecedentUse,
  analyzeReasoningOperativeContradiction,
  analyzeRequestDecisionMismatch,
  buildContradictionMap,
  buildPositionEvolutionMap,
  calibrateContradictionDrafting,
  contradictionAssessmentResultSchema,
  protectHumanLockedContradictionAssessment,
} from "./contradictionEngine.js";
import {
  analyzeDecision,
  analyzeRequest,
  buildRequestDispositionMap,
  detectRequestedButNotDecided,
} from "@swiss-legal-mcp/chronology";
import {
  parseMatterModel,
  type Decision,
  type LegalProposition,
  type PrecedentApplication,
  type ProvenanceRef,
  type Request,
  type SignificantDocumentaryAbsence,
} from "@swiss-legal-mcp/core";

const provenance: ProvenanceRef[] = [
  {
    type: "SYSTEM_DERIVATION",
    system_derivation_input_ids: ["a", "b"],
  },
];

function request(id = "request-x", object = "X"): Request {
  return {
    id,
    matter_id: "matter-1",
    kind: "Request",
    actor_id: "actor-a",
    proposition_ids: [],
    request_type: "request",
    requested_object: object,
    procedural_context: { stage: "FIRST_INSTANCE", date: "2026-01-01" },
    provenance,
  };
}

function decision(id = "decision-y", scope = "Y"): Decision {
  return {
    id,
    matter_id: "matter-1",
    kind: "Decision",
    actor_id: "actor-b",
    proposition_ids: [],
    decision_type: "decision",
    decides_request_ids: [],
    operative_scope: scope,
    procedural_context: { stage: "FIRST_INSTANCE", date: "2026-01-10" },
    provenance,
  };
}

function legalProposition(text: string): LegalProposition {
  return {
    id: "lp-1",
    matter_id: "matter-1",
    kind: "LegalProposition",
    legal_authority_id: "la-1",
    text,
    provenance,
  };
}

function precedent(application: PrecedentApplication["application"]): PrecedentApplication {
  return {
    id: "precedent-1",
    matter_id: "matter-1",
    kind: "PrecedentApplication",
    legal_authority_id: "la-1",
    issue_id: "issue-1",
    application,
    favorable_aspects: application === "MIXED" ? ["favorable quotation"] : [],
    adverse_aspects: application === "MIXED" ? ["adverse ratio"] : [],
    ratio_respected: true,
    provenance,
  };
}

describe("Contradiction Engine Phase 4", () => {
  it("A - direct contradiction requires same scope, time, object and level", () => {
    const result = analyzeContradiction({
      entityAId: "assertion-a",
      entityBId: "assertion-b",
      kindA: "ASSERTION",
      kindB: "ASSERTION",
      statementA: "P occurred.",
      statementB: "P did not occur.",
      sameProposition: true,
      scope: "SAME_SCOPE",
      temporal: "SAME_TIMEFRAME",
      levelA: "FACTUAL_STATEMENT",
      levelB: "FACTUAL_STATEMENT",
      objectSame: true,
      directNegation: true,
      provenance,
    });

    expect(result.classification).toBe("DIRECT_CONTRADICTION");
    expect(result.credibility_effect).toBe("NEUTRAL");
  });

  it("B - different scope is not treated as contradiction", () => {
    const result = analyzeContradiction({
      entityAId: "assertion-t1",
      entityBId: "assertion-t2",
      kindA: "ASSERTION",
      kindB: "ASSERTION",
      statementA: "P for T1.",
      statementB: "Not P for T2.",
      sameProposition: true,
      scope: "DIFFERENT_SCOPE",
      temporal: "DIFFERENT_TIMEFRAME",
      levelA: "FACTUAL_STATEMENT",
      levelB: "FACTUAL_STATEMENT",
      objectSame: false,
      directNegation: true,
      provenance,
    });

    expect(result.classification).toBe("NOT_CONTRADICTORY");
    expect(result.best_innocent_explanation).toContain("different");
  });

  it("C - factual payment and legal grant stay on different analytical levels", () => {
    const result = analyzeContradiction({
      entityAId: "evidence-payment",
      entityBId: "legal-characterization-grant",
      kindA: "EVIDENCE",
      kindB: "LEGAL_CHARACTERIZATION",
      statementA: "Payment was made.",
      statementB: "Payment equals legal grant.",
      sameProposition: true,
      scope: "SAME_SCOPE",
      temporal: "SAME_TIMEFRAME",
      levelA: "FACTUAL_STATEMENT",
      levelB: "LEGAL_CHARACTERIZATION",
      objectSame: true,
      provenance,
    });

    expect(result.classification).toBe("NOT_CONTRADICTORY");
    expect(result.drafting_formulation).toContain("analytical level");
  });

  it("D - narrower later statement is clarification, not contradiction", () => {
    expect(
      analyzePositionChange({
        earlierPositionId: "pos-1",
        laterPositionId: "pos-2",
        sameFactTimeScope: false,
        earlierAffirms: true,
        laterAffirms: true,
        clarification: true,
        narrowing: true,
        provenance,
      }),
    ).toBe("CLARIFICATION");
  });

  it("E - same fact/time/scope reversal is factual position change", () => {
    expect(
      analyzePositionChange({
        earlierPositionId: "pos-1",
        laterPositionId: "pos-2",
        sameFactTimeScope: true,
        earlierAffirms: true,
        laterAffirms: false,
        provenance,
      }),
    ).toBe("FACTUAL_POSITION_CHANGE");
  });

  it("F - new legal reason first appearing on appeal is post-hoc possible, not bad faith", () => {
    expect(
      analyzePositionChange({
        earlierPositionId: "first-instance",
        laterPositionId: "appeal",
        sameFactTimeScope: true,
        earlierAffirms: true,
        laterAffirms: true,
        legalReasonFirstAppearsOnAppeal: true,
        usedToDefendEarlierDecision: true,
        provenance,
      }),
    ).toBe("POST_HOC_JUSTIFICATION_POSSIBLE");
  });

  it("G - request X and decision Y produces request-decision mismatch", () => {
    const req = analyzeRequest({ request: request() });
    const dec = analyzeDecision({
      decision: decision(),
      requestsBeforeAuthority: [req.request_id],
      requestRelations: [
        {
          request_id: req.request_id,
          relation: "DOES_NOT_DECIDE",
          explanation: "Different object.",
        },
      ],
    });
    const undecided = detectRequestedButNotDecided({
      request: req,
      decision: dec,
      requestScopeClear: true,
      decisionScopeClear: true,
      provenance,
    });
    const map = buildRequestDispositionMap({ request: req, decisions: [dec] });

    expect(analyzeRequestDecisionMismatch({ map, undecided })).toBe("REQUESTED_BUT_NOT_DECIDED");
  });

  it("H - reasoning broader than operative part produces procedural issue signal", () => {
    expect(analyzeReasoningOperativeContradiction("REASONING_BROADER_THAN_OPERATIVE")).toBe(
      "POSSIBLE_PROCEDURAL_ISSUE",
    );
  });

  it("I - contemporaneous record and later contrary position require reconciliation", () => {
    expect(
      analyzeContemporaryLaterPosition({
        contemporaneousRecordId: "record-1",
        laterPositionId: "position-later",
        sameScope: true,
        conflict: true,
        corroborated: true,
        provenance,
      }),
    ).toBe("MATERIAL_DIVERGENCE");
  });

  it("J - legal proposition overstating authority is flagged without inventing law", () => {
    expect(
      analyzeAuthoritySupport({
        legalProposition: legalProposition("rule X applies categorically"),
        authorityText: "rule X applies only under conditions A and B",
        locatorMatches: true,
        includesAdverseAspect: true,
        provenance,
      }),
    ).toBe("OVERSTATED_PROPOSITION");
  });

  it("K - favorable quote with mixed precedent creates cherry-picking risk", () => {
    expect(
      analyzePrecedentUse({
        claimedUse: "STRONGLY_SUPPORTIVE",
        application: precedent("MIXED"),
        favorableQuoteUsed: true,
      }),
    ).toBe("CHERRY_PICKING_RISK");
  });

  it("L - immaterial contradiction can be dropped", () => {
    const result = analyzeContradiction({
      entityAId: "minor-a",
      entityBId: "minor-b",
      kindA: "ASSERTION",
      kindB: "ASSERTION",
      statementA: "Minor detail A.",
      statementB: "Minor detail B.",
      sameProposition: true,
      scope: "SAME_SCOPE",
      temporal: "SAME_TIMEFRAME",
      levelA: "FACTUAL_STATEMENT",
      levelB: "FACTUAL_STATEMENT",
      objectSame: true,
      directNegation: true,
      materiality: "IMMATERIAL",
      provenance,
    });

    expect(result.strategic_value.recommended_role).toBe("DROP");
  });

  it("M - plausible temporal explanation is generated and can downgrade use", () => {
    const result = analyzeContradiction({
      entityAId: "old",
      entityBId: "new",
      kindA: "ASSERTION",
      kindB: "ASSERTION",
      statementA: "Estimate was 100.",
      statementB: "Final amount was 120.",
      sameProposition: true,
      scope: "SAME_SCOPE",
      temporal: "LATER_DEVELOPMENT",
      levelA: "FACTUAL_STATEMENT",
      levelB: "FACTUAL_STATEMENT",
      objectSame: true,
      provenance,
    });

    expect(result.classification).toBe("EXPLAINABLE_DIFFERENCE");
    expect(result.possible_explanations).toContain("temporal development");
  });

  it("N - contradiction assessment without provenance fails", () => {
    expect(() =>
      analyzeContradiction({
        entityAId: "a",
        entityBId: "b",
        kindA: "ASSERTION",
        kindB: "ASSERTION",
        statementA: "P",
        statementB: "not P",
        sameProposition: true,
        scope: "SAME_SCOPE",
        temporal: "SAME_TIMEFRAME",
        levelA: "FACTUAL_STATEMENT",
        levelB: "FACTUAL_STATEMENT",
        objectSame: true,
        directNegation: true,
        provenance: [],
      }),
    ).toThrow();
  });

  it("O - contradiction maps and assessments serialize correctly", () => {
    const result = analyzeContradiction({
      entityAId: "a",
      entityBId: "b",
      kindA: "ASSERTION",
      kindB: "ASSERTION",
      statementA: "P",
      statementB: "not P",
      sameProposition: true,
      scope: "SAME_SCOPE",
      temporal: "SAME_TIMEFRAME",
      levelA: "FACTUAL_STATEMENT",
      levelB: "FACTUAL_STATEMENT",
      objectSame: true,
      directNegation: true,
      provenance,
    });
    const map = buildContradictionMap({
      result,
      propositionIds: ["p-1"],
      contexts: ["appeal"],
      evidenceIds: ["e-1"],
      chronologyEventIds: ["event-1"],
    });

    const roundtripped = contradictionAssessmentResultSchema.parse(
      JSON.parse(JSON.stringify(result)),
    );
    expect(roundtripped.classification).toBe("DIRECT_CONTRADICTION");
    expect(JSON.parse(JSON.stringify(map)).source_of_truth).toBe(false);
  });

  it("false-positive guardrail: assistance provided vs not formally decided is not contradiction", () => {
    const result = analyzeContradiction({
      entityAId: "action",
      entityBId: "decision-gap",
      kindA: "ACTION",
      kindB: "DECISION",
      statementA: "Assistance was materially provided.",
      statementB: "The request was not formally decided.",
      sameProposition: true,
      scope: "PARTIAL_OVERLAP",
      temporal: "SAME_TIMEFRAME",
      levelA: "FACTUAL_STATEMENT",
      levelB: "PROCEDURAL_POSITION",
      objectSame: true,
      provenance,
    });

    expect(result.classification).not.toBe("DIRECT_CONTRADICTION");
  });

  it("position evolution map is derived and not source of truth", () => {
    const map = buildPositionEvolutionMap({
      actorId: "actor-b",
      positionIds: ["pos-1", "pos-2"],
      assertionChanges: ["later narrower scope"],
      scopeShifts: ["broad to narrow"],
      classification: "CLARIFICATION",
    });

    expect(map.view_type).toBe("POSITION_EVOLUTION_MAP");
    expect(map.source_of_truth).toBe(false);
  });

  it("documentary gaps integrate without concealment conclusion", () => {
    const absence: SignificantDocumentaryAbsence = {
      id: "absence-1",
      matter_id: "matter-1",
      kind: "SignificantDocumentaryAbsence",
      expected_document_description: "missing document C",
      status: "ABSENCE_OBSERVED",
      provenance,
    };

    expect(
      analyzeDocumentaryGapContext({
        absence,
        material: true,
        provenance,
      }),
    ).toBe("MATERIAL_DOCUMENTARY_GAP");
    expect(calibrateContradictionDrafting("REQUIRES_CLARIFICATION")).not.toMatch(
      /lie|hidden|conceal/i,
    );
  });

  it("human locked contradiction interpretation requires review on new conflict", () => {
    expect(
      protectHumanLockedContradictionAssessment({
        assessmentId: "contradiction-1",
        reviewedState: {
          status: "HUMAN_LOCKED",
          locked_by: "reviewer-1",
          locked_at: "2026-08-15T00:00:00.000Z",
        },
        newConflict: true,
      }),
    ).toEqual({ status: "REVIEW_REQUIRED", overwriteAllowed: false });
  });

  it("test fixture parses without relying on external case facts", () => {
    const parsed = parseMatterModel({
      matter: { id: "matter-1", title: "Synthetic contradiction matter" },
    });
    expect(parsed.matter.id).toBe("matter-1");
  });
});
