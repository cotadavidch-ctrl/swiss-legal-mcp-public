import { z } from "zod";
import {
  confidenceSchema,
  evaluateHumanLockConflict,
  provenanceRefSchema,
  type Argument,
  type Claim,
  type Evidence,
  type PrecedentApplication,
  type ProvenanceRef,
  type ReviewState,
} from "@swiss-legal-mcp/core";
import type { RequestDispositionMap } from "@swiss-legal-mcp/chronology";
import type { ContradictionAssessmentResult } from "@swiss-legal-mcp/contradiction-engine";
import type {
  ClaimSupportMap,
  IssueDependency,
  IssueLawMap,
  IssuePriority,
  NarrowIssuePath,
  PrecedentApplicationAnalysis,
  ResearchSufficiency,
} from "@swiss-legal-mcp/legal-intelligence";

const idSchema = z.string().min(1);
const provenanceSchema = z.array(provenanceRefSchema).min(1);

export const strengthSchema = z.enum([
  "VERY_STRONG",
  "STRONG",
  "MODERATE",
  "FRAGILE",
  "WEAK",
  "VERY_WEAK",
  "UNKNOWN",
]);
export type Strength = z.infer<typeof strengthSchema>;

export const residualRiskSchema = z.enum([
  "NONE_IDENTIFIED",
  "LOW",
  "MODERATE",
  "HIGH",
  "CRITICAL",
  "UNKNOWN",
]);
export type ResidualRisk = z.infer<typeof residualRiskSchema>;

export const matterTheorySchema = z.object({
  theory_id: idSchema,
  matter_id: idSchema,
  represented_side: z.string().min(1),
  theory_type: z.enum([
    "CLIENT_PRIMARY",
    "CLIENT_ALTERNATIVE",
    "OPPONENT_PRIMARY",
    "OPPONENT_ALTERNATIVE",
    "NEUTRAL_RECONSTRUCTION",
  ]),
  factual_theory: z.string().min(1),
  legal_theory: z.string().min(1),
  procedural_theory: z.string().min(1),
  requested_outcome: z.string().min(1),
  supporting_claim_ids: z.array(idSchema).default([]),
  supporting_issue_ids: z.array(idSchema).default([]),
  supporting_evidence_ids: z.array(idSchema).default([]),
  supporting_legal_proposition_ids: z.array(idSchema).default([]),
  supporting_precedent_application_ids: z.array(idSchema).default([]),
  contradiction_ids: z.array(idSchema).default([]),
  weaknesses: z.array(z.string().min(1)).default([]),
  dependencies: z.array(idSchema).default([]),
  assumptions: z.array(z.string().min(1)).default([]),
  unresolved_questions: z.array(z.string().min(1)).default([]),
  provenance: provenanceSchema,
  confidence: confidenceSchema,
  human_review_state: z
    .object({
      status: z.enum(["UNREVIEWED", "HUMAN_VERIFIED", "HUMAN_LOCKED", "REVIEW_REQUIRED"]),
      locked_by: idSchema.optional(),
      locked_at: z.iso.datetime({ offset: true }).optional(),
      reviewed_at: z.iso.datetime({ offset: true }).optional(),
      note: z.string().min(1).optional(),
    })
    .optional(),
});
export type MatterTheory = z.infer<typeof matterTheorySchema>;

const ordinalAssessmentSchema = z.object({
  legal_strength: strengthSchema,
  factual_strength: strengthSchema,
  evidentiary_strength: strengthSchema,
  procedural_strength: strengthSchema,
  remedial_fit: strengthSchema,
  adversarial_resilience: strengthSchema,
});

export const bestWinningTheorySchema = z.object({
  view_type: z.literal("BEST_WINNING_THEORY"),
  source_of_truth: z.literal(false),
  theory_id: idSchema,
  matter_id: idSchema,
  requested_outcome: z.string().min(1),
  rationale: z.string().min(1),
  ordinal_assessment: ordinalAssessmentSchema,
  unnecessary_assumptions: z.array(z.string().min(1)),
  disputed_fact_dependencies: z.array(idSchema),
  uncertain_law_dependencies: z.array(idSchema),
  credibility_cost: z.enum(["NONE", "LOW", "MODERATE", "HIGH", "UNKNOWN"]),
  complexity: z.enum(["LOW", "MODERATE", "HIGH", "UNKNOWN"]),
  provenance: provenanceSchema,
});
export type BestWinningTheory = z.infer<typeof bestWinningTheorySchema>;

