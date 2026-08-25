import { z } from "zod";

const idSchema = z.string().min(1);

export const provenanceTypeSchema = z.enum([
  "DOCUMENT_PASSAGE",
  "OFFICIAL_SOURCE",
  "PARTY_SUBMISSION",
  "SYSTEM_DERIVATION",
  "HUMAN_REVIEW",
  "EXTERNAL_SOURCE",
  "UNSOURCED",
]);
export type ProvenanceType = z.infer<typeof provenanceTypeSchema>;

export const provenanceRefSchema = z
  .object({
    type: provenanceTypeSchema,
    source_id: idSchema.optional(),
    document_id: idSchema.optional(),
    passage_id: idSchema.optional(),
    official_source_id: idSchema.optional(),
    party_submission_id: idSchema.optional(),
    human_review_id: idSchema.optional(),
    external_source_uri: z.string().url().optional(),
    system_derivation_input_ids: z.array(idSchema).default([]),
    note: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "SYSTEM_DERIVATION" && value.system_derivation_input_ids.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["system_derivation_input_ids"],
        message: "SYSTEM_DERIVATION provenance requires input ids.",
      });
    }
    if (value.type === "UNSOURCED") return;
    const hasSource =
      value.source_id !== undefined ||
      value.document_id !== undefined ||
      value.passage_id !== undefined ||
      value.official_source_id !== undefined ||
      value.party_submission_id !== undefined ||
      value.human_review_id !== undefined ||
      value.external_source_uri !== undefined ||
      value.system_derivation_input_ids.length > 0;
    if (!hasSource) {
      ctx.addIssue({
        code: "custom",
        message: "Sourced provenance requires at least one source reference.",
      });
    }
  });
export type ProvenanceRef = z.infer<typeof provenanceRefSchema>;

const materialProvenanceSchema = z.array(provenanceRefSchema).min(1);

export const proceduralStageSchema = z.enum([
  "PRE_LITIGATION",
  "FIRST_INSTANCE",
  "ADMINISTRATIVE_APPEAL",
  "JUDICIAL_APPEAL",
  "REPLY",
  "DUPLIC",
  "REMAND",
  "ENFORCEMENT",
  "OTHER",
]);
export type ProceduralStage = z.infer<typeof proceduralStageSchema>;

export const proceduralContextSchema = z.object({
  stage: proceduralStageSchema,
  local_stage_label: z.string().min(1).optional(),
  authority_actor_id: idSchema.optional(),
  submission_id: idSchema.optional(),
  decision_id: idSchema.optional(),
  date: z.iso.date().optional(),
  sequence_index: z.number().int().nonnegative().optional(),
  procedural_role: z.string().min(1).optional(),
});
export type ProceduralContext = z.infer<typeof proceduralContextSchema>;

export const confidenceSchema = z.number().min(0).max(1);
export type Confidence = z.infer<typeof confidenceSchema>;

export const sourceStatusSchema = z.enum([
  "FULL_TEXT_VERIFIED_OFFICIAL",
  "OFFICIAL_EXTRACT",
  "METADATA_ONLY",
  "SECONDARY_SOURCE",
  "UNVERIFIED",
]);
export type SourceStatus = z.infer<typeof sourceStatusSchema>;

export const reviewStateSchema = z.object({
  status: z.enum(["UNREVIEWED", "HUMAN_VERIFIED", "HUMAN_LOCKED", "REVIEW_REQUIRED"]),
  locked_by: idSchema.optional(),
  locked_at: z.iso.datetime({ offset: true }).optional(),
  reviewed_at: z.iso.datetime({ offset: true }).optional(),
  note: z.string().min(1).optional(),
});
export type ReviewState = z.infer<typeof reviewStateSchema>;

const baseRecordSchema = z.object({
  id: idSchema,
  matter_id: idSchema,
  created_at: z.iso.datetime({ offset: true }).optional(),
});

const versionedAssessmentSchema = baseRecordSchema.extend({
  supersedes_id: idSchema.optional(),
  procedural_context: proceduralContextSchema.optional(),
  provenance: materialProvenanceSchema,
  confidence: confidenceSchema.optional(),
  reviewed_state: reviewStateSchema.optional(),
});

