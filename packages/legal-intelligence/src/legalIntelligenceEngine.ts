import { z } from "zod";
import {
  confidenceSchema,
  provenanceRefSchema,
  type BurdenAssessment,
  type Claim,
  type ClaimElement,
  type Evidence,
  type LegalAuthority,
  type LegalCharacterization,
  type LegalProposition,
  type MatterModel,
  type PrecedentApplication,
  type Proposition,
  type ProvenanceRef,
} from "@swiss-legal-mcp/core";
import type { RequestedButNotDecidedAnalysis } from "@swiss-legal-mcp/chronology";
import type {
  ContradictionAssessmentResult,
  LegalAuthoritySupport,
} from "@swiss-legal-mcp/contradiction-engine";

const idSchema = z.string().min(1);
const provenanceSchema = z.array(provenanceRefSchema).min(1);

export const issueCategorySchema = z.enum([
  "JURISDICTION",
  "COMPETENCE",
  "STANDING",
  "ADMISSIBILITY",
  "STREITGEGENSTAND",
  "ANFECHTUNGSGEGENSTAND",
  "APPLICABLE_LAW",
  "TEMPORAL_LAW",
  "PROCEDURAL_RIGHTS",
  "RIGHT_TO_BE_HEARD",
  "EVIDENCE",
  "BURDEN",
  "REASONING_REQUIREMENT",
  "PROPORTIONALITY",
  "EQUALITY",
  "LEGITIMATE_EXPECTATIONS",
  "NULLITY",
  "PROCEDURAL_DELAY",
  "DENIAL_OF_JUSTICE",
  "REMEDY",
  "COSTS",
  "INTERIM_MEASURES",
  "DEADLINES",
  "MATERIAL_RIGHT",
  "OTHER",
]);
export type IssueCategory = z.infer<typeof issueCategorySchema>;

export const issueStatusSchema = z.enum([
  "ISSUE_CANDIDATE",
  "ISSUE_SUPPORTED",
  "ISSUE_MATERIAL",
  "ISSUE_DISPOSITIVE",
  "ISSUE_IRRELEVANT",
  "ISSUE_REQUIRES_MORE_FACTS",
  "ISSUE_REQUIRES_LEGAL_RESEARCH",
]);
export type IssueStatus = z.infer<typeof issueStatusSchema>;

export const issueTriggerSchema = z.object({
  trigger_id: idSchema,
  source_type: z.enum([
    "CLAIM",
    "REQUEST_DECISION_MISMATCH",
    "CONTRADICTION",
    "MISSING_EVIDENCE",
    "BURDEN_ASSESSMENT",
    "PROCEDURAL_CONTEXT",
    "LEGAL_CHARACTERIZATION",
    "CHRONOLOGY_SIGNAL",
    "ADVERSE_PRECEDENT",
    "DECISION_REASONING",
    "REQUESTED_REMEDY",
  ]),
  reason: z.string().min(1),
  provenance: provenanceSchema,
  confidence: confidenceSchema,
  materiality: z.enum(["DISPOSITIVE", "HIGH", "SUPPORTING", "LOW", "UNKNOWN"]),
});
export type IssueTrigger = z.infer<typeof issueTriggerSchema>;

export const detectedIssueSchema = z.object({
  issue_id: idSchema,
  category: issueCategorySchema,
  status: issueStatusSchema,
  text: z.string().min(1),
  trigger_ids: z.array(idSchema).min(1),
  reason: z.string().min(1),
  confidence: confidenceSchema,
  materiality: z.enum(["DISPOSITIVE", "HIGH", "SUPPORTING", "LOW", "UNKNOWN"]),
  provenance: provenanceSchema,
});

