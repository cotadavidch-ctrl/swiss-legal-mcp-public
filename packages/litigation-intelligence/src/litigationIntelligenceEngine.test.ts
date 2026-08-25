import { describe, expect, it } from "vitest";
import type {
  Argument,
  Claim,
  Evidence,
  PrecedentApplication,
  ProvenanceRef,
} from "@swiss-legal-mcp/core";
import type {
  ClaimSupportMap,
  IssuePriority,
  NarrowIssuePath,
  PrecedentApplicationAnalysis,
  ResearchSufficiency,
} from "@swiss-legal-mcp/legal-intelligence";
import {
  argumentDuelSchema,
  assessRobustness,
  bestOpponentArgumentSchema,
  buildArgumentDuel,
  buildDecisivePointMap,
  buildMinimumLosingCondition,
  buildMinimumWinningCase,
  buildMultiPerspectiveReview,
  buildOutcomeSensitivityMap,
  buildRebuildPlan,
  buildWeaknessMap,
  deriveBestWinningTheory,
  evaluateArgumentCompatibility,
  evaluateArgumentRemoval,
  evaluateConcession,
  evaluateCredibilityCost,
  evaluateEvidenceRemoval,
  evaluateInformationValue,
  evaluatePrecedentRemoval,
  evaluateResponseNecessity,
  generateBestOpponentArgument,
  generateBestReply,
  generateJudicialDecisionPath,
  generateStrategicHumanReviewFlags,
  matterTheorySchema,
  runKillTest,
  validateStrategicConclusionProvenance,
  type MatterTheory,
} from "./litigationIntelligenceEngine.js";

const provenance: ProvenanceRef[] = [
  { type: "SYSTEM_DERIVATION", system_derivation_input_ids: ["synthetic-input"] },
];

const hypotheticalProvenance: ProvenanceRef[] = [
  { type: "UNSOURCED", system_derivation_input_ids: [], note: "Synthetic adversarial scenario." },
];

const claim: Claim = {
  id: "claim-1",
  matter_id: "matter-1",
  kind: "Claim",
  claimant_actor_id: "client",
  issue_ids: ["issue-procedure"],
  elements: [
    { id: "A", proposition_id: "fact-A", status: "SATISFIED", provenance },
    { id: "B", proposition_id: "fact-B", status: "SATISFIED", provenance },
    { id: "C", proposition_id: "fact-C", status: "SATISFIED", provenance },
  ],
  remedies: [
    { remedy_type: "remand", requested_text: "Remand for decision", status: "MAIN", provenance },
  ],
  provenance,
};

const supportMap: ClaimSupportMap = {
  view_type: "CLAIM_SUPPORT_MAP",
  source_of_truth: false,
  claim_id: "claim-1",
  claim_element_ids: ["A", "B", "C", "D", "E"],
  proposition_ids: ["fact-A", "fact-B", "fact-C"],
  finding_ids: [],
  evidence_ids: ["ev-A", "ev-B", "ev-C"],
  legal_proposition_ids: ["law-1"],
  legal_authority_ids: ["auth-1"],
  precedent_application_ids: ["pa-1"],
  remedy_indexes: [0],
  gaps: [],
  provenance,
};

const issuePriority: IssuePriority = {
  issue_id: "issue-procedure",
  priority: "DISPOSITIVE",
  legal_complexity: "MEDIUM",
  evidentiary_dependence: "LOW",
  procedural_dependence: "HIGH",
  rationale: "Synthetic threshold issue.",
};

const research: ResearchSufficiency = {
  issue_id: "issue-procedure",
  status: "RESEARCH_ADEQUATE",
  governing_law_found: true,
  applicable_version_checked: true,
  favorable_case_checked: true,
  adverse_case_checked: true,
  citation_materially_verified: true,
  official_source_present: true,
  explanation: "Synthetic adequate research.",
};