export const bestOpponentArgumentSchema = z.object({
  view_type: z.literal("BEST_OPPONENT_ARGUMENT"),
  source_of_truth: z.literal(false),
  argument_id: idSchema,
  proposition_attacked_id: idSchema.optional(),
  issue_id: idSchema.optional(),
  attack_type: z.enum([
    "FACTUAL_ATTACK",
    "EVIDENTIARY_ATTACK",
    "LEGAL_ATTACK",
    "PRECEDENT_ATTACK",
    "PROCEDURAL_ATTACK",
    "REMEDY_ATTACK",
    "STANDING_ADMISSIBILITY_ATTACK",
    "SCOPE_ATTACK",
    "CHRONOLOGY_ATTACK",
    "BURDEN_ATTACK",
    "ALTERNATIVE_CHARACTERIZATION",
  ]),
  steelman: z.literal(true),
  hypothetical_status: z.literal("HYPOTHETICAL_ADVERSARIAL_ANALYSIS"),
  supporting_fact_ids: z.array(idSchema),
  supporting_evidence_ids: z.array(idSchema),
  supporting_law_ids: z.array(idSchema),
  assumptions: z.array(z.string().min(1)),
  strength: strengthSchema,
  likely_judicial_relevance: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type BestOpponentArgument = z.infer<typeof bestOpponentArgumentSchema>;

export const bestReplySchema = z.object({
  view_type: z.literal("BEST_REPLY"),
  source_of_truth: z.literal(false),
  reply_id: idSchema,
  opponent_argument_id: idSchema,
  answer_status: z.enum([
    "FULLY_ANSWERS",
    "SUBSTANTIALLY_ANSWERS",
    "PARTIALLY_ANSWERS",
    "DOES_NOT_ANSWER",
    "CREATES_NEW_RISK",
    "UNKNOWN",
  ]),
  legal_response: z.string().min(1),
  factual_response: z.string().min(1),
  evidentiary_response: z.string().min(1),
  distinction: z.string().min(1),
  useful_concession: z.string().min(1).optional(),
  remaining_risk: residualRiskSchema,
  provenance: provenanceSchema,
});
export type BestReply = z.infer<typeof bestReplySchema>;

export const argumentDuelSchema = z.object({
  view_type: z.literal("ARGUMENT_DUEL"),
  source_of_truth: z.literal(false),
  our_argument_id: idSchema,
  best_opponent_argument: bestOpponentArgumentSchema,
  best_reply: bestReplySchema,
  opponent_sur_rebuttal: z.string().min(1),
  residual_risk: residualRiskSchema,
  provenance: provenanceSchema,
});
export type ArgumentDuel = z.infer<typeof argumentDuelSchema>;

export const judgeModeSchema = z.enum([
  "NEUTRAL_JUDGE",
  "SKEPTICAL_JUDGE",
  "FAVORABLE_JUDGE",
  "PROCEDURAL_MINIMALIST_JUDGE",
  "EVIDENCE_STRICT_JUDGE",
  "RIGHTS_PROTECTIVE_JUDGE",
]);
export type JudgeMode = z.infer<typeof judgeModeSchema>;

export const judicialDecisionPathSchema = z.object({
  view_type: z.literal("JUDICIAL_DECISION_PATH"),
  source_of_truth: z.literal(false),
  mode: judgeModeSchema,
  threshold_issue_ids: z.array(idSchema),
  accepted_fact_ids: z.array(idSchema),
  rejected_or_unresolved_fact_ids: z.array(idSchema),
  governing_legal_proposition_ids: z.array(idSchema),
  issue_sequence: z.array(idSchema),
  dispositive_issue_id: idSchema.optional(),
  unnecessary_issue_ids: z.array(idSchema),
  likely_reasoning_path: z.string().min(1),
  outcome_direction: z.enum([
    "SUPPORTS_REQUESTED_OUTCOME",
    "PARTIALLY_SUPPORTS",
    "OPPOSES_REQUESTED_OUTCOME",
    "REMAND_OR_FURTHER_FACT_FINDING",
    "PROCEDURAL_DISPOSITION",
    "INDETERMINATE",
  ]),
  assumptions: z.array(z.string().min(1)),
  vulnerabilities: z.array(z.string().min(1)),
  not_a_prediction: z.literal(true),
  provenance: provenanceSchema,
});
export type JudicialDecisionPath = z.infer<typeof judicialDecisionPathSchema>;

const minimumElementSchema = z.object({
  element_id: idSchema,
  element_type: z.enum([
    "ESSENTIAL_FACT",
    "ESSENTIAL_EVIDENCE",
    "ESSENTIAL_LEGAL_PROPOSITION",
    "ESSENTIAL_PROCEDURAL_PREREQUISITE",
    "ESSENTIAL_REMEDY_ELEMENT",
  ]),
  status: z.enum(["SATISFIED", "PARTIALLY_SATISFIED", "MISSING", "DISPUTED", "UNCERTAIN"]),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});

export const minimumWinningCaseSchema = z.object({
  view_type: z.literal("MINIMUM_WINNING_CASE"),
  source_of_truth: z.literal(false),
  claim_id: idSchema,
  essential_facts: z.array(minimumElementSchema),
  essential_evidence: z.array(minimumElementSchema),
  essential_legal_propositions: z.array(minimumElementSchema),
  essential_procedural_prerequisites: z.array(minimumElementSchema),
  essential_remedy_elements: z.array(minimumElementSchema),
  nonessential_supporting_arguments: z.array(idSchema),
  satisfied: z.boolean(),
  unresolved_essential_ids: z.array(idSchema),
  provenance: provenanceSchema,
});
export type MinimumWinningCase = z.infer<typeof minimumWinningCaseSchema>;

export const minimumLosingConditionSchema = z.object({
  view_type: z.literal("MINIMUM_LOSING_CONDITION"),
  source_of_truth: z.literal(false),
  condition_id: idSchema,
  claim_id: idSchema,
  condition_type: z.enum([
    "NO_STANDING",
    "MISSED_DEADLINE",
    "NO_EVIDENCE_FOR_ESSENTIAL_ELEMENT",
    "WRONG_REMEDY",
    "DISPOSITIVE_ADVERSE_PRECEDENT",
    "LACK_OF_JURISDICTION",
    "ESSENTIAL_LEGAL_GAP",
    "UNKNOWN",
  ]),
  affected_element_ids: z.array(idSchema),
  explanation: z.string().min(1),
  residual_risk: residualRiskSchema,
  provenance: provenanceSchema,
});
export type MinimumLosingCondition = z.infer<typeof minimumLosingConditionSchema>;

export const killTestResultSchema = z.object({
  view_type: z.literal("KILL_TEST"),
  source_of_truth: z.literal(false),
  theory_id: idSchema,
  weakest_factual_proposition_id: idSchema.optional(),
  weakest_legal_proposition_id: idSchema.optional(),
  easiest_precedent_to_distinguish_id: idSchema.optional(),
  vulnerable_procedural_prerequisite_id: idSchema.optional(),
  overbroad_remedy: z.string().min(1).optional(),
  damaging_contradiction_id: idSchema.optional(),
  hidden_assumption: z.string().min(1).optional(),
  skeptical_judge_first_point: z.string().min(1),
  result: z.enum(["SURVIVES", "SURVIVES_WITH_MATERIAL_RISK", "REQUIRES_REBUILD", "FAILS"]),
  provenance: provenanceSchema,
});
export type KillTestResult = z.infer<typeof killTestResultSchema>;

export const argumentRemovalTestSchema = z.object({
  view_type: z.literal("ARGUMENT_REMOVAL_TEST"),
  source_of_truth: z.literal(false),
  argument_id: idSchema,
  effect: z.enum([
    "ESSENTIAL",
    "IMPORTANT",
    "SUPPORTING",
    "REDUNDANT",
    "DISTRACTING",
    "HARMFUL_POSSIBLE",
  ]),
  case_still_reaches_requested_outcome: z.boolean(),
  explanation: z.string().min(1),
  matter_mutated: z.literal(false),
  provenance: provenanceSchema,
});
export type ArgumentRemovalTest = z.infer<typeof argumentRemovalTestSchema>;

export const evidenceRemovalTestSchema = z.object({
  view_type: z.literal("EVIDENCE_REMOVAL_TEST"),
  source_of_truth: z.literal(false),
  evidence_id: idSchema,
  effect: z.enum(["CRITICAL_EVIDENCE", "HIGH_VALUE", "CORROBORATIVE", "LOW_VALUE", "REDUNDANT"]),
  collapsed_element_ids: z.array(idSchema),
  matter_mutated: z.literal(false),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type EvidenceRemovalTest = z.infer<typeof evidenceRemovalTestSchema>;

export const precedentRemovalTestSchema = z.object({
  view_type: z.literal("PRECEDENT_REMOVAL_TEST"),
  source_of_truth: z.literal(false),
  precedent_application_id: idSchema,
  legal_theory_survives: z.boolean(),
  effect: z.enum(["FRAGILE_DEPENDENCE", "IMPORTANT", "SUPPORTING", "REDUNDANT", "UNKNOWN"]),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type PrecedentRemovalTest = z.infer<typeof precedentRemovalTestSchema>;

export const rebuildPlanSchema = z.object({
  view_type: z.literal("REBUILD_PLAN"),
  source_of_truth: z.literal(false),
  theory_id: idSchema,
  actions: z.array(
    z.object({
      action: z.enum([
        "STRENGTHEN_WITH_EXISTING_EVIDENCE",
        "REQUEST_EVIDENCE",
        "VERIFY_AUTHORITY",
        "NARROW_CLAIM",
        "NARROW_REMEDY",
        "RECHARACTERIZE_LEGAL_THEORY",
        "USE_ALTERNATIVE_THEORY",
        "DROP_ARGUMENT",
        "SUBORDINATE_ARGUMENT",
        "CONCEDE_SAFE_POINT",
        "CLARIFY_FACT",
        "ADDRESS_ADVERSE_PRECEDENT",
        "PRESERVE_FOR_REVIEW",
        "HUMAN_REVIEW_REQUIRED",
      ]),
      target_id: idSchema.optional(),
      reason: z.string().min(1),
    }),
  ),
  no_new_facts_invented: z.literal(true),
  provenance: provenanceSchema,
});
export type RebuildPlan = z.infer<typeof rebuildPlanSchema>;

export const concessionAnalysisSchema = z.object({
  view_type: z.literal("SAFE_CONCESSION_ANALYSIS"),
  source_of_truth: z.literal(false),
  concession_id: idSchema,
  target_id: idSchema,
  classification: z.enum(["SAFE", "LIKELY_SAFE", "CONDITIONAL", "RISKY", "FATAL", "UNKNOWN"]),
  undermines: z.array(
    z.enum([
      "ESSENTIAL_FACT",
      "STANDING",
      "JURISDICTION",
      "CLAIM_ELEMENT",
      "REMEDY",
      "LEGAL_CHARACTERIZATION",
      "TEMPORAL_APPLICABILITY",
    ]),
  ),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type ConcessionAnalysis = z.infer<typeof concessionAnalysisSchema>;

export const responseNecessitySchema = z.object({
  view_type: z.literal("RESPONSE_NECESSITY"),
  source_of_truth: z.literal(false),
  point_id: idSchema,
  necessity: z.enum([
    "MUST_RESPOND",
    "SHOULD_RESPOND",
    "OPTIONAL",
    "BETTER_NOT_TO_ENGAGE",
    "IRRELEVANT",
  ]),
  rationale: z.string().min(1),
  provenance: provenanceSchema,
});
export type ResponseNecessity = z.infer<typeof responseNecessitySchema>;

export const weaknessMapSchema = z.object({
  view_type: z.enum(["OWN_WEAKNESS_MAP", "OPPONENT_WEAKNESS_MAP"]),
  source_of_truth: z.literal(false),
  weaknesses: z.array(
    z.object({
      weakness_id: idSchema,
      weakness_type: z.enum([
        "FACTUAL",
        "EVIDENTIARY",
        "LEGAL",
        "PROCEDURAL",
        "PRECEDENT",
        "REMEDY",
        "CONTRADICTION",
        "CREDIBILITY",
        "DEPENDENCY",
      ]),
      materiality: z.enum(["DISPOSITIVE", "HIGH", "SUPPORTING", "LOW", "UNKNOWN"]),
      description: z.string().min(1),
      provenance: provenanceSchema,
    }),
  ),
});

export const decisivePointMapSchema = z.object({
  view_type: z.literal("DECISIVE_POINT_MAP"),
  source_of_truth: z.literal(false),
  points: z.array(
    z.object({
      point_id: idSchema,
      category: z.enum([
        "POTENTIAL_KILL_POINT",
        "POTENTIAL_WIN_POINT",
        "THRESHOLD_POINT",
        "EVIDENTIARY_PIVOT",
        "PROCEDURAL_PIVOT",
        "REMEDY_PIVOT",
        "NOT_DECISIVE",
      ]),
      basis: z.string().min(1),
      provenance: provenanceSchema,
    }),
  ),
});
export type DecisivePointMap = z.infer<typeof decisivePointMapSchema>;

export const theoryCompetitionSchema = z.object({
  theory_id: idSchema,
  role: z.enum(["PRIMARY", "ALTERNATIVE", "EVENTUAL", "RESERVE", "DROP"]),
  legal_simplicity: strengthSchema,
  evidence_dependence: strengthSchema,
  procedural_risk: residualRiskSchema,
  precedent_quality: strengthSchema,
  counterargument_exposure: residualRiskSchema,
  remedy_fit: strengthSchema,
  judicial_economy: strengthSchema,
  credibility: strengthSchema,
  rationale: z.string().min(1),
});
export type TheoryCompetition = z.infer<typeof theoryCompetitionSchema>;

export const argumentCompatibilitySchema = z.object({
  argument_a_id: idSchema,
  argument_b_id: idSchema,
  compatibility: z.enum([
    "COMPATIBLE",
    "TENSION",
    "CONDITIONALLY_COMPATIBLE",
    "MUTUALLY_EXCLUSIVE",
    "UNKNOWN",
  ]),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type ArgumentCompatibility = z.infer<typeof argumentCompatibilitySchema>;

export const credibilityCostSchema = z.object({
  argument_id: idSchema,
  credibility_cost: z.enum(["NONE", "LOW", "MODERATE", "HIGH", "UNKNOWN"]),
  factors: z.array(
    z.enum([
      "OVERSTATEMENT",
      "WEAK_EVIDENCE",
      "IGNORED_ADVERSE_PRECEDENT",
      "UNNECESSARY_ACCUSATION",
      "INCONSISTENCY",
      "IMPLAUSIBLE_INFERENCE",
      "DISPROPORTIONAL_RHETORIC",
    ]),
  ),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type CredibilityCost = z.infer<typeof credibilityCostSchema>;

export const judicialCredibilityProfileSchema = z.object({
  view_type: z.literal("JUDICIAL_CREDIBILITY_PROFILE"),
  source_of_truth: z.literal(false),
  factual_precision: strengthSchema,
  citation_accuracy: strengthSchema,
  concession_disciplined: strengthSchema,
  adverse_law_acknowledged: strengthSchema,
  proportionality_of_claims: strengthSchema,
  evidence_calibration: strengthSchema,
  procedural_focus: strengthSchema,
  consistency: strengthSchema,
  no_psychological_claims: z.literal(true),
  provenance: provenanceSchema,
});
export type JudicialCredibilityProfile = z.infer<typeof judicialCredibilityProfileSchema>;

export const robustnessAssessmentSchema = z.object({
  view_type: z.literal("ROBUSTNESS_ASSESSMENT"),
  source_of_truth: z.literal(false),
  legal: strengthSchema,
  factual: strengthSchema,
  evidentiary: strengthSchema,
  procedural: strengthSchema,
  precedential: strengthSchema,
  remedial: strengthSchema,
  adversarial: strengthSchema,
  overall: z.enum(["ROBUST", "GENERALLY_ROBUST", "MIXED", "FRAGILE", "CRITICAL", "UNKNOWN"]),
  weakest_dimension: z.enum([
    "LEGAL",
    "FACTUAL",
    "EVIDENTIARY",
    "PROCEDURAL",
    "PRECEDENTIAL",
    "REMEDIAL",
    "ADVERSARIAL",
    "UNKNOWN",
  ]),
  no_probability: z.literal(true),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type RobustnessAssessment = z.infer<typeof robustnessAssessmentSchema>;

export const outcomeSensitivityMapSchema = z.object({
  view_type: z.literal("OUTCOME_SENSITIVITY_MAP"),
  source_of_truth: z.literal(false),
  sensitivities: z.array(
    z.object({
      object_id: idSchema,
      sensitivity_type: z.enum(["FACT", "EVIDENCE", "LAW", "PROCEDURE", "PRECEDENT", "REMEDY"]),
      could_change_path: z.boolean(),
      explanation: z.string().min(1),
      provenance: provenanceSchema,
    }),
  ),
});
export type OutcomeSensitivityMap = z.infer<typeof outcomeSensitivityMapSchema>;

export const informationValueSchema = z.object({
  request_id: idSchema,
  value: z.enum([
    "DECISIVE_INFORMATION",
    "HIGH_VALUE",
    "MODERATE_VALUE",
    "LOW_VALUE",
    "UNLIKELY_TO_CHANGE_STRATEGY",
    "UNKNOWN",
  ]),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type InformationValue = z.infer<typeof informationValueSchema>;

export const candidateActionSchema = z.enum([
  "VERIFY",
  "REQUEST_EVIDENCE",
  "CLARIFY",
  "RESEARCH",
  "CONCEDE",
  "DROP",
  "STRENGTHEN",
  "DISTINGUISH",
  "ADDRESS",
  "PRESERVE",
]);
export type CandidateAction = z.infer<typeof candidateActionSchema>;

export const multiPerspectiveReviewSchema = z.object({
  view_type: z.literal("MULTI_PERSPECTIVE_REVIEW"),
  source_of_truth: z.literal(false),
  our_best_case: bestWinningTheorySchema,
  opponent_best_case: bestOpponentArgumentSchema,
  neutral_judge_path: judicialDecisionPathSchema,
  skeptical_judge_path: judicialDecisionPathSchema,
  favorable_judge_path: judicialDecisionPathSchema,
  procedural_minimalist_path: judicialDecisionPathSchema,
  evidence_strict_path: judicialDecisionPathSchema,
  minimum_winning_case: minimumWinningCaseSchema,
  minimum_losing_condition: minimumLosingConditionSchema,
  own_weaknesses: weaknessMapSchema,
  opponent_weaknesses: weaknessMapSchema,
  decisive_points: decisivePointMapSchema,
  rebuild_plan: rebuildPlanSchema,
  residual_risks: z.array(residualRiskSchema),
  provenance: provenanceSchema,
});
export type MultiPerspectiveReview = z.infer<typeof multiPerspectiveReviewSchema>;

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const hasExplicitUnsourced = (provenance: ProvenanceRef[]): boolean =>
  provenance.some((item) => item.type === "UNSOURCED" || item.type === "SYSTEM_DERIVATION");

const strengthRank: Record<Strength, number> = {
  VERY_STRONG: 6,
  STRONG: 5,
  MODERATE: 4,
  FRAGILE: 3,
  WEAK: 2,
  VERY_WEAK: 1,
  UNKNOWN: 0,
};

const minStrength = (values: Strength[]): Strength => {
  const ranked = values.sort((a, b) => strengthRank[a] - strengthRank[b]);
  return ranked[0] ?? "UNKNOWN";
};

export function deriveBestWinningTheory(input: {
  theories: MatterTheory[];
  claimSupportMaps: ClaimSupportMap[];
  issuePriorities: IssuePriority[];
  research: ResearchSufficiency[];
  provenance: ProvenanceRef[];
}): BestWinningTheory {
  const clientTheories = input.theories.filter((theory) => theory.theory_type.startsWith("CLIENT"));
  const scored = clientTheories.map((theory) => {
    const claimMaps = input.claimSupportMaps.filter((map) =>
      theory.supporting_claim_ids.includes(map.claim_id),
    );
    const unresolvedGaps = claimMaps.flatMap((map) => map.gaps).length;
    const priorityBoost = input.issuePriorities.filter(
      (priority) =>
        theory.supporting_issue_ids.includes(priority.issue_id) &&
        ["DISPOSITIVE", "HIGH"].includes(priority.priority),
    ).length;
    const weakResearch = input.research.filter(
      (item) =>
        theory.supporting_issue_ids.includes(item.issue_id) &&
        ["RESEARCH_WEAK", "RESEARCH_NOT_STARTED"].includes(item.status),
    ).length;
    return {
      theory,
      score:
        theory.supporting_evidence_ids.length +
        theory.supporting_legal_proposition_ids.length +
        priorityBoost * 2 -
        unresolvedGaps * 2 -
        theory.assumptions.length -
        weakResearch * 2,
      unresolvedGaps,
      weakResearch,
    };
  });
  const selected =
    scored.sort((a, b) => b.score - a.score)[0] ??
    ({
      theory: input.theories[0],
      score: 0,
      unresolvedGaps: 0,
      weakResearch: 0,
    } as const);
  if (!selected.theory) {
    throw new Error("deriveBestWinningTheory requires at least one theory.");
  }
  const legal: Strength = selected.weakResearch > 0 ? "FRAGILE" : "STRONG";
  const evidentiary: Strength = selected.unresolvedGaps > 0 ? "FRAGILE" : "STRONG";
  const procedural: Strength = selected.theory.weaknesses.some((weakness) =>
    weakness.toLowerCase().includes("procedur"),
  )
    ? "FRAGILE"
    : "STRONG";
  return bestWinningTheorySchema.parse({
    view_type: "BEST_WINNING_THEORY",
    source_of_truth: false,
    theory_id: selected.theory.theory_id,
    matter_id: selected.theory.matter_id,
    requested_outcome: selected.theory.requested_outcome,
    rationale:
      "Selected for coherence, evidence/legal support, procedural viability, remedy fit, and resistance to counterargument; not for aggressiveness.",
    ordinal_assessment: {
      legal_strength: legal,
      factual_strength: selected.theory.assumptions.length > 0 ? "MODERATE" : "STRONG",
      evidentiary_strength: evidentiary,
      procedural_strength: procedural,
      remedial_fit: selected.theory.requested_outcome.toLowerCase().includes("all")
        ? "FRAGILE"
        : "STRONG",
      adversarial_resilience: selected.theory.weaknesses.length > 2 ? "FRAGILE" : "MODERATE",
    },
    unnecessary_assumptions: selected.theory.assumptions,
    disputed_fact_dependencies:
      selected.unresolvedGaps > 0 ? selected.theory.supporting_evidence_ids : [],
    uncertain_law_dependencies:
      selected.weakResearch > 0 ? selected.theory.supporting_legal_proposition_ids : [],
    credibility_cost: selected.theory.weaknesses.some((weakness) =>
      weakness.toLowerCase().includes("accus"),
    )
      ? "HIGH"
      : selected.theory.assumptions.length > 1
        ? "MODERATE"
        : "LOW",
    complexity: selected.theory.dependencies.length > 3 ? "HIGH" : "MODERATE",
    provenance: unique([...input.provenance, ...selected.theory.provenance]),
  });
}

export function generateBestOpponentArgument(input: {
  targetId: string;
  issueId?: string;
  issuePriority?: IssuePriority;
  claimSupportMap?: ClaimSupportMap;
  issueLawMap?: IssueLawMap;
  precedentApplications?: PrecedentApplicationAnalysis[];
  research?: ResearchSufficiency;
  provenance: ProvenanceRef[];
}): BestOpponentArgument {
  const hasProceduralRisk =
    input.issuePriority?.procedural_dependence === "HIGH" ||
    input.issueLawMap?.unresolved_legal_questions.some((question) =>
      question.toLowerCase().includes("procedur"),
    );
  const hasEvidenceGap = (input.claimSupportMap?.gaps ?? []).some((gap) =>
    ["EVIDENTIARY_GAP", "FACTUAL_GAP", "UNKNOWN"].includes(gap.status),
  );
  const adversePrecedent = (input.precedentApplications ?? []).find((application) =>
    ["ADVERSE", "STRONGLY_ADVERSE", "MIXED"].includes(application.application),
  );
  const weakResearch =
    input.research &&
    ["RESEARCH_WEAK", "RESEARCH_NOT_STARTED", "RESEARCH_PARTIAL"].includes(input.research.status);
  const attack_type = hasProceduralRisk
    ? "PROCEDURAL_ATTACK"
    : adversePrecedent
      ? "PRECEDENT_ATTACK"
      : hasEvidenceGap
        ? "EVIDENTIARY_ATTACK"
        : weakResearch
          ? "LEGAL_ATTACK"
          : "SCOPE_ATTACK";
  const strength: Strength =
    attack_type === "PROCEDURAL_ATTACK" || adversePrecedent?.application === "STRONGLY_ADVERSE"
      ? "STRONG"
      : hasEvidenceGap || weakResearch
        ? "MODERATE"
        : "FRAGILE";
  return bestOpponentArgumentSchema.parse({
    view_type: "BEST_OPPONENT_ARGUMENT",
    source_of_truth: false,
    argument_id: `opponent-${input.targetId}`,
    proposition_attacked_id: input.targetId,
    issue_id: input.issueId,
    attack_type,
    steelman: true,
    hypothetical_status: "HYPOTHETICAL_ADVERSARIAL_ANALYSIS",
    supporting_fact_ids: [],
    supporting_evidence_ids: input.claimSupportMap?.evidence_ids ?? [],
    supporting_law_ids: [
      ...(input.issueLawMap?.governing_provision_ids ?? []),
      ...(input.issueLawMap?.adverse_precedent_ids ?? []),
    ],
    assumptions:
      attack_type === "PROCEDURAL_ATTACK"
        ? ["The deciding authority may resolve the matter on a narrower threshold ground."]
        : ["The opponent advances the strongest lawful version of the available counterposition."],
    strength,
    likely_judicial_relevance: strengthRank[strength] >= strengthRank.MODERATE ? "HIGH" : "MEDIUM",
    explanation:
      "Steelman counterargument selected by procedural/legal/evidentiary materiality, not by ease of reply.",
    provenance: input.provenance,
  });
}

export function generateBestReply(input: {
  opponentArgument: BestOpponentArgument;
  supportingEvidenceIds?: string[];
  supportingLawIds?: string[];
  distinctionAvailable?: boolean;
  concessionAvailable?: boolean;
  provenance: ProvenanceRef[];
}): BestReply {
  const evidentiaryAnswer = (input.supportingEvidenceIds?.length ?? 0) > 0;
  const legalAnswer = (input.supportingLawIds?.length ?? 0) > 0;
  const answers =
    Number(evidentiaryAnswer) + Number(legalAnswer) + Number(Boolean(input.distinctionAvailable));
  const answer_status =
    answers >= 3
      ? "FULLY_ANSWERS"
      : answers === 2
        ? "SUBSTANTIALLY_ANSWERS"
        : answers === 1
          ? "PARTIALLY_ANSWERS"
          : "DOES_NOT_ANSWER";
  const remaining_risk: ResidualRisk =
    answer_status === "FULLY_ANSWERS"
      ? "LOW"
      : answer_status === "SUBSTANTIALLY_ANSWERS"
        ? "MODERATE"
        : answer_status === "PARTIALLY_ANSWERS"
          ? "HIGH"
          : "CRITICAL";
  return bestReplySchema.parse({
    view_type: "BEST_REPLY",
    source_of_truth: false,
    reply_id: `reply-${input.opponentArgument.argument_id}`,
    opponent_argument_id: input.opponentArgument.argument_id,
    answer_status,
    legal_response: legalAnswer
      ? "A verified legal proposition answers the legal premise of the counterargument."
      : "No complete legal answer is available from the supplied sources.",
    factual_response: evidentiaryAnswer
      ? "The record contains evidence supporting the contested factual premise."
      : "The factual answer remains incomplete on the supplied record.",
    evidentiary_response: evidentiaryAnswer
      ? "The reply is tied to identified evidence rather than assertion."
      : "The reply would need additional evidence or a narrower formulation.",
    distinction: input.distinctionAvailable
      ? "The opponent's strongest authority or premise can be distinguished."
      : "No reliable distinction is supplied.",
    useful_concession: input.concessionAvailable
      ? "A peripheral point can be conceded without abandoning the minimum case."
      : undefined,
    remaining_risk,
    provenance: input.provenance,
  });
}

export function buildArgumentDuel(input: {
  ourArgumentId: string;
  opponentArgument: BestOpponentArgument;
  bestReply: BestReply;
  provenance: ProvenanceRef[];
}): ArgumentDuel {
  return argumentDuelSchema.parse({
    view_type: "ARGUMENT_DUEL",
    source_of_truth: false,
    our_argument_id: input.ourArgumentId,
    best_opponent_argument: input.opponentArgument,
    best_reply: input.bestReply,
    opponent_sur_rebuttal:
      input.bestReply.answer_status === "FULLY_ANSWERS"
        ? "Opponent can still challenge weight or scope, but no stronger supplied sur-rebuttal is identified."
        : "Opponent can stress the unanswered portion and ask the decision-maker to resolve on that narrow ground.",
    residual_risk: input.bestReply.remaining_risk,
    provenance: input.provenance,
  });
}

export function generateJudicialDecisionPath(input: {
  mode: JudgeMode;
  issuePriorities: IssuePriority[];
  narrowIssuePath?: NarrowIssuePath;
  minimumWinningCase: MinimumWinningCase;
  minimumLosingCondition: MinimumLosingCondition;
  requestDispositionMap?: RequestDispositionMap;
  provenance: ProvenanceRef[];
}): JudicialDecisionPath {
  const threshold = input.issuePriorities
    .filter(
      (priority) =>
        priority.procedural_dependence === "HIGH" || priority.priority === "DISPOSITIVE",
    )
    .map((priority) => priority.issue_id);
  const unresolved = input.minimumWinningCase.unresolved_essential_ids;
  const proceduralFirst = input.mode === "PROCEDURAL_MINIMALIST_JUDGE" && threshold.length > 0;
  const evidenceStrictBlocks =
    input.mode === "EVIDENCE_STRICT_JUDGE" &&
    input.minimumWinningCase.essential_evidence.some((e) => e.status !== "SATISFIED");
  const favorableBlocked =
    input.mode === "FAVORABLE_JUDGE" &&
    input.minimumWinningCase.essential_legal_propositions.some((e) =>
      ["MISSING", "UNCERTAIN", "DISPUTED"].includes(e.status),
    );
  const outcome_direction = proceduralFirst
    ? "PROCEDURAL_DISPOSITION"
    : evidenceStrictBlocks || favorableBlocked
      ? "REMAND_OR_FURTHER_FACT_FINDING"
      : input.mode === "SKEPTICAL_JUDGE"
        ? "OPPOSES_REQUESTED_OUTCOME"
        : input.minimumWinningCase.satisfied
          ? "SUPPORTS_REQUESTED_OUTCOME"
          : "PARTIALLY_SUPPORTS";
  const issue_sequence = proceduralFirst
    ? unique([...threshold, ...(input.narrowIssuePath?.primary_issue_ids ?? [])])
    : unique([...(input.narrowIssuePath?.primary_issue_ids ?? []), ...threshold]);
  return judicialDecisionPathSchema.parse({
    view_type: "JUDICIAL_DECISION_PATH",
    source_of_truth: false,
    mode: input.mode,
    threshold_issue_ids: threshold,
    accepted_fact_ids: input.minimumWinningCase.essential_facts
      .filter((element) => element.status === "SATISFIED")
      .map((element) => element.element_id),
    rejected_or_unresolved_fact_ids: unresolved,
    governing_legal_proposition_ids: input.minimumWinningCase.essential_legal_propositions.map(
      (element) => element.element_id,
    ),
    issue_sequence,
    dispositive_issue_id: threshold[0] ?? input.minimumLosingCondition.affected_element_ids[0],
    unnecessary_issue_ids: input.narrowIssuePath?.subsidiary_issue_ids ?? [],
    likely_reasoning_path:
      input.mode === "SKEPTICAL_JUDGE"
        ? "Identifies the narrowest lawful route for rejecting or limiting the requested outcome."
        : input.mode === "FAVORABLE_JUDGE"
          ? "Identifies the strongest lawful route for granting relief while respecting gaps."
          : input.mode === "EVIDENCE_STRICT_JUDGE"
            ? "Accepts only strongly supported elements and withholds relief where essential proof is missing."
            : input.mode === "PROCEDURAL_MINIMALIST_JUDGE"
              ? "Resolves on the narrowest procedural ground where available."
              : "Balances both sides through a conventional legally supportable route.",
    outcome_direction,
    assumptions:
      outcome_direction === "SUPPORTS_REQUESTED_OUTCOME"
        ? ["All essential elements are accepted."]
        : ["At least one essential element or threshold issue remains vulnerable."],
    vulnerabilities:
      unresolved.length > 0 ? ["Minimum winning case has unresolved essentials."] : [],
    not_a_prediction: true,
    provenance: input.provenance,
  });
}

export function buildMinimumWinningCase(input: {
  claim: Claim;
  claimSupportMap: ClaimSupportMap;
  requiredLegalPropositionIds: string[];
  requiredProceduralIssueIds: string[];
  requiredEvidenceIds: string[];
  provenance: ProvenanceRef[];
}): MinimumWinningCase {
  const claimElementIds = new Set(input.claim.elements.map((element) => element.id));
  const essential_facts = input.claim.elements.map((element) =>
    minimumElementSchema.parse({
      element_id: element.id,
      element_type: "ESSENTIAL_FACT",
      status:
        element.status === "SATISFIED"
          ? "SATISFIED"
          : element.status === "DISPUTED"
            ? "DISPUTED"
            : element.status === "NOT_SATISFIED"
              ? "MISSING"
              : "UNCERTAIN",
      explanation: "Claim element is part of the smallest required factual path.",
      provenance: element.provenance,
    }),
  );
  const essential_evidence = input.requiredEvidenceIds.map((id) =>
    minimumElementSchema.parse({
      element_id: id,
      element_type: "ESSENTIAL_EVIDENCE",
      status: input.claimSupportMap.evidence_ids.includes(id) ? "SATISFIED" : "MISSING",
      explanation: "Evidence is required for at least one essential claim element.",
      provenance: input.provenance,
    }),
  );
  const essential_legal_propositions = input.requiredLegalPropositionIds.map((id) =>
    minimumElementSchema.parse({
      element_id: id,
      element_type: "ESSENTIAL_LEGAL_PROPOSITION",
      status: input.claimSupportMap.legal_proposition_ids.includes(id) ? "SATISFIED" : "MISSING",
      explanation:
        "Legal proposition is necessary for entitlement; evidence alone is insufficient.",
      provenance: input.provenance,
    }),
  );
  const essential_procedural_prerequisites = input.requiredProceduralIssueIds.map((id) =>
    minimumElementSchema.parse({
      element_id: id,
      element_type: "ESSENTIAL_PROCEDURAL_PREREQUISITE",
      status: input.claim.issue_ids.includes(id) ? "SATISFIED" : "UNCERTAIN",
      explanation: "Procedural prerequisite must survive threshold review.",
      provenance: input.provenance,
    }),
  );
  const essential_remedy_elements = input.claim.remedies.map((_, index) =>
    minimumElementSchema.parse({
      element_id: `remedy-${index}`,
      element_type: "ESSENTIAL_REMEDY_ELEMENT",
      status: "SATISFIED",
      explanation: "Requested remedy is included as an essential remedy element.",
      provenance: input.claim.remedies[index]?.provenance ?? input.provenance,
    }),
  );
  const allEssentials = [
    ...essential_facts,
    ...essential_evidence,
    ...essential_legal_propositions,
    ...essential_procedural_prerequisites,
    ...essential_remedy_elements,
  ];
  const unresolved = allEssentials
    .filter((element) => element.status !== "SATISFIED")
    .map((element) => element.element_id);
  return minimumWinningCaseSchema.parse({
    view_type: "MINIMUM_WINNING_CASE",
    source_of_truth: false,
    claim_id: input.claim.id,
    essential_facts,
    essential_evidence,
    essential_legal_propositions,
    essential_procedural_prerequisites,
    essential_remedy_elements,
    nonessential_supporting_arguments: input.claimSupportMap.claim_element_ids.filter(
      (id) => !claimElementIds.has(id),
    ),
    satisfied: unresolved.length === 0,
    unresolved_essential_ids: unresolved,
    provenance: input.provenance,
  });
}

export function buildMinimumLosingCondition(input: {
  claimId: string;
  minimumWinningCase: MinimumWinningCase;
  adversePrecedentIds?: string[];
  jurisdictionIssueId?: string;
  provenance: ProvenanceRef[];
}): MinimumLosingCondition {
  const missingEvidence = input.minimumWinningCase.essential_evidence.find(
    (element) => element.status !== "SATISFIED",
  );
  const legalGap = input.minimumWinningCase.essential_legal_propositions.find(
    (element) => element.status !== "SATISFIED",
  );
  const condition_type = input.jurisdictionIssueId
    ? "LACK_OF_JURISDICTION"
    : missingEvidence
      ? "NO_EVIDENCE_FOR_ESSENTIAL_ELEMENT"
      : legalGap
        ? "ESSENTIAL_LEGAL_GAP"
        : (input.adversePrecedentIds?.length ?? 0) > 0
          ? "DISPOSITIVE_ADVERSE_PRECEDENT"
          : "UNKNOWN";
  const affected = input.jurisdictionIssueId
    ? [input.jurisdictionIssueId]
    : missingEvidence
      ? [missingEvidence.element_id]
      : legalGap
        ? [legalGap.element_id]
        : (input.adversePrecedentIds ?? []);
  return minimumLosingConditionSchema.parse({
    view_type: "MINIMUM_LOSING_CONDITION",
    source_of_truth: false,
    condition_id: `mlc-${input.claimId}`,
    claim_id: input.claimId,
    condition_type,
    affected_element_ids: affected,
    explanation: "Narrowest supplied failure condition that can defeat the requested outcome.",
    residual_risk: affected.length > 0 ? "HIGH" : "UNKNOWN",
    provenance: input.provenance,
  });
}

export function runKillTest(input: {
  theory: MatterTheory;
  minimumWinningCase: MinimumWinningCase;
  precedentApplications?: PrecedentApplicationAnalysis[];
  contradictions?: ContradictionAssessmentResult[];
  overbroadRemedy?: string;
  provenance: ProvenanceRef[];
}): KillTestResult {
  const weakFact = input.minimumWinningCase.essential_facts.find(
    (element) => element.status !== "SATISFIED",
  );
  const weakLaw = input.minimumWinningCase.essential_legal_propositions.find(
    (element) => element.status !== "SATISFIED",
  );
  const distinguishable = input.precedentApplications?.find((item) =>
    ["DISTINGUISHABLE", "INSUFFICIENTLY_VERIFIED", "MIXED"].includes(item.application),
  );
  const contradiction = input.contradictions?.find((item) =>
    ["DISPOSITIVE", "HIGH"].includes(item.materiality),
  );
  const hasCritical =
    weakFact !== undefined || weakLaw !== undefined || input.overbroadRemedy !== undefined;
  const result = !input.minimumWinningCase.satisfied
    ? "FAILS"
    : hasCritical || distinguishable
      ? "REQUIRES_REBUILD"
      : contradiction
        ? "SURVIVES_WITH_MATERIAL_RISK"
        : "SURVIVES";
  return killTestResultSchema.parse({
    view_type: "KILL_TEST",
    source_of_truth: false,
    theory_id: input.theory.theory_id,
    weakest_factual_proposition_id: weakFact?.element_id,
    weakest_legal_proposition_id: weakLaw?.element_id,
    easiest_precedent_to_distinguish_id: distinguishable?.precedent_authority_id,
    vulnerable_procedural_prerequisite_id:
      input.minimumWinningCase.essential_procedural_prerequisites.find(
        (element) => element.status !== "SATISFIED",
      )?.element_id,
    overbroad_remedy: input.overbroadRemedy,
    damaging_contradiction_id: contradiction?.compared_entity_ids[0],
    hidden_assumption: input.theory.assumptions[0],
    skeptical_judge_first_point:
      weakFact?.explanation ??
      weakLaw?.explanation ??
      input.overbroadRemedy ??
      "A skeptical judge would first test the narrowest threshold or unsupported essential element.",
    result,
    provenance: unique([...input.provenance, ...input.theory.provenance]),
  });
}

export function evaluateArgumentRemoval(input: {
  argument: Argument;
  minimumWinningCase: MinimumWinningCase;
  isEmotionallyAttractive?: boolean;
  overstates?: boolean;
  provenance: ProvenanceRef[];
}): ArgumentRemovalTest {
  const essential = input.argument.relied_proposition_ids.some((id) =>
    input.minimumWinningCase.essential_facts.some((element) => element.element_id === id),
  );
  const effect = input.overstates
    ? "HARMFUL_POSSIBLE"
    : input.isEmotionallyAttractive && !essential
      ? "DISTRACTING"
      : essential
        ? "ESSENTIAL"
        : input.argument.relied_legal_proposition_ids.some((id) =>
              input.minimumWinningCase.essential_legal_propositions.some(
                (element) => element.element_id === id,
              ),
            )
          ? "IMPORTANT"
          : "SUPPORTING";
  return argumentRemovalTestSchema.parse({
    view_type: "ARGUMENT_REMOVAL_TEST",
    source_of_truth: false,
    argument_id: input.argument.id,
    effect,
    case_still_reaches_requested_outcome: !["ESSENTIAL", "IMPORTANT"].includes(effect),
    explanation: "Hypothetical removal test; the actual matter is not mutated.",
    matter_mutated: false,
    provenance: input.provenance,
  });
}

export function evaluateEvidenceRemoval(input: {
  evidence: Evidence;
  minimumWinningCase: MinimumWinningCase;
  provenance: ProvenanceRef[];
}): EvidenceRemovalTest {
  const collapsed = input.minimumWinningCase.essential_evidence
    .filter((element) => element.element_id === input.evidence.id)
    .map((element) => element.element_id);
  const effect =
    collapsed.length > 0
      ? "CRITICAL_EVIDENCE"
      : input.evidence.evidence_use === "FULL_TEXT_EVIDENCE"
        ? "HIGH_VALUE"
        : input.evidence.evidence_use === "CONTEXT"
          ? "CORROBORATIVE"
          : "LOW_VALUE";
  return evidenceRemovalTestSchema.parse({
    view_type: "EVIDENCE_REMOVAL_TEST",
    source_of_truth: false,
    evidence_id: input.evidence.id,
    effect,
    collapsed_element_ids: collapsed,
    matter_mutated: false,
    explanation: "Derived simulation only; evidence state remains unchanged.",
    provenance: input.provenance,
  });
}

export function evaluatePrecedentRemoval(input: {
  precedent: PrecedentApplication | PrecedentApplicationAnalysis;
  minimumWinningCase: MinimumWinningCase;
  alternativeLegalPropositionIds?: string[];
  provenance: ProvenanceRef[];
}): PrecedentRemovalTest {
  const precedentId =
    "id" in input.precedent ? input.precedent.id : input.precedent.precedent_authority_id;
  const authorityId =
    "legal_authority_id" in input.precedent
      ? input.precedent.legal_authority_id
      : input.precedent.precedent_authority_id;
  const essentialDependence = input.minimumWinningCase.essential_legal_propositions.some(
    (element) => element.element_id === authorityId,
  );
  const survives = !essentialDependence || (input.alternativeLegalPropositionIds?.length ?? 0) > 0;
  return precedentRemovalTestSchema.parse({
    view_type: "PRECEDENT_REMOVAL_TEST",
    source_of_truth: false,
    precedent_application_id: precedentId,
    legal_theory_survives: survives,
    effect:
      essentialDependence && !survives
        ? "FRAGILE_DEPENDENCE"
        : essentialDependence
          ? "IMPORTANT"
          : "SUPPORTING",
    explanation: "Tests whether legal theory depends too heavily on one precedent.",
    provenance: input.provenance,
  });
}

export function buildRebuildPlan(input: {
  theory: MatterTheory;
  killTest: KillTestResult;
  provenance: ProvenanceRef[];
}): RebuildPlan {
  const actions: RebuildPlan["actions"] = [];
  if (input.killTest.weakest_factual_proposition_id) {
    actions.push({
      action: "REQUEST_EVIDENCE",
      target_id: input.killTest.weakest_factual_proposition_id,
      reason: "The weakest essential factual proposition needs evidentiary support.",
    });
  }
  if (
    input.killTest.weakest_legal_proposition_id ||
    input.killTest.easiest_precedent_to_distinguish_id
  ) {
    actions.push({
      action: "VERIFY_AUTHORITY",
      target_id:
        input.killTest.weakest_legal_proposition_id ??
        input.killTest.easiest_precedent_to_distinguish_id,
      reason: "The legal theory depends on uncertain or distinguishable authority.",
    });
  }
  if (input.killTest.overbroad_remedy) {
    actions.push({
      action: "NARROW_REMEDY",
      reason: input.killTest.overbroad_remedy,
    });
  }
  if (input.killTest.hidden_assumption) {
    actions.push({
      action: "CLARIFY_FACT",
      reason: `Hidden assumption requires clarification: ${input.killTest.hidden_assumption}`,
    });
  }
  if (actions.length === 0) {
    actions.push({
      action: "STRENGTHEN_WITH_EXISTING_EVIDENCE",
      reason: "No destructive failure identified.",
    });
  }
  return rebuildPlanSchema.parse({
    view_type: "REBUILD_PLAN",
    source_of_truth: false,
    theory_id: input.theory.theory_id,
    actions,
    no_new_facts_invented: true,
    provenance: input.provenance,
  });
}

export function evaluateConcession(input: {
  concessionId: string;
  targetId: string;
  minimumWinningCase: MinimumWinningCase;
  undermines?: ConcessionAnalysis["undermines"];
  provenance: ProvenanceRef[];
}): ConcessionAnalysis {
  const essentialIds = new Set([
    ...input.minimumWinningCase.essential_facts.map((e) => e.element_id),
    ...input.minimumWinningCase.essential_legal_propositions.map((e) => e.element_id),
    ...input.minimumWinningCase.essential_procedural_prerequisites.map((e) => e.element_id),
    ...input.minimumWinningCase.essential_remedy_elements.map((e) => e.element_id),
  ]);
  const fatal = essentialIds.has(input.targetId) || (input.undermines?.length ?? 0) > 0;
  return concessionAnalysisSchema.parse({
    view_type: "SAFE_CONCESSION_ANALYSIS",
    source_of_truth: false,
    concession_id: input.concessionId,
    target_id: input.targetId,
    classification: fatal ? "FATAL" : "SAFE",
    undermines: input.undermines ?? [],
    explanation: fatal
      ? "The concession would undermine an essential element or threshold condition."
      : "The concession does not affect the minimum winning case on supplied data.",
    provenance: input.provenance,
  });
}

export function evaluateResponseNecessity(input: {
  pointId: string;
  materiality: "DISPOSITIVE" | "HIGH" | "SUPPORTING" | "LOW" | "UNKNOWN";
  credibilityCost?: CredibilityCost["credibility_cost"];
  inMinimumWinningCase: boolean;
  provenance: ProvenanceRef[];
}): ResponseNecessity {
  const necessity = input.inMinimumWinningCase
    ? "MUST_RESPOND"
    : input.materiality === "HIGH" || input.materiality === "DISPOSITIVE"
      ? "SHOULD_RESPOND"
      : input.credibilityCost === "HIGH"
        ? "BETTER_NOT_TO_ENGAGE"
        : input.materiality === "LOW"
          ? "OPTIONAL"
          : "IRRELEVANT";
  return responseNecessitySchema.parse({
    view_type: "RESPONSE_NECESSITY",
    source_of_truth: false,
    point_id: input.pointId,
    necessity,
    rationale:
      "Necessity is derived from materiality, minimum winning case relevance, and credibility cost.",
    provenance: input.provenance,
  });
}

export function buildWeaknessMap(input: {
  side: "OWN" | "OPPONENT";
  minimumWinningCase?: MinimumWinningCase;
  contradictions?: ContradictionAssessmentResult[];
  precedentApplications?: PrecedentApplicationAnalysis[];
  provenance: ProvenanceRef[];
}) {
  const weaknesses = [
    ...(input.minimumWinningCase?.unresolved_essential_ids.map((id) => ({
      weakness_id: id,
      weakness_type: "DEPENDENCY" as const,
      materiality: "HIGH" as const,
      description: "Unresolved essential condition in minimum winning case.",
      provenance: input.provenance,
    })) ?? []),
    ...(input.contradictions ?? [])
      .filter((contradiction) => ["DISPOSITIVE", "HIGH"].includes(contradiction.materiality))
      .map((contradiction) => ({
        weakness_id: contradiction.compared_entity_ids.join("-"),
        weakness_type: "CONTRADICTION" as const,
        materiality: contradiction.materiality,
        description: contradiction.drafting_formulation,
        provenance: contradiction.provenance,
      })),
    ...(input.precedentApplications ?? [])
      .filter((precedent) =>
        ["ADVERSE", "STRONGLY_ADVERSE", "MIXED"].includes(precedent.application),
      )
      .map((precedent) => ({
        weakness_id: precedent.precedent_authority_id,
        weakness_type: "PRECEDENT" as const,
        materiality: "HIGH" as const,
        description: precedent.why,
        provenance: precedent.provenance,
      })),
  ];
  return weaknessMapSchema.parse({
    view_type: input.side === "OWN" ? "OWN_WEAKNESS_MAP" : "OPPONENT_WEAKNESS_MAP",
    source_of_truth: false,
    weaknesses,
  });
}

export function buildDecisivePointMap(input: {
  minimumWinningCase: MinimumWinningCase;
  minimumLosingCondition: MinimumLosingCondition;
  dependencies?: IssueDependency[];
  provenance: ProvenanceRef[];
}): DecisivePointMap {
  const points = [
    ...input.minimumWinningCase.unresolved_essential_ids.map((id) => ({
      point_id: id,
      category: "POTENTIAL_KILL_POINT" as const,
      basis: "Unresolved essential element in minimum winning case.",
      provenance: input.provenance,
    })),
    ...input.minimumWinningCase.essential_legal_propositions
      .filter((element) => element.status === "SATISFIED")
      .map((element) => ({
        point_id: element.element_id,
        category: "POTENTIAL_WIN_POINT" as const,
        basis: "Satisfied essential legal proposition.",
        provenance: element.provenance,
      })),
    ...input.minimumLosingCondition.affected_element_ids.map((id) => ({
      point_id: id,
      category: "THRESHOLD_POINT" as const,
      basis: input.minimumLosingCondition.explanation,
      provenance: input.minimumLosingCondition.provenance,
    })),
    ...(input.dependencies ?? []).map((dependency) => ({
      point_id: `${dependency.from_issue_id}-${dependency.to_issue_id}`,
      category: "PROCEDURAL_PIVOT" as const,
      basis: dependency.explanation,
      provenance: dependency.provenance,
    })),
  ];
  return decisivePointMapSchema.parse({
    view_type: "DECISIVE_POINT_MAP",
    source_of_truth: false,
    points,
  });
}

export function evaluateArgumentCompatibility(input: {
  argumentAId: string;
  argumentBId: string;
  factualTheoryA?: string;
  factualTheoryB?: string;
  legallyLayered?: boolean;
  provenance: ProvenanceRef[];
}): ArgumentCompatibility {
  const incompatible =
    input.factualTheoryA !== undefined &&
    input.factualTheoryB !== undefined &&
    input.factualTheoryA !== input.factualTheoryB &&
    input.legallyLayered !== true;
  return argumentCompatibilitySchema.parse({
    argument_a_id: input.argumentAId,
    argument_b_id: input.argumentBId,
    compatibility: incompatible
      ? "MUTUALLY_EXCLUSIVE"
      : input.factualTheoryA !== input.factualTheoryB && input.legallyLayered
        ? "CONDITIONALLY_COMPATIBLE"
        : "COMPATIBLE",
    explanation: incompatible
      ? "Mutually exclusive factual theories require procedural/legal justification before simultaneous presentation."
      : "No incompatibility is detected on supplied data.",
    provenance: input.provenance,
  });
}

export function evaluateCredibilityCost(input: {
  argumentId: string;
  overstatement?: boolean;
  weakEvidence?: boolean;
  ignoredAdversePrecedent?: boolean;
  unnecessaryAccusation?: boolean;
  inconsistency?: boolean;
  implausibleInference?: boolean;
  disproportionalRhetoric?: boolean;
  provenance: ProvenanceRef[];
}): CredibilityCost {
  const factors = [
    input.overstatement ? "OVERSTATEMENT" : undefined,
    input.weakEvidence ? "WEAK_EVIDENCE" : undefined,
    input.ignoredAdversePrecedent ? "IGNORED_ADVERSE_PRECEDENT" : undefined,
    input.unnecessaryAccusation ? "UNNECESSARY_ACCUSATION" : undefined,
    input.inconsistency ? "INCONSISTENCY" : undefined,
    input.implausibleInference ? "IMPLAUSIBLE_INFERENCE" : undefined,
    input.disproportionalRhetoric ? "DISPROPORTIONAL_RHETORIC" : undefined,
  ].filter((factor): factor is NonNullable<typeof factor> => factor !== undefined);
  const credibility_cost =
    factors.length >= 3
      ? "HIGH"
      : factors.length === 2
        ? "MODERATE"
        : factors.length === 1
          ? "LOW"
          : "NONE";
  return credibilityCostSchema.parse({
    argument_id: input.argumentId,
    credibility_cost,
    factors,
    explanation: "Credibility cost assesses presentation risk, not moral blame.",
    provenance: input.provenance,
  });
}

export function evaluateInformationValue(input: {
  requestId: string;
  affectsMinimumWinningCase: boolean;
  mayResolveLosingCondition: boolean;
  provenance: ProvenanceRef[];
}): InformationValue {
  const value = input.mayResolveLosingCondition
    ? "DECISIVE_INFORMATION"
    : input.affectsMinimumWinningCase
      ? "HIGH_VALUE"
      : "LOW_VALUE";
  return informationValueSchema.parse({
    request_id: input.requestId,
    value,
    explanation:
      "Information value is tied to whether it can change minimum winning or losing conditions.",
    provenance: input.provenance,
  });
}

export function generateStrategicHumanReviewFlags(input: {
  winningTheoriesConflict?: boolean;
  minimumWinningCaseDependsOnUncertainLaw?: boolean;
  dispositiveIssueDependsOnDisputedFact?: boolean;
  adversePrecedentMayControl?: boolean;
  concessionMayBeFatal?: boolean;
  remedyFitUncertain?: boolean;
  judgeModesDiverge?: boolean;
  lockedReviewState?: ReviewState;
  proposedSystemStatus?: ReviewState["status"];
}) {
  const flags: string[] = [];
  if (input.winningTheoriesConflict) flags.push("TWO_WINNING_THEORIES_CONFLICT");
  if (input.minimumWinningCaseDependsOnUncertainLaw) flags.push("MWC_DEPENDS_ON_UNCERTAIN_LAW");
  if (input.dispositiveIssueDependsOnDisputedFact)
    flags.push("DISPOSITIVE_ISSUE_DEPENDS_ON_DISPUTED_FACT");
  if (input.adversePrecedentMayControl) flags.push("ADVERSE_PRECEDENT_MAY_CONTROL");
  if (input.concessionMayBeFatal) flags.push("CONCESSION_MAY_BE_FATAL");
  if (input.remedyFitUncertain) flags.push("REMEDY_FIT_UNCERTAIN");
  if (input.judgeModesDiverge) flags.push("JUDGE_MODES_DIVERGE");
  if (
    input.lockedReviewState &&
    input.proposedSystemStatus &&
    evaluateHumanLockConflict({
      existing: { id: "strategic-lock", reviewed_state: input.lockedReviewState },
      incomingContradictsExisting: input.proposedSystemStatus !== input.lockedReviewState.status,
    }).status === "REVIEW_REQUIRED"
  ) {
    flags.push("HUMAN_LOCK_CONFLICT_REVIEW_REQUIRED");
  }
  return flags;
}

export function buildMultiPerspectiveReview(input: {
  ourBestCase: BestWinningTheory;
  opponentBestCase: BestOpponentArgument;
  paths: JudicialDecisionPath[];
  minimumWinningCase: MinimumWinningCase;
  minimumLosingCondition: MinimumLosingCondition;
  ownWeaknesses: z.infer<typeof weaknessMapSchema>;
  opponentWeaknesses: z.infer<typeof weaknessMapSchema>;
  decisivePoints: DecisivePointMap;
  rebuildPlan: RebuildPlan;
  provenance: ProvenanceRef[];
}): MultiPerspectiveReview {
  const path = (mode: JudgeMode): JudicialDecisionPath => {
    const found = input.paths.find((item) => item.mode === mode);
    if (!found) throw new Error(`Missing judicial path for ${mode}.`);
    return found;
  };
  return multiPerspectiveReviewSchema.parse({
    view_type: "MULTI_PERSPECTIVE_REVIEW",
    source_of_truth: false,
    our_best_case: input.ourBestCase,
    opponent_best_case: input.opponentBestCase,
    neutral_judge_path: path("NEUTRAL_JUDGE"),
    skeptical_judge_path: path("SKEPTICAL_JUDGE"),
    favorable_judge_path: path("FAVORABLE_JUDGE"),
    procedural_minimalist_path: path("PROCEDURAL_MINIMALIST_JUDGE"),
    evidence_strict_path: path("EVIDENCE_STRICT_JUDGE"),
    minimum_winning_case: input.minimumWinningCase,
    minimum_losing_condition: input.minimumLosingCondition,
    own_weaknesses: input.ownWeaknesses,
    opponent_weaknesses: input.opponentWeaknesses,
    decisive_points: input.decisivePoints,
    rebuild_plan: input.rebuildPlan,
    residual_risks: unique([
      input.minimumLosingCondition.residual_risk,
      ...input.paths.map(
        (item) => (item.vulnerabilities.length > 0 ? "MODERATE" : "LOW") as ResidualRisk,
      ),
    ]),
    provenance: input.provenance,
  });
}

export function validateStrategicConclusionProvenance(input: {
  provenance: ProvenanceRef[];
  hypothetical?: boolean;
}): boolean {
  return (
    input.provenance.length > 0 &&
    (input.hypothetical === true || hasExplicitUnsourced(input.provenance))
  );
}

export function assessRobustness(input: {
  legal: Strength;
  factual: Strength;
  evidentiary: Strength;
  procedural: Strength;
  precedential: Strength;
  remedial: Strength;
  adversarial: Strength;
  provenance: ProvenanceRef[];
}): RobustnessAssessment {
  const dimensions = {
    LEGAL: input.legal,
    FACTUAL: input.factual,
    EVIDENTIARY: input.evidentiary,
    PROCEDURAL: input.procedural,
    PRECEDENTIAL: input.precedential,
    REMEDIAL: input.remedial,
    ADVERSARIAL: input.adversarial,
  } as const;
  const weakest = Object.entries(dimensions).sort(
    ([, a], [, b]) => strengthRank[a] - strengthRank[b],
  )[0] as [RobustnessAssessment["weakest_dimension"], Strength] | undefined;
  const weakestStrength = weakest?.[1] ?? "UNKNOWN";
  const overall =
    weakestStrength === "VERY_WEAK"
      ? "CRITICAL"
      : weakestStrength === "WEAK" || weakestStrength === "FRAGILE"
        ? "FRAGILE"
        : weakestStrength === "MODERATE"
          ? "MIXED"
          : minStrength(Object.values(dimensions)) === "STRONG"
            ? "GENERALLY_ROBUST"
            : "ROBUST";
  return robustnessAssessmentSchema.parse({
    view_type: "ROBUSTNESS_ASSESSMENT",
    source_of_truth: false,
    legal: input.legal,
    factual: input.factual,
    evidentiary: input.evidentiary,
    procedural: input.procedural,
    precedential: input.precedential,
    remedial: input.remedial,
    adversarial: input.adversarial,
    overall,
    weakest_dimension: weakest?.[0] ?? "UNKNOWN",
    no_probability: true,
    explanation: `Overall robustness is ordinal; weakest dimension is ${weakest?.[0] ?? "UNKNOWN"}.`,
    provenance: input.provenance,
  });
}

export function buildOutcomeSensitivityMap(input: {
  objects: {
    id: string;
    type: OutcomeSensitivityMap["sensitivities"][number]["sensitivity_type"];
    decisive: boolean;
  }[];
  provenance: ProvenanceRef[];
}): OutcomeSensitivityMap {
  return outcomeSensitivityMapSchema.parse({
    view_type: "OUTCOME_SENSITIVITY_MAP",
    source_of_truth: false,
    sensitivities: input.objects.map((object) => ({
      object_id: object.id,
      sensitivity_type: object.type,
      could_change_path: object.decisive,
      explanation: object.decisive
        ? "This item could materially alter at least one judicial path."
        : "This item is unlikely to alter the minimum path on supplied data.",
      provenance: input.provenance,
    })),
  });
}
