import { z } from "zod";
import { confidenceSchema, provenanceRefSchema, type ProvenanceRef } from "@swiss-legal-mcp/core";
import type { EvidenceRequestRecommendation } from "@swiss-legal-mcp/core";
import type { IssueLawMap, IssuePriority } from "@swiss-legal-mcp/legal-intelligence";
import type {
  ConcessionAnalysis,
  JudicialDecisionPath,
  MinimumWinningCase,
  ResponseNecessity,
} from "@swiss-legal-mcp/litigation-intelligence";

const idSchema = z.string().min(1);
const provenanceSchema = z.array(provenanceRefSchema).min(1);

export const strengthSchema = z.enum([
  "VERY_STRONG",
  "STRONG",
  "MODERATE",
  "WEAK",
  "VERY_WEAK",
  "UNKNOWN",
]);
const fitDimensionSchema = strengthSchema;

export const proceduralVehicleSchema = z.enum([
  "INITIAL_APPLICATION",
  "ADMINISTRATIVE_REQUEST",
  "OBJECTION",
  "ADMINISTRATIVE_APPEAL",
  "JUDICIAL_APPEAL",
  "COMPLAINT",
  "DENIAL_OF_JUSTICE_COMPLAINT",
  "DELAY_COMPLAINT",
  "RECONSIDERATION",
  "REVISION",
  "INTERIM_RELIEF",
  "DECLARATORY_RELIEF",
  "ENFORCEMENT",
  "REMAND_REQUEST",
  "EVIDENTIARY_REQUEST",
  "FILE_ACCESS_REQUEST",
  "OTHER",
]);

export const remedyTypeSchema = z.enum([
  "ANNULMENT",
  "REVERSAL",
  "MODIFICATION",
  "REMAND",
  "DECLARATORY_RELIEF",
  "ORDER_TO_DECIDE",
  "ORDER_TO_ACT",
  "ORDER_TO_REFRAIN",
  "INTERIM_MEASURE",
  "FILE_ACCESS",
  "DOCUMENT_PRODUCTION",
  "EVIDENCE_TAKING",
  "COST_RELIEF",
  "COMPENSATION",
  "NO_COST_ORDER",
  "OTHER",
]);

export const requestLevelSchema = z.enum([
  "PRIMARY",
  "EVENTUAL",
  "SUBEVENTUAL",
  "PROCEDURAL",
  "EVIDENTIARY",
  "INTERIM",
  "COSTS",
  "RESERVE",
]);
export type RequestLevel = z.infer<typeof requestLevelSchema>;

export const proceduralPostureSchema = z.object({
  matter_id: idSchema,
  jurisdiction: z.string().min(1),
  authority_or_court: z.string().min(1).optional(),
  procedural_stage: z.string().min(1),
  procedural_vehicle: proceduralVehicleSchema,
  local_vehicle_label: z.string().min(1).optional(),
  applicable_procedure: z.string().min(1).optional(),
  pending_requests: z.array(idSchema).default([]),
  contested_decision: idSchema.optional(),
  available_remedies: z.array(remedyTypeSchema).default([]),
  procedural_prerequisites: z.array(z.string().min(1)).default([]),
  known_deadlines: z.array(idSchema).default([]),
  unknown_deadlines: z.array(z.string().min(1)).default([]),
  standing_status: z.enum(["SUPPORTED", "PARTIAL", "WEAK", "ADVERSE", "UNKNOWN"]),
  interest_status: z.enum(["SUPPORTED", "PARTIAL", "WEAK", "ADVERSE", "UNKNOWN"]),
  exhaustion_status: z.enum(["SATISFIED", "PARTIALLY_SATISFIED", "UNSATISFIED", "UNKNOWN"]),
  provenance: provenanceSchema,
  confidence: confidenceSchema,
});
export type ProceduralPosture = z.infer<typeof proceduralPostureSchema>;

export const remedySchema = z.object({
  remedy_id: idSchema,
  remedy_type: remedyTypeSchema,
  requested_outcome: z.string().min(1),
  legal_basis: z.array(idSchema).default([]),
  procedural_vehicle: proceduralVehicleSchema,
  authority_competent: z.enum([
    "VERIFIED",
    "SUPPORTED",
    "UNCERTAIN",
    "CONTESTED",
    "INSUFFICIENT_BASIS",
  ]),
  prerequisites: z.array(idSchema).default([]),
  claim_ids: z.array(idSchema).default([]),
  issue_ids: z.array(idSchema).default([]),
  minimum_winning_case_dependencies: z.array(idSchema).default([]),
  evidentiary_dependencies: z.array(idSchema).default([]),
  legal_dependencies: z.array(idSchema).default([]),
  scope: z.string().min(1),
  temporal_scope: z.string().min(1).optional(),
  fallback_level: requestLevelSchema,
  risks: z.array(z.string().min(1)).default([]),
  provenance: provenanceSchema,
  status: z.enum(["SUPPORTED", "PARTIAL", "UNSUPPORTED", "UNKNOWN", "HUMAN_REVIEW_REQUIRED"]),
});
export type Remedy = z.infer<typeof remedySchema>;

