import { z } from "zod";
import {
  confidenceSchema,
  evaluateHumanLockConflict,
  evidenceControlAssessmentSchema,
  evidenceSchema,
  proceduralContextSchema,
  provenanceRefSchema,
  type BurdenAssessment,
  type ClaimElement,
  type Evidence,
  type EvidenceControlAssessment,
  type FactualFinding,
  type MatterModel,
  type ProceduralContext,
  type Proposition,
  type ProvenanceRef,
} from "./matterModel.js";

const idSchema = z.string().min(1);

const evidenceEngineProvenanceSchema = z.array(provenanceRefSchema).min(1);

export const evidenceRelationTypeSchema = z.enum([
  "SUPPORTS",
  "STRONGLY_SUPPORTS",
  "CORROBORATES",
  "PARTIALLY_SUPPORTS",
  "CONTEXTUALIZES",
  "CONTRADICTS",
  "STRONGLY_CONTRADICTS",
  "DOES_NOT_ADDRESS",
  "AMBIGUOUS",
  "UNKNOWN",
]);
export type EvidenceRelationType = z.infer<typeof evidenceRelationTypeSchema>;

export const assessmentStatusSchema = z.enum([
  "ASSESSED",
  "DISPUTED",
  "REVIEW_REQUIRED",
  "INSUFFICIENT_CONTEXT",
  "UNKNOWN",
]);
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;

export const evidenceRelationshipSchema = z.object({
  evidence_id: idSchema,
  proposition_id: idSchema,
  relation_type: evidenceRelationTypeSchema,
  scope: z.string().min(1),
  confidence: confidenceSchema,
  provenance: evidenceEngineProvenanceSchema,
  procedural_context: proceduralContextSchema.optional(),
  assessment_status: assessmentStatusSchema,
});
export type EvidenceRelationship = z.infer<typeof evidenceRelationshipSchema>;

export const evidenceStrengthSchema = z.enum([
  "PRIMARY_DIRECT",
  "DIRECT",
  "CORROBORATIVE",
  "INDIRECT",
  "CIRCUMSTANTIAL",
  "INFERENCE_SUPPORT",
  "PARTIAL",
  "CONTRADICTED",
  "UNVERIFIED",
]);
export type EvidenceStrength = z.infer<typeof evidenceStrengthSchema>;

export const authenticityStatusSchema = z.enum([
  "AUTHENTICATED",
  "LIKELY_AUTHENTIC",
  "DISPUTED",
  "UNKNOWN",
]);
export type AuthenticityStatus = z.infer<typeof authenticityStatusSchema>;

export const contentVerificationStatusSchema = z.enum([
  "FULL_TEXT_VERIFIED",
  "PARTIAL_TEXT_VERIFIED",
  "METADATA_ONLY",
  "UNVERIFIED",
]);
export type ContentVerificationStatus = z.infer<typeof contentVerificationStatusSchema>;

export const admissibilityStatusSchema = z.enum([
  "ADMISSIBLE",
  "LIKELY_ADMISSIBLE",
  "DISPUTED",
  "EXCLUDED",
  "UNKNOWN",
]);
export type AdmissibilityStatus = z.infer<typeof admissibilityStatusSchema>;

export const availabilityStatusSchema = z.enum([
  "AVAILABLE_TO_SYSTEM",
  "NOT_AVAILABLE_TO_SYSTEM",
  "REQUESTED_NOT_PRODUCED",
  "CONTROLLED_BY_OTHER",
  "UNKNOWN",
]);
export type AvailabilityStatus = z.infer<typeof availabilityStatusSchema>;

export const evidenceStrengthAssessmentSchema = z.object({
  evidence_id: idSchema,
  proposition_id: idSchema,
  strength: evidenceStrengthSchema,
  authenticity_status: authenticityStatusSchema,
  content_verification_status: contentVerificationStatusSchema,
  admissibility_status: admissibilityStatusSchema,
  availability_status: availabilityStatusSchema,
  contemporaneous_factor: z.enum([
    "CONTEMPORANEOUS_PRIMARY_RECORD",
    "NOT_CONTEMPORANEOUS",
    "UNKNOWN",
  ]),
  explanation: z.string().min(1),
  confidence: confidenceSchema,
  provenance: evidenceEngineProvenanceSchema,
  procedural_context: proceduralContextSchema.optional(),
});
export type EvidenceStrengthAssessment = z.infer<typeof evidenceStrengthAssessmentSchema>;

