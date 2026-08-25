import { deleteCheckpoint, loadCheckpoint, saveCheckpoint } from "@swiss-legal-mcp/shared";
import {
  resolveOfficialSwissCase,
  type OfficialSwissCaseResolution,
} from "./officialSwissCaseResolver.js";

/**
 * Resolucion oficial por lotes, reutilizando integramente
 * `resolve_official_swiss_case` (`resolveOfficialSwissCase`) para cada
 * elemento -- nunca reimplementa la logica de identidad/lectura completa. Ver
 * docs/challenge-7-days/day-01-swiss/improvement-plan.md
 * ("create_batch_resolve_official_cases": recomendado) y LIM-008.
 *
 * Nunca falla todo-o-nada: cada candidato se resuelve de forma independiente,
 * los fallos individuales se registran y no interrumpen el resto del lote.
 * Concurrencia acotada (por defecto 3, maximo 6) para no sobrecargar la
 * fuente oficial. Soporta checkpoint/reanudacion mediante
 * `@swiss-legal-mcp/shared#saveCheckpoint`/`loadCheckpoint`: si se reanuda un
 * `checkpoint_id` existente, los elementos ya resueltos con exito no se
 * vuelven a solicitar.
 */

export interface BatchResolveCandidateInput {
  readonly case_reference?: string;
  readonly canonical_url?: string;
  readonly resolution_id?: string;
  readonly language_hint?: "de" | "fr" | "it";
}

export interface BatchResolveInput {
  readonly candidates: readonly BatchResolveCandidateInput[];
  readonly concurrency?: number;
  readonly require_official_source?: boolean;
  readonly require_full_text?: boolean;
  readonly strict_identity_match?: boolean;
  readonly retry_limit?: number;
  readonly checkpoint_id?: string | null;
  readonly resume?: boolean;
}

export type BatchResolveItemStatus =
  | "full_text_verified_official"
  | "official_extract"
  | "metadata_only"
  | "identity_mismatch"
  | "failed"
  | "skipped";

export interface BatchResolveItemResult {
  readonly index: number;
  readonly requested: BatchResolveCandidateInput;
  readonly status: BatchResolveItemStatus;
  readonly resolution: OfficialSwissCaseResolution | null;
  readonly error: string | null;
  readonly warnings: readonly string[];
  readonly attempts: number;
}

export interface BatchResolveSummary {
  readonly requested: number;
  readonly resolved: number;
  readonly full_text_verified: number;
  readonly official_extract: number;
  readonly metadata_only: number;
  readonly identity_mismatch: number;
  readonly failed: number;
  readonly skipped: number;
  readonly warnings: readonly string[];
}

export type BatchCheckpointStatus = "not_used" | "saved" | "completed_and_cleared" | "resumed";

export interface BatchResolveOutput {
  readonly summary: BatchResolveSummary;
  readonly items: readonly BatchResolveItemResult[];
  readonly checkpoint_id: string | null;
  readonly checkpoint_status: BatchCheckpointStatus;
}

interface BatchCheckpointState {
  readonly items: readonly BatchResolveItemResult[];
}

const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 6;
const DEFAULT_RETRY_LIMIT = 1;
const MAX_RETRY_LIMIT = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isTransientBatchError(message: string): boolean {
  return /timeout|network|ECONNRESET|ETIMEDOUT|http_(429|502|503|504)|rate_limited/i.test(message);
}

/**
 * Clasifica una resolucion ya completada en uno de los estados normalizados
 * del corpus. Nunca cuenta `metadata_only`/`official_extract` como texto
 * completo, y nunca confunde `identity_mismatch` con un fallo de red (ver
 * LIM-010, LIM-018, y la deuda FIND-04 documentada en docs/release/RC-1.0.0.md#9).
 */
export function classifyBatchResolution(
  resolution: OfficialSwissCaseResolution,
): Exclude<BatchResolveItemStatus, "failed" | "skipped"> | "failed" {
  const { legal_use, identity, discovery_status } = resolution;
  if (identity.status === "identity_mismatch") return "identity_mismatch";
  if (discovery_status === "no_candidate") return "failed";
  if (legal_use.reading_status === "full_text_verified_official") {
    return "full_text_verified_official";
  }
  if (
    legal_use.reading_status === "headnote_only" ||
    legal_use.reading_status === "snippet_only" ||
    legal_use.reading_status === "partial_text_only" ||
    legal_use.reading_status === "full_text_read_unofficial"
  ) {
    return legal_use.source_status === "official" ? "official_extract" : "failed";
  }
  if (legal_use.fetch_status === "fetch_failed" || legal_use.fetch_status === "access_restricted") {
    return "failed";
  }
  return "metadata_only";
}