const theory: MatterTheory = matterTheorySchema.parse({
  theory_id: "theory-client",
  matter_id: "matter-1",
  represented_side: "client",
  theory_type: "CLIENT_PRIMARY",
  factual_theory: "The authority received a request and had enough information to decide.",
  legal_theory: "A procedural duty to decide follows from the governing rule.",
  procedural_theory: "The appeal can be resolved on failure to decide the request.",
  requested_outcome: "Remand for a decision",
  supporting_claim_ids: ["claim-1"],
  supporting_issue_ids: ["issue-procedure"],
  supporting_evidence_ids: ["ev-A", "ev-B", "ev-C"],
  supporting_legal_proposition_ids: ["law-1"],
  supporting_precedent_application_ids: ["pa-1"],
  weaknesses: [],
  dependencies: ["issue-procedure"],
  assumptions: [],
  unresolved_questions: [],
  provenance,
  confidence: 0.72,
});

const adversePrecedent: PrecedentApplicationAnalysis = {
  precedent_authority_id: "auth-adverse",
  issue_id: "issue-procedure",
  application: "STRONGLY_ADVERSE",
  why: "A same-posture decision rejected relief when the threshold prerequisite was missing.",
  case_result: "DISMISS",
  factual_similarity: {
    similarity: "HIGH_SIMILARITY",
    matched_dimensions: ["actor_type", "legal_regime"],
    different_dimensions: [],
    explanation: "Synthetic high similarity.",
  },
  procedural_similarity: {
    similarity: "HIGH",
    matched_dimensions: ["procedural_posture"],
    different_dimensions: [],
    explanation: "Synthetic high procedural similarity.",
  },
  distinguishing_factors: [],
  cherry_picking_risk: "NONE",
  confidence: 0.76,
  provenance,
};

function makeMwc(overrides?: Partial<Parameters<typeof buildMinimumWinningCase>[0]>) {
  return buildMinimumWinningCase({
    claim,
    claimSupportMap: supportMap,
    requiredLegalPropositionIds: ["law-1"],
    requiredProceduralIssueIds: ["issue-procedure"],
    requiredEvidenceIds: ["ev-A", "ev-B", "ev-C"],
    provenance,
    ...overrides,
  });
}

