import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, normalize, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  matterModelSchema,
  provenanceRefSchema,
  type MatterModel,
  type reviewStateSchema,
} from "@swiss-legal-mcp/core";
import { draftVersionSchema, finalBriefQaSchema } from "@swiss-legal-mcp/legal-drafting";

const idSchema = z.string().min(1);
const provenanceSchema = z.array(provenanceRefSchema).min(1);

export const CURRENT_MATTER_STORE_SCHEMA_VERSION = "matter-store.v1";

export const freshnessStateSchema = z.enum([
  "CURRENTLY_VERIFIED",
  "HISTORICALLY_VERIFIED",
  "POTENTIALLY_STALE",
  "REQUIRES_REFRESH",
  "SOURCE_UNAVAILABLE",
  "UNKNOWN",
]);
export type FreshnessState = z.infer<typeof freshnessStateSchema>;

export const dependencyInvalidationStateSchema = z.enum([
  "UNCHANGED",
  "REVIEW_RECOMMENDED",
  "RECOMPUTE_REQUIRED",
  "HUMAN_REVIEW_REQUIRED",
  "LOCK_CONFLICT",
]);
export type DependencyInvalidationState = z.infer<typeof dependencyInvalidationStateSchema>;

export const matterVersionMetadataSchema = z.object({
  matter_id: idSchema,
  version_id: idSchema,
  parent_version_id: idSchema.optional(),
  created_at: z.iso.datetime({ offset: true }),
  created_by: z.string().min(1),
  change_summary: z.string().min(1),
  source_event: z.string().min(1),
  human_approved: z.boolean(),
  schema_version: z.literal(CURRENT_MATTER_STORE_SCHEMA_VERSION),
});
export type MatterVersionMetadata = z.infer<typeof matterVersionMetadataSchema>;

export const sourceFreshnessSchema = z.object({
  source_id: idSchema,
  source_kind: z.enum(["STATUTE", "CASE_LAW", "OFFICIAL_GUIDANCE", "PROVIDER_RESULT"]),
  retrieved_at: z.iso.datetime({ offset: true }),
  source_date: z.iso.date().optional(),
  version_date: z.iso.date().optional(),
  relevant_date: z.iso.date().optional(),
  verification_date: z.iso.datetime({ offset: true }).optional(),
  source_status: z.enum([
    "FULL_TEXT_VERIFIED_OFFICIAL",
    "OFFICIAL_EXTRACT",
    "METADATA_ONLY",
    "SECONDARY_SOURCE",
    "UNVERIFIED",
    "UNAVAILABLE",
  ]),
  freshness_status: freshnessStateSchema,
});
export type SourceFreshness = z.infer<typeof sourceFreshnessSchema>;

