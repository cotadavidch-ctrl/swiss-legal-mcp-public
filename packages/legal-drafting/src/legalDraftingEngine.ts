import { z } from "zod";
import { confidenceSchema, provenanceRefSchema, type ProvenanceRef } from "@swiss-legal-mcp/core";
import type { RequestDispositionMap } from "@swiss-legal-mcp/chronology";
import type { ContradictionAssessmentResult } from "@swiss-legal-mcp/contradiction-engine";
import type {
  EnhancedLegalProposition,
  IssueLawMap,
  PrecedentApplicationAnalysis,
} from "@swiss-legal-mcp/legal-intelligence";
import type {
  ArgumentRemovalTest,
  BestOpponentArgument,
  BestReply,
  BestWinningTheory,
  JudicialCredibilityProfile,
  JudicialDecisionPath,
  MinimumWinningCase,
} from "@swiss-legal-mcp/litigation-intelligence";
import type {
  MinimumRequestSet,
  ProceduralRequest,
  ProceduralStrategy,
  RequestOptimization,
} from "@swiss-legal-mcp/procedural-intelligence";

const idSchema = z.string().min(1);
const provenanceSchema = z.array(provenanceRefSchema).min(1);

export const draftingModeSchema = z.enum([
  "ANALYTICAL",
  "PROCEDURAL_NEUTRAL",
  "LITIGATION_STRONG",
  "JUDICIAL_SUMMARY",
  "CLIENT_EXPLANATION",
]);
export type DraftingMode = z.infer<typeof draftingModeSchema>;

export const audienceSchema = z.enum([
  "COURT",
  "ADMINISTRATIVE_AUTHORITY",
  "OPPOSING_COUNSEL",
  "CLIENT",
]);
export type Audience = z.infer<typeof audienceSchema>;

export const sectionTypeSchema = z.enum([
  "OPENING",
  "PROCEDURAL_CONTEXT",
  "FACTUAL_BACKGROUND",
  "CORE_ISSUES",
  "LEGAL_ANALYSIS",
  "EVIDENCE",
  "CONTRADICTIONS",
  "COUNTERARGUMENT_RESPONSE",
  "PROCEDURAL_REQUESTS",
  "EVIDENTIARY_REQUESTS",
  "REMEDIES",
  "COSTS",
  "CONCLUSION",
]);
export type SectionType = z.infer<typeof sectionTypeSchema>;

export const argumentPrioritySchema = z.enum([
  "DECISIVE",
  "HIGH",
  "SUPPORTING",
  "SUBSIDIARY",
  "RESERVE",
]);
export type ArgumentPriority = z.infer<typeof argumentPrioritySchema>;

export const assertionTypeSchema = z.enum([
  "FACT",
  "INFERENCE",
  "LEGAL_CHARACTERIZATION",
  "ARGUMENT",
]);
export type AssertionType = z.infer<typeof assertionTypeSchema>;

export const draftReadinessSchema = z.enum([
  "NOT_READY",
  "READY_WITH_MATERIAL_REVIEW",
  "READY_WITH_MINOR_REVIEW",
  "READY_FOR_HUMAN_APPROVAL",
]);
export type DraftReadiness = z.infer<typeof draftReadinessSchema>;

export const readinessResultSchema = z.enum([
  "BLOCKING_ISSUES",
  "MATERIAL_ISSUES",
  "MANAGEABLE_ISSUES",
  "DRAFTING_ISSUES",
  "NO_MATERIAL_ISSUE",
]);
export type ReadinessResult = z.infer<typeof readinessResultSchema>;

export const toneFlagSchema = z.enum([
  "ACCUSATORY",
  "OVERSTATED",
  "ABSOLUTE",
  "SPECULATIVE",
  "EMOTIONAL",
  "RHETORICAL",
  "REDUNDANT",
  "LEGALLY_PRECISE",
  "PROCEDURALLY_CALIBRATED",
]);
export type ToneFlag = z.infer<typeof toneFlagSchema>;

export const sentenceIssueSchema = z.object({
  sentence_id: idSchema,
  flags: z
    .array(
      z.enum([
        "OVERLONG_SENTENCE",
        "MULTIPLE_ARGUMENTS_IN_ONE_SENTENCE",
        "UNCLEAR_REFERENT",
        "UNNECESSARY_PASSIVE",
        "UNDEFINED_TERM",
      ]),
    )
    .min(1),
  explanation: z.string().min(1),
  auto_fix_allowed: z.boolean(),
});
export type SentenceIssue = z.infer<typeof sentenceIssueSchema>;

export const humanReviewDecisionSchema = z.enum([
  "NONE",
  "REVIEW_RECOMMENDED",
  "HUMAN_REVIEW_REQUIRED",
  "HUMAN_APPROVAL_REQUIRED",
]);
export type HumanReviewDecision = z.infer<typeof humanReviewDecisionSchema>;

export const draftAssertionSchema = z.object({
  draft_sentence_id: idSchema,
  text: z.string().min(1),
  assertion_type: assertionTypeSchema,
  source_ids: z.array(idSchema).default([]),
  evidence_ids: z.array(idSchema).default([]),
  legal_proposition_ids: z.array(idSchema).default([]),
  precedent_ids: z.array(idSchema).default([]),
  qualification: z.string().min(1).optional(),
  confidence: confidenceSchema,
  provenance: provenanceSchema,
  human_review_state: z.enum(["UNREVIEWED", "HUMAN_VERIFIED", "HUMAN_LOCKED", "REVIEW_REQUIRED"]),
});
export type DraftAssertion = z.infer<typeof draftAssertionSchema>;

export const draftSectionSchema = z.object({
  section_id: idSchema,
  section_type: sectionTypeSchema,
  title: z.string().min(1),
  priority: argumentPrioritySchema,
  included: z.boolean(),
  reason: z.string().min(1),
  source_ids: z.array(idSchema).default([]),
  assertion_ids: z.array(idSchema).default([]),
  provenance: provenanceSchema,
});
export type DraftSection = z.infer<typeof draftSectionSchema>;

export const paragraphDraftSchema = z.object({
  paragraph_id: idSchema,
  proposition_or_issue: z.string().min(1),
  fact: z.string().min(1).optional(),
  evidence: z.string().min(1).optional(),
  legal_rule: z.string().min(1).optional(),
  application: z.string().min(1),
  consequence: z.string().min(1),
  assertion_ids: z.array(idSchema).default([]),
  provenance: provenanceSchema,
});
export type ParagraphDraft = z.infer<typeof paragraphDraftSchema>;