export const matterSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  jurisdiction: z.string().min(1).optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
});
export type Matter = z.infer<typeof matterSchema>;

export const actorSchema = baseRecordSchema.extend({
  kind: z.literal("Actor"),
  name: z.string().min(1),
  actor_type: z.enum(["PERSON", "AUTHORITY", "COURT", "ORGANIZATION", "SYSTEM", "UNKNOWN"]),
  roles: z.array(z.string().min(1)).default([]),
});
export type Actor = z.infer<typeof actorSchema>;

export const documentSchema = baseRecordSchema.extend({
  kind: z.literal("Document"),
  title: z.string().min(1),
  source_status: sourceStatusSchema,
  source_uri: z.string().url().optional(),
  content_hash: z.string().min(1).optional(),
  provenance: materialProvenanceSchema,
});
export type Document = z.infer<typeof documentSchema>;

export const passageSchema = baseRecordSchema.extend({
  kind: z.literal("Passage"),
  document_id: idSchema,
  locator: z.string().min(1).optional(),
  text: z.string().min(1),
  provenance: materialProvenanceSchema,
});
export type Passage = z.infer<typeof passageSchema>;

export const propositionGranularitySchema = z.enum(["ATOMIC", "COMPOSITE", "SUMMARY"]);
export type PropositionGranularity = z.infer<typeof propositionGranularitySchema>;

export const propositionSchema = baseRecordSchema.extend({
  kind: z.literal("Proposition"),
  text: z.string().min(1),
  parent_proposition_id: idSchema.optional(),
  scope: z.string().min(1),
  temporal_scope: z
    .object({
      from: z.iso.date().optional(),
      until: z.iso.date().optional(),
      label: z.string().min(1).optional(),
    })
    .optional(),
  legal_or_factual_domain: z.enum(["FACTUAL", "LEGAL", "MIXED", "PROCEDURAL"]),
  granularity: propositionGranularitySchema,
  source_passage_ids: z.array(idSchema).default([]),
  provenance: materialProvenanceSchema,
});
export type Proposition = z.infer<typeof propositionSchema>;

export const assertionSchema = baseRecordSchema.extend({
  kind: z.literal("Assertion"),
  actor_id: idSchema,
  proposition_id: idSchema,
  stance: z.enum(["AFFIRMS", "DENIES", "PARTIALLY_ACCEPTS", "DISPUTES", "UNKNOWN"]),
  procedural_context: proceduralContextSchema.optional(),
  provenance: materialProvenanceSchema,
});
export type Assertion = z.infer<typeof assertionSchema>;