export const aggregatedEvidentiaryStatusSchema = z.enum([
  "PROVEN",
  "STRONGLY_SUPPORTED",
  "SUPPORTED",
  "PARTIALLY_SUPPORTED",
  "DISPUTED",
  "CONTRADICTED",
  "UNPROVEN",
  "UNKNOWN",
]);
export type AggregatedEvidentiaryStatus = z.infer<typeof aggregatedEvidentiaryStatusSchema>;

export const missingEvidenceStatusSchema = z.enum([
  "NO_EVIDENCE_IDENTIFIED",
  "EVIDENCE_NOT_AVAILABLE_TO_SYSTEM",
  "EVIDENCE_REQUESTED_NOT_PRODUCED",
  "EVIDENCE_CONTROLLED_BY_OTHER_PARTY",
  "EVIDENCE_CONTROLLED_BY_AUTHORITY",
  "EVIDENCE_EXPECTED_BUT_NOT_LOCATED",
  "EVIDENCE_PROBABLY_DOES_NOT_EXIST",
  "PROVEN_NONEXISTENCE",
]);
export type MissingEvidenceStatus = z.infer<typeof missingEvidenceStatusSchema>;

export const significantAbsenceOutcomeSchema = z.enum([
  "DOCUMENTARY_GAP_REQUIRES_EXPLANATION",
  "EVIDENTIARY_REQUEST_RECOMMENDED",
  "NO_MATERIAL_EFFECT",
  "INSUFFICIENT_CONTEXT",
]);
export type SignificantAbsenceOutcome = z.infer<typeof significantAbsenceOutcomeSchema>;

export const evidenceRequestRecommendationSchema = z.enum([
  "REQUEST_DOCUMENT",
  "REQUEST_AKTENEDITION",
  "REQUEST_AKTENEINSICHT",
  "REQUEST_CLARIFICATION",
  "REQUEST_THIRD_PARTY_EVIDENCE",
  "NO_REQUEST_NEEDED",
  "INSUFFICIENT_BASIS",
]);
export type EvidenceRequestRecommendation = z.infer<typeof evidenceRequestRecommendationSchema>;

export const selectiveEvidenceStatusSchema = z.enum([
  "SELECTIVE_RECORD_POSSIBLE",
  "RECORD_COMPLETENESS_UNCLEAR",
  "REQUIRES_DOCUMENT_PRODUCTION",
  "NO_ISSUE",
]);
export type SelectiveEvidenceStatus = z.infer<typeof selectiveEvidenceStatusSchema>;

export const claimElementEvidenceStatusSchema = z.enum([
  "SATISFIED",
  "PARTIALLY_SATISFIED",
  "EVIDENTIARY_GAP",
  "DISPUTED",
  "UNKNOWN",
]);
export type ClaimElementEvidenceStatus = z.infer<typeof claimElementEvidenceStatusSchema>;

export const aggregatedEvidentiaryAssessmentSchema = z.object({
  proposition_id: idSchema,
  status: aggregatedEvidentiaryStatusSchema,
  supporting_evidence_ids: z.array(idSchema),
  contradictory_evidence_ids: z.array(idSchema),
  corroborating_evidence_ids: z.array(idSchema),
  unresolved_conflicts: z.array(z.string().min(1)),
  missing_evidence: z.array(missingEvidenceStatusSchema),
  evidence_control: z.array(evidenceControlAssessmentSchema),
  burden_implications: z.array(z.string().min(1)),
  explanation: z.string().min(1),
  provenance: evidenceEngineProvenanceSchema,
  procedural_context: proceduralContextSchema.optional(),
});
export type AggregatedEvidentiaryAssessment = z.infer<typeof aggregatedEvidentiaryAssessmentSchema>;

