import { z } from "zod";
import {
  evaluateHumanLockConflict,
  provenanceRefSchema,
  type LegalProposition,
  type PrecedentApplication,
  type ProvenanceRef,
  type ReviewState,
  type SignificantDocumentaryAbsence,
} from "@swiss-legal-mcp/core";
import type {
  RequestDispositionMap,
  RequestedButNotDecidedAnalysis,
} from "@swiss-legal-mcp/chronology";

const idSchema = z.string().min(1);
const provenanceSchema = z.array(provenanceRefSchema).min(1);

export const contradictionInputKindSchema = z.enum([
  "ASSERTION",
  "EVIDENCE",
  "FACTUAL_FINDING",
  "PARTY_POSITION",
  "REQUEST",
  "RESPONSE",
  "ACTION",
  "DECISION",
  "REASONING",
  "OPERATIVE_PART",
  "LEGAL_CHARACTERIZATION",
  "LEGAL_PROPOSITION",
  "AUTHORITY",
  "METADATA",
  "DOCUMENT_CONTENT",
  "CHRONOLOGY_EVENT",
  "CONTEMPORANEOUS_RECORD",
  "LATER_POSITION",
]);
export type ContradictionInputKind = z.infer<typeof contradictionInputKindSchema>;

export const contradictionClassificationSchema = z.enum([
  "DIRECT_CONTRADICTION",
  "MATERIAL_INCONSISTENCY",
  "TENSION",
  "TEMPORAL_MISMATCH",
  "SCOPE_MISMATCH",
  "POSITION_CHANGE",
  "DIFFERENT_LEGAL_CHARACTERIZATION",
  "EXPLAINABLE_DIFFERENCE",
  "REQUIRES_CLARIFICATION",
  "NOT_CONTRADICTORY",
  "INSUFFICIENT_BASIS",
]);
export type ContradictionClassification = z.infer<typeof contradictionClassificationSchema>;

export const scopeComparisonSchema = z.enum([
  "SAME_SCOPE",
  "PARTIAL_OVERLAP",
  "DIFFERENT_SCOPE",
  "UNKNOWN_SCOPE",
]);
export type ScopeComparison = z.infer<typeof scopeComparisonSchema>;

export const temporalComparisonSchema = z.enum([
  "SAME_TIMEFRAME",
  "OVERLAPPING_TIMEFRAME",
  "DIFFERENT_TIMEFRAME",
  "LATER_DEVELOPMENT",
  "RETROSPECTIVE_ACCOUNT",
  "UNKNOWN_TIMEFRAME",
]);
export type TemporalComparison = z.infer<typeof temporalComparisonSchema>;

export const factualLegalLevelSchema = z.enum([
  "FACTUAL_STATEMENT",
  "LEGAL_CHARACTERIZATION",
  "PROCEDURAL_POSITION",
  "EVIDENTIARY_ASSESSMENT",
  "ARGUMENT",
]);
export type FactualLegalLevel = z.infer<typeof factualLegalLevelSchema>;

export const positionChangeClassificationSchema = z.enum([
  "CONSISTENT_POSITION",
  "CLARIFICATION",
  "DEVELOPMENT",
  "SCOPE_CHANGE",
  "LEGAL_RECHARACTERIZATION",
  "FACTUAL_POSITION_CHANGE",
  "PARTIAL_REVERSAL",
  "FULL_REVERSAL",
  "POST_HOC_JUSTIFICATION_POSSIBLE",
  "MATERIAL_INCONSISTENCY",
  "DIRECT_CONTRADICTION",
  "REQUIRES_EXPLANATION",
  "INSUFFICIENT_BASIS",
]);
export type PositionChangeClassification = z.infer<typeof positionChangeClassificationSchema>;

export const materialitySchema = z.enum([
  "DISPOSITIVE",
  "HIGH",
  "SUPPORTING",
  "LOW",
  "IMMATERIAL",
  "UNKNOWN",
]);
export type Materiality = z.infer<typeof materialitySchema>;