export const evidenceSchema = baseRecordSchema.extend({
  kind: z.literal("Evidence"),
  evidence_type: z.enum(["DOCUMENT", "PASSAGE", "TESTIMONY", "OFFICIAL_RECORD", "OTHER"]),
  document_id: idSchema.optional(),
  passage_id: idSchema.optional(),
  source_status: sourceStatusSchema,
  supported_proposition_ids: z.array(idSchema).default([]),
  evidence_use: z.enum(["SUPPORT", "CONTRADICTION", "CONTEXT", "FULL_TEXT_EVIDENCE"]),
  procedural_context: proceduralContextSchema.optional(),
  provenance: materialProvenanceSchema,
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const factualFindingSourceTypeSchema = z.enum([
  "SYSTEM_ASSESSMENT",
  "HUMAN_VERIFIED",
  "ADMINISTRATIVE_AUTHORITY",
  "COURT",
  "OTHER_OFFICIAL_BODY",
]);
export type FactualFindingSourceType = z.infer<typeof factualFindingSourceTypeSchema>;

export const factualFindingStatusSchema = z.enum([
  "ASSERTED_AS_FACT",
  "ASSESSED_AS_PROVEN",
  "PARTIALLY_PROVEN",
  "NOT_PROVEN",
  "DISPUTED",
  "CONTESTED",
  "PROVISIONAL",
  "FINAL",
  "APPEALED",
  "SUPERSEDED",
  "UNKNOWN",
]);
export type FactualFindingStatus = z.infer<typeof factualFindingStatusSchema>;

export const factualFindingSchema = baseRecordSchema.extend({
  kind: z.literal("FactualFinding"),
  proposition_id: idSchema,
  finding_source_type: factualFindingSourceTypeSchema,
  source_actor_id: idSchema.optional(),
  source_document_id: idSchema.optional(),
  date: z.iso.date().optional(),
  procedural_context: proceduralContextSchema.optional(),
  scope: z.string().min(1),
  status: factualFindingStatusSchema,
  provenance: materialProvenanceSchema,
  reviewed_state: reviewStateSchema.optional(),
});
export type FactualFinding = z.infer<typeof factualFindingSchema>;

const proceduralActSchema = baseRecordSchema.extend({
  actor_id: idSchema.optional(),
  proposition_ids: z.array(idSchema).default([]),
  procedural_context: proceduralContextSchema.optional(),
  provenance: materialProvenanceSchema,
});

export const requestSchema = proceduralActSchema.extend({
  kind: z.literal("Request"),
  request_type: z.string().min(1),
  requested_object: z.string().min(1),
});
export type Request = z.infer<typeof requestSchema>;

export const responseSchema = proceduralActSchema.extend({
  kind: z.literal("Response"),
  response_type: z.enum(["ANSWER", "PARTIAL_ANSWER", "REFUSAL", "SILENCE", "OTHER"]),
  responds_to_request_id: idSchema.optional(),
});
export type Response = z.infer<typeof responseSchema>;

export const actionSchema = proceduralActSchema.extend({
  kind: z.literal("Action"),
  action_type: z.string().min(1),
  material_satisfaction: z.enum(["NONE", "PARTIAL", "FULL", "UNKNOWN"]).optional(),
});
export type Action = z.infer<typeof actionSchema>;

export const decisionSchema = proceduralActSchema.extend({
  kind: z.literal("Decision"),
  decision_type: z.string().min(1),
  decides_request_ids: z.array(idSchema).default([]),
  operative_scope: z.string().min(1),
});
export type Decision = z.infer<typeof decisionSchema>;

export const partyPositionSchema = baseRecordSchema.extend({
  kind: z.literal("PartyPosition"),
  actor_id: idSchema,
  assertion_ids: z.array(idSchema).default([]),
  legal_characterization_ids: z.array(idSchema).default([]),
  procedural_context: proceduralContextSchema,
  provenance: materialProvenanceSchema,
});
export type PartyPosition = z.infer<typeof partyPositionSchema>;

export const issueSchema = baseRecordSchema.extend({
  kind: z.literal("Issue"),
  text: z.string().min(1),
  issue_type: z.enum(["FACTUAL", "LEGAL", "PROCEDURAL", "EVIDENTIARY", "MIXED"]),
  proposition_ids: z.array(idSchema).default([]),
  procedural_context: proceduralContextSchema.optional(),
  provenance: materialProvenanceSchema,
});
export type Issue = z.infer<typeof issueSchema>;

export const claimElementSchema = z.object({
  id: idSchema,
  proposition_id: idSchema,
  status: z.enum(["SATISFIED", "NOT_SATISFIED", "DISPUTED", "UNKNOWN"]),
  provenance: materialProvenanceSchema,
});
export type ClaimElement = z.infer<typeof claimElementSchema>;

export const remedySchema = z.object({
  remedy_type: z.string().min(1),
  requested_text: z.string().min(1),
  status: z.enum(["MAIN", "EVENTUAL", "SUBEVENTUAL", "WITHDRAWN", "UNKNOWN"]),
  provenance: materialProvenanceSchema,
});
export type Remedy = z.infer<typeof remedySchema>;

export const claimSchema = baseRecordSchema.extend({
  kind: z.literal("Claim"),
  claimant_actor_id: idSchema,
  issue_ids: z.array(idSchema).default([]),
  elements: z.array(claimElementSchema).default([]),
  remedies: z.array(remedySchema).default([]),
  procedural_context: proceduralContextSchema.optional(),
  provenance: materialProvenanceSchema,
});
export type Claim = z.infer<typeof claimSchema>;

export const legalAuthoritySchema = baseRecordSchema.extend({
  kind: z.literal("LegalAuthority"),
  authority_type: z.enum(["STATUTE", "REGULATION", "CASE_LAW", "ADMINISTRATIVE_GUIDANCE", "OTHER"]),
  citation: z.string().min(1),
  official_source_uri: z.string().url().optional(),
  source_status: sourceStatusSchema,
  provenance: materialProvenanceSchema,
});
export type LegalAuthority = z.infer<typeof legalAuthoritySchema>;

export const legalPropositionSchema = baseRecordSchema.extend({
  kind: z.literal("LegalProposition"),
  legal_authority_id: idSchema,
  locator: z
    .object({
      article: z.string().min(1).optional(),
      considerandum: z.string().min(1).optional(),
      paragraph: z.string().min(1).optional(),
      page: z.string().min(1).optional(),
      note: z.string().min(1).optional(),
    })
    .optional(),
  text: z.string().min(1),
  scope: z.string().min(1).optional(),
  provenance: materialProvenanceSchema,
});
export type LegalProposition = z.infer<typeof legalPropositionSchema>;

export const argumentSchema = baseRecordSchema.extend({
  kind: z.literal("Argument"),
  conclusion_proposition_id: idSchema.optional(),
  relied_proposition_ids: z.array(idSchema).default([]),
  relied_legal_proposition_ids: z.array(idSchema).default([]),
  text: z.string().min(1),
  procedural_context: proceduralContextSchema.optional(),
  provenance: materialProvenanceSchema,
});
export type Argument = z.infer<typeof argumentSchema>;

export const humanReviewRecordSchema = baseRecordSchema.extend({
  kind: z.literal("HumanReviewRecord"),
  reviewer_actor_id: idSchema,
  reviewed_object_id: idSchema,
  reviewed_object_kind: z.string().min(1),
  decision: z.enum(["VERIFIED", "REJECTED", "LOCKED", "REVIEW_REQUIRED"]),
  procedural_context: proceduralContextSchema.optional(),
  provenance: materialProvenanceSchema,
});
export type HumanReviewRecord = z.infer<typeof humanReviewRecordSchema>;

export const burdenAssessmentSchema = versionedAssessmentSchema.extend({
  kind: z.literal("BurdenAssessment"),
  issue_id: idSchema,
  proposition_id: idSchema,
  burden_type: z.enum([
    "BURDEN_OF_ALLEGATION",
    "BURDEN_OF_PROOF",
    "BURDEN_OF_SUBSTANTIATION",
    "COOPERATION_DUTY",
    "OFFICIAL_INVESTIGATION_DUTY",
    "DOCUMENT_PRODUCTION_DUTY",
    "UNKNOWN",
    "NOT_APPLICABLE",
    "TO_BE_DETERMINED",
  ]),
  bearer_actor_id: idSchema.optional(),
  bearer_status: z.enum(["KNOWN", "UNKNOWN", "NOT_APPLICABLE", "TO_BE_DETERMINED"]),
  legal_basis: z.string().min(1).optional(),
  standard: z.string().min(1).optional(),
  consequence_of_failure: z.string().min(1).optional(),
  status: z.enum(["ASSESSED", "UNKNOWN", "NOT_APPLICABLE", "TO_BE_DETERMINED", "DISPUTED"]),
});
export type BurdenAssessment = z.infer<typeof burdenAssessmentSchema>;

export const evidenceControlAssessmentSchema = versionedAssessmentSchema.extend({
  kind: z.literal("EvidenceControlAssessment"),
  actor_id: idSchema,
  evidence_id: idSchema.optional(),
  document_id: idSchema.optional(),
  proposition_id: idSchema.optional(),
  control_type: z.enum([
    "PHYSICAL_POSSESSION",
    "LEGAL_CUSTODY",
    "ADMINISTRATIVE_FILE_CONTROL",
    "EXCLUSIVE_PRACTICAL_CONTROL",
    "SHARED_CONTROL",
    "LIKELY_CONTROL",
    "UNKNOWN",
  ]),
  controlled_from: z.iso.date().optional(),
  controlled_until: z.iso.date().optional(),
  basis: z.string().min(1),
  requested_status: z.enum(["REQUESTED", "NOT_REQUESTED", "UNKNOWN"]),
  production_status: z.enum(["PRODUCED", "PARTIALLY_PRODUCED", "NOT_PRODUCED", "UNKNOWN"]),
  pending_status: z.enum(["PENDING", "NOT_PENDING", "DISPUTED", "UNKNOWN"]),
});
export type EvidenceControlAssessment = z.infer<typeof evidenceControlAssessmentSchema>;

export const legalCharacterizationSchema = versionedAssessmentSchema.extend({
  kind: z.literal("LegalCharacterization"),
  author_type: z.enum(["ACTOR", "SYSTEM", "HUMAN"]),
  author_actor_id: idSchema.optional(),
  source_id: idSchema.optional(),
  target_proposition_ids: z.array(idSchema).default([]),
  target_finding_ids: z.array(idSchema).default([]),
  relied_legal_proposition_ids: z.array(idSchema).default([]),
  conclusion: z.string().min(1),
  characterization_type: z.string().min(1),
  status: z.enum(["ASSERTED", "SYSTEM_ASSESSED", "HUMAN_VERIFIED", "COURT_DETERMINED", "DISPUTED"]),
});
export type LegalCharacterization = z.infer<typeof legalCharacterizationSchema>;

export const evidentiaryAssessmentSchema = versionedAssessmentSchema.extend({
  kind: z.literal("EvidentiaryAssessment"),
  evidence_id: idSchema,
  proposition_id: idSchema,
  assessment: z.enum(["SUPPORTS", "CONTRADICTS", "PARTIAL", "INSUFFICIENT", "UNKNOWN"]),
});
export type EvidentiaryAssessment = z.infer<typeof evidentiaryAssessmentSchema>;

export const precedentApplicationSchema = versionedAssessmentSchema
  .extend({
    kind: z.literal("PrecedentApplication"),
    legal_authority_id: idSchema,
    issue_id: idSchema,
    application: z.enum([
      "STRONGLY_SUPPORTIVE",
      "SUPPORTIVE",
      "FAVORABLE",
      "MIXED",
      "DISTINGUISHABLE",
      "LIMITED",
      "ADVERSE",
      "STRONGLY_ADVERSE",
      "UNKNOWN",
    ]),
    favorable_aspects: z.array(z.string().min(1)).default([]),
    adverse_aspects: z.array(z.string().min(1)).default([]),
    ratio_respected: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (
      value.application === "MIXED" &&
      (value.favorable_aspects.length === 0 || value.adverse_aspects.length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["application"],
        message: "MIXED precedent application requires favorable and adverse aspects.",
      });
    }
  });
export type PrecedentApplication = z.infer<typeof precedentApplicationSchema>;

export const significantDocumentaryAbsenceSchema = versionedAssessmentSchema.extend({
  kind: z.literal("SignificantDocumentaryAbsence"),
  expected_document_description: z.string().min(1),
  expected_controller_actor_id: idSchema.optional(),
  proposition_id: idSchema.optional(),
  status: z.enum(["ABSENCE_OBSERVED", "REQUEST_PENDING", "EXPLAINED", "UNKNOWN"]),
});
export type SignificantDocumentaryAbsence = z.infer<typeof significantDocumentaryAbsenceSchema>;

export const contradictionAssessmentSchema = versionedAssessmentSchema.extend({
  kind: z.literal("ContradictionAssessment"),
  object_ids: z.array(idSchema).min(2),
  contradiction_type: z.enum(["DIRECT", "PARTIAL", "TEMPORAL", "APPARENT", "UNKNOWN"]),
});
export type ContradictionAssessment = z.infer<typeof contradictionAssessmentSchema>;

export const positionChangeAssessmentSchema = versionedAssessmentSchema.extend({
  kind: z.literal("PositionChangeAssessment"),
  actor_id: idSchema,
  earlier_object_id: idSchema,
  later_object_id: idSchema,
  change_type: z.enum(["REVERSAL", "LIMITATION", "EXPANSION", "CLARIFICATION", "UNKNOWN"]),
});
export type PositionChangeAssessment = z.infer<typeof positionChangeAssessmentSchema>;

export const traceRelationSchema = z.enum([
  "supports",
  "contradicts",
  "characterizes",
  "derives_from",
  "relies_on",
  "responds_to",
  "decides",
  "requests",
  "produces",
  "controls",
  "supersedes",
]);
export type TraceRelation = z.infer<typeof traceRelationSchema>;

export const traceLinkSchema = z.object({
  id: idSchema,
  matter_id: idSchema,
  from_id: idSchema,
  to_id: idSchema,
  relation: traceRelationSchema,
  provenance: materialProvenanceSchema,
});
export type TraceLink = z.infer<typeof traceLinkSchema>;

export const matterModelSchema = z
  .object({
    matter: matterSchema,
    actors: z.array(actorSchema).default([]),
    documents: z.array(documentSchema).default([]),
    passages: z.array(passageSchema).default([]),
    propositions: z.array(propositionSchema).default([]),
    assertions: z.array(assertionSchema).default([]),
    evidence: z.array(evidenceSchema).default([]),
    factual_findings: z.array(factualFindingSchema).default([]),
    requests: z.array(requestSchema).default([]),
    responses: z.array(responseSchema).default([]),
    actions: z.array(actionSchema).default([]),
    decisions: z.array(decisionSchema).default([]),
    party_positions: z.array(partyPositionSchema).default([]),
    issues: z.array(issueSchema).default([]),
    claims: z.array(claimSchema).default([]),
    legal_authorities: z.array(legalAuthoritySchema).default([]),
    legal_propositions: z.array(legalPropositionSchema).default([]),
    arguments: z.array(argumentSchema).default([]),
    human_review_records: z.array(humanReviewRecordSchema).default([]),
    evidentiary_assessments: z.array(evidentiaryAssessmentSchema).default([]),
    burden_assessments: z.array(burdenAssessmentSchema).default([]),
    evidence_control_assessments: z.array(evidenceControlAssessmentSchema).default([]),
    legal_characterizations: z.array(legalCharacterizationSchema).default([]),
    precedent_applications: z.array(precedentApplicationSchema).default([]),
    significant_documentary_absences: z.array(significantDocumentaryAbsenceSchema).default([]),
    contradiction_assessments: z.array(contradictionAssessmentSchema).default([]),
    position_change_assessments: z.array(positionChangeAssessmentSchema).default([]),
    trace_links: z.array(traceLinkSchema).default([]),
  })
  .superRefine((model, ctx) => {
    const propositions = new Map(model.propositions.map((item) => [item.id, item]));
    const documents = new Map(model.documents.map((item) => [item.id, item]));
    const versionedCollections = [
      ["evidentiary_assessments", model.evidentiary_assessments],
      ["burden_assessments", model.burden_assessments],
      ["evidence_control_assessments", model.evidence_control_assessments],
      ["legal_characterizations", model.legal_characterizations],
      ["precedent_applications", model.precedent_applications],
      ["significant_documentary_absences", model.significant_documentary_absences],
      ["contradiction_assessments", model.contradiction_assessments],
      ["position_change_assessments", model.position_change_assessments],
    ] as const;

    for (const item of model.evidence) {
      for (const propositionId of item.supported_proposition_ids) {
        if (propositions.get(propositionId)?.granularity === "SUMMARY") {
          ctx.addIssue({
            code: "custom",
            path: ["evidence", item.id, "supported_proposition_ids"],
            message: "SUMMARY propositions cannot be used as final evidence targets.",
          });
        }
      }
      if (
        item.evidence_use === "FULL_TEXT_EVIDENCE" &&
        item.document_id !== undefined &&
        documents.get(item.document_id)?.source_status === "METADATA_ONLY"
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["evidence", item.id, "document_id"],
          message: "METADATA_ONLY documents cannot be treated as full-text verified evidence.",
        });
      }
    }

    for (const characterization of model.legal_characterizations) {
      if (
        characterization.author_type === "ACTOR" &&
        characterization.status === "SYSTEM_ASSESSED"
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["legal_characterizations", characterization.id, "status"],
          message: "A party legal characterization cannot be marked as a system conclusion.",
        });
      }
    }

    for (const [collectionName, collection] of versionedCollections) {
      const byId = new Map(collection.map((item) => [item.id, item]));
      const ids = new Set(byId.keys());
      for (const item of collection) {
        if (item.supersedes_id === undefined) continue;
        if (item.supersedes_id === item.id) {
          ctx.addIssue({
            code: "custom",
            path: [collectionName, item.id, "supersedes_id"],
            message: "Versioned assessments cannot supersede themselves.",
          });
        }
        if (!ids.has(item.supersedes_id)) {
          ctx.addIssue({
            code: "custom",
            path: [collectionName, item.id, "supersedes_id"],
            message: "supersedes_id must reference an assessment in the same collection.",
          });
        }
        const seen = new Set<string>([item.id]);
        let next: string | undefined = item.supersedes_id;
        while (next !== undefined) {
          if (seen.has(next)) {
            ctx.addIssue({
              code: "custom",
              path: [collectionName, item.id, "supersedes_id"],
              message: "Versioned assessment supersedes chains cannot contain cycles.",
            });
            break;
          }
          seen.add(next);
          next = byId.get(next)?.supersedes_id;
        }
      }
    }
  });