export const significantDocumentaryAbsenceAnalysisSchema = z.object({
  outcome: significantAbsenceOutcomeSchema,
  missing_evidence_status: missingEvidenceStatusSchema,
  significance: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  alternative_explanations: z.array(z.string().min(1)),
  recommended_action: evidenceRequestRecommendationSchema,
  explanation: z.string().min(1),
  provenance: evidenceEngineProvenanceSchema,
  procedural_context: proceduralContextSchema.optional(),
});
export type SignificantDocumentaryAbsenceAnalysis = z.infer<
  typeof significantDocumentaryAbsenceAnalysisSchema
>;

export const conflictingEvidenceAnalysisSchema = z.object({
  status: z.literal("CONFLICTING_EVIDENCE"),
  conflict_description: z.string().min(1),
  evidence_a_id: idSchema,
  evidence_b_id: idSchema,
  possible_reconciliation: z.string().min(1),
  unresolved_point: z.string().min(1),
  recommended_action: evidenceRequestRecommendationSchema,
  provenance: evidenceEngineProvenanceSchema,
  procedural_context: proceduralContextSchema.optional(),
});
export type ConflictingEvidenceAnalysis = z.infer<typeof conflictingEvidenceAnalysisSchema>;

export const contemporaneousEvidenceAnalysisSchema = z.object({
  status: z.enum(["REQUIRES_RECONCILIATION", "NO_CONFLICT", "INSUFFICIENT_CONTEXT"]),
  contemporaneous_evidence_id: idSchema.optional(),
  later_assertion_id: idSchema.optional(),
  explanation: z.string().min(1),
  prohibited_conclusion: z.literal("NO_LIE_INFERENCE"),
  provenance: evidenceEngineProvenanceSchema,
});
export type ContemporaneousEvidenceAnalysis = z.infer<typeof contemporaneousEvidenceAnalysisSchema>;

export const selectiveEvidenceAnalysisSchema = z.object({
  status: selectiveEvidenceStatusSchema,
  produced_evidence_ids: z.array(idSchema),
  missing_expected_evidence: z.array(z.string().min(1)),
  explanation: z.string().min(1),
  prohibited_conclusion: z.literal("NO_CONCEALMENT_INFERENCE"),
  recommended_action: evidenceRequestRecommendationSchema,
  provenance: evidenceEngineProvenanceSchema,
});
export type SelectiveEvidenceAnalysis = z.infer<typeof selectiveEvidenceAnalysisSchema>;

export const evidenceRequestAnalysisSchema = z.object({
  recommendation: evidenceRequestRecommendationSchema,
  why: z.string().min(1),
  who: z.string().min(1).optional(),
  what: z.string().min(1),
  what_it_would_prove: z.string().min(1),
  consequence_if_not_produced: z.string().min(1),
  provenance: evidenceEngineProvenanceSchema,
  procedural_context: proceduralContextSchema.optional(),
});
export type EvidenceRequestAnalysis = z.infer<typeof evidenceRequestAnalysisSchema>;

export const evidenceMapSchema = z.object({
  view_type: z.literal("EVIDENCE_MAP"),
  source_of_truth: z.literal(false),
  proposition_id: idSchema,
  assertion_ids: z.array(idSchema),
  supporting_evidence_ids: z.array(idSchema),
  contradicting_evidence_ids: z.array(idSchema),
  missing_evidence: z.array(missingEvidenceStatusSchema),
  burden_assessment_ids: z.array(idSchema),
  evidence_control_assessment_ids: z.array(idSchema),
  assessment: aggregatedEvidentiaryAssessmentSchema,
  unresolved_questions: z.array(z.string().min(1)),
  recommended_action: evidenceRequestRecommendationSchema,
});
export type EvidenceMap = z.infer<typeof evidenceMapSchema>;

export const claimElementEvidenceLinkSchema = z.object({
  claim_element_id: idSchema,
  proposition_id: idSchema,
  finding_ids: z.array(idSchema),
  evidence_ids: z.array(idSchema),
  status: claimElementEvidenceStatusSchema,
  explanation: z.string().min(1),
  provenance: evidenceEngineProvenanceSchema,
});
export type ClaimElementEvidenceLink = z.infer<typeof claimElementEvidenceLinkSchema>;

export function createEvidenceRelationship(input: EvidenceRelationship): EvidenceRelationship {
  return evidenceRelationshipSchema.parse(input);
}

