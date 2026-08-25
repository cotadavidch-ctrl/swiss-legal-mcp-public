import { z } from "zod";
import { type MatterModel, provenanceRefSchema } from "@swiss-legal-mcp/core";
import { runFinalKillerQa, type DraftAssertion } from "@swiss-legal-mcp/legal-drafting";
import {
  createMatterSnapshot,
  providerAttemptSchema,
  summarizeMatterHealth,
  type MatterHealth,
  type MatterSnapshot,
  type ProviderAttempt,
} from "@swiss-legal-mcp/matter-store";
import {
  expandLegalQuery,
  preserveOriginalQuote,
  type LegalLanguage,
} from "@swiss-legal-mcp/legal-language";

export const ENGINE_VERSION = "legal-runtime.phase9.v1";

const idSchema = z.string().min(1);
const provenanceSchema = z.array(provenanceRefSchema).min(1);

export const matterPipelineStageSchema = z.enum([
  "CREATE_LOAD",
  "ADD_DOCUMENTS",
  "STRUCTURE_FACTS",
  "EVIDENCE",
  "CHRONOLOGY",
  "CONTRADICTIONS",
  "LEGAL_ISSUES",
  "LEGAL_RESEARCH",
  "PRECEDENT_APPLICATION",
  "LITIGATION_STRATEGY",
  "PROCEDURAL_STRATEGY",
  "DRAFT",
  "FINAL_QA",
  "HUMAN_REVIEW",
  "SAVE_VERSION",
]);
export type MatterPipelineStage = z.infer<typeof matterPipelineStageSchema>;

export const systemReadinessSchema = z.enum([
  "FOUNDATION_ONLY",
  "ANALYSIS_READY",
  "STRATEGY_READY",
  "DRAFT_READY",
  "READY_FOR_HUMAN_REVIEW",
  "BLOCKED",
]);
export type SystemReadiness = z.infer<typeof systemReadinessSchema>;

export const matterReadinessSchema = z.enum([
  "CLIENT_STRONG",
  "CLIENT_WEAK",
  "AMBIGUOUS",
  "INSUFFICIENT_INFORMATION",
  "HUMAN_REVIEW_REQUIRED",
]);
export type MatterReadiness = z.infer<typeof matterReadinessSchema>;

export const runtimeResultSchema = z.object({
  summary: z.string().min(1),
  structured_result: z.unknown(),
  provenance: provenanceSchema,
  human_review_flags: z.array(z.string().min(1)),
  staleness: z.array(z.string().min(1)),
  blocking_issues: z.array(z.string().min(1)),
  recommended_next_actions: z.array(z.string().min(1)),
});
export type RuntimeResult = z.infer<typeof runtimeResultSchema>;

export const engineRunSchema = z.object({
  engine: z.string().min(1),
  engine_version: z.literal(ENGINE_VERSION),
  matter_id: idSchema,
  matter_version: idSchema,
  stage: matterPipelineStageSchema,
  duration_ms: z.number().nonnegative(),
  success: z.boolean(),
  provider: z.string().min(1).optional(),
  cache_status: z.enum(["HIT", "MISS", "BYPASS"]).default("BYPASS"),
  review_flags: z.array(z.string().min(1)).default([]),
});
export type EngineRun = z.infer<typeof engineRunSchema>;

export const legalResearchProviderAdapterSchema = z.object({
  adapter_id: idSchema,
  supports_official_case_resolver: z.boolean(),
  supports_citation_verification: z.boolean(),
  supports_case_search: z.boolean(),
  supports_reference_search: z.boolean(),
  supports_fedlex: z.boolean(),
  supports_entscheidsuche_discovery: z.boolean(),
});
export type LegalResearchProviderAdapter = z.infer<typeof legalResearchProviderAdapterSchema>;

export const providerDisagreementSchema = z.object({
  disagreement_id: idSchema,
  official_source_id: idSchema,
  aggregator_source_id: idSchema,
  conflict: z.string().min(1),
  official_preferred_for_verification: z.literal(true),
  preserved_in_provenance: z.literal(true),
});
export type ProviderDisagreement = z.infer<typeof providerDisagreementSchema>;

function nowIso(): string {
  return new Date().toISOString();
}

export function createRuntimeMatter(input: {
  model: MatterModel;
  created_by: string;
  change_summary?: string;
}): MatterSnapshot {
  return createMatterSnapshot({
    model: input.model,
    created_by: input.created_by,
    change_summary: input.change_summary ?? "Created runtime matter.",
    source_event: "runtime_create_or_update_matter",
    human_approved: false,
  });
}

export async function researchLegalIssues(input: {
  snapshot: MatterSnapshot;
  adapter: LegalResearchProviderAdapter;
  language: LegalLanguage;
}): Promise<RuntimeResult> {
  const adapter = legalResearchProviderAdapterSchema.parse(input.adapter);
  const provenance =
    input.snapshot.model.issues.length > 0
      ? input.snapshot.model.issues.flatMap((issue) => issue.provenance)
      : [
          {
            type: "SYSTEM_DERIVATION" as const,
            system_derivation_input_ids: [input.snapshot.metadata.version_id],
          },
        ];
  const missing = [
    ...(!adapter.supports_citation_verification ? ["citation_verification_unavailable"] : []),
    ...(!adapter.supports_fedlex ? ["fedlex_adapter_unavailable"] : []),
    ...(!adapter.supports_case_search ? ["case_search_unavailable"] : []),
  ];
  const expansion = expandLegalQuery({
    concept: "RIGHT_TO_BE_HEARD",
    source_language: input.language,
    target_languages: ["DE", "FR", "IT"],
    provenance,
  });
  return runtimeResultSchema.parse({
    summary:
      missing.length === 0
        ? "Legal research adapters are available for official law, citation verification, and case search."
        : "Legal research is partial because one or more official adapters are unavailable.",
    structured_result: {
      adapter,
      query_expansion: expansion,
      status: missing.length === 0 ? "PARTIAL_RESULT" : "SOURCE_UNAVAILABLE",
    },
    provenance,
    human_review_flags: missing.length > 0 ? ["HUMAN_REVIEW_REQUIRED"] : [],
    staleness: input.snapshot.source_freshness
      .filter((item) => item.freshness_status !== "CURRENTLY_VERIFIED")
      .map((item) => item.source_id),
    blocking_issues: [],
    recommended_next_actions:
      missing.length > 0
        ? ["Refresh official sources before relying on legal propositions."]
        : ["Update legal propositions and precedent applications with verified source references."],
  });
}

