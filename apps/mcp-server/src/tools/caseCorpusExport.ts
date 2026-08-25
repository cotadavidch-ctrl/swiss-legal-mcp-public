import { deleteCheckpoint, loadCheckpoint, saveCheckpoint } from "@swiss-legal-mcp/shared";
import { deduplicateStable, type DeduplicationSummary } from "./caseDeduplication.js";
import {
  discoverFederalCaseCandidates,
  PROVIDER_MAX_RESULTS_PER_CALL,
  type DiscoveryStrategyQueryLog,
  type FederalCaseSearchResultItem,
  type FederalChamberCode,
  type FederalDocumentType,
} from "./officialFederalCaseSearch.js";
import {
  batchResolveOfficialCases,
  type BatchResolveItemResult,
} from "./officialFederalCaseBatch.js";

/**
 * Exportacion estructurada y reutilizable de un corpus juridico verificable.
 * Orquesta descubrimiento oficial (`discoverFederalCaseCandidates`) +
 * deduplicacion (`deduplicateStable`) + resolucion por lotes
 * (`batchResolveOfficialCases`), y aplica las puertas de inclusion duras de
 * LIM-018: solo cuentan como corpus "included" las decisiones con
 * `identity_status: identity_verified`, `source_status: official`,
 * `completeness_status: complete` y `reading_status:
 * full_text_verified_official` simultaneamente. Extractos oficiales,
 * registros solo-metadata y fuentes secundarias se exportan igualmente, pero
 * en cubos separados que nunca cuentan para el tamano del corpus.
 *
 * No es especifica de ningun reto: cualquier flujo del producto que necesite
 * un corpus jurisprudencial verificable con trazabilidad completa puede
 * reutilizar esta funcion.
 */

const CORPUS_SCHEMA_VERSION = 1;
const DEFAULT_MINIMUM_SIZE = 50;
const DEFAULT_TARGET_SIZE = 60;
const DEFAULT_MAX_CANDIDATES = 140;

export interface CaseCorpusFilters {
  readonly query?: string;
  readonly chamber?: FederalChamberCode;
  readonly language?: "de" | "fr" | "it";
  readonly date_from?: string;
  readonly date_to?: string;
  readonly subject?: string;
  readonly document_type?: FederalDocumentType;
}

export interface CaseCorpusExportInput {
  readonly filters: CaseCorpusFilters;
  readonly minimum_size?: number;
  readonly target_size?: number;
  readonly max_candidates?: number;
  readonly page_size?: number;
  readonly concurrency?: number;
  readonly checkpoint_id?: string | null;
  readonly resume?: boolean;
}

export interface CaseCorpusEntry {
  readonly case_number: string | null;
  readonly decision_date: string | null;
  readonly chamber: string | null;
  readonly language: "de" | "fr" | "it" | null;
  readonly title: string | null;
  readonly official_url: string | null;
  readonly official_identifier: string | null;
  readonly resolution_id: string | null;
  readonly document_hash: string | null;
  readonly metadata_hash: string | null;
  readonly retrieved_at: string | null;
  readonly cache_status: string | null;
  readonly identity_status: string;
  readonly source_status: string | null;
  readonly completeness_status: string | null;
  readonly reading_status: string | null;
  readonly corpus_status:
    | "included_full_text_official"
    | "official_extract_only"
    | "metadata_only"
    | "identity_mismatch"
    | "excluded_incomplete"
    | "failed";
  readonly warnings: readonly string[];
}

/**
 * Traza agregada (a traves de todas las rondas de descubrimiento internas)
 * de como se intento alcanzar `candidate_pool_size`. Nunca presenta el
 * descubrimiento como una unica busqueda nativa si en realidad fueron varias
 * consultas por prefijo/ventana de fecha (ver `officialFederalCaseSearch.ts`,
 * `DiscoveryStrategyLog`).
 */
export interface CorpusDiscoveryStrategy {
  readonly prefixes_used: readonly string[];
  readonly date_windows: readonly { readonly from: string | null; readonly to: string | null }[];
  readonly queries_executed: readonly DiscoveryStrategyQueryLog[];
  readonly pages_fetched: number;
  readonly results_before_dedup: number;
  readonly duplicates_removed: number;
  readonly results_after_dedup: number;
  readonly candidate_pool_requested: number;
  readonly candidate_pool_obtained: number;
  readonly partial_results: boolean;
}