export const enhancedClaimElementSchema = z.object({
  id: idSchema,
  base_claim_element_id: idSchema.optional(),
  element_type: z.enum([
    "REQUIRED_FACTUAL_ELEMENT",
    "REQUIRED_LEGAL_ELEMENT",
    "PROCEDURAL_PREREQUISITE",
    "EVIDENTIARY_REQUIREMENT",
    "REMEDY_REQUIREMENT",
  ]),
  proposition_id: idSchema.optional(),
  legal_proposition_id: idSchema.optional(),
  evidence_ids: z.array(idSchema).default([]),
  status: z.enum([
    "SATISFIED",
    "PARTIALLY_SATISFIED",
    "FACTUAL_GAP",
    "EVIDENTIARY_GAP",
    "LEGAL_GAP",
    "PROCEDURAL_GAP",
    "DISPUTED",
    "NOT_REQUIRED",
    "UNKNOWN",
  ]),
  dependencies: z.array(idSchema).default([]),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type EnhancedClaimElement = z.infer<typeof enhancedClaimElementSchema>;

export const legalPropositionVerificationLevelSchema = z.enum([
  "IDENTITY_ONLY",
  "TEXT_LOCATED",
  "MATERIAL_PROPOSITION_VERIFIED",
  "PROPOSITION_PARTIALLY_VERIFIED",
  "PROPOSITION_MISMATCH",
  "UNVERIFIED",
  "ADVERSE_CONTEXT_PRESENT",
]);
export type LegalPropositionVerificationLevel = z.infer<
  typeof legalPropositionVerificationLevelSchema
>;

export const sourceHierarchySchema = z.object({
  source_type: z.enum([
    "CONSTITUTION",
    "FEDERAL_STATUTE",
    "FEDERAL_ORDINANCE",
    "CANTONAL_CONSTITUTION",
    "CANTONAL_STATUTE",
    "CANTONAL_ORDINANCE",
    "COMMUNAL_LAW",
    "FEDERAL_SUPREME_COURT_PRECEDENT",
    "FEDERAL_ADMINISTRATIVE_COURT",
    "FEDERAL_CRIMINAL_COURT",
    "CANTONAL_HIGH_COURT",
    "LOWER_COURT",
    "ADMINISTRATIVE_GUIDANCE",
    "INSTITUTIONAL_GUIDANCE",
    "DOCTRINE",
    "AGGREGATOR",
    "OTHER",
  ]),
  official_status: z.enum(["OFFICIAL", "UNOFFICIAL", "AGGREGATOR", "UNKNOWN"]),
  binding_effect_if_known: z.enum(["BINDING", "PERSUASIVE", "NON_BINDING", "UNKNOWN"]),
  persuasive_weight: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  jurisdiction_scope: z.string().min(1),
  temporal_scope: z.string().min(1),
});
export type SourceHierarchy = z.infer<typeof sourceHierarchySchema>;

export const temporalApplicabilitySchema = z.object({
  status: z.enum([
    "CURRENTLY_VALID",
    "VALID_AT_RELEVANT_DATE",
    "NOT_VALID_AT_RELEVANT_DATE",
    "VERSION_UNCERTAIN",
    "TRANSITIONAL_ISSUE",
    "REQUIRES_HISTORICAL_VERIFICATION",
  ]),
  relevant_date: z.iso.date().optional(),
  version_date: z.iso.date().optional(),
  explanation: z.string().min(1),
});
export type TemporalApplicability = z.infer<typeof temporalApplicabilitySchema>;

export const enhancedLegalPropositionSchema = z.object({
  id: idSchema,
  authority_id: idSchema,
  locator: z
    .object({
      article: z.string().min(1).optional(),
      considerandum: z.string().min(1).optional(),
      paragraph: z.string().min(1).optional(),
      page: z.string().min(1).optional(),
      note: z.string().min(1).optional(),
    })
    .optional(),
  original_text: z.string().min(1),
  normalized_proposition: z.string().min(1),
  proposition_type: z.enum([
    "HOLDING",
    "GENERAL_LEGAL_PRINCIPLE",
    "CASE_SPECIFIC_APPLICATION",
    "DICTUM_POSSIBLE",
    "STATUTORY_RULE",
    "UNKNOWN",
  ]),
  verification_status: legalPropositionVerificationLevelSchema,
  temporal_applicability: temporalApplicabilitySchema,
  jurisdiction: z.string().min(1),
  hierarchy: sourceHierarchySchema,
  scope: z.string().min(1),
  limitations: z.array(z.string().min(1)).default([]),
  favorable_aspects: z.array(z.string().min(1)).default([]),
  adverse_aspects: z.array(z.string().min(1)).default([]),
  provenance: provenanceSchema,
});
export type EnhancedLegalProposition = z.infer<typeof enhancedLegalPropositionSchema>;

export const precedentIntelligenceSchema = z.object({
  authority_id: idSchema,
  identity: z.string().min(1),
  court: z.string().min(1),
  date: z.iso.date().optional(),
  procedural_posture: z.string().min(1),
  facts: z.array(z.string().min(1)).default([]),
  issue: z.string().min(1),
  holding: z.string().min(1).optional(),
  ratio: z.string().min(1).optional(),
  result: z.enum(["ALLOW", "DISMISS", "PARTIAL", "REMAND", "INADMISSIBLE", "MOOT", "OTHER"]),
  relevant_consideranda: z.array(z.string().min(1)).default([]),
  favorable_aspects: z.array(z.string().min(1)).default([]),
  adverse_aspects: z.array(z.string().min(1)).default([]),
  distinguishing_factors: z.array(z.string().min(1)).default([]),
  later_treatment: z.enum(["POSITIVE", "NEGATIVE", "MIXED", "UNKNOWN"]).default("UNKNOWN"),
  source_quality: z.enum([
    "FULL_TEXT_VERIFIED_OFFICIAL",
    "OFFICIAL_EXTRACT",
    "METADATA_ONLY",
    "SECONDARY_SOURCE",
  ]),
  material_verification: legalPropositionVerificationLevelSchema,
  temporal_relevance: temporalApplicabilitySchema,
  recommended_use: z.enum([
    "PRIMARY",
    "SECONDARY",
    "DISTINGUISH",
    "DISCLOSE_LIMITATION",
    "DISCOVERY_ONLY",
    "DO_NOT_USE",
  ]),
  provenance: provenanceSchema,
});
export type PrecedentIntelligence = z.infer<typeof precedentIntelligenceSchema>;

export const factualSimilaritySchema = z.object({
  similarity: z.enum([
    "HIGH_SIMILARITY",
    "MODERATE_SIMILARITY",
    "LOW_SIMILARITY",
    "SUPERFICIAL_SIMILARITY",
    "UNKNOWN",
  ]),
  matched_dimensions: z.array(z.string().min(1)),
  different_dimensions: z.array(z.string().min(1)),
  explanation: z.string().min(1),
});
export type FactualSimilarity = z.infer<typeof factualSimilaritySchema>;

export const proceduralSimilaritySchema = z.object({
  similarity: z.enum(["HIGH", "MODERATE", "LOW", "DISTINCT", "UNKNOWN"]),
  matched_dimensions: z.array(z.string().min(1)),
  different_dimensions: z.array(z.string().min(1)),
  explanation: z.string().min(1),
});
export type ProceduralSimilarity = z.infer<typeof proceduralSimilaritySchema>;

export const distinguishingFactorSchema = z.object({
  factor_type: z.enum(["FAVORABLE_SIMILARITY", "ADVERSE_SIMILARITY", "DISTINGUISHING_FACTOR"]),
  difference: z.string().min(1),
  why_it_matters: z.string().min(1),
  party_benefits: z.enum(["CLIENT", "OPPONENT", "NEUTRAL", "UNKNOWN"]),
  confidence: confidenceSchema,
});
export type DistinguishingFactor = z.infer<typeof distinguishingFactorSchema>;

export const precedentApplicationAnalysisSchema = z.object({
  precedent_authority_id: idSchema,
  issue_id: idSchema,
  application: z.enum([
    "STRONGLY_SUPPORTIVE",
    "SUPPORTIVE",
    "MIXED",
    "DISTINGUISHABLE",
    "ADVERSE",
    "STRONGLY_ADVERSE",
    "INSUFFICIENTLY_VERIFIED",
  ]),
  why: z.string().min(1),
  case_result: precedentIntelligenceSchema.shape.result,
  factual_similarity: factualSimilaritySchema,
  procedural_similarity: proceduralSimilaritySchema,
  distinguishing_factors: z.array(distinguishingFactorSchema),
  cherry_picking_risk: z.enum([
    "NONE",
    "LOW",
    "CHERRY_PICKING_RISK",
    "MIXED_APPLICATION",
    "ADVERSE_CONTEXT_REQUIRED",
  ]),
  confidence: confidenceSchema,
  provenance: provenanceSchema,
});
export type PrecedentApplicationAnalysis = z.infer<typeof precedentApplicationAnalysisSchema>;

export const adversePrecedentMapSchema = z.object({
  view_type: z.literal("ADVERSE_PRECEDENT_MAP"),
  source_of_truth: z.literal(false),
  issue_id: idSchema,
  adverse_precedent_ids: z.array(idSchema),
  none_located: z.boolean(),
  none_exists_asserted: z.literal(false),
  search_scope: z.string().min(1),
  limitations: z.array(z.string().min(1)),
  provenance: provenanceSchema,
});
export type AdversePrecedentMap = z.infer<typeof adversePrecedentMapSchema>;

export const favorablePrecedentMapSchema = z.object({
  view_type: z.literal("FAVORABLE_PRECEDENT_MAP"),
  source_of_truth: z.literal(false),
  issue_id: idSchema,
  favorable_precedent_ids: z.array(idSchema),
  quality_assessment: z.enum(["STRONG", "ADEQUATE", "WEAK", "DISCOVERY_ONLY", "UNKNOWN"]),
  limitations: z.array(z.string().min(1)),
  provenance: provenanceSchema,
});
export type FavorablePrecedentMap = z.infer<typeof favorablePrecedentMapSchema>;

export const cherryPickingRiskSchema = z.object({
  risk: precedentApplicationAnalysisSchema.shape.cherry_picking_risk,
  reasons: z.array(z.string().min(1)),
  required_disclosures: z.array(z.string().min(1)),
  recommended_use: precedentIntelligenceSchema.shape.recommended_use,
});
export type CherryPickingRisk = z.infer<typeof cherryPickingRiskSchema>;

export const authoritySemanticVerificationSchema = z.object({
  classification: z.enum([
    "SUPPORTED",
    "PARTIALLY_SUPPORTED",
    "OVERSTATED",
    "MISATTRIBUTED",
    "CONTEXT_LIMITED",
    "ADVERSE_CONTEXT_OMITTED",
    "NOT_SUPPORTED",
    "REQUIRES_HUMAN_REVIEW",
  ]),
  verification_level: legalPropositionVerificationLevelSchema,
  mapped_legacy_support: z.custom<LegalAuthoritySupport>().optional(),
  locator_checked: z.boolean(),
  surrounding_context_checked: z.boolean(),
  holding_checked: z.boolean(),
  result_checked: z.boolean(),
  scope_checked: z.boolean(),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type AuthoritySemanticVerification = z.infer<typeof authoritySemanticVerificationSchema>;

export const statutoryInterpretationContextSchema = z.object({
  authority_id: idSchema,
  text: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  systematic_context: z.array(z.string().min(1)).default([]),
  related_provisions: z.array(z.string().min(1)).default([]),
  entry_into_force: z.iso.date().optional(),
  repeal_or_amendment: z.string().min(1).optional(),
  transitional_provisions_known: z.boolean(),
  external_history_not_inferred: z.literal(true),
  provenance: provenanceSchema,
});
export type StatutoryInterpretationContext = z.infer<typeof statutoryInterpretationContextSchema>;

export const legalCategoryMismatchSchema = z.object({
  status: z.enum([
    "POSSIBLE_LEGAL_CATEGORY_MISMATCH",
    "ALTERNATIVE_CHARACTERIZATION",
    "REQUIRES_LEGAL_ANALYSIS",
    "NO_MISMATCH_DETECTED",
  ]),
  factual_event_id: idSchema,
  current_category: z.string().min(1),
  alternative_categories: z.array(z.string().min(1)),
  no_automatic_switch: z.literal(true),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type LegalCategoryMismatch = z.infer<typeof legalCategoryMismatchSchema>;

export const issueLawMapSchema = z.object({
  view_type: z.literal("ISSUE_LAW_MAP"),
  source_of_truth: z.literal(false),
  issue_id: idSchema,
  governing_provision_ids: z.array(idSchema),
  legal_proposition_ids: z.array(idSchema),
  favorable_precedent_ids: z.array(idSchema),
  adverse_precedent_ids: z.array(idSchema),
  temporal_applicability: z.array(temporalApplicabilitySchema),
  unresolved_legal_questions: z.array(z.string().min(1)),
  evidentiary_dependencies: z.array(idSchema),
  materiality: z.enum(["DISPOSITIVE", "HIGH", "SUPPORTING", "LOW", "UNKNOWN"]),
  provenance: provenanceSchema,
});
export type IssueLawMap = z.infer<typeof issueLawMapSchema>;

export const claimSupportMapSchema = z.object({
  view_type: z.literal("CLAIM_SUPPORT_MAP"),
  source_of_truth: z.literal(false),
  claim_id: idSchema,
  claim_element_ids: z.array(idSchema),
  proposition_ids: z.array(idSchema),
  finding_ids: z.array(idSchema),
  evidence_ids: z.array(idSchema),
  legal_proposition_ids: z.array(idSchema),
  legal_authority_ids: z.array(idSchema),
  precedent_application_ids: z.array(idSchema),
  remedy_indexes: z.array(z.number().int().nonnegative()),
  gaps: z.array(enhancedClaimElementSchema),
  provenance: provenanceSchema,
});
export type ClaimSupportMap = z.infer<typeof claimSupportMapSchema>;

export const issuePrioritySchema = z.object({
  issue_id: idSchema,
  priority: z.enum(["DISPOSITIVE", "HIGH", "SUPPORTING", "LOW", "IRRELEVANT", "UNKNOWN"]),
  legal_complexity: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  evidentiary_dependence: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  procedural_dependence: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  rationale: z.string().min(1),
});
export type IssuePriority = z.infer<typeof issuePrioritySchema>;

export const issueDependencySchema = z.object({
  from_issue_id: idSchema,
  to_issue_id: idSchema,
  dependency_type: z.enum([
    "PREREQUISITE",
    "ALTERNATIVE",
    "SUBSIDIARY",
    "INDEPENDENT",
    "MOOTS_IF_RESOLVED",
    "UNKNOWN",
  ]),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type IssueDependency = z.infer<typeof issueDependencySchema>;

export const narrowIssuePathSchema = z.object({
  view_type: z.literal("NARROW_ISSUE_PATH"),
  source_of_truth: z.literal(false),
  primary_issue_ids: z.array(idSchema),
  subsidiary_issue_ids: z.array(idSchema),
  potentially_mooted_issue_ids: z.array(idSchema),
  rationale: z.string().min(1),
  provenance: provenanceSchema,
});
export type NarrowIssuePath = z.infer<typeof narrowIssuePathSchema>;

export const researchSufficiencySchema = z.object({
  issue_id: idSchema,
  status: z.enum([
    "RESEARCH_COMPLETE",
    "RESEARCH_ADEQUATE",
    "RESEARCH_PARTIAL",
    "RESEARCH_WEAK",
    "RESEARCH_NOT_STARTED",
  ]),
  governing_law_found: z.boolean(),
  applicable_version_checked: z.boolean(),
  favorable_case_checked: z.boolean(),
  adverse_case_checked: z.boolean(),
  citation_materially_verified: z.boolean(),
  official_source_present: z.boolean(),
  explanation: z.string().min(1),
});
export type ResearchSufficiency = z.infer<typeof researchSufficiencySchema>;

export const humanReviewFlagSchema = z.object({
  issue_id: idSchema.optional(),
  authority_id: idSchema.optional(),
  reason: z.enum([
    "AUTHORITY_CONTEXT_AMBIGUOUS",
    "PRECEDENT_USE_MIXED_HIGH_RISK",
    "STATUTE_VERSION_UNCERTAIN",
    "ADVERSE_PRECEDENT_MATERIAL_CONFLICT",
    "BINDING_EFFECT_UNCERTAIN",
    "LEGAL_CATEGORY_UNRESOLVED",
  ]),
  explanation: z.string().min(1),
  severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
  provenance: provenanceSchema,
});

export const legalLanguageCalibrationSchema = z.object({
  strength: z.enum(["STRONG", "MODERATE", "MIXED", "ADVERSE", "ABSTAIN"]),
  formulation: z.string().min(1),
  avoid_phrases: z.array(z.string().min(1)),
});
export type LegalLanguageCalibration = z.infer<typeof legalLanguageCalibrationSchema>;

export const opportunityCandidateSchema = z.object({
  opportunity_type: z.enum([
    "NEW_LEGAL_ISSUE",
    "ALTERNATIVE_LEGAL_CHARACTERIZATION",
    "UNUSED_PRECEDENT",
    "UNUSED_STATUTORY_BASIS",
    "PROCEDURAL_OPPORTUNITY_CANDIDATE",
  ]),
  object_id: idSchema,
  explanation: z.string().min(1),
  confidence: confidenceSchema,
  provenance: provenanceSchema,
});
export type OpportunityCandidate = z.infer<typeof opportunityCandidateSchema>;

export const legalResearchAdapterSchema = z.custom<LegalResearchAdapter>();
export interface LegalResearchAdapter {
  searchFavorablePrecedents: (issue: {
    issue_id: string;
    text: string;
  }) => Promise<PrecedentIntelligence[]>;
  searchAdversePrecedents: (issue: {
    issue_id: string;
    text: string;
  }) => Promise<PrecedentIntelligence[]>;
  verifyLegalCitation: (citation: string) => Promise<{
    authority?: LegalAuthority;
    verification_level: LegalPropositionVerificationLevel;
  }>;
  searchLegislation: (query: string, relevantDate?: string) => Promise<LegalAuthority[]>;
}

interface IssueSpottingInput {
  matter: MatterModel;
  requestDecisionMismatches?: RequestedButNotDecidedAnalysis[];
  contradictions?: ContradictionAssessmentResult[];
  missingEvidence?: { id: string; description: string; provenance: ProvenanceRef[] }[];
  burdenAssessments?: BurdenAssessment[];
  legalCharacterizations?: LegalCharacterization[];
  chronologySignals?: {
    id: string;
    category: IssueCategory;
    reason: string;
    provenance: ProvenanceRef[];
  }[];
  precedentSignals?: {
    id: string;
    category: IssueCategory;
    adverse: boolean;
    reason: string;
    provenance: ProvenanceRef[];
  }[];
}

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const containsAny = (value: string, terms: string[]): boolean => {
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
};

const overlapCount = (a: string, b: string): number => {
  const wordsA = new Set(a.toLowerCase().match(/[a-zäöüéèà0-9]{4,}/gi) ?? []);
  const wordsB = new Set(b.toLowerCase().match(/[a-zäöüéèà0-9]{4,}/gi) ?? []);
  return [...wordsA].filter((word) => wordsB.has(word)).length;
};

export function spotLegalIssues(input: IssueSpottingInput) {
  const triggers: IssueTrigger[] = [];
  const issues = new Map<string, z.infer<typeof detectedIssueSchema>>();
  const addIssue = (category: IssueCategory, trigger: IssueTrigger, text: string): void => {
    triggers.push(trigger);
    const existing = issues.get(category);
    const triggerIds = existing
      ? unique([...existing.trigger_ids, trigger.trigger_id])
      : [trigger.trigger_id];
    const materialTrigger = trigger.materiality === "DISPOSITIVE" || trigger.materiality === "HIGH";
    const claimSupported = trigger.source_type === "CLAIM" || input.matter.claims.length > 0;
    const status: IssueStatus =
      materialTrigger && claimSupported
        ? "ISSUE_MATERIAL"
        : trigger.source_type === "ADVERSE_PRECEDENT"
          ? "ISSUE_REQUIRES_LEGAL_RESEARCH"
          : "ISSUE_CANDIDATE";
    issues.set(category, {
      issue_id: `issue-${category.toLowerCase()}`,
      category,
      status,
      text,
      trigger_ids: triggerIds,
      reason: existing ? `${existing.reason}; ${trigger.reason}` : trigger.reason,
      confidence: Math.max(existing?.confidence ?? 0, trigger.confidence),
      materiality:
        existing?.materiality === "DISPOSITIVE" || trigger.materiality === "DISPOSITIVE"
          ? "DISPOSITIVE"
          : existing?.materiality === "HIGH" || trigger.materiality === "HIGH"
            ? "HIGH"
            : trigger.materiality,
      provenance: unique([...(existing?.provenance ?? []), ...trigger.provenance]),
    });
  };

  for (const claim of input.matter.claims) {
    const missingLegalElement = claim.elements.some((element) => element.status === "UNKNOWN");
    if (missingLegalElement) {
      addIssue(
        "APPLICABLE_LAW",
        {
          trigger_id: `trigger-claim-${claim.id}`,
          source_type: "CLAIM",
          reason: "Claim contains unresolved elements that require governing law.",
          provenance: claim.provenance,
          confidence: 0.72,
          materiality: "HIGH",
        },
        "Governing legal elements for the claim require verification.",
      );
    }
  }

  for (const mismatch of input.requestDecisionMismatches ?? []) {
    addIssue(
      "DENIAL_OF_JUSTICE",
      {
        trigger_id: `trigger-request-mismatch-${mismatch.request_id}`,
        source_type: "REQUEST_DECISION_MISMATCH",
        reason: mismatch.explanation,
        provenance: mismatch.provenance,
        confidence: mismatch.status === "REQUESTED_BUT_NOT_DECIDED" ? 0.8 : 0.58,
        materiality: mismatch.status === "REQUESTED_BUT_NOT_DECIDED" ? "HIGH" : "SUPPORTING",
      },
      "A requested object may not have been decided by the operative part.",
    );
  }

  for (const contradiction of input.contradictions ?? []) {
    if (contradiction.materiality === "LOW" || contradiction.materiality === "UNKNOWN") continue;
    addIssue(
      contradiction.legal_significance === "EVIDENTIARY" ? "EVIDENCE" : "PROCEDURAL_RIGHTS",
      {
        trigger_id: `trigger-contradiction-${contradiction.compared_entity_ids.join("-")}`,
        source_type: "CONTRADICTION",
        reason: contradiction.drafting_formulation,
        provenance: contradiction.provenance,
        confidence: 0.68,
        materiality: contradiction.materiality === "DISPOSITIVE" ? "DISPOSITIVE" : "HIGH",
      },
      "A material contradiction may create a legal issue.",
    );
  }

  for (const item of input.missingEvidence ?? []) {
    addIssue(
      "EVIDENCE",
      {
        trigger_id: `trigger-missing-evidence-${item.id}`,
        source_type: "MISSING_EVIDENCE",
        reason: item.description,
        provenance: item.provenance,
        confidence: 0.64,
        materiality: "SUPPORTING",
      },
      "Potentially material evidence is missing or controlled by another actor.",
    );
  }

  for (const assessment of input.burdenAssessments ?? []) {
    addIssue(
      "BURDEN",
      {
        trigger_id: `trigger-burden-${assessment.id}`,
        source_type: "BURDEN_ASSESSMENT",
        reason: assessment.standard ?? assessment.burden_type,
        provenance: assessment.provenance,
        confidence: assessment.confidence ?? 0.65,
        materiality: "HIGH",
      },
      "Burden allocation may control how unresolved facts are assessed.",
    );
  }

  for (const characterization of input.legalCharacterizations ?? []) {
    addIssue(
      "MATERIAL_RIGHT",
      {
        trigger_id: `trigger-characterization-${characterization.id}`,
        source_type: "LEGAL_CHARACTERIZATION",
        reason: characterization.conclusion,
        provenance: characterization.provenance,
        confidence: characterization.confidence ?? 0.62,
        materiality: characterization.status === "DISPUTED" ? "HIGH" : "SUPPORTING",
      },
      "A legal characterization requires validation against the controlling category.",
    );
  }

  for (const signal of input.chronologySignals ?? []) {
    addIssue(
      signal.category,
      {
        trigger_id: `trigger-chronology-${signal.id}`,
        source_type: "CHRONOLOGY_SIGNAL",
        reason: signal.reason,
        provenance: signal.provenance,
        confidence: 0.7,
        materiality: "HIGH",
      },
      signal.reason,
    );
  }

  for (const signal of input.precedentSignals ?? []) {
    addIssue(
      signal.category,
      {
        trigger_id: `trigger-precedent-${signal.id}`,
        source_type: signal.adverse ? "ADVERSE_PRECEDENT" : "DECISION_REASONING",
        reason: signal.reason,
        provenance: signal.provenance,
        confidence: 0.62,
        materiality: signal.adverse ? "HIGH" : "SUPPORTING",
      },
      signal.reason,
    );
  }

  return {
    view_type: "ISSUE_SPOTTING_RESULT" as const,
    source_of_truth: false as const,
    triggers,
    issues: [...issues.values()],
  };
}

export function verifyLegalPropositionAuthority(input: {
  authority: LegalAuthority;
  propositionText: string;
  sourceText?: string;
  surroundingText?: string;
  holding?: string;
  result?: PrecedentIntelligence["result"];
  locatorMatched?: boolean;
  scope?: string;
  provenance: ProvenanceRef[];
}): AuthoritySemanticVerification {
  if (input.authority.source_status === "METADATA_ONLY" || !input.sourceText) {
    return authoritySemanticVerificationSchema.parse({
      classification: "REQUIRES_HUMAN_REVIEW",
      verification_level: "IDENTITY_ONLY",
      locator_checked: Boolean(input.locatorMatched),
      surrounding_context_checked: Boolean(input.surroundingText),
      holding_checked: Boolean(input.holding),
      result_checked: Boolean(input.result),
      scope_checked: Boolean(input.scope),
      explanation:
        "Authority identity exists, but source text is not sufficient to verify the material proposition.",
      provenance: input.provenance,
    });
  }

  const fullContext = [input.sourceText, input.surroundingText, input.holding]
    .filter(Boolean)
    .join("\n");
  const exact = fullContext.toLowerCase().includes(input.propositionText.toLowerCase());
  const overlap = overlapCount(fullContext, input.propositionText);
  const broadLanguage = containsAny(input.propositionText, [
    "always",
    "automatically",
    "without exception",
    "in jedem fall",
    "stets",
    "immer",
  ]);
  const adverseContext = input.result && ["DISMISS", "INADMISSIBLE"].includes(input.result);

  if (exact && adverseContext) {
    return authoritySemanticVerificationSchema.parse({
      classification: "ADVERSE_CONTEXT_OMITTED",
      verification_level: "ADVERSE_CONTEXT_PRESENT",
      locator_checked: Boolean(input.locatorMatched),
      surrounding_context_checked: Boolean(input.surroundingText),
      holding_checked: Boolean(input.holding),
      result_checked: true,
      scope_checked: Boolean(input.scope),
      explanation:
        "The text is located, but the case result limits favorable use and must be disclosed.",
      provenance: input.provenance,
    });
  }

  if (exact && !broadLanguage) {
    return authoritySemanticVerificationSchema.parse({
      classification: "SUPPORTED",
      verification_level: "MATERIAL_PROPOSITION_VERIFIED",
      locator_checked: Boolean(input.locatorMatched),
      surrounding_context_checked: Boolean(input.surroundingText),
      holding_checked: Boolean(input.holding),
      result_checked: Boolean(input.result),
      scope_checked: Boolean(input.scope),
      explanation: "The material proposition is supported by the located source context.",
      provenance: input.provenance,
    });
  }

  if (overlap >= 2 && broadLanguage) {
    return authoritySemanticVerificationSchema.parse({
      classification: "OVERSTATED",
      verification_level: "PROPOSITION_PARTIALLY_VERIFIED",
      locator_checked: Boolean(input.locatorMatched),
      surrounding_context_checked: Boolean(input.surroundingText),
      holding_checked: Boolean(input.holding),
      result_checked: Boolean(input.result),
      scope_checked: Boolean(input.scope),
      explanation: "The authority supports a narrower proposition than the proposed formulation.",
      provenance: input.provenance,
    });
  }

  if (overlap >= 2) {
    return authoritySemanticVerificationSchema.parse({
      classification: "PARTIALLY_SUPPORTED",
      verification_level: "PROPOSITION_PARTIALLY_VERIFIED",
      locator_checked: Boolean(input.locatorMatched),
      surrounding_context_checked: Boolean(input.surroundingText),
      holding_checked: Boolean(input.holding),
      result_checked: Boolean(input.result),
      scope_checked: Boolean(input.scope),
      explanation:
        "The source has partial semantic overlap, but does not fully verify the proposition.",
      provenance: input.provenance,
    });
  }

  return authoritySemanticVerificationSchema.parse({
    classification: "NOT_SUPPORTED",
    verification_level: "PROPOSITION_MISMATCH",
    locator_checked: Boolean(input.locatorMatched),
    surrounding_context_checked: Boolean(input.surroundingText),
    holding_checked: Boolean(input.holding),
    result_checked: Boolean(input.result),
    scope_checked: Boolean(input.scope),
    explanation: "The source context does not support the proposed legal proposition.",
    provenance: input.provenance,
  });
}

export function compareFactualSimilarity(input: {
  precedent: {
    actor_type?: string;
    legal_regime?: string;
    requested_remedy?: string;
    factual_trigger?: string;
    chronology?: string;
    evidence_posture?: string;
    jurisdiction?: string;
    temporal_law?: string;
  };
  matter: {
    actor_type?: string;
    legal_regime?: string;
    requested_remedy?: string;
    factual_trigger?: string;
    chronology?: string;
    evidence_posture?: string;
    jurisdiction?: string;
    temporal_law?: string;
  };
}): FactualSimilarity {
  const keys = [
    "actor_type",
    "legal_regime",
    "requested_remedy",
    "factual_trigger",
    "chronology",
    "evidence_posture",
    "jurisdiction",
    "temporal_law",
  ] as const;
  const matched = keys.filter(
    (key) => input.precedent[key] && input.precedent[key] === input.matter[key],
  );
  const different = keys.filter(
    (key) =>
      input.precedent[key] && input.matter[key] && input.precedent[key] !== input.matter[key],
  );
  const similarity =
    matched.length >= 6
      ? "HIGH_SIMILARITY"
      : matched.length >= 4
        ? "MODERATE_SIMILARITY"
        : matched.length >= 2 && different.length <= 2
          ? "LOW_SIMILARITY"
          : matched.length > 0
            ? "SUPERFICIAL_SIMILARITY"
            : "UNKNOWN";
  return factualSimilaritySchema.parse({
    similarity,
    matched_dimensions: matched,
    different_dimensions: different,
    explanation: `${matched.length} factual dimensions match and ${different.length} differ.`,
  });
}

export function compareProceduralSimilarity(input: {
  precedent: { procedural_posture?: string; requested_remedy?: string; stage?: string };
  matter: { procedural_posture?: string; requested_remedy?: string; stage?: string };
}): ProceduralSimilarity {
  const keys = ["procedural_posture", "requested_remedy", "stage"] as const;
  const matched = keys.filter(
    (key) => input.precedent[key] && input.precedent[key] === input.matter[key],
  );
  const different = keys.filter(
    (key) =>
      input.precedent[key] && input.matter[key] && input.precedent[key] !== input.matter[key],
  );
  const similarity =
    matched.length === 3
      ? "HIGH"
      : matched.length === 2
        ? "MODERATE"
        : matched.length === 1 && different.length <= 1
          ? "LOW"
          : different.length > 0
            ? "DISTINCT"
            : "UNKNOWN";
  return proceduralSimilaritySchema.parse({
    similarity,
    matched_dimensions: matched,
    different_dimensions: different,
    explanation: `${matched.length} procedural dimensions match and ${different.length} differ.`,
  });
}

export function analyzePrecedentApplication(input: {
  precedent: PrecedentIntelligence;
  issueId: string;
  factualSimilarity: FactualSimilarity;
  proceduralSimilarity: ProceduralSimilarity;
  provenance: ProvenanceRef[];
}): PrecedentApplicationAnalysis {
  const unverified =
    input.precedent.source_quality === "METADATA_ONLY" ||
    input.precedent.material_verification === "IDENTITY_ONLY" ||
    input.precedent.material_verification === "UNVERIFIED";
  const favorable = input.precedent.favorable_aspects.length > 0;
  const adverse = input.precedent.adverse_aspects.length > 0;
  const adverseResult = ["DISMISS", "INADMISSIBLE"].includes(input.precedent.result);
  const lowSimilarity =
    input.factualSimilarity.similarity === "LOW_SIMILARITY" ||
    input.factualSimilarity.similarity === "SUPERFICIAL_SIMILARITY" ||
    input.proceduralSimilarity.similarity === "DISTINCT";
  const application = unverified
    ? "INSUFFICIENTLY_VERIFIED"
    : adverse && !favorable
      ? adverseResult
        ? "STRONGLY_ADVERSE"
        : "ADVERSE"
      : favorable && (adverse || adverseResult)
        ? "MIXED"
        : favorable && lowSimilarity
          ? "DISTINGUISHABLE"
          : favorable
            ? "SUPPORTIVE"
            : "DISTINGUISHABLE";
  const cherryPickingRisk =
    application === "MIXED"
      ? "MIXED_APPLICATION"
      : favorable && adverseResult
        ? "ADVERSE_CONTEXT_REQUIRED"
        : favorable && lowSimilarity
          ? "CHERRY_PICKING_RISK"
          : "NONE";
  const distinguishing_factors = [
    ...input.factualSimilarity.matched_dimensions.map((dimension) => ({
      factor_type: "FAVORABLE_SIMILARITY" as const,
      difference: dimension,
      why_it_matters: "This factual dimension aligns with the precedent.",
      party_benefits: "CLIENT" as const,
      confidence: 0.7,
    })),
    ...input.factualSimilarity.different_dimensions.map((dimension) => ({
      factor_type: "DISTINGUISHING_FACTOR" as const,
      difference: dimension,
      why_it_matters: "This factual difference may limit transferability.",
      party_benefits: "UNKNOWN" as const,
      confidence: 0.68,
    })),
  ];
  return precedentApplicationAnalysisSchema.parse({
    precedent_authority_id: input.precedent.authority_id,
    issue_id: input.issueId,
    application,
    why:
      application === "INSUFFICIENTLY_VERIFIED"
        ? "The precedent cannot be materially applied because official/full context is insufficient."
        : application === "MIXED"
          ? "The precedent contains favorable material but its result or adverse aspects limit use."
          : application === "DISTINGUISHABLE"
            ? "The principle may be relevant, but facts or procedural posture materially differ."
            : "The precedent application follows from verified source quality, result, and similarity.",
    case_result: input.precedent.result,
    factual_similarity: input.factualSimilarity,
    procedural_similarity: input.proceduralSimilarity,
    distinguishing_factors,
    cherry_picking_risk: cherryPickingRisk,
    confidence: unverified ? 0.35 : application === "MIXED" ? 0.62 : 0.74,
    provenance: input.provenance,
  });
}

export function analyzeCherryPickingRisk(precedent: PrecedentIntelligence): CherryPickingRisk {
  const reasons: string[] = [];
  const required_disclosures: string[] = [];
  if (["DISMISS", "INADMISSIBLE"].includes(precedent.result)) {
    reasons.push("The case result is adverse to the party invoking the favorable passage.");
    required_disclosures.push(
      "Disclose the result and explain the limited proposition being used.",
    );
  }
  if (precedent.adverse_aspects.length > 0) {
    reasons.push("The precedent contains adverse aspects.");
    required_disclosures.push(
      "Address adverse aspects instead of quoting only favorable language.",
    );
  }
  if (precedent.distinguishing_factors.length > 0) {
    reasons.push("Material distinguishing factors are present.");
    required_disclosures.push("Explain why each difference does or does not matter.");
  }
  const risk =
    reasons.length === 0
      ? "NONE"
      : precedent.favorable_aspects.length > 0 && precedent.adverse_aspects.length > 0
        ? "MIXED_APPLICATION"
        : "ADVERSE_CONTEXT_REQUIRED";
  return cherryPickingRiskSchema.parse({
    risk,
    reasons,
    required_disclosures,
    recommended_use: risk === "NONE" ? precedent.recommended_use : "DISCLOSE_LIMITATION",
  });
}

export function buildIssueLawMap(input: {
  issueId: string;
  authorities: LegalAuthority[];
  legalPropositions: LegalProposition[];
  favorablePrecedents: PrecedentIntelligence[];
  adversePrecedents: PrecedentIntelligence[];
  temporalApplicability: TemporalApplicability[];
  evidentiaryDependencies?: string[];
  materiality: IssueLawMap["materiality"];
  provenance: ProvenanceRef[];
}): IssueLawMap {
  const officialAuthorities = input.authorities.filter(
    (authority) => authority.source_status !== "UNVERIFIED",
  );
  return issueLawMapSchema.parse({
    view_type: "ISSUE_LAW_MAP",
    source_of_truth: false,
    issue_id: input.issueId,
    governing_provision_ids: officialAuthorities.map((authority) => authority.id),
    legal_proposition_ids: input.legalPropositions.map((proposition) => proposition.id),
    favorable_precedent_ids: input.favorablePrecedents.map((precedent) => precedent.authority_id),
    adverse_precedent_ids: input.adversePrecedents.map((precedent) => precedent.authority_id),
    temporal_applicability: input.temporalApplicability,
    unresolved_legal_questions: input.temporalApplicability
      .filter(
        (item) =>
          item.status === "VERSION_UNCERTAIN" || item.status === "REQUIRES_HISTORICAL_VERIFICATION",
      )
      .map((item) => item.explanation),
    evidentiary_dependencies: input.evidentiaryDependencies ?? [],
    materiality: input.materiality,
    provenance: input.provenance,
  });
}

export function buildClaimSupportMap(input: {
  claim: Claim;
  propositions: Proposition[];
  evidence: Evidence[];
  legalPropositions: LegalProposition[];
  legalAuthorities: LegalAuthority[];
  precedentApplications: PrecedentApplication[];
  enhancedElements?: EnhancedClaimElement[];
  provenance: ProvenanceRef[];
}): ClaimSupportMap {
  const propositionIds = input.claim.elements.map((element) => element.proposition_id);
  const evidence = input.evidence.filter((item) =>
    item.supported_proposition_ids.some((propositionId) => propositionIds.includes(propositionId)),
  );
  const legalPropositionIds = input.legalPropositions.map((item) => item.id);
  return claimSupportMapSchema.parse({
    view_type: "CLAIM_SUPPORT_MAP",
    source_of_truth: false,
    claim_id: input.claim.id,
    claim_element_ids: input.claim.elements.map((element) => element.id),
    proposition_ids: unique([...propositionIds, ...input.propositions.map((item) => item.id)]),
    finding_ids: [],
    evidence_ids: evidence.map((item) => item.id),
    legal_proposition_ids: legalPropositionIds,
    legal_authority_ids: input.legalAuthorities.map((item) => item.id),
    precedent_application_ids: input.precedentApplications.map((item) => item.id),
    remedy_indexes: input.claim.remedies.map((_, index) => index),
    gaps:
      input.enhancedElements?.filter((element) =>
        ["FACTUAL_GAP", "EVIDENTIARY_GAP", "LEGAL_GAP", "PROCEDURAL_GAP", "UNKNOWN"].includes(
          element.status,
        ),
      ) ?? [],
    provenance: input.provenance,
  });
}

export function rankIssuePriority(input: {
  issueId: string;
  materiality: IssueLawMap["materiality"];
  governingLawFound: boolean;
  unresolvedEvidence: boolean;
  prerequisiteToOtherIssue: boolean;
  jurisprudenceCount: number;
}): IssuePriority {
  const priority =
    input.materiality === "DISPOSITIVE"
      ? "DISPOSITIVE"
      : input.materiality === "HIGH" && input.governingLawFound
        ? "HIGH"
        : input.materiality === "LOW"
          ? "LOW"
          : input.jurisprudenceCount > 0
            ? "SUPPORTING"
            : "UNKNOWN";
  return issuePrioritySchema.parse({
    issue_id: input.issueId,
    priority,
    legal_complexity: input.governingLawFound
      ? input.jurisprudenceCount > 3
        ? "HIGH"
        : "MEDIUM"
      : "UNKNOWN",
    evidentiary_dependence: input.unresolvedEvidence ? "HIGH" : "LOW",
    procedural_dependence: input.prerequisiteToOtherIssue ? "HIGH" : "LOW",
    rationale:
      "Priority is based on materiality, dependencies, and evidentiary/legal gaps, not citation volume alone.",
  });
}

export function identifyIssueDependencies(input: {
  issues: { issue_id: string; category: IssueCategory }[];
  provenance: ProvenanceRef[];
}): IssueDependency[] {
  const dependencies: IssueDependency[] = [];
  const byCategory = new Map(input.issues.map((issue) => [issue.category, issue]));
  const admissibility = byCategory.get("ADMISSIBILITY");
  const remedy = byCategory.get("REMEDY");
  if (admissibility && remedy) {
    dependencies.push(
      issueDependencySchema.parse({
        from_issue_id: admissibility.issue_id,
        to_issue_id: remedy.issue_id,
        dependency_type: "PREREQUISITE",
        explanation: "Admissibility normally must be addressed before the requested remedy.",
        provenance: input.provenance,
      }),
    );
  }
  const temporal = byCategory.get("TEMPORAL_LAW");
  const material = byCategory.get("MATERIAL_RIGHT");
  if (temporal && material) {
    dependencies.push(
      issueDependencySchema.parse({
        from_issue_id: temporal.issue_id,
        to_issue_id: material.issue_id,
        dependency_type: "PREREQUISITE",
        explanation: "The applicable temporal version of law controls material-right analysis.",
        provenance: input.provenance,
      }),
    );
  }
  return dependencies;
}

export function deriveNarrowIssuePath(input: {
  priorities: IssuePriority[];
  dependencies: IssueDependency[];
  provenance: ProvenanceRef[];
}): NarrowIssuePath {
  const primary = input.priorities
    .filter((item) => item.priority === "DISPOSITIVE" || item.priority === "HIGH")
    .map((item) => item.issue_id);
  const mooted = input.dependencies
    .filter((item) => item.dependency_type === "MOOTS_IF_RESOLVED")
    .map((item) => item.to_issue_id);
  return narrowIssuePathSchema.parse({
    view_type: "NARROW_ISSUE_PATH",
    source_of_truth: false,
    primary_issue_ids: unique(primary),
    subsidiary_issue_ids: input.priorities
      .filter((item) => item.priority === "SUPPORTING" || item.priority === "LOW")
      .map((item) => item.issue_id),
    potentially_mooted_issue_ids: unique(mooted),
    rationale:
      "This is a derived issue-order view and does not simulate a judge or select final strategy.",
    provenance: input.provenance,
  });
}

export function assessResearchSufficiency(input: {
  issueId: string;
  governingLawFound: boolean;
  applicableVersionChecked: boolean;
  favorableCaseChecked: boolean;
  adverseCaseChecked: boolean;
  citationMateriallyVerified: boolean;
  officialSourcePresent: boolean;
}): ResearchSufficiency {
  const score = [
    input.governingLawFound,
    input.applicableVersionChecked,
    input.favorableCaseChecked,
    input.adverseCaseChecked,
    input.citationMateriallyVerified,
    input.officialSourcePresent,
  ].filter(Boolean).length;
  const status =
    score === 0
      ? "RESEARCH_NOT_STARTED"
      : input.favorableCaseChecked && !input.officialSourcePresent
        ? "RESEARCH_WEAK"
        : score <= 2
          ? "RESEARCH_PARTIAL"
          : score <= 5
            ? "RESEARCH_ADEQUATE"
            : "RESEARCH_COMPLETE";
  return researchSufficiencySchema.parse({
    issue_id: input.issueId,
    status,
    governing_law_found: input.governingLawFound,
    applicable_version_checked: input.applicableVersionChecked,
    favorable_case_checked: input.favorableCaseChecked,
    adverse_case_checked: input.adverseCaseChecked,
    citation_materially_verified: input.citationMateriallyVerified,
    official_source_present: input.officialSourcePresent,
    explanation:
      status === "RESEARCH_WEAK"
        ? "Only favorable or non-official material is available; official and adverse checks remain necessary."
        : "Research sufficiency reflects governing law, temporal version, favorable/adverse precedent, material verification, and official source status.",
  });
}

export function generateHumanReviewFlags(input: {
  issueId?: string;
  authorityId?: string;
  verification?: AuthoritySemanticVerification;
  temporalApplicability?: TemporalApplicability;
  precedentApplication?: PrecedentApplicationAnalysis;
  categoryMismatch?: LegalCategoryMismatch;
  bindingEffectKnown?: boolean;
  provenance: ProvenanceRef[];
}) {
  const flags: z.infer<typeof humanReviewFlagSchema>[] = [];
  if (input.verification?.classification === "REQUIRES_HUMAN_REVIEW") {
    flags.push({
      issue_id: input.issueId,
      authority_id: input.authorityId,
      reason: "AUTHORITY_CONTEXT_AMBIGUOUS",
      explanation: input.verification.explanation,
      severity: "MEDIUM",
      provenance: input.provenance,
    });
  }
  if (
    input.precedentApplication?.application === "MIXED" ||
    input.precedentApplication?.cherry_picking_risk === "CHERRY_PICKING_RISK"
  ) {
    flags.push({
      issue_id: input.issueId,
      authority_id: input.authorityId,
      reason: "PRECEDENT_USE_MIXED_HIGH_RISK",
      explanation: input.precedentApplication.why,
      severity: "HIGH",
      provenance: input.provenance,
    });
  }
  if (
    input.temporalApplicability?.status === "VERSION_UNCERTAIN" ||
    input.temporalApplicability?.status === "REQUIRES_HISTORICAL_VERIFICATION"
  ) {
    flags.push({
      issue_id: input.issueId,
      authority_id: input.authorityId,
      reason: "STATUTE_VERSION_UNCERTAIN",
      explanation: input.temporalApplicability.explanation,
      severity: "HIGH",
      provenance: input.provenance,
    });
  }
  if (input.bindingEffectKnown === false) {
    flags.push({
      issue_id: input.issueId,
      authority_id: input.authorityId,
      reason: "BINDING_EFFECT_UNCERTAIN",
      explanation:
        "Binding or persuasive effect is not established by the available source metadata.",
      severity: "MEDIUM",
      provenance: input.provenance,
    });
  }
  if (input.categoryMismatch && input.categoryMismatch.status !== "NO_MISMATCH_DETECTED") {
    flags.push({
      issue_id: input.issueId,
      authority_id: input.authorityId,
      reason: "LEGAL_CATEGORY_UNRESOLVED",
      explanation: input.categoryMismatch.explanation,
      severity: "MEDIUM",
      provenance: input.provenance,
    });
  }
  return flags.map((flag) => humanReviewFlagSchema.parse(flag));
}

export function calibrateLegalLanguage(input: {
  verification?: AuthoritySemanticVerification;
  application?: PrecedentApplicationAnalysis;
}): LegalLanguageCalibration {
  if (input.verification?.verification_level === "UNVERIFIED") {
    return legalLanguageCalibrationSchema.parse({
      strength: "ABSTAIN",
      formulation: "Die herangezogene Quelle erlaubt keine verlässliche rechtliche Aussage.",
      avoid_phrases: ["Die Rechtsprechung beweist", "zweifellos", "offensichtlich"],
    });
  }
  if (
    input.application?.application === "ADVERSE" ||
    input.application?.application === "STRONGLY_ADVERSE"
  ) {
    return legalLanguageCalibrationSchema.parse({
      strength: "ADVERSE",
      formulation: "Die Rechtsprechung zeigt, dass dieser Ansatz nicht ohne Weiteres trägt.",
      avoid_phrases: ["stützt eindeutig", "direkt anwendbar"],
    });
  }
  if (
    input.application?.application === "MIXED" ||
    input.verification?.classification === "ADVERSE_CONTEXT_OMITTED"
  ) {
    return legalLanguageCalibrationSchema.parse({
      strength: "MIXED",
      formulation:
        "Die Entscheidung enthält zwar einen relevanten Grundsatz, ihr Ergebnis und der Kontext begrenzen jedoch die Übertragbarkeit.",
      avoid_phrases: ["vollumfänglich bestätigt", "ohne Einschränkung"],
    });
  }
  if (
    input.application?.application === "SUPPORTIVE" ||
    input.verification?.classification === "SUPPORTED"
  ) {
    return legalLanguageCalibrationSchema.parse({
      strength: "STRONG",
      formulation: "Die Rechtsprechung stützt diesen Grundsatz.",
      avoid_phrases: ["beweist den Sachverhalt", "garantiert den Ausgang"],
    });
  }
  return legalLanguageCalibrationSchema.parse({
    strength: "MODERATE",
    formulation: "Die angeführte Rechtsprechung spricht für diese rechtliche Einordnung.",
    avoid_phrases: ["zwingend", "automatisch"],
  });
}

export function detectLegalCategoryMismatch(input: {
  factualEventId: string;
  currentCategory: string;
  alternativeCategories: string[];
  supportingFacts: string[];
  provenance: ProvenanceRef[];
}): LegalCategoryMismatch {
  const hasAlternatives = input.alternativeCategories.length > 0;
  return legalCategoryMismatchSchema.parse({
    status: hasAlternatives ? "ALTERNATIVE_CHARACTERIZATION" : "NO_MISMATCH_DETECTED",
    factual_event_id: input.factualEventId,
    current_category: input.currentCategory,
    alternative_categories: input.alternativeCategories,
    no_automatic_switch: true,
    explanation: hasAlternatives
      ? `The same factual event may require analysis under ${input.alternativeCategories.join(", ")}; no automatic recharacterization is made.`
      : "No alternative legal category is indicated by the supplied facts.",
    provenance: input.provenance,
  });
}

export function createEnhancedClaimElements(input: {
  claimElements: ClaimElement[];
  legalPropositionIds: string[];
  evidenceIdsByPropositionId: Map<string, string[]>;
  provenance: ProvenanceRef[];
}): EnhancedClaimElement[] {
  return [
    ...input.claimElements.map((element) =>
      enhancedClaimElementSchema.parse({
        id: `enhanced-${element.id}`,
        base_claim_element_id: element.id,
        element_type: "REQUIRED_FACTUAL_ELEMENT",
        proposition_id: element.proposition_id,
        evidence_ids: input.evidenceIdsByPropositionId.get(element.proposition_id) ?? [],
        status:
          element.status === "SATISFIED"
            ? "SATISFIED"
            : element.status === "DISPUTED"
              ? "DISPUTED"
              : element.status === "NOT_SATISFIED"
                ? "FACTUAL_GAP"
                : "UNKNOWN",
        dependencies: [],
        explanation: "Derived compatibility view for Phase 5 claim element analysis.",
        provenance: element.provenance,
      }),
    ),
    ...input.legalPropositionIds.map((legalPropositionId) =>
      enhancedClaimElementSchema.parse({
        id: `legal-element-${legalPropositionId}`,
        element_type: "REQUIRED_LEGAL_ELEMENT",
        legal_proposition_id: legalPropositionId,
        status: "LEGAL_GAP",
        dependencies: [],
        explanation:
          "Legal element requires material authority verification before final claim support.",
        provenance: input.provenance,
      }),
    ),
  ];
}