export function assessEvidenceStrength(
  input: EvidenceStrengthAssessment,
): EvidenceStrengthAssessment {
  return evidenceStrengthAssessmentSchema.parse(input);
}

export function classifyMissingEvidence(input: {
  readonly evidenceAvailableToSystem?: boolean;
  readonly requested?: boolean;
  readonly produced?: boolean;
  readonly controlledBy?: "AUTHORITY" | "OTHER_PARTY" | "UNKNOWN";
  readonly expectedButNotLocated?: boolean;
  readonly probableNonexistence?: boolean;
  readonly provenNonexistence?: boolean;
  readonly provenance: readonly ProvenanceRef[];
  readonly explanation: string;
}): MissingEvidenceStatus {
  evidenceEngineProvenanceSchema.parse(input.provenance);
  if (input.provenNonexistence) return "PROVEN_NONEXISTENCE";
  if (input.probableNonexistence) return "EVIDENCE_PROBABLY_DOES_NOT_EXIST";
  if (input.requested && input.produced === false) return "EVIDENCE_REQUESTED_NOT_PRODUCED";
  if (input.controlledBy === "AUTHORITY") return "EVIDENCE_CONTROLLED_BY_AUTHORITY";
  if (input.controlledBy === "OTHER_PARTY") return "EVIDENCE_CONTROLLED_BY_OTHER_PARTY";
  if (input.evidenceAvailableToSystem === false) return "EVIDENCE_NOT_AVAILABLE_TO_SYSTEM";
  if (input.expectedButNotLocated) return "EVIDENCE_EXPECTED_BUT_NOT_LOCATED";
  return "NO_EVIDENCE_IDENTIFIED";
}

export function aggregateEvidentiaryAssessment(input: {
  readonly proposition: Proposition;
  readonly relationships: readonly EvidenceRelationship[];
  readonly strengths: readonly EvidenceStrengthAssessment[];
  readonly missingEvidence?: readonly MissingEvidenceStatus[];
  readonly evidenceControl?: readonly EvidenceControlAssessment[];
  readonly burdenAssessments?: readonly BurdenAssessment[];
  readonly proceduralContext?: ProceduralContext;
  readonly provenance: readonly ProvenanceRef[];
}): AggregatedEvidentiaryAssessment {
  const relationships = input.relationships.filter(
    (item) => item.proposition_id === input.proposition.id,
  );
  const supporting = relationships.filter((item) =>
    ["SUPPORTS", "STRONGLY_SUPPORTS", "CORROBORATES", "PARTIALLY_SUPPORTS"].includes(
      item.relation_type,
    ),
  );
  const contradictory = relationships.filter((item) =>
    ["CONTRADICTS", "STRONGLY_CONTRADICTS"].includes(item.relation_type),
  );
  const corroborating = relationships.filter((item) => item.relation_type === "CORROBORATES");
  const strongSupport = supporting.some((item) => item.relation_type === "STRONGLY_SUPPORTS");
  const relevantStrengths = input.strengths.filter(
    (item) => item.proposition_id === input.proposition.id,
  );
  const highConfidenceSupport =
    supporting.length >= 2 &&
    supporting.every((item) => item.confidence >= 0.95) &&
    relevantStrengths.length > 0 &&
    relevantStrengths.every((item) => item.confidence >= 0.95);
  const directStrength = input.strengths.some(
    (item) =>
      item.proposition_id === input.proposition.id &&
      ["PRIMARY_DIRECT", "DIRECT"].includes(item.strength) &&
      item.availability_status === "AVAILABLE_TO_SYSTEM",
  );

  let status: AggregatedEvidentiaryStatus = "UNKNOWN";
  if (supporting.length === 0 && contradictory.length === 0) status = "UNPROVEN";
  else if (contradictory.length > 0 && supporting.length > 0) status = "DISPUTED";
  else if (contradictory.length > 0) status = "CONTRADICTED";
  else if (
    strongSupport &&
    directStrength &&
    corroborating.length > 0 &&
    highConfidenceSupport &&
    (input.missingEvidence ?? []).length === 0
  )
    status = "PROVEN";
  else if (strongSupport && directStrength && corroborating.length > 0)
    status = "STRONGLY_SUPPORTED";
  else if (strongSupport || directStrength) status = "SUPPORTED";
  else if (supporting.some((item) => item.relation_type === "PARTIALLY_SUPPORTS"))
    status = "PARTIALLY_SUPPORTED";
  else if (supporting.length > 0) status = "SUPPORTED";

  const burdenImplications = (input.burdenAssessments ?? []).map((burden) =>
    burden.status === "TO_BE_DETERMINED"
      ? `Burden for ${burden.proposition_id} remains to be determined.`
      : `Burden remains with ${burden.bearer_actor_id ?? burden.bearer_status}; no automatic shift from evidence control.`,
  );

  return aggregatedEvidentiaryAssessmentSchema.parse({
    proposition_id: input.proposition.id,
    status,
    supporting_evidence_ids: supporting.map((item) => item.evidence_id),
    contradictory_evidence_ids: contradictory.map((item) => item.evidence_id),
    corroborating_evidence_ids: corroborating.map((item) => item.evidence_id),
    unresolved_conflicts:
      contradictory.length > 0 && supporting.length > 0
        ? ["Supporting and contradictory evidence coexist; reconciliation is required."]
        : [],
    missing_evidence: [...(input.missingEvidence ?? [])],
    evidence_control: [...(input.evidenceControl ?? [])],
    burden_implications: burdenImplications,
    explanation: explainAggregatedStatus(status),
    provenance: input.provenance,
    procedural_context: input.proceduralContext,
  });
}

