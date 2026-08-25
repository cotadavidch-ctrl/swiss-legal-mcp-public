import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  matterModelSchema,
  provenanceRefSchema,
  type MatterModel,
  type ProvenanceRef,
  type ToolContext,
  type ToolRegistry,
} from "@swiss-legal-mcp/core";
import { draftAssertionSchema, runFinalKillerQa } from "@swiss-legal-mcp/legal-drafting";
import {
  FileMatterStore,
  createMatterSnapshot,
  matterSnapshotSchema,
  summarizeMatterHealth,
  type MatterSnapshot,
  type SourceFreshness,
} from "@swiss-legal-mcp/matter-store";
import {
  executeMatterPipeline,
  legalResearchProviderAdapterSchema,
  recordProviderFailure,
  researchLegalIssues,
  runPartialPipeline,
} from "@swiss-legal-mcp/legal-runtime";

const inMemoryMatterStore = new Map<string, MatterSnapshot>();
const matterStoreByRoot = new Map<string, FileMatterStore>();

const provenanceSchema = z.array(provenanceRefSchema).min(1);
const languageSchema = z.enum(["DE", "FR", "IT", "ES"]);

function isFileNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function defaultMatterStoreRoot(): string {
  const environment = process["env"];
  const configured = environment["SWISS_LEGAL_MATTER_STORE_DIR"];
  if (configured !== undefined && configured.trim().length > 0) return configured;
  const dataHome = environment["XDG_DATA_HOME"] ?? join(homedir(), ".local", "share");
  return join(dataHome, "swiss-legal-mcp", "matters");
}

function matterStore(): FileMatterStore {
  const root = defaultMatterStoreRoot();
  const existing = matterStoreByRoot.get(root);
  if (existing) return existing;
  const store = new FileMatterStore(root);
  matterStoreByRoot.set(root, store);
  return store;
}

function nowIso(): string {
  return new Date().toISOString();
}

function stableId(prefix: string, ...parts: readonly string[]): string {
  const hash = createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 24);
  return `${prefix}-${hash}`;
}

function systemProvenance(...inputIds: readonly string[]): ProvenanceRef[] {
  return [{ type: "SYSTEM_DERIVATION", system_derivation_input_ids: [...inputIds] }];
}

async function loadMatterSnapshot(matterId: string): Promise<MatterSnapshot | undefined> {
  try {
    const snapshot = await matterStore().load(matterId);
    inMemoryMatterStore.set(matterId, snapshot);
    return snapshot;
  } catch (error) {
    if (isFileNotFound(error)) {
      inMemoryMatterStore.delete(matterId);
      return undefined;
    }
    throw error;
  }
}

async function saveMatterSnapshot(snapshot: MatterSnapshot): Promise<MatterSnapshot> {
  const saved = await matterStore().save(snapshot);
  inMemoryMatterStore.set(saved.metadata.matter_id, saved);
  return saved;
}

async function listMatterVersions(matterId: string) {
  return matterStore()
    .listVersions(matterId)
    .catch((error: unknown) => {
      if (isFileNotFound(error)) return [];
      throw error;
    });
}

function buildAuditEntry(input: {
  snapshot: MatterSnapshot;
  reason: string;
  changedBy: string;
  objectId: string;
  oldState: unknown;
  newState: unknown;
  provenance: ProvenanceRef[];
}) {
  return {
    audit_id: `audit-${randomUUID()}`,
    matter_id: input.snapshot.metadata.matter_id,
    version_id: input.snapshot.metadata.version_id,
    changed_by: input.changedBy,
    timestamp: nowIso(),
    reason: input.reason,
    object_id: input.objectId,
    old_state: input.oldState,
    new_state: input.newState,
    provenance: input.provenance,
  };
}

async function createDurableSnapshot(input: {
  model: MatterModel;
  createdBy: string;
  changeSummary: string;
  sourceEvent: string;
  humanApproved?: boolean;
}): Promise<{ snapshot: MatterSnapshot; versionCount: number }> {
  const previous = await loadMatterSnapshot(input.model.matter.id);
  const provenance = systemProvenance(previous?.metadata.version_id ?? input.model.matter.id);
  const draft = createMatterSnapshot({
    model: input.model,
    created_by: input.createdBy,
    change_summary: input.changeSummary,
    source_event: input.sourceEvent,
    human_approved: input.humanApproved,
    parent_version_id: previous?.metadata.version_id,
    source_freshness: previous?.source_freshness,
    draft_versions: previous?.draft_versions,
    final_qa: previous?.final_qa,
    audit_trail: previous?.audit_trail,
    human_decisions: previous?.human_decisions,
    provider_attempts: previous?.provider_attempts,
    checkpoints: previous?.checkpoints,
    derived_cache: previous?.derived_cache,
  });
  const withAudit = matterSnapshotSchema.parse({
    ...draft,
    audit_trail: [
      ...draft.audit_trail,
      buildAuditEntry({
        snapshot: draft,
        reason: input.changeSummary,
        changedBy: input.createdBy,
        objectId: input.model.matter.id,
        oldState: previous
          ? { version_id: previous.metadata.version_id, indexes: previous.indexes }
          : null,
        newState: {
          document_count: input.model.documents.length,
          issue_count: input.model.issues.length,
        },
        provenance,
      }),
    ],
  });
  await saveMatterSnapshot(withAudit);
  const checkpoint = await matterStore().checkpoint(withAudit, "ingestion", input.changeSummary);
  const snapshot = matterSnapshotSchema.parse({
    ...withAudit,
    checkpoints: [...withAudit.checkpoints, checkpoint],
  });
  await saveMatterSnapshot(snapshot);
  return { snapshot, versionCount: (await listMatterVersions(snapshot.metadata.matter_id)).length };
}

async function saveDraftQaSnapshot(input: {
  snapshot: MatterSnapshot;
  qa: ReturnType<typeof runFinalKillerQa>;
  provenance: ProvenanceRef[];
  changedBy: string;
}): Promise<MatterSnapshot> {
  const draft = createMatterSnapshot({
    model: input.snapshot.model,
    created_by: input.changedBy,
    change_summary: "Saved draft QA result from MCP audit_legal_draft.",
    source_event: "mcp_audit_legal_draft",
    human_approved: input.snapshot.metadata.human_approved,
    parent_version_id: input.snapshot.metadata.version_id,
    source_freshness: input.snapshot.source_freshness,
    draft_versions: input.snapshot.draft_versions,
    final_qa: [...input.snapshot.final_qa, input.qa],
    audit_trail: input.snapshot.audit_trail,
    human_decisions: input.snapshot.human_decisions,
    provider_attempts: input.snapshot.provider_attempts,
    checkpoints: input.snapshot.checkpoints,
    derived_cache: input.snapshot.derived_cache,
  });
  const withAudit = matterSnapshotSchema.parse({
    ...draft,
    audit_trail: [
      ...draft.audit_trail,
      buildAuditEntry({
        snapshot: draft,
        reason: "Saved draft QA result from MCP audit_legal_draft.",
        changedBy: input.changedBy,
        objectId: input.snapshot.metadata.matter_id,
        oldState: { final_qa_count: input.snapshot.final_qa.length },
        newState: { final_qa_count: draft.final_qa.length, readiness: input.qa.readiness },
        provenance: input.provenance,
      }),
    ],
  });
  await saveMatterSnapshot(withAudit);
  const checkpoint = await matterStore().checkpoint(
    withAudit,
    "drafting",
    "Draft QA result saved through MCP audit_legal_draft.",
  );
  const saved = matterSnapshotSchema.parse({
    ...withAudit,
    checkpoints: [...withAudit.checkpoints, checkpoint],
  });
  return saveMatterSnapshot(saved);
}

