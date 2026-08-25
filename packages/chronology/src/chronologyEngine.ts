import { z } from "zod";
import {
  confidenceSchema,
  evaluateHumanLockConflict,
  proceduralContextSchema,
  provenanceRefSchema,
  type Action,
  type Decision,
  type Evidence,
  type PartyPosition,
  type ProceduralContext,
  type ProvenanceRef,
  type Request,
  type Response,
  type ReviewState,
} from "@swiss-legal-mcp/core";

const idSchema = z.string().min(1);
const provenanceSchema = z.array(provenanceRefSchema).min(1);

export const temporalPrecisionSchema = z.enum([
  "EXACT_DATETIME",
  "EXACT_DATE",
  "APPROXIMATE_DATE",
  "DATE_RANGE",
  "BEFORE",
  "AFTER",
  "UNKNOWN",
]);
export type TemporalPrecision = z.infer<typeof temporalPrecisionSchema>;

export const temporalRelationshipSchema = z.enum([
  "BEFORE",
  "AFTER",
  "SAME_TIME",
  "OVERLAPS",
  "CONTAINS",
  "WITHIN",
  "UNKNOWN",
]);
export type TemporalRelationship = z.infer<typeof temporalRelationshipSchema>;

export const chronologyRelationshipTypeSchema = z.enum([
  "PROCEDURALLY_FOLLOWS",
  "RESPONDS_TO",
  "RESULTS_IN",
  "TRIGGERS",
  "SUPERSEDES",
]);
export type ChronologyRelationshipType = z.infer<typeof chronologyRelationshipTypeSchema>;

export const chronologyTraceTargetSchema = z.enum([
  "Document",
  "Passage",
  "Evidence",
  "Assertion",
  "Request",
  "Response",
  "Action",
  "Decision",
]);
export type ChronologyTraceTarget = z.infer<typeof chronologyTraceTargetSchema>;

export const chronologyEventSchema = z.object({
  event_id: idSchema,
  matter_id: idSchema,
  event_type: z.enum([
    "REQUEST_EVENT",
    "RESPONSE_EVENT",
    "ACTION_EVENT",
    "DECISION_EVENT",
    "SUBMISSION_EVENT",
    "EVIDENCE_EVENT",
    "COMMUNICATION_EVENT",
    "DEADLINE_EVENT",
    "PROCEDURAL_EVENT",
    "OTHER",
  ]),
  actor_ids: z.array(idSchema).default([]),
  object_ids: z.array(idSchema).default([]),
  date_time: z.iso.datetime({ offset: true }).optional(),
  date: z.iso.date().optional(),
  date_range: z.object({ from: z.iso.date(), until: z.iso.date() }).optional(),
  temporal_precision: temporalPrecisionSchema,
  procedural_context: proceduralContextSchema.optional(),
  source_documents: z.array(idSchema).default([]),
  source_passages: z.array(idSchema).default([]),
  provenance: provenanceSchema,
  confidence: confidenceSchema,
  related_request_ids: z.array(idSchema).default([]),
  related_response_ids: z.array(idSchema).default([]),
  related_action_ids: z.array(idSchema).default([]),
  related_decision_ids: z.array(idSchema).default([]),
  locked_review_state: z
    .object({
      field: z.enum(["event_date", "request_scope", "decision_scope"]),
      reviewed_state: z.object({
        status: z.enum(["UNREVIEWED", "HUMAN_VERIFIED", "HUMAN_LOCKED", "REVIEW_REQUIRED"]),
        locked_by: idSchema.optional(),
        locked_at: z.iso.datetime({ offset: true }).optional(),
        reviewed_at: z.iso.datetime({ offset: true }).optional(),
        note: z.string().min(1).optional(),
      }),
    })
    .optional(),
});
export type ChronologyEvent = z.infer<typeof chronologyEventSchema>;

export const chronologyRelationshipSchema = z.object({
  id: idSchema,
  matter_id: idSchema,
  from_event_id: idSchema,
  to_event_id: idSchema,
  temporal_relationship: temporalRelationshipSchema,
  procedural_relationship: chronologyRelationshipTypeSchema.optional(),
  confidence: confidenceSchema,
  provenance: provenanceSchema,
});
export type ChronologyRelationship = z.infer<typeof chronologyRelationshipSchema>;