export const requestDraftSchema = z.object({
  request_id: idSchema,
  level: z.enum([
    "PRIMARY",
    "EVENTUAL",
    "SUBEVENTUAL",
    "PROCEDURAL",
    "EVIDENTIARY",
    "INTERIM",
    "COSTS",
    "RESERVE",
  ]),
  category: z.enum([
    "MATERIAL_RELIEF",
    "PROCEDURAL_STEP",
    "EVIDENTIARY_STEP",
    "INTERIM_RELIEF",
    "COSTS",
    "RESERVE",
  ]),
  text: z.string().min(1),
  basis_ids: z.array(idSchema).default([]),
  remedy_fit: z.enum(["SUPPORTED", "PARTIAL", "UNSUPPORTED", "UNKNOWN"]),
  human_review_required: z.boolean(),
  provenance: provenanceSchema,
});
export type RequestDraft = z.infer<typeof requestDraftSchema>;

export const evidentiaryRequestDraftSchema = z.object({
  request_id: idSchema,
  requested_item: z.string().min(1),
  requested_from: z.string().min(1),
  reason: z.string().min(1),
  proposition_supported: idSchema,
  procedural_basis: z.array(idSchema).default([]),
  limiting_language: z.string().min(1),
  provenance: provenanceSchema,
});
export type EvidentiaryRequestDraft = z.infer<typeof evidentiaryRequestDraftSchema>;

export const citationCalibrationSchema = z.object({
  citation_id: idSchema,
  use_type: z.enum([
    "RULE",
    "EXCEPTION",
    "APPLICATION",
    "PROCEDURAL_PRINCIPLE",
    "ADVERSE_DISTINCTION",
  ]),
  status: z.enum(["SUPPORTED", "NEEDS_LIMITATION", "DECORATIVE", "HUMAN_REVIEW_REQUIRED"]),
  limiting_language: z.string().min(1).optional(),
  provenance: provenanceSchema,
});
export type CitationCalibration = z.infer<typeof citationCalibrationSchema>;

export const multilingualTextSchema = z.object({
  text_id: idSchema,
  language: z.enum(["DE", "FR", "IT", "ES", "EN", "UNKNOWN"]),
  original_text: z.string().min(1),
  translation: z.string().min(1).optional(),
  translation_status: z.enum([
    "ORIGINAL_QUOTE",
    "TRANSLATION",
    "NOT_TRANSLATED",
    "HUMAN_REVIEW_REQUIRED",
  ]),
  source_id: idSchema.optional(),
  locator: z.string().min(1).optional(),
  verification_status: z.enum(["VERIFIED", "PARTIAL", "UNVERIFIED", "UNKNOWN"]),
});
export type MultilingualText = z.infer<typeof multilingualTextSchema>;

export const qaFindingSchema = z.object({
  finding_id: idSchema,
  category: z.enum([
    "FACT",
    "LEGAL",
    "PROCEDURAL",
    "ADVERSARIAL",
    "JUDGE_PATH",
    "MWC",
    "EXCESS",
    "CREDIBILITY",
    "UNUSED_STRENGTH",
    "CONFLICT",
    "CLAIM_REQUEST",
    "DRAFTING",
    "HUMAN_REVIEW",
  ]),
  flag: z.string().min(1),
  severity: z.enum(["BLOCKING", "MATERIAL", "MANAGEABLE", "DRAFTING"]),
  target_id: idSchema.optional(),
  explanation: z.string().min(1),
  proposed_fix: z.string().min(1).optional(),
  human_review: humanReviewDecisionSchema,
});
export type QaFinding = z.infer<typeof qaFindingSchema>;

const draftingQualityLevelSchema = z.enum(["EXCELLENT", "GOOD", "ADEQUATE", "WEAK", "CRITICAL"]);

export const legalDraftingQualitySchema = z.object({
  STRUCTURE: draftingQualityLevelSchema,
  CLARITY: draftingQualityLevelSchema,
  ECONOMY: draftingQualityLevelSchema,
  TRACEABILITY: draftingQualityLevelSchema,
  TONE: draftingQualityLevelSchema,
  LEGAL_PRECISION: draftingQualityLevelSchema,
  EVIDENTIARY_PRECISION: draftingQualityLevelSchema,
  PROCEDURAL_ALIGNMENT: draftingQualityLevelSchema,
});
export type LegalDraftingQuality = z.infer<typeof legalDraftingQualitySchema>;

export const revisionSuggestionSchema = z.object({
  suggestion_id: idSchema,
  problem: z.string().min(1),
  why_it_matters: z.string().min(1),
  severity: z.enum(["BLOCKING", "MATERIAL", "MANAGEABLE", "DRAFTING"]),
  proposed_fix: z.string().min(1),
  strategy_change: z.boolean(),
  human_review: humanReviewDecisionSchema,
});
export type RevisionSuggestion = z.infer<typeof revisionSuggestionSchema>;

export const beforeAfterRewriteSchema = z.object({
  original: z.string().min(1),
  issue: z.string().min(1),
  revised: z.string().min(1),
  rationale: z.string().min(1),
});
export type BeforeAfterRewrite = z.infer<typeof beforeAfterRewriteSchema>;

export const draftVersionSchema = z.object({
  draft_version_id: idSchema,
  parent_version_id: idSchema.optional(),
  created_at: z.iso.datetime({ offset: true }),
  mode: draftingModeSchema,
  audience: audienceSchema,
  sections: z.array(draftSectionSchema).default([]),
  assertions: z.array(draftAssertionSchema).default([]),
  paragraphs: z.array(paragraphDraftSchema).default([]),
  requests: z.array(requestDraftSchema).default([]),
  qa_summary: z.string().min(1),
  provenance: provenanceSchema,
});
export type DraftVersion = z.infer<typeof draftVersionSchema>;

export const finalBriefQaSchema = z.object({
  view_type: z.literal("FINAL_BRIEF_QA"),
  source_of_truth: z.literal(false),
  blocking_issues: z.array(qaFindingSchema).default([]),
  material_issues: z.array(qaFindingSchema).default([]),
  manageable_issues: z.array(qaFindingSchema).default([]),
  drafting_issues: z.array(qaFindingSchema).default([]),
  quality: legalDraftingQualitySchema,
  result: readinessResultSchema,
  readiness: draftReadinessSchema,
  revision_suggestions: z.array(revisionSuggestionSchema).default([]),
  provenance: provenanceSchema,
});
export type FinalBriefQa = z.infer<typeof finalBriefQaSchema>;