export function analyzeEvidenceControl(input: {
  readonly control: EvidenceControlAssessment;
  readonly missingEvidenceStatus?: MissingEvidenceStatus;
  readonly provenance: readonly ProvenanceRef[];
}): EvidenceRequestAnalysis {
  evidenceControlAssessmentSchema.parse(input.control);
  const recommendation =
    input.control.requested_status === "REQUESTED" && input.control.production_status !== "PRODUCED"
      ? "REQUEST_AKTENEDITION"
      : input.control.control_type === "ADMINISTRATIVE_FILE_CONTROL"
        ? "REQUEST_AKTENEINSICHT"
        : "REQUEST_DOCUMENT";

  return evidenceRequestAnalysisSchema.parse({
    recommendation,
    why: `${input.control.control_type} indicates practical or legal control without changing legal burden.`,
    who: input.control.actor_id,
    what: input.control.document_id ?? input.control.evidence_id ?? "controlled evidence",
    what_it_would_prove: input.control.proposition_id ?? "the relevant proposition",
    consequence_if_not_produced:
      input.missingEvidenceStatus === "EVIDENCE_REQUESTED_NOT_PRODUCED"
        ? "The gap remains procedural/evidentiary and should not be treated as proven nonexistence."
        : "The record remains incomplete unless the evidence is produced or explained.",
    provenance: input.provenance,
    procedural_context: input.control.procedural_context,
  });
}

export function analyzeSignificantDocumentaryAbsence(input: {
  readonly documentNormallyExpected: boolean;
  readonly actorControlsIt: boolean;
  readonly specificallyRequested: boolean;
  readonly actorAnsweredSameComplex: boolean;
  readonly relatedDocumentsProduced: boolean;
  readonly materialToNarrative: boolean;
  readonly provenance: readonly ProvenanceRef[];
  readonly proceduralContext?: ProceduralContext;
}): SignificantDocumentaryAbsenceAnalysis {
  const factors = [
    input.documentNormallyExpected,
    input.actorControlsIt,
    input.specificallyRequested,
    input.actorAnsweredSameComplex,
    input.relatedDocumentsProduced,
    input.materialToNarrative,
  ].filter(Boolean).length;
  const outcome: SignificantAbsenceOutcome =
    factors >= 5
      ? "DOCUMENTARY_GAP_REQUIRES_EXPLANATION"
      : factors >= 3
        ? "EVIDENTIARY_REQUEST_RECOMMENDED"
        : factors >= 1
          ? "INSUFFICIENT_CONTEXT"
          : "NO_MATERIAL_EFFECT";

  return significantDocumentaryAbsenceAnalysisSchema.parse({
    outcome,
    missing_evidence_status: input.specificallyRequested
      ? "EVIDENCE_REQUESTED_NOT_PRODUCED"
      : "EVIDENCE_EXPECTED_BUT_NOT_LOCATED",
    significance:
      factors >= 5 ? "HIGH" : factors >= 3 ? "MEDIUM" : factors >= 1 ? "LOW" : "UNKNOWN",
    alternative_explanations: [
      "The document may not have been created.",
      "The document may be held in a separate file.",
      "The document may have been omitted without bad faith.",
    ],
    recommended_action:
      outcome === "DOCUMENTARY_GAP_REQUIRES_EXPLANATION"
        ? "REQUEST_CLARIFICATION"
        : outcome === "EVIDENTIARY_REQUEST_RECOMMENDED"
          ? "REQUEST_DOCUMENT"
          : "INSUFFICIENT_BASIS",
    explanation:
      "Documentary absence is treated as a gap requiring explanation, not as concealment.",
    provenance: input.provenance,
    procedural_context: input.proceduralContext,
  });
}