export const legalSignificanceSchema = z.enum([
  "PROCEDURAL",
  "EVIDENTIARY",
  "SUBSTANTIVE",
  "CREDIBILITY",
  "NO_MATERIAL_EFFECT",
  "UNKNOWN",
]);
export type LegalSignificance = z.infer<typeof legalSignificanceSchema>;

export const credibilityEffectSchema = z.enum([
  "POSITIVE",
  "NEUTRAL",
  "MINOR_NEGATIVE",
  "MATERIAL_NEGATIVE",
  "UNKNOWN",
]);
export type CredibilityEffect = z.infer<typeof credibilityEffectSchema>;

export const recommendedRoleSchema = z.enum([
  "MAIN",
  "SECONDARY",
  "EVIDENTIARY",
  "RESERVE",
  "DROP",
]);
export type RecommendedRole = z.infer<typeof recommendedRoleSchema>;

export const opponentExplanationResolutionSchema = z.enum(["YES", "PARTIALLY", "NO", "UNKNOWN"]);
export type OpponentExplanationResolution = z.infer<typeof opponentExplanationResolutionSchema>;

export const strategicValueSchema = z.object({
  legal_strength: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  evidentiary_strength: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  strategic_value: z.enum(["HIGH", "MEDIUM", "LOW", "DROP"]),
  materiality: materialitySchema,
  credibility_effect: credibilityEffectSchema,
  recommended_role: recommendedRoleSchema,
});
export type StrategicValue = z.infer<typeof strategicValueSchema>;

export const contradictionAssessmentResultSchema = z.object({
  classification: contradictionClassificationSchema,
  compared_entity_ids: z.array(idSchema).min(2),
  compared_kinds: z.array(contradictionInputKindSchema).min(2),
  scope: scopeComparisonSchema,
  temporal: temporalComparisonSchema,
  level_a: factualLegalLevelSchema,
  level_b: factualLegalLevelSchema,
  materiality: materialitySchema,
  legal_significance: legalSignificanceSchema,
  credibility_effect: credibilityEffectSchema,
  possible_explanations: z.array(z.string().min(1)),
  best_innocent_explanation: z.string().min(1),
  best_adverse_interpretation: z.string().min(1),
  best_opponent_explanation: z.string().min(1),
  opponent_explanation_resolves: opponentExplanationResolutionSchema,
  strategic_value: strategicValueSchema,
  drafting_formulation: z.string().min(1),
  unresolved_questions: z.array(z.string().min(1)),
  provenance: provenanceSchema,
});
export type ContradictionAssessmentResult = z.infer<typeof contradictionAssessmentResultSchema>;