export const requestAmendmentTypeSchema = z.enum([
  "CLARIFICATION",
  "NARROWING",
  "EXPANSION",
  "REITERATION",
  "REPLACEMENT",
  "WITHDRAWAL",
]);
export type RequestAmendmentType = z.infer<typeof requestAmendmentTypeSchema>;

export const requestAnalysisSchema = z.object({
  request_id: idSchema,
  requester_actor_id: idSchema.optional(),
  addressee_actor_id: idSchema.optional(),
  request_date: z.iso.date().optional(),
  requested_object: z.string().min(1),
  requested_relief: z.string().min(1).optional(),
  requested_legal_basis: z.string().min(1).optional(),
  urgency: z.enum(["URGENT", "NORMAL", "UNKNOWN"]),
  procedural_context: proceduralContextSchema.optional(),
  provenance: provenanceSchema,
  lineage_root_request_id: idSchema,
  amendment_type: requestAmendmentTypeSchema.optional(),
  withdrawn: z.boolean(),
  superseded_by_request_id: idSchema.optional(),
});
export type RequestAnalysis = z.infer<typeof requestAnalysisSchema>;

export const responseAnalysisSchema = z.object({
  response_id: idSchema,
  response_type: z.enum([
    "ACKNOWLEDGEMENT",
    "INFORMAL_REPLY",
    "PROCEDURAL_REPLY",
    "FACTUAL_REPLY",
    "PROMISE_TO_DECIDE",
    "REFUSAL_TO_ENGAGE",
    "PARTIAL_RESPONSE",
    "OTHER",
  ]),
  linked_request_ids: z.array(idSchema),
  decides_request: z.literal(false),
  explanation: z.string().min(1),
  procedural_context: proceduralContextSchema.optional(),
  provenance: provenanceSchema,
});
export type ResponseAnalysis = z.infer<typeof responseAnalysisSchema>;

export const materialSatisfactionStatusSchema = z.enum([
  "FULLY_SATISFIED",
  "PARTIALLY_SATISFIED",
  "NOT_SATISFIED",
  "UNKNOWN",
]);
export type MaterialSatisfactionStatus = z.infer<typeof materialSatisfactionStatusSchema>;

export const proceduralDecisionStatusSchema = z.enum([
  "FULLY_DECIDED",
  "PARTIALLY_DECIDED",
  "NOT_DECIDED",
  "UNKNOWN",
]);
export type ProceduralDecisionStatus = z.infer<typeof proceduralDecisionStatusSchema>;

export const actionAnalysisSchema = z.object({
  action_id: idSchema,
  action_type: z.enum([
    "SERVICE_PROVIDED",
    "PAYMENT",
    "HOUSING",
    "INSPECTION",
    "MEETING",
    "CONTACT",
    "REFERRAL",
    "ENFORCEMENT_ACTION",
    "ADMINISTRATIVE_PROCESSING",
    "OTHER",
  ]),
  related_request_ids: z.array(idSchema),
  material_satisfaction: materialSatisfactionStatusSchema,
  duration: z.string().min(1).optional(),
  scope: z.string().min(1),
  conditions: z.array(z.string().min(1)).default([]),
  evidence_ids: z.array(idSchema).default([]),
  unresolved_remainder: z.array(z.string().min(1)).default([]),
  legal_effect_inferred: z.literal(false),
  provenance: provenanceSchema,
  procedural_context: proceduralContextSchema.optional(),
});
export type ActionAnalysis = z.infer<typeof actionAnalysisSchema>;

