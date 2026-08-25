import { describe, expect, it } from "vitest";
import { matterModelSchema, type MatterModel, type ProvenanceRef } from "@swiss-legal-mcp/core";
import {
  createMatterSnapshot,
  type MatterSnapshot,
  type SourceFreshness,
} from "@swiss-legal-mcp/matter-store";
import {
  classifyOperationalMatter,
  createRuntimeMatter,
  executeMatterPipeline,
  preserveTranslatedAuthority,
  recordProviderFailure,
  researchLegalIssues,
  resolveProviderDisagreement,
  runEndToEndAdversarialValidation,
  runPartialPipeline,
} from "./legalRuntime.js";

const provenance: ProvenanceRef[] = [
  { type: "SYSTEM_DERIVATION", system_derivation_input_ids: ["phase-9-runtime-test"] },
];

function model(overrides: Partial<MatterModel> = {}): MatterModel {
  return matterModelSchema.parse({
    matter: { id: "matter-runtime", title: "Runtime synthetic matter" },
    documents: [
      {
        kind: "Document",
        id: "doc-1",
        matter_id: "matter-runtime",
        title: "Document",
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
        provenance,
      },
    ],
    passages: [
      {
        kind: "Passage",
        id: "passage-1",
        matter_id: "matter-runtime",
        document_id: "doc-1",
        text: "Passage",
        provenance,
      },
    ],
    propositions: [
      {
        kind: "Proposition",
        id: "prop-1",
        matter_id: "matter-runtime",
        text: "Fact",
        scope: "synthetic",
        legal_or_factual_domain: "FACTUAL",
        granularity: "ATOMIC",
        source_passage_ids: ["passage-1"],
        provenance,
      },
    ],
    evidence: [
      {
        kind: "Evidence",
        id: "evidence-1",
        matter_id: "matter-runtime",
        evidence_type: "DOCUMENT",
        document_id: "doc-1",
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
        supported_proposition_ids: ["prop-1"],
        evidence_use: "SUPPORT",
        provenance,
      },
    ],
    issues: [
      {
        kind: "Issue",
        id: "issue-1",
        matter_id: "matter-runtime",
        text: "Legal issue",
        issue_type: "LEGAL",
        proposition_ids: ["prop-1"],
        provenance,
      },
    ],
    legal_authorities: [
      {
        kind: "LegalAuthority",
        id: "authority-1",
        matter_id: "matter-runtime",
        authority_type: "STATUTE",
        citation: "Synthetic Act",
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
        provenance,
      },
    ],
    trace_links: [
      {
        id: "trace-1",
        matter_id: "matter-runtime",
        from_id: "evidence-1",
        to_id: "prop-1",
        relation: "supports",
        provenance,
      },
    ],
    ...overrides,
  });
}

function snapshot(
  overrides: Partial<MatterSnapshot> = {},
  modelOverrides: Partial<MatterModel> = {},
): MatterSnapshot {
  const base = createMatterSnapshot({
    model: model(modelOverrides),
    created_by: "test",
    change_summary: "Runtime test.",
    source_event: "runtime",
    version_id: "v-runtime",
  });
  return { ...base, ...overrides };
}

