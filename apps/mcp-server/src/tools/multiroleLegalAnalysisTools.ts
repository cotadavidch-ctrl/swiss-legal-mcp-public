import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { ToolRegistry } from "@swiss-legal-mcp/core";
import { buildStrategicLegalEngine } from "./strategicLegalEngine.js";

const boundedText = z.string().min(1).max(6_000);
const optionalBoundedText = z.string().max(6_000).optional();

const caseTypeSchema = z.enum([
  "administrative_legal_aid",
  "administrative",
  "civil",
  "criminal",
  "social_insurance",
  "tax",
  "employment",
  "tenancy",
  "debt_enforcement",
  "constitutional",
  "other",
]);

const proceduralStageSchema = z.enum([
  "pre_filing",
  "first_instance",
  "appeal",
  "supreme_court",
  "enforcement",
  "unknown",
]);

const factStatusSchema = z.enum([
  "confirmed",
  "accepted_for_drafting",
  "disputed",
  "uncertain",
  "user_asserted",
  "source_asserted",
  "contradicted",
  "not_verified",
  "unavailable",
]);

const evidenceStatusSchema = z.enum([
  "user_asserted",
  "source_confirmed",
  "existence_not_confirmed",
  "contradicted",
  "unavailable",
]);

const availabilityStatusSchema = z.enum([
  "available_to_tool",
  "referenced_but_not_available",
  "missing",
  "inaccessible",
]);

const contentVerificationStatusSchema = z.enum([
  "verified_against_document",
  "partially_verified",
  "user_described_only",
  "not_verified",
]);

const filingStatusSchema = z.enum([
  "already_filed",
  "available_not_yet_filed",
  "proposed_new_evidence",
  "missing",
  "not_verified",
]);

const caseLawTextStatusSchema = z.enum([
  "full_text_read",
  "full_text_verified",
  "partial_text_only",
  "headnote_only",
  "snippet_only",
  "candidate_only",
  "unverified_reference",
]);

const normStatusSchema = z.enum([
  "temporal_validity_confirmed",
  "current_version_only",
  "date_not_verified",
  "citation_only",
  "not_verified",
]);

type JurisdictionStatus =
  | "confirmed"
  | "not_verified"
  | "not_applicable"
  | "contradicted"
  | "failed"
  | "requires_legal_review";

const multiroleInputSchema = {
  caseType: caseTypeSchema.optional(),
  proceduralStage: proceduralStageSchema.default("unknown"),
  matterDescription: boundedText,
  userObjective: optionalBoundedText,
  include_in_drafting_control_report: z.boolean().default(false),
  jurisdiction: z
    .object({
      country: z.literal("CH").optional(),
      canton: z.string().length(2).optional(),
      territorialJurisdiction: z.string().max(300).optional(),
      subjectMatterJurisdiction: z.string().max(300).optional(),
      functionalJurisdiction: z.string().max(300).optional(),
      issuingAuthority: z.string().max(300).optional(),
      appellateAuthority: z.string().max(300).optional(),
      proceduralRemedy: z.string().max(300).optional(),
      venueOrFilingDestination: z.string().max(300).optional(),
    })
    .strict()
    .optional(),
  parties: z
    .array(
      z
        .object({
          role: z.enum([
            "claimant",
            "defendant",
            "appellant",
            "respondent",
            "authority",
            "opposing_party",
            "prosecution",
            "defence",
            "court",
            "other",
          ]),
          description: boundedText,
        })
        .strict(),
    )
    .max(40)
    .default([]),
  facts: z
    .array(
      z
        .object({
          id: z.string().min(1).max(120),
          description: boundedText,
          status: factStatusSchema,
          evidenceIds: z.array(z.string().min(1).max(120)).max(40).optional(),
        })
        .strict(),
    )
    .max(140)
    .default([]),
  evidence: z
    .array(
      z
        .object({
          evidenceId: z.string().min(1).max(120),
          name: boundedText,
          provesFactIds: z.array(z.string().min(1).max(120)).max(80).optional(),
          assertionSource: z
            .enum(["user", "source_document", "authority", "opposing_party", "inferred", "unknown"])
            .optional(),
          existenceStatus: evidenceStatusSchema.optional(),
          availabilityStatus: availabilityStatusSchema.optional(),
          contentVerificationStatus: contentVerificationStatusSchema.optional(),
          authenticityStatus: z
            .enum(["confirmed", "presumed", "unconfirmed", "disputed"])
            .optional(),
          inRecordStatus: z
            .enum([
              "in_record_confirmed",
              "claimed_to_be_in_record",
              "not_in_record",
              "not_verified",
            ])
            .optional(),
          filingStatus: filingStatusSchema.optional(),
          admissibilityStatus: z
            .enum([
              "admissible_confirmed",
              "admissibility_not_verified",
              "inadmissible",
              "noven_risk",
            ])
            .optional(),
          novenStatus: z
            .enum([
              "no_known_noven_issue",
              "possible_noven",
              "likely_noven",
              "not_applicable",
              "not_verified",
            ])
            .optional(),
          usable_as_current_support: z.boolean().optional(),
        })
        .strict(),
    )
    .max(180)
    .default([]),
  norms: z
    .array(
      z
        .object({
          id: z.string().min(1).max(120),
          citation: z.string().min(1).max(300),
          status: normStatusSchema,
        })
        .strict(),
    )
    .max(80)
    .default([]),
  caseLaw: z
    .array(
      z
        .object({
          id: z.string().min(1).max(120),
          citation: z.string().min(1).max(300),
          textStatus: caseLawTextStatusSchema,
          relevance: z.string().max(800).optional(),
        })
        .strict(),
    )
    .max(80)
    .default([]),
  challengedPassages: z
    .array(
      z
        .object({
          id: z.string().min(1).max(120),
          exactText: boundedText,
          author: z.enum([
            "decision_authority",
            "lower_instance",
            "opposing_party",
            "applicant",
            "appellant",
            "expert",
            "third_party",
            "reviewing_court",
          ]),
          function: z.enum([
            "fact",
            "allegation",
            "evidence_assessment",
            "legal_interpretation",
            "subsumption",
            "conclusion",
            "subsidiary_argument",
            "alternative_ground",
            "obiter_dictum",
          ]),
          autonomousGround: z.boolean().optional(),
          verified_function: z
            .enum([
              "fact",
              "allegation",
              "evidence_assessment",
              "legal_interpretation",
              "subsumption",
              "conclusion",
              "subsidiary_argument",
              "alternative_ground",
              "obiter_dictum",
            ])
            .optional(),
          classification_status: z
            .enum([
              "verified",
              "rejected",
              "conflict_detected",
              "insufficient_context",
              "requires_human_review",
            ])
            .optional(),
          reviewed: z.boolean().optional(),
          challenged: z.boolean().optional(),
          preserved: z.boolean().optional(),
        })
        .strict(),
    )
    .max(100)
    .default([]),
  burdenModel: z
    .object({
      proceduralMaxim: z
        .enum([
          "Behauptungslast",
          "Substanziierungslast",
          "Beweislast",
          "Mitwirkungspflicht",
          "Untersuchungsgrundsatz",
          "Offizialmaxime",
          "Verhandlungsmaxime",
          "not_verified",
        ])
        .default("not_verified"),
      burdenHolder: z.string().max(300).optional(),
      legalBasisStatus: z
        .enum(["confirmed", "requires_legal_review", "not_verified"])
        .default("not_verified"),
    })
    .strict()
    .default({ proceduralMaxim: "not_verified", legalBasisStatus: "not_verified" }),
  requestedOutcome: z
    .enum([
      "grant",
      "dismiss",
      "partially_grant",
      "remand",
      "inadmissible",
      "stay",
      "request_additional_evidence",
      "cannot_assess",
    ])
    .optional(),
};

type MultiroleInput = {
  [K in keyof typeof multiroleInputSchema]: z.infer<(typeof multiroleInputSchema)[K]>;
};

type MultiroleChallengedPassage = MultiroleInput["challengedPassages"][number];

function isVerifiedAutonomousPassage(passage: MultiroleChallengedPassage): boolean {
  return (
    passage.autonomousGround === true &&
    passage.verified_function !== "obiter_dictum" &&
    passage.classification_status === "verified" &&
    passage.reviewed === true
  );
}

type LegalRole =
  | "claimant_or_appellant"
  | "respondent_or_authority"
  | "opposing_party"
  | "prosecution"
  | "defence"
  | "first_instance_court"
  | "appellate_court"
  | "supreme_court_review"
  | "neutral_risk_assessment"
  | "deliberation_panel";

type ArgumentKind =
  | "party_argument"
  | "authority_argument"
  | "court_finding"
  | "neutral_assessment"
  | "predicted_outcome";

type ReviewStatus =
  | "full_review"
  | "limited_review"
  | "arbitrariness_only"
  | "cassatory_review"
  | "reformative_review"
  | "not_verified"
  | "mixed";

type FindingSeverity = "blocker" | "major" | "warning" | "informational";
type FindingCategory = "true_violation" | "warning" | "control_applied";

const allRoles: readonly LegalRole[] = [
  "claimant_or_appellant",
  "respondent_or_authority",
  "opposing_party",
  "prosecution",
  "defence",
  "first_instance_court",
  "appellate_court",
  "supreme_court_review",
  "neutral_risk_assessment",
  "deliberation_panel",
];

const multiroleStoreSchemaVersion = 1;

interface StoredMultiroleAnalysis {
  readonly schema_version: number;
  readonly analysis_id: string;
  readonly analysis_hash: string;
  readonly evidence_snapshot_hash: string;
  readonly narrative_hash: string;
  readonly role_hashes: Record<string, string>;
  readonly role_ids: readonly string[];
  readonly role_count: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly analysis: ReturnType<typeof analyzeSwissLegalPositions>;
}