export const auditEntrySchema = z.object({
  audit_id: idSchema,
  matter_id: idSchema,
  version_id: idSchema,
  changed_by: z.string().min(1),
  timestamp: z.iso.datetime({ offset: true }),
  reason: z.string().min(1),
  object_id: idSchema,
  old_state: z.unknown(),
  new_state: z.unknown(),
  provenance: provenanceSchema,
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const humanDecisionAuditSchema = z.object({
  decision_id: idSchema,
  matter_id: idSchema,
  object_id: idSchema,
  actor: z.string().min(1),
  decision: z.enum([
    "ACCEPT",
    "REJECT",
    "OVERRIDE",
    "LOCK",
    "UNLOCK",
    "MARK_VERIFIED",
    "MARK_DISPUTED",
  ]),
  timestamp: z.iso.datetime({ offset: true }),
  reason: z.string().min(1),
  old_state: z.unknown(),
  new_state: z.unknown(),
  provenance: provenanceSchema,
});
export type HumanDecisionAudit = z.infer<typeof humanDecisionAuditSchema>;

export const providerAttemptSchema = z.object({
  attempt_id: idSchema,
  provider: z.string().min(1),
  operation: z.string().min(1),
  timestamp: z.iso.datetime({ offset: true }),
  attempts: z.number().int().positive(),
  result: z.enum([
    "SUCCESS",
    "PARTIAL_RESULT",
    "SOURCE_UNAVAILABLE",
    "RETRYABLE_FAILURE",
    "NON_RETRYABLE_FAILURE",
    "HUMAN_REVIEW_REQUIRED",
  ]),
  last_error: z.string().min(1).optional(),
});
export type ProviderAttempt = z.infer<typeof providerAttemptSchema>;

export const checkpointSchema = z.object({
  checkpoint_id: idSchema,
  matter_id: idSchema,
  version_id: idSchema,
  stage: z.enum([
    "ingestion",
    "evidence",
    "legal_research",
    "strategy",
    "drafting",
    "human_approval",
  ]),
  created_at: z.iso.datetime({ offset: true }),
  reason: z.string().min(1),
});
export type Checkpoint = z.infer<typeof checkpointSchema>;

export const cacheEntrySchema = z.object({
  cache_key: idSchema,
  matter_version: idSchema,
  engine_version: z.string().min(1),
  relevant_date: z.iso.date().optional(),
  language: z.string().min(2),
  input_ids: z.array(idSchema),
  freshness: z.array(sourceFreshnessSchema).default([]),
  value: z.unknown(),
});
export type CacheEntry = z.infer<typeof cacheEntrySchema>;

export const matterSnapshotSchema = z.object({
  schema_version: z.literal(CURRENT_MATTER_STORE_SCHEMA_VERSION),
  metadata: matterVersionMetadataSchema,
  model: matterModelSchema,
  source_freshness: z.array(sourceFreshnessSchema).default([]),
  draft_versions: z.array(draftVersionSchema).default([]),
  final_qa: z.array(finalBriefQaSchema).default([]),
  audit_trail: z.array(auditEntrySchema).default([]),
  human_decisions: z.array(humanDecisionAuditSchema).default([]),
  provider_attempts: z.array(providerAttemptSchema).default([]),
  checkpoints: z.array(checkpointSchema).default([]),
  derived_cache: z.array(cacheEntrySchema).default([]),
  indexes: z
    .object({
      document_ids: z.array(idSchema).default([]),
      proposition_ids: z.array(idSchema).default([]),
      issue_ids: z.array(idSchema).default([]),
      claim_ids: z.array(idSchema).default([]),
      authority_ids: z.array(idSchema).default([]),
      procedural_stages: z.array(z.string().min(1)).default([]),
      dates: z.array(z.string().min(1)).default([]),
    })
    .default({
      document_ids: [],
      proposition_ids: [],
      issue_ids: [],
      claim_ids: [],
      authority_ids: [],
      procedural_stages: [],
      dates: [],
    }),
});
export type MatterSnapshot = z.infer<typeof matterSnapshotSchema>;

export const matterHealthSchema = z.object({
  view_type: z.literal("MATTER_HEALTH"),
  source_of_truth: z.literal(false),
  evidence_completeness: z.enum(["STRONG", "PARTIAL", "WEAK", "UNKNOWN"]),
  chronology_completeness: z.enum(["STRONG", "PARTIAL", "WEAK", "UNKNOWN"]),
  legal_research_sufficiency: z.enum(["SUFFICIENT", "PARTIAL", "WEAK", "UNKNOWN"]),
  adverse_precedent_status: z.enum([
    "ADDRESSED",
    "PRESENT_UNADDRESSED",
    "NONE_IDENTIFIED",
    "UNKNOWN",
  ]),
  procedural_readiness: z.enum(["READY", "PARTIAL", "BLOCKED", "UNKNOWN"]),
  draft_readiness: z.enum(["READY_FOR_HUMAN_REVIEW", "REVIEW_REQUIRED", "NOT_DRAFTED", "UNKNOWN"]),
  human_review_flags: z.array(z.string().min(1)),
  staleness: z.array(sourceFreshnessSchema),
  blocking_issues: z.array(z.string().min(1)),
});
export type MatterHealth = z.infer<typeof matterHealthSchema>;

function nowIso(): string {
  return new Date().toISOString();
}

function buildIndexes(model: MatterModel): MatterSnapshot["indexes"] {
  return {
    document_ids: model.documents.map((item) => item.id),
    proposition_ids: model.propositions.map((item) => item.id),
    issue_ids: model.issues.map((item) => item.id),
    claim_ids: model.claims.map((item) => item.id),
    authority_ids: model.legal_authorities.map((item) => item.id),
    procedural_stages: [
      ...new Set(
        [
          ...model.requests,
          ...model.responses,
          ...model.actions,
          ...model.decisions,
          ...model.issues,
          ...model.arguments,
        ].flatMap((item) =>
          item.procedural_context?.stage === undefined ? [] : [item.procedural_context.stage],
        ),
      ),
    ],
    dates: [
      ...new Set(
        [
          ...model.requests,
          ...model.responses,
          ...model.actions,
          ...model.decisions,
          ...model.factual_findings,
        ]
          .map((item) => item.procedural_context?.date ?? ("date" in item ? item.date : undefined))
          .flatMap((date) => (date === undefined ? [] : [date])),
      ),
    ],
  };
}

export function safeStorePath(rootDir: string, ...segments: string[]): string {
  const root = resolve(rootDir);
  const target = resolve(root, ...segments.map((segment) => normalize(segment)));
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error("Path traversal outside matter store root is not allowed.");
  }
  return target;
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

export function createMatterSnapshot(input: {
  model: MatterModel;
  created_by: string;
  change_summary: string;
  source_event: string;
  human_approved?: boolean;
  parent_version_id?: string;
  version_id?: string;
  source_freshness?: SourceFreshness[];
  draft_versions?: MatterSnapshot["draft_versions"];
  final_qa?: MatterSnapshot["final_qa"];
  audit_trail?: AuditEntry[];
  human_decisions?: HumanDecisionAudit[];
  provider_attempts?: ProviderAttempt[];
  checkpoints?: Checkpoint[];
  derived_cache?: CacheEntry[];
}): MatterSnapshot {
  const versionId = input.version_id ?? `v-${Date.now()}-${randomUUID()}`;
  return matterSnapshotSchema.parse({
    schema_version: CURRENT_MATTER_STORE_SCHEMA_VERSION,
    metadata: {
      matter_id: input.model.matter.id,
      version_id: versionId,
      parent_version_id: input.parent_version_id,
      created_at: nowIso(),
      created_by: input.created_by,
      change_summary: input.change_summary,
      source_event: input.source_event,
      human_approved: input.human_approved ?? false,
      schema_version: CURRENT_MATTER_STORE_SCHEMA_VERSION,
    },
    model: input.model,
    source_freshness: input.source_freshness ?? [],
    draft_versions: input.draft_versions ?? [],
    final_qa: input.final_qa ?? [],
    audit_trail: input.audit_trail ?? [],
    human_decisions: input.human_decisions ?? [],
    provider_attempts: input.provider_attempts ?? [],
    checkpoints: input.checkpoints ?? [],
    derived_cache: input.derived_cache ?? [],
    indexes: buildIndexes(input.model),
  });
}

export function migrateMatterSnapshot(input: unknown): MatterSnapshot {
  const maybe = input as { schema_version?: string; metadata?: { schema_version?: string } };
  if (maybe.schema_version === CURRENT_MATTER_STORE_SCHEMA_VERSION) {
    return matterSnapshotSchema.parse(input);
  }
  if (
    maybe.schema_version === "matter-store.v0" ||
    maybe.metadata?.schema_version === "matter-store.v0"
  ) {
    const legacy = input as { model: MatterModel; metadata?: Partial<MatterVersionMetadata> };
    return createMatterSnapshot({
      model: matterModelSchema.parse(legacy.model),
      created_by: legacy.metadata?.created_by ?? "migration",
      change_summary: legacy.metadata?.change_summary ?? "Migrated legacy matter snapshot.",
      source_event: legacy.metadata?.source_event ?? "schema_migration",
      human_approved: legacy.metadata?.human_approved ?? false,
      parent_version_id: legacy.metadata?.parent_version_id,
      version_id: legacy.metadata?.version_id,
    });
  }
  return matterSnapshotSchema.parse(input);
}

export function importMatterSnapshot(input: unknown): MatterSnapshot {
  return migrateMatterSnapshot(input);
}

export function exportMatterAuditBundle(snapshot: MatterSnapshot): {
  snapshot: MatterSnapshot;
  audit_trail: AuditEntry[];
  human_decisions: HumanDecisionAudit[];
  source_freshness: SourceFreshness[];
} {
  const parsed = matterSnapshotSchema.parse(snapshot);
  return {
    snapshot: parsed,
    audit_trail: parsed.audit_trail,
    human_decisions: parsed.human_decisions,
    source_freshness: parsed.source_freshness,
  };
}

export function diffMatterSnapshots(
  left: MatterSnapshot,
  right: MatterSnapshot,
): {
  added_ids: string[];
  removed_ids: string[];
  changed_collection_counts: string[];
} {
  const leftIds = new Set([
    ...left.indexes.document_ids,
    ...left.indexes.proposition_ids,
    ...left.indexes.issue_ids,
    ...left.indexes.claim_ids,
    ...left.indexes.authority_ids,
  ]);
  const rightIds = new Set([
    ...right.indexes.document_ids,
    ...right.indexes.proposition_ids,
    ...right.indexes.issue_ids,
    ...right.indexes.claim_ids,
    ...right.indexes.authority_ids,
  ]);
  const collections: Array<keyof MatterModel> = [
    "documents",
    "passages",
    "propositions",
    "assertions",
    "evidence",
    "issues",
    "legal_authorities",
    "legal_propositions",
    "arguments",
  ];
  return {
    added_ids: [...rightIds].filter((id) => !leftIds.has(id)),
    removed_ids: [...leftIds].filter((id) => !rightIds.has(id)),
    changed_collection_counts: collections.filter(
      (collection) =>
        JSON.stringify(left.model[collection]) !== JSON.stringify(right.model[collection]),
    ),
  };
}

export function whatWeKnewAt(snapshot: MatterSnapshot, at: string): MatterSnapshot {
  const cutoff = new Date(at).getTime();
  const before = (date?: string): boolean =>
    date === undefined || new Date(date).getTime() <= cutoff;
  return matterSnapshotSchema.parse({
    ...snapshot,
    model: {
      ...snapshot.model,
      documents: snapshot.model.documents.filter((item) => before(item.created_at)),
      passages: snapshot.model.passages.filter((item) => before(item.created_at)),
      propositions: snapshot.model.propositions.filter((item) => before(item.created_at)),
      assertions: snapshot.model.assertions.filter((item) => before(item.created_at)),
      evidence: snapshot.model.evidence.filter((item) => before(item.created_at)),
      factual_findings: snapshot.model.factual_findings.filter((item) => before(item.created_at)),
      legal_authorities: snapshot.model.legal_authorities.filter((item) => before(item.created_at)),
      legal_propositions: snapshot.model.legal_propositions.filter((item) =>
        before(item.created_at),
      ),
      arguments: snapshot.model.arguments.filter((item) => before(item.created_at)),
      human_review_records: snapshot.model.human_review_records.filter((item) =>
        before(item.created_at),
      ),
    },
    indexes: buildIndexes(snapshot.model),
  });
}

export function invalidateDerivedViews(input: {
  snapshot: MatterSnapshot;
  changed_ids: string[];
  locked_ids?: string[];
}): Array<{ object_id: string; state: DependencyInvalidationState; reason: string }> {
  const changed = new Set(input.changed_ids);
  const locked = new Set(input.locked_ids ?? []);
  const affected = new Set<string>();
  for (const link of input.snapshot.model.trace_links) {
    if (changed.has(link.from_id)) affected.add(link.to_id);
    if (changed.has(link.to_id)) affected.add(link.from_id);
  }
  return [...affected].map((objectId) => ({
    object_id: objectId,
    state: locked.has(objectId) ? "LOCK_CONFLICT" : "RECOMPUTE_REQUIRED",
    reason: locked.has(objectId)
      ? "Changed dependency affects a human-locked object."
      : "Changed dependency affects this derived object.",
  }));
}

export function resolveFreshness(input: {
  source: SourceFreshness;
  now: string;
  maxAgeDays: number;
}): FreshnessState {
  if (input.source.source_status === "UNAVAILABLE") return "SOURCE_UNAVAILABLE";
  const verifiedAt = input.source.verification_date ?? input.source.retrieved_at;
  const ageMs = new Date(input.now).getTime() - new Date(verifiedAt).getTime();
  if (ageMs < 0) return "UNKNOWN";
  const ageDays = ageMs / 86_400_000;
  if (ageDays <= input.maxAgeDays && input.source.source_status === "FULL_TEXT_VERIFIED_OFFICIAL") {
    return "CURRENTLY_VERIFIED";
  }
  if (ageDays > input.maxAgeDays * 2) return "REQUIRES_REFRESH";
  if (ageDays > input.maxAgeDays) return "POTENTIALLY_STALE";
  return "HISTORICALLY_VERIFIED";
}

export function summarizeMatterHealth(snapshot: MatterSnapshot): MatterHealth {
  const stale = snapshot.source_freshness.filter((item) =>
    ["POTENTIALLY_STALE", "REQUIRES_REFRESH", "SOURCE_UNAVAILABLE"].includes(item.freshness_status),
  );
  const blocking = [
    ...(snapshot.model.evidence.length === 0 ? ["no_evidence"] : []),
    ...(snapshot.model.legal_authorities.length === 0 ? ["no_legal_authorities"] : []),
    ...(stale.some((item) => item.freshness_status === "REQUIRES_REFRESH")
      ? ["stale_legal_source"]
      : []),
  ];
  return matterHealthSchema.parse({
    view_type: "MATTER_HEALTH",
    source_of_truth: false,
    evidence_completeness:
      snapshot.model.evidence.length >= 3
        ? "STRONG"
        : snapshot.model.evidence.length > 0
          ? "PARTIAL"
          : "WEAK",
    chronology_completeness:
      snapshot.model.requests.length +
        snapshot.model.responses.length +
        snapshot.model.decisions.length >
      0
        ? "PARTIAL"
        : "UNKNOWN",
    legal_research_sufficiency: snapshot.model.legal_authorities.length > 0 ? "PARTIAL" : "WEAK",
    adverse_precedent_status: snapshot.model.precedent_applications.some((item) =>
      item.application.includes("ADVERSE"),
    )
      ? "PRESENT_UNADDRESSED"
      : "UNKNOWN",
    procedural_readiness: blocking.length > 0 ? "PARTIAL" : "READY",
    draft_readiness: snapshot.final_qa.length > 0 ? "READY_FOR_HUMAN_REVIEW" : "NOT_DRAFTED",
    human_review_flags: [
      ...snapshot.human_decisions
        .filter((item) => item.decision === "OVERRIDE" || item.decision === "LOCK")
        .map((item) => item.object_id),
    ],
    staleness: stale,
    blocking_issues: blocking,
  });
}

export class FileMatterStore {
  constructor(private readonly rootDir: string) {}

  async save(snapshot: MatterSnapshot): Promise<MatterSnapshot> {
    const parsed = matterSnapshotSchema.parse(snapshot);
    const path = safeStorePath(
      this.rootDir,
      parsed.metadata.matter_id,
      "versions",
      `${parsed.metadata.version_id}.json`,
    );
    await atomicWriteJson(path, parsed);
    await atomicWriteJson(
      safeStorePath(this.rootDir, parsed.metadata.matter_id, "current.json"),
      parsed,
    );
    return parsed;
  }

  async load(matterId: string, versionId?: string): Promise<MatterSnapshot> {
    const path =
      versionId === undefined
        ? safeStorePath(this.rootDir, matterId, "current.json")
        : safeStorePath(this.rootDir, matterId, "versions", `${versionId}.json`);
    return migrateMatterSnapshot(JSON.parse(await readFile(path, "utf8")));
  }

  async listVersions(matterId: string): Promise<readonly MatterVersionMetadata[]> {
    const versionsDir = safeStorePath(this.rootDir, matterId, "versions");
    const files = await readdir(versionsDir).catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
      throw error;
    });
    const snapshots = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => this.load(matterId, file.slice(0, -".json".length))),
    );
    return snapshots
      .map((snapshot) => snapshot.metadata)
      .sort((left, right) => left.created_at.localeCompare(right.created_at));
  }

  async checkpoint(
    snapshot: MatterSnapshot,
    stage: Checkpoint["stage"],
    reason: string,
  ): Promise<Checkpoint> {
    const checkpoint = checkpointSchema.parse({
      checkpoint_id: `checkpoint-${randomUUID()}`,
      matter_id: snapshot.metadata.matter_id,
      version_id: snapshot.metadata.version_id,
      stage,
      created_at: nowIso(),
      reason,
    });
    await atomicWriteJson(
      safeStorePath(
        this.rootDir,
        snapshot.metadata.matter_id,
        "checkpoints",
        `${checkpoint.checkpoint_id}.json`,
      ),
      checkpoint,
    );
    return checkpoint;
  }

  async migrateWithBackup(input: unknown, backupReason: string): Promise<MatterSnapshot> {
    const migrated = migrateMatterSnapshot(input);
    await atomicWriteJson(
      safeStorePath(
        this.rootDir,
        migrated.metadata.matter_id,
        "migration-backups",
        `${Date.now()}.json`,
      ),
      { reason: backupReason, original: input },
    );
    return this.save(migrated);
  }
}

export function preserveLockOnContradiction(input: {
  reviewed_state?: z.infer<typeof reviewStateSchema>;
  incoming_contradicts_existing: boolean;
}): DependencyInvalidationState {
  if (input.reviewed_state?.status === "HUMAN_LOCKED" && input.incoming_contradicts_existing) {
    return "HUMAN_REVIEW_REQUIRED";
  }
  return input.incoming_contradicts_existing ? "REVIEW_RECOMMENDED" : "UNCHANGED";
}