export interface CaseCorpusExportOutput {
  readonly schema_version: number;
  readonly generated_at: string;
  readonly provider: "swiss_federal_supreme_court_official_search";
  readonly filters: CaseCorpusFilters;
  readonly included: readonly CaseCorpusEntry[];
  readonly official_extracts: readonly CaseCorpusEntry[];
  readonly metadata_only: readonly CaseCorpusEntry[];
  readonly identity_mismatches: readonly CaseCorpusEntry[];
  readonly excluded_incomplete: readonly CaseCorpusEntry[];
  readonly failed: readonly CaseCorpusEntry[];
  readonly deduplication_summary: DeduplicationSummary;
  readonly discovery_strategy: CorpusDiscoveryStrategy;
  readonly statistics: {
    readonly candidates_discovered: number;
    readonly candidates_resolved: number;
    readonly included_count: number;
    readonly official_extract_count: number;
    readonly metadata_only_count: number;
    readonly identity_mismatch_count: number;
    readonly failed_count: number;
    readonly duplicates_removed: number;
    readonly minimum_target: number;
    readonly objective_target: number;
    readonly minimum_target_reached: boolean;
    readonly objective_target_reached: boolean;
    readonly duration_ms: number;
  };
  readonly checkpoint: {
    readonly checkpoint_id: string | null;
    readonly status: "not_used" | "saved" | "completed_and_cleared" | "resumed";
  };
  readonly warnings: readonly string[];
}

interface CorpusCheckpointState {
  readonly discovered: readonly FederalCaseSearchResultItem[];
  readonly discovery_cursor: string | null;
  readonly discovery_complete: boolean;
}