export const autoRevisionBoundarySchema = z.object({
  allowed: z.boolean(),
  reason: z.string().min(1),
  human_review: humanReviewDecisionSchema,
});
export type AutoRevisionBoundary = z.infer<typeof autoRevisionBoundarySchema>;

export const draftingInputSchema = z.object({
  matter_id: idSchema,
  mode: draftingModeSchema,
  audience: audienceSchema,
  language: z.enum(["DE", "FR", "IT", "ES"]).default("DE"),
  structured_matter_available: z.boolean(),
  request_disposition_map: z.custom<RequestDispositionMap>().optional(),
  issue_law_maps: z.array(z.custom<IssueLawMap>()).default([]),
  legal_propositions: z.array(z.custom<EnhancedLegalProposition>()).default([]),
  precedent_applications: z.array(z.custom<PrecedentApplicationAnalysis>()).default([]),
  contradictions: z.array(z.custom<ContradictionAssessmentResult>()).default([]),
  best_winning_theory: z.custom<BestWinningTheory>().optional(),
  minimum_winning_case: z.custom<MinimumWinningCase>().optional(),
  opponent_arguments: z.array(z.custom<BestOpponentArgument>()).default([]),
  replies: z.array(z.custom<BestReply>()).default([]),
  removal_tests: z.array(z.custom<ArgumentRemovalTest>()).default([]),
  judicial_paths: z.array(z.custom<JudicialDecisionPath>()).default([]),
  credibility_profile: z.custom<JudicialCredibilityProfile>().optional(),
  procedural_strategy: z.custom<ProceduralStrategy>().optional(),
  procedural_requests: z.array(z.custom<ProceduralRequest>()).default([]),
  request_optimizations: z.array(z.custom<RequestOptimization>()).default([]),
  minimum_request_set: z.custom<MinimumRequestSet>().optional(),
  human_locked_ids: z.array(idSchema).default([]),
  provenance: provenanceSchema,
});
export type DraftingInput = z.infer<typeof draftingInputSchema>;

const sectionTitles: Record<SectionType, string> = {
  OPENING: "Opening",
  PROCEDURAL_CONTEXT: "Procedural context",
  FACTUAL_BACKGROUND: "Factual background",
  CORE_ISSUES: "Core issues",
  LEGAL_ANALYSIS: "Legal analysis",
  EVIDENCE: "Evidence",
  CONTRADICTIONS: "Contradictions",
  COUNTERARGUMENT_RESPONSE: "Response to counterarguments",
  PROCEDURAL_REQUESTS: "Procedural requests",
  EVIDENTIARY_REQUESTS: "Evidentiary requests",
  REMEDIES: "Remedies",
  COSTS: "Costs",
  CONCLUSION: "Conclusion",
};

const canonicalSectionOrder = sectionTypeSchema.options;

function finding(
  category: QaFinding["category"],
  flag: string,
  severity: QaFinding["severity"],
  explanation: string,
  targetId?: string,
  proposedFix?: string,
  humanReview: HumanReviewDecision = severity === "BLOCKING"
    ? "HUMAN_REVIEW_REQUIRED"
    : "REVIEW_RECOMMENDED",
): QaFinding {
  return {
    finding_id: `${category.toLowerCase()}-${flag.toLowerCase()}-${targetId ?? "global"}`,
    category,
    flag,
    severity,
    target_id: targetId,
    explanation,
    proposed_fix: proposedFix,
    human_review: humanReview,
  };
}

function hasAny<T>(items: readonly T[] | undefined): boolean {
  return Boolean(items && items.length > 0);
}

export function buildSectionPlan(input: DraftingInput): DraftSection[] {
  const parsed = draftingInputSchema.parse(input);
  return canonicalSectionOrder.map((sectionType) => {
    const included =
      sectionType === "OPENING" ||
      sectionType === "CONCLUSION" ||
      sectionType === "CORE_ISSUES" ||
      (sectionType === "LEGAL_ANALYSIS" && hasAny(parsed.legal_propositions)) ||
      (sectionType === "EVIDENCE" && Boolean(parsed.minimum_winning_case)) ||
      (sectionType === "CONTRADICTIONS" && hasAny(parsed.contradictions)) ||
      (sectionType === "COUNTERARGUMENT_RESPONSE" && hasAny(parsed.opponent_arguments)) ||
      (sectionType === "PROCEDURAL_REQUESTS" && hasAny(parsed.procedural_requests)) ||
      (sectionType === "EVIDENTIARY_REQUESTS" &&
        parsed.procedural_requests.some(
          (request) => request.request_type === "EVIDENTIARY_STEP",
        )) ||
      (sectionType === "REMEDIES" && Boolean(parsed.minimum_request_set)) ||
      (sectionType === "PROCEDURAL_CONTEXT" && Boolean(parsed.procedural_strategy)) ||
      sectionType === "FACTUAL_BACKGROUND" ||
      sectionType === "COSTS";

    const priority: ArgumentPriority =
      sectionType === "OPENING" ||
      sectionType === "CORE_ISSUES" ||
      sectionType === "PROCEDURAL_REQUESTS" ||
      sectionType === "CONCLUSION"
        ? "DECISIVE"
        : sectionType === "COUNTERARGUMENT_RESPONSE" || sectionType === "LEGAL_ANALYSIS"
          ? "HIGH"
          : sectionType === "CONTRADICTIONS" || sectionType === "REMEDIES"
            ? "SUPPORTING"
            : "SUBSIDIARY";

    return draftSectionSchema.parse({
      section_id: `section-${sectionType.toLowerCase()}`,
      section_type: sectionType,
      title: sectionTitles[sectionType],
      priority,
      included,
      reason: included
        ? "Included because structured Phase 1-7 inputs support this drafting function."
        : "Reserved because the structured input does not support a standalone section.",
      source_ids: [parsed.matter_id],
      assertion_ids: [],
      provenance: parsed.provenance,
    });
  });
}

export function orderArgumentsByHierarchy<T extends { priority: ArgumentPriority }>(
  argumentsToOrder: T[],
): T[] {
  const rank: Record<ArgumentPriority, number> = {
    DECISIVE: 0,
    HIGH: 1,
    SUPPORTING: 2,
    SUBSIDIARY: 3,
    RESERVE: 4,
  };
  return [...argumentsToOrder].sort((left, right) => rank[left.priority] - rank[right.priority]);
}