describe("Phase 6 adversarial litigation intelligence", () => {
  it("A identifies an obvious procedural counterargument against a strong client argument", () => {
    const opponent = generateBestOpponentArgument({
      targetId: "arg-client",
      issueId: "issue-procedure",
      issuePriority,
      claimSupportMap: supportMap,
      research,
      provenance: hypotheticalProvenance,
    });
    expect(opponent.attack_type).toBe("PROCEDURAL_ATTACK");
    expect(opponent.steelman).toBe(true);
    expect(opponent.hypothetical_status).toBe("HYPOTHETICAL_ADVERSARIAL_ANALYSIS");
  });

  it("B steelmans the stronger available opponent argument instead of a weak one", () => {
    const opponent = generateBestOpponentArgument({
      targetId: "arg-client",
      issueId: "issue-procedure",
      issuePriority: { ...issuePriority, procedural_dependence: "LOW" },
      claimSupportMap: { ...supportMap, gaps: [] },
      precedentApplications: [adversePrecedent],
      research,
      provenance: hypotheticalProvenance,
    });
    expect(opponent.attack_type).toBe("PRECEDENT_ATTACK");
    expect(opponent.strength).toBe("STRONG");
  });

  it("C marks a partial reply and preserves residual risk", () => {
    const opponent = generateBestOpponentArgument({
      targetId: "arg-client",
      issueId: "issue-procedure",
      issuePriority,
      provenance: hypotheticalProvenance,
    });
    const reply = generateBestReply({
      opponentArgument: opponent,
      supportingEvidenceIds: ["ev-A"],
      provenance,
    });
    expect(reply.answer_status).toBe("PARTIALLY_ANSWERS");
    expect(reply.remaining_risk).toBe("HIGH");
  });

  it("D lets procedural minimalist resolve broad merits through a narrow procedural ground", () => {
    const mwc = makeMwc();
    const mlc = buildMinimumLosingCondition({
      claimId: claim.id,
      minimumWinningCase: mwc,
      provenance,
    });
    const path = generateJudicialDecisionPath({
      mode: "PROCEDURAL_MINIMALIST_JUDGE",
      issuePriorities: [issuePriority],
      minimumWinningCase: mwc,
      minimumLosingCondition: mlc,
      provenance,
    });
    expect(path.outcome_direction).toBe("PROCEDURAL_DISPOSITION");
    expect(path.threshold_issue_ids).toContain("issue-procedure");
  });

  it("E prevents evidence strict judge from granting on law alone when evidence is weak", () => {
    const weakMap: ClaimSupportMap = { ...supportMap, evidence_ids: ["ev-A"] };
    const mwc = makeMwc({ claimSupportMap: weakMap });
    const mlc = buildMinimumLosingCondition({
      claimId: claim.id,
      minimumWinningCase: mwc,
      provenance,
    });
    const path = generateJudicialDecisionPath({
      mode: "EVIDENCE_STRICT_JUDGE",
      issuePriorities: [issuePriority],
      minimumWinningCase: mwc,
      minimumLosingCondition: mlc,
      provenance,
    });
    expect(path.outcome_direction).toBe("REMAND_OR_FURTHER_FACT_FINDING");
  });

  it("F prevents favorable judge from inventing entitlement where legal element is missing", () => {
    const mwc = makeMwc({ requiredLegalPropositionIds: ["missing-law"] });
    const mlc = buildMinimumLosingCondition({
      claimId: claim.id,
      minimumWinningCase: mwc,
      provenance,
    });
    const path = generateJudicialDecisionPath({
      mode: "FAVORABLE_JUDGE",
      issuePriorities: [issuePriority],
      minimumWinningCase: mwc,
      minimumLosingCondition: mlc,
      provenance,
    });
    expect(path.outcome_direction).toBe("REMAND_OR_FURTHER_FACT_FINDING");
  });

  it("G keeps neutral and skeptical judge paths distinct but grounded", () => {
    const mwc = makeMwc();
    const mlc = buildMinimumLosingCondition({
      claimId: claim.id,
      minimumWinningCase: mwc,
      provenance,
    });
    const neutral = generateJudicialDecisionPath({
      mode: "NEUTRAL_JUDGE",
      issuePriorities: [issuePriority],
      minimumWinningCase: mwc,
      minimumLosingCondition: mlc,
      provenance,
    });
    const skeptical = generateJudicialDecisionPath({
      mode: "SKEPTICAL_JUDGE",
      issuePriorities: [issuePriority],
      minimumWinningCase: mwc,
      minimumLosingCondition: mlc,
      provenance,
    });
    expect(neutral.outcome_direction).toBe("SUPPORTS_REQUESTED_OUTCOME");
    expect(skeptical.outcome_direction).toBe("OPPOSES_REQUESTED_OUTCOME");
    expect(skeptical.not_a_prediction).toBe(true);
  });

  it("H keeps MWC to essential A+B+C and leaves D/E supporting", () => {
    const mwc = makeMwc();
    expect(mwc.essential_facts.map((element) => element.element_id)).toEqual(["A", "B", "C"]);
    expect(mwc.nonessential_supporting_arguments).toEqual(["D", "E"]);
  });

  it("I removal of essential B defeats the minimum case", () => {
    const argument: Argument = {
      id: "arg-B",
      matter_id: "matter-1",
      kind: "Argument",
      relied_proposition_ids: ["B"],
      relied_legal_proposition_ids: [],
      text: "B is essential.",
      provenance,
    };
    const removal = evaluateArgumentRemoval({
      argument,
      minimumWinningCase: makeMwc(),
      provenance,
    });
    expect(removal.effect).toBe("ESSENTIAL");
    expect(removal.case_still_reaches_requested_outcome).toBe(false);
  });

  it("J removal of supporting D does not defeat the minimum case", () => {
    const argument: Argument = {
      id: "arg-D",
      matter_id: "matter-1",
      kind: "Argument",
      relied_proposition_ids: ["D"],
      relied_legal_proposition_ids: [],
      text: "D is supporting.",
      provenance,
    };
    const removal = evaluateArgumentRemoval({
      argument,
      minimumWinningCase: makeMwc(),
      provenance,
    });
    expect(removal.effect).toBe("SUPPORTING");
    expect(removal.case_still_reaches_requested_outcome).toBe(true);
  });

  it("K kill/rebuild detects uncertain precedent fragility and seeks authority verification", () => {
    const mixed = {
      ...adversePrecedent,
      application: "MIXED" as const,
      precedent_authority_id: "auth-mixed",
    };
    const kill = runKillTest({
      theory,
      minimumWinningCase: makeMwc(),
      precedentApplications: [mixed],
      provenance,
    });
    const rebuild = buildRebuildPlan({ theory, killTest: kill, provenance });
    expect(kill.result).toBe("REQUIRES_REBUILD");
    expect(rebuild.actions.some((action) => action.action === "VERIFY_AUTHORITY")).toBe(true);
  });

  it("L recommends narrowing an overbroad remedy", () => {
    const kill = runKillTest({
      theory,
      minimumWinningCase: makeMwc(),
      overbroadRemedy: "Requested outcome exceeds the minimum procedural remedy.",
      provenance,
    });
    const rebuild = buildRebuildPlan({ theory, killTest: kill, provenance });
    expect(rebuild.actions.some((action) => action.action === "NARROW_REMEDY")).toBe(true);
  });

  it("M drops a weak accusation that is irrelevant and costly", () => {
    const cost = evaluateCredibilityCost({
      argumentId: "arg-accuse",
      unnecessaryAccusation: true,
      weakEvidence: true,
      disproportionalRhetoric: true,
      provenance,
    });
    const argument: Argument = {
      id: "arg-accuse",
      matter_id: "matter-1",
      kind: "Argument",
      relied_proposition_ids: ["irrelevant"],
      relied_legal_proposition_ids: [],
      text: "Emotionally attractive accusation.",
      provenance,
    };
    const removal = evaluateArgumentRemoval({
      argument,
      minimumWinningCase: makeMwc(),
      isEmotionallyAttractive: true,
      overstates: true,
      provenance,
    });
    expect(cost.credibility_cost).toBe("HIGH");
    expect(removal.effect).toBe("HARMFUL_POSSIBLE");
  });

  it("N marks concession on immaterial point as safe", () => {
    const concession = evaluateConcession({
      concessionId: "conc-1",
      targetId: "peripheral-fact",
      minimumWinningCase: makeMwc(),
      provenance,
    });
    expect(concession.classification).toBe("SAFE");
  });

  it("O marks concession removing an essential element as fatal", () => {
    const concession = evaluateConcession({
      concessionId: "conc-2",
      targetId: "A",
      minimumWinningCase: makeMwc(),
      undermines: ["ESSENTIAL_FACT"],
      provenance,
    });
    expect(concession.classification).toBe("FATAL");
  });

  it("P classifies only necessary arguments as essential or important", () => {
    const mwc = makeMwc();
    const results = ["A", "B", "C", "D", "E"].map((id) =>
      evaluateArgumentRemoval({
        argument: {
          id: `arg-${id}`,
          matter_id: "matter-1",
          kind: "Argument",
          relied_proposition_ids: [id],
          relied_legal_proposition_ids: [],
          text: `Argument ${id}`,
          provenance,
        },
        minimumWinningCase: mwc,
        provenance,
      }),
    );
    expect(results.filter((result) => result.effect === "ESSENTIAL")).toHaveLength(3);
    expect(results.filter((result) => result.effect === "SUPPORTING")).toHaveLength(2);
  });

  it("Q treats immaterial adverse point as optional or better not to engage", () => {
    const cost = evaluateCredibilityCost({
      argumentId: "minor",
      unnecessaryAccusation: true,
      provenance,
    });
    const necessity = evaluateResponseNecessity({
      pointId: "minor",
      materiality: "LOW",
      credibilityCost: cost.credibility_cost,
      inMinimumWinningCase: false,
      provenance,
    });
    expect(["OPTIONAL", "BETTER_NOT_TO_ENGAGE"]).toContain(necessity.necessity);
  });

  it("R does not call a case robust when a procedural prerequisite is uncertain", () => {
    const robustness = assessRobustness({
      legal: "STRONG",
      factual: "STRONG",
      evidentiary: "STRONG",
      procedural: "FRAGILE",
      precedential: "STRONG",
      remedial: "STRONG",
      adversarial: "MODERATE",
      provenance,
    });
    expect(robustness.overall).not.toBe("ROBUST");
    expect(robustness.weakest_dimension).toBe("PROCEDURAL");
    expect(robustness.no_probability).toBe(true);
  });

  it("S preserves precedential weakness even with strong evidence", () => {
    const robustness = assessRobustness({
      legal: "STRONG",
      factual: "VERY_STRONG",
      evidentiary: "VERY_STRONG",
      procedural: "STRONG",
      precedential: "WEAK",
      remedial: "STRONG",
      adversarial: "MODERATE",
      provenance,
    });
    expect(robustness.overall).toBe("FRAGILE");
    expect(robustness.weakest_dimension).toBe("PRECEDENTIAL");
  });

  it("T requires provenance or explicit hypothetical/unsourced marking", () => {
    expect(validateStrategicConclusionProvenance({ provenance: [], hypothetical: false })).toBe(
      false,
    );
    expect(
      validateStrategicConclusionProvenance({
        provenance: hypotheticalProvenance,
        hypothetical: true,
      }),
    ).toBe(true);
  });

  it("U rejects opponent hypothetical presented as fact", () => {
    expect(() =>
      bestOpponentArgumentSchema.parse({
        view_type: "BEST_OPPONENT_ARGUMENT",
        source_of_truth: false,
        argument_id: "bad",
        attack_type: "LEGAL_ATTACK",
        steelman: true,
        hypothetical_status: "ACTUAL_FACT",
        supporting_fact_ids: [],
        supporting_evidence_ids: [],
        supporting_law_ids: [],
        assumptions: ["bad"],
        strength: "MODERATE",
        likely_judicial_relevance: "MEDIUM",
        explanation: "bad",
        provenance,
      }),
    ).toThrow();
  });

  it("V flags contradiction of a human-locked strategic state as review required", () => {
    const flags = generateStrategicHumanReviewFlags({
      lockedReviewState: { status: "HUMAN_LOCKED", locked_by: "reviewer" },
      proposedSystemStatus: "REVIEW_REQUIRED",
    });
    expect(flags).toContain("HUMAN_LOCK_CONFLICT_REVIEW_REQUIRED");
  });

  it("builds best winning theory without equating aggressiveness with strength", () => {
    const aggressive = matterTheorySchema.parse({
      ...theory,
      theory_id: "aggressive",
      assumptions: ["unverified inference", "overbroad inference"],
      weaknesses: ["accusatory framing"],
      supporting_evidence_ids: ["ev-A"],
    });
    const best = deriveBestWinningTheory({
      theories: [aggressive, theory],
      claimSupportMaps: [supportMap],
      issuePriorities: [issuePriority],
      research: [research],
      provenance,
    });
    expect(best.theory_id).toBe("theory-client");
    expect(best.source_of_truth).toBe(false);
  });

  it("builds argument duel with one sur-rebuttal level", () => {
    const opponent = generateBestOpponentArgument({
      targetId: "arg-client",
      issuePriority,
      provenance: hypotheticalProvenance,
    });
    const reply = generateBestReply({
      opponentArgument: opponent,
      supportingEvidenceIds: ["ev-A"],
      provenance,
    });
    const duel = buildArgumentDuel({
      ourArgumentId: "arg-client",
      opponentArgument: opponent,
      bestReply: reply,
      provenance,
    });
    expect(argumentDuelSchema.parse(duel).opponent_sur_rebuttal).toContain("unanswered");
  });

  it("evaluates evidence and precedent removal without mutating state", () => {
    const mwc = makeMwc();
    const evidence: Evidence = {
      id: "ev-A",
      matter_id: "matter-1",
      kind: "Evidence",
      evidence_type: "DOCUMENT",
      source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
      supported_proposition_ids: ["fact-A"],
      evidence_use: "FULL_TEXT_EVIDENCE",
      provenance,
    };
    const evidenceRemoval = evaluateEvidenceRemoval({
      evidence,
      minimumWinningCase: mwc,
      provenance,
    });
    const precedent: PrecedentApplication = {
      id: "pa-1",
      matter_id: "matter-1",
      kind: "PrecedentApplication",
      legal_authority_id: "law-1",
      issue_id: "issue-procedure",
      application: "SUPPORTIVE",
      favorable_aspects: ["same principle"],
      adverse_aspects: [],
      ratio_respected: true,
      provenance,
    };
    const precedentRemoval = evaluatePrecedentRemoval({
      precedent,
      minimumWinningCase: mwc,
      provenance,
    });
    expect(evidenceRemoval.effect).toBe("CRITICAL_EVIDENCE");
    expect(evidenceRemoval.matter_mutated).toBe(false);
    expect(precedentRemoval.effect).toBe("FRAGILE_DEPENDENCE");
  });

  it("builds decisive points, sensitivity, information value, compatibility and multi-perspective review", () => {
    const narrowPath: NarrowIssuePath = {
      view_type: "NARROW_ISSUE_PATH",
      source_of_truth: false,
      primary_issue_ids: ["issue-procedure"],
      subsidiary_issue_ids: ["issue-merits"],
      potentially_mooted_issue_ids: [],
      rationale: "Synthetic narrow path.",
      provenance,
    };
    const mwc = makeMwc();
    const mlc = buildMinimumLosingCondition({
      claimId: claim.id,
      minimumWinningCase: mwc,
      provenance,
    });
    const decisive = buildDecisivePointMap({
      minimumWinningCase: mwc,
      minimumLosingCondition: mlc,
      provenance,
    });
    const sensitivity = buildOutcomeSensitivityMap({
      objects: [{ id: "ev-A", type: "EVIDENCE", decisive: true }],
      provenance,
    });
    const info = evaluateInformationValue({
      requestId: "req-info",
      affectsMinimumWinningCase: true,
      mayResolveLosingCondition: true,
      provenance,
    });
    const compatibility = evaluateArgumentCompatibility({
      argumentAId: "arg-1",
      argumentBId: "arg-2",
      factualTheoryA: "X",
      factualTheoryB: "Y",
      legallyLayered: false,
      provenance,
    });
    const paths = [
      "NEUTRAL_JUDGE",
      "SKEPTICAL_JUDGE",
      "FAVORABLE_JUDGE",
      "PROCEDURAL_MINIMALIST_JUDGE",
      "EVIDENCE_STRICT_JUDGE",
    ].map((mode) =>
      generateJudicialDecisionPath({
        mode: mode as Parameters<typeof generateJudicialDecisionPath>[0]["mode"],
        issuePriorities: [issuePriority],
        narrowIssuePath: narrowPath,
        minimumWinningCase: mwc,
        minimumLosingCondition: mlc,
        provenance,
      }),
    );
    const best = deriveBestWinningTheory({
      theories: [theory],
      claimSupportMaps: [supportMap],
      issuePriorities: [issuePriority],
      research: [research],
      provenance,
    });
    const opponent = generateBestOpponentArgument({
      targetId: "arg-client",
      issuePriority,
      provenance: hypotheticalProvenance,
    });
    const kill = runKillTest({ theory, minimumWinningCase: mwc, provenance });
    const review = buildMultiPerspectiveReview({
      ourBestCase: best,
      opponentBestCase: opponent,
      paths,
      minimumWinningCase: mwc,
      minimumLosingCondition: mlc,
      ownWeaknesses: buildWeaknessMap({ side: "OWN", minimumWinningCase: mwc, provenance }),
      opponentWeaknesses: buildWeaknessMap({
        side: "OPPONENT",
        precedentApplications: [adversePrecedent],
        provenance,
      }),
      decisivePoints: decisive,
      rebuildPlan: buildRebuildPlan({ theory, killTest: kill, provenance }),
      provenance,
    });
    expect(decisive.source_of_truth).toBe(false);
    expect(sensitivity.sensitivities[0]?.could_change_path).toBe(true);
    expect(info.value).toBe("DECISIVE_INFORMATION");
    expect(compatibility.compatibility).toBe("MUTUALLY_EXCLUSIVE");
    expect(review.view_type).toBe("MULTI_PERSPECTIVE_REVIEW");
  });

  it("runs adversarial synthetic scenario categories required for Phase 6", () => {
    const scenarios = [
      "strong merits / weak procedure",
      "weak merits / strong procedure",
      "strong evidence / adverse precedent",
      "weak evidence / favorable precedent",
      "multiple alternative theories",
      "overbroad remedy",
      "safe concession",
      "fatal concession",
      "narrow procedural disposal",
      "mixed precedent",
      "unresolved essential fact",
      "distracting but emotionally attractive argument",
    ];
    const outcomes = scenarios.map((name, index) => {
      const localClaim =
        index === 10
          ? { ...claim, elements: [{ ...claim.elements[0]!, status: "UNKNOWN" as const }] }
          : claim;
      const localMwc = makeMwc({ claim: localClaim });
      const opponent = generateBestOpponentArgument({
        targetId: `scenario-${index}`,
        issuePriority,
        claimSupportMap:
          index === 3
            ? {
                ...supportMap,
                gaps: [
                  {
                    id: "gap",
                    element_type: "EVIDENTIARY_REQUIREMENT",
                    status: "EVIDENTIARY_GAP",
                    explanation: "weak evidence",
                    dependencies: [],
                    evidence_ids: [],
                    provenance,
                  },
                ],
              }
            : supportMap,
        precedentApplications: index === 2 || index === 9 ? [adversePrecedent] : [],
        provenance: hypotheticalProvenance,
      });
      const mlc = buildMinimumLosingCondition({
        claimId: localClaim.id,
        minimumWinningCase: localMwc,
        provenance,
      });
      const kill = runKillTest({
        theory,
        minimumWinningCase: localMwc,
        precedentApplications: index === 9 ? [{ ...adversePrecedent, application: "MIXED" }] : [],
        overbroadRemedy: index === 5 ? "Remedy broader than minimum path." : undefined,
        provenance,
      });
      return {
        name,
        steelman: opponent.steelman,
        judgeMode: generateJudicialDecisionPath({
          mode: index === 8 ? "PROCEDURAL_MINIMALIST_JUDGE" : "NEUTRAL_JUDGE",
          issuePriorities: [issuePriority],
          minimumWinningCase: localMwc,
          minimumLosingCondition: mlc,
          provenance,
        }).not_a_prediction,
        mwc: localMwc.source_of_truth === false,
        losing: mlc.source_of_truth === false,
        kill: kill.source_of_truth === false,
        rebuild: buildRebuildPlan({ theory, killTest: kill, provenance }).no_new_facts_invented,
        economy:
          evaluateResponseNecessity({
            pointId: `scenario-${index}`,
            materiality: index === 11 ? "LOW" : "HIGH",
            credibilityCost: index === 11 ? "HIGH" : "LOW",
            inMinimumWinningCase: index < 2,
            provenance,
          }).source_of_truth === false,
      };
    });
    expect(outcomes).toHaveLength(12);
    expect(outcomes.every((outcome) => Object.values(outcome).every(Boolean))).toBe(true);
  });
});