export const decisionAnalysisSchema = z.object({
  decision_id: idSchema,
  requests_before_authority: z.array(idSchema),
  issues_considered: z.array(idSchema),
  issues_not_considered: z.array(idSchema),
  factual_finding_ids: z.array(idSchema),
  legal_finding_ids: z.array(idSchema),
  reasoning: z.string().min(1).optional(),
  operative_part: z.string().min(1).optional(),
  remedies_granted: z.array(z.string().min(1)),
  remedies_denied: z.array(z.string().min(1)),
  matters_left_open: z.array(z.string().min(1)),
  appeal_information: z.string().min(1).optional(),
  request_relations: z.array(
    z.object({
      request_id: idSchema,
      relation: z.enum([
        "FULLY_DECIDES",
        "PARTIALLY_DECIDES",
        "DOES_NOT_DECIDE",
        "ACCEPTS",
        "REJECTS",
        "LEAVES_OPEN",
        "REFRAMES_REQUEST",
        "DECIDES_DIFFERENT_OBJECT",
      ]),
      explanation: z.string().min(1),
    }),
  ),
  provenance: provenanceSchema,
  procedural_context: proceduralContextSchema.optional(),
});
export type DecisionAnalysis = z.infer<typeof decisionAnalysisSchema>;

export const requestDispositionMapSchema = z.object({
  view_type: z.literal("REQUEST_DISPOSITION_MAP"),
  source_of_truth: z.literal(false),
  request_id: idSchema,
  responses: z.array(responseAnalysisSchema),
  actions: z.array(actionAnalysisSchema),
  decisions: z.array(decisionAnalysisSchema),
  material_satisfaction: materialSatisfactionStatusSchema,
  procedural_decision_status: proceduralDecisionStatusSchema,
  unresolved_components: z.array(z.string().min(1)),
  recharacterization: z.string().min(1).optional(),
  contradictions_or_tensions: z.array(z.string().min(1)),
  evidentiary_support_ids: z.array(idSchema),
  timeline_event_ids: z.array(idSchema),
});
export type RequestDispositionMap = z.infer<typeof requestDispositionMapSchema>;