export function resolveProviderDisagreement(input: {
  official_source_id: string;
  aggregator_source_id: string;
  conflict: string;
}): ProviderDisagreement {
  return providerDisagreementSchema.parse({
    disagreement_id: `${input.official_source_id}-vs-${input.aggregator_source_id}`,
    official_source_id: input.official_source_id,
    aggregator_source_id: input.aggregator_source_id,
    conflict: input.conflict,
    official_preferred_for_verification: true,
    preserved_in_provenance: true,
  });
}

export function recordProviderFailure(input: {
  provider: string;
  operation: string;
  attempts: number;
  retryable: boolean;
  last_error: string;
}): ProviderAttempt {
  return providerAttemptSchema.parse({
    attempt_id: `${input.provider}-${Date.now()}`,
    provider: input.provider,
    operation: input.operation,
    timestamp: nowIso(),
    attempts: input.attempts,
    result: input.retryable ? "RETRYABLE_FAILURE" : "NON_RETRYABLE_FAILURE",
    last_error: input.last_error,
  });
}

export function runPartialPipeline(input: {
  snapshot: MatterSnapshot;
  stage: MatterPipelineStage;
}): { run: EngineRun; health: MatterHealth; forced_stages: MatterPipelineStage[] } {
  const started = Date.now();
  return {
    run: engineRunSchema.parse({
      engine: "legal-runtime",
      engine_version: ENGINE_VERSION,
      matter_id: input.snapshot.metadata.matter_id,
      matter_version: input.snapshot.metadata.version_id,
      stage: input.stage,
      duration_ms: Date.now() - started,
      success: true,
      cache_status: "BYPASS",
      review_flags: [],
    }),
    health: summarizeMatterHealth(input.snapshot),
    forced_stages: [],
  };
}

export function executeMatterPipeline(input: {
  snapshot: MatterSnapshot;
  assertions?: DraftAssertion[];
  stages?: MatterPipelineStage[];
}): {
  runs: EngineRun[];
  health: MatterHealth;
  final_qa_readiness: string;
  readiness: SystemReadiness;
  traceability_ok: boolean;
} {
  const stages = input.stages ?? matterPipelineStageSchema.options;
  const runs = stages.map((stage) => runPartialPipeline({ snapshot: input.snapshot, stage }).run);
  const qa = runFinalKillerQa({
    assertions: input.assertions ?? [],
    provenance: [
      {
        type: "SYSTEM_DERIVATION",
        system_derivation_input_ids: [input.snapshot.metadata.version_id],
      },
    ],
  });
  const health = summarizeMatterHealth(input.snapshot);
  const blocking = health.blocking_issues.length > 0 || qa.readiness === "NOT_READY";
  return {
    runs,
    health,
    final_qa_readiness: qa.readiness,
    readiness: blocking
      ? "BLOCKED"
      : stages.includes("FINAL_QA")
        ? "READY_FOR_HUMAN_REVIEW"
        : "ANALYSIS_READY",
    traceability_ok:
      input.snapshot.model.trace_links.length > 0 ||
      input.snapshot.model.documents.length === 0 ||
      input.snapshot.model.propositions.length === 0,
  };
}

export function classifyOperationalMatter(snapshot: MatterSnapshot): MatterReadiness {
  const health = summarizeMatterHealth(snapshot);
  if (health.human_review_flags.length > 0 || health.staleness.length > 0)
    return "HUMAN_REVIEW_REQUIRED";
  if (health.blocking_issues.includes("no_evidence")) return "INSUFFICIENT_INFORMATION";
  if (
    snapshot.model.precedent_applications.some((item) => item.application === "STRONGLY_ADVERSE")
  ) {
    return "CLIENT_WEAK";
  }
  if (snapshot.model.evidence.length >= 3 && snapshot.model.legal_authorities.length > 0) {
    return "CLIENT_STRONG";
  }
  return "AMBIGUOUS";
}

export function runEndToEndAdversarialValidation(snapshots: MatterSnapshot[]): {
  scenario_count: number;
  classifications: MatterReadiness[];
  systematic_user_favoring: boolean;
} {
  const classifications = snapshots.map(classifyOperationalMatter);
  return {
    scenario_count: snapshots.length,
    classifications,
    systematic_user_favoring: classifications.every((item) => item === "CLIENT_STRONG"),
  };
}

export function preserveTranslatedAuthority(input: {
  passage_id: string;
  original_text: string;
  original_language: LegalLanguage;
  translated_text: string;
  target_language: LegalLanguage;
  provenance: z.infer<typeof provenanceSchema>;
}) {
  return preserveOriginalQuote({
    ...input,
    translation_status: "MACHINE_TRANSLATED",
    translator_type: "MACHINE",
  });
}