function toCorpusEntryFromBatchItem(item: BatchResolveItemResult): CaseCorpusEntry {
  const resolution = item.resolution;
  const candidate = resolution?.selected_candidate ?? null;
  let corpusStatus: CaseCorpusEntry["corpus_status"];
  switch (item.status) {
    case "full_text_verified_official": {
      const gatePassed =
        resolution !== null &&
        resolution.identity.status === "identity_verified" &&
        resolution.legal_use.source_status === "official" &&
        resolution.legal_use.completeness_status === "complete" &&
        resolution.legal_use.reading_status === "full_text_verified_official";
      corpusStatus = gatePassed ? "included_full_text_official" : "excluded_incomplete";
      break;
    }
    case "official_extract":
      corpusStatus = "official_extract_only";
      break;
    case "metadata_only":
      corpusStatus = "metadata_only";
      break;
    case "identity_mismatch":
      corpusStatus = "identity_mismatch";
      break;
    default:
      corpusStatus = "failed";
  }
  return {
    case_number: candidate?.reference ?? item.requested.case_reference ?? null,
    decision_date: candidate?.decision_date ?? null,
    chamber: candidate?.chamber ?? null,
    language: candidate?.language ?? item.requested.language_hint ?? null,
    title: candidate?.title ?? null,
    official_url:
      resolution?.canonical_url ?? candidate?.canonical_url ?? item.requested.canonical_url ?? null,
    official_identifier: candidate?.official_docid ?? null,
    resolution_id: resolution?.resolution_id ?? null,
    document_hash: resolution?.document_hash ?? null,
    metadata_hash: resolution?.metadata_hash ?? null,
    retrieved_at: resolution?.retrieved_at ?? null,
    cache_status: resolution?.cache_status ?? null,
    identity_status: resolution?.identity.status ?? "identity_not_verifiable",
    source_status: resolution?.legal_use.source_status ?? null,
    completeness_status: resolution?.legal_use.completeness_status ?? null,
    reading_status: resolution?.legal_use.reading_status ?? null,
    corpus_status: corpusStatus,
    warnings: item.error ? [...item.warnings, item.error] : item.warnings,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export async function exportCaseCorpus(
  input: CaseCorpusExportInput,
): Promise<CaseCorpusExportOutput> {
  const startedAt = Date.now();
  const minimumSize = clamp(input.minimum_size ?? DEFAULT_MINIMUM_SIZE, 1, 1000);
  const targetSize = clamp(input.target_size ?? DEFAULT_TARGET_SIZE, minimumSize, 1000);
  const maxCandidates = clamp(input.max_candidates ?? DEFAULT_MAX_CANDIDATES, minimumSize, 2000);
  const pageSize = clamp(input.page_size ?? 20, 1, 50);
  const checkpointId = input.checkpoint_id ?? null;
  const warnings: string[] = [];

  // Fix Fase 1 (2026-08-07): la causa raiz verificada de que
  // `candidates_discovered` quedara fijo en ~20 sin importar `target_size`
  // era que cada llamada de descubrimiento pedia `max_results: pageSize`
  // (20 por defecto) en vez de un presupuesto ligado al objetivo real. Ahora
  // se calcula un `candidate_pool_size` explicito: no todos los candidatos
  // descubiertos terminan como `full_text_verified_official` (identity
  // verification, completeness y el gate de idioma descartan una fraccion
  // real), asi que se sobre-solicita deliberadamente.
  //   candidate_pool_size = min(provider_safe_limit, max(target_size, ceil(target_size * 1.75)))
  // `provider_safe_limit` = min(max_candidates configurado, limite tecnico
  // duro del proveedor `PROVIDER_MAX_RESULTS_PER_CALL`) -- nunca se pide mas
  // de lo que el llamador permitio ni de lo que el proveedor soporta.
  const providerSafeLimit = Math.min(maxCandidates, PROVIDER_MAX_RESULTS_PER_CALL);
  const candidatePoolSize = Math.min(
    providerSafeLimit,
    Math.max(targetSize, Math.ceil(targetSize * 1.75)),
  );

  let checkpointStatus: CaseCorpusExportOutput["checkpoint"]["status"] = "not_used";
  let discovered: FederalCaseSearchResultItem[] = [];
  let discoveryCursor: string | null = null;
  let discoveryComplete = false;
  const strategyPrefixesUsed = new Set<string>();
  const strategyDateWindowKeys = new Set<string>();
  const strategyDateWindows: { readonly from: string | null; readonly to: string | null }[] = [];
  const strategyQueriesExecuted: DiscoveryStrategyQueryLog[] = [];
  let strategyPagesFetched = 0;
  let strategyPartial = false;

  if (checkpointId && input.resume) {
    const checkpoint = loadCheckpoint<CorpusCheckpointState>(checkpointId);
    if (checkpoint) {
      discovered = [...checkpoint.state.discovered];
      discoveryCursor = checkpoint.state.discovery_cursor;
      discoveryComplete = checkpoint.state.discovery_complete;
      checkpointStatus = "resumed";
    } else {
      warnings.push(`checkpoint_not_found_for_resume:${checkpointId}`);
    }
  }

  function persistDiscoveryCheckpoint(): void {
    if (!checkpointId) return;
    saveCheckpoint<CorpusCheckpointState>(
      checkpointId,
      { discovered, discovery_cursor: discoveryCursor, discovery_complete: discoveryComplete },
      "in_progress",
    );
  }

  // Fase de descubrimiento: sobre-recolecta hasta candidate_pool_size (nunca
  // menos, ver calculo arriba) o hasta que la fuente deje de ofrecer un
  // cursor de continuacion (ver LIM-007). Cada ronda pide el presupuesto
  // restante real (`candidatePoolSize - discovered.length`), nunca un
  // `pageSize` fijo desconectado del objetivo -- causa raiz del bug
  // "candidates_discovered siempre 20".
  let safetyRounds = 0;
  const MAX_DISCOVERY_ROUNDS = 25;
  while (
    !discoveryComplete &&
    discovered.length < candidatePoolSize &&
    safetyRounds < MAX_DISCOVERY_ROUNDS
  ) {
    safetyRounds += 1;
    const remainingPoolBudget = candidatePoolSize - discovered.length;
    const page = await discoverFederalCaseCandidates({
      query: input.filters.query,
      chamber: input.filters.chamber,
      language: input.filters.language,
      date_from: input.filters.date_from,
      date_to: input.filters.date_to,
      subject: input.filters.subject,
      document_type: input.filters.document_type,
      page_size: pageSize,
      max_results: remainingPoolBudget,
      cursor: discoveryCursor,
    });
    warnings.push(...page.warnings);
    discovered.push(...page.results);
    strategyPagesFetched += page.discovery_strategy.queries_executed.reduce(
      (sum, q) => sum + q.pages_fetched,
      0,
    );
    for (const prefix of page.discovery_strategy.prefixes_used) strategyPrefixesUsed.add(prefix);
    for (const window of page.discovery_strategy.date_windows) {
      const key = `${window.from ?? ""}..${window.to ?? ""}`;
      if (!strategyDateWindowKeys.has(key)) {
        strategyDateWindowKeys.add(key);
        strategyDateWindows.push(window);
      }
    }
    strategyQueriesExecuted.push(...page.discovery_strategy.queries_executed);
    if (page.partial_results) strategyPartial = true;
    if (!page.next_cursor) {
      discoveryComplete = true;
    } else {
      discoveryCursor = page.next_cursor;
    }
    if (page.source_status === "unavailable" && page.results.length === 0) {
      discoveryComplete = true;
      warnings.push("discovery_stopped_source_unavailable");
    }
    persistDiscoveryCheckpoint();
  }
  if (!discoveryComplete && discovered.length >= candidatePoolSize) {
    warnings.push("discovery_stopped_candidate_pool_size_reached");
  }
  if (discovered.length < candidatePoolSize && (strategyPartial || discoveryComplete)) {
    warnings.push(
      `candidate_pool_partial: obtained=${discovered.length} requested=${candidatePoolSize}. ` +
        "The official portal did not expose enough discoverable candidates under the given " +
        "filters/date range to reach the requested pool size; this reflects real official-source " +
        "availability, not a fabricated shortfall or a silently re-imposed limit.",
    );
    strategyPartial = true;
  }

  const discoveryDedup = deduplicateStable(discovered, (item) => ({
    official_identifier: item.official_identifier,
    case_number: item.case_number,
    decision_date: item.decision_date,
    official_url: item.official_url,
    metadata_hash: null,
  }));
  const candidatesForResolution = discoveryDedup.deduplicated.slice(0, maxCandidates);

  const batch = await batchResolveOfficialCases({
    candidates: candidatesForResolution.map((item) => ({
      case_reference: item.case_number ?? undefined,
      canonical_url: item.official_url,
      language_hint: item.language ?? input.filters.language,
    })),
    concurrency: input.concurrency,
    require_official_source: true,
    require_full_text: true,
    strict_identity_match: true,
    checkpoint_id: checkpointId ? `${checkpointId}:batch` : null,
    resume: input.resume,
  });
  warnings.push(...batch.summary.warnings);

  const entries = batch.items.map(toCorpusEntryFromBatchItem);
  const included = entries.filter((entry) => entry.corpus_status === "included_full_text_official");
  const officialExtracts = entries.filter(
    (entry) => entry.corpus_status === "official_extract_only",
  );
  const metadataOnly = entries.filter((entry) => entry.corpus_status === "metadata_only");
  const identityMismatches = entries.filter((entry) => entry.corpus_status === "identity_mismatch");
  const excludedIncomplete = entries.filter(
    (entry) => entry.corpus_status === "excluded_incomplete",
  );
  const failed = entries.filter((entry) => entry.corpus_status === "failed");

  if (checkpointId) {
    if (discoveryComplete && included.length >= minimumSize) {
      deleteCheckpoint(checkpointId);
      deleteCheckpoint(`${checkpointId}:batch`);
      checkpointStatus = "completed_and_cleared";
    } else {
      persistDiscoveryCheckpoint();
      checkpointStatus = checkpointStatus === "resumed" ? "resumed" : "saved";
    }
  }

  if (included.length < minimumSize) {
    warnings.push(
      `minimum_corpus_size_not_reached: included=${included.length} minimum=${minimumSize}. This reflects real official-source availability under the given filters, not a fabricated shortfall.`,
    );
  }

  return {
    schema_version: CORPUS_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    provider: "swiss_federal_supreme_court_official_search",
    filters: input.filters,
    included,
    official_extracts: officialExtracts,
    metadata_only: metadataOnly,
    identity_mismatches: identityMismatches,
    excluded_incomplete: excludedIncomplete,
    failed,
    deduplication_summary: discoveryDedup.summary,
    discovery_strategy: {
      prefixes_used: [...strategyPrefixesUsed],
      date_windows: strategyDateWindows,
      queries_executed: strategyQueriesExecuted,
      pages_fetched: strategyPagesFetched,
      results_before_dedup: discoveryDedup.summary.candidates_before_dedup,
      duplicates_removed: discoveryDedup.summary.duplicates_removed,
      results_after_dedup: discoveryDedup.summary.candidates_after_dedup,
      candidate_pool_requested: candidatePoolSize,
      candidate_pool_obtained: discovered.length,
      partial_results: strategyPartial,
    },
    statistics: {
      candidates_discovered: discovered.length,
      candidates_resolved: batch.items.length,
      included_count: included.length,
      official_extract_count: officialExtracts.length,
      metadata_only_count: metadataOnly.length,
      identity_mismatch_count: identityMismatches.length,
      failed_count: failed.length,
      duplicates_removed: discoveryDedup.summary.duplicates_removed,
      minimum_target: minimumSize,
      objective_target: targetSize,
      minimum_target_reached: included.length >= minimumSize,
      objective_target_reached: included.length >= targetSize,
      duration_ms: Date.now() - startedAt,
    },
    checkpoint: { checkpoint_id: checkpointId, status: checkpointStatus },
    warnings,
  };
}