export function buildOpeningSummary(input: {
  decisive_issue: string;
  requested_relief: string;
  minimum_winning_path: string;
  opponent_position?: string;
  mode: DraftingMode;
}): string {
  const strengthPrefix =
    input.mode === "LITIGATION_STRONG"
      ? "The decisive point is"
      : "This submission concerns the narrower procedural question whether";
  const opponentClause = input.opponent_position
    ? ` It responds to the opposing position that ${input.opponent_position}.`
    : "";
  return `${strengthPrefix} ${input.decisive_issue}. The requested relief is ${input.requested_relief}, on the minimum path that ${input.minimum_winning_path}.${opponentClause}`;
}

export function buildConclusionPlan(input: {
  decisive_path: string;
  request_ids: string[];
  introduce_new_arguments?: boolean;
}): { text: string; status: "CALIBRATED" | "REVIEW_REQUIRED" } {
  return {
    text: `For these reasons, the submission should close by restating ${input.decisive_path} and mapping it to ${input.request_ids.join(", ")} without introducing new arguments.`,
    status: input.introduce_new_arguments ? "REVIEW_REQUIRED" : "CALIBRATED",
  };
}

export function validateDraftAssertion(assertion: DraftAssertion): DraftAssertion {
  return draftAssertionSchema.parse(assertion);
}

export function checkFactTraceability(assertion: DraftAssertion): QaFinding[] {
  const parsed = validateDraftAssertion(assertion);
  if (parsed.assertion_type !== "FACT") return [];
  if (parsed.source_ids.length > 0 || parsed.evidence_ids.length > 0) return [];
  return [
    finding(
      "FACT",
      "UNSUPPORTED_FACT",
      "BLOCKING",
      "A material factual sentence must link to a source or evidence item.",
      parsed.draft_sentence_id,
      "Add an evidence/source link or qualify the sentence as unresolved.",
    ),
  ];
}

export function checkLegalTraceability(assertion: DraftAssertion): QaFinding[] {
  const parsed = validateDraftAssertion(assertion);
  if (parsed.assertion_type !== "LEGAL_CHARACTERIZATION" && parsed.assertion_type !== "ARGUMENT") {
    return [];
  }
  if (parsed.legal_proposition_ids.length > 0) return [];
  return [
    finding(
      "LEGAL",
      "UNSUPPORTED_LEGAL_PROPOSITION",
      "BLOCKING",
      "A legal characterization or legal argument must link to a verified legal proposition.",
      parsed.draft_sentence_id,
      "Link the proposition to verified authority or downgrade the statement.",
    ),
  ];
}

export function detectToneIssues(sentenceId: string, text: string): QaFinding[] {
  const lower = text.toLowerCase();
  const issues: QaFinding[] = [];
  const accusatoryTerms = [
    "lied",
    "concealed",
    "manipulated",
    "bad faith",
    "obviously false",
    "absurd",
  ];
  const overstatementTerms = ["always", "never", "plainly impossible", "undeniably", "untenable"];
  const speculativeTerms = ["must have", "surely", "obviously intended"];

  if (accusatoryTerms.some((term) => lower.includes(term))) {
    issues.push(
      finding(
        "EXCESS",
        "ACCUSATORY_LANGUAGE",
        "DRAFTING",
        "The sentence frames the point as personal misconduct without requiring that conclusion.",
        sentenceId,
        "Use record-based language such as: the available record does not support that account.",
        "REVIEW_RECOMMENDED",
      ),
    );
  }
  if (overstatementTerms.some((term) => lower.includes(term))) {
    issues.push(
      finding(
        "EXCESS",
        "OVERSTATED_FACT",
        "MATERIAL",
        "The sentence uses absolute or overstated wording that may exceed the record.",
        sentenceId,
        "Qualify the statement by reference to the available record.",
      ),
    );
  }
  if (speculativeTerms.some((term) => lower.includes(term))) {
    issues.push(
      finding(
        "EXCESS",
        "SPECULATIVE_LANGUAGE",
        "DRAFTING",
        "The sentence infers intent or knowledge without an explicit evidentiary basis.",
        sentenceId,
        "State the documentary contradiction without attributing motive.",
        "REVIEW_RECOMMENDED",
      ),
    );
  }
  if (issues.length === 0 && /(record|akten|document|beilage|evidence|source)/i.test(text)) {
    issues.push(
      finding(
        "DRAFTING",
        "PROCEDURALLY_CALIBRATED",
        "DRAFTING",
        "The sentence uses record-based procedural language.",
        sentenceId,
        undefined,
        "NONE",
      ),
    );
  }
  return issues;
}

export function detectSentenceIssues(sentenceId: string, text: string): SentenceIssue[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const flags: SentenceIssue["flags"] = [];
  if (words.length > 35) flags.push("OVERLONG_SENTENCE");
  if ((text.match(/,|;|\band\b|\bbut\b|\bwhile\b/gi) ?? []).length >= 4) {
    flags.push("MULTIPLE_ARGUMENTS_IN_ONE_SENTENCE");
  }
  if (
    /\bthis\b/i.test(text) &&
    !/[.:;]/.test(text.slice(0, Math.max(0, text.toLowerCase().indexOf("this"))))
  ) {
    flags.push("UNCLEAR_REFERENT");
  }
  if (/\bwas\b|\bwere\b|\bwurde\b|\bwurden\b/i.test(text) && words.length > 20) {
    flags.push("UNNECESSARY_PASSIVE");
  }
  return flags.length === 0
    ? []
    : [
        {
          sentence_id: sentenceId,
          flags,
          explanation: "Sentence-level drafting control detected readability or precision risk.",
          auto_fix_allowed: true,
        },
      ];
}

export function evaluateRepetition(items: string[]): {
  status: "NECESSARY_REINFORCEMENT" | "USEFUL_REMINDER" | "REDUNDANT" | "DISTRACTING_REPETITION";
  repeated_keys: string[];
} {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/gi, " ")
      .trim()
      .slice(0, 80);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const repeated = [...counts.entries()].filter(([, count]) => count >= 2);
  const max = Math.max(0, ...[...counts.values()]);
  return {
    status:
      max >= 6
        ? "DISTRACTING_REPETITION"
        : max >= 3
          ? "REDUNDANT"
          : repeated.length > 0
            ? "USEFUL_REMINDER"
            : "NECESSARY_REINFORCEMENT",
    repeated_keys: repeated.map(([key]) => key),
  };
}