export type MatterModel = z.infer<typeof matterModelSchema>;

export function parseMatterModel(input: unknown): MatterModel {
  return matterModelSchema.parse(input);
}

export function canUsePropositionAsFinalEvidence(proposition: Proposition): boolean {
  return proposition.granularity !== "SUMMARY";
}

export function isCourtFinding(finding: FactualFinding): boolean {
  return finding.finding_source_type === "COURT";
}

export function isSystemFinding(finding: FactualFinding): boolean {
  return finding.finding_source_type === "SYSTEM_ASSESSMENT";
}

export function evaluateHumanLockConflict(input: {
  readonly existing: { readonly id: string; readonly reviewed_state?: ReviewState };
  readonly incomingContradictsExisting: boolean;
}): { readonly status: "ACCEPT" | "REVIEW_REQUIRED"; readonly overwriteAllowed: boolean } {
  if (
    input.existing.reviewed_state?.status === "HUMAN_LOCKED" &&
    input.incomingContradictsExisting
  ) {
    return { status: "REVIEW_REQUIRED", overwriteAllowed: false };
  }
  return { status: "ACCEPT", overwriteAllowed: true };
}

export function findTraceLinks(input: {
  readonly traceLinks: readonly TraceLink[];
  readonly fromId?: string;
  readonly toId?: string;
  readonly relation?: TraceRelation;
}): TraceLink[] {
  return input.traceLinks.filter(
    (link) =>
      (input.fromId === undefined || link.from_id === input.fromId) &&
      (input.toId === undefined || link.to_id === input.toId) &&
      (input.relation === undefined || link.relation === input.relation),
  );
}

export function traceForwardPath(input: {
  readonly startId: string;
  readonly traceLinks: readonly TraceLink[];
}): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const visit = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    result.push(id);
    for (const link of input.traceLinks.filter((item) => item.from_id === id)) {
      visit(link.to_id);
    }
  };
  visit(input.startId);
  return result;
}

export function traceBackwardPath(input: {
  readonly startId: string;
  readonly traceLinks: readonly TraceLink[];
}): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const visit = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    result.push(id);
    for (const link of input.traceLinks.filter((item) => item.to_id === id)) {
      visit(link.from_id);
    }
  };
  visit(input.startId);
  return result;
}

export const traceReversePath = traceForwardPath;
