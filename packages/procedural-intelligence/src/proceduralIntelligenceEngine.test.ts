import { describe, expect, it } from "vitest";
import type { ProvenanceRef } from "@swiss-legal-mcp/core";
import type { IssueLawMap } from "@swiss-legal-mcp/legal-intelligence";
import type {
  JudicialDecisionPath,
  MinimumWinningCase,
  ResponseNecessity,
} from "@swiss-legal-mcp/litigation-intelligence";
import {
  analyzeNarrowerLawfulRemedy,
  assessCompetence,
  assessDeadline,
  assessMootness,
  assessNullitySignal,
  assessProceduralConcession,
  assessProceduralPrerequisites,
  assessRemandStrategy,
  assessRemedyFit,
  buildClaimRequestMap,
  buildIssueRemedyMap,
  buildMinimumRequestSet,
  buildProceduralMinimumWinningCase,
  buildProceduralPathMap,
  buildProceduralStrategy,
  calibrateRequestFormulation,
  classifyArgumentAsRequest,
  detectDelayDenialSignal,
  detectDuplication,
  detectEvidenceRequestGap,
  detectEventualReliefGap,
  detectOverbroadRemedy,
  detectOvercomplexRequestSet,
  detectRemedyGap,
  evaluateFavorableJudgeEnablement,
  evaluatePreservationNeed,
  evaluateRequestOptimization,
  evaluateResponseProceduralConsequence,
  evaluateWaiverRisk,
  generateProceduralHumanReviewFlags,
  proceduralRequestSchema,
  proceduralStrategySchema,
  remedySchema,
  validateProceduralRecommendationProvenance,
  type ProceduralPosture,
  type ProceduralRequest,
  type Remedy,
} from "./proceduralIntelligenceEngine.js";

const provenance: ProvenanceRef[] = [
  { type: "SYSTEM_DERIVATION", system_derivation_input_ids: ["synthetic-procedural-input"] },
];

const posture: ProceduralPosture = {
  matter_id: "matter-1",
  jurisdiction: "CH-synthetic",
  authority_or_court: "Synthetic appeal authority",
  procedural_stage: "appeal",
  procedural_vehicle: "ADMINISTRATIVE_APPEAL",
  applicable_procedure: "synthetic procedure",
  pending_requests: [],
  contested_decision: "decision-1",
  available_remedies: [
    "REMAND",
    "ORDER_TO_DECIDE",
    "FILE_ACCESS",
    "EVIDENCE_TAKING",
    "NO_COST_ORDER",
  ],
  procedural_prerequisites: ["standing", "deadline"],
  known_deadlines: [],
  unknown_deadlines: ["appeal deadline historical version"],
  standing_status: "SUPPORTED",
  interest_status: "SUPPORTED",
  exhaustion_status: "SATISFIED",
  provenance,
  confidence: 0.7,
};

const mwc: MinimumWinningCase = {
  view_type: "MINIMUM_WINNING_CASE",
  source_of_truth: false,
  claim_id: "claim-1",
  essential_facts: [
    {
      element_id: "fact-A",
      element_type: "ESSENTIAL_FACT",
      status: "SATISFIED",
      explanation: "A",
      provenance,
    },
  ],
  essential_evidence: [
    {
      element_id: "ev-A",
      element_type: "ESSENTIAL_EVIDENCE",
      status: "SATISFIED",
      explanation: "A",
      provenance,
    },
  ],
  essential_legal_propositions: [
    {
      element_id: "law-A",
      element_type: "ESSENTIAL_LEGAL_PROPOSITION",
      status: "SATISFIED",
      explanation: "A",
      provenance,
    },
  ],
  essential_procedural_prerequisites: [
    {
      element_id: "issue-procedure",
      element_type: "ESSENTIAL_PROCEDURAL_PREREQUISITE",
      status: "SATISFIED",
      explanation: "A",
      provenance,
    },
  ],
  essential_remedy_elements: [
    {
      element_id: "remedy-0",
      element_type: "ESSENTIAL_REMEDY_ELEMENT",
      status: "SATISFIED",
      explanation: "A",
      provenance,
    },
  ],
  nonessential_supporting_arguments: ["supporting-D", "supporting-E"],
  satisfied: true,
  unresolved_essential_ids: [],
  provenance,
};

