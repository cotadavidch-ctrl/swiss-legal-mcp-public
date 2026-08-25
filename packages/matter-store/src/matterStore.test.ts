import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { matterModelSchema, type MatterModel, type ProvenanceRef } from "@swiss-legal-mcp/core";
import {
  FileMatterStore,
  createMatterSnapshot,
  diffMatterSnapshots,
  importMatterSnapshot,
  invalidateDerivedViews,
  preserveLockOnContradiction,
  resolveFreshness,
  safeStorePath,
  summarizeMatterHealth,
  whatWeKnewAt,
  type SourceFreshness,
} from "./matterStore.js";

const provenance: ProvenanceRef[] = [
  { type: "SYSTEM_DERIVATION", system_derivation_input_ids: ["phase-9-store-test"] },
];

function model(overrides: Partial<MatterModel> = {}): MatterModel {
  return matterModelSchema.parse({
    matter: { id: "matter-1", title: "Synthetic matter", created_at: "2026-01-01T00:00:00+00:00" },
    actors: [],
    documents: [
      {
        kind: "Document",
        id: "doc-1",
        matter_id: "matter-1",
        created_at: "2026-01-01T00:00:00+00:00",
        title: "Document 1",
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
        provenance,
      },
    ],
    passages: [
      {
        kind: "Passage",
        id: "passage-1",
        matter_id: "matter-1",
        created_at: "2026-01-01T00:00:00+00:00",
        document_id: "doc-1",
        text: "Passage.",
        provenance,
      },
    ],
    propositions: [
      {
        kind: "Proposition",
        id: "prop-1",
        matter_id: "matter-1",
        created_at: "2026-01-01T00:00:00+00:00",
        text: "Proposition.",
        scope: "synthetic",
        legal_or_factual_domain: "FACTUAL",
        granularity: "ATOMIC",
        source_passage_ids: ["passage-1"],
        provenance,
      },
    ],
    assertions: [],
    evidence: [
      {
        kind: "Evidence",
        id: "evidence-1",
        matter_id: "matter-1",
        created_at: "2026-01-01T00:00:00+00:00",
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
        matter_id: "matter-1",
        created_at: "2026-01-01T00:00:00+00:00",
        text: "Issue.",
        issue_type: "LEGAL",
        proposition_ids: ["prop-1"],
        provenance,
      },
    ],
    legal_authorities: [
      {
        kind: "LegalAuthority",
        id: "authority-1",
        matter_id: "matter-1",
        created_at: "2026-01-01T00:00:00+00:00",
        authority_type: "STATUTE",
        citation: "Synthetic Act art. 1",
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
        provenance,
      },
    ],
    trace_links: [
      {
        id: "trace-1",
        matter_id: "matter-1",
        from_id: "evidence-1",
        to_id: "prop-1",
        relation: "supports",
        provenance,
      },
    ],
    ...overrides,
  });
}