export function evaluateArgumentEconomy(removalTests: ArgumentRemovalTest[]): {
  keep: string[];
  drop: string[];
  reserve: string[];
  warnings: QaFinding[];
} {
  const keep: string[] = [];
  const drop: string[] = [];
  const reserve: string[] = [];
  const warnings: QaFinding[] = [];
  for (const test of removalTests) {
    if (["ESSENTIAL", "IMPORTANT", "SUPPORTING"].includes(test.effect)) keep.push(test.argument_id);
    if (["REDUNDANT", "DISTRACTING", "HARMFUL_POSSIBLE"].includes(test.effect)) {
      drop.push(test.argument_id);
      warnings.push(
        finding(
          "EXCESS",
          "UNNECESSARY_ARGUMENT",
          "MANAGEABLE",
          "Phase 6 removal testing indicates this argument does not add useful force.",
          test.argument_id,
          "Drop or move to reserve unless a human reviewer locks it.",
        ),
      );
    }
    if (test.effect === "SUPPORTING") reserve.push(test.argument_id);
  }
  return { keep, drop, reserve, warnings };
}

export function calibrateEvidenceLanguage(input: {
  evidence_status: "VERIFIED" | "PARTIAL" | "MISSING" | "CONTESTED" | "UNKNOWN";
  proposition: string;
}): string {
  switch (input.evidence_status) {
    case "VERIFIED":
      return `The record supports that ${input.proposition}.`;
    case "PARTIAL":
      return `The available record partially supports that ${input.proposition}; the remaining scope should be treated cautiously.`;
    case "MISSING":
      return `The available record does not yet establish that ${input.proposition}.`;
    case "CONTESTED":
      return `The record contains a disputed basis for ${input.proposition}.`;
    case "UNKNOWN":
      return `The current record is insufficient to state whether ${input.proposition}.`;
  }
}

export function calibrateContradictionLanguage(input: {
  contradiction_status: "DIRECT" | "APPARENT" | "EXPLAINABLE" | "UNRESOLVED";
  subject: string;
}): string {
  switch (input.contradiction_status) {
    case "DIRECT":
      return `The documents contain a direct inconsistency concerning ${input.subject}.`;
    case "APPARENT":
      return `The documents appear to diverge concerning ${input.subject}, subject to clarification.`;
    case "EXPLAINABLE":
      return `The apparent divergence concerning ${input.subject} may be explained by the surrounding chronology.`;
    case "UNRESOLVED":
      return `The available documents do not yet clarify the divergence concerning ${input.subject}.`;
  }
}

export function buildParagraph(input: ParagraphDraft): ParagraphDraft {
  return paragraphDraftSchema.parse(input);
}

export function buildRequestDraft(request: ProceduralRequest): RequestDraft {
  return requestDraftSchema.parse({
    request_id: request.request_id,
    level: request.level,
    category: request.request_type,
    text: request.text_or_structured_relief,
    basis_ids: [...request.legal_basis, ...request.evidentiary_basis, ...request.procedural_basis],
    remedy_fit:
      request.remedy?.status === "SUPPORTED"
        ? "SUPPORTED"
        : request.remedy?.status === "PARTIAL"
          ? "PARTIAL"
          : "UNKNOWN",
    human_review_required: request.human_review_state?.status === "HUMAN_LOCKED",
    provenance: request.provenance,
  });
}

export function buildEvidentiaryRequestDraft(
  input: EvidentiaryRequestDraft,
): EvidentiaryRequestDraft {
  return evidentiaryRequestDraftSchema.parse({
    ...input,
    limiting_language:
      input.limiting_language ||
      "to the extent held by the requested authority and available in the file",
  });
}

export function checkProceduralAlignment(input: {
  remedy_gap?: boolean;
  unsupported_request_ids?: string[];
  eventual_relief_gap?: boolean;
  evidentiary_request_gap?: boolean;
  procedural_prerequisite_gap?: boolean;
}): QaFinding[] {
  const findings: QaFinding[] = [];
  if (input.remedy_gap) {
    findings.push(
      finding(
        "PROCEDURAL",
        "REMEDY_GAP",
        "BLOCKING",
        "A winning argument lacks a corresponding usable remedy.",
        undefined,
        "Add a request mapped to the decisive argument.",
      ),
    );
  }
  for (const requestId of input.unsupported_request_ids ?? []) {
    findings.push(
      finding(
        "PROCEDURAL",
        "UNSUPPORTED_REQUEST",
        "MATERIAL",
        "A request lacks factual, legal, or procedural basis.",
        requestId,
        "Narrow, subordinate, or remove the request.",
      ),
    );
  }
  if (input.eventual_relief_gap) {
    findings.push(
      finding(
        "PROCEDURAL",
        "EVENTUAL_RELIEF_GAP",
        "MATERIAL",
        "The draft lacks fallback relief for a plausible rejection path.",
        undefined,
        "Add an eventual or subeventual request.",
      ),
    );
  }
  if (input.evidentiary_request_gap) {
    findings.push(
      finding(
        "PROCEDURAL",
        "EVIDENTIARY_REQUEST_GAP",
        "MATERIAL",
        "An evidence gap is identified without a matching evidentiary request.",
        undefined,
        "Request the missing document or file access.",
      ),
    );
  }
  if (input.procedural_prerequisite_gap) {
    findings.push(
      finding(
        "PROCEDURAL",
        "PROCEDURAL_PREREQUISITE_GAP",
        "BLOCKING",
        "A procedural prerequisite is unresolved.",
        undefined,
        "Address deadline, standing, competence, or admissibility.",
      ),
    );
  }
  return findings;
}