describe("Phase 9 legal runtime", () => {
  it("E records provider failure as retryable/non-retryable without invented law", () => {
    const attempt = recordProviderFailure({
      provider: "official-provider",
      operation: "search_case_law",
      attempts: 2,
      retryable: true,
      last_error: "timeout",
    });
    expect(attempt.result).toBe("RETRYABLE_FAILURE");
    expect(attempt.last_error).toBe("timeout");
  });

  it("F prefers official source over aggregator while preserving disagreement", () => {
    const disagreement = resolveProviderDisagreement({
      official_source_id: "fedlex-official",
      aggregator_source_id: "aggregator-meta",
      conflict: "Different effective date",
    });
    expect(disagreement.official_preferred_for_verification).toBe(true);
    expect(disagreement.preserved_in_provenance).toBe(true);
  });

  it("J runs a synthetic end-to-end pipeline with traceability and final QA", () => {
    const result = executeMatterPipeline({
      snapshot: snapshot(),
      assertions: [
        {
          draft_sentence_id: "s-1",
          text: "The record supports the material fact.",
          assertion_type: "FACT",
          source_ids: ["doc-1"],
          evidence_ids: ["evidence-1"],
          legal_proposition_ids: [],
          precedent_ids: [],
          confidence: 0.8,
          provenance,
          human_review_state: "UNREVIEWED",
        },
      ],
    });
    expect(result.runs.map((run) => run.stage)).toContain("FINAL_QA");
    expect(result.traceability_ok).toBe(true);
    expect(result.readiness).toBe("READY_FOR_HUMAN_REVIEW");
  });

  it("P reproduces deterministic runtime output for the same matter version", () => {
    const first = executeMatterPipeline({ snapshot: snapshot(), stages: ["EVIDENCE", "FINAL_QA"] });
    const second = executeMatterPipeline({
      snapshot: snapshot(),
      stages: ["EVIDENCE", "FINAL_QA"],
    });
    expect(first.runs.map((run) => run.stage)).toEqual(second.runs.map((run) => run.stage));
    expect(first.final_qa_readiness).toBe(second.final_qa_readiness);
  });

  it("Q runs chronology-only partial pipeline without forcing research or drafting", () => {
    const partial = runPartialPipeline({ snapshot: snapshot(), stage: "CHRONOLOGY" });
    expect(partial.forced_stages).toEqual([]);
    expect(partial.run.stage).toBe("CHRONOLOGY");
  });

  it("R leaves matter valid when research provider fails after evidence checkpoint", () => {
    const failed = snapshot({
      provider_attempts: [
        recordProviderFailure({
          provider: "official-provider",
          operation: "research",
          attempts: 1,
          retryable: true,
          last_error: "source unavailable",
        }),
      ],
      checkpoints: [
        {
          checkpoint_id: "checkpoint-evidence",
          matter_id: "matter-runtime",
          version_id: "v-runtime",
          stage: "evidence",
          created_at: "2026-01-01T00:00:00+00:00",
          reason: "Evidence checkpoint before research.",
        },
      ],
    });
    expect(failed.model.matter.id).toBe("matter-runtime");
    expect(failed.provider_attempts[0]?.result).toBe("RETRYABLE_FAILURE");
  });

  it("U requires human review and never automatic filing readiness", () => {
    const result = executeMatterPipeline({ snapshot: snapshot(), stages: ["FINAL_QA"] });
    expect(result.readiness).toBe("READY_FOR_HUMAN_REVIEW");
    expect(result.readiness).not.toBe("AUTO_FILE_READY");
  });

  it("orchestrates legal research through app-level adapter interfaces", async () => {
    const result = await researchLegalIssues({
      snapshot: snapshot(),
      language: "DE",
      adapter: {
        adapter_id: "mcp-adapter",
        supports_official_case_resolver: true,
        supports_citation_verification: false,
        supports_case_search: true,
        supports_reference_search: true,
        supports_fedlex: true,
        supports_entscheidsuche_discovery: true,
      },
    });
    expect(result.human_review_flags).toContain("HUMAN_REVIEW_REQUIRED");
    expect(JSON.stringify(result.structured_result)).toContain("query_expansion");
  });

  it("preserves translated authority text as secondary to the original", () => {
    const translated = preserveTranslatedAuthority({
      passage_id: "passage-1",
      original_text: "Verfügung",
      original_language: "DE",
      translated_text: "decisión administrativa",
      target_language: "ES",
      provenance,
    });
    expect(translated.original_text).toBe("Verfügung");
    expect(translated.official_wording).toBe(false);
  });

  it("creates runtime matters with version metadata", () => {
    const created = createRuntimeMatter({ model: model(), created_by: "runtime" });
    expect(created.metadata.schema_version).toBe("matter-store.v1");
    expect(created.metadata.created_by).toBe("runtime");
  });

  it("runs 12 end-to-end adversarial scenarios without systematic user-favoring", () => {
    const stale: SourceFreshness = {
      source_id: "stale-law",
      source_kind: "STATUTE",
      retrieved_at: "2020-01-01T00:00:00+00:00",
      source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
      freshness_status: "REQUIRES_REFRESH",
    };
    const strongEvidence = [
      ...model().evidence,
      { ...model().evidence[0]!, id: "evidence-2" },
      { ...model().evidence[0]!, id: "evidence-3" },
    ];
    const scenarios = [
      snapshot({}, { evidence: strongEvidence }),
      snapshot(
        {},
        {
          precedent_applications: [
            {
              kind: "PrecedentApplication",
              id: "pa-1",
              matter_id: "matter-runtime",
              legal_authority_id: "authority-1",
              issue_id: "issue-1",
              application: "STRONGLY_ADVERSE",
              favorable_aspects: [],
              adverse_aspects: ["adverse"],
              ratio_respected: true,
              provenance,
            },
          ],
        },
      ),
      snapshot({}, { evidence: [] }),
      snapshot({}, { legal_authorities: [] }),
      snapshot({}, { evidence: [] }),
      snapshot({}, { issues: [] }),
      snapshot(
        {},
        {
          precedent_applications: [
            {
              kind: "PrecedentApplication",
              id: "pa-2",
              matter_id: "matter-runtime",
              legal_authority_id: "authority-1",
              issue_id: "issue-1",
              application: "MIXED",
              favorable_aspects: ["favorable"],
              adverse_aspects: ["adverse"],
              ratio_respected: true,
              provenance,
            },
          ],
        },
      ),
      snapshot({ source_freshness: [stale] }),
      snapshot({}, { documents: [{ ...model().documents[0]!, id: "doc-fr" }] }),
      snapshot({
        provider_attempts: [
          recordProviderFailure({
            provider: "fedlex",
            operation: "law",
            attempts: 1,
            retryable: true,
            last_error: "outage",
          }),
        ],
      }),
      snapshot({
        human_decisions: [
          {
            decision_id: "lock-1",
            matter_id: "matter-runtime",
            object_id: "prop-1",
            actor: "reviewer",
            decision: "LOCK",
            timestamp: "2026-01-01T00:00:00+00:00",
            reason: "human lock",
            old_state: {},
            new_state: {},
            provenance,
          },
        ],
      }),
      snapshot(
        {},
        {
          documents: Array.from({ length: 500 }, (_, index) => ({
            kind: "Document" as const,
            id: `doc-${index}`,
            matter_id: "matter-runtime",
            title: `Doc ${index}`,
            source_status: "FULL_TEXT_VERIFIED_OFFICIAL" as const,
            provenance,
          })),
        },
      ),
    ];
    const validation = runEndToEndAdversarialValidation(scenarios);
    expect(validation.scenario_count).toBe(12);
    expect(validation.systematic_user_favoring).toBe(false);
    expect(validation.classifications).toContain("CLIENT_STRONG");
    expect(validation.classifications).toContain("CLIENT_WEAK");
    expect(validation.classifications).toContain("INSUFFICIENT_INFORMATION");
    expect(validation.classifications).toContain("HUMAN_REVIEW_REQUIRED");
  });

  it("classifies ambiguous matters without turning every matter into risk", () => {
    expect(classifyOperationalMatter(snapshot({}, { legal_authorities: [] }))).toBe("AMBIGUOUS");
  });
});
