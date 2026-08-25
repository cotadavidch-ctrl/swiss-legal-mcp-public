/**
 * Deduplicacion estable y reutilizable para candidatos/resoluciones de casos
 * suizos. Usada tanto por el descubrimiento federal
 * (`officialFederalCaseSearch.ts`) como por la exportacion de corpus
 * (`caseCorpusExport.ts`) para que ambos apliquen exactamente el mismo
 * criterio.
 *
 * Orden de deduplicacion (ver docs/challenge-7-days/day-01-swiss/limitations-analysis.md#LIM-009):
 *
 * 1. identificador oficial (`official_identifier`, p.ej. `official_docid`);
 * 2. numero de expediente + fecha de decision;
 * 3. URL oficial canonica (normalizada: mismo host+path+query ordenada);
 * 4. hash estable de metadatos (`metadata_hash`), solo si nada anterior existe.
 *
 * Nunca se deduplica por similitud de titulo: dos decisiones con el mismo
 * titulo pero identificadores/expediente/URL/hash distintos se consideran
 * decisiones diferentes.
 */

export type DedupLevel =
  "official_identifier" | "case_number_and_date" | "canonical_url" | "metadata_hash";

export interface DedupCandidateInput {
  readonly official_identifier?: string | null;
  readonly case_number?: string | null;
  readonly decision_date?: string | null;
  readonly official_url?: string | null;
  readonly metadata_hash?: string | null;
}

export interface DeduplicationSummary {
  readonly candidates_before_dedup: number;
  readonly candidates_after_dedup: number;
  readonly duplicates_removed: number;
  readonly duplicate_groups: number;
  readonly dedup_levels_applied: readonly DedupLevel[];
  readonly items_without_dedup_key: number;
}

export interface DeduplicationResult<T> {
  readonly deduplicated: readonly T[];
  readonly summary: DeduplicationSummary;
}

/** Normaliza una URL para comparacion: mismo host+path, parametros de query ordenados. */
export function canonicalizeUrlForDedup(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const sortedParams = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    const query = sortedParams.map(([key, value]) => `${key}=${value}`).join("&");
    return `${url.protocol}//${url.host}${url.pathname}${query ? `?${query}` : ""}`.toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

function computeDedupKey(
  input: DedupCandidateInput,
): { readonly level: DedupLevel; readonly key: string } | null {
  if (input.official_identifier && input.official_identifier.trim().length > 0) {
    return { level: "official_identifier", key: `id:${input.official_identifier.trim()}` };
  }
  if (
    input.case_number &&
    input.case_number.trim().length > 0 &&
    input.decision_date &&
    input.decision_date.trim().length > 0
  ) {
    return {
      level: "case_number_and_date",
      key: `cd:${input.case_number.trim().toLowerCase()}|${input.decision_date.trim()}`,
    };
  }
  if (input.official_url && input.official_url.trim().length > 0) {
    return { level: "canonical_url", key: `url:${canonicalizeUrlForDedup(input.official_url)}` };
  }
  if (input.metadata_hash && input.metadata_hash.trim().length > 0) {
    return { level: "metadata_hash", key: `hash:${input.metadata_hash.trim()}` };
  }
  return null;
}

/**
 * Deduplica `items` conservando el primer elemento visto por cada clave
 * (orden estable). `toDedupInput` extrae los campos relevantes de cada
 * elemento sin acoplar esta funcion a un tipo concreto de candidato/resolucion.
 */
export function deduplicateStable<T>(
  items: readonly T[],
  toDedupInput: (item: T) => DedupCandidateInput,
): DeduplicationResult<T> {
  const seenKeys = new Set<string>();
  const keyOccurrences = new Map<string, number>();
  const levelsUsed = new Set<DedupLevel>();
  const deduplicated: T[] = [];
  let duplicatesRemoved = 0;
  let itemsWithoutDedupKey = 0;

  for (const item of items) {
    const computed = computeDedupKey(toDedupInput(item));
    if (!computed) {
      // Sin ninguna clave fiable disponible: nunca se descarta por defecto
      // (evita perder decisiones distintas por falta de metadatos), pero se
      // cuenta explicitamente para que el resumen lo refleje.
      itemsWithoutDedupKey += 1;
      deduplicated.push(item);
      continue;
    }
    levelsUsed.add(computed.level);
    const occurrences = (keyOccurrences.get(computed.key) ?? 0) + 1;
    keyOccurrences.set(computed.key, occurrences);
    if (seenKeys.has(computed.key)) {
      duplicatesRemoved += 1;
      continue;
    }
    seenKeys.add(computed.key);
    deduplicated.push(item);
  }

  const duplicateGroups = [...keyOccurrences.values()].filter((count) => count > 1).length;

  return {
    deduplicated,
    summary: {
      candidates_before_dedup: items.length,
      candidates_after_dedup: deduplicated.length,
      duplicates_removed: duplicatesRemoved,
      duplicate_groups: duplicateGroups,
      dedup_levels_applied: [...levelsUsed],
      items_without_dedup_key: itemsWithoutDedupKey,
    },
  };
}