const remandRemedy: Remedy = remedySchema.parse({
  remedy_id: "remedy-remand",
  remedy_type: "REMAND",
  requested_outcome: "Remand for lawful decision",
  legal_basis: ["law-A"],
  procedural_vehicle: "ADMINISTRATIVE_APPEAL",
  authority_competent: "VERIFIED",
  prerequisites: ["issue-procedure"],
  claim_ids: ["claim-1"],
  issue_ids: ["issue-procedure"],
  minimum_winning_case_dependencies: ["fact-A", "law-A", "ev-A"],
  evidentiary_dependencies: ["ev-A"],
  legal_dependencies: ["law-A"],
  scope: "minimum procedural relief",
  fallback_level: "PRIMARY",
  risks: [],
  provenance,
  status: "SUPPORTED",
});

function request(
  id: string,
  level: ProceduralRequest["level"],
  remedy?: Remedy,
): ProceduralRequest {
  return proceduralRequestSchema.parse({
    request_id: id,
    matter_id: "matter-1",
    request_type:
      level === "EVIDENTIARY"
        ? "EVIDENTIARY_STEP"
        : level === "PROCEDURAL"
          ? "PROCEDURAL_STEP"
          : "MATERIAL_RELIEF",
    text_or_structured_relief: id,
    claim_ids: ["claim-1"],
    issue_ids: ["issue-procedure"],
    remedy,
    level,
    dependencies: remedy?.minimum_winning_case_dependencies ?? [],
    legal_basis: remedy?.legal_basis ?? [],
    evidentiary_basis: remedy?.evidentiary_dependencies ?? [],
    procedural_basis: remedy?.prerequisites ?? [],
    scope: remedy?.scope ?? "synthetic scope",
    provenance,
  });
}

const favorablePath: JudicialDecisionPath = {
  view_type: "JUDICIAL_DECISION_PATH",
  source_of_truth: false,
  mode: "FAVORABLE_JUDGE",
  threshold_issue_ids: [],
  accepted_fact_ids: ["fact-A"],
  rejected_or_unresolved_fact_ids: [],
  governing_legal_proposition_ids: ["law-A"],
  issue_sequence: ["issue-procedure"],
  dispositive_issue_id: "issue-procedure",
  unnecessary_issue_ids: [],
  likely_reasoning_path: "Synthetic favorable path.",
  outcome_direction: "SUPPORTS_REQUESTED_OUTCOME",
  assumptions: [],
  vulnerabilities: [],
  not_a_prediction: true,
  provenance,
};