export function analyzeContradictoryEvidence(input: {
  readonly evidenceA: Evidence;
  readonly evidenceB: Evidence;
  readonly relationshipA: EvidenceRelationship;
  readonly relationshipB: EvidenceRelationship;
  readonly provenance: readonly ProvenanceRef[];
  readonly proceduralContext?: ProceduralContext;
}): ConflictingEvidenceAnalysis {
  evidenceSchema.parse(input.evidenceA);
  evidenceSchema.parse(input.evidenceB);
  return conflictingEvidenceAnalysisSchema.parse({
    status: "CONFLICTING_EVIDENCE",
    conflict_description: `${input.evidenceA.id} and ${input.evidenceB.id} point in different evidentiary directions.`,
    evidence_a_id: input.evidenceA.id,
    evidence_b_id: input.evidenceB.id,
    possible_reconciliation:
      "The conflict may be reconciled by timing, scope, source, or a missing explanatory document.",
    unresolved_point:
      "The evidentiary conflict must not be resolved by recency, official source, or quantity alone.",
    recommended_action: "REQUEST_CLARIFICATION",
    provenance: input.provenance,
    procedural_context: input.proceduralContext,
  });
}

export function analyzeContemporaneousEvidence(input: {
  readonly contemporaneousEvidenceId?: string;
  readonly laterAssertionId?: string;
  readonly contradicts: boolean;
  readonly provenance: readonly ProvenanceRef[];
}): ContemporaneousEvidenceAnalysis {
  return contemporaneousEvidenceAnalysisSchema.parse({
    status: input.contradicts ? "REQUIRES_RECONCILIATION" : "NO_CONFLICT",
    contemporaneous_evidence_id: input.contemporaneousEvidenceId,
    later_assertion_id: input.laterAssertionId,
    explanation: input.contradicts
      ? "The later assertion requires reconciliation with the contemporaneous primary record."
      : "No material inconsistency is identified on the available record.",
    prohibited_conclusion: "NO_LIE_INFERENCE",
    provenance: input.provenance,
  });
}

export function analyzeSelectiveEvidence(input: {
  readonly producedEvidenceIds: readonly string[];
  readonly missingExpectedEvidence: readonly string[];
  readonly missingWasRequested: boolean;
  readonly sameController: boolean;
  readonly provenance: readonly ProvenanceRef[];
}): SelectiveEvidenceAnalysis {
  const status: SelectiveEvidenceStatus =
    input.missingExpectedEvidence.length === 0
      ? "NO_ISSUE"
      : input.missingWasRequested && input.sameController
        ? "REQUIRES_DOCUMENT_PRODUCTION"
        : input.producedEvidenceIds.length > 0
          ? "RECORD_COMPLETENESS_UNCLEAR"
          : "SELECTIVE_RECORD_POSSIBLE";

  return selectiveEvidenceAnalysisSchema.parse({
    status,
    produced_evidence_ids: [...input.producedEvidenceIds],
    missing_expected_evidence: [...input.missingExpectedEvidence],
    explanation:
      status === "NO_ISSUE"
        ? "No selective evidence issue is identifiable."
        : "The record may be incomplete; no concealment or bad-faith inference is drawn.",
    prohibited_conclusion: "NO_CONCEALMENT_INFERENCE",
    recommended_action:
      status === "REQUIRES_DOCUMENT_PRODUCTION" ? "REQUEST_DOCUMENT" : "REQUEST_CLARIFICATION",
    provenance: input.provenance,
  });
}