export function checkAdversarialCoverage(input: {
  material_opponent_argument_ids: string[];
  addressed_opponent_argument_ids: string[];
  answered_weak_only?: boolean;
  residual_risk_ignored?: boolean;
  adverse_precedent_unaddressed?: boolean;
  dangerous_concession?: boolean;
}): QaFinding[] {
  const addressed = new Set(input.addressed_opponent_argument_ids);
  const findings = input.material_opponent_argument_ids
    .filter((id) => !addressed.has(id))
    .map((id) =>
      finding(
        "ADVERSARIAL",
        "COUNTERARGUMENT_UNANSWERED",
        "MATERIAL",
        "A material opposing argument is not answered.",
        id,
        "Add a direct, record-calibrated reply.",
      ),
    );
  if (input.answered_weak_only) {
    findings.push(
      finding(
        "ADVERSARIAL",
        "STRAWMAN_RESPONSE",
        "MATERIAL",
        "The draft answers a weak version of the opposing position only.",
        undefined,
        "Answer the strongest plausible opposing case.",
      ),
    );
  }
  if (input.residual_risk_ignored) {
    findings.push(
      finding(
        "ADVERSARIAL",
        "RESIDUAL_RISK_IGNORED",
        "MATERIAL",
        "A residual risk from Phase 6 is not acknowledged or managed.",
        undefined,
        "Address or qualify the risk.",
      ),
    );
  }
  if (input.adverse_precedent_unaddressed) {
    findings.push(
      finding(
        "ADVERSARIAL",
        "ADVERSE_PRECEDENT_UNADDRESSED",
        "MATERIAL",
        "Material adverse precedent is not addressed.",
        undefined,
        "Distinguish or concede its limited effect.",
      ),
    );
  }
  if (input.dangerous_concession) {
    findings.push(
      finding(
        "ADVERSARIAL",
        "DANGEROUS_CONCESSION",
        "BLOCKING",
        "The draft concedes a fact or legal premise that may defeat the requested relief.",
        undefined,
        "Require human review before including the concession.",
      ),
    );
  }
  return findings;
}

export function checkJudgePathCoverage(input: {
  skeptical_path_ids_unaddressed?: string[];
  favorable_no_usable_remedy?: boolean;
  evidence_strict_failure?: boolean;
  narrow_disposal_risk?: boolean;
}): QaFinding[] {
  const findings = (input.skeptical_path_ids_unaddressed ?? []).map((id) =>
    finding(
      "JUDGE_PATH",
      "UNADDRESSED_REJECTION_PATH",
      "MATERIAL",
      "A plausible rejection path is not addressed.",
      id,
      "Add a concise answer or fallback request.",
    ),
  );
  if (input.favorable_no_usable_remedy)
    findings.push(
      finding(
        "JUDGE_PATH",
        "NO_USABLE_GRANTED_REMEDY",
        "BLOCKING",
        "Even a favorable judge path lacks a grantable remedy.",
      ),
    );
  if (input.evidence_strict_failure)
    findings.push(
      finding(
        "JUDGE_PATH",
        "EVIDENCE_STRICT_FAILURE",
        "MATERIAL",
        "The draft may fail under strict evidence review.",
      ),
    );
  if (input.narrow_disposal_risk)
    findings.push(
      finding(
        "JUDGE_PATH",
        "NARROW_DISPOSAL_RISK",
        "MANAGEABLE",
        "The authority may dispose of the case on a narrow procedural ground.",
      ),
    );
  return findings;
}

export function checkMinimumWinningCaseCoverage(input: {
  minimum_winning_case: MinimumWinningCase;
  included_fact_ids: string[];
  included_law_ids: string[];
  included_evidence_ids: string[];
  included_request_ids: string[];
}): QaFinding[] {
  const facts = new Set(input.included_fact_ids);
  const laws = new Set(input.included_law_ids);
  const evidence = new Set(input.included_evidence_ids);
  const requests = new Set(input.included_request_ids);
  const findings: QaFinding[] = [];
  for (const item of input.minimum_winning_case.essential_facts) {
    if (!facts.has(item.element_id))
      findings.push(
        finding(
          "MWC",
          "MWC_FACT_MISSING",
          "BLOCKING",
          "An essential fact from the MinimumWinningCase is missing from the draft.",
          item.element_id,
        ),
      );
  }
  for (const item of input.minimum_winning_case.essential_legal_propositions) {
    if (!laws.has(item.element_id))
      findings.push(
        finding(
          "MWC",
          "MWC_LAW_MISSING",
          "BLOCKING",
          "An essential legal proposition from the MinimumWinningCase is missing from the draft.",
          item.element_id,
        ),
      );
  }
  for (const item of input.minimum_winning_case.essential_evidence) {
    if (!evidence.has(item.element_id))
      findings.push(
        finding(
          "MWC",
          "MWC_EVIDENCE_MISSING",
          "BLOCKING",
          "Essential evidence from the MinimumWinningCase is missing from the draft.",
          item.element_id,
        ),
      );
  }
  for (const item of input.minimum_winning_case.essential_remedy_elements) {
    if (!requests.has(item.element_id))
      findings.push(
        finding(
          "MWC",
          "MWC_REQUEST_MISSING",
          "BLOCKING",
          "A request needed for the MinimumWinningCase is missing from the draft.",
          item.element_id,
        ),
      );
  }
  return findings;
}

export function checkPrecedentDrafting(input: {
  precedent_id: string;
  application: "FAVORABLE" | "ADVERSE" | "MIXED" | "DISTINGUISHABLE";
  drafted_as: "PURELY_FAVORABLE" | "LIMITED_FAVORABLE" | "ADVERSE_DISTINCTION" | "NEUTRAL";
}): QaFinding[] {
  if (input.application === "MIXED" && input.drafted_as === "PURELY_FAVORABLE") {
    return [
      finding(
        "LEGAL",
        "OVERSTATED_PRECEDENT",
        "MATERIAL",
        "A mixed precedent is drafted as purely favorable.",
        input.precedent_id,
        "Acknowledge the adverse limitation and use it only for the supported proposition.",
      ),
      finding(
        "LEGAL",
        "ADVERSE_CONTEXT_OMITTED",
        "MATERIAL",
        "The limiting context of the precedent is omitted.",
        input.precedent_id,
      ),
    ];
  }
  if (input.application === "ADVERSE" && input.drafted_as !== "ADVERSE_DISTINCTION") {
    return [
      finding(
        "LEGAL",
        "ADVERSE_CONTEXT_OMITTED",
        "MATERIAL",
        "Adverse precedent must be distinguished or expressly managed.",
        input.precedent_id,
      ),
    ];
  }
  return [];
}

export function calibrateCitationUse(input: CitationCalibration): CitationCalibration {
  return citationCalibrationSchema.parse(input);
}

export function checkQuoteControl(text: MultilingualText): QaFinding[] {
  const parsed = multilingualTextSchema.parse(text);
  if (parsed.translation_status === "TRANSLATION" && !parsed.translation) {
    return [
      finding(
        "LEGAL",
        "HUMAN_REVIEW_REQUIRED",
        "MATERIAL",
        "A translated authority quote lacks translation text.",
        parsed.text_id,
      ),
    ];
  }
  if (parsed.translation_status === "ORIGINAL_QUOTE" && parsed.verification_status !== "VERIFIED") {
    return [
      finding(
        "LEGAL",
        "MISATTRIBUTED_AUTHORITY",
        "BLOCKING",
        "An original quote must preserve source, locator, language, and verification.",
        parsed.text_id,
      ),
    ];
  }
  return [];
}