export const requestedButNotDecidedAnalysisSchema = z.object({
  status: z.enum(["REQUESTED_BUT_NOT_DECIDED", "POSSIBLY_UNDECIDED", "REQUIRES_SCOPE_ANALYSIS"]),
  request_id: idSchema,
  decision_id: idSchema.optional(),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type RequestedButNotDecidedAnalysis = z.infer<typeof requestedButNotDecidedAnalysisSchema>;

export const decidedWithoutRequestAnalysisSchema = z.object({
  status: z.enum(["DECIDED_WITHOUT_IDENTIFIED_REQUEST", "LINKED_REQUEST_IDENTIFIED", "UNKNOWN"]),
  decision_id: idSchema,
  permissibility_not_assessed: z.literal(true),
  explanation: z.string().min(1),
  provenance: provenanceSchema,
});
export type DecidedWithoutRequestAnalysis = z.infer<typeof decidedWithoutRequestAnalysisSchema>;

export const chronologyMapSchema = z.object({
  view_type: z.literal("CHRONOLOGY_MAP"),
  source_of_truth: z.literal(false),
  ordered_events: z.array(chronologyEventSchema),
  uncertain_event_ids: z.array(idSchema),
  request_event_ids: z.array(idSchema),
  response_event_ids: z.array(idSchema),
  action_event_ids: z.array(idSchema),
  decision_event_ids: z.array(idSchema),
  evidence_event_ids: z.array(idSchema),
  unresolved_gaps: z.array(z.string().min(1)),
  contradictions: z.array(z.string().min(1)),
  procedural_contexts: z.array(proceduralContextSchema),
});
export type ChronologyMap = z.infer<typeof chronologyMapSchema>;

export function createChronologyEvent(input: ChronologyEvent): ChronologyEvent {
  return chronologyEventSchema.parse(input);
}

export function createChronologyRelationship(
  input: ChronologyRelationship,
): ChronologyRelationship {
  return chronologyRelationshipSchema.parse(input);
}

export function analyzeRequest(input: {
  readonly request: Request;
  readonly addresseeActorId?: string;
  readonly requestedRelief?: string;
  readonly requestedLegalBasis?: string;
  readonly urgency?: RequestAnalysis["urgency"];
  readonly lineageRootRequestId?: string;
  readonly amendmentType?: RequestAmendmentType;
  readonly withdrawn?: boolean;
  readonly supersededByRequestId?: string;
}): RequestAnalysis {
  return requestAnalysisSchema.parse({
    request_id: input.request.id,
    requester_actor_id: input.request.actor_id,
    addressee_actor_id: input.addresseeActorId,
    request_date: input.request.procedural_context?.date,
    requested_object: input.request.requested_object,
    requested_relief: input.requestedRelief,
    requested_legal_basis: input.requestedLegalBasis,
    urgency: input.urgency ?? "UNKNOWN",
    procedural_context: input.request.procedural_context,
    provenance: input.request.provenance,
    lineage_root_request_id: input.lineageRootRequestId ?? input.request.id,
    amendment_type: input.amendmentType,
    withdrawn: input.withdrawn ?? false,
    superseded_by_request_id: input.supersededByRequestId,
  });
}

export function analyzeResponse(input: {
  readonly response: Response;
  readonly responseType: ResponseAnalysis["response_type"];
  readonly linkedRequestIds: readonly string[];
}): ResponseAnalysis {
  return responseAnalysisSchema.parse({
    response_id: input.response.id,
    response_type: input.responseType,
    linked_request_ids: [...input.linkedRequestIds],
    decides_request: false,
    explanation:
      input.responseType === "PROMISE_TO_DECIDE"
        ? "A promise to decide is linked to the request but is not a decision."
        : "A response remains analytically separate from a decision.",
    procedural_context: input.response.procedural_context,
    provenance: input.response.provenance,
  });
}

export function analyzeAction(input: {
  readonly action: Action;
  readonly actionType: ActionAnalysis["action_type"];
  readonly relatedRequestIds: readonly string[];
  readonly materialSatisfaction: MaterialSatisfactionStatus;
  readonly scope: string;
  readonly evidenceIds?: readonly string[];
  readonly unresolvedRemainder?: readonly string[];
  readonly duration?: string;
  readonly conditions?: readonly string[];
}): ActionAnalysis {
  return actionAnalysisSchema.parse({
    action_id: input.action.id,
    action_type: input.actionType,
    related_request_ids: [...input.relatedRequestIds],
    material_satisfaction: input.materialSatisfaction,
    duration: input.duration,
    scope: input.scope,
    conditions: [...(input.conditions ?? [])],
    evidence_ids: [...(input.evidenceIds ?? [])],
    unresolved_remainder: [...(input.unresolvedRemainder ?? [])],
    legal_effect_inferred: false,
    provenance: input.action.provenance,
    procedural_context: input.action.procedural_context,
  });
}

export function analyzeDecision(input: {
  readonly decision: Decision;
  readonly requestsBeforeAuthority: readonly string[];
  readonly issuesConsidered?: readonly string[];
  readonly issuesNotConsidered?: readonly string[];
  readonly factualFindingIds?: readonly string[];
  readonly legalFindingIds?: readonly string[];
  readonly reasoning?: string;
  readonly operativePart?: string;
  readonly remediesGranted?: readonly string[];
  readonly remediesDenied?: readonly string[];
  readonly mattersLeftOpen?: readonly string[];
  readonly appealInformation?: string;
  readonly requestRelations: readonly DecisionAnalysis["request_relations"][number][];
}): DecisionAnalysis {
  return decisionAnalysisSchema.parse({
    decision_id: input.decision.id,
    requests_before_authority: [...input.requestsBeforeAuthority],
    issues_considered: [...(input.issuesConsidered ?? [])],
    issues_not_considered: [...(input.issuesNotConsidered ?? [])],
    factual_finding_ids: [...(input.factualFindingIds ?? [])],
    legal_finding_ids: [...(input.legalFindingIds ?? [])],
    reasoning: input.reasoning,
    operative_part: input.operativePart,
    remedies_granted: [...(input.remediesGranted ?? [])],
    remedies_denied: [...(input.remediesDenied ?? [])],
    matters_left_open: [...(input.mattersLeftOpen ?? [])],
    appeal_information: input.appealInformation,
    request_relations: [...input.requestRelations],
    provenance: input.decision.provenance,
    procedural_context: input.decision.procedural_context,
  });
}

export function buildRequestDispositionMap(input: {
  readonly request: RequestAnalysis;
  readonly responses?: readonly ResponseAnalysis[];
  readonly actions?: readonly ActionAnalysis[];
  readonly decisions?: readonly DecisionAnalysis[];
  readonly timelineEventIds?: readonly string[];
  readonly evidentiarySupportIds?: readonly string[];
}): RequestDispositionMap {
  const actions = [...(input.actions ?? [])];
  const decisions = [...(input.decisions ?? [])];
  const material = mergeMaterialSatisfaction(actions.map((item) => item.material_satisfaction));
  const procedural = mergeDecisionStatus(
    decisions.flatMap((decision) =>
      decision.request_relations
        .filter((relation) => relation.request_id === input.request.request_id)
        .map((relation) => relation.relation),
    ),
  );

  return requestDispositionMapSchema.parse({
    view_type: "REQUEST_DISPOSITION_MAP",
    source_of_truth: false,
    request_id: input.request.request_id,
    responses: [...(input.responses ?? [])],
    actions,
    decisions,
    material_satisfaction: material,
    procedural_decision_status: procedural,
    unresolved_components: [
      ...actions.flatMap((item) => item.unresolved_remainder),
      ...(procedural === "NOT_DECIDED" ? ["No decision covers the request scope."] : []),
      ...(procedural === "PARTIALLY_DECIDED"
        ? ["At least one request component remains open."]
        : []),
    ],
    recharacterization: decisions
      .flatMap((decision) => decision.request_relations)
      .find((relation) => relation.relation === "REFRAMES_REQUEST")?.explanation,
    contradictions_or_tensions:
      procedural === "NOT_DECIDED" && material !== "NOT_SATISFIED"
        ? ["Material action and procedural decision status diverge."]
        : [],
    evidentiary_support_ids: [...(input.evidentiarySupportIds ?? [])],
    timeline_event_ids: [...(input.timelineEventIds ?? [])],
  });
}

export function analyzeRequestClarification(input: {
  readonly original: RequestAnalysis;
  readonly later: Request;
  readonly amendmentType: RequestAmendmentType;
}): RequestAnalysis {
  return analyzeRequest({
    request: input.later,
    lineageRootRequestId: input.original.lineage_root_request_id,
    amendmentType: input.amendmentType,
    withdrawn: input.amendmentType === "WITHDRAWAL",
  });
}

export function analyzeRecharacterization(input: {
  readonly sourceObjectId: string;
  readonly targetCharacterizationId?: string;
  readonly sameScope: boolean;
  readonly legalReframe: boolean;
  readonly factualReframe: boolean;
  readonly provenance: readonly ProvenanceRef[];
}): {
  readonly status:
    | "CONSISTENT_CHARACTERIZATION"
    | "LEGAL_RECHARACTERIZATION"
    | "FACTUAL_RECHARACTERIZATION"
    | "SCOPE_REFRAMING"
    | "POSSIBLE_MISCHARACTERIZATION"
    | "UNKNOWN";
  readonly linked_legal_characterization_id?: string;
  readonly source_object_id: string;
  readonly provenance: readonly ProvenanceRef[];
} {
  provenanceSchema.parse(input.provenance);
  const status = !input.sameScope
    ? "SCOPE_REFRAMING"
    : input.legalReframe
      ? "LEGAL_RECHARACTERIZATION"
      : input.factualReframe
        ? "FACTUAL_RECHARACTERIZATION"
        : input.targetCharacterizationId
          ? "CONSISTENT_CHARACTERIZATION"
          : "UNKNOWN";
  return {
    status,
    linked_legal_characterization_id: input.targetCharacterizationId,
    source_object_id: input.sourceObjectId,
    provenance: input.provenance,
  };
}

export function detectRequestedButNotDecided(input: {
  readonly request: RequestAnalysis;
  readonly decision?: DecisionAnalysis;
  readonly requestScopeClear: boolean;
  readonly decisionScopeClear: boolean;
  readonly provenance: readonly ProvenanceRef[];
}): RequestedButNotDecidedAnalysis {
  const relation = input.decision?.request_relations.find(
    (item) => item.request_id === input.request.request_id,
  );
  const status =
    !input.requestScopeClear || !input.decisionScopeClear
      ? "REQUIRES_SCOPE_ANALYSIS"
      : relation === undefined || relation.relation === "DOES_NOT_DECIDE"
        ? "REQUESTED_BUT_NOT_DECIDED"
        : relation.relation === "PARTIALLY_DECIDES" || relation.relation === "LEAVES_OPEN"
          ? "POSSIBLY_UNDECIDED"
          : "REQUIRES_SCOPE_ANALYSIS";

  return requestedButNotDecidedAnalysisSchema.parse({
    status,
    request_id: input.request.request_id,
    decision_id: input.decision?.decision_id,
    explanation:
      status === "REQUESTED_BUT_NOT_DECIDED"
        ? "The request exists, scope is clear, and the decision does not cover it."
        : "The record requires scope analysis before stronger conclusion.",
    provenance: input.provenance,
  });
}

export function detectDecidedWithoutRequest(input: {
  readonly decision: DecisionAnalysis;
  readonly knownRequestIds: readonly string[];
  readonly provenance: readonly ProvenanceRef[];
}): DecidedWithoutRequestAnalysis {
  const decisionRequestIds = new Set(input.decision.requests_before_authority);
  const hasLinkedRequest = input.knownRequestIds.some((id) => decisionRequestIds.has(id));
  return decidedWithoutRequestAnalysisSchema.parse({
    status: hasLinkedRequest ? "LINKED_REQUEST_IDENTIFIED" : "DECIDED_WITHOUT_IDENTIFIED_REQUEST",
    decision_id: input.decision.decision_id,
    permissibility_not_assessed: true,
    explanation: hasLinkedRequest
      ? "A linked request is identified."
      : "No request is identified; ex officio powers or linked issues still require legal analysis.",
    provenance: input.provenance,
  });
}

export function analyzeReasoningOperativeMismatch(input: {
  readonly reasoningIssues: readonly string[];
  readonly operativeIssues: readonly string[];
}):
  | "CONSISTENT"
  | "PARTIAL_SCOPE_MISMATCH"
  | "REASONING_BROADER_THAN_OPERATIVE"
  | "OPERATIVE_BROADER_THAN_REASONING"
  | "MATERIAL_MISMATCH"
  | "UNKNOWN" {
  if (input.reasoningIssues.length === 0 || input.operativeIssues.length === 0) return "UNKNOWN";
  const reasoning = new Set(input.reasoningIssues);
  const operative = new Set(input.operativeIssues);
  const reasoningOnly = [...reasoning].filter((item) => !operative.has(item));
  const operativeOnly = [...operative].filter((item) => !reasoning.has(item));
  if (reasoningOnly.length === 0 && operativeOnly.length === 0) return "CONSISTENT";
  if (reasoningOnly.length > 0 && operativeOnly.length === 0)
    return "REASONING_BROADER_THAN_OPERATIVE";
  if (operativeOnly.length > 0 && reasoningOnly.length === 0)
    return "OPERATIVE_BROADER_THAN_REASONING";
  return "PARTIAL_SCOPE_MISMATCH";
}

export function buildPositionTimeline(input: {
  readonly actorId: string;
  readonly positions: readonly PartyPosition[];
}): {
  readonly actor_id: string;
  readonly entries: readonly PartyPosition[];
  readonly status:
    | "CONSISTENT_POSITION"
    | "CLARIFICATION"
    | "DEVELOPMENT"
    | "SCOPE_CHANGE"
    | "LEGAL_RECHARACTERIZATION"
    | "FACTUAL_POSITION_CHANGE"
    | "POST_HOC_JUSTIFICATION"
    | "MATERIAL_INCONSISTENCY"
    | "DIRECT_CONTRADICTION"
    | "REQUIRES_EXPLANATION";
} {
  const entries = [...input.positions]
    .filter((item) => item.actor_id === input.actorId)
    .sort(compareByProceduralDate);
  const assertionSets = entries.map((item) => item.assertion_ids.join("|"));
  const status =
    new Set(assertionSets).size <= 1
      ? "CONSISTENT_POSITION"
      : entries.length > 1
        ? "DEVELOPMENT"
        : "REQUIRES_EXPLANATION";
  return { actor_id: input.actorId, entries, status };
}

export function analyzeChronologyContradiction(input: {
  readonly earlier?: ChronologyEvent;
  readonly later?: ChronologyEvent;
  readonly expectedOrder?: TemporalRelationship;
}):
  | "TEMPORAL_INCONSISTENCY"
  | "TEMPORAL_TENSION"
  | "LATE_DOCUMENTATION"
  | "REQUIRES_CLARIFICATION"
  | "NO_ISSUE" {
  if (!input.earlier || !input.later) return "REQUIRES_CLARIFICATION";
  const first = eventComparableDate(input.earlier);
  const second = eventComparableDate(input.later);
  if (!first || !second) return "REQUIRES_CLARIFICATION";
  if (input.expectedOrder === "BEFORE" && first > second) return "TEMPORAL_INCONSISTENCY";
  if (
    input.earlier.event_type === "RESPONSE_EVENT" &&
    input.later.event_type === "REQUEST_EVENT" &&
    first < second
  )
    return "TEMPORAL_INCONSISTENCY";
  return "NO_ISSUE";
}

export function analyzeContemporaneousLaterRecord(input: {
  readonly contemporaneousEvidence: Evidence;
  readonly laterAssertionId: string;
  readonly conflict: boolean;
  readonly corroborated: boolean;
  readonly provenance: readonly ProvenanceRef[];
}):
  | "REQUIRES_RECONCILIATION"
  | "CONTEMPORANEOUS_RECORD_STRONGLY_SUPPORTIVE"
  | "LATER_ACCOUNT_SUPPORTED"
  | "CONFLICT_UNRESOLVED" {
  provenanceSchema.parse(input.provenance);
  if (input.conflict) return input.corroborated ? "REQUIRES_RECONCILIATION" : "CONFLICT_UNRESOLVED";
  if (input.contemporaneousEvidence.source_status === "FULL_TEXT_VERIFIED_OFFICIAL")
    return "CONTEMPORANEOUS_RECORD_STRONGLY_SUPPORTIVE";
  return "LATER_ACCOUNT_SUPPORTED";
}

export function buildKnowledgeTimeline(input: {
  readonly events: readonly ChronologyEvent[];
  readonly evidence: readonly Evidence[];
  readonly assertions: readonly string[];
  readonly atDate: string;
}): {
  readonly at_date: string;
  readonly known_evidence_ids: readonly string[];
  readonly unknown_evidence_ids: readonly string[];
  readonly assertion_ids: readonly string[];
  readonly no_hindsight: true;
} {
  const knownObjectIds = new Set(
    input.events
      .filter((event) => {
        const date = eventComparableDate(event);
        return date !== null && date <= input.atDate;
      })
      .flatMap((event) => event.object_ids),
  );
  return {
    at_date: input.atDate,
    known_evidence_ids: input.evidence
      .filter((item) => knownObjectIds.has(item.id))
      .map((item) => item.id),
    unknown_evidence_ids: input.evidence
      .filter((item) => !knownObjectIds.has(item.id))
      .map((item) => item.id),
    assertion_ids: input.assertions,
    no_hindsight: true,
  };
}

export function detectDelaySignals(input: {
  readonly request: RequestAnalysis;
  readonly responses: readonly ResponseAnalysis[];
  readonly decisions: readonly DecisionAnalysis[];
  readonly asOfDate: string;
}): readonly (
  | "REQUEST_PENDING"
  | "RESPONSE_PENDING"
  | "DECISION_PENDING"
  | "DELAY_DURATION"
  | "PROMISE_TO_DECIDE"
  | "FOLLOW_UP_REQUEST"
  | "NO_RESPONSE_IDENTIFIED"
)[] {
  const signals = new Set<
    | "REQUEST_PENDING"
    | "RESPONSE_PENDING"
    | "DECISION_PENDING"
    | "DELAY_DURATION"
    | "PROMISE_TO_DECIDE"
    | "FOLLOW_UP_REQUEST"
    | "NO_RESPONSE_IDENTIFIED"
  >(["REQUEST_PENDING"]);
  if (input.responses.length === 0) signals.add("NO_RESPONSE_IDENTIFIED");
  if (input.responses.some((item) => item.response_type === "PROMISE_TO_DECIDE"))
    signals.add("PROMISE_TO_DECIDE");
  if (
    !input.decisions.some((decision) =>
      decision.request_relations.some(
        (relation) => relation.request_id === input.request.request_id,
      ),
    )
  )
    signals.add("DECISION_PENDING");
  if (input.request.request_date && input.request.request_date < input.asOfDate)
    signals.add("DELAY_DURATION");
  return [...signals];
}

export function buildChronologyMap(input: {
  readonly events: readonly ChronologyEvent[];
  readonly contradictions?: readonly string[];
  readonly unresolvedGaps?: readonly string[];
}): ChronologyMap {
  const ordered = [...input.events].sort(compareEvents);
  return chronologyMapSchema.parse({
    view_type: "CHRONOLOGY_MAP",
    source_of_truth: false,
    ordered_events: ordered,
    uncertain_event_ids: ordered
      .filter((event) => !["EXACT_DATE", "EXACT_DATETIME"].includes(event.temporal_precision))
      .map((event) => event.event_id),
    request_event_ids: ordered
      .filter((event) => event.event_type === "REQUEST_EVENT")
      .map((event) => event.event_id),
    response_event_ids: ordered
      .filter((event) => event.event_type === "RESPONSE_EVENT")
      .map((event) => event.event_id),
    action_event_ids: ordered
      .filter((event) => event.event_type === "ACTION_EVENT")
      .map((event) => event.event_id),
    decision_event_ids: ordered
      .filter((event) => event.event_type === "DECISION_EVENT")
      .map((event) => event.event_id),
    evidence_event_ids: ordered
      .filter((event) => event.event_type === "EVIDENCE_EVENT")
      .map((event) => event.event_id),
    unresolved_gaps: [...(input.unresolvedGaps ?? [])],
    contradictions: [...(input.contradictions ?? [])],
    procedural_contexts: ordered
      .map((event) => event.procedural_context)
      .filter((context): context is ProceduralContext => context !== undefined),
  });
}

export function protectHumanLockedChronologyValue(input: {
  readonly objectId: string;
  readonly reviewedState?: ReviewState;
  readonly contradictoryExtraction: boolean;
}): { readonly status: "ACCEPT" | "REVIEW_REQUIRED"; readonly overwriteAllowed: boolean } {
  return evaluateHumanLockConflict({
    existing: { id: input.objectId, reviewed_state: input.reviewedState },
    incomingContradictsExisting: input.contradictoryExtraction,
  });
}

function mergeMaterialSatisfaction(
  statuses: readonly MaterialSatisfactionStatus[],
): MaterialSatisfactionStatus {
  if (statuses.length === 0) return "UNKNOWN";
  if (statuses.includes("FULLY_SATISFIED")) return "FULLY_SATISFIED";
  if (statuses.includes("PARTIALLY_SATISFIED")) return "PARTIALLY_SATISFIED";
  if (statuses.every((status) => status === "NOT_SATISFIED")) return "NOT_SATISFIED";
  return "UNKNOWN";
}

function mergeDecisionStatus(
  relations: readonly DecisionAnalysis["request_relations"][number]["relation"][],
): ProceduralDecisionStatus {
  if (relations.length === 0 || relations.every((relation) => relation === "DOES_NOT_DECIDE"))
    return "NOT_DECIDED";
  if (
    relations.some(
      (relation) =>
        relation === "FULLY_DECIDES" || relation === "ACCEPTS" || relation === "REJECTS",
    )
  )
    return "FULLY_DECIDED";
  if (relations.some((relation) => relation === "PARTIALLY_DECIDES" || relation === "LEAVES_OPEN"))
    return "PARTIALLY_DECIDED";
  return "UNKNOWN";
}

function compareByProceduralDate(
  a: { procedural_context?: ProceduralContext },
  b: { procedural_context?: ProceduralContext },
): number {
  return (a.procedural_context?.date ?? "").localeCompare(b.procedural_context?.date ?? "");
}

function compareEvents(a: ChronologyEvent, b: ChronologyEvent): number {
  return (eventComparableDate(a) ?? "").localeCompare(eventComparableDate(b) ?? "");
}

function eventComparableDate(event: ChronologyEvent): string | null {
  if (event.date_time) return event.date_time.slice(0, 10);
  if (event.date) return event.date;
  if (event.date_range) return event.date_range.from;
  return null;
}