export function recommendEvidenceRequest(input: {
  readonly missingEvidence: MissingEvidenceStatus;
  readonly control?: EvidenceControlAssessment;
  readonly burden?: BurdenAssessment;
  readonly significance: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  readonly what: string;
  readonly provenance: readonly ProvenanceRef[];
  readonly proceduralContext?: ProceduralContext;
}): EvidenceRequestAnalysis {
  const recommendation: EvidenceRequestRecommendation =
    input.significance === "LOW"
      ? "NO_REQUEST_NEEDED"
      : input.missingEvidence === "EVIDENCE_NOT_AVAILABLE_TO_SYSTEM"
        ? "REQUEST_DOCUMENT"
        : input.control?.control_type === "ADMINISTRATIVE_FILE_CONTROL"
          ? "REQUEST_AKTENEINSICHT"
          : input.missingEvidence === "EVIDENCE_REQUESTED_NOT_PRODUCED"
            ? "REQUEST_AKTENEDITION"
            : input.missingEvidence === "NO_EVIDENCE_IDENTIFIED"
              ? "INSUFFICIENT_BASIS"
              : "REQUEST_CLARIFICATION";

  return evidenceRequestAnalysisSchema.parse({
    recommendation,
    why: `Recommendation is based on ${input.missingEvidence}, significance ${input.significance}, and known control/burden without inventing legal burden.`,
    who: input.control?.actor_id,
    what: input.what,
    what_it_would_prove: input.burden?.proposition_id ?? "the proposition under assessment",
    consequence_if_not_produced:
      "The evidentiary gap remains open; non-production is not treated as proven nonexistence.",
    provenance: input.provenance,
    procedural_context: input.proceduralContext,
  });
}

export function buildEvidenceMap(input: {
  readonly model: MatterModel;
  readonly propositionId: string;
  readonly relationships: readonly EvidenceRelationship[];
  readonly strengths: readonly EvidenceStrengthAssessment[];
  readonly missingEvidence?: readonly MissingEvidenceStatus[];
  readonly provenance: readonly ProvenanceRef[];
}): EvidenceMap {
  const proposition = input.model.propositions.find((item) => item.id === input.propositionId);
  if (!proposition) throw new Error(`Unknown proposition '${input.propositionId}'.`);
  const assessment = aggregateEvidentiaryAssessment({
    proposition,
    relationships: input.relationships,
    strengths: input.strengths,
    missingEvidence: input.missingEvidence,
    evidenceControl: input.model.evidence_control_assessments.filter(
      (item) => item.proposition_id === proposition.id,
    ),
    burdenAssessments: input.model.burden_assessments.filter(
      (item) => item.proposition_id === proposition.id,
    ),
    provenance: input.provenance,
  });
  const recommendation = recommendEvidenceRequest({
    missingEvidence: assessment.missing_evidence[0] ?? "NO_EVIDENCE_IDENTIFIED",
    control: assessment.evidence_control[0],
    burden: input.model.burden_assessments.find((item) => item.proposition_id === proposition.id),
    significance: assessment.missing_evidence.length > 0 ? "MEDIUM" : "LOW",
    what: proposition.text,
    provenance: input.provenance,
  });

  return evidenceMapSchema.parse({
    view_type: "EVIDENCE_MAP",
    source_of_truth: false,
    proposition_id: proposition.id,
    assertion_ids: input.model.assertions
      .filter((item) => item.proposition_id === proposition.id)
      .map((item) => item.id),
    supporting_evidence_ids: assessment.supporting_evidence_ids,
    contradicting_evidence_ids: assessment.contradictory_evidence_ids,
    missing_evidence: assessment.missing_evidence,
    burden_assessment_ids: input.model.burden_assessments
      .filter((item) => item.proposition_id === proposition.id)
      .map((item) => item.id),
    evidence_control_assessment_ids: assessment.evidence_control.map((item) => item.id),
    assessment,
    unresolved_questions: assessment.unresolved_conflicts,
    recommended_action: recommendation.recommendation,
  });
}