export function validateMultilingualText(text: MultilingualText): MultilingualText {
  return multilingualTextSchema.parse(text);
}

export function checkClaimRequestMismatch(input: {
  decisive_argument_ids: string[];
  request_supporting_argument_ids: string[];
}): QaFinding[] {
  const supported = new Set(input.request_supporting_argument_ids);
  return input.decisive_argument_ids
    .filter((id) => !supported.has(id))
    .map((id) =>
      finding(
        "CLAIM_REQUEST",
        "REMEDY_GAP",
        "BLOCKING",
        "A decisive argument is not mapped to a request.",
        id,
      ),
    );
}

export function checkConflictingArguments(input: {
  primary_theories: Array<{ theory_id: string; compatible_with: string[] }>;
}): QaFinding[] {
  const findings: QaFinding[] = [];
  for (let i = 0; i < input.primary_theories.length; i += 1) {
    for (let j = i + 1; j < input.primary_theories.length; j += 1) {
      const left = input.primary_theories[i]!;
      const right = input.primary_theories[j]!;
      if (
        !left.compatible_with.includes(right.theory_id) &&
        !right.compatible_with.includes(left.theory_id)
      ) {
        findings.push(
          finding(
            "CONFLICT",
            "MUTUALLY_EXCLUSIVE",
            "BLOCKING",
            "Two primary theories cannot both be presented as primary without qualification.",
            `${left.theory_id}:${right.theory_id}`,
            "Make one theory eventual, conditional, or reserve it for human review.",
          ),
        );
      }
    }
  }
  return findings;
}

export function evaluateCredibility(input: {
  denied_proven_adverse_fact?: boolean;
  safe_concession_used?: boolean;
  accusatory_findings?: number;
  profile?: JudicialCredibilityProfile;
}): {
  status: "CREDIBILITY_POSITIVE" | "CREDIBILITY_NEUTRAL" | "CREDIBILITY_AT_RISK";
  findings: QaFinding[];
} {
  if (input.denied_proven_adverse_fact) {
    return {
      status: "CREDIBILITY_AT_RISK",
      findings: [
        finding(
          "CREDIBILITY",
          "CREDIBILITY_AT_RISK",
          "BLOCKING",
          "The draft denies a clearly proven adverse fact, which damages institutional credibility.",
          undefined,
          "Concede the proven fact safely and limit its legal consequence.",
        ),
      ],
    };
  }
  if (input.safe_concession_used && !input.accusatory_findings) {
    return { status: "CREDIBILITY_POSITIVE", findings: [] };
  }
  return {
    status:
      input.accusatory_findings && input.accusatory_findings > 0
        ? "CREDIBILITY_AT_RISK"
        : "CREDIBILITY_NEUTRAL",
    findings:
      input.accusatory_findings && input.accusatory_findings > 0
        ? [
            finding(
              "CREDIBILITY",
              "CREDIBILITY_AT_RISK",
              "MATERIAL",
              "Tone findings may reduce credibility.",
            ),
          ]
        : [],
  };
}

export function detectUnusedStrength(input: {
  strong_evidence_ids?: string[];
  used_evidence_ids?: string[];
  strong_authority_ids?: string[];
  used_authority_ids?: string[];
  material_contradiction_ids?: string[];
  used_contradiction_ids?: string[];
  admission_ids?: string[];
  used_admission_ids?: string[];
  fallback_ids?: string[];
  used_fallback_ids?: string[];
}): QaFinding[] {
  const checks: Array<[string, string[] | undefined, string[] | undefined, string]> = [
    [
      "UNUSED_STRONG_EVIDENCE",
      input.strong_evidence_ids,
      input.used_evidence_ids,
      "Strong evidence exists but is not used.",
    ],
    [
      "UNUSED_STRONG_AUTHORITY",
      input.strong_authority_ids,
      input.used_authority_ids,
      "Strong authority exists but is not used.",
    ],
    [
      "UNUSED_MATERIAL_CONTRADICTION",
      input.material_contradiction_ids,
      input.used_contradiction_ids,
      "A material contradiction is not used.",
    ],
    [
      "UNUSED_ADMISSION",
      input.admission_ids,
      input.used_admission_ids,
      "A useful admission is not used.",
    ],
    [
      "UNUSED_FALLBACK",
      input.fallback_ids,
      input.used_fallback_ids,
      "A useful fallback is not used.",
    ],
  ];
  return checks.flatMap(([flag, all, used, explanation]) => {
    const usedSet = new Set(used ?? []);
    return (all ?? [])
      .filter((id) => !usedSet.has(id))
      .map((id) =>
        finding(
          "UNUSED_STRENGTH",
          flag,
          "MANAGEABLE",
          explanation,
          id,
          "Consider adding it if it supports the drafting spine.",
        ),
      );
  });
}

export function evaluateLength(input: {
  page_count?: number;
  word_count?: number;
  material_issue_count: number;
  redundancy_status?:
    "NECESSARY_REINFORCEMENT" | "USEFUL_REMINDER" | "REDUNDANT" | "DISTRACTING_REPETITION";
}): "TOO_SHORT" | "PROPORTIONATE" | "LONG_BUT_JUSTIFIED" | "OVERLONG" | "MATERIAL_OVERLOAD" {
  if ((input.word_count ?? 0) < 500 && input.material_issue_count > 2) return "TOO_SHORT";
  if (input.redundancy_status === "DISTRACTING_REPETITION") return "MATERIAL_OVERLOAD";
  if ((input.page_count ?? 0) > 25 || (input.word_count ?? 0) > 12000) return "OVERLONG";
  if ((input.page_count ?? 0) > 12 && input.material_issue_count >= 4) return "LONG_BUT_JUSTIFIED";
  return "PROPORTIONATE";
}