export const evidenceConflictContextSchema = z.object({
  context: z.enum([
    "EVIDENTIARY_ONLY",
    "FACTUAL_POSITION",
    "PROCEDURAL_CONSEQUENCE",
    "LEGAL_CHARACTERIZATION",
  ]),
  classification: contradictionClassificationSchema,
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type EvidenceConflictContext = z.infer<typeof evidenceConflictContextSchema>;

export const legalAuthoritySupportSchema = z.enum([
  "SUPPORTED_BY_AUTHORITY",
  "PARTIALLY_SUPPORTED",
  "OVERSTATED_PROPOSITION",
  "MISATTRIBUTED_PROPOSITION",
  "CONSIDERANDUM_SCOPE_MISMATCH",
  "ADVERSE_ASPECT_OMITTED",
  "REQUIRES_VERIFICATION",
]);
export type LegalAuthoritySupport = z.infer<typeof legalAuthoritySupportSchema>;

export const contradictionMapSchema = z.object({
  view_type: z.literal("CONTRADICTION_MAP"),
  source_of_truth: z.literal(false),
  entities_compared: z.array(idSchema).min(2),
  proposition_ids: z.array(idSchema),
  contexts: z.array(z.string().min(1)),
  classification: contradictionClassificationSchema,
  materiality: materialitySchema,
  evidence_ids: z.array(idSchema),
  chronology_event_ids: z.array(idSchema),
  possible_explanations: z.array(z.string().min(1)),
  opponent_explanation: z.string().min(1),
  legal_significance: legalSignificanceSchema,
  recommended_role: recommendedRoleSchema,
  drafting_formulation: z.string().min(1),
  unresolved_questions: z.array(z.string().min(1)),
  provenance: provenanceSchema,
});
export type ContradictionMap = z.infer<typeof contradictionMapSchema>;

export const positionEvolutionMapSchema = z.object({
  view_type: z.literal("POSITION_EVOLUTION_MAP"),
  source_of_truth: z.literal(false),
  actor_id: idSchema,
  chronological_position_ids: z.array(idSchema),
  assertion_changes: z.array(z.string().min(1)),
  legal_characterization_changes: z.array(z.string().min(1)),
  newly_introduced_evidence_ids: z.array(idSchema),
  scope_shifts: z.array(z.string().min(1)),
  inconsistencies: z.array(z.string().min(1)),
  explanations: z.array(z.string().min(1)),
  strategic_relevance: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  classification: positionChangeClassificationSchema,
});
export type PositionEvolutionMap = z.infer<typeof positionEvolutionMapSchema>;

export function analyzeContradiction(input: {
  readonly entityAId: string;
  readonly entityBId: string;
  readonly kindA: ContradictionInputKind;
  readonly kindB: ContradictionInputKind;
  readonly statementA: string;
  readonly statementB: string;
  readonly sameProposition: boolean;
  readonly scope: ScopeComparison;
  readonly temporal: TemporalComparison;
  readonly levelA: FactualLegalLevel;
  readonly levelB: FactualLegalLevel;
  readonly objectSame: boolean;
  readonly directNegation?: boolean;
  readonly materiality?: Materiality;
  readonly legalSignificance?: LegalSignificance;
  readonly provenance: readonly ProvenanceRef[];
}): ContradictionAssessmentResult {
  const sameAnalyticalPlane =
    input.sameProposition &&
    input.scope === "SAME_SCOPE" &&
    input.temporal === "SAME_TIMEFRAME" &&
    input.levelA === input.levelB &&
    input.objectSame;
  const classification: ContradictionClassification = !input.sameProposition
    ? "NOT_CONTRADICTORY"
    : input.scope === "DIFFERENT_SCOPE"
      ? "NOT_CONTRADICTORY"
      : input.scope === "PARTIAL_OVERLAP"
        ? "TENSION"
        : input.temporal === "DIFFERENT_TIMEFRAME" || input.temporal === "LATER_DEVELOPMENT"
          ? "EXPLAINABLE_DIFFERENCE"
          : input.levelA !== input.levelB
            ? "NOT_CONTRADICTORY"
            : sameAnalyticalPlane && input.directNegation
              ? "DIRECT_CONTRADICTION"
              : sameAnalyticalPlane
                ? "MATERIAL_INCONSISTENCY"
                : "REQUIRES_CLARIFICATION";

  return contradictionAssessmentResultSchema.parse({
    classification,
    compared_entity_ids: [input.entityAId, input.entityBId],
    compared_kinds: [input.kindA, input.kindB],
    scope: input.scope,
    temporal: input.temporal,
    level_a: input.levelA,
    level_b: input.levelB,
    materiality: input.materiality ?? inferMateriality(classification),
    legal_significance: input.legalSignificance ?? inferLegalSignificance(classification),
    credibility_effect: "NEUTRAL",
    possible_explanations: explainContradiction(classification, input.scope, input.temporal),
    best_innocent_explanation: bestInnocentExplanation(
      input.scope,
      input.temporal,
      input.levelA,
      input.levelB,
    ),
    best_adverse_interpretation:
      classification === "DIRECT_CONTRADICTION"
        ? "The two statements may be materially irreconcilable."
        : "The divergence may weaken the clarity of the position.",
    best_opponent_explanation:
      classification === "DIRECT_CONTRADICTION"
        ? "The opponent may argue that one statement used shorthand or a different implicit scope."
        : "The opponent may argue that scope, timing, or legal level explains the difference.",
    opponent_explanation_resolves:
      classification === "DIRECT_CONTRADICTION" ? "PARTIALLY" : "UNKNOWN",
    strategic_value: strategicValueFor(
      classification,
      input.materiality ?? inferMateriality(classification),
    ),
    drafting_formulation: calibrateContradictionDrafting(classification),
    unresolved_questions:
      classification === "REQUIRES_CLARIFICATION" || classification === "TENSION"
        ? ["Clarify scope, timeframe, and analytical level before stronger use."]
        : [],
    provenance: input.provenance,
  });
}

export function analyzePositionChange(input: {
  readonly earlierPositionId: string;
  readonly laterPositionId: string;
  readonly sameFactTimeScope: boolean;
  readonly earlierAffirms: boolean;
  readonly laterAffirms: boolean;
  readonly clarification?: boolean;
  readonly narrowing?: boolean;
  readonly legalReasonFirstAppearsOnAppeal?: boolean;
  readonly usedToDefendEarlierDecision?: boolean;
  readonly provenance: readonly ProvenanceRef[];
}): PositionChangeClassification {
  provenanceSchema.parse(input.provenance);
  if (input.clarification) return input.narrowing ? "CLARIFICATION" : "DEVELOPMENT";
  if (input.legalReasonFirstAppearsOnAppeal && input.usedToDefendEarlierDecision)
    return "POST_HOC_JUSTIFICATION_POSSIBLE";
  if (input.sameFactTimeScope && input.earlierAffirms !== input.laterAffirms)
    return "FACTUAL_POSITION_CHANGE";
  if (!input.sameFactTimeScope && input.earlierAffirms !== input.laterAffirms)
    return "SCOPE_CHANGE";
  return "CONSISTENT_POSITION";
}

export function buildPositionEvolutionMap(input: {
  readonly actorId: string;
  readonly positionIds: readonly string[];
  readonly assertionChanges?: readonly string[];
  readonly legalCharacterizationChanges?: readonly string[];
  readonly newlyIntroducedEvidenceIds?: readonly string[];
  readonly scopeShifts?: readonly string[];
  readonly inconsistencies?: readonly string[];
  readonly explanations?: readonly string[];
  readonly classification: PositionChangeClassification;
}): PositionEvolutionMap {
  return positionEvolutionMapSchema.parse({
    view_type: "POSITION_EVOLUTION_MAP",
    source_of_truth: false,
    actor_id: input.actorId,
    chronological_position_ids: [...input.positionIds],
    assertion_changes: [...(input.assertionChanges ?? [])],
    legal_characterization_changes: [...(input.legalCharacterizationChanges ?? [])],
    newly_introduced_evidence_ids: [...(input.newlyIntroducedEvidenceIds ?? [])],
    scope_shifts: [...(input.scopeShifts ?? [])],
    inconsistencies: [...(input.inconsistencies ?? [])],
    explanations: [...(input.explanations ?? [])],
    strategic_relevance: input.classification === "CONSISTENT_POSITION" ? "LOW" : "MEDIUM",
    classification: input.classification,
  });
}

export function analyzeContemporaryLaterPosition(input: {
  readonly contemporaneousRecordId: string;
  readonly laterPositionId: string;
  readonly sameScope: boolean;
  readonly conflict: boolean;
  readonly laterExplainsEarlier?: boolean;
  readonly corroborated?: boolean;
  readonly provenance: readonly ProvenanceRef[];
}):
  | "CONSISTENT"
  | "LATER_POSITION_EXPLAINS_EARLIER_RECORD"
  | "EARLIER_RECORD_REQUIRES_RECONCILIATION"
  | "MATERIAL_DIVERGENCE"
  | "CONFLICT_UNRESOLVED" {
  provenanceSchema.parse(input.provenance);
  if (!input.conflict) return "CONSISTENT";
  if (input.laterExplainsEarlier) return "LATER_POSITION_EXPLAINS_EARLIER_RECORD";
  if (!input.sameScope) return "EARLIER_RECORD_REQUIRES_RECONCILIATION";
  if (input.corroborated) return "MATERIAL_DIVERGENCE";
  return "CONFLICT_UNRESOLVED";
}

export function analyzeRequestDecisionMismatch(input: {
  readonly map: RequestDispositionMap;
  readonly undecided?: RequestedButNotDecidedAnalysis;
}):
  | "REQUEST_SCOPE_MATCH"
  | "PARTIAL_SCOPE_MATCH"
  | "REQUEST_RECHARACTERIZED"
  | "REQUESTED_BUT_NOT_DECIDED"
  | "DECISION_DIFFERENT_OBJECT"
  | "REQUEST_PARTIALLY_DECIDED"
  | "NO_MATERIAL_MISMATCH"
  | "REQUIRES_SCOPE_ANALYSIS" {
  if (input.undecided?.status === "REQUESTED_BUT_NOT_DECIDED") return "REQUESTED_BUT_NOT_DECIDED";
  if (input.undecided?.status === "REQUIRES_SCOPE_ANALYSIS") return "REQUIRES_SCOPE_ANALYSIS";
  if (input.map.recharacterization) return "REQUEST_RECHARACTERIZED";
  if (input.map.procedural_decision_status === "PARTIALLY_DECIDED")
    return "REQUEST_PARTIALLY_DECIDED";
  if (
    input.map.procedural_decision_status === "NOT_DECIDED" &&
    input.map.material_satisfaction !== "NOT_SATISFIED"
  )
    return "PARTIAL_SCOPE_MATCH";
  return "NO_MATERIAL_MISMATCH";
}

export function analyzeReasoningOperativeContradiction(
  mismatch:
    | "CONSISTENT"
    | "REASONING_BROADER_THAN_OPERATIVE"
    | "OPERATIVE_BROADER_THAN_REASONING"
    | "PARTIAL_SCOPE_MISMATCH"
    | "MATERIAL_MISMATCH"
    | "UNKNOWN",
):
  | "NO_MATERIAL_EFFECT"
  | "REQUIRES_INTERPRETATION"
  | "POSSIBLE_PROCEDURAL_ISSUE"
  | "MATERIAL_PROCEDURAL_ISSUE"
  | "INSUFFICIENT_BASIS" {
  if (mismatch === "CONSISTENT") return "NO_MATERIAL_EFFECT";
  if (mismatch === "UNKNOWN") return "INSUFFICIENT_BASIS";
  if (mismatch === "MATERIAL_MISMATCH") return "MATERIAL_PROCEDURAL_ISSUE";
  return "POSSIBLE_PROCEDURAL_ISSUE";
}

export function analyzeEvidenceConflictContext(input: {
  readonly context: EvidenceConflictContext["context"];
  readonly conflicting: boolean;
  readonly provenance: readonly ProvenanceRef[];
}): EvidenceConflictContext {
  return evidenceConflictContextSchema.parse({
    context: input.context,
    classification: input.conflicting ? "TENSION" : "NOT_CONTRADICTORY",
    explanation: input.conflicting
      ? "Evidence conflict is elevated as context without duplicating evidentiary resolution."
      : "No contradiction context identified.",
    provenance: input.provenance,
  });
}

export function analyzeAuthoritySupport(input: {
  readonly legalProposition: LegalProposition;
  readonly authorityText?: string;
  readonly includesAdverseAspect?: boolean;
  readonly locatorMatches?: boolean;
  readonly provenance: readonly ProvenanceRef[];
}): LegalAuthoritySupport {
  provenanceSchema.parse(input.provenance);
  if (!input.authorityText) return "REQUIRES_VERIFICATION";
  if (input.locatorMatches === false) return "CONSIDERANDUM_SCOPE_MISMATCH";
  if (!input.authorityText.toLowerCase().includes(input.legalProposition.text.toLowerCase()))
    return "OVERSTATED_PROPOSITION";
  if (input.includesAdverseAspect === false) return "ADVERSE_ASPECT_OMITTED";
  return "SUPPORTED_BY_AUTHORITY";
}

export function analyzePrecedentUse(input: {
  readonly claimedUse: "STRONGLY_SUPPORTIVE" | "SUPPORTIVE" | "MIXED" | "ADVERSE";
  readonly application: PrecedentApplication;
  readonly favorableQuoteUsed?: boolean;
}):
  | "PRECEDENT_USE_OVERSTATED"
  | "CHERRY_PICKING_RISK"
  | "DISTINGUISHING_FACTORS_IGNORED"
  | "ADVERSE_ASPECTS_NOT_ADDRESSED"
  | "MIXED"
  | "NO_ISSUE" {
  if (input.claimedUse === "STRONGLY_SUPPORTIVE" && input.application.application === "MIXED")
    return input.favorableQuoteUsed ? "CHERRY_PICKING_RISK" : "PRECEDENT_USE_OVERSTATED";
  if (
    input.application.application === "ADVERSE" ||
    input.application.application === "STRONGLY_ADVERSE"
  )
    return "ADVERSE_ASPECTS_NOT_ADDRESSED";
  if (input.application.application === "DISTINGUISHABLE") return "DISTINGUISHING_FACTORS_IGNORED";
  if (input.application.application === "MIXED") return "MIXED";
  return "NO_ISSUE";
}

export function analyzeDocumentaryGapContext(input: {
  readonly absence: SignificantDocumentaryAbsence;
  readonly material: boolean;
  readonly productionRequired?: boolean;
  readonly provenance: readonly ProvenanceRef[];
}):
  | "RECORD_COMPLETENESS_UNCLEAR"
  | "MATERIAL_DOCUMENTARY_GAP"
  | "NO_MATERIAL_EFFECT"
  | "REQUIRES_PRODUCTION"
  | "INSUFFICIENT_BASIS" {
  provenanceSchema.parse(input.provenance);
  if (input.productionRequired) return "REQUIRES_PRODUCTION";
  if (input.material && input.absence.status === "ABSENCE_OBSERVED")
    return "MATERIAL_DOCUMENTARY_GAP";
  if (input.absence.status === "UNKNOWN") return "INSUFFICIENT_BASIS";
  if (!input.material) return "NO_MATERIAL_EFFECT";
  return "RECORD_COMPLETENESS_UNCLEAR";
}

export function explainContradiction(
  classification: ContradictionClassification,
  scope: ScopeComparison,
  temporal: TemporalComparison,
): string[] {
  const explanations = [
    "temporal development",
    "different scope",
    "drafting imprecision",
    "incomplete record",
    "new evidence",
    "legal recharacterization",
    "misunderstanding",
  ];
  if (classification === "DIRECT_CONTRADICTION")
    explanations.push("genuinely inconsistent account");
  if (scope === "DIFFERENT_SCOPE") return ["different scope"];
  if (temporal === "LATER_DEVELOPMENT") return ["temporal development"];
  return explanations;
}

export function calibrateContradictionDrafting(
  classification: ContradictionClassification,
): string {
  switch (classification) {
    case "DIRECT_CONTRADICTION":
      return "These two statements do not appear reconcilable on the current record.";
    case "TENSION":
      return "The two accounts present a tension requiring clarification.";
    case "SCOPE_MISMATCH":
    case "NOT_CONTRADICTORY":
      return "The two statements do not fully concern the same object or analytical level.";
    case "POSITION_CHANGE":
      return "The later account differs from the earlier documented position on this point.";
    case "REQUIRES_CLARIFICATION":
      return "The divergence requires clarification before a stronger conclusion is drawn.";
    default:
      return "The record should be described cautiously and without personal accusation.";
  }
}

export function buildContradictionMap(input: {
  readonly result: ContradictionAssessmentResult;
  readonly propositionIds?: readonly string[];
  readonly contexts?: readonly string[];
  readonly evidenceIds?: readonly string[];
  readonly chronologyEventIds?: readonly string[];
}): ContradictionMap {
  return contradictionMapSchema.parse({
    view_type: "CONTRADICTION_MAP",
    source_of_truth: false,
    entities_compared: input.result.compared_entity_ids,
    proposition_ids: [...(input.propositionIds ?? [])],
    contexts: [...(input.contexts ?? [])],
    classification: input.result.classification,
    materiality: input.result.materiality,
    evidence_ids: [...(input.evidenceIds ?? [])],
    chronology_event_ids: [...(input.chronologyEventIds ?? [])],
    possible_explanations: input.result.possible_explanations,
    opponent_explanation: input.result.best_opponent_explanation,
    legal_significance: input.result.legal_significance,
    recommended_role: input.result.strategic_value.recommended_role,
    drafting_formulation: input.result.drafting_formulation,
    unresolved_questions: input.result.unresolved_questions,
    provenance: input.result.provenance,
  });
}

export function protectHumanLockedContradictionAssessment(input: {
  readonly assessmentId: string;
  readonly reviewedState?: ReviewState;
  readonly newConflict: boolean;
}): { readonly status: "ACCEPT" | "REVIEW_REQUIRED"; readonly overwriteAllowed: boolean } {
  return evaluateHumanLockConflict({
    existing: { id: input.assessmentId, reviewed_state: input.reviewedState },
    incomingContradictsExisting: input.newConflict,
  });
}

function inferMateriality(classification: ContradictionClassification): Materiality {
  if (classification === "DIRECT_CONTRADICTION" || classification === "MATERIAL_INCONSISTENCY")
    return "HIGH";
  if (classification === "TENSION" || classification === "POSITION_CHANGE") return "SUPPORTING";
  if (classification === "NOT_CONTRADICTORY" || classification === "EXPLAINABLE_DIFFERENCE")
    return "IMMATERIAL";
  return "UNKNOWN";
}

function inferLegalSignificance(classification: ContradictionClassification): LegalSignificance {
  if (classification === "NOT_CONTRADICTORY" || classification === "EXPLAINABLE_DIFFERENCE")
    return "NO_MATERIAL_EFFECT";
  if (classification === "TEMPORAL_MISMATCH" || classification === "SCOPE_MISMATCH")
    return "PROCEDURAL";
  return "EVIDENTIARY";
}

function strategicValueFor(
  classification: ContradictionClassification,
  materiality: Materiality,
): StrategicValue {
  const recommendedRole: RecommendedRole =
    materiality === "IMMATERIAL" || materiality === "LOW"
      ? "DROP"
      : classification === "DIRECT_CONTRADICTION" && materiality === "HIGH"
        ? "MAIN"
        : "SECONDARY";
  return {
    legal_strength:
      recommendedRole === "MAIN" ? "HIGH" : recommendedRole === "DROP" ? "LOW" : "MEDIUM",
    evidentiary_strength:
      classification === "DIRECT_CONTRADICTION"
        ? "HIGH"
        : recommendedRole === "DROP"
          ? "LOW"
          : "MEDIUM",
    strategic_value:
      recommendedRole === "DROP" ? "DROP" : recommendedRole === "MAIN" ? "HIGH" : "MEDIUM",
    materiality,
    credibility_effect: "NEUTRAL",
    recommended_role: recommendedRole,
  };
}

function bestInnocentExplanation(
  scope: ScopeComparison,
  temporal: TemporalComparison,
  levelA: FactualLegalLevel,
  levelB: FactualLegalLevel,
): string {
  if (scope !== "SAME_SCOPE")
    return "The statements may address different or only partially overlapping scope.";
  if (temporal !== "SAME_TIMEFRAME") return "The difference may reflect a temporal development.";
  if (levelA !== levelB) return "The statements may operate on different factual/legal levels.";
  return "The difference may result from drafting imprecision or incomplete context.";
}