export const remedyFitSchema = z.object({
  remedy_id: idSchema,
  legal_fit: fitDimensionSchema,
  procedural_fit: fitDimensionSchema,
  factual_fit: fitDimensionSchema,
  evidentiary_fit: fitDimensionSchema,
  scope_fit: fitDimensionSchema,
  minimum_winning_case_fit: fitDimensionSchema,
  overall: fitDimensionSchema,
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type RemedyFit = z.infer<typeof remedyFitSchema>;

export const overbreadthAssessmentSchema = z.object({
  remedy_id: idSchema,
  status: z.enum([
    "PROPORTIONATE",
    "POSSIBLY_OVERBROAD",
    "OVERBROAD",
    "UNSUPPORTED",
    "REQUIRES_NARROWING",
    "UNKNOWN",
  ]),
  exceeded_dimensions: z.array(
    z.enum([
      "CLAIM_SCOPE",
      "ISSUE_SCOPE",
      "EVIDENCE",
      "AUTHORITY_COMPETENCE",
      "PROCEDURAL_STAGE",
      "MINIMUM_WINNING_CASE",
      "LAWFUL_REMEDIAL_POWERS",
    ]),
  ),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});

export const narrowerLawfulRemedySchema = z.object({
  view_type: z.literal("NARROWER_LAWFUL_REMEDY"),
  source_of_truth: z.literal(false),
  original_remedy_id: idSchema,
  proposed_remedy_type: remedyTypeSchema,
  still_legally_useful: z.boolean(),
  reason: z.string().min(1),
  no_automatic_remand_preference: z.literal(true),
  provenance: provenanceSchema,
});
export type NarrowerLawfulRemedy = z.infer<typeof narrowerLawfulRemedySchema>;

export const proceduralRequestSchema = z.object({
  request_id: idSchema,
  matter_id: idSchema,
  request_type: z.enum([
    "MATERIAL_RELIEF",
    "PROCEDURAL_STEP",
    "EVIDENTIARY_STEP",
    "INTERIM_RELIEF",
    "COSTS",
    "RESERVE",
  ]),
  text_or_structured_relief: z.string().min(1),
  claim_ids: z.array(idSchema).default([]),
  issue_ids: z.array(idSchema).default([]),
  remedy: remedySchema.optional(),
  level: requestLevelSchema,
  dependencies: z.array(idSchema).default([]),
  conditions: z.array(z.string().min(1)).default([]),
  legal_basis: z.array(idSchema).default([]),
  evidentiary_basis: z.array(idSchema).default([]),
  procedural_basis: z.array(idSchema).default([]),
  scope: z.string().min(1),
  authority_requested_from: z.string().min(1).optional(),
  provenance: provenanceSchema,
  human_review_state: z
    .object({
      status: z.enum(["UNREVIEWED", "HUMAN_VERIFIED", "HUMAN_LOCKED", "REVIEW_REQUIRED"]),
      note: z.string().min(1).optional(),
    })
    .optional(),
});
export type ProceduralRequest = z.infer<typeof proceduralRequestSchema>;

export const requestOptimizationSchema = z.object({
  request_id: idSchema,
  action: z.enum([
    "KEEP",
    "MERGE",
    "REFORMULATE",
    "NARROW",
    "SUBORDINATE",
    "MOVE_TO_PROCEDURAL",
    "MOVE_TO_EVIDENTIARY",
    "ADD_EVENTUAL",
    "ADD_SUBEVENTUAL",
    "DROP",
    "HUMAN_REVIEW_REQUIRED",
  ]),
  reason: z.string().min(1),
  provenance: provenanceSchema,
});
export type RequestOptimization = z.infer<typeof requestOptimizationSchema>;

export const requestDuplicationSchema = z.object({
  request_a_id: idSchema,
  request_b_id: idSchema,
  classification: z.enum([
    "FULL_DUPLICATE",
    "PARTIAL_DUPLICATE",
    "OVERLAPPING_RELIEF",
    "DEPENDENT_RELIEF",
    "DISTINCT_RELIEF",
    "UNKNOWN",
  ]),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type RequestDuplication = z.infer<typeof requestDuplicationSchema>;

export const requestTypeClassificationSchema = z.enum([
  "MATERIAL_REQUEST",
  "PROCEDURAL_REQUEST",
  "EVIDENTIARY_REQUEST",
  "ARGUMENT_NOT_REQUEST",
  "FACT_NOT_REQUEST",
  "DECLARATORY_REQUEST",
  "UNKNOWN",
]);
export type RequestTypeClassification = z.infer<typeof requestTypeClassificationSchema>;

export const argumentRequestClassificationSchema = z.object({
  request_id: idSchema,
  classification: requestTypeClassificationSchema,
  reason: z.string().min(1),
  provenance: provenanceSchema,
});
export type ArgumentRequestClassification = z.infer<typeof argumentRequestClassificationSchema>;

export const evidentiaryRequestTypeSchema = z.enum([
  "REQUEST_DOCUMENT",
  "AKTENEDITION",
  "AKTENEINSICHT",
  "REQUEST_CLARIFICATION",
  "REQUEST_THIRD_PARTY_EVIDENCE",
  "REQUEST_EXPERT_EVIDENCE",
  "REQUEST_WITNESS",
  "REQUEST_HEARING",
  "OTHER",
]);

export const fileAccessMechanismSchema = z.enum([
  "AKTENEINSICHT",
  "AKTENBEIZUG",
  "AKTENEDITION",
  "EDITIONSBEGEHREN",
  "PRODUCTION_BY_OTHER_PARTY",
  "PRODUCTION_BY_AUTHORITY",
]);
export type FileAccessMechanism = z.infer<typeof fileAccessMechanismSchema>;

export const proceduralPrerequisiteAssessmentSchema = z.object({
  remedy_id: idSchema,
  jurisdiction: z.enum([
    "SATISFIED",
    "PARTIALLY_SATISFIED",
    "UNSATISFIED",
    "UNKNOWN",
    "REQUIRES_RESEARCH",
  ]),
  competence: z.enum([
    "SATISFIED",
    "PARTIALLY_SATISFIED",
    "UNSATISFIED",
    "UNKNOWN",
    "REQUIRES_RESEARCH",
  ]),
  standing: z.enum([
    "SATISFIED",
    "PARTIALLY_SATISFIED",
    "UNSATISFIED",
    "UNKNOWN",
    "REQUIRES_RESEARCH",
  ]),
  current_interest: z.enum([
    "SATISFIED",
    "PARTIALLY_SATISFIED",
    "UNSATISFIED",
    "UNKNOWN",
    "REQUIRES_RESEARCH",
  ]),
  exhaustion: z.enum([
    "SATISFIED",
    "PARTIALLY_SATISFIED",
    "UNSATISFIED",
    "UNKNOWN",
    "REQUIRES_RESEARCH",
  ]),
  deadline: z.enum([
    "SATISFIED",
    "PARTIALLY_SATISFIED",
    "UNSATISFIED",
    "UNKNOWN",
    "REQUIRES_RESEARCH",
  ]),
  form: z.enum(["SATISFIED", "PARTIALLY_SATISFIED", "UNSATISFIED", "UNKNOWN", "REQUIRES_RESEARCH"]),
  appealable_decision: z.enum([
    "SATISFIED",
    "PARTIALLY_SATISFIED",
    "UNSATISFIED",
    "UNKNOWN",
    "REQUIRES_RESEARCH",
  ]),
  procedural_vehicle: z.enum([
    "SATISFIED",
    "PARTIALLY_SATISFIED",
    "UNSATISFIED",
    "UNKNOWN",
    "REQUIRES_RESEARCH",
  ]),
  claim_request_linkage: z.enum([
    "SATISFIED",
    "PARTIALLY_SATISFIED",
    "UNSATISFIED",
    "UNKNOWN",
    "REQUIRES_RESEARCH",
  ]),
  evidentiary_basis: z.enum([
    "SATISFIED",
    "PARTIALLY_SATISFIED",
    "UNSATISFIED",
    "UNKNOWN",
    "REQUIRES_RESEARCH",
  ]),
  provenance: provenanceSchema,
});
export type ProceduralPrerequisiteAssessment = z.infer<
  typeof proceduralPrerequisiteAssessmentSchema
>;

export const deadlineAssessmentSchema = z.object({
  triggering_event: z.string().min(1).optional(),
  legal_basis: z.string().min(1).optional(),
  start_date: z.iso.date().optional(),
  duration: z.string().min(1).optional(),
  suspension_rules: z.string().min(1).optional(),
  end_date: z.iso.date().optional(),
  certainty: z.enum([
    "VERIFIED",
    "PARTIALLY_VERIFIED",
    "UNCERTAIN",
    "INSUFFICIENT_BASIS_TO_CALCULATE",
  ]),
  source: z.string().min(1).optional(),
  historical_version: z.string().min(1).optional(),
  human_review_required: z.boolean(),
  provenance: provenanceSchema,
});
export type DeadlineAssessment = z.infer<typeof deadlineAssessmentSchema>;

export const competenceAssessmentSchema = z.object({
  authority: z.string().min(1),
  subject_matter: z.string().min(1).optional(),
  territorial: z.string().min(1).optional(),
  functional: z.string().min(1).optional(),
  temporal: z.string().min(1).optional(),
  delegation_basis: z.string().min(1).optional(),
  legal_basis: z.array(idSchema).default([]),
  evidence: z.array(idSchema).default([]),
  status: z.enum(["VERIFIED", "SUPPORTED", "UNCERTAIN", "CONTESTED", "INSUFFICIENT_BASIS"]),
  no_incompetence_inferred_from_absence: z.literal(true),
  provenance: provenanceSchema,
});
export type CompetenceAssessment = z.infer<typeof competenceAssessmentSchema>;

export const nullitySignalSchema = z.object({
  status: z.enum([
    "NO_NULLITY_SIGNAL",
    "POSSIBLE_INVALIDITY",
    "POSSIBLE_NULLITY",
    "NULLITY_REQUIRES_STRONG_AUTHORITY",
    "NULLITY_SUPPORTED",
    "HUMAN_REVIEW_REQUIRED",
  ]),
  legal_basis: z.array(idSchema).default([]),
  defect_type: z.string().min(1).optional(),
  severity: z.enum(["LOW", "MODERATE", "HIGH", "EXTREME", "UNKNOWN"]),
  authority_ids: z.array(idSchema).default([]),
  precedent_ids: z.array(idSchema).default([]),
  procedural_consequences: z.array(z.string().min(1)).default([]),
  human_review_required: z.boolean(),
  provenance: provenanceSchema,
});
export type NullitySignal = z.infer<typeof nullitySignalSchema>;

export const standingInterestAssessmentSchema = z.object({
  standing: z.enum(["SUPPORTED", "PARTIAL", "WEAK", "ADVERSE", "UNKNOWN"]),
  current_interest: z.enum(["SUPPORTED", "PARTIAL", "WEAK", "ADVERSE", "UNKNOWN"]),
  practical_interest: z.enum(["SUPPORTED", "PARTIAL", "WEAK", "ADVERSE", "UNKNOWN"]),
  virtual_interest: z.enum(["SUPPORTED", "PARTIAL", "WEAK", "ADVERSE", "UNKNOWN"]),
  declaratory_interest: z.enum(["SUPPORTED", "PARTIAL", "WEAK", "ADVERSE", "UNKNOWN"]),
  repeatability_exception: z.enum(["SUPPORTED", "PARTIAL", "WEAK", "ADVERSE", "UNKNOWN"]),
  provenance: provenanceSchema,
});
export type StandingInterestAssessment = z.infer<typeof standingInterestAssessmentSchema>;

export const mootnessSignalSchema = z.object({
  status: z.enum([
    "NO_MOOTNESS",
    "POSSIBLE_MOOTNESS",
    "MATERIAL_MOOTNESS_RISK",
    "MOOTNESS_DISPUTED",
    "REQUIRES_HEARING",
    "UNKNOWN",
  ]),
  automatic_termination: z.literal(false),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type MootnessSignal = z.infer<typeof mootnessSignalSchema>;

export const proceduralPathMapSchema = z.object({
  view_type: z.literal("PROCEDURAL_PATH_MAP"),
  source_of_truth: z.literal(false),
  paths: z.array(
    z.object({
      path_id: idSchema,
      vehicle: proceduralVehicleSchema,
      prerequisite_ids: z.array(idSchema),
      remedy_id: idSchema,
      advantage: z.string().min(1),
      risk: z.string().min(1),
      dependency_ids: z.array(idSchema),
      evidence_needed: z.array(idSchema),
      legal_basis: z.array(idSchema),
      human_review: z.boolean(),
    }),
  ),
  no_probability_ranking: z.literal(true),
  provenance: provenanceSchema,
});
export type ProceduralPathMap = z.infer<typeof proceduralPathMapSchema>;

export const proceduralMwcSchema = z.object({
  view_type: z.literal("PROCEDURAL_MWC"),
  source_of_truth: z.literal(false),
  essential_procedural_requests: z.array(idSchema),
  essential_evidentiary_requests: z.array(idSchema),
  optional_requests: z.array(idSchema),
  dangerous_omissions: z.array(z.string().min(1)),
  provenance: provenanceSchema,
});

export const issueRemedyMapSchema = z.object({
  view_type: z.literal("ISSUE_REMEDY_MAP"),
  source_of_truth: z.literal(false),
  issue_id: idSchema,
  possible_remedy_ids: z.array(idSchema),
  prerequisite_ids: z.array(idSchema),
  evidence_ids: z.array(idSchema),
  legal_basis_ids: z.array(idSchema),
  procedural_vehicle: proceduralVehicleSchema,
  strategic_value: z.enum(["HIGH", "MEDIUM", "LOW", "DROP", "UNKNOWN"]),
  primary_eventual_role: requestLevelSchema,
  provenance: provenanceSchema,
});
export type IssueRemedyMap = z.infer<typeof issueRemedyMapSchema>;

export const claimRequestMapSchema = z.object({
  view_type: z.literal("CLAIM_REQUEST_MAP"),
  source_of_truth: z.literal(false),
  claim_id: idSchema,
  claim_element_ids: z.array(idSchema),
  issue_ids: z.array(idSchema),
  remedy_ids: z.array(idSchema),
  procedural_request_ids: z.array(idSchema),
  evidence_request_ids: z.array(idSchema),
  fallback_request_ids: z.array(idSchema),
  provenance: provenanceSchema,
});

export const proceduralStrategySchema = z.object({
  view_type: z.literal("PROCEDURAL_STRATEGY"),
  source_of_truth: z.literal(false),
  primary_requests: z.array(idSchema),
  eventual_requests: z.array(idSchema),
  subeventual_requests: z.array(idSchema),
  procedural_requests: z.array(idSchema),
  evidentiary_requests: z.array(idSchema),
  interim_requests: z.array(idSchema),
  cost_requests: z.array(idSchema),
  reserve_requests: z.array(idSchema),
  requests_to_drop: z.array(idSchema),
  requests_to_merge: z.array(z.array(idSchema).min(2)),
  requests_to_narrow: z.array(idSchema),
  preservation_points: z.array(idSchema),
  unresolved_procedural_risks: z.array(z.string().min(1)),
  provenance: provenanceSchema,
});
export type ProceduralStrategy = z.infer<typeof proceduralStrategySchema>;

export const minimumRequestSetSchema = z.object({
  view_type: z.literal("MINIMUM_REQUEST_SET"),
  source_of_truth: z.literal(false),
  request_ids: z.array(idSchema),
  preserves_winning_paths: z.array(idSchema),
  excluded_request_ids: z.array(idSchema),
  reason: z.string().min(1),
  provenance: provenanceSchema,
});
export type MinimumRequestSet = z.infer<typeof minimumRequestSetSchema>;

export const formulationStyleSchema = z.enum([
  "DIRECT",
  "EVENTUAL",
  "SUBEVENTUAL",
  "PROCEDURAL",
  "EVIDENTIARY",
  "RESERVE",
]);
export type FormulationStyle = z.infer<typeof formulationStyleSchema>;

export const responseProceduralConsequenceSchema = z.object({
  point_id: idSchema,
  must_answer_now: z.boolean(),
  can_preserve: z.boolean(),
  can_leave_unaddressed: z.boolean(),
  must_request_evidence: z.boolean(),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const minFit = (values: z.infer<typeof strengthSchema>[]): z.infer<typeof strengthSchema> => {
  const rank: Record<z.infer<typeof strengthSchema>, number> = {
    VERY_STRONG: 5,
    STRONG: 4,
    MODERATE: 3,
    WEAK: 2,
    VERY_WEAK: 1,
    UNKNOWN: 0,
  };
  return values.sort((a, b) => rank[a] - rank[b])[0] ?? "UNKNOWN";
};

export function assessRemedyFit(input: {
  remedy: Remedy;
  minimumWinningCase: MinimumWinningCase;
  posture: ProceduralPosture;
  evidenceAvailable: boolean;
  legalBasisAvailable: boolean;
}): RemedyFit {
  const legal_fit = input.legalBasisAvailable ? "STRONG" : "WEAK";
  const procedural_fit = input.posture.available_remedies.includes(input.remedy.remedy_type)
    ? "STRONG"
    : "WEAK";
  const factual_fit = input.minimumWinningCase.satisfied ? "STRONG" : "MODERATE";
  const evidentiary_fit = input.evidenceAvailable ? "STRONG" : "WEAK";
  const scope_fit = input.remedy.risks.some((risk) => risk.toLowerCase().includes("overbroad"))
    ? "WEAK"
    : "STRONG";
  const minimum_winning_case_fit = input.remedy.minimum_winning_case_dependencies.every((id) =>
    [
      ...input.minimumWinningCase.essential_facts,
      ...input.minimumWinningCase.essential_legal_propositions,
      ...input.minimumWinningCase.essential_evidence,
    ].some((element) => element.element_id === id && element.status === "SATISFIED"),
  )
    ? "STRONG"
    : "WEAK";
  return remedyFitSchema.parse({
    remedy_id: input.remedy.remedy_id,
    legal_fit,
    procedural_fit,
    factual_fit,
    evidentiary_fit,
    scope_fit,
    minimum_winning_case_fit,
    overall: minFit([
      legal_fit,
      procedural_fit,
      factual_fit,
      evidentiary_fit,
      scope_fit,
      minimum_winning_case_fit,
    ]),
    explanation: "Remedy fit is separate from merits strength.",
    provenance: input.remedy.provenance,
  });
}

export function detectOverbroadRemedy(input: {
  remedy: Remedy;
  minimumWinningCase: MinimumWinningCase;
  posture: ProceduralPosture;
}) {
  const exceeded = [
    input.remedy.risks.some((risk) => risk.toLowerCase().includes("claim"))
      ? "CLAIM_SCOPE"
      : undefined,
    input.remedy.risks.some((risk) => risk.toLowerCase().includes("evidence"))
      ? "EVIDENCE"
      : undefined,
    input.remedy.authority_competent === "UNCERTAIN" ? "AUTHORITY_COMPETENCE" : undefined,
    !input.posture.available_remedies.includes(input.remedy.remedy_type)
      ? "LAWFUL_REMEDIAL_POWERS"
      : undefined,
    input.minimumWinningCase.unresolved_essential_ids.length > 0
      ? "MINIMUM_WINNING_CASE"
      : undefined,
  ].filter((item): item is NonNullable<typeof item> => item !== undefined);
  return overbreadthAssessmentSchema.parse({
    remedy_id: input.remedy.remedy_id,
    status:
      exceeded.length === 0
        ? "PROPORTIONATE"
        : exceeded.length >= 2
          ? "REQUIRES_NARROWING"
          : "POSSIBLY_OVERBROAD",
    exceeded_dimensions: exceeded,
    explanation: "Overbreadth checks remedy scope independently from claim merits.",
    provenance: input.remedy.provenance,
  });
}

export function analyzeNarrowerLawfulRemedy(input: {
  remedy: Remedy;
  overbreadth: z.infer<typeof overbreadthAssessmentSchema>;
  judgePaths: JudicialDecisionPath[];
  provenance: ProvenanceRef[];
}): NarrowerLawfulRemedy {
  const proceduralPath = input.judgePaths.find(
    (path) => path.outcome_direction === "PROCEDURAL_DISPOSITION",
  );
  const proposed =
    input.overbreadth.status === "PROPORTIONATE"
      ? input.remedy.remedy_type
      : proceduralPath
        ? "REMAND"
        : input.remedy.remedy_type === "REVERSAL"
          ? "MODIFICATION"
          : "ORDER_TO_DECIDE";
  return narrowerLawfulRemedySchema.parse({
    view_type: "NARROWER_LAWFUL_REMEDY",
    source_of_truth: false,
    original_remedy_id: input.remedy.remedy_id,
    proposed_remedy_type: proposed,
    still_legally_useful: true,
    reason:
      "Selected as a narrower procedurally usable remedy where the original relief is vulnerable.",
    no_automatic_remand_preference: true,
    provenance: input.provenance,
  });
}

export function detectDuplication(a: ProceduralRequest, b: ProceduralRequest): RequestDuplication {
  const sameRemedy = a.remedy?.remedy_type === b.remedy?.remedy_type;
  const sameScope = a.scope === b.scope;
  const sameLevel = a.level === b.level;
  return requestDuplicationSchema.parse({
    request_a_id: a.request_id,
    request_b_id: b.request_id,
    classification:
      sameRemedy && sameScope && sameLevel
        ? "FULL_DUPLICATE"
        : sameRemedy && sameScope
          ? "PARTIAL_DUPLICATE"
          : sameRemedy
            ? "OVERLAPPING_RELIEF"
            : "DISTINCT_RELIEF",
    explanation:
      "Duplicate detection keeps distinct remedies separate even where wording overlaps.",
    provenance: unique([...a.provenance, ...b.provenance]),
  });
}

export function classifyArgumentAsRequest(
  request: ProceduralRequest,
): ArgumentRequestClassification {
  const text = request.text_or_structured_relief.toLowerCase();
  const classification: RequestTypeClassification =
    request.level === "EVIDENTIARY" || request.request_type === "EVIDENTIARY_STEP"
      ? "EVIDENTIARY_REQUEST"
      : request.level === "PROCEDURAL" || request.request_type === "PROCEDURAL_STEP"
        ? "PROCEDURAL_REQUEST"
        : text.includes("because") || text.includes("weil") || text.includes("therefore")
          ? "ARGUMENT_NOT_REQUEST"
          : text.includes("fact") || text.includes("tatsache")
            ? "FACT_NOT_REQUEST"
            : request.remedy?.remedy_type === "DECLARATORY_RELIEF"
              ? "DECLARATORY_REQUEST"
              : "MATERIAL_REQUEST";
  return argumentRequestClassificationSchema.parse({
    request_id: request.request_id,
    classification,
    reason: "Classifies requested relief separately from legal argument and evidence motions.",
    provenance: request.provenance,
  });
}

export function evaluateRequestOptimization(input: {
  request: ProceduralRequest;
  classification: ArgumentRequestClassification;
  duplication?: RequestDuplication;
  overbreadth?: z.infer<typeof overbreadthAssessmentSchema>;
  fallbackGap?: boolean;
}): RequestOptimization {
  const action =
    input.duplication?.classification === "FULL_DUPLICATE"
      ? "MERGE"
      : input.classification.classification === "EVIDENTIARY_REQUEST" &&
          input.request.level !== "EVIDENTIARY"
        ? "MOVE_TO_EVIDENTIARY"
        : input.classification.classification === "ARGUMENT_NOT_REQUEST"
          ? "DROP"
          : input.overbreadth?.status === "REQUIRES_NARROWING"
            ? "NARROW"
            : input.fallbackGap
              ? "ADD_EVENTUAL"
              : "KEEP";
  return requestOptimizationSchema.parse({
    request_id: input.request.request_id,
    action,
    reason: "Optimization preserves material, procedural and evidentiary categories.",
    provenance: input.request.provenance,
  });
}

export function assessProceduralPrerequisites(input: {
  remedy: Remedy;
  posture: ProceduralPosture;
  deadline?: DeadlineAssessment;
}): ProceduralPrerequisiteAssessment {
  return proceduralPrerequisiteAssessmentSchema.parse({
    remedy_id: input.remedy.remedy_id,
    jurisdiction: "SATISFIED",
    competence: input.remedy.authority_competent === "VERIFIED" ? "SATISFIED" : "UNKNOWN",
    standing: input.posture.standing_status === "SUPPORTED" ? "SATISFIED" : "UNKNOWN",
    current_interest: input.posture.interest_status === "SUPPORTED" ? "SATISFIED" : "UNKNOWN",
    exhaustion: input.posture.exhaustion_status,
    deadline: input.deadline?.certainty === "VERIFIED" ? "SATISFIED" : "UNKNOWN",
    form: "UNKNOWN",
    appealable_decision: input.posture.contested_decision ? "SATISFIED" : "UNKNOWN",
    procedural_vehicle:
      input.posture.procedural_vehicle === input.remedy.procedural_vehicle
        ? "SATISFIED"
        : "UNKNOWN",
    claim_request_linkage: input.remedy.claim_ids.length > 0 ? "SATISFIED" : "UNKNOWN",
    evidentiary_basis: input.remedy.evidentiary_dependencies.length > 0 ? "SATISFIED" : "UNKNOWN",
    provenance: unique([...input.remedy.provenance, ...input.posture.provenance]),
  });
}

export function assessDeadline(input: {
  triggeringEvent?: string;
  legalBasis?: string;
  startDate?: string;
  duration?: string;
  historicalVersion?: string;
  source?: string;
  provenance: ProvenanceRef[];
}): DeadlineAssessment {
  const complete =
    input.triggeringEvent &&
    input.legalBasis &&
    input.startDate &&
    input.duration &&
    input.source &&
    input.historicalVersion;
  return deadlineAssessmentSchema.parse({
    triggering_event: input.triggeringEvent,
    legal_basis: input.legalBasis,
    start_date: input.startDate,
    duration: input.duration,
    certainty: complete
      ? "VERIFIED"
      : input.triggeringEvent
        ? "UNCERTAIN"
        : "INSUFFICIENT_BASIS_TO_CALCULATE",
    source: input.source,
    historical_version: input.historicalVersion,
    human_review_required: !complete,
    provenance: input.provenance,
  });
}

export function assessCompetence(input: {
  authority: string;
  legalBasis?: string[];
  evidence?: string[];
  delegationBasis?: string;
  contested?: boolean;
  provenance: ProvenanceRef[];
}): CompetenceAssessment {
  return competenceAssessmentSchema.parse({
    authority: input.authority,
    delegation_basis: input.delegationBasis,
    legal_basis: input.legalBasis ?? [],
    evidence: input.evidence ?? [],
    status: input.contested ? "CONTESTED" : input.delegationBasis ? "SUPPORTED" : "UNCERTAIN",
    no_incompetence_inferred_from_absence: true,
    provenance: input.provenance,
  });
}

export function assessNullitySignal(input: {
  defectType?: string;
  severity?: "LOW" | "MODERATE" | "HIGH" | "EXTREME" | "UNKNOWN";
  legalBasis?: string[];
  precedentIds?: string[];
  provenance: ProvenanceRef[];
}): NullitySignal {
  const strong =
    input.severity === "EXTREME" &&
    (input.legalBasis?.length ?? 0) > 0 &&
    (input.precedentIds?.length ?? 0) > 0;
  return nullitySignalSchema.parse({
    status: strong
      ? "NULLITY_SUPPORTED"
      : input.defectType
        ? "POSSIBLE_INVALIDITY"
        : "NO_NULLITY_SIGNAL",
    legal_basis: input.legalBasis ?? [],
    defect_type: input.defectType,
    severity: input.severity ?? "UNKNOWN",
    authority_ids: [],
    precedent_ids: input.precedentIds ?? [],
    procedural_consequences: [],
    human_review_required: Boolean(input.defectType) && !strong,
    provenance: input.provenance,
  });
}

export function assessMootness(input: {
  materialEventEnded: boolean;
  declaratoryInterestUnresolved: boolean;
  provenance: ProvenanceRef[];
}): MootnessSignal {
  return mootnessSignalSchema.parse({
    status: input.materialEventEnded
      ? input.declaratoryInterestUnresolved
        ? "MOOTNESS_DISPUTED"
        : "POSSIBLE_MOOTNESS"
      : "NO_MOOTNESS",
    automatic_termination: false,
    explanation: "Mootness signal does not automatically terminate remedy analysis.",
    provenance: input.provenance,
  });
}

export function detectDelayDenialSignal(input: { delaySignal?: unknown; silence?: boolean }) {
  if (input.silence) return "DENIAL_OF_JUSTICE_CANDIDATE" as const;
  if (input.delaySignal) return "DELAY_OF_JUSTICE_CANDIDATE" as const;
  return "NO_SIGNAL" as const;
}

export function assessRemandStrategy(input: {
  furtherFactFindingRequired: boolean;
  directDecisionPossible: boolean;
  proceduralPathAvailable: boolean;
}) {
  if (input.furtherFactFindingRequired && input.proceduralPathAvailable)
    return "REMAND_STRONGLY_FITS" as const;
  if (input.directDecisionPossible && !input.furtherFactFindingRequired)
    return "DIRECT_DECISION_PREFERABLE" as const;
  if (input.directDecisionPossible && input.proceduralPathAvailable)
    return "EITHER_POSSIBLE" as const;
  return "INSUFFICIENT_BASIS" as const;
}

export function buildProceduralPathMap(input: {
  remedies: Remedy[];
  posture: ProceduralPosture;
  provenance: ProvenanceRef[];
}): ProceduralPathMap {
  return proceduralPathMapSchema.parse({
    view_type: "PROCEDURAL_PATH_MAP",
    source_of_truth: false,
    paths: input.remedies.map((remedy, index) => ({
      path_id: `PATH_${String.fromCharCode(65 + index)}`,
      vehicle: remedy.procedural_vehicle,
      prerequisite_ids: remedy.prerequisites,
      remedy_id: remedy.remedy_id,
      advantage: "Procedurally available route on supplied data.",
      risk: remedy.risks.join("; ") || "No specific risk supplied.",
      dependency_ids: remedy.minimum_winning_case_dependencies,
      evidence_needed: remedy.evidentiary_dependencies,
      legal_basis: remedy.legal_basis,
      human_review: remedy.authority_competent !== "VERIFIED",
    })),
    no_probability_ranking: true,
    provenance: input.provenance,
  });
}

export function buildProceduralMinimumWinningCase(input: {
  minimumWinningCase: MinimumWinningCase;
  requests: ProceduralRequest[];
  evidenceRecommendations?: EvidenceRequestRecommendation[];
  provenance: ProvenanceRef[];
}) {
  const essentialProcedural = input.requests
    .filter((request) => request.level === "PRIMARY" || request.level === "PROCEDURAL")
    .map((request) => request.request_id);
  const essentialEvidence = input.requests
    .filter((request) => request.level === "EVIDENTIARY")
    .map((request) => request.request_id);
  const dangerous =
    input.minimumWinningCase.unresolved_essential_ids.length > 0 && essentialEvidence.length === 0
      ? ["Missing essential evidence without evidentiary request."]
      : [];
  return proceduralMwcSchema.parse({
    view_type: "PROCEDURAL_MWC",
    source_of_truth: false,
    essential_procedural_requests: essentialProcedural,
    essential_evidentiary_requests: essentialEvidence,
    optional_requests: input.requests
      .filter((request) => request.level === "RESERVE")
      .map((request) => request.request_id),
    dangerous_omissions: dangerous,
    provenance: input.provenance,
  });
}

export function evaluatePreservationNeed(input: {
  issuePriority?: IssuePriority;
  legalBasisKnown: boolean;
}) {
  if (input.issuePriority?.priority === "DISPOSITIVE") return "MUST_PRESERVE" as const;
  if (input.issuePriority?.priority === "HIGH" && input.legalBasisKnown)
    return "SHOULD_PRESERVE" as const;
  if (input.issuePriority?.priority === "LOW") return "OPTIONAL" as const;
  return "UNKNOWN" as const;
}

export function evaluateWaiverRisk(input: {
  proceduralBasisKnown: boolean;
  materialOmission: boolean;
}) {
  if (!input.proceduralBasisKnown) return "UNKNOWN" as const;
  if (input.materialOmission) return "MATERIAL_WAIVER_RISK" as const;
  return "NO_WAIVER_SIGNAL" as const;
}

export function assessProceduralConcession(input: {
  concession: ConcessionAnalysis;
  proceduralTargetEssential: boolean;
}) {
  if (input.proceduralTargetEssential || input.concession.classification === "FATAL")
    return "FATAL" as const;
  if (input.concession.classification === "RISKY") return "RISKY" as const;
  return "SAFE" as const;
}

export function evaluateResponseProceduralConsequence(input: {
  response: ResponseNecessity;
  missingEvidence: boolean;
  provenance: ProvenanceRef[];
}) {
  return responseProceduralConsequenceSchema.parse({
    point_id: input.response.point_id,
    must_answer_now: input.response.necessity === "MUST_RESPOND",
    can_preserve: ["SHOULD_RESPOND", "OPTIONAL"].includes(input.response.necessity),
    can_leave_unaddressed: ["BETTER_NOT_TO_ENGAGE", "IRRELEVANT"].includes(
      input.response.necessity,
    ),
    must_request_evidence: input.missingEvidence && input.response.necessity !== "IRRELEVANT",
    explanation: "Maps strategic response necessity to procedural consequences.",
    provenance: input.provenance,
  });
}

export function buildIssueRemedyMap(input: {
  issueLawMap: IssueLawMap;
  remedies: Remedy[];
  role: RequestLevel;
  provenance: ProvenanceRef[];
}): IssueRemedyMap {
  const remedies = input.remedies.filter((remedy) =>
    remedy.issue_ids.includes(input.issueLawMap.issue_id),
  );
  return issueRemedyMapSchema.parse({
    view_type: "ISSUE_REMEDY_MAP",
    source_of_truth: false,
    issue_id: input.issueLawMap.issue_id,
    possible_remedy_ids: remedies.map((remedy) => remedy.remedy_id),
    prerequisite_ids: unique(remedies.flatMap((remedy) => remedy.prerequisites)),
    evidence_ids: unique(remedies.flatMap((remedy) => remedy.evidentiary_dependencies)),
    legal_basis_ids: input.issueLawMap.governing_provision_ids,
    procedural_vehicle: remedies[0]?.procedural_vehicle ?? "OTHER",
    strategic_value:
      input.issueLawMap.materiality === "HIGH" || input.issueLawMap.materiality === "DISPOSITIVE"
        ? "HIGH"
        : "MEDIUM",
    primary_eventual_role: input.role,
    provenance: input.provenance,
  });
}

export function buildClaimRequestMap(input: {
  claimId: string;
  claimElementIds: string[];
  requests: ProceduralRequest[];
  provenance: ProvenanceRef[];
}) {
  const linked = input.requests.filter((request) => request.claim_ids.includes(input.claimId));
  return claimRequestMapSchema.parse({
    view_type: "CLAIM_REQUEST_MAP",
    source_of_truth: false,
    claim_id: input.claimId,
    claim_element_ids: input.claimElementIds,
    issue_ids: unique(linked.flatMap((request) => request.issue_ids)),
    remedy_ids: linked.flatMap((request) =>
      request.remedy?.remedy_id ? [request.remedy.remedy_id] : [],
    ),
    procedural_request_ids: linked
      .filter((request) => request.level === "PROCEDURAL")
      .map((request) => request.request_id),
    evidence_request_ids: linked
      .filter((request) => request.level === "EVIDENTIARY")
      .map((request) => request.request_id),
    fallback_request_ids: linked
      .filter((request) => request.level === "EVENTUAL" || request.level === "SUBEVENTUAL")
      .map((request) => request.request_id),
    provenance: input.provenance,
  });
}

export function detectRemedyGap(input: {
  legalArgumentIds: string[];
  requests: ProceduralRequest[];
}) {
  return input.legalArgumentIds.length > 0 &&
    input.requests.filter((request) => request.request_type === "MATERIAL_RELIEF").length === 0
    ? ("REMEDY_GAP" as const)
    : ("NO_REMEDY_GAP" as const);
}

export function detectEvidenceRequestGap(input: {
  essentialFactMissing: boolean;
  authorityControlsDocument: boolean;
  requests: ProceduralRequest[];
}) {
  const hasEvidenceRequest = input.requests.some((request) => request.level === "EVIDENTIARY");
  return input.essentialFactMissing && input.authorityControlsDocument && !hasEvidenceRequest
    ? ("EVIDENTIARY_REQUEST_GAP" as const)
    : ("NO_EVIDENTIARY_REQUEST_GAP" as const);
}

export function detectEventualReliefGap(input: {
  primaryVulnerable: boolean;
  alternativeLegallyPlausible: boolean;
  requests: ProceduralRequest[];
}) {
  const hasEventual = input.requests.some(
    (request) => request.level === "EVENTUAL" || request.level === "SUBEVENTUAL",
  );
  return input.primaryVulnerable && input.alternativeLegallyPlausible && !hasEventual
    ? ("EVENTUAL_RELIEF_GAP" as const)
    : ("NO_EVENTUAL_RELIEF_GAP" as const);
}

export function evaluateFavorableJudgeEnablement(input: {
  favorablePath: JudicialDecisionPath;
  requests: ProceduralRequest[];
}) {
  const hasUsableRemedy = input.requests.some(
    (request) => request.request_type === "MATERIAL_RELIEF" && request.remedy,
  );
  return input.favorablePath.outcome_direction === "SUPPORTS_REQUESTED_OUTCOME" && !hasUsableRemedy
    ? ("WINNING_ARGUMENT_WITHOUT_USABLE_REMEDY" as const)
    : ("USABLE_REMEDY_PRESENT" as const);
}

export function detectOvercomplexRequestSet(input: {
  requests: ProceduralRequest[];
  duplications: RequestDuplication[];
  classifications: ArgumentRequestClassification[];
}) {
  const mixedEvidence = input.requests.some(
    (request) => request.request_type === "MATERIAL_RELIEF" && request.level === "EVIDENTIARY",
  );
  const duplicates = input.duplications.some(
    (duplication) => duplication.classification === "FULL_DUPLICATE",
  );
  const argumentRequests = input.classifications.some(
    (classification) => classification.classification === "ARGUMENT_NOT_REQUEST",
  );
  if (input.requests.length > 7 || mixedEvidence || duplicates || argumentRequests)
    return "REQUIRES_RESTRUCTURING" as const;
  if (input.requests.length > 4) return "MODERATELY_COMPLEX" as const;
  return "CLEAR" as const;
}

export function buildMinimumRequestSet(input: {
  requests: ProceduralRequest[];
  winningPathIds: string[];
  requiredRequestIds: string[];
  provenance: ProvenanceRef[];
}): MinimumRequestSet {
  const selected = input.requests.filter((request) =>
    input.requiredRequestIds.includes(request.request_id),
  );
  return minimumRequestSetSchema.parse({
    view_type: "MINIMUM_REQUEST_SET",
    source_of_truth: false,
    request_ids: selected.map((request) => request.request_id),
    preserves_winning_paths: input.winningPathIds,
    excluded_request_ids: input.requests
      .filter((request) => !input.requiredRequestIds.includes(request.request_id))
      .map((request) => request.request_id),
    reason:
      "Smallest supplied request set that preserves useful winning paths; not all fallbacks are necessary.",
    provenance: input.provenance,
  });
}

export function calibrateRequestFormulation(level: RequestLevel): {
  style: FormulationStyle;
  terminology: string;
} {
  const styleByLevel: Record<RequestLevel, FormulationStyle> = {
    PRIMARY: "DIRECT",
    EVENTUAL: "EVENTUAL",
    SUBEVENTUAL: "SUBEVENTUAL",
    PROCEDURAL: "PROCEDURAL",
    EVIDENTIARY: "EVIDENTIARY",
    INTERIM: "PROCEDURAL",
    COSTS: "RESERVE",
    RESERVE: "RESERVE",
  };
  const terminology: Record<FormulationStyle, string> = {
    DIRECT: "Hauptbegehren",
    EVENTUAL: "Eventualbegehren",
    SUBEVENTUAL: "Subeventualbegehren",
    PROCEDURAL: "Verfahrensantrag",
    EVIDENTIARY: "Beweisantrag",
    RESERVE: "Reserve",
  };
  const style = styleByLevel[level];
  return { style, terminology: terminology[style] };
}

export function buildProceduralStrategy(input: {
  requests: ProceduralRequest[];
  optimizations: RequestOptimization[];
  minimumRequestSet: MinimumRequestSet;
  preservationPoints?: string[];
  risks?: string[];
  provenance: ProvenanceRef[];
}): ProceduralStrategy {
  const byLevel = (level: RequestLevel) =>
    input.requests
      .filter((request) => request.level === level)
      .map((request) => request.request_id);
  return proceduralStrategySchema.parse({
    view_type: "PROCEDURAL_STRATEGY",
    source_of_truth: false,
    primary_requests: byLevel("PRIMARY"),
    eventual_requests: byLevel("EVENTUAL"),
    subeventual_requests: byLevel("SUBEVENTUAL"),
    procedural_requests: byLevel("PROCEDURAL"),
    evidentiary_requests: byLevel("EVIDENTIARY"),
    interim_requests: byLevel("INTERIM"),
    cost_requests: byLevel("COSTS"),
    reserve_requests: byLevel("RESERVE"),
    requests_to_drop: input.optimizations
      .filter((optimization) => optimization.action === "DROP")
      .map((optimization) => optimization.request_id),
    requests_to_merge: input.optimizations
      .filter((optimization) => optimization.action === "MERGE")
      .map((optimization) => [optimization.request_id, optimization.request_id]),
    requests_to_narrow: input.optimizations
      .filter((optimization) => optimization.action === "NARROW")
      .map((optimization) => optimization.request_id),
    preservation_points: input.preservationPoints ?? input.minimumRequestSet.request_ids,
    unresolved_procedural_risks: input.risks ?? [],
    provenance: input.provenance,
  });
}

export function generateProceduralHumanReviewFlags(input: {
  deadline?: DeadlineAssessment;
  competence?: CompetenceAssessment;
  nullity?: NullitySignal;
  standing?: StandingInterestAssessment;
  waiverRisk?: ReturnType<typeof evaluateWaiverRisk>;
  multipleIncompatibleRemedies?: boolean;
  statuteVersionUnresolved?: boolean;
}) {
  const flags: string[] = [];
  if (input.deadline?.certainty !== undefined && input.deadline.certainty !== "VERIFIED")
    flags.push("HUMAN_REVIEW_REQUIRED_DEADLINE");
  if (
    input.competence &&
    ["UNCERTAIN", "CONTESTED", "INSUFFICIENT_BASIS"].includes(input.competence.status)
  )
    flags.push("HUMAN_REVIEW_REQUIRED_COMPETENCE");
  if (input.nullity?.human_review_required) flags.push("HUMAN_REVIEW_REQUIRED_NULLITY");
  if (input.standing?.current_interest === "UNKNOWN") flags.push("HUMAN_REVIEW_REQUIRED_INTEREST");
  if (input.waiverRisk === "MATERIAL_WAIVER_RISK") flags.push("HUMAN_REVIEW_REQUIRED_WAIVER");
  if (input.multipleIncompatibleRemedies) flags.push("HUMAN_REVIEW_REQUIRED_INCOMPATIBLE_REMEDIES");
  if (input.statuteVersionUnresolved) flags.push("HUMAN_REVIEW_REQUIRED_STATUTE_VERSION");
  return flags;
}

export function validateProceduralRecommendationProvenance(input: {
  provenance: ProvenanceRef[];
  hypothetical?: boolean;
}) {
  return (
    input.provenance.length > 0 &&
    (input.hypothetical === true ||
      input.provenance.some(
        (item) => item.type === "SYSTEM_DERIVATION" || item.type === "UNSOURCED",
      ))
  );
}