export function assessClaimElementEvidence(input: {
  readonly claimElement: ClaimElement;
  readonly assessment: AggregatedEvidentiaryAssessment;
  readonly findingIds?: readonly string[];
  readonly provenance: readonly ProvenanceRef[];
}): ClaimElementEvidenceLink {
  const status: ClaimElementEvidenceStatus =
    input.assessment.status === "PROVEN" || input.assessment.status === "STRONGLY_SUPPORTED"
      ? "SATISFIED"
      : input.assessment.status === "SUPPORTED" || input.assessment.status === "PARTIALLY_SUPPORTED"
        ? "PARTIALLY_SATISFIED"
        : input.assessment.status === "DISPUTED" || input.assessment.status === "CONTRADICTED"
          ? "DISPUTED"
          : input.assessment.missing_evidence.length > 0
            ? "EVIDENTIARY_GAP"
            : "UNKNOWN";

  return claimElementEvidenceLinkSchema.parse({
    claim_element_id: input.claimElement.id,
    proposition_id: input.claimElement.proposition_id,
    finding_ids: [...(input.findingIds ?? [])],
    evidence_ids: [
      ...input.assessment.supporting_evidence_ids,
      ...input.assessment.contradictory_evidence_ids,
    ],
    status,
    explanation:
      "Claim element status follows the evidentiary assessment without computing a winning case.",
    provenance: input.provenance,
  });
}

export function calibrateEvidentiaryLanguage(
  status: AggregatedEvidentiaryStatus,
  language: "de" | "fr" | "it" | "en" = "de",
): string {
  const de: Record<AggregatedEvidentiaryStatus, string> = {
    PROVEN: "ist dokumentarisch belegt",
    STRONGLY_SUPPORTED: "wird durch die Unterlagen stark gestuetzt",
    SUPPORTED: "findet in den Unterlagen eine Stuetzung",
    PARTIALLY_SUPPORTED: "ist teilweise belegt",
    DISPUTED: "bleibt umstritten",
    CONTRADICTED: "die verfuegbaren Unterlagen enthalten nicht vollstaendig vereinbare Elemente",
    UNPROVEN: "ist auf Grundlage der verfuegbaren Unterlagen nicht belegt",
    UNKNOWN: "laesst sich anhand der verfuegbaren Unterlagen nicht bestimmen",
  };
  const en: Record<AggregatedEvidentiaryStatus, string> = {
    PROVEN: "is documented by the available record",
    STRONGLY_SUPPORTED: "is strongly supported by the available record",
    SUPPORTED: "is supported by the available record",
    PARTIALLY_SUPPORTED: "is partially supported",
    DISPUTED: "remains disputed",
    CONTRADICTED: "the available record contains incompatible elements",
    UNPROVEN: "is not proven on the available record",
    UNKNOWN: "cannot be determined on the available record",
  };
  if (language === "en") return en[status];
  return de[status];
}

export function protectHumanReviewedFinding(input: {
  readonly finding: FactualFinding;
  readonly contraryEvidenceIds: readonly string[];
}): { readonly status: "ACCEPT" | "REVIEW_REQUIRED"; readonly overwriteAllowed: boolean } {
  return evaluateHumanLockConflict({
    existing: { id: input.finding.id, reviewed_state: input.finding.reviewed_state },
    incomingContradictsExisting: input.contraryEvidenceIds.length > 0,
  });
}

function explainAggregatedStatus(status: AggregatedEvidentiaryStatus): string {
  switch (status) {
    case "PROVEN":
      return "Evidence is sufficient for a proven assessment, but this does not create a FactualFinding automatically.";
    case "STRONGLY_SUPPORTED":
      return "Evidence strongly supports the proposition without automatic fact promotion.";
    case "SUPPORTED":
      return "Evidence supports the proposition without resolving all legal consequences.";
    case "PARTIALLY_SUPPORTED":
      return "Evidence supports part of the proposition only.";
    case "DISPUTED":
      return "Supporting and contradictory evidence coexist.";
    case "CONTRADICTED":
      return "Available evidence contradicts the proposition.";
    case "UNPROVEN":
      return "No supporting evidence is identified in the available record.";
    case "UNKNOWN":
      return "The evidentiary state cannot be determined.";
  }
}