describe("Phase 7 procedural intelligence", () => {
  it("A separates strong claim from overbroad remedy and recommends narrowing", () => {
    const broad = {
      ...remandRemedy,
      remedy_id: "broad",
      remedy_type: "REVERSAL" as const,
      risks: ["overbroad claim scope"],
      authority_competent: "UNCERTAIN" as const,
    };
    const fit = assessRemedyFit({
      remedy: broad,
      minimumWinningCase: mwc,
      posture,
      evidenceAvailable: true,
      legalBasisAvailable: true,
    });
    const overbreadth = detectOverbroadRemedy({ remedy: broad, minimumWinningCase: mwc, posture });
    const narrower = analyzeNarrowerLawfulRemedy({
      remedy: broad,
      overbreadth,
      judgePaths: [favorablePath],
      provenance,
    });
    expect(fit.legal_fit).toBe("STRONG");
    expect(overbreadth.status).toBe("REQUIRES_NARROWING");
    expect(narrower.still_legally_useful).toBe(true);
  });

  it("B does not let procedural availability create merits", () => {
    const weakMwc = { ...mwc, satisfied: false, unresolved_essential_ids: ["law-A"] };
    const fit = assessRemedyFit({
      remedy: remandRemedy,
      minimumWinningCase: weakMwc,
      posture,
      evidenceAvailable: true,
      legalBasisAvailable: false,
    });
    expect(fit.procedural_fit).toBe("STRONG");
    expect(fit.legal_fit).toBe("WEAK");
  });

  it("C adds eventual relief when primary request is vulnerable and lawful fallback exists", () => {
    const primary = request("primary", "PRIMARY", {
      ...remandRemedy,
      risks: ["overbroad claim scope"],
    });
    const overbreadth = detectOverbroadRemedy({
      remedy: primary.remedy!,
      minimumWinningCase: mwc,
      posture,
    });
    const optimization = evaluateRequestOptimization({
      request: primary,
      classification: classifyArgumentAsRequest(primary),
      overbreadth,
      fallbackGap: true,
    });
    expect(optimization.action).toBe("ADD_EVENTUAL");
    expect(
      detectEventualReliefGap({
        primaryVulnerable: true,
        alternativeLegallyPlausible: true,
        requests: [primary],
      }),
    ).toBe("EVENTUAL_RELIEF_GAP");
  });

  it("D detects duplicate requests and recommends merge", () => {
    const a = request("a", "PRIMARY", remandRemedy);
    const b = request("b", "PRIMARY", remandRemedy);
    const duplication = detectDuplication(a, b);
    const optimization = evaluateRequestOptimization({
      request: a,
      classification: classifyArgumentAsRequest(a),
      duplication,
    });
    expect(duplication.classification).toBe("FULL_DUPLICATE");
    expect(optimization.action).toBe("MERGE");
  });

  it("E moves evidence request away from material claim slot", () => {
    const bad = {
      ...request("evidence-as-material", "PRIMARY"),
      request_type: "EVIDENTIARY_STEP" as const,
    };
    const classification = classifyArgumentAsRequest(bad);
    const optimization = evaluateRequestOptimization({ request: bad, classification });
    expect(classification.classification).toBe("EVIDENTIARY_REQUEST");
    expect(optimization.action).toBe("MOVE_TO_EVIDENTIARY");
  });

  it("F detects winning legal argument without corresponding request", () => {
    expect(detectRemedyGap({ legalArgumentIds: ["arg-law"], requests: [] })).toBe("REMEDY_GAP");
  });

  it("G detects unsupported request without argument/evidence/legal basis", () => {
    const unsupported = request("unsupported", "PRIMARY");
    const fit = assessRemedyFit({
      remedy: { ...remandRemedy, legal_basis: [], minimum_winning_case_dependencies: [] },
      minimumWinningCase: mwc,
      posture,
      evidenceAvailable: false,
      legalBasisAvailable: false,
    });
    expect(unsupported.legal_basis).toHaveLength(0);
    expect(fit.overall).toBe("WEAK");
  });

  it("H detects evidentiary request gap", () => {
    expect(
      detectEvidenceRequestGap({
        essentialFactMissing: true,
        authorityControlsDocument: true,
        requests: [request("primary", "PRIMARY", remandRemedy)],
      }),
    ).toBe("EVIDENTIARY_REQUEST_GAP");
  });

  it("I treats no delegation located as uncertain, not incompetence", () => {
    const competence = assessCompetence({ authority: "Synthetic authority", provenance });
    expect(competence.status).toBe("UNCERTAIN");
    expect(competence.no_incompetence_inferred_from_absence).toBe(true);
  });

  it("J refuses to calculate deadline without triggering event", () => {
    const deadline = assessDeadline({ legalBasis: "law", provenance });
    expect(deadline.certainty).toBe("INSUFFICIENT_BASIS_TO_CALCULATE");
  });

  it("K does not verify deadline when historical version is unresolved", () => {
    const deadline = assessDeadline({
      triggeringEvent: "notice",
      legalBasis: "law",
      startDate: "2026-01-01",
      duration: "30 days",
      source: "official",
      provenance,
    });
    expect(deadline.certainty).not.toBe("VERIFIED");
    expect(deadline.human_review_required).toBe(true);
  });

  it("L does not turn possible competence defect into nullity automatically", () => {
    const nullity = assessNullitySignal({
      defectType: "possible competence defect",
      severity: "HIGH",
      legalBasis: ["law"],
      provenance,
    });
    expect(nullity.status).toBe("POSSIBLE_INVALIDITY");
    expect(nullity.human_review_required).toBe(true);
  });

  it("M treats ended material event with unresolved declaratory interest as disputed mootness", () => {
    const mootness = assessMootness({
      materialEventEnded: true,
      declaratoryInterestUnresolved: true,
      provenance,
    });
    expect(mootness.status).toBe("MOOTNESS_DISPUTED");
    expect(mootness.automatic_termination).toBe(false);
  });

  it("N builds minimum request set from only required requests", () => {
    const requests = Array.from({ length: 8 }, (_, index) =>
      request(
        `r${index + 1}`,
        index === 0
          ? "PRIMARY"
          : index === 1
            ? "EVENTUAL"
            : index === 2
              ? "EVIDENTIARY"
              : "RESERVE",
        index < 2 ? remandRemedy : undefined,
      ),
    );
    const minimum = buildMinimumRequestSet({
      requests,
      winningPathIds: ["path-a", "path-b"],
      requiredRequestIds: ["r1", "r2", "r3"],
      provenance,
    });
    expect(minimum.request_ids).toEqual(["r1", "r2", "r3"]);
    expect(minimum.excluded_request_ids).toHaveLength(5);
  });

  it("O recognizes lawful remand path when broader merits need not be decided", () => {
    expect(
      assessRemandStrategy({
        furtherFactFindingRequired: true,
        directDecisionPossible: false,
        proceduralPathAvailable: true,
      }),
    ).toBe("REMAND_STRONGLY_FITS");
  });

  it("P detects favorable merits path without usable remedy", () => {
    expect(
      evaluateFavorableJudgeEnablement({
        favorablePath,
        requests: [request("arg-only", "RESERVE")],
      }),
    ).toBe("WINNING_ARGUMENT_WITHOUT_USABLE_REMEDY");
  });

  it("Q flags material deadline uncertainty for human review", () => {
    const flags = generateProceduralHumanReviewFlags({ deadline: assessDeadline({ provenance }) });
    expect(flags).toContain("HUMAN_REVIEW_REQUIRED_DEADLINE");
  });

  it("R requires provenance or explicit hypothetical/unsourced", () => {
    expect(
      validateProceduralRecommendationProvenance({ provenance: [], hypothetical: false }),
    ).toBe(false);
    expect(validateProceduralRecommendationProvenance({ provenance, hypothetical: false })).toBe(
      true,
    );
  });

  it("S serializes procedural strategy structures", () => {
    const primary = request("primary", "PRIMARY", remandRemedy);
    const evidence = request("evidence", "EVIDENTIARY");
    const minimum = buildMinimumRequestSet({
      requests: [primary, evidence],
      winningPathIds: ["path"],
      requiredRequestIds: ["primary", "evidence"],
      provenance,
    });
    const strategy = buildProceduralStrategy({
      requests: [primary, evidence],
      optimizations: [],
      minimumRequestSet: minimum,
      provenance,
    });
    expect(
      proceduralStrategySchema.parse(JSON.parse(JSON.stringify(strategy))).source_of_truth,
    ).toBe(false);
  });

  it("covers procedural posture, paths, issue maps, claim maps, response consequences and formulation calibration", () => {
    const pathMap = buildProceduralPathMap({ remedies: [remandRemedy], posture, provenance });
    const proceduralMwc = buildProceduralMinimumWinningCase({
      minimumWinningCase: mwc,
      requests: [request("primary", "PRIMARY", remandRemedy), request("evidence", "EVIDENTIARY")],
      provenance,
    });
    const issueLawMap: IssueLawMap = {
      view_type: "ISSUE_LAW_MAP",
      source_of_truth: false,
      issue_id: "issue-procedure",
      governing_provision_ids: ["law-A"],
      legal_proposition_ids: ["law-A"],
      favorable_precedent_ids: [],
      adverse_precedent_ids: [],
      temporal_applicability: [],
      unresolved_legal_questions: [],
      evidentiary_dependencies: ["ev-A"],
      materiality: "HIGH",
      provenance,
    };
    const issueRemedy = buildIssueRemedyMap({
      issueLawMap,
      remedies: [remandRemedy],
      role: "PRIMARY",
      provenance,
    });
    const claimRequest = buildClaimRequestMap({
      claimId: "claim-1",
      claimElementIds: ["A"],
      requests: [request("primary", "PRIMARY", remandRemedy), request("evidence", "EVIDENTIARY")],
      provenance,
    });
    const response: ResponseNecessity = {
      view_type: "RESPONSE_NECESSITY",
      source_of_truth: false,
      point_id: "p",
      necessity: "MUST_RESPOND",
      rationale: "r",
      provenance,
    };
    const consequence = evaluateResponseProceduralConsequence({
      response,
      missingEvidence: true,
      provenance,
    });
    const prerequisites = assessProceduralPrerequisites({
      remedy: remandRemedy,
      posture,
      deadline: assessDeadline({ provenance }),
    });
    const preservation = evaluatePreservationNeed({
      issuePriority: {
        issue_id: "issue-procedure",
        priority: "DISPOSITIVE",
        legal_complexity: "MEDIUM",
        evidentiary_dependence: "LOW",
        procedural_dependence: "HIGH",
        rationale: "synthetic",
      },
      legalBasisKnown: true,
    });
    const waiver = evaluateWaiverRisk({ proceduralBasisKnown: true, materialOmission: true });
    const proceduralConcession = assessProceduralConcession({
      concession: {
        view_type: "SAFE_CONCESSION_ANALYSIS",
        source_of_truth: false,
        concession_id: "c",
        target_id: "minor",
        classification: "SAFE",
        undermines: [],
        explanation: "safe",
        provenance,
      },
      proceduralTargetEssential: false,
    });
    const complexity = detectOvercomplexRequestSet({
      requests: Array.from({ length: 8 }, (_, index) => request(`bulk-${index}`, "RESERVE")),
      duplications: [],
      classifications: [],
    });
    expect(pathMap.no_probability_ranking).toBe(true);
    expect(proceduralMwc.essential_evidentiary_requests).toContain("evidence");
    expect(issueRemedy.possible_remedy_ids).toContain("remedy-remand");
    expect(claimRequest.evidence_request_ids).toContain("evidence");
    expect(consequence.must_request_evidence).toBe(true);
    expect(prerequisites.deadline).toBe("UNKNOWN");
    expect(detectDelayDenialSignal({ silence: true })).toBe("DENIAL_OF_JUSTICE_CANDIDATE");
    expect(preservation).toBe("MUST_PRESERVE");
    expect(waiver).toBe("MATERIAL_WAIVER_RISK");
    expect(proceduralConcession).toBe("SAFE");
    expect(complexity).toBe("REQUIRES_RESTRUCTURING");
    expect(calibrateRequestFormulation("EVENTUAL").terminology).toBe("Eventualbegehren");
  });

  it("runs the required adversarial synthetic validation scenarios", () => {
    const scenarios = [
      "strong case / wrong remedy",
      "correct remedy / weak merits",
      "missing evidence / no evidentiary request",
      "overbroad primary relief",
      "redundant requests",
      "need for eventual relief",
      "competence uncertainty",
      "deadline uncertainty",
      "possible nullity overstated",
      "mootness disputed",
      "remand preferable",
      "winning argument with no usable request",
    ];
    const results = scenarios.map((name, index) => {
      const primary = request(
        `primary-${index}`,
        "PRIMARY",
        index === 0
          ? { ...remandRemedy, remedy_type: "REVERSAL", risks: ["overbroad claim scope"] }
          : remandRemedy,
      );
      const requests =
        index === 4
          ? [primary, request(`duplicate-${index}`, "PRIMARY", primary.remedy)]
          : [primary];
      return {
        name,
        posture: posture.procedural_vehicle,
        remedyFit: assessRemedyFit({
          remedy: primary.remedy!,
          minimumWinningCase:
            index === 1 ? { ...mwc, satisfied: false, unresolved_essential_ids: ["law-A"] } : mwc,
          posture,
          evidenceAvailable: index !== 2,
          legalBasisAvailable: index !== 1,
        }).overall,
        hierarchy: evaluateRequestOptimization({
          request: primary,
          classification: classifyArgumentAsRequest(primary),
          fallbackGap: index === 5,
        }).action,
        gap:
          index === 11
            ? detectRemedyGap({ legalArgumentIds: ["arg"], requests: [] })
            : "NO_REMEDY_GAP",
        minimum: buildMinimumRequestSet({
          requests,
          winningPathIds: ["path"],
          requiredRequestIds: [primary.request_id],
          provenance,
        }).request_ids.length,
        humanReview: generateProceduralHumanReviewFlags({
          competence: index === 6 ? assessCompetence({ authority: "A", provenance }) : undefined,
          deadline: index === 7 ? assessDeadline({ provenance }) : undefined,
          nullity:
            index === 8 ? assessNullitySignal({ defectType: "defect", provenance }) : undefined,
        }),
      };
    });
    expect(results).toHaveLength(12);
    expect(results[0]?.remedyFit).toBe("WEAK");
    expect(results[11]?.gap).toBe("REMEDY_GAP");
  });
});