describe("Phase 9 matter store", () => {
  it("A saves and loads semantically equivalent Matter snapshots", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matter-store-"));
    try {
      const store = new FileMatterStore(dir);
      const snapshot = createMatterSnapshot({
        model: model(),
        created_by: "test",
        change_summary: "Initial save.",
        source_event: "test",
        version_id: "v1",
      });
      await store.save(snapshot);
      expect(await store.load("matter-1")).toEqual(snapshot);
      expect(await store.load("matter-1", "v1")).toEqual(snapshot);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("B preserves human locks when contradictory evidence arrives", () => {
    expect(
      preserveLockOnContradiction({
        reviewed_state: {
          status: "HUMAN_LOCKED",
          locked_by: "reviewer",
          locked_at: "2026-01-01T00:00:00+00:00",
        },
        incoming_contradicts_existing: true,
      }),
    ).toBe("HUMAN_REVIEW_REQUIRED");
  });

  it("C invalidates only dependent nodes for incremental updates", () => {
    const snapshot = createMatterSnapshot({
      model: model(),
      created_by: "test",
      change_summary: "Initial.",
      source_event: "test",
      version_id: "v1",
    });
    const invalidation = invalidateDerivedViews({ snapshot, changed_ids: ["evidence-1"] });
    expect(invalidation).toContainEqual({
      object_id: "prop-1",
      state: "RECOMPUTE_REQUIRED",
      reason: "Changed dependency affects this derived object.",
    });
  });

  it("D answers historical what-we-knew-at without future evidence", () => {
    const withFuture = model({
      documents: [
        ...model().documents,
        {
          kind: "Document",
          id: "doc-2",
          matter_id: "matter-1",
          created_at: "2026-02-01T00:00:00+00:00",
          title: "Future document",
          source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
          provenance,
        },
      ],
    });
    const snapshot = createMatterSnapshot({
      model: withFuture,
      created_by: "test",
      change_summary: "Future evidence.",
      source_event: "test",
    });
    expect(
      whatWeKnewAt(snapshot, "2026-01-15T00:00:00+00:00").model.documents.map((item) => item.id),
    ).not.toContain("doc-2");
  });

  it("H marks stale law as requiring refresh", () => {
    const source: SourceFreshness = {
      source_id: "law-old",
      source_kind: "STATUTE",
      retrieved_at: "2020-01-01T00:00:00+00:00",
      source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
      freshness_status: "CURRENTLY_VERIFIED",
    };
    expect(resolveFreshness({ source, now: "2026-01-01T00:00:00+00:00", maxAgeDays: 365 })).toBe(
      "REQUIRES_REFRESH",
    );
  });

  it("I safely migrates an older schema and preserves IDs/provenance", () => {
    const migrated = importMatterSnapshot({
      schema_version: "matter-store.v0",
      metadata: { version_id: "old-v1", created_by: "legacy" },
      model: model(),
    });
    expect(migrated.metadata.version_id).toBe("old-v1");
    expect(migrated.model.documents[0]?.provenance).toEqual(provenance);
  });

  it("K handles a large synthetic matter within a practical local budget", () => {
    const large = model({
      documents: Array.from({ length: 500 }, (_, index) => ({
        kind: "Document" as const,
        id: `doc-${index}`,
        matter_id: "matter-1",
        title: `Document ${index}`,
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL" as const,
        provenance,
      })),
      passages: Array.from({ length: 2000 }, (_, index) => ({
        kind: "Passage" as const,
        id: `passage-${index}`,
        matter_id: "matter-1",
        document_id: `doc-${index % 500}`,
        text: `Passage ${index}`,
        provenance,
      })),
      propositions: Array.from({ length: 1000 }, (_, index) => ({
        kind: "Proposition" as const,
        id: `prop-${index}`,
        matter_id: "matter-1",
        text: `Proposition ${index}`,
        scope: "large synthetic",
        legal_or_factual_domain: "FACTUAL" as const,
        granularity: "ATOMIC" as const,
        source_passage_ids: [`passage-${index}`],
        provenance,
      })),
      assertions: Array.from({ length: 1500 }, (_, index) => ({
        kind: "Assertion" as const,
        id: `assertion-${index}`,
        matter_id: "matter-1",
        actor_id: "actor-1",
        proposition_id: `prop-${index % 1000}`,
        stance: "AFFIRMS" as const,
        provenance,
      })),
      evidence: Array.from({ length: 800 }, (_, index) => ({
        kind: "Evidence" as const,
        id: `evidence-${index}`,
        matter_id: "matter-1",
        evidence_type: "DOCUMENT" as const,
        document_id: `doc-${index % 500}`,
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL" as const,
        supported_proposition_ids: [`prop-${index % 1000}`],
        evidence_use: "SUPPORT" as const,
        provenance,
      })),
      issues: Array.from({ length: 200 }, (_, index) => ({
        kind: "Issue" as const,
        id: `issue-${index}`,
        matter_id: "matter-1",
        text: `Issue ${index}`,
        issue_type: "LEGAL" as const,
        proposition_ids: [`prop-${index}`],
        provenance,
      })),
      legal_authorities: Array.from({ length: 100 }, (_, index) => ({
        kind: "LegalAuthority" as const,
        id: `authority-${index}`,
        matter_id: "matter-1",
        authority_type: "CASE_LAW" as const,
        citation: `Synthetic ${index}`,
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL" as const,
        provenance,
      })),
      arguments: Array.from({ length: 200 }, (_, index) => ({
        kind: "Argument" as const,
        id: `argument-${index}`,
        matter_id: "matter-1",
        text: `Argument ${index}`,
        relied_proposition_ids: [`prop-${index}`],
        relied_legal_proposition_ids: [],
        provenance,
      })),
    });
    const start = performance.now();
    const snapshot = createMatterSnapshot({
      model: large,
      created_by: "test",
      change_summary: "Large matter.",
      source_event: "benchmark",
    });
    const elapsed = performance.now() - start;
    expect(snapshot.indexes.document_ids).toHaveLength(500);
    expect(elapsed).toBeLessThan(1500);
  });

  it("L avoids stale derived cache reuse when matter version changes", () => {
    const first = createMatterSnapshot({
      model: model(),
      created_by: "test",
      change_summary: "v1",
      source_event: "test",
      version_id: "v1",
    });
    const second = createMatterSnapshot({
      model: model(),
      created_by: "test",
      change_summary: "v2",
      source_event: "test",
      version_id: "v2",
    });
    expect(first.metadata.version_id).not.toBe(second.metadata.version_id);
  });

  it("O preserves audit trail details for human override", () => {
    const snapshot = createMatterSnapshot({
      model: model(),
      created_by: "test",
      change_summary: "Human override.",
      source_event: "human_review",
      human_decisions: [
        {
          decision_id: "decision-1",
          matter_id: "matter-1",
          object_id: "prop-1",
          actor: "reviewer",
          decision: "OVERRIDE",
          timestamp: "2026-01-02T00:00:00+00:00",
          reason: "Manual verification.",
          old_state: { status: "UNREVIEWED" },
          new_state: { status: "HUMAN_VERIFIED" },
          provenance,
        },
      ],
    });
    expect(snapshot.human_decisions[0]?.old_state).toEqual({ status: "UNREVIEWED" });
  });

  it("S reports mixed matter health without fake global score", () => {
    const snapshot = createMatterSnapshot({
      model: model({ legal_authorities: [] }),
      created_by: "test",
      change_summary: "Weak law.",
      source_event: "health",
    });
    const health = summarizeMatterHealth(snapshot);
    expect(health.view_type).toBe("MATTER_HEALTH");
    expect(health.legal_research_sufficiency).toBe("WEAK");
    expect(health).not.toHaveProperty("score");
  });

  it("T keeps derived view edits separate from canonical Matter facts", () => {
    const snapshot = createMatterSnapshot({
      model: model(),
      created_by: "test",
      change_summary: "Derived edit.",
      source_event: "drafting",
      derived_cache: [
        {
          cache_key: "bwt",
          matter_version: "v1",
          engine_version: "engine",
          language: "DE",
          input_ids: ["prop-1"],
          freshness: [],
          value: { edited_best_winning_theory: "changed" },
        },
      ],
    });
    expect(snapshot.model.propositions[0]?.text).toBe("Proposition.");
  });

  it("prevents path traversal in persistence paths and diffs snapshots", () => {
    expect(() => safeStorePath("/tmp/store", "../outside")).toThrow(/Path traversal/);
    const first = createMatterSnapshot({
      model: model(),
      created_by: "test",
      change_summary: "v1",
      source_event: "test",
    });
    const second = createMatterSnapshot({
      model: model({ documents: [] }),
      created_by: "test",
      change_summary: "v2",
      source_event: "test",
    });
    expect(diffMatterSnapshots(first, second).removed_ids).toContain("doc-1");
  });
});