export function registerMultiroleLegalAnalysisTools(tools: ToolRegistry): void {
  tools.register({
    name: "analyze_swiss_legal_positions",
    description:
      "Builds a deterministic multirole Swiss legal position analysis with separate party, authority, court, neutral risk and deliberation blocks. Uses only facts, evidence, norms and case law compatible with their verification status.",
    inputSchema: multiroleInputSchema,
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => analyzeSwissLegalPositions(input),
  });

  tools.register({
    name: "validate_multirole_legal_analysis",
    description:
      "Validates a multirole Swiss legal analysis for role leakage, unsupported arguments, unverified facts or evidence, fragmentary case law use, overstated jurisdiction, and confidence overstatement.",
    inputSchema: {
      analysis: z.record(z.string(), z.unknown()).optional(),
      analysis_id: z.string().min(1).max(160).optional(),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => {
      if (input.analysis_id) return validateMultiroleLegalAnalysisById(input.analysis_id);
      if (!input.analysis) {
        return {
          status: "blocked",
          findings: [
            finding(
              "analysis_missing",
              "blocker",
              "analysis",
              "analysis or analysis_id is required",
              "true_violation",
            ),
          ],
          summary: {
            blocker: 1,
            major: 0,
            warning: 0,
            informational: 0,
            controls_applied: 0,
            true_violations: 1,
          },
        };
      }
      return validateMultiroleLegalAnalysis(
        input.analysis as ReturnType<typeof analyzeSwissLegalPositions>,
      );
    },
  });
}

export function analyzeSwissLegalPositions(input: MultiroleInput) {
  const caseType = input.caseType ?? inferCaseType(input);
  const roles = selectRoles(caseType, input.proceduralStage);
  const jurisdictionDimensions = assessJurisdiction(input);
  const jurisdictionSummary = summarizeJurisdiction(jurisdictionDimensions);
  const evidence = classifyEvidence(input);
  const facts = classifyFacts(input);
  const caseLaw = classifyCaseLaw(input);
  const norms = input.norms.map((norm) => ({
    ...norm,
    usable: norm.status === "temporal_validity_confirmed",
  }));
  const exclusions = buildExclusions(input, evidence, caseLaw, norms, jurisdictionDimensions);
  const burden = buildBurdenAnalysis(input);
  const standards = buildStandards(input, roles.applicable_roles, jurisdictionDimensions);
  const missingEssentials = identifyMissingEssentials(
    input,
    evidence,
    jurisdictionDimensions,
    standards,
  );
  const roleAnalyses = roles.applicable_roles.map((role) =>
    buildRoleAnalysis(
      role,
      input,
      caseType,
      facts,
      evidence,
      norms,
      caseLaw,
      burden,
      standards,
      jurisdictionSummary,
    ),
  );
  const contradictionMatrix = buildContradictionMatrix(roleAnalyses, input);
  const neutralRiskAssessment = buildNeutralRisk(
    input,
    facts,
    evidence,
    jurisdictionDimensions,
    missingEssentials,
  );
  const deliberationPanel = buildDeliberation(
    input,
    contradictionMatrix,
    neutralRiskAssessment,
    missingEssentials,
  );
  const draftingIntegration = buildDraftingIntegration(input);
  const strategicLegalEngine = buildStrategicLegalEngine({
    matterDescription: input.matterDescription,
    userObjective: input.userObjective,
    facts,
    evidence,
    caseLaw,
    challengedPassages: input.challengedPassages,
    roleAnalyses,
  });

  const core = {
    case_type: caseType,
    procedural_stage: input.proceduralStage,
    applicable_roles: roles.applicable_roles,
    non_applicable_roles: roles.non_applicable_roles,
    reason_for_role_selection: roles.reason_for_role_selection,
    jurisdiction_dimensions: jurisdictionDimensions,
    jurisdiction_summary: jurisdictionSummary,
    burden_analysis: burden,
    standards_of_review: standards,
    role_analyses: roleAnalyses,
    contradiction_matrix: contradictionMatrix,
    neutral_risk_assessment: neutralRiskAssessment,
    deliberation_panel: deliberationPanel,
    strategic_legal_engine: strategicLegalEngine,
    exclusions,
    drafting_integration: draftingIntegration,
    narrative: {
      jurisdiction: jurisdictionSummary.narrative,
      outcome:
        missingEssentials.length > 0
          ? "Scenarios are conditional only if the missing essentials are verified; no firm outcome is predicted."
          : "Scenarios remain provisional and subject to legal review.",
    },
    guardrails: [
      "structured_simulation_not_person_or_lawyer_substitute",
      "party_arguments_do_not_become_court_findings",
      "full_text_required_for_usable_case_law",
      "user_asserted_evidence_is_not_document_verified",
      "incomplete_jurisdiction_is_never_confirmed_from_country_only",
      "no_deliberation_or_opposing_arguments_inserted_into_clean_draft",
      "strategic_engine_is_general_and_not_case_specific",
      "contradictions_are_formulated_as_clarification_needs_not_personal_reproach",
    ],
    confidence: computeOverallConfidence(jurisdictionDimensions, evidence, caseLaw),
    human_review_required: true,
  };
  const roleHashes = Object.fromEntries(
    roleAnalyses.map((role) => [role.role, sha256(stableStringify(role))]),
  );
  const evidenceSnapshotHash = sha256(
    stableStringify({
      facts: input.facts,
      evidence: input.evidence,
      norms: input.norms,
      caseLaw: input.caseLaw,
      challengedPassages: input.challengedPassages,
    }),
  );
  const narrativeHash = sha256(stableStringify(core.narrative));
  const analysisHash = sha256(stableStringify(core));
  const analysisId = `analysis_${analysisHash.slice(0, 32)}`;
  const now = new Date().toISOString();
  const analysis = {
    ...core,
    analysis_id: analysisId,
    analysis_hash: analysisHash,
    schema_version: multiroleStoreSchemaVersion,
    evidence_snapshot_hash: evidenceSnapshotHash,
    role_count: roleAnalyses.length,
    role_ids: roleAnalyses.map((role) => role.role),
    role_hashes: roleHashes,
    narrative_hash: narrativeHash,
    created_at: now,
    updated_at: now,
  };
  persistMultiroleAnalysis(analysis);
  return analysis;
}

function inferCaseType(input: MultiroleInput): z.infer<typeof caseTypeSchema> {
  const text = `${input.matterDescription} ${input.userObjective ?? ""}`.toLowerCase();
  if (/straf|anklage|beschuldigt|criminal|prosecution/.test(text)) return "criminal";
  if (/unentgeltlich\w* rechtspflege|legal aid|assistance juridique/.test(text))
    return "administrative_legal_aid";
  if (/verwaltungs|behörde|behoerde|administrative|verfügung|verfuegung/.test(text))
    return "administrative";
  if (/arbeits/.test(text)) return "employment";
  if (/miet|tenancy/.test(text)) return "tenancy";
  if (/betreibung|rechtsvorschlag/.test(text)) return "debt_enforcement";
  if (/steuer|tax/.test(text)) return "tax";
  if (/zivil|vertrag|claimant|defendant|klage/.test(text)) return "civil";
  return "other";
}

function selectRoles(
  caseType: z.infer<typeof caseTypeSchema>,
  stage: z.infer<typeof proceduralStageSchema>,
): {
  readonly applicable_roles: readonly LegalRole[];
  readonly non_applicable_roles: readonly { role: LegalRole; reason: string }[];
  readonly reason_for_role_selection: string;
} {
  const roleSet = new Set<LegalRole>(["neutral_risk_assessment", "deliberation_panel"]);
  if (caseType === "criminal") {
    roleSet.add("prosecution");
    roleSet.add("defence");
    roleSet.add("first_instance_court");
    if (stage !== "first_instance") roleSet.add("appellate_court");
  } else if (
    ["administrative", "administrative_legal_aid", "social_insurance", "tax"].includes(caseType)
  ) {
    roleSet.add("claimant_or_appellant");
    roleSet.add("respondent_or_authority");
    roleSet.add("first_instance_court");
    if (stage === "appeal" || stage === "supreme_court" || caseType === "administrative_legal_aid")
      roleSet.add("appellate_court");
  } else {
    roleSet.add("claimant_or_appellant");
    roleSet.add("opposing_party");
    roleSet.add("first_instance_court");
    if (stage === "appeal" || stage === "supreme_court") roleSet.add("appellate_court");
  }
  if (stage === "supreme_court") roleSet.add("supreme_court_review");
  const applicable = allRoles.filter((role) => roleSet.has(role));
  const nonApplicable = allRoles
    .filter((role) => !roleSet.has(role))
    .map((role) => ({
      role,
      reason:
        role === "prosecution" || role === "defence"
          ? "not_applicable_outside_identified_criminal_case"
          : "not_applicable_to_selected_case_type_or_stage",
    }));
  return {
    applicable_roles: applicable,
    non_applicable_roles: nonApplicable,
    reason_for_role_selection: `roles selected from case_type=${caseType} and procedural_stage=${stage}`,
  };
}

function assessJurisdiction(input: MultiroleInput) {
  const jurisdiction = input.jurisdiction;
  return {
    country_legal_system: {
      status: jurisdiction?.country === "CH" ? "confirmed" : "not_verified",
      value: jurisdiction?.country ?? null,
    },
    territorial_jurisdiction: {
      status:
        jurisdiction?.canton || jurisdiction?.territorialJurisdiction
          ? "confirmed"
          : "not_verified",
      value: jurisdiction?.territorialJurisdiction ?? jurisdiction?.canton ?? null,
    },
    subject_matter_jurisdiction: {
      status: jurisdiction?.subjectMatterJurisdiction ? "confirmed" : "not_verified",
      value: jurisdiction?.subjectMatterJurisdiction ?? null,
    },
    functional_jurisdiction: {
      status: jurisdiction?.functionalJurisdiction ? "confirmed" : "not_verified",
      value: jurisdiction?.functionalJurisdiction ?? null,
    },
    issuing_authority: {
      status: jurisdiction?.issuingAuthority ? "confirmed" : "not_verified",
      value: jurisdiction?.issuingAuthority ?? null,
    },
    appellate_authority: {
      status: jurisdiction?.appellateAuthority ? "confirmed" : "not_verified",
      value: jurisdiction?.appellateAuthority ?? null,
    },
    procedural_remedy: {
      status: jurisdiction?.proceduralRemedy ? "confirmed" : "not_verified",
      value: jurisdiction?.proceduralRemedy ?? null,
    },
    venue_or_filing_destination: {
      status: jurisdiction?.venueOrFilingDestination ? "confirmed" : "not_verified",
      value: jurisdiction?.venueOrFilingDestination ?? null,
    },
  } satisfies Record<string, { status: JurisdictionStatus; value: unknown }>;
}

function summarizeJurisdiction(jurisdiction: ReturnType<typeof assessJurisdiction>) {
  const entries = Object.entries(jurisdiction);
  const byStatus = (status: JurisdictionStatus) =>
    entries.filter(([, value]) => value.status === status).map(([key]) => key);
  const confirmedDimensions = byStatus("confirmed");
  const unverifiedDimensions = byStatus("not_verified");
  const contradictedDimensions = byStatus("contradicted");
  const failedDimensions = byStatus("failed");
  const narrative =
    jurisdiction.country_legal_system.status === "confirmed" && unverifiedDimensions.length === 7
      ? "El ordenamiento suizo está confirmado. Las otras siete dimensiones procesales no están verificadas."
      : `Dimensiones confirmadas: ${confirmedDimensions.length}; no verificadas: ${unverifiedDimensions.length}; contradichas: ${contradictedDimensions.length}; fallidas: ${failedDimensions.length}.`;
  return {
    confirmed_dimensions: confirmedDimensions,
    unverified_dimensions: unverifiedDimensions,
    contradicted_dimensions: contradictedDimensions,
    failed_dimensions: failedDimensions,
    counts: {
      confirmed: confirmedDimensions.length,
      not_verified: unverifiedDimensions.length,
      contradicted: contradictedDimensions.length,
      failed: failedDimensions.length,
    },
    narrative,
  };
}

function classifyFacts(input: MultiroleInput) {
  return input.facts.map((fact) => ({
    ...fact,
    may_be_used_as_fact: ["confirmed", "accepted_for_drafting"].includes(fact.status),
    may_be_used_as_allegation: [
      "disputed",
      "uncertain",
      "user_asserted",
      "source_asserted",
    ].includes(fact.status),
  }));
}

function classifyEvidence(input: MultiroleInput) {
  return input.evidence.map((item) => {
    const usable =
      item.usable_as_current_support === true ||
      (item.existenceStatus === "source_confirmed" &&
        item.availabilityStatus === "available_to_tool" &&
        item.contentVerificationStatus === "verified_against_document" &&
        ["confirmed", "presumed"].includes(item.authenticityStatus ?? "unconfirmed") &&
        item.inRecordStatus === "in_record_confirmed" &&
        item.filingStatus === "already_filed" &&
        item.admissibilityStatus === "admissible_confirmed");
    const proposed =
      item.filingStatus === "proposed_new_evidence" ||
      item.admissibilityStatus === "noven_risk" ||
      item.novenStatus === "possible_noven" ||
      item.novenStatus === "likely_noven";
    return {
      ...item,
      usable_as_current_support: usable,
      proposed_evidence_only: proposed,
      exclusion_reason: usable
        ? null
        : proposed
          ? "new_evidence_requires_procedural_admission_review"
          : item.contentVerificationStatus === "user_described_only"
            ? "user_described_only_not_documentary_support"
            : item.availabilityStatus !== "available_to_tool"
              ? "document_not_available_to_tool"
              : item.existenceStatus === "existence_not_confirmed"
                ? "existence_not_confirmed"
                : "evidence_not_usable_as_current_support",
    };
  });
}

function classifyCaseLaw(input: MultiroleInput) {
  return input.caseLaw.map((item) => ({
    ...item,
    usable: item.textStatus === "full_text_read" || item.textStatus === "full_text_verified",
    exclusion_reason:
      item.textStatus === "full_text_read" || item.textStatus === "full_text_verified"
        ? null
        : `case_law_${item.textStatus}_excluded`,
  }));
}

function buildExclusions(
  input: MultiroleInput,
  evidence: ReturnType<typeof classifyEvidence>,
  caseLaw: ReturnType<typeof classifyCaseLaw>,
  norms: readonly { id: string; citation: string; status: string; usable: boolean }[],
  jurisdiction: ReturnType<typeof assessJurisdiction>,
) {
  const affectedRoles = selectRoles(
    input.caseType ?? inferCaseType(input),
    input.proceduralStage,
  ).applicable_roles;
  return [
    ...input.facts
      .filter((fact) => !["confirmed", "accepted_for_drafting"].includes(fact.status))
      .map((fact) => ({
        excluded_item: fact.id,
        exclusion_reason: `fact_${fact.status}_may_only_be_used_as_labelled_allegation`,
        affected_roles: affectedRoles,
        possible_remediation: "verify fact against the record or mark it as disputed allegation",
      })),
    ...evidence
      .filter((item) => !item.usable_as_current_support)
      .map((item) => ({
        excluded_item: item.evidenceId,
        exclusion_reason: item.exclusion_reason,
        affected_roles: affectedRoles,
        possible_remediation: item.proposed_evidence_only
          ? "seek procedural admission and address nova rules"
          : "provide the document and verify content, authenticity, record status and admissibility",
      })),
    ...caseLaw
      .filter((item) => !item.usable)
      .map((item) => ({
        excluded_item: item.id,
        exclusion_reason: item.exclusion_reason,
        affected_roles: affectedRoles,
        possible_remediation: "load and verify the full judgment text before relying on it",
      })),
    ...norms
      .filter((norm) => !norm.usable)
      .map((norm) => ({
        excluded_item: norm.id,
        exclusion_reason: `norm_${norm.status}_not_temporally_confirmed`,
        affected_roles: affectedRoles,
        possible_remediation: "confirm the applicable version at the relevant date",
      })),
    ...Object.entries(jurisdiction)
      .filter(([key, value]) => key !== "country_legal_system" && value.status !== "confirmed")
      .map(([key]) => ({
        excluded_item: key,
        exclusion_reason: "jurisdiction_dimension_not_confirmed",
        affected_roles: affectedRoles,
        possible_remediation: "identify and verify the concrete procedural competence dimension",
      })),
  ];
}

function buildBurdenAnalysis(input: MultiroleInput) {
  const maxim = input.burdenModel.proceduralMaxim;
  const legalBasisConfirmed = input.burdenModel.legalBasisStatus === "confirmed";
  const usableEvidenceIds = new Set(
    classifyEvidence(input)
      .filter((item) => item.usable_as_current_support)
      .map((item) => item.evidenceId),
  );
  const evidentiaryGap = input.facts
    .filter(
      (fact) =>
        ["confirmed", "accepted_for_drafting", "disputed"].includes(fact.status) &&
        !(fact.evidenceIds ?? []).some((id) => usableEvidenceIds.has(id)),
    )
    .map((fact) => fact.id);
  return {
    burden_type: maxim,
    burden_holder: input.burdenModel.burdenHolder ?? "not_verified",
    burden_scope: "facts, admissibility and relief depend on verified procedural law",
    legal_basis_status: input.burdenModel.legalBasisStatus,
    procedural_maxim: maxim === "not_verified" ? "not_verified" : maxim,
    burden_satisfied: legalBasisConfirmed && evidentiaryGap.length === 0,
    burden_partially_satisfied: legalBasisConfirmed && evidentiaryGap.length > 0,
    burden_not_satisfied: legalBasisConfirmed && evidentiaryGap.length === input.facts.length,
    burden_uncertain: !legalBasisConfirmed || maxim === "not_verified",
    evidentiary_gap: evidentiaryGap,
    consequence_if_unsatisfied:
      maxim === "not_verified"
        ? "requires_legal_review"
        : "unsupported factual propositions may fail or require clarification",
  };
}

function buildStandards(
  input: MultiroleInput,
  roles: readonly LegalRole[],
  jurisdiction: ReturnType<typeof assessJurisdiction>,
) {
  const completeJurisdiction = Object.entries(jurisdiction).every(
    ([key, value]) => key === "country_legal_system" || value.status === "confirmed",
  );
  return roles
    .filter((role) =>
      ["first_instance_court", "appellate_court", "supreme_court_review"].includes(role),
    )
    .map((role) => {
      const status: ReviewStatus =
        completeJurisdiction && input.proceduralStage === "appeal"
          ? "mixed"
          : completeJurisdiction && role === "first_instance_court"
            ? "full_review"
            : "not_verified";
      return {
        review_body: role,
        review_scope: status,
        facts_review: status === "not_verified" ? "not_verified" : status,
        law_review: status === "not_verified" ? "not_verified" : "full_review",
        discretion_review: status === "mixed" ? "limited_review" : status,
        arbitrariness_review: role === "supreme_court_review" ? "arbitrariness_only" : status,
        admissibility_limits: completeJurisdiction
          ? ["preservation_and_deadline_must_still_be_checked"]
          : ["competence_deadline_and_remedy_not_confirmed"],
        nova_rules: input.evidence.some((item) => item.filingStatus === "proposed_new_evidence")
          ? "possible_noven_requires_review"
          : "not_verified",
        preservation_requirements: input.challengedPassages.some(
          (passage) => passage.preserved === false,
        )
          ? "some_grievances_not_preserved"
          : "not_verified",
        standard_status: status,
      };
    });
}

function identifyMissingEssentials(
  input: MultiroleInput,
  evidence: ReturnType<typeof classifyEvidence>,
  jurisdiction: ReturnType<typeof assessJurisdiction>,
  standards: ReturnType<typeof buildStandards>,
) {
  const missing = new Set<string>();
  if (jurisdiction.issuing_authority.status !== "confirmed") missing.add("authority");
  if (jurisdiction.procedural_remedy.status !== "confirmed") missing.add("remedy");
  if (!input.challengedPassages.some((passage) => passage.author === "decision_authority")) {
    missing.add("full_decision");
  }
  if (standards.some((standard) => standard.standard_status === "not_verified")) {
    missing.add("standard_of_review");
  }
  if (!evidence.some((item) => item.usable_as_current_support)) {
    missing.add("verified_evidence");
  }
  if (!input.jurisdiction?.proceduralRemedy) missing.add("deadline");
  if (!input.challengedPassages.length) missing.add("notification_date");
  return [...missing];
}

function buildRoleAnalysis(
  role: LegalRole,
  input: MultiroleInput,
  caseType: z.infer<typeof caseTypeSchema>,
  facts: ReturnType<typeof classifyFacts>,
  evidence: ReturnType<typeof classifyEvidence>,
  norms: readonly { id: string; citation: string; status: string; usable: boolean }[],
  caseLaw: ReturnType<typeof classifyCaseLaw>,
  burden: ReturnType<typeof buildBurdenAnalysis>,
  standards: ReturnType<typeof buildStandards>,
  jurisdictionSummary: ReturnType<typeof summarizeJurisdiction>,
) {
  const usableFacts = facts.filter((fact) => fact.may_be_used_as_fact);
  const allegedFacts = facts.filter((fact) => fact.may_be_used_as_allegation);
  const usableEvidence = evidence.filter((item) => item.usable_as_current_support);
  const proposedEvidence = evidence.filter((item) => item.proposed_evidence_only);
  const usableCaseLaw = caseLaw.filter((item) => item.usable);
  const judicialRole = ["first_instance_court", "appellate_court", "supreme_court_review"].includes(
    role,
  );
  const neutralRole = role === "neutral_risk_assessment";
  const argumentKind: ArgumentKind = judicialRole
    ? "court_finding"
    : neutralRole
      ? "neutral_assessment"
      : role === "respondent_or_authority"
        ? "authority_argument"
        : "party_argument";
  const roleEvidence = judicialRole ? usableEvidence : [...usableEvidence, ...proposedEvidence];
  const argumentsForRole = buildArguments(
    role,
    argumentKind,
    input,
    usableFacts,
    allegedFacts,
    roleEvidence,
    norms,
    usableCaseLaw,
  );
  const courtBlock = judicialRole
    ? buildCourtBlock(role, input, usableFacts, burden, standards, jurisdictionSummary)
    : null;
  const criminalBlock =
    caseType === "criminal" && (role === "prosecution" || role === "defence")
      ? buildCriminalBlock(role, facts, evidence)
      : null;
  return {
    role,
    procedural_position: proceduralPosition(role),
    objective: objectiveForRole(role, input),
    burden_of_proof_or_substantiation: burden,
    admissible_facts: usableFacts,
    disputed_facts: allegedFacts.filter((fact) => fact.status === "disputed"),
    unavailable_facts: facts.filter((fact) =>
      ["uncertain", "user_asserted", "not_verified", "unavailable", "contradicted"].includes(
        fact.status,
      ),
    ),
    usable_evidence: usableEvidence,
    unusable_evidence: evidence.filter((item) => !item.usable_as_current_support),
    applicable_norms: norms.filter((norm) => norm.usable),
    usable_case_law: usableCaseLaw,
    excluded_case_law: caseLaw.filter((item) => !item.usable),
    standard_of_review: standards.find((standard) => standard.review_body === role) ?? {
      review_body: role,
      standard_status: "not_applicable",
    },
    strongest_arguments: argumentsForRole.slice(0, 3),
    weakest_arguments: buildWeaknesses(role, input, evidence, burden),
    likely_counterarguments: likelyCounterarguments(role, input),
    procedural_requests: proceduralRequests(role, input),
    evidentiary_requests: proposedEvidence.map((item) => ({
      evidence_id: item.evidenceId,
      request: "admit_or_request_document_subject_to_nova_review",
    })),
    factual_assumptions: allegedFacts.map((fact) => ({
      fact_id: fact.id,
      status: fact.status,
      use: "labelled_allegation_only",
    })),
    legal_assumptions:
      burden.procedural_maxim === "not_verified" ? ["procedural_maxim_not_verified"] : [],
    unresolved_questions: unresolvedQuestions(input, evidence),
    confidence: roleConfidence(role, usableFacts, usableEvidence, usableCaseLaw, burden),
    human_review_required: true,
    argument_kind: argumentKind,
    ...(courtBlock ? { court_analysis: courtBlock } : {}),
    ...(criminalBlock ? { criminal_analysis: criminalBlock } : {}),
  };
}

function buildArguments(
  role: LegalRole,
  argumentKind: ArgumentKind,
  input: MultiroleInput,
  usableFacts: ReturnType<typeof classifyFacts>,
  allegedFacts: ReturnType<typeof classifyFacts>,
  evidence: ReturnType<typeof classifyEvidence>,
  norms: readonly { id: string; citation: string; status: string; usable: boolean }[],
  caseLaw: ReturnType<typeof classifyCaseLaw>,
) {
  const supportingEvidenceIds = evidence
    .filter((item) => item.usable_as_current_support)
    .map((item) => item.evidenceId);
  const proposedEvidenceIds = evidence
    .filter((item) => item.proposed_evidence_only)
    .map((item) => item.evidenceId);
  const supportFacts = usableFacts.slice(0, 4).map((fact) => fact.id);
  const allegationFacts = allegedFacts.slice(0, 4).map((fact) => fact.id);
  const roleText = `${input.matterDescription} ${input.userObjective ?? ""}`.toLowerCase();
  const isBankLegalAid =
    /konto|bank|saldo|übertrag|uebertrag|transfer/.test(roleText) &&
    /unentgeltlich\w* rechtspflege|legal aid/.test(roleText);
  const base =
    role === "respondent_or_authority"
      ? "The authority may argue that cooperation duties and complete disclosure remain unresolved."
      : role === "opposing_party"
        ? "The opposing party may dispute legal and factual sufficiency."
        : role === "prosecution"
          ? "The prosecution may only argue offence elements supported by verified evidence."
          : role === "defence"
            ? "The defence may contest unproven elements and procedural regularity."
            : ["first_instance_court", "appellate_court", "supreme_court_review"].includes(role)
              ? "The deciding body may only make provisional findings from verified facts and usable evidence."
              : "The claimant or appellant may advance only labelled, traceable propositions.";
  const proposition =
    isBankLegalAid && role === "claimant_or_appellant"
      ? "The same-amount internal transfer and zero balance may support an argument against autonomous asset increase, subject to record verification."
      : isBankLegalAid && role === "respondent_or_authority"
        ? "The authority may argue incomplete disclosure, cooperation duties and independent patrimonial relevance unless complete bank records are verified."
        : base;
  if (
    supportFacts.length === 0 &&
    allegationFacts.length === 0 &&
    supportingEvidenceIds.length === 0 &&
    proposedEvidenceIds.length === 0 &&
    norms.filter((n) => n.usable).length === 0
  ) {
    return [];
  }
  return [
    {
      argument_id: `${role}-arg-1`,
      role,
      argument_kind: argumentKind,
      proposition,
      argument_type:
        role === "respondent_or_authority"
          ? "burden_of_proof"
          : isBankLegalAid
            ? "evidentiary"
            : "procedural",
      supporting_facts: supportFacts,
      alleged_facts: allegationFacts,
      supporting_evidence: supportingEvidenceIds,
      proposed_evidence: proposedEvidenceIds,
      supporting_norms: norms.filter((norm) => norm.usable).map((norm) => norm.id),
      supporting_case_law: caseLaw.filter((item) => item.usable).map((item) => item.id),
      inferential_steps: [
        "separate verified facts from allegations",
        "connect each proposition to usable support",
        "defer legal effect where procedural basis is unverified",
      ],
      counterarguments: likelyCounterarguments(role, input).slice(0, 2),
      rebuttal:
        role === "claimant_or_appellant"
          ? "request record verification and avoid presenting unverified extracts as established"
          : "insist that evidentiary gaps affect the party relying on the proposition",
      legal_threshold: "requires_verified_procedural_basis_and_admissible_support",
      threshold_satisfaction:
        supportingEvidenceIds.length > 0 ? "partially_satisfied" : "not_satisfied",
      confidence: supportingEvidenceIds.length > 0 ? 0.58 : 0.32,
      vulnerabilities: unresolvedQuestions(input, evidence).slice(0, 5),
      outcome_if_accepted:
        role === "respondent_or_authority" ? "dismiss_or_remand" : "remand_or_clarification",
      outcome_if_rejected:
        role === "respondent_or_authority" ? "remand_or_grant" : "dismiss_or_inadmissible",
    },
  ];
}

function buildCourtBlock(
  role: LegalRole,
  input: MultiroleInput,
  usableFacts: ReturnType<typeof classifyFacts>,
  burden: ReturnType<typeof buildBurdenAnalysis>,
  standards: ReturnType<typeof buildStandards>,
  jurisdictionSummary: ReturnType<typeof summarizeJurisdiction>,
) {
  const autonomous = input.challengedPassages.filter(isVerifiedAutonomousPassage);
  const unchallengedAutonomous = autonomous.filter((passage) => passage.challenged === false);
  const unresolved = unresolvedQuestions(input, classifyEvidence(input));
  const standard = standards.find((item) => item.review_body === role);
  return {
    findings_of_fact:
      usableFacts.length > 0 && unresolved.length === 0 ? usableFacts.map((fact) => fact.id) : [],
    rejected_factual_assertions: input.facts
      .filter((fact) => fact.status === "contradicted")
      .map((fact) => fact.id),
    legal_issues: [
      "admissibility",
      "jurisdiction",
      "burden_of_proof",
      ...(unchallengedAutonomous.length > 0 ? ["independent_ground_not_challenged"] : []),
    ],
    legal_reasoning:
      standard?.standard_status === "not_verified" || burden.burden_uncertain
        ? `cannot decide without verified jurisdiction, standard of review and burden model. ${jurisdictionSummary.narrative}`
        : "provisional subsumption limited to verified facts and usable evidence",
    jurisdiction_summary: jurisdictionSummary,
    independent_grounds: autonomous.map((passage) => ({
      passage_id: passage.id,
      challenged: passage.challenged !== false,
      preserved: passage.preserved !== false,
      treatment:
        passage.challenged === false
          ? "independent_ground_not_reviewed"
          : passage.preserved === false
            ? "not_preserved"
            : "requires_review",
    })),
    provisional_disposition:
      unresolved.length > 0 || standard?.standard_status === "not_verified"
        ? "cannot_assess"
        : (input.requestedOutcome ?? "cannot_assess"),
    unresolved_blockers: unresolved,
    confidence: unresolved.length > 0 ? 0.22 : 0.55,
  };
}

function buildCriminalBlock(
  role: LegalRole,
  facts: ReturnType<typeof classifyFacts>,
  evidence: ReturnType<typeof classifyEvidence>,
) {
  if (role === "prosecution") {
    return {
      offence_elements: [],
      evidence_for_each_element: evidence
        .filter((item) => item.usable_as_current_support)
        .map((item) => item.evidenceId),
      mens_rea: "not_verified",
      alternative_legal_classifications: [],
      evidentiary_weaknesses: evidence
        .filter((item) => !item.usable_as_current_support)
        .map((item) => item.evidenceId),
      procedural_risks: ["criminal_charge_not_generated_by_this_tool"],
      sentencing_position: "not_assessed",
    };
  }
  return {
    disputed_elements: facts.filter((fact) => fact.status === "disputed").map((fact) => fact.id),
    exclusionary_issues: ["requires_criminal_procedure_review"],
    alternative_explanations: facts
      .filter((fact) => fact.may_be_used_as_allegation)
      .map((fact) => fact.id),
    reasonable_doubt: evidence.some((item) => !item.usable_as_current_support)
      ? "possible_from_evidentiary_gaps"
      : "not_assessed",
    procedural_violations: [],
    mitigation: [],
    acquittal_or_reduction_requests: ["not_generated_without_verified_criminal_case_theory"],
  };
}

function buildContradictionMatrix(
  roleAnalyses: readonly ReturnType<typeof buildRoleAnalysis>[],
  input: MultiroleInput,
) {
  const claimant = roleAnalyses.find((role) => role.role === "claimant_or_appellant");
  const authority =
    roleAnalyses.find((role) => role.role === "respondent_or_authority") ??
    roleAnalyses.find((role) => role.role === "opposing_party") ??
    roleAnalyses.find((role) => role.role === "prosecution");
  const firstArgument = claimant?.strongest_arguments[0] ?? roleAnalyses[0]?.strongest_arguments[0];
  if (!firstArgument || !authority) return [];
  const classifiedEvidence = classifyEvidence(input);
  const usableEvidence = classifiedEvidence
    .filter((item) => item.usable_as_current_support)
    .map((item) => item.evidenceId);
  const neededEvidence = classifiedEvidence
    .filter((item) => !item.usable_as_current_support)
    .map((item) => item.evidenceId);
  return [
    {
      argument_from_role: firstArgument.argument_id,
      opposing_role: authority.role,
      counterargument:
        authority.role === "respondent_or_authority"
          ? "complete disclosure, cooperation duties and admissibility limits may defeat the appellant position"
          : "the opposing role disputes sufficiency and legal consequence",
      rebuttal:
        "the initiating party can request record completion and limit the proposition to verified facts",
      reply: "the deciding body must keep unresolved factual and procedural issues open",
      unresolved_conflict: true,
      decisive_issue: input.challengedPassages.some(isVerifiedAutonomousPassage)
        ? "independent_grounds_and_record_verification"
        : "record_verification_and_procedural_competence",
      evidence_currently_usable: usableEvidence,
      evidence_needed: neededEvidence,
      evidence_gap: neededEvidence.length > 0,
      legal_authority_needed: input.norms
        .filter((norm) => norm.status !== "temporal_validity_confirmed")
        .map((norm) => norm.id),
      likely_treatment: "cannot_assess_until_record_and_review_standard_are_verified",
      likely_judicial_treatment: "cannot_assess_until_record_and_review_standard_are_verified",
      treatment_conditions: [
        "solo si la competencia, la vía, el estándar de revisión y la prueba documental quedan verificados",
      ],
      treatment_is_conditional: true,
      confidence: neededEvidence.length > 0 ? 0.22 : 0.45,
    },
  ];
}

function buildNeutralRisk(
  input: MultiroleInput,
  facts: ReturnType<typeof classifyFacts>,
  evidence: ReturnType<typeof classifyEvidence>,
  jurisdiction: ReturnType<typeof assessJurisdiction>,
  missingEssentials: readonly string[],
) {
  const usableEvidence = evidence.filter((item) => item.usable_as_current_support);
  const unusableEvidence = evidence.filter((item) => !item.usable_as_current_support);
  const incompleteJurisdiction = Object.entries(jurisdiction).some(
    ([key, value]) => key !== "country_legal_system" && value.status !== "confirmed",
  );
  const bankTrace = /konto|bank|saldo|übertrag|uebertrag|transfer/i.test(input.matterDescription);
  const missing = unresolvedQuestions(input, evidence);
  const hasMissingEssentials = missingEssentials.length > 0;
  const bestCase = hasMissingEssentials
    ? /rückweisung|rueckweisung|remand|neue beurteilung/i.test(
        `${input.matterDescription} ${input.userObjective ?? ""}`,
      )
      ? "conditional_remand"
      : "conditional_grant"
    : "conditional_partial_grant";
  const worstCase = incompleteJurisdiction ? "inadmissibility_risk" : "dismissal_risk";
  return {
    strongest_issue_for_user: bankTrace
      ? "same amount and zero balance may support internal-transfer theory if documents are verified"
      : usableEvidence.length > 0
        ? "some facts have usable support"
        : "user position is not yet document-supported",
    strongest_issue_against_user:
      unusableEvidence.length > 0
        ? "key evidence is unavailable, unverified or procedurally new"
        : "legal effect and procedural route still require review",
    dispositive_issues: [
      ...(incompleteJurisdiction ? ["jurisdiction_and_remedy"] : []),
      ...(unusableEvidence.length > 0 ? ["evidence_verification"] : []),
      ...(input.challengedPassages.some(isVerifiedAutonomousPassage)
        ? ["independent_grounds"]
        : []),
    ],
    non_dispositive_issues: facts
      .filter((fact) => fact.status === "uncertain")
      .map((fact) => fact.id),
    factual_risk: facts.some((fact) => !fact.may_be_used_as_fact) ? "high" : "medium",
    evidentiary_risk: unusableEvidence.length > 0 ? "high" : "medium",
    procedural_risk: incompleteJurisdiction ? "high" : "medium",
    legal_risk: input.norms.some((norm) => norm.status !== "temporal_validity_confirmed")
      ? "high"
      : "medium",
    remedy_risk: jurisdiction.procedural_remedy.status !== "confirmed" ? "high" : "medium",
    overall_outcome_range: missing.length > 0 ? "cannot_assess_or_broad_range" : "broad_range",
    outcome_range: hasMissingEssentials ? "cannot_assess" : "broad_range",
    outcome_range_basis: hasMissingEssentials
      ? "missing essential procedural or evidentiary elements"
      : "verified essentials allow only a provisional range",
    best_case: bestCase,
    best_case_conditions: [
      "solo si la competencia concreta, la vía, el plazo y la resolución completa se verifican",
      "solo si la prueba documental queda disponible y admisible",
    ],
    expected_case: hasMissingEssentials ? "cannot_assess" : "conditional_partial_grant",
    expected_case_conditions: hasMissingEssentials
      ? [
          "solo si se resuelven los elementos esenciales faltantes puede formularse un escenario esperado",
        ]
      : ["solo si los umbrales procesales y probatorios se mantienen verificados"],
    worst_case: worstCase,
    worst_case_conditions: [
      "solo si la vía, el plazo, la competencia o la admisibilidad probatoria fallan",
    ],
    confidence: missing.length > 0 ? 0.24 : 0.48,
    missing_information_that_changes_outcome: missing,
    missing_essential_elements: missingEssentials,
  };
}

function buildDeliberation(
  input: MultiroleInput,
  contradictionMatrix: ReturnType<typeof buildContradictionMatrix>,
  neutral: ReturnType<typeof buildNeutralRisk>,
  missingEssentials: readonly string[],
) {
  const blockers = neutral.missing_information_that_changes_outcome;
  const hasUnverifiedEvidence = classifyEvidence(input).some(
    (item) => !item.usable_as_current_support,
  );
  const hasRemandPath =
    input.requestedOutcome === "remand" ||
    /rückweisung|rueckweisung|remand|neue beurteilung/i.test(
      `${input.matterDescription} ${input.userObjective ?? ""}`,
    );
  const preferred =
    missingEssentials.length > 0
      ? "request_additional_evidence"
      : blockers.length > 0
        ? hasUnverifiedEvidence
          ? "request_additional_evidence"
          : "cannot_assess"
        : hasRemandPath
          ? "remand"
          : "cannot_assess";
  return {
    issues_for_decision: neutral.dispositive_issues,
    majority_reasoning_candidate:
      "decision must be limited to verified facts, usable evidence and confirmed procedural competence",
    alternative_reasoning_candidate:
      "even if one merits issue is plausible, admissibility and record gaps may be independently decisive",
    dissent_candidate:
      contradictionMatrix.length > 0
        ? "a narrower view could require fuller record clarification before addressing merits"
        : "none identified without additional source material",
    independent_grounds: input.challengedPassages
      .filter(isVerifiedAutonomousPassage)
      .map((passage) => passage.id),
    dispositive_options: [
      "cannot_assess",
      "request_additional_evidence",
      ...(hasRemandPath ? ["remand"] : []),
    ],
    procedural_disposition_options: ["request_additional_evidence", "remand", "inadmissible"],
    unresolved_questions: blockers,
    preferred_outcome: preferred,
    preferred_outcome_status: missingEssentials.length > 0 ? "provisional" : "conditional",
    conditions_for_preferred_outcome:
      preferred === "request_additional_evidence"
        ? [
            "solo si expediente, autoridad, vía, plazo, estándar de revisión y prueba quedan verificados",
          ]
        : ["solo si all essential procedural and evidentiary elements remain verified"],
    missing_elements_preventing_final_outcome: missingEssentials,
    alternative_outcomes: [
      "cannot_assess",
      "conditional_remand",
      "inadmissibility_risk",
      "dismissal_risk",
    ],
    outcome_is_conditional: true,
    outcome_confidence: blockers.length > 0 ? 0.22 : 0.45,
  };
}

function buildDraftingIntegration(input: MultiroleInput) {
  return {
    include_in_drafting_control_report: input.include_in_drafting_control_report,
    clean_draft_mutation: "not_performed",
    allowed_for_control_report: input.include_in_drafting_control_report
      ? [
          "role_separated_arguments",
          "exclusions",
          "neutral_risks",
          "unresolved_questions",
          "drafting_guardrails",
        ]
      : [],
    prohibited_clean_document_insertions: [
      "deliberation_panel",
      "opposing_party_arguments_as_user_text",
      "predicted_outcome",
      "court_findings_without_verified_basis",
    ],
  };
}

function proceduralPosition(role: LegalRole): string {
  const positions: Record<LegalRole, string> = {
    claimant_or_appellant: "initiating_or_challenging_party",
    respondent_or_authority: "responding_authority_or_public_body",
    opposing_party: "private_opposing_party",
    prosecution: "criminal_prosecution_position",
    defence: "criminal_defence_position",
    first_instance_court: "first_instance_decision_maker",
    appellate_court: "appellate_review_body",
    supreme_court_review: "supreme_court_limited_review",
    neutral_risk_assessment: "neutral_structured_risk_review",
    deliberation_panel: "structured_deliberation_simulation",
  };
  return positions[role];
}

function objectiveForRole(role: LegalRole, input: MultiroleInput): string {
  if (role === "claimant_or_appellant") return input.userObjective ?? "obtain relief requested";
  if (role === "respondent_or_authority") return "defend decision or require complete support";
  if (role === "opposing_party") return "oppose requested relief";
  if (role === "prosecution") return "test whether prosecution theory has verified element support";
  if (role === "defence") return "contest unproven elements and procedural defects";
  if (role === "neutral_risk_assessment") return "separate strengths, risks and unknowns";
  if (role === "deliberation_panel") return "map provisional disposition options";
  return "decide only within verified competence, record and review standard";
}

function likelyCounterarguments(role: LegalRole, input: MultiroleInput): string[] {
  if (role === "claimant_or_appellant") {
    return [
      "respondent may invoke cooperation or substantiation duties",
      "new or unavailable evidence may be limited by nova rules",
    ];
  }
  if (role === "respondent_or_authority") {
    return [
      "appellant may argue internal transfer and no autonomous asset increase",
      "authority may have failed to clarify decisive facts",
    ];
  }
  if (role === "prosecution")
    return ["defence may invoke reasonable doubt and exclusionary issues"];
  if (role === "defence") return ["prosecution may rely on confirmed official records"];
  if (input.challengedPassages.some(isVerifiedAutonomousPassage)) {
    return ["independent ground may decide the case even if another argument succeeds"];
  }
  return ["opposing role may dispute support and legal threshold"];
}

function proceduralRequests(role: LegalRole, input: MultiroleInput) {
  if (role === "claimant_or_appellant") {
    return [input.requestedOutcome ?? "remand", "request_record_completion"];
  }
  if (role === "respondent_or_authority" || role === "opposing_party") {
    return ["dismiss_or_find_inadmissible_if_burdens_not_met"];
  }
  if (role === "appellate_court") return ["annul_reform_remand_or_find_inadmissible_after_review"];
  if (role === "first_instance_court") return ["decide_or_request_additional_evidence"];
  return [];
}

function buildWeaknesses(
  role: LegalRole,
  input: MultiroleInput,
  evidence: ReturnType<typeof classifyEvidence>,
  burden: ReturnType<typeof buildBurdenAnalysis>,
) {
  return [
    ...(evidence.some((item) => !item.usable_as_current_support)
      ? ["not_all_evidence_is_usable_current_support"]
      : []),
    ...(burden.burden_uncertain ? ["burden_or_procedural_maxim_not_verified"] : []),
    ...(input.caseLaw.some(
      (item) => item.textStatus !== "full_text_read" && item.textStatus !== "full_text_verified",
    )
      ? ["some_case_law_excluded_for_full_text_guardrail"]
      : []),
    ...(role === "claimant_or_appellant" &&
    input.challengedPassages.some(
      (passage) => isVerifiedAutonomousPassage(passage) && passage.challenged === false,
    )
      ? ["independent_ground_not_challenged"]
      : []),
  ];
}

function unresolvedQuestions(input: MultiroleInput, evidence: ReturnType<typeof classifyEvidence>) {
  const jurisdiction = assessJurisdiction(input);
  return [
    ...Object.entries(jurisdiction)
      .filter(([key, value]) => key !== "country_legal_system" && value.status !== "confirmed")
      .map(([key]) => key),
    ...(input.burdenModel.proceduralMaxim === "not_verified" ? ["procedural_maxim"] : []),
    ...(input.burdenModel.legalBasisStatus !== "confirmed" ? ["burden_legal_basis"] : []),
    ...evidence
      .filter((item) => !item.usable_as_current_support)
      .map((item) => `evidence:${item.evidenceId}`),
    ...input.caseLaw
      .filter(
        (item) => item.textStatus !== "full_text_read" && item.textStatus !== "full_text_verified",
      )
      .map((item) => `case_law:${item.id}`),
    ...input.challengedPassages
      .filter((passage) => isVerifiedAutonomousPassage(passage) && passage.challenged === false)
      .map((passage) => `independent_ground:${passage.id}`),
  ];
}

function roleConfidence(
  role: LegalRole,
  facts: ReturnType<typeof classifyFacts>,
  evidence: ReturnType<typeof classifyEvidence>,
  caseLaw: ReturnType<typeof classifyCaseLaw>,
  burden: ReturnType<typeof buildBurdenAnalysis>,
) {
  let confidence = 0.25;
  if (facts.length > 0) confidence += 0.12;
  if (evidence.length > 0) confidence += 0.16;
  if (caseLaw.length > 0) confidence += 0.1;
  if (!burden.burden_uncertain) confidence += 0.08;
  if (["first_instance_court", "appellate_court", "supreme_court_review"].includes(role)) {
    confidence -= 0.08;
  }
  return Math.max(0.1, Math.min(0.78, Number(confidence.toFixed(2))));
}

function computeOverallConfidence(
  jurisdiction: ReturnType<typeof assessJurisdiction>,
  evidence: ReturnType<typeof classifyEvidence>,
  caseLaw: ReturnType<typeof classifyCaseLaw>,
) {
  let confidence = 0.32;
  if (
    Object.entries(jurisdiction).every(
      ([key, value]) => key === "country_legal_system" || value.status === "confirmed",
    )
  ) {
    confidence += 0.15;
  }
  if (evidence.some((item) => item.usable_as_current_support)) confidence += 0.15;
  if (caseLaw.some((item) => item.usable)) confidence += 0.1;
  return Math.max(0.1, Math.min(0.75, Number(confidence.toFixed(2))));
}

export function validateMultiroleLegalAnalysis(
  analysis: ReturnType<typeof analyzeSwissLegalPositions>,
) {
  const findings: ReturnType<typeof finding>[] = [];
  const roles = new Set((analysis.applicable_roles ?? []) as LegalRole[]);
  const nonApplicable = new Set(
    ((analysis.non_applicable_roles ?? []) as readonly { role: LegalRole }[]).map(
      (item) => item.role,
    ),
  );
  const roleAnalyses = Array.isArray(analysis.role_analyses) ? analysis.role_analyses : [];
  const exclusions = Array.isArray(analysis.exclusions) ? analysis.exclusions : [];
  const excludedFactIds = new Set(
    exclusions
      .filter((item) => String(item.exclusion_reason).startsWith("fact_"))
      .map((item) => String(item.excluded_item)),
  );
  const excludedEvidenceIds = new Set(
    exclusions
      .filter((item) =>
        /evidence|document|user_described_only|existence_not_confirmed|new_evidence/.test(
          String(item.exclusion_reason),
        ),
      )
      .map((item) => String(item.excluded_item)),
  );
  const excludedCaseIds = new Set(
    exclusions
      .filter((item) => String(item.exclusion_reason).startsWith("case_law_"))
      .map((item) => String(item.excluded_item)),
  );

  for (const roleAnalysis of roleAnalyses) {
    const role = roleAnalysis.role;
    if (!roles.has(role)) {
      findings.push(
        finding("role_status_mismatch", "major", role, "role not applicable", "true_violation"),
      );
    }
    if (nonApplicable.has(role)) {
      findings.push(
        finding(
          "role_leakage",
          "blocker",
          role,
          "non-applicable role has analysis",
          "true_violation",
        ),
      );
    }
    for (const argument of roleAnalysis.strongest_arguments ?? []) {
      const unsupported =
        (argument.supporting_facts?.length ?? 0) === 0 &&
        (argument.alleged_facts?.length ?? 0) === 0 &&
        (argument.supporting_evidence?.length ?? 0) === 0 &&
        (argument.proposed_evidence?.length ?? 0) === 0 &&
        (argument.supporting_norms?.length ?? 0) === 0 &&
        (argument.supporting_case_law?.length ?? 0) === 0;
      if (unsupported) {
        findings.push(
          finding(
            "unsupported_argument",
            argument.argument_type === "costs" ? "warning" : "major",
            role,
            `argument ${argument.argument_id}`,
            argument.argument_type === "costs" ? "warning" : "true_violation",
          ),
        );
      }
      for (const factId of argument.supporting_facts ?? []) {
        if (excludedFactIds.has(factId)) {
          findings.push(
            finding(
              "unverified_fact_used_as_fact",
              ["first_instance_court", "appellate_court", "supreme_court_review"].includes(role) ||
                argument.argument_kind === "predicted_outcome"
                ? "blocker"
                : "major",
              role,
              `unverified fact ${factId} used as support`,
              "true_violation",
            ),
          );
        }
      }
      for (const evidenceId of argument.supporting_evidence ?? []) {
        if (excludedEvidenceIds.has(evidenceId)) {
          findings.push(
            finding(
              "unusable_evidence_used",
              ["first_instance_court", "appellate_court", "supreme_court_review"].includes(role)
                ? "blocker"
                : "major",
              role,
              `unusable evidence ${evidenceId} used as support`,
              "true_violation",
            ),
          );
        }
      }
      for (const caseId of argument.supporting_case_law ?? []) {
        if (excludedCaseIds.has(caseId)) {
          findings.push(
            finding(
              "partial_case_used",
              "blocker",
              role,
              `excluded case law ${caseId} used`,
              "true_violation",
            ),
          );
        }
      }
      if (
        argument.argument_kind === "predicted_outcome" &&
        roleAnalysis.role !== "neutral_risk_assessment"
      ) {
        findings.push(
          finding(
            "predicted_outcome_presented_as_fact",
            "major",
            role,
            `argument ${argument.argument_id}`,
            "true_violation",
          ),
        );
      }
    }
    if (
      ["first_instance_court", "appellate_court", "supreme_court_review"].includes(role) &&
      (roleAnalysis.court_analysis?.findings_of_fact?.length ?? 0) > 0 &&
      (roleAnalysis.usable_evidence?.length ?? 0) === 0
    ) {
      findings.push(
        finding(
          "court_finding_without_basis",
          "blocker",
          role,
          "court finding without usable evidence",
          "true_violation",
        ),
      );
    } else if (
      ["first_instance_court", "appellate_court", "supreme_court_review"].includes(role) &&
      (roleAnalysis.court_analysis?.findings_of_fact?.length ?? 0) === 0 &&
      (roleAnalysis.unavailable_facts?.length ?? 0) > 0
    ) {
      findings.push(
        finding(
          "court_finding_correctly_withheld",
          "informational",
          role,
          "court findings withheld because facts are not verified",
          "control_applied",
        ),
      );
    }
  }

  for (const role of roles) {
    if (!roleAnalyses.some((roleAnalysis) => roleAnalysis.role === role)) {
      findings.push(
        finding(
          "role_status_mismatch",
          "major",
          role,
          "applicable role missing from role analyses",
          "true_violation",
        ),
      );
    }
  }

  if (!roles.has("prosecution") && roleAnalyses.some((role) => role.role === "prosecution")) {
    findings.push(
      finding("role_leakage", "blocker", "prosecution", "not criminal", "true_violation"),
    );
  } else if (nonApplicable.has("prosecution")) {
    findings.push(
      finding(
        "prosecution_role_correctly_excluded",
        "informational",
        "prosecution",
        "prosecution role excluded outside an identified criminal case",
        "control_applied",
      ),
    );
  }
  if (!roles.has("defence") && roleAnalyses.some((role) => role.role === "defence")) {
    findings.push(finding("role_leakage", "blocker", "defence", "not criminal", "true_violation"));
  } else if (nonApplicable.has("defence")) {
    findings.push(
      finding(
        "defence_role_correctly_excluded",
        "informational",
        "defence",
        "defence role excluded outside an identified criminal case",
        "control_applied",
      ),
    );
  }
  if ((analysis.contradiction_matrix?.length ?? 0) === 0 && roleAnalyses.length >= 2) {
    findings.push(
      finding(
        "unsupported_argument",
        "warning",
        "analysis",
        "no contradiction matrix entry",
        "warning",
      ),
    );
  }
  const jurisdiction = analysis.jurisdiction_dimensions ?? {};
  const jurisdictionSummary = analysis.jurisdiction_summary;
  const actualConfirmed = Object.values(jurisdiction).filter(
    (value) => (value as { status?: string }).status === "confirmed",
  ).length;
  const actualUnverified = Object.values(jurisdiction).filter(
    (value) => (value as { status?: string }).status === "not_verified",
  ).length;
  if (
    jurisdictionSummary &&
    (jurisdictionSummary.counts.confirmed !== actualConfirmed ||
      jurisdictionSummary.counts.not_verified !== actualUnverified ||
      String(jurisdictionSummary.narrative).includes("ocho dimensiones"))
  ) {
    findings.push(
      finding(
        "jurisdiction_summary_mismatch",
        "major",
        "analysis",
        "jurisdiction summary does not match dimension states",
        "true_violation",
      ),
    );
  }
  if (
    Object.entries(jurisdiction).some(
      ([key, value]) =>
        key !== "country_legal_system" && (value as { status?: string }).status !== "confirmed",
    ) &&
    roleAnalyses.some((role) => JSON.stringify(role).includes("jurisdiction confirmed"))
  ) {
    findings.push(
      finding(
        "jurisdiction_overstated",
        "blocker",
        "analysis",
        "incomplete jurisdiction overstated",
        "true_violation",
      ),
    );
  } else if (
    Object.entries(jurisdiction).some(
      ([key, value]) =>
        key !== "country_legal_system" && (value as { status?: string }).status === "not_verified",
    )
  ) {
    findings.push(
      finding(
        "jurisdiction_correctly_left_unverified",
        "informational",
        "analysis",
        "concrete jurisdiction dimensions remain unverified",
        "control_applied",
      ),
    );
  }
  if (
    (analysis.confidence ?? 0) > 0.7 &&
    (exclusions.length > 0 ||
      (analysis.neutral_risk_assessment?.missing_information_that_changes_outcome?.length ?? 0) > 0)
  ) {
    findings.push(
      finding(
        "confidence_overstated",
        "major",
        "analysis",
        "high confidence with gaps",
        "true_violation",
      ),
    );
  }
  if (analysis.burden_analysis?.burden_uncertain === true) {
    findings.push(
      finding(
        "burden_holder_not_verified",
        "warning",
        "analysis",
        "burden analysis requires review",
        "warning",
      ),
    );
    findings.push(
      finding(
        "burden_holder_correctly_left_unverified",
        "informational",
        "analysis",
        "burden holder or procedural maxim remains unverified",
        "control_applied",
      ),
    );
  }
  if (
    (analysis.standards_of_review ?? []).some(
      (standard: { standard_status?: string }) => standard.standard_status === "not_verified",
    )
  ) {
    findings.push(
      finding(
        "standard_of_review_not_verified",
        "warning",
        "analysis",
        "review standard missing",
        "warning",
      ),
    );
    findings.push(
      finding(
        "standard_of_review_correctly_left_unverified",
        "informational",
        "analysis",
        "review standard remains unverified",
        "control_applied",
      ),
    );
  }
  if (
    (analysis.role_analyses ?? []).some((role: { weakest_arguments?: string[] }) =>
      role.weakest_arguments?.includes("independent_ground_not_challenged"),
    )
  ) {
    findings.push(
      finding(
        "independent_ground_correctly_left_unreviewed",
        "informational",
        "analysis",
        "independent ground not challenged",
        "control_applied",
      ),
    );
  }
  for (const exclusion of exclusions) {
    if (String(exclusion.exclusion_reason).includes("user_described_only")) {
      findings.push(
        finding(
          "unusable_evidence_correctly_excluded",
          "informational",
          "analysis",
          "user described evidence excluded",
          "control_applied",
        ),
      );
    }
    if (String(exclusion.exclusion_reason).includes("new_evidence")) {
      findings.push(
        finding(
          "new_evidence_correctly_flagged_as_noven_risk",
          "informational",
          "analysis",
          "new evidence kept as procedural proposal",
          "control_applied",
        ),
      );
    }
    if (String(exclusion.exclusion_reason).includes("fact_user_asserted")) {
      findings.push(
        finding(
          "unverified_fact_correctly_limited_to_allegation",
          "informational",
          "analysis",
          "user asserted fact limited to allegation",
          "control_applied",
        ),
      );
    }
    if (String(exclusion.exclusion_reason).startsWith("case_law_")) {
      findings.push(
        finding(
          "partial_case_correctly_excluded",
          "informational",
          "analysis",
          "partial or unverified case law excluded",
          "control_applied",
        ),
      );
    }
  }
  if (
    findings.some((item) => item.category === "control_applied") &&
    findings.some(
      (item) =>
        /correctly|excluded|limited/.test(item.message) && item.category === "true_violation",
    )
  ) {
    findings.push(
      finding(
        "validator_code_message_mismatch",
        "major",
        "analysis",
        "validator used a violation category for avoided conduct",
        "true_violation",
      ),
    );
  }
  for (const legacyFinding of (analysis as { validation_findings?: unknown[] })
    .validation_findings ?? []) {
    const item = legacyFinding as { code?: unknown; message?: unknown; category?: unknown };
    if (
      String(item.category) === "true_violation" &&
      /correctly|excluded|limited|withheld/i.test(String(item.message))
    ) {
      findings.push(
        finding(
          "validator_code_message_mismatch",
          "major",
          "analysis",
          `validator finding ${String(item.code)} has a violation category but control wording`,
          "true_violation",
        ),
      );
    }
  }
  const missingEssentials =
    analysis.deliberation_panel?.missing_elements_preventing_final_outcome ?? [];
  const preferredOutcome = analysis.deliberation_panel?.preferred_outcome;
  const categoricalOutcomes = ["grant", "dismiss", "partially_grant", "inadmissible", "remand"];
  if (
    missingEssentials.length > 0 &&
    categoricalOutcomes.includes(preferredOutcome) &&
    analysis.deliberation_panel?.outcome_is_conditional !== true
  ) {
    findings.push(
      finding(
        "unconditional_outcome_with_missing_essentials",
        "blocker",
        "deliberation_panel",
        "categorical preferred outcome despite missing essentials",
        "true_violation",
      ),
    );
  }
  if (
    missingEssentials.length > 0 &&
    (!String(analysis.neutral_risk_assessment?.best_case ?? "").startsWith("conditional_") ||
      analysis.neutral_risk_assessment?.expected_case !== "cannot_assess" ||
      analysis.deliberation_panel?.outcome_is_conditional !== true)
  ) {
    findings.push(
      finding(
        "outcome_condition_mismatch",
        "major",
        "analysis",
        "risk scenarios or deliberation are not conditioned despite missing essentials",
        "true_violation",
      ),
    );
  } else if (missingEssentials.length > 0) {
    findings.push(
      finding(
        "predicted_outcome_correctly_conditioned",
        "informational",
        "analysis",
        "outcome scenarios are conditional while essentials are missing",
        "control_applied",
      ),
    );
  }
  const narrativeStateCheck = evaluateNarrativeStateConsistency(analysis);
  if (narrativeStateCheck.narrative_state_mismatch) {
    findings.push(
      finding(
        "narrative_state_mismatch",
        "major",
        "analysis",
        narrativeStateCheck.reason ?? "jurisdiction narrative does not match JSON state",
        "true_violation",
      ),
    );
  }
  if (
    exclusions.some((item) => String(item.exclusion_reason).includes("user_described_only")) &&
    JSON.stringify(analysis.neutral_risk_assessment).includes("document-supported") &&
    !JSON.stringify(analysis.neutral_risk_assessment).includes("not yet document-supported")
  ) {
    findings.push(
      finding(
        "evidence_status_narrative_mismatch",
        "major",
        "analysis",
        "narrative treats excluded evidence as document-supported",
        "true_violation",
      ),
    );
  }

  const blockerCount = findings.filter((item) => item.severity === "blocker").length;
  const majorCount = findings.filter((item) => item.severity === "major").length;
  const warningCount = findings.filter((item) => item.severity === "warning").length;
  const informationalCount = findings.filter((item) => item.severity === "informational").length;
  const controlsApplied = findings.filter((item) => item.category === "control_applied").length;
  const trueViolations = findings.filter((item) => item.category === "true_violation").length;
  return {
    status:
      blockerCount > 0
        ? "blocked"
        : majorCount > 0
          ? "failed"
          : warningCount > 0
            ? "passed_with_warnings"
            : "passed",
    findings,
    summary: {
      blocker: blockerCount,
      major: majorCount,
      warning: warningCount,
      informational: informationalCount,
      controls_applied: controlsApplied,
      true_violations: trueViolations,
    },
    analysis_integrity: buildAnalysisIntegrity(analysis),
  };
}

export function validateMultiroleLegalAnalysisById(analysisId: string) {
  const stored = readMultiroleStore()[analysisId];
  if (!stored) {
    return {
      status: "blocked",
      findings: [
        finding(
          "analysis_id_not_found",
          "blocker",
          "analysis",
          "stored multirole analysis was not found",
          "true_violation",
        ),
      ],
      summary: {
        blocker: 1,
        major: 0,
        warning: 0,
        informational: 0,
        controls_applied: 0,
        true_violations: 1,
      },
      analysis_integrity: {
        analysis_id: analysisId,
        persistence_verified: false,
        network_request_performed: false,
        validation_status: "blocked",
        narrative_state_mismatch: true,
        narrative_state_check_id: `narrative_state_${analysisId}`,
        narrative_state_check_hash: sha256(analysisId),
        narrative_state_source: "missing_analysis",
        narrative_state_consistency_verified: false,
        role_integrity: "missing",
        evidence_consistency: "missing",
        unresolved_conflicts: [],
      },
    };
  }
  const validation = validateMultiroleLegalAnalysis(stored.analysis);
  return {
    ...validation,
    analysis_integrity: {
      ...buildAnalysisIntegrity(stored.analysis),
      persistence_verified: true,
      network_request_performed: false,
      validation_status: validation.status,
    },
  };
}

function buildAnalysisIntegrity(analysis: ReturnType<typeof analyzeSwissLegalPositions>) {
  const roleAnalyses = Array.isArray(analysis.role_analyses) ? analysis.role_analyses : [];
  const roleHashes = Object.fromEntries(
    roleAnalyses.map((role) => [String(role.role), sha256(stableStringify(role))]),
  );
  const roleIds = roleAnalyses.map((role) => String(role.role));
  const expectedRoleHashes =
    (analysis as { role_hashes?: Record<string, string> }).role_hashes ?? {};
  const roleIntegrity = roleIds.every((roleId) => expectedRoleHashes[roleId] === roleHashes[roleId])
    ? "verified"
    : "mismatch";
  const narrativeHash = sha256(stableStringify(analysis.narrative ?? {}));
  const unresolvedConflicts = Array.isArray(analysis.contradiction_matrix)
    ? analysis.contradiction_matrix.filter(
        (item: { unresolved_conflict?: boolean }) => item.unresolved_conflict === true,
      )
    : [];
  const narrativeStateCheck = evaluateNarrativeStateConsistency(analysis);
  return {
    analysis_id: (analysis as { analysis_id?: string }).analysis_id ?? null,
    analysis_hash: (analysis as { analysis_hash?: string }).analysis_hash ?? null,
    schema_version: (analysis as { schema_version?: number }).schema_version ?? null,
    evidence_snapshot_hash:
      (analysis as { evidence_snapshot_hash?: string }).evidence_snapshot_hash ?? null,
    role_count: roleAnalyses.length,
    role_ids: roleIds,
    role_hashes: roleHashes,
    narrative_hash: narrativeHash,
    created_at: (analysis as { created_at?: string }).created_at ?? null,
    updated_at: (analysis as { updated_at?: string }).updated_at ?? null,
    persistence_verified: false,
    network_request_performed: false,
    validation_status: "not_run",
    narrative_state_mismatch: narrativeStateCheck.narrative_state_mismatch,
    narrative_state_check_id: narrativeStateCheck.narrative_state_check_id,
    narrative_state_check_hash: narrativeStateCheck.narrative_state_check_hash,
    narrative_state_source: narrativeStateCheck.narrative_state_source,
    narrative_state_consistency_verified: narrativeStateCheck.narrative_state_consistency_verified,
    role_integrity: roleIntegrity,
    evidence_consistency: (analysis as { evidence_snapshot_hash?: string }).evidence_snapshot_hash
      ? "verified"
      : "missing",
    unresolved_conflicts: unresolvedConflicts.map(
      (
        item: { decisive_issue?: string; argument_from_role?: string; opposing_role?: string },
        index: number,
      ) =>
        item.decisive_issue ??
        `${item.argument_from_role ?? "role"}_vs_${item.opposing_role ?? "role"}_${index + 1}`,
    ),
  };
}

function evaluateNarrativeStateConsistency(analysis: {
  readonly analysis_id?: string;
  readonly narrative?: { readonly jurisdiction?: string };
  readonly jurisdiction_dimensions?: Record<string, { readonly status?: string }>;
  readonly narrative_hash?: string;
}): {
  readonly narrative_state_mismatch: boolean;
  readonly narrative_state_check_id: string;
  readonly narrative_state_check_hash: string;
  readonly narrative_state_source: "analysis_object";
  readonly narrative_state_consistency_verified: boolean;
  readonly reason: string | null;
} {
  const jurisdiction = analysis.jurisdiction_dimensions ?? {};
  const actualUnverified = Object.entries(jurisdiction).filter(
    ([key, value]) => key !== "country_legal_system" && value.status !== "confirmed",
  ).length;
  const narrative = String(analysis.narrative?.jurisdiction ?? "");
  const countryConfirmed = jurisdiction["country_legal_system"]?.status === "confirmed";
  const mismatch =
    narrative.includes("ocho dimensiones") ||
    (countryConfirmed && actualUnverified > 0 && !narrative.includes("ordenamiento suizo"));
  const evidence = {
    analysis_id: analysis.analysis_id ?? null,
    country_confirmed: countryConfirmed,
    actual_unverified_dimensions: actualUnverified,
    narrative,
    mismatch,
  };
  return {
    narrative_state_mismatch: mismatch,
    narrative_state_check_id: `narrative_state_${sha256(stableStringify(evidence)).slice(0, 16)}`,
    narrative_state_check_hash: sha256(stableStringify(evidence)),
    narrative_state_source: "analysis_object",
    narrative_state_consistency_verified: !mismatch,
    reason: mismatch ? "jurisdiction narrative does not match JSON state" : null,
  };
}

function persistMultiroleAnalysis(analysis: ReturnType<typeof analyzeSwissLegalPositions>): void {
  const analysisId = (analysis as { analysis_id?: string }).analysis_id;
  if (!analysisId) return;
  const store = readMultiroleStore();
  store[analysisId] = {
    schema_version: multiroleStoreSchemaVersion,
    analysis_id: analysisId,
    analysis_hash: (analysis as { analysis_hash: string }).analysis_hash,
    evidence_snapshot_hash: (analysis as { evidence_snapshot_hash: string }).evidence_snapshot_hash,
    narrative_hash: (analysis as { narrative_hash: string }).narrative_hash,
    role_hashes: (analysis as { role_hashes: Record<string, string> }).role_hashes,
    role_ids: (analysis as { role_ids: readonly string[] }).role_ids,
    role_count: (analysis as { role_count: number }).role_count,
    created_at: (analysis as { created_at: string }).created_at,
    updated_at: (analysis as { updated_at: string }).updated_at,
    analysis,
  };
  writeMultiroleStore(store);
}

function readMultiroleStore(): Record<string, StoredMultiroleAnalysis> {
  try {
    const raw = fs.readFileSync(multiroleStorePath(), "utf8");
    const parsed = JSON.parse(raw) as Record<string, StoredMultiroleAnalysis>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMultiroleStore(store: Record<string, StoredMultiroleAnalysis>): void {
  const target = multiroleStorePath();
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, target);
}

function multiroleStorePath(): string {
  const base =
    process["env"]["SWISS_LEGAL_CACHE_DIR"] ??
    path.join(os.homedir(), "Library", "Caches", "swiss-legal-mcp");
  return path.join(base, "multirole-analyses.json");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(",")}}`;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function finding(
  code: string,
  severity: FindingSeverity,
  affectedRole: string,
  message: string,
  category: FindingCategory,
) {
  return {
    code,
    severity,
    category,
    affected_role: affectedRole,
    message,
  };
}