function toProviderAttempt(input: {
  provider: string;
  operation: string;
  result: "SUCCESS" | "PARTIAL_RESULT" | "SOURCE_UNAVAILABLE" | "RETRYABLE_FAILURE";
  lastError?: string;
}) {
  if (input.result === "RETRYABLE_FAILURE") {
    return recordProviderFailure({
      provider: input.provider,
      operation: input.operation,
      attempts: 1,
      retryable: true,
      last_error: input.lastError ?? "Provider operation failed.",
    });
  }
  return {
    attempt_id: `${input.provider}-${stableId(input.operation, nowIso())}`,
    provider: input.provider,
    operation: input.operation,
    timestamp: nowIso(),
    attempts: 1,
    result: input.result,
    ...(input.lastError ? { last_error: input.lastError } : {}),
  };
}

function relevantDateFor(snapshot: MatterSnapshot, issue: MatterModel["issues"][number]) {
  return issue.procedural_context?.date ?? snapshot.indexes.dates[0];
}

function toMcpLanguage(language: z.infer<typeof languageSchema>): "de" | "fr" | "it" {
  return language === "FR" ? "fr" : language === "IT" ? "it" : "de";
}

function firstText(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["fullText", "text", "main_ground", "ratio_summary", "excerpt", "summary"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
  }
  for (const candidate of Object.values(record)) {
    const nested = firstText(candidate);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function pickUrl(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["official_source_uri", "final_url", "source_url", "url"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.startsWith("http")) return candidate;
  }
  for (const candidate of Object.values(record)) {
    const nested = pickUrl(candidate);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function isOfficialFullTextResolution(value: unknown): boolean {
  return JSON.stringify(value).includes("full_text_verified_official");
}

// Maximum number of provider calls allowed per research_legal_issues execution
// This prevents excessive provider calls and ensures bounded execution
const TOTAL_CALL_BUDGET = 10;

async function orchestrateLiveResearch(input: {
  snapshot: MatterSnapshot;
  tools: ToolRegistry;
  context: ToolContext & { signal?: AbortSignal };
  language: z.infer<typeof languageSchema>;
}): Promise<{
  snapshot: MatterSnapshot;
  status: "PARTIAL_RESULT" | "SOURCE_UNAVAILABLE" | "ABORTED" | "BUDGET_EXHAUSTED";
  attempts: ReturnType<typeof toProviderAttempt>[];
  added: {
    authority_ids: string[];
    legal_proposition_ids: string[];
    precedent_application_ids: string[];
  };
  warnings: string[];
}> {
  const base = input.snapshot;
  const adapter = buildMcpLegalResearchAdapter(input.tools);
  const attempts: ReturnType<typeof toProviderAttempt>[] = [];
  const warnings: string[] = [];
  const added = {
    authority_ids: [] as string[],
    legal_proposition_ids: [] as string[],
    precedent_application_ids: [] as string[],
  };
  // Track provider calls to enforce total call budget
  let providerCallCount = 0;

  // Helper to check if we can make another provider call
  const canMakeProviderCall = (): boolean => {
    // Check if we've exhausted the budget
    if (providerCallCount >= TOTAL_CALL_BUDGET) {
      return false;
    }
    // Check if operation was aborted
    if (input.context.signal?.aborted) {
      return false;
    }
    return true;
  };

  // Helper to execute a provider call with budget tracking and attempt recording
  const executeProviderCall = async <T>(
    operation: () => Promise<T>,
    providerName: string,
    operationName: string,
  ): Promise<T> => {
    // Check budget and abort status before making the call
    if (!canMakeProviderCall()) {
      if (providerCallCount >= TOTAL_CALL_BUDGET) {
        throw new Error(`Provider call budget exhausted (${TOTAL_CALL_BUDGET} calls)`);
      }
      // If aborted, this will be caught by the caller's abort check
      throw new Error("Operation aborted");
    }

    providerCallCount++;
    try {
      const result = await operation();
      // Record successful attempt
      attempts.push(
        toProviderAttempt({
          provider: providerName,
          operation: operationName,
          result: "SUCCESS",
        }),
      );
      return result;
    } catch (error) {
      // Determine if this is a retryable failure
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("timeout") ||
          error.message.includes("HTTP 429") ||
          error.message.includes("HTTP 502") ||
          error.message.includes("HTTP 503") ||
          error.message.includes("HTTP 504") ||
          error.name === "AbortError");

      // Record failed attempt
      attempts.push(
        toProviderAttempt({
          provider: providerName,
          operation: operationName,
          result: isRetryable ? "RETRYABLE_FAILURE" : "SOURCE_UNAVAILABLE",
          lastError: error instanceof Error ? error.message : String(error),
        }),
      );

      // Re-throw the error to be handled by the caller
      throw error;
    }
  };
  const model: MatterModel = {
    ...base.model,
    legal_authorities: [...base.model.legal_authorities],
    legal_propositions: [...base.model.legal_propositions],
    precedent_applications: [...base.model.precedent_applications],
  };
  const sourceFreshness: SourceFreshness[] = [...base.source_freshness];

  const addAuthority = (authority: MatterModel["legal_authorities"][number]) => {
    if (model.legal_authorities.some((item) => item.id === authority.id)) return false;
    model.legal_authorities.push(authority);
    added.authority_ids.push(authority.id);
    return true;
  };
  const isHumanLocked = (objectId: string) =>
    model.human_review_records.some(
      (record) => record.reviewed_object_id === objectId && record.decision === "LOCKED",
    );
  const addLegalProposition = (proposition: MatterModel["legal_propositions"][number]) => {
    const existing = model.legal_propositions.find((item) => item.id === proposition.id);
    if (existing && isHumanLocked(existing.id) && existing.text !== proposition.text) {
      warnings.push(`human_locked_legal_proposition_conflict:${proposition.id}`);
      return false;
    }
    if (existing) return false;
    model.legal_propositions.push(proposition);
    added.legal_proposition_ids.push(proposition.id);
    return true;
  };
  const addPrecedentApplication = (application: MatterModel["precedent_applications"][number]) => {
    if (model.precedent_applications.some((item) => item.id === application.id)) return false;
    model.precedent_applications.push(application);
    added.precedent_application_ids.push(application.id);
    return true;
  };

  const language = toMcpLanguage(input.language);
  for (const issue of base.model.issues.slice(0, 10)) {
    // Check if operation was aborted
    if (input.context.signal?.aborted) {
      // Return early with aborted status and current results
      const researched = createMatterSnapshot({
        model,
        created_by: "mcp-research-legal-issues",
        change_summary: "Live legal research orchestration aborted.",
        source_event: "mcp_research_legal_issues",
        human_approved: base.metadata.human_approved,
        parent_version_id: base.metadata.version_id,
        source_freshness: sourceFreshness,
        draft_versions: base.draft_versions,
        final_qa: base.final_qa,
        audit_trail: base.audit_trail,
        human_decisions: base.human_decisions,
        provider_attempts: [...base.provider_attempts, ...attempts],
        checkpoints: base.checkpoints,
        derived_cache: base.derived_cache,
      });
      const withAudit = matterSnapshotSchema.parse({
        ...researched,
        audit_trail: [
          ...researched.audit_trail,
          buildAuditEntry({
            snapshot: researched,
            reason: "Live legal research orchestration aborted.",
            changedBy: "mcp-research-legal-issues",
            objectId: base.metadata.matter_id,
            oldState: {
              legal_authority_count: base.model.legal_authorities.length,
              legal_proposition_count: base.model.legal_propositions.length,
              precedent_application_count: base.model.precedent_applications.length,
            },
            newState: {
              added,
              legal_authority_count: researched.model.legal_authorities.length,
              legal_proposition_count: researched.model.legal_propositions.length,
              precedent_application_count: researched.model.precedent_applications.length,
            },
            provenance: systemProvenance(base.metadata.version_id),
          }),
        ],
      });
      await saveMatterSnapshot(withAudit);
      const checkpoint = await matterStore().checkpoint(
        withAudit,
        "legal_research",
        "Live legal research orchestration aborted.",
      );
      const saved = matterSnapshotSchema.parse({
        ...withAudit,
        checkpoints: [...withAudit.checkpoints, checkpoint],
      });
      return {
        snapshot: await saveMatterSnapshot(saved),
        status: "ABORTED",
        attempts,
        added,
        warnings,
      };
    }

    const relevantDate = relevantDateFor(base, issue);
    if (adapter.supports_fedlex) {
      // Check if we can make the provider call (budget and abort)
      if (!canMakeProviderCall()) {
        if (providerCallCount >= TOTAL_CALL_BUDGET) {
          // Budget exhausted - return early with BUDGET_EXHAUSTED status
          const researched = createMatterSnapshot({
            model,
            created_by: "mcp-research-legal-issues",
            change_summary:
              "Live legal research orchestration stopped due to provider call budget exhaustion.",
            source_event: "mcp_research_legal_issues",
            human_approved: base.metadata.human_approved,
            parent_version_id: base.metadata.version_id,
            source_freshness: sourceFreshness,
            draft_versions: base.draft_versions,
            final_qa: base.final_qa,
            audit_trail: base.audit_trail,
            human_decisions: base.human_decisions,
            provider_attempts: [...base.provider_attempts, ...attempts],
            checkpoints: base.checkpoints,
            derived_cache: base.derived_cache,
          });
          const withAudit = matterSnapshotSchema.parse({
            ...researched,
            audit_trail: [
              ...researched.audit_trail,
              buildAuditEntry({
                snapshot: researched,
                reason:
                  "Live legal research orchestration stopped due to provider call budget exhaustion.",
                changedBy: "mcp-research-legal-issues",
                objectId: base.metadata.matter_id,
                oldState: {
                  legal_authority_count: base.model.legal_authorities.length,
                  legal_proposition_count: base.model.legal_propositions.length,
                  precedent_application_count: base.model.precedent_applications.length,
                },
                newState: {
                  added,
                  legal_authority_count: researched.model.legal_authorities.length,
                  legal_proposition_count: researched.model.legal_propositions.length,
                  precedent_application_count: researched.model.precedent_applications.length,
                },
                provenance: systemProvenance(base.metadata.version_id),
              }),
            ],
          });
          await saveMatterSnapshot(withAudit);
          const checkpoint = await matterStore().checkpoint(
            withAudit,
            "legal_research",
            "Live legal research orchestration stopped due to provider call budget exhaustion.",
          );
          const saved = matterSnapshotSchema.parse({
            ...withAudit,
            checkpoints: [...withAudit.checkpoints, checkpoint],
          });
          return {
            snapshot: await saveMatterSnapshot(saved),
            status: "BUDGET_EXHAUSTED",
            attempts,
            added,
            warnings,
          };
        }
        // If aborted, handle abort case
        if (input.context.signal?.aborted) {
          // Return early with aborted status and current results
          const researched = createMatterSnapshot({
            model,
            created_by: "mcp-research-legal-issues",
            change_summary: "Live legal research orchestration aborted.",
            source_event: "mcp_research_legal_issues",
            human_approved: base.metadata.human_approved,
            parent_version_id: base.metadata.version_id,
            source_freshness: sourceFreshness,
            draft_versions: base.draft_versions,
            final_qa: base.final_qa,
            audit_trail: base.audit_trail,
            human_decisions: base.human_decisions,
            provider_attempts: [...base.provider_attempts, ...attempts],
            checkpoints: base.checkpoints,
            derived_cache: base.derived_cache,
          });
          const withAudit = matterSnapshotSchema.parse({
            ...researched,
            audit_trail: [
              ...researched.audit_trail,
              buildAuditEntry({
                snapshot: researched,
                reason: "Live legal research orchestration aborted.",
                changedBy: "mcp-research-legal-issues",
                objectId: base.metadata.matter_id,
                oldState: {
                  legal_authority_count: base.model.legal_authorities.length,
                  legal_proposition_count: base.model.legal_propositions.length,
                  precedent_application_count: base.model.precedent_applications.length,
                },
                newState: {
                  added,
                  legal_authority_count: researched.model.legal_authorities.length,
                  legal_proposition_count: researched.model.legal_propositions.length,
                  precedent_application_count: researched.model.precedent_applications.length,
                },
                provenance: systemProvenance(base.metadata.version_id),
              }),
            ],
          });
          await saveMatterSnapshot(withAudit);
          const checkpoint = await matterStore().checkpoint(
            withAudit,
            "legal_research",
            "Live legal research orchestration aborted.",
          );
          const saved = matterSnapshotSchema.parse({
            ...withAudit,
            checkpoints: [...withAudit.checkpoints, checkpoint],
          });
          return {
            snapshot: await saveMatterSnapshot(saved),
            status: "ABORTED",
            attempts,
            added,
            warnings,
          };
        }
      }
      try {
        const search = (await executeProviderCall(
          () =>
            input.tools.call(
              "search_legislation",
              {
                query: issue.text,
                language,
                ...(relevantDate ? { relevantDate, status: "any" } : { status: "in_force" }),
                pageSize: 2,
              },
              input.context,
            ),
          "fedlex",
          "search_legislation",
        )) as { items?: Array<Record<string, unknown>> };
        for (const item of search.items ?? []) {
          // Check if we can make the provider call (budget and abort)
          if (!canMakeProviderCall()) {
            if (providerCallCount >= TOTAL_CALL_BUDGET) {
              // Budget exhausted - return early with BUDGET_EXHAUSTED status
              const researched = createMatterSnapshot({
                model,
                created_by: "mcp-research-legal-issues",
                change_summary:
                  "Live legal research orchestration stopped due to provider call budget exhaustion.",
                source_event: "mcp_research_legal_issues",
                human_approved: base.metadata.human_approved,
                parent_version_id: base.metadata.version_id,
                source_freshness: sourceFreshness,
                draft_versions: base.draft_versions,
                final_qa: base.final_qa,
                audit_trail: base.audit_trail,
                human_decisions: base.human_decisions,
                provider_attempts: [...base.provider_attempts, ...attempts],
                checkpoints: base.checkpoints,
                derived_cache: base.derived_cache,
              });
              const withAudit = matterSnapshotSchema.parse({
                ...researched,
                audit_trail: [
                  ...researched.audit_trail,
                  buildAuditEntry({
                    snapshot: researched,
                    reason:
                      "Live legal research orchestration stopped due to provider call budget exhaustion.",
                    changedBy: "mcp-research-legal-issues",
                    objectId: base.metadata.matter_id,
                    oldState: {
                      legal_authority_count: base.model.legal_authorities.length,
                      legal_proposition_count: base.model.legal_propositions.length,
                      precedent_application_count: base.model.precedent_applications.length,
                    },
                    newState: {
                      added,
                      legal_authority_count: researched.model.legal_authorities.length,
                      legal_proposition_count: researched.model.legal_propositions.length,
                      precedent_application_count: researched.model.precedent_applications.length,
                    },
                    provenance: systemProvenance(base.metadata.version_id),
                  }),
                ],
              });
              await saveMatterSnapshot(withAudit);
              const checkpoint = await matterStore().checkpoint(
                withAudit,
                "legal_research",
                "Live legal research orchestration stopped due to provider call budget exhaustion.",
              );
              const saved = matterSnapshotSchema.parse({
                ...withAudit,
                checkpoints: [...withAudit.checkpoints, checkpoint],
              });
              return {
                snapshot: await saveMatterSnapshot(saved),
                status: "BUDGET_EXHAUSTED",
                attempts,
                added,
                warnings,
              };
            }
            // If aborted, handle abort case
            if (input.context.signal?.aborted) {
              // Return early with aborted status and current results
              const researched = createMatterSnapshot({
                model,
                created_by: "mcp-research-legal-issues",
                change_summary: "Live legal research orchestration aborted.",
                source_event: "mcp_research_legal_issues",
                human_approved: base.metadata.human_approved,
                parent_version_id: base.metadata.version_id,
                source_freshness: sourceFreshness,
                draft_versions: base.draft_versions,
                final_qa: base.final_qa,
                audit_trail: base.audit_trail,
                human_decisions: base.human_decisions,
                provider_attempts: [...base.provider_attempts, ...attempts],
                checkpoints: base.checkpoints,
                derived_cache: base.derived_cache,
              });
              const withAudit = matterSnapshotSchema.parse({
                ...researched,
                audit_trail: [
                  ...researched.audit_trail,
                  buildAuditEntry({
                    snapshot: researched,
                    reason: "Live legal research orchestration aborted.",
                    changedBy: "mcp-research-legal-issues",
                    objectId: base.metadata.matter_id,
                    oldState: {
                      legal_authority_count: base.model.legal_authorities.length,
                      legal_proposition_count: base.model.legal_propositions.length,
                      precedent_application_count: base.model.precedent_applications.length,
                    },
                    newState: {
                      added,
                      legal_authority_count: researched.model.legal_authorities.length,
                      legal_proposition_count: researched.model.legal_propositions.length,
                      precedent_application_count: researched.model.precedent_applications.length,
                    },
                    provenance: systemProvenance(base.metadata.version_id),
                  }),
                ],
              });
              await saveMatterSnapshot(withAudit);
              const checkpoint = await matterStore().checkpoint(
                withAudit,
                "legal_research",
                "Live legal research orchestration aborted.",
              );
              const saved = matterSnapshotSchema.parse({
                ...withAudit,
                checkpoints: [...withAudit.checkpoints, checkpoint],
              });
              return {
                snapshot: await saveMatterSnapshot(saved),
                status: "ABORTED",
                attempts,
                added,
                warnings,
              };
            }
          }
          const eli = typeof item["eli"] === "string" ? item["eli"] : undefined;
          const systematicNumber =
            typeof item["systematicNumber"] === "string" ? item["systematicNumber"] : undefined;
          const law = await executeProviderCall(
            () =>
              input.tools.call(
                "get_law",
                {
                  ...(eli ? { eli } : {}),
                  ...(systematicNumber ? { systematicNumber } : {}),
                  language,
                  ...(relevantDate ? { date: relevantDate } : {}),
                },
                input.context,
              ),
            "fedlex",
            "get_law",
          );
          const text = firstText(law);
          const authorityId = stableId(
            "authority",
            base.metadata.matter_id,
            "fedlex",
            eli ?? systematicNumber ?? issue.id,
          );
          const provenance = systemProvenance(base.metadata.version_id, issue.id, authorityId);
          addAuthority({
            kind: "LegalAuthority",
            id: authorityId,
            matter_id: base.metadata.matter_id,
            authority_type: "STATUTE",
            citation:
              typeof item["title"] === "string"
                ? item["title"]
                : systematicNumber
                  ? `SR ${systematicNumber}`
                  : (eli ?? "Fedlex result"),
            ...(pickUrl(law) ? { official_source_uri: pickUrl(law) } : {}),
            source_status: text ? "FULL_TEXT_VERIFIED_OFFICIAL" : "OFFICIAL_EXTRACT",
            provenance,
          });
          sourceFreshness.push({
            source_id: authorityId,
            source_kind: "STATUTE",
            retrieved_at: nowIso(),
            ...(relevantDate ? { relevant_date: relevantDate } : {}),
            source_status: text ? "FULL_TEXT_VERIFIED_OFFICIAL" : "OFFICIAL_EXTRACT",
            freshness_status: text ? "CURRENTLY_VERIFIED" : "UNKNOWN",
          });
          if (text) {
            addLegalProposition({
              kind: "LegalProposition",
              id: stableId("lp", authorityId, issue.id),
              matter_id: base.metadata.matter_id,
              legal_authority_id: authorityId,
              text: text.slice(0, 1_200),
              scope: `Verified Fedlex text for issue ${issue.id}`,
              provenance,
            });
          } else {
            warnings.push(`fedlex_metadata_only:${authorityId}`);
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // Attempt is already recorded by executeProviderCall
        warnings.push("fedlex_unavailable");
      }
    }

    if (adapter.supports_case_search && adapter.supports_official_case_resolver) {
      for (const stance of ["supportive", "adverse"] as const) {
        // Check if we can make the provider call (budget and abort)
        if (!canMakeProviderCall()) {
          if (providerCallCount >= TOTAL_CALL_BUDGET) {
            // Budget exhausted - return early with BUDGET_EXHAUSTED status
            const researched = createMatterSnapshot({
              model,
              created_by: "mcp-research-legal-issues",
              change_summary:
                "Live legal research orchestration stopped due to provider call budget exhaustion.",
              source_event: "mcp_research_legal_issues",
              human_approved: base.metadata.human_approved,
              parent_version_id: base.metadata.version_id,
              source_freshness: sourceFreshness,
              draft_versions: base.draft_versions,
              final_qa: base.final_qa,
              audit_trail: base.audit_trail,
              human_decisions: base.human_decisions,
              provider_attempts: [...base.provider_attempts, ...attempts],
              checkpoints: base.checkpoints,
              derived_cache: base.derived_cache,
            });
            const withAudit = matterSnapshotSchema.parse({
              ...researched,
              audit_trail: [
                ...researched.audit_trail,
                buildAuditEntry({
                  snapshot: researched,
                  reason:
                    "Live legal research orchestration stopped due to provider call budget exhaustion.",
                  changedBy: "mcp-research-legal-issues",
                  objectId: base.metadata.matter_id,
                  oldState: {
                    legal_authority_count: base.model.legal_authorities.length,
                    legal_proposition_count: base.model.legal_propositions.length,
                    precedent_application_count: base.model.precedent_applications.length,
                  },
                  newState: {
                    added,
                    legal_authority_count: researched.model.legal_authorities.length,
                    legal_proposition_count: researched.model.legal_propositions.length,
                    precedent_application_count: researched.model.precedent_applications.length,
                  },
                  provenance: systemProvenance(base.metadata.version_id),
                }),
              ],
            });
            await saveMatterSnapshot(withAudit);
            const checkpoint = await matterStore().checkpoint(
              withAudit,
              "legal_research",
              "Live legal research orchestration stopped due to provider call budget exhaustion.",
            );
            const saved = matterSnapshotSchema.parse({
              ...withAudit,
              checkpoints: [...withAudit.checkpoints, checkpoint],
            });
            return {
              snapshot: await saveMatterSnapshot(saved),
              status: "BUDGET_EXHAUSTED",
              attempts,
              added,
              warnings,
            };
          }
          // If aborted, handle abort case
          if (input.context.signal?.aborted) {
            // Return early with aborted status and current results
            const researched = createMatterSnapshot({
              model,
              created_by: "mcp-research-legal-issues",
              change_summary: "Live legal research orchestration aborted.",
              source_event: "mcp_research_legal_issues",
              human_approved: base.metadata.human_approved,
              parent_version_id: base.metadata.version_id,
              source_freshness: sourceFreshness,
              draft_versions: base.draft_versions,
              final_qa: base.final_qa,
              audit_trail: base.audit_trail,
              human_decisions: base.human_decisions,
              provider_attempts: [...base.provider_attempts, ...attempts],
              checkpoints: base.checkpoints,
              derived_cache: base.derived_cache,
            });
            const withAudit = matterSnapshotSchema.parse({
              ...researched,
              audit_trail: [
                ...researched.audit_trail,
                buildAuditEntry({
                  snapshot: researched,
                  reason: "Live legal research orchestration aborted.",
                  changedBy: "mcp-research-legal-issues",
                  objectId: base.metadata.matter_id,
                  oldState: {
                    legal_authority_count: base.model.legal_authorities.length,
                    legal_proposition_count: base.model.legal_propositions.length,
                    precedent_application_count: base.model.precedent_applications.length,
                  },
                  newState: {
                    added,
                    legal_authority_count: researched.model.legal_authorities.length,
                    legal_proposition_count: researched.model.legal_propositions.length,
                    precedent_application_count: researched.model.precedent_applications.length,
                  },
                  provenance: systemProvenance(base.metadata.version_id),
                }),
              ],
            });
            await saveMatterSnapshot(withAudit);
            const checkpoint = await matterStore().checkpoint(
              withAudit,
              "legal_research",
              "Live legal research orchestration aborted.",
            );
            const saved = matterSnapshotSchema.parse({
              ...withAudit,
              checkpoints: [...withAudit.checkpoints, checkpoint],
            });
            return {
              snapshot: await saveMatterSnapshot(saved),
              status: "ABORTED",
              attempts,
              added,
              warnings,
            };
          }
        }
        try {
          const caseQuery =
            stance === "supportive"
              ? `${issue.text} gutheissen Anspruch`
              : `${issue.text} abweisen Gegenargument`;
          const search = (await executeProviderCall(
            () =>
              input.tools.call(
                "search_cases",
                { query: caseQuery, language, pageSize: 2 },
                input.context,
              ),
            "entscheidsuche",
            `search_cases:${stance}`,
          )) as { results?: Array<Record<string, unknown>> };
          const first = search.results?.[0];
          const reference =
            typeof first?.["caseNumber"] === "string"
              ? first["caseNumber"]
              : typeof first?.["bgeAtfDtf"] === "string"
                ? first["bgeAtfDtf"]
                : typeof first?.["title"] === "string"
                  ? first["title"]
                  : undefined;
          if (!reference) {
            warnings.push(`case_search_metadata_without_reference:${stance}:${issue.id}`);
            continue;
          }
          // Check if we can make the provider call (budget and abort)
          if (!canMakeProviderCall()) {
            if (providerCallCount >= TOTAL_CALL_BUDGET) {
              // Budget exhausted - return early with BUDGET_EXHAUSTED status
              const researched = createMatterSnapshot({
                model,
                created_by: "mcp-research-legal-issues",
                change_summary:
                  "Live legal research orchestration stopped due to provider call budget exhaustion.",
                source_event: "mcp_research_legal_issues",
                human_approved: base.metadata.human_approved,
                parent_version_id: base.metadata.version_id,
                source_freshness: sourceFreshness,
                draft_versions: base.draft_versions,
                final_qa: base.final_qa,
                audit_trail: base.audit_trail,
                human_decisions: base.human_decisions,
                provider_attempts: [...base.provider_attempts, ...attempts],
                checkpoints: base.checkpoints,
                derived_cache: base.derived_cache,
              });
              const withAudit = matterSnapshotSchema.parse({
                ...researched,
                audit_trail: [
                  ...researched.audit_trail,
                  buildAuditEntry({
                    snapshot: researched,
                    reason:
                      "Live legal research orchestration stopped due to provider call budget exhaustion.",
                    changedBy: "mcp-research-legal-issues",
                    objectId: base.metadata.matter_id,
                    oldState: {
                      legal_authority_count: base.model.legal_authorities.length,
                      legal_proposition_count: base.model.legal_propositions.length,
                      precedent_application_count: base.model.precedent_applications.length,
                    },
                    newState: {
                      added,
                      legal_authority_count: researched.model.legal_authorities.length,
                      legal_proposition_count: researched.model.legal_propositions.length,
                      precedent_application_count: researched.model.precedent_applications.length,
                    },
                    provenance: systemProvenance(base.metadata.version_id),
                  }),
                ],
              });
              await saveMatterSnapshot(withAudit);
              const checkpoint = await matterStore().checkpoint(
                withAudit,
                "legal_research",
                "Live legal research orchestration stopped due to provider call budget exhaustion.",
              );
              const saved = matterSnapshotSchema.parse({
                ...withAudit,
                checkpoints: [...withAudit.checkpoints, checkpoint],
              });
              return {
                snapshot: await saveMatterSnapshot(saved),
                status: "BUDGET_EXHAUSTED",
                attempts,
                added,
                warnings,
              };
            }
            // If aborted, handle abort case
            if (input.context.signal?.aborted) {
              // Return early with aborted status and current results
              const researched = createMatterSnapshot({
                model,
                created_by: "mcp-research-legal-issues",
                change_summary: "Live legal research orchestration aborted.",
                source_event: "mcp_research_legal_issues",
                human_approved: base.metadata.human_approved,
                parent_version_id: base.metadata.version_id,
                source_freshness: sourceFreshness,
                draft_versions: base.draft_versions,
                final_qa: base.final_qa,
                audit_trail: base.audit_trail,
                human_decisions: base.human_decisions,
                provider_attempts: [...base.provider_attempts, ...attempts],
                checkpoints: base.checkpoints,
                derived_cache: base.derived_cache,
              });
              const withAudit = matterSnapshotSchema.parse({
                ...researched,
                audit_trail: [
                  ...researched.audit_trail,
                  buildAuditEntry({
                    snapshot: researched,
                    reason: "Live legal research orchestration aborted.",
                    changedBy: "mcp-research-legal-issues",
                    objectId: base.metadata.matter_id,
                    oldState: {
                      legal_authority_count: base.model.legal_authorities.length,
                      legal_proposition_count: base.model.legal_propositions.length,
                      precedent_application_count: base.model.precedent_applications.length,
                    },
                    newState: {
                      added,
                      legal_authority_count: researched.model.legal_authorities.length,
                      legal_proposition_count: researched.model.legal_propositions.length,
                      precedent_application_count: researched.model.precedent_applications.length,
                    },
                    provenance: systemProvenance(base.metadata.version_id),
                  }),
                ],
              });
              await saveMatterSnapshot(withAudit);
              const checkpoint = await matterStore().checkpoint(
                withAudit,
                "legal_research",
                "Live legal research orchestration aborted.",
              );
              const saved = matterSnapshotSchema.parse({
                ...withAudit,
                checkpoints: [...withAudit.checkpoints, checkpoint],
              });
              return {
                snapshot: await saveMatterSnapshot(saved),
                status: "ABORTED",
                attempts,
                added,
                warnings,
              };
            }
          }
          const resolution = await executeProviderCall(
            () =>
              input.tools.call(
                "resolve_official_swiss_case",
                {
                  case_reference: reference,
                  language_hint: language,
                  require_official_source: true,
                  require_full_text: true,
                  strict_identity_match: true,
                },
                input.context,
              ),
            "entscheidsuche",
            "resolve_official_swiss_case",
          );
          const verified = isOfficialFullTextResolution(resolution);
          const text = firstText(resolution);
          const authorityId = stableId("authority", base.metadata.matter_id, "case", reference);
          const provenance = systemProvenance(base.metadata.version_id, issue.id, authorityId);
          addAuthority({
            kind: "LegalAuthority",
            id: authorityId,
            matter_id: base.metadata.matter_id,
            authority_type: "CASE_LAW",
            citation: reference,
            ...(pickUrl(resolution) ? { official_source_uri: pickUrl(resolution) } : {}),
            source_status: verified ? "FULL_TEXT_VERIFIED_OFFICIAL" : "SECONDARY_SOURCE",
            provenance,
          });
          sourceFreshness.push({
            source_id: authorityId,
            source_kind: "CASE_LAW",
            retrieved_at: nowIso(),
            ...(relevantDate ? { relevant_date: relevantDate } : {}),
            source_status: verified ? "FULL_TEXT_VERIFIED_OFFICIAL" : "SECONDARY_SOURCE",
            freshness_status: verified ? "CURRENTLY_VERIFIED" : "UNKNOWN",
          });
          if (verified && text) {
            const propositionId = stableId("lp", authorityId, issue.id, stance);
            addLegalProposition({
              kind: "LegalProposition",
              id: propositionId,
              matter_id: base.metadata.matter_id,
              legal_authority_id: authorityId,
              text: text.slice(0, 1_200),
              scope: `${stance} verified case reasoning for issue ${issue.id}`,
              provenance,
            });
            addPrecedentApplication({
              kind: "PrecedentApplication",
              id: stableId("pa", authorityId, issue.id, stance),
              matter_id: base.metadata.matter_id,
              legal_authority_id: authorityId,
              issue_id: issue.id,
              application: stance === "supportive" ? "SUPPORTIVE" : "ADVERSE",
              favorable_aspects: stance === "supportive" ? [text.slice(0, 500)] : [],
              adverse_aspects: stance === "adverse" ? [text.slice(0, 500)] : [],
              ratio_respected: true,
              provenance,
            });
          } else {
            warnings.push(`case_not_full_text_official:${reference}`);
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_error) {
          // Attempt is already recorded by executeProviderCall
          warnings.push(`case_research_unavailable:${stance}`);
        }
      }
    }
  }

  const changed =
    added.authority_ids.length +
    added.legal_proposition_ids.length +
    added.precedent_application_ids.length;
  const resultStatus = changed > 0 ? "PARTIAL_RESULT" : "SOURCE_UNAVAILABLE";
  const researched = createMatterSnapshot({
    model,
    created_by: "mcp-research-legal-issues",
    change_summary: "Live legal research orchestration update.",
    source_event: "mcp_research_legal_issues",
    human_approved: base.metadata.human_approved,
    parent_version_id: base.metadata.version_id,
    source_freshness: sourceFreshness,
    draft_versions: base.draft_versions,
    final_qa: base.final_qa,
    audit_trail: base.audit_trail,
    human_decisions: base.human_decisions,
    provider_attempts: [...base.provider_attempts, ...attempts],
    checkpoints: base.checkpoints,
    derived_cache: base.derived_cache,
  });
  const withAudit = matterSnapshotSchema.parse({
    ...researched,
    audit_trail: [
      ...researched.audit_trail,
      buildAuditEntry({
        snapshot: researched,
        reason: "Live legal research orchestration update.",
        changedBy: "mcp-research-legal-issues",
        objectId: base.metadata.matter_id,
        oldState: {
          legal_authority_count: base.model.legal_authorities.length,
          legal_proposition_count: base.model.legal_propositions.length,
          precedent_application_count: base.model.precedent_applications.length,
        },
        newState: {
          added,
          legal_authority_count: researched.model.legal_authorities.length,
          legal_proposition_count: researched.model.legal_propositions.length,
          precedent_application_count: researched.model.precedent_applications.length,
        },
        provenance: systemProvenance(base.metadata.version_id),
      }),
    ],
  });
  await saveMatterSnapshot(withAudit);
  const checkpoint = await matterStore().checkpoint(
    withAudit,
    "legal_research",
    "Live legal research orchestration completed.",
  );
  const saved = matterSnapshotSchema.parse({
    ...withAudit,
    checkpoints: [...withAudit.checkpoints, checkpoint],
  });
  return {
    snapshot: await saveMatterSnapshot(saved),
    status: resultStatus,
    attempts,
    added,
    warnings,
  };
}

function buildMcpLegalResearchAdapter(tools: ToolRegistry) {
  return legalResearchProviderAdapterSchema.parse({
    adapter_id: "mcp-server-tool-adapter",
    supports_official_case_resolver:
      tools.getDefinition("resolve_official_swiss_case") !== undefined,
    supports_citation_verification: tools.getDefinition("verify_legal_citation") !== undefined,
    supports_case_search: tools.getDefinition("search_cases") !== undefined,
    supports_reference_search: tools.getDefinition("search_cases_by_reference") !== undefined,
    supports_fedlex:
      tools.getDefinition("search_legislation") !== undefined &&
      tools.getDefinition("get_law") !== undefined,
    supports_entscheidsuche_discovery: tools.getDefinition("search_cases") !== undefined,
  });
}

export function registerMatterRuntimeTools(tools: ToolRegistry): void {
  tools.register({
    name: "create_or_update_matter",
    description:
      "Creates or updates a durable Matter snapshot in the configured local MCP matter store with version metadata, provenance, checkpoints, freshness, draft versions and audit state.",
    inputSchema: {
      matter: matterModelSchema,
      created_by: z.string().min(1).default("mcp-user"),
      change_summary: z.string().min(1).default("MCP matter update."),
      source_event: z.string().min(1).default("mcp_create_or_update_matter"),
      human_approved: z.boolean().default(false),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => {
      const { snapshot, versionCount } = await createDurableSnapshot({
        model: input.matter,
        createdBy: input.created_by,
        changeSummary: input.change_summary,
        sourceEvent: input.source_event,
        humanApproved: input.human_approved,
      });
      return {
        summary: "Matter snapshot stored in the durable local MCP matter store.",
        structured_result: {
          matter_id: snapshot.metadata.matter_id,
          version_id: snapshot.metadata.version_id,
          parent_version_id: snapshot.metadata.parent_version_id ?? null,
          schema_version: snapshot.schema_version,
          store: {
            durable: true,
            version_count: versionCount,
            checkpoint_count: snapshot.checkpoints.length,
            audit_entry_count: snapshot.audit_trail.length,
          },
          indexes: snapshot.indexes,
        },
        provenance: [
          {
            type: "SYSTEM_DERIVATION",
            system_derivation_input_ids: [snapshot.metadata.version_id],
          },
        ],
        human_review_flags: snapshot.metadata.human_approved ? [] : ["HUMAN_REVIEW_REQUIRED"],
        staleness: [],
        blocking_issues: [],
        recommended_next_actions: ["Run analyze_matter or another partial pipeline stage."],
      };
    },
  });

  tools.register({
    name: "get_matter_state",
    description:
      "Returns the current durable local Matter snapshot summary and MatterHealth without exposing full document bodies by default.",
    inputSchema: {
      matter_id: z.string().min(1),
      include_full_snapshot: z.boolean().default(false),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => {
      const snapshot = await loadMatterSnapshot(input.matter_id);
      if (!snapshot) {
        return {
          summary: "Matter not found in the durable local MCP matter store.",
          structured_result: { matter_id: input.matter_id, found: false },
          provenance: [
            { type: "SYSTEM_DERIVATION", system_derivation_input_ids: [input.matter_id] },
          ],
          human_review_flags: ["HUMAN_REVIEW_REQUIRED"],
          staleness: [],
          blocking_issues: ["matter_not_found"],
          recommended_next_actions: ["Call create_or_update_matter with a structured MatterModel."],
        };
      }
      const versions = await listMatterVersions(snapshot.metadata.matter_id);
      return {
        summary: "Matter state loaded from the durable local MCP matter store.",
        structured_result: {
          matter_id: snapshot.metadata.matter_id,
          version_id: snapshot.metadata.version_id,
          parent_version_id: snapshot.metadata.parent_version_id ?? null,
          version_count: versions.length,
          versions,
          checkpoint_count: snapshot.checkpoints.length,
          audit_entry_count: snapshot.audit_trail.length,
          health: summarizeMatterHealth(snapshot),
          ...(input.include_full_snapshot ? { snapshot } : {}),
        },
        provenance: [
          {
            type: "SYSTEM_DERIVATION",
            system_derivation_input_ids: [snapshot.metadata.version_id],
          },
        ],
        human_review_flags: summarizeMatterHealth(snapshot).human_review_flags,
        staleness: summarizeMatterHealth(snapshot).staleness.map((item) => item.source_id),
        blocking_issues: summarizeMatterHealth(snapshot).blocking_issues,
        recommended_next_actions: ["Continue with partial or end-to-end analysis."],
      };
    },
  });

  tools.register({
    name: "analyze_matter",
    description:
      "Runs a controlled Phase 9 matter pipeline or a partial pipeline stage over stored Matter state or one-shot Matter input.",
    inputSchema: {
      matter_id: z.string().min(1).optional(),
      matter: matterModelSchema.optional(),
      stage: z
        .enum([
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
        ])
        .optional(),
      draft_assertions: z.array(draftAssertionSchema).default([]),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => {
      const snapshot =
        input.matter !== undefined
          ? createMatterSnapshot({
              model: input.matter,
              created_by: "mcp-user",
              change_summary: "One-shot matter analysis.",
              source_event: "mcp_analyze_matter",
            })
          : input.matter_id !== undefined
            ? await loadMatterSnapshot(input.matter_id)
            : undefined;
      if (!snapshot) {
        return {
          summary: "Matter input is required for analysis.",
          structured_result: { status: "missing_matter" },
          provenance: [
            { type: "SYSTEM_DERIVATION", system_derivation_input_ids: ["mcp_analyze_matter"] },
          ],
          human_review_flags: ["HUMAN_REVIEW_REQUIRED"],
          staleness: [],
          blocking_issues: ["missing_matter"],
          recommended_next_actions: ["Provide matter_id or structured matter."],
        };
      }
      const result =
        input.stage === undefined
          ? executeMatterPipeline({ snapshot, assertions: input.draft_assertions })
          : runPartialPipeline({ snapshot, stage: input.stage });
      return {
        summary: "Matter analysis completed with deterministic Phase 9 runtime controls.",
        structured_result: result,
        provenance: [
          {
            type: "SYSTEM_DERIVATION",
            system_derivation_input_ids: [snapshot.metadata.version_id],
          },
        ],
        human_review_flags: result.health.human_review_flags,
        staleness: result.health.staleness.map((item) => item.source_id),
        blocking_issues: result.health.blocking_issues,
        recommended_next_actions: [
          "Address blocking issues and run final draft QA before human review.",
        ],
      };
    },
  });

  tools.register({
    name: "research_legal_issues",
    description:
      "Runs Phase 9 legal-research orchestration through existing MCP providers. For stored Matters it performs live official-source-first research, adverse research, deduplication and durable Matter version updates while preserving provenance and source freshness.",
    inputSchema: {
      matter_id: z.string().min(1).optional(),
      matter: matterModelSchema.optional(),
      adapter: legalResearchProviderAdapterSchema.optional(),
      language: languageSchema.default("DE"),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input, context) => {
      const snapshot =
        input.matter !== undefined
          ? createMatterSnapshot({
              model: input.matter,
              created_by: "mcp-user",
              change_summary: "One-shot legal research.",
              source_event: "mcp_research_legal_issues",
            })
          : input.matter_id !== undefined
            ? await loadMatterSnapshot(input.matter_id)
            : undefined;
      if (!snapshot) {
        return {
          summary: "Matter input is required for legal research orchestration.",
          structured_result: { status: "missing_matter" },
          provenance: [
            {
              type: "SYSTEM_DERIVATION",
              system_derivation_input_ids: ["mcp_research_legal_issues"],
            },
          ],
          human_review_flags: ["HUMAN_REVIEW_REQUIRED"],
          staleness: [],
          blocking_issues: ["missing_matter"],
          recommended_next_actions: ["Provide matter_id or structured matter."],
        };
      }

      // Create abort controller for overall timeout to prevent hangs
      // Set to 45 seconds to ensure it fires before MCP request timeout (typically 60s)
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 45_000); // 45 seconds timeout

      try {
        const baseline = await researchLegalIssues({
          snapshot,
          adapter: input.adapter ?? buildMcpLegalResearchAdapter(tools),
          language: input.language,
        });
        if (input.matter_id === undefined || input.adapter !== undefined) {
          clearTimeout(timeoutId);
          return baseline;
        }

        const orchestration = await orchestrateLiveResearch({
          snapshot,
          tools,
          context: {
            ...context,
            signal: abortController.signal, // Pass the abort signal to the orchestration
          },
          language: input.language,
        });
        clearTimeout(timeoutId);
        const health = summarizeMatterHealth(orchestration.snapshot);
        const isPartialResult =
          orchestration.status === "PARTIAL_RESULT" ||
          orchestration.status === "ABORTED" ||
          orchestration.status === "BUDGET_EXHAUSTED";
        return {
          summary:
            orchestration.status === "PARTIAL_RESULT"
              ? "Legal research orchestration completed with durable Matter update. Official sources were preferred for verification and aggregator results were kept as discovery material unless officially resolved."
              : orchestration.status === "ABORTED"
                ? "Legal research orchestration was aborted due to timeout but accumulated partial results have been preserved. Official sources were preferred for verification."
                : orchestration.status === "BUDGET_EXHAUSTED"
                  ? "Legal research orchestration stopped due to provider call budget exhaustion but accumulated results have been preserved. Official sources were preferred for verification."
                  : "Legal research orchestration could not verify live sources; Matter remains durable and marked for human review.",
          structured_result: {
            ...(baseline.structured_result as Record<string, unknown>),
            status: orchestration.status,
            live_orchestration: {
              matter_id: orchestration.snapshot.metadata.matter_id,
              version_id: orchestration.snapshot.metadata.version_id,
              parent_version_id: orchestration.snapshot.metadata.parent_version_id ?? null,
              added: orchestration.added,
              provider_attempts: orchestration.attempts.map((attempt) => ({
                provider: attempt.provider,
                operation: attempt.operation,
                result: attempt.result,
              })),
              warnings: orchestration.warnings,
              health,
            },
          },
          provenance: baseline.provenance,
          human_review_flags:
            orchestration.warnings.length > 0 || orchestration.status === "SOURCE_UNAVAILABLE"
              ? [...new Set([...baseline.human_review_flags, "HUMAN_REVIEW_REQUIRED"])]
              : baseline.human_review_flags,
          staleness: health.staleness.map((item) => item.source_id),
          blocking_issues: health.blocking_issues,
          recommended_next_actions: isPartialResult
            ? ["Review added authorities and propositions before legal reliance."]
            : ["Retry live research later or add verified legal authorities manually."],
        };
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          return {
            summary:
              "Legal research orchestration timed out after 45 seconds. Baseline adapter check may have timed out, but original matter is preserved.",
            structured_result: {
              status: "TIMEOUT",
              timeout_ms: 45_000,
            },
            provenance: [
              {
                type: "SYSTEM_DERIVATION",
                system_derivation_input_ids: [snapshot.metadata.version_id],
              },
            ],
            human_review_flags: ["HUMAN_REVIEW_REQUIRED"],
            staleness: [],
            blocking_issues: ["research_timeout"],
            recommended_next_actions: [
              "Try again with more specific legal issues or check provider connectivity.",
            ],
          };
        }
        throw error;
      }
    },
  });

  tools.register({
    name: "audit_legal_draft",
    description:
      "Runs Phase 8 FinalKillerQA through the Phase 9 runtime surface, optionally saving the QA result as a new durable Matter version while preserving source-of-truth discipline and human-review readiness.",
    inputSchema: {
      matter_id: z.string().min(1).optional(),
      assertions: z.array(draftAssertionSchema).default([]),
      provenance: provenanceSchema,
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => {
      const qa = runFinalKillerQa({ assertions: input.assertions, provenance: input.provenance });
      const snapshot =
        input.matter_id === undefined ? undefined : await loadMatterSnapshot(input.matter_id);
      const savedSnapshot =
        snapshot === undefined
          ? undefined
          : await saveDraftQaSnapshot({
              snapshot,
              qa,
              provenance: input.provenance,
              changedBy: "mcp-audit-legal-draft",
            });
      return {
        summary:
          savedSnapshot === undefined
            ? "Final draft QA completed. The result is a derived review view, not a source of truth."
            : "Final draft QA completed and saved as a durable Matter draft QA version. The QA result remains a derived review view, not a source of truth.",
        structured_result: {
          ...qa,
          ...(input.matter_id !== undefined
            ? {
                matter_persistence:
                  savedSnapshot === undefined
                    ? { found: false, matter_id: input.matter_id }
                    : {
                        found: true,
                        matter_id: savedSnapshot.metadata.matter_id,
                        version_id: savedSnapshot.metadata.version_id,
                        parent_version_id: savedSnapshot.metadata.parent_version_id ?? null,
                        final_qa_count: savedSnapshot.final_qa.length,
                        checkpoint_count: savedSnapshot.checkpoints.length,
                      },
              }
            : {}),
        },
        provenance: input.provenance,
        human_review_flags:
          savedSnapshot === undefined && input.matter_id !== undefined
            ? ["HUMAN_REVIEW_REQUIRED"]
            : qa.readiness === "READY_FOR_HUMAN_APPROVAL"
              ? ["HUMAN_APPROVAL_REQUIRED"]
              : ["HUMAN_REVIEW_REQUIRED"],
        staleness: [],
        blocking_issues: [
          ...(savedSnapshot === undefined && input.matter_id !== undefined
            ? ["matter_not_found"]
            : []),
          ...qa.blocking_issues.map((item) => item.flag),
        ],
        recommended_next_actions: qa.revision_suggestions.map((item) => item.proposed_fix),
      };
    },
  });
}