export function evaluateDraftingQuality(input: {
  findings: QaFinding[];
  length_status?: ReturnType<typeof evaluateLength>;
}): LegalDraftingQuality {
  const hasBlocking = input.findings.some((item) => item.severity === "BLOCKING");
  const hasMaterial = input.findings.some((item) => item.severity === "MATERIAL");
  const hasTone = input.findings.some(
    (item) => item.flag.includes("LANGUAGE") || item.category === "CREDIBILITY",
  );
  const hasTraceability = input.findings.some(
    (item) => item.category === "FACT" || item.category === "LEGAL",
  );
  const hasProcedure = input.findings.some(
    (item) => item.category === "PROCEDURAL" || item.category === "CLAIM_REQUEST",
  );
  const base = hasBlocking ? "CRITICAL" : hasMaterial ? "WEAK" : "GOOD";
  return {
    STRUCTURE: input.length_status === "MATERIAL_OVERLOAD" ? "WEAK" : "GOOD",
    CLARITY: hasBlocking ? "WEAK" : "GOOD",
    ECONOMY:
      input.length_status === "OVERLONG" || input.length_status === "MATERIAL_OVERLOAD"
        ? "WEAK"
        : "GOOD",
    TRACEABILITY: hasTraceability ? base : "GOOD",
    TONE: hasTone ? "WEAK" : "GOOD",
    LEGAL_PRECISION: hasBlocking || hasMaterial ? base : "GOOD",
    EVIDENTIARY_PRECISION: hasTraceability ? base : "GOOD",
    PROCEDURAL_ALIGNMENT: hasProcedure ? base : "GOOD",
  };
}

export function generateRevisionSuggestion(findingToFix: QaFinding): RevisionSuggestion {
  return revisionSuggestionSchema.parse({
    suggestion_id: `suggestion-${findingToFix.finding_id}`,
    problem: findingToFix.explanation,
    why_it_matters:
      "The issue may weaken procedural credibility, traceability, or grantable relief.",
    severity: findingToFix.severity,
    proposed_fix:
      findingToFix.proposed_fix ?? "Revise the affected passage with source-calibrated wording.",
    strategy_change:
      ["BLOCKING", "MATERIAL"].includes(findingToFix.severity) &&
      findingToFix.category !== "EXCESS",
    human_review: findingToFix.human_review,
  });
}

export function validateAutoRevisionBoundary(input: {
  change_type:
    | "REPETITION"
    | "TONE"
    | "SENTENCE_CLARITY"
    | "STRUCTURE"
    | "CROSS_REFERENCE"
    | "REDUNDANT_CITATION"
    | "FACTUAL_FINDING"
    | "LEGAL_THEORY"
    | "REMEDY"
    | "CONCESSION"
    | "HUMAN_LOCKED_STRATEGY"
    | "PRECEDENT_CLASSIFICATION";
}): AutoRevisionBoundary {
  const autoAllowed = [
    "REPETITION",
    "TONE",
    "SENTENCE_CLARITY",
    "STRUCTURE",
    "CROSS_REFERENCE",
    "REDUNDANT_CITATION",
  ].includes(input.change_type);
  return {
    allowed: autoAllowed,
    reason: autoAllowed
      ? "The change is limited to drafting form and does not alter facts, legal theory, remedies, concessions, or locked strategy."
      : "The change touches strategic or substantive content and requires human approval.",
    human_review: autoAllowed ? "NONE" : "HUMAN_APPROVAL_REQUIRED",
  };
}

export function createBeforeAfterRewrite(input: BeforeAfterRewrite): BeforeAfterRewrite {
  return beforeAfterRewriteSchema.parse(input);
}

export function buildDraftVersion(input: DraftVersion): DraftVersion {
  return draftVersionSchema.parse(input);
}

function classifyReadiness(findings: QaFinding[]): {
  result: ReadinessResult;
  readiness: DraftReadiness;
} {
  if (findings.some((item) => item.severity === "BLOCKING")) {
    return { result: "BLOCKING_ISSUES", readiness: "NOT_READY" };
  }
  if (findings.some((item) => item.severity === "MATERIAL")) {
    return { result: "MATERIAL_ISSUES", readiness: "READY_WITH_MATERIAL_REVIEW" };
  }
  if (findings.some((item) => item.severity === "MANAGEABLE")) {
    return { result: "MANAGEABLE_ISSUES", readiness: "READY_WITH_MINOR_REVIEW" };
  }
  if (findings.some((item) => item.severity === "DRAFTING")) {
    return { result: "DRAFTING_ISSUES", readiness: "READY_WITH_MINOR_REVIEW" };
  }
  return { result: "NO_MATERIAL_ISSUE", readiness: "READY_FOR_HUMAN_APPROVAL" };
}

export function runFinalKillerQa(input: {
  assertions: DraftAssertion[];
  fact_findings?: QaFinding[];
  legal_findings?: QaFinding[];
  procedural_findings?: QaFinding[];
  adversarial_findings?: QaFinding[];
  judge_path_findings?: QaFinding[];
  mwc_findings?: QaFinding[];
  excess_findings?: QaFinding[];
  credibility_findings?: QaFinding[];
  unused_strength_findings?: QaFinding[];
  conflict_findings?: QaFinding[];
  claim_request_findings?: QaFinding[];
  drafting_findings?: QaFinding[];
  provenance: ProvenanceRef[];
}): FinalBriefQa {
  const assertionFindings = input.assertions.flatMap((assertion) => [
    ...checkFactTraceability(assertion),
    ...checkLegalTraceability(assertion),
  ]);
  const findings = [
    ...assertionFindings,
    ...(input.fact_findings ?? []),
    ...(input.legal_findings ?? []),
    ...(input.procedural_findings ?? []),
    ...(input.adversarial_findings ?? []),
    ...(input.judge_path_findings ?? []),
    ...(input.mwc_findings ?? []),
    ...(input.excess_findings ?? []),
    ...(input.credibility_findings ?? []),
    ...(input.unused_strength_findings ?? []),
    ...(input.conflict_findings ?? []),
    ...(input.claim_request_findings ?? []),
    ...(input.drafting_findings ?? []),
  ];
  const blocking = findings.filter((item) => item.severity === "BLOCKING");
  const material = findings.filter((item) => item.severity === "MATERIAL");
  const manageable = findings.filter((item) => item.severity === "MANAGEABLE");
  const drafting = findings.filter((item) => item.severity === "DRAFTING");
  const status = classifyReadiness(findings);
  return finalBriefQaSchema.parse({
    view_type: "FINAL_BRIEF_QA",
    source_of_truth: false,
    blocking_issues: blocking,
    material_issues: material,
    manageable_issues: manageable,
    drafting_issues: drafting,
    quality: evaluateDraftingQuality({ findings }),
    result: status.result,
    readiness: status.readiness,
    revision_suggestions: findings
      .filter((item) => item.severity !== "DRAFTING" || item.flag !== "PROCEDURALLY_CALIBRATED")
      .map(generateRevisionSuggestion),
    provenance: input.provenance,
  });
}