export async function batchResolveOfficialCases(
  input: BatchResolveInput,
): Promise<BatchResolveOutput> {
  const concurrency = clamp(input.concurrency ?? DEFAULT_CONCURRENCY, 1, MAX_CONCURRENCY);
  const retryLimit = clamp(input.retry_limit ?? DEFAULT_RETRY_LIMIT, 0, MAX_RETRY_LIMIT);
  const checkpointId = input.checkpoint_id ?? null;
  const runWarnings: string[] = [];

  let checkpointStatus: BatchCheckpointStatus = "not_used";
  const priorResults = new Map<number, BatchResolveItemResult>();

  if (checkpointId && input.resume) {
    const checkpoint = loadCheckpoint<BatchCheckpointState>(checkpointId);
    if (checkpoint) {
      for (const item of checkpoint.state.items) {
        priorResults.set(item.index, item);
      }
      checkpointStatus = "resumed";
    } else {
      runWarnings.push(`checkpoint_not_found_for_resume:${checkpointId}`);
    }
  }

  const items = new Array<BatchResolveItemResult>(input.candidates.length);
  let cursor = 0;

  async function persistCheckpoint(): Promise<void> {
    if (!checkpointId) return;
    const completedItems = items.filter(
      (item): item is BatchResolveItemResult => item !== undefined,
    );
    saveCheckpoint<BatchCheckpointState>(checkpointId, { items: completedItems }, "in_progress");
  }

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= input.candidates.length) return;
      const requested = input.candidates[index];
      if (!requested) return;

      const alreadyResolved = priorResults.get(index);
      if (
        alreadyResolved &&
        alreadyResolved.status !== "failed" &&
        alreadyResolved.status !== "skipped"
      ) {
        items[index] = { ...alreadyResolved, status: "skipped" as const, index };
        continue;
      }

      let attempts = 0;
      let lastError: string | null = null;
      let finalResult: BatchResolveItemResult | null = null;

      while (attempts <= retryLimit) {
        attempts += 1;
        try {
          const resolution = await resolveOfficialSwissCase({
            case_reference: requested.case_reference,
            source_url_hint: requested.canonical_url,
            resolution_id: requested.resolution_id,
            language_hint: requested.language_hint,
            require_official_source: input.require_official_source ?? true,
            require_full_text: input.require_full_text ?? true,
            strict_identity_match: input.strict_identity_match ?? true,
            retrieval_mode: "full_text",
          });
          const status = classifyBatchResolution(resolution);
          finalResult = {
            index,
            requested,
            status,
            resolution,
            error: null,
            warnings: resolution.warnings,
            attempts,
          };
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          if (attempts > retryLimit || !isTransientBatchError(lastError)) {
            break;
          }
          const backoffMs = Math.min(2000, 150 * 2 ** attempts) + Math.random() * 50;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }

      items[index] = finalResult ?? {
        index,
        requested,
        status: "failed",
        resolution: null,
        error: lastError,
        warnings: [],
        attempts,
      };

      await persistCheckpoint();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const summary: BatchResolveSummary = {
    requested: input.candidates.length,
    resolved: items.filter((item) => item.status !== "failed" && item.status !== "skipped").length,
    full_text_verified: items.filter((item) => item.status === "full_text_verified_official")
      .length,
    official_extract: items.filter((item) => item.status === "official_extract").length,
    metadata_only: items.filter((item) => item.status === "metadata_only").length,
    identity_mismatch: items.filter((item) => item.status === "identity_mismatch").length,
    failed: items.filter((item) => item.status === "failed").length,
    skipped: items.filter((item) => item.status === "skipped").length,
    warnings: [...runWarnings, ...items.flatMap((item) => item.warnings)],
  };

  if (checkpointId) {
    if (summary.failed === 0) {
      deleteCheckpoint(checkpointId);
      checkpointStatus = "completed_and_cleared";
    } else {
      await persistCheckpoint();
      checkpointStatus = checkpointStatus === "resumed" ? "resumed" : "saved";
    }
  }

  return { summary, items, checkpoint_id: checkpointId, checkpoint_status: checkpointStatus };
}
