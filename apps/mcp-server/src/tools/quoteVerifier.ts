/**
 * Verificacion LITERAL de citas textuales contra el texto de una fuente oficial.
 *
 * Responde solo a: "¿estas palabras aparecen, tal cual, en el texto de la fuente?". No valida que
 * la cita sea pertinente, que se interprete bien ni que la norma/sentencia siga vigente.
 *
 * Estados:
 *  - verified_exact       los fragmentos aparecen literalmente (solo difieren los espacios).
 *  - verified_normalized  aparecen tras normalizar mayusculas, comillas, guiones y puntuacion.
 *  - near_match_altered   casi todo el contenido aparece pero NO literalmente: sospecha de cita
 *                         alterada (se devuelve el pasaje mas cercano para compararlo).
 *  - not_found            no aparece (ni algo parecido).
 *  - source_unavailable   no se pudo obtener un texto oficial fiable (la decide el llamador).
 *
 * Elipsis: "[...]", "(...)", "…" y "..." separan fragmentos que deben aparecer EN ORDEN.
 */

export type QuoteStatus =
  | "verified_exact"
  | "verified_normalized"
  | "near_match_altered"
  | "not_found"
  | "source_unavailable";

export interface QuoteVerification {
  readonly status: Exclude<QuoteStatus, "source_unavailable">;
  readonly segments: number;
  /** Posicion en el texto de la fuente (con espacios colapsados) del primer y ultimo fragmento. */
  readonly start: number | null;
  readonly end: number | null;
  /** Texto de la fuente alrededor del acierto (original, con espacios colapsados). */
  readonly context: string | null;
  /** Para near_match_altered / not_found: similitud 0..1 y pasaje mas cercano. */
  readonly similarity: number | null;
  readonly closestPassage: string | null;
  readonly notes: readonly string[];
}

const ELLIPSIS = /\s*(?:\[\s*(?:\.\.\.|…)\s*\]|\(\s*(?:\.\.\.|…)\s*\)|…|\.\.\.)\s*/;
const MIN_SEGMENT_CHARS = 12;
const MIN_TOTAL_CHARS = 20;
const NEAR_MATCH_THRESHOLD = 0.8;

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

interface Normalized {
  readonly norm: string;
  /** map[i] = indice en el texto original (colapsado) del caracter normalizado i. */
  readonly map: readonly number[];
}

/** Normaliza (NFKC, minusculas, solo letras/digitos separados por un espacio) conservando el mapa. */
export function normalizeWithMap(text: string): Normalized {
  const out: string[] = [];
  const map: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch === "­") continue; // guion blando
    for (const piece of ch.normalize("NFKC").toLowerCase()) {
      if (/[\p{L}\p{N}]/u.test(piece)) {
        out.push(piece);
        map.push(i);
        lastWasSpace = false;
      } else if (!lastWasSpace) {
        out.push(" ");
        map.push(i);
        lastWasSpace = true;
      }
    }
  }
  while (out.length > 0 && out[out.length - 1] === " ") {
    out.pop();
    map.pop();
  }
  return { norm: out.join(""), map };
}

function stripOuterQuotes(quote: string): string {
  return quote
    .trim()
    .replace(/^[«»"“”„‚‘’']+/, "")
    .replace(/[«»"“”„‚‘’']+$/, "")
    .trim();
}

export function splitSegments(quote: string): string[] {
  return stripOuterQuotes(quote)
    .split(ELLIPSIS)
    .map((s) => collapseWhitespace(s))
    .filter((s) => s.length > 0);
}

interface InOrderMatch {
  readonly start: number;
  readonly end: number;
}

/** Busca todos los fragmentos en orden; devuelve el rango global o null. */
function findInOrder(haystack: string, segments: readonly string[]): InOrderMatch | null {
  let from = 0;
  let first = -1;
  let last = -1;
  for (const segment of segments) {
    const idx = haystack.indexOf(segment, from);
    if (idx < 0) return null;
    if (first < 0) first = idx;
    last = idx + segment.length;
    from = last;
  }
  return { start: first, end: last };
}

function snippet(source: string, start: number, end: number): string {
  const from = Math.max(0, start - 60);
  const to = Math.min(source.length, end + 60);
  return `${from > 0 ? "…" : ""}${source.slice(from, to)}${to < source.length ? "…" : ""}`;
}

function wordTokens(norm: string): { word: string; start: number }[] {
  const tokens: { word: string; start: number }[] = [];
  const re = /\S+/g;
  for (const m of norm.matchAll(re)) tokens.push({ word: m[0], start: m.index });
  return tokens;
}

/** Pasaje mas parecido (por trigramas de palabras): ratio de trigramas de la cita presentes. */
function closestPassage(
  quoteNorm: string,
  source: Normalized,
  collapsedSource: string,
): { similarity: number; passage: string | null } {
  const q = wordTokens(quoteNorm);
  if (q.length < 3) return { similarity: 0, passage: null };
  const s = wordTokens(source.norm);
  const shingle = (arr: { word: string }[], i: number) =>
    `${arr[i]!.word} ${arr[i + 1]!.word} ${arr[i + 2]!.word}`;
  const quoteShingles = new Set<string>();
  for (let i = 0; i + 2 < q.length; i += 1) quoteShingles.add(shingle(q, i));
  const hits: number[] = [];
  for (let i = 0; i + 2 < s.length; i += 1) {
    if (quoteShingles.has(shingle(s, i))) hits.push(i);
  }
  if (hits.length === 0) return { similarity: 0, passage: null };
  const windowTokens = Math.ceil(q.length * 1.3) + 4;
  let best = { score: 0, at: hits[0]! };
  const candidates =
    hits.length > 300 ? hits.filter((_, i) => i % Math.ceil(hits.length / 300) === 0) : hits;
  for (const at of candidates) {
    const from = Math.max(0, at - Math.floor(windowTokens / 4));
    const to = Math.min(s.length - 2, from + windowTokens);
    const present = new Set<string>();
    for (let i = from; i < to; i += 1) {
      const sh = shingle(s, i);
      if (quoteShingles.has(sh)) present.add(sh);
    }
    const score = present.size / quoteShingles.size;
    if (score > best.score) best = { score, at: from };
  }
  const startTok = s[best.at];
  const endTok = s[Math.min(s.length - 1, best.at + windowTokens)];
  if (!startTok || !endTok) return { similarity: best.score, passage: null };
  const origStart = source.map[startTok.start] ?? 0;
  const origEnd =
    source.map[Math.min(source.map.length - 1, endTok.start)] ?? collapsedSource.length;
  return {
    similarity: Number(best.score.toFixed(2)),
    passage: snippet(collapsedSource, origStart, origEnd),
  };
}

export function verifyQuoteAgainstText(quote: string, sourceText: string): QuoteVerification {
  const notes: string[] = [];
  const segments = splitSegments(quote);
  const total = segments.reduce((n, s) => n + s.length, 0);
  const empty = {
    segments: segments.length,
    start: null,
    end: null,
    context: null,
    similarity: null,
    closestPassage: null,
  } as const;
  if (segments.length === 0 || total < MIN_TOTAL_CHARS) {
    return {
      ...empty,
      status: "not_found",
      notes: [
        `La cita es demasiado corta para verificarse de forma fiable (minimo ${MIN_TOTAL_CHARS} caracteres).`,
      ],
    };
  }
  const short = segments.filter((s) => s.length < MIN_SEGMENT_CHARS);
  if (short.length > 0) {
    notes.push(
      `Fragmentos muy cortos entre elipsis (${short.length}) comprobados igualmente; el resultado es menos concluyente.`,
    );
  }

  const collapsed = collapseWhitespace(sourceText);

  const exact = findInOrder(collapsed, segments);
  if (exact) {
    return {
      ...empty,
      status: "verified_exact",
      start: exact.start,
      end: exact.end,
      context: snippet(collapsed, exact.start, exact.end),
      notes,
    };
  }

  const source = normalizeWithMap(collapsed);
  const normSegments = segments.map((s) => normalizeWithMap(s).norm).filter((s) => s.length > 0);
  const normMatch = findInOrder(source.norm, normSegments);
  if (normMatch) {
    const start = source.map[normMatch.start] ?? 0;
    const end = (source.map[Math.max(0, normMatch.end - 1)] ?? collapsed.length - 1) + 1;
    notes.push("Coincide tras normalizar mayusculas, comillas, guiones y puntuacion.");
    return {
      ...empty,
      status: "verified_normalized",
      start,
      end,
      context: snippet(collapsed, start, end),
      notes,
    };
  }

  const near = closestPassage(normSegments.join(" "), source, collapsed);
  if (near.similarity >= NEAR_MATCH_THRESHOLD) {
    notes.push(
      "La mayor parte del contenido aparece en la fuente pero NO de forma literal: posible cita alterada, parafraseada o con palabras cambiadas. Compare con el pasaje cercano.",
    );
    return {
      ...empty,
      status: "near_match_altered",
      similarity: near.similarity,
      closestPassage: near.passage,
      notes,
    };
  }
  return {
    ...empty,
    status: "not_found",
    similarity: near.similarity,
    closestPassage: near.similarity >= 0.5 ? near.passage : null,
    notes: [...notes, "La cita no aparece en el texto de la fuente consultada."],
  };
}

/* ---------- Extraccion de citas textuales y de su fuente desde un borrador ---------- */

export interface ExtractedQuote {
  readonly quote: string;
  readonly offset: number;
  readonly citation:
    | {
        readonly type: "article";
        readonly abbreviation: string;
        readonly article: string;
        readonly raw: string;
      }
    | { readonly type: "case"; readonly reference: string; readonly raw: string }
    | null;
}

const QUOTE_RE = /[«“„"]([^«»“”„"\n]{30,1500}?)[»”“"]/g;
export const ARTICLE_RE =
  /Art\.\s*(\d+[a-z]{0,2})(?:\s*(?:Abs\.|al\.|cpv\.)\s*\d+[a-z]?(?:\s*(?:und|et|e|bis|,|-|–)\s*\d+[a-z]?)*)?(?:\s*(?:lit\.|let\.)\s*[a-z])?\s+(OR|CO|ZGB|CC|ATSG|LPGA|BGG|LTF|VwVG|PA|SchKG|LP|AVIG|LACI|StGB|CP|BV|Cst|StPO|CPP|ZPO|CPC|ZUG|LAS|AIG|LEI|AsylG|LAsi|Cost|IVG|LAI|AHVG|LAVS|UVG|LAA|BVG|LPP|StHG|LHID|KVG|LAMal|DBG|LIFD|RPG|LAT|VZAE|OASA|BüG|LN|VGG|LTAF|SVG|LCR|MWSTG|LTVA|ArG|LTr|GlG|LEg|USG|LPE|BPG|LPers|DSG|LPD|UVV|OLAA|OAINF|KVV|AVIV|OACI|OADI|IVV|RAI|OAI|AHVV|RAVS|OAVS|ATSV)\b/g;
const CASE_RE =
  /\b(?:(?:BGE|ATF|DTF)\s+\d+\s+[IVX]+\s+\d+|\d[A-Z]_\d+\/\d{4}|\d[A-Z]\.\d+\/\d{4}|[A-Z]-\d+\/\d{4})\b/g;

/** Extrae citas entrecomilladas (>=30 caracteres) y la referencia legal mas cercana del parrafo. */
export function extractQuotesFromDraft(draft: string): ExtractedQuote[] {
  const results: ExtractedQuote[] = [];
  for (const m of draft.matchAll(QUOTE_RE)) {
    const offset = m.index;
    const paragraphStart = draft.lastIndexOf("\n\n", offset) + 1;
    const paragraphEndRaw = draft.indexOf("\n\n", offset);
    const paragraphEnd = paragraphEndRaw < 0 ? draft.length : paragraphEndRaw;
    const before = draft.slice(Math.max(paragraphStart, offset - 250), offset);
    const after = draft.slice(
      offset + m[0].length,
      Math.min(paragraphEnd, offset + m[0].length + 250),
    );
    type Found = { dist: number; value: NonNullable<ExtractedQuote["citation"]> };
    const found: Found[] = [];
    for (const a of before.matchAll(ARTICLE_RE)) {
      found.push({
        dist: before.length - (a.index + a[0].length),
        value: { type: "article", abbreviation: a[2]!, article: a[1]!, raw: a[0] },
      });
    }
    for (const c of before.matchAll(CASE_RE)) {
      found.push({
        dist: before.length - (c.index + c[0].length),
        value: { type: "case", reference: c[0], raw: c[0] },
      });
    }
    for (const a of after.matchAll(ARTICLE_RE)) {
      found.push({
        dist: a.index,
        value: { type: "article", abbreviation: a[2]!, article: a[1]!, raw: a[0] },
      });
    }
    for (const c of after.matchAll(CASE_RE)) {
      found.push({ dist: c.index, value: { type: "case", reference: c[0], raw: c[0] } });
    }
    found.sort((x, y) => x.dist - y.dist);
    results.push({ quote: m[1]!, offset, citation: found[0]?.value ?? null });
  }
  return results;
}

/** Abreviatura -> identificador Fedlex. Solo leyes con identificador comprobado. */
export interface LawSource {
  readonly eli?: string;
  readonly systematicNumber?: string;
  readonly language: "de" | "fr" | "it";
}

const IT_ABBREV = new Set(["Cost", "OAINF", "OADI", "OAI", "OAVS"]);
const FR_ABBREV = new Set([
  "OLAA",
  "OACI",
  "RAI",
  "RAVS",
  "CO",
  "CC",
  "LPGA",
  "LTF",
  "PA",
  "LP",
  "LACI",
  "CP",
  "Cst",
  "CPP",
  "CPC",
  "LAS",
  "LEI",
  "LAsi",
  "LAI",
  "LAVS",
  "LAA",
  "LPP",
  "LHID",
  "LAMal",
  "LIFD",
  "LAT",
  "OASA",
  "LN",
  "LTAF",
  "LCR",
  "LTVA",
  "LTr",
  "LEg",
  "LPE",
  "LPers",
  "LPD",
]);
const LAW_TABLE: Readonly<Record<string, { eli?: string; sr?: string }>> = {
  OR: { eli: "https://fedlex.data.admin.ch/eli/cc/27/317_321_377" },
  CO: { eli: "https://fedlex.data.admin.ch/eli/cc/27/317_321_377" },
  BGG: { eli: "https://fedlex.data.admin.ch/eli/cc/2006/218" },
  LTF: { eli: "https://fedlex.data.admin.ch/eli/cc/2006/218" },
  ZPO: { eli: "https://fedlex.data.admin.ch/eli/cc/2010/262" },
  CPC: { eli: "https://fedlex.data.admin.ch/eli/cc/2010/262" },
  ZGB: { sr: "210" },
  CC: { sr: "210" },
  ATSG: { sr: "830.1" },
  LPGA: { sr: "830.1" },
  VwVG: { sr: "172.021" },
  PA: { sr: "172.021" },
  SchKG: { sr: "281.1" },
  LP: { sr: "281.1" },
  AVIG: { sr: "837.0" },
  LACI: { sr: "837.0" },
  StGB: { sr: "311.0" },
  CP: { sr: "311.0" },
  BV: { sr: "101" },
  Cst: { sr: "101" },
  Cost: { sr: "101" },
  StPO: { sr: "312.0" },
  CPP: { sr: "312.0" },
  // Verificados en Fedlex el 2026-11-13 (art. leidos): ZUG 2, 4, 12; AIG 61a, 62; AsylG 82.
  ZUG: { sr: "851.1" },
  LAS: { sr: "851.1" },
  AIG: { sr: "142.20" },
  LEI: { sr: "142.20" },
  AsylG: { sr: "142.31" },
  LAsi: { sr: "142.31" },
  // Verificados en Fedlex el 2026-11-15: IVG 7 y 28; AHVG 21.
  IVG: { sr: "831.20" },
  LAI: { sr: "831.20" },
  AHVG: { sr: "831.10" },
  LAVS: { sr: "831.10" },
  // Identificadores comprobados en Fedlex el 2026-11-15 (SR unico) o por ELI cuando el SR es ambiguo.
  UVG: { sr: "832.20" },
  LAA: { sr: "832.20" },
  // Ordenanzas de seguros sociales: SR comprobados en Fedlex el 2026-11-23 (get_article del Art. 1 o 50).
  UVV: { sr: "832.202" },
  OLAA: { sr: "832.202" },
  OAINF: { sr: "832.202" },
  KVV: { sr: "832.102" },
  AVIV: { sr: "837.02" },
  OACI: { sr: "837.02" },
  OADI: { sr: "837.02" },
  IVV: { sr: "831.201" },
  RAI: { sr: "831.201" },
  OAI: { sr: "831.201" },
  AHVV: { sr: "831.101" },
  RAVS: { sr: "831.101" },
  OAVS: { sr: "831.101" },
  ATSV: { sr: "830.11" },
  BVG: { sr: "831.40" },
  LPP: { sr: "831.40" },
  StHG: { sr: "642.14" },
  LHID: { sr: "642.14" },
  KVG: { eli: "https://fedlex.data.admin.ch/eli/cc/1995/1328_1328_1328" },
  LAMal: { eli: "https://fedlex.data.admin.ch/eli/cc/1995/1328_1328_1328" },
  DBG: { eli: "https://fedlex.data.admin.ch/eli/cc/1991/1184_1184_1184" },
  LIFD: { eli: "https://fedlex.data.admin.ch/eli/cc/1991/1184_1184_1184" },
  RPG: { eli: "https://fedlex.data.admin.ch/eli/cc/1979/1573_1573_1573" },
  LAT: { eli: "https://fedlex.data.admin.ch/eli/cc/1979/1573_1573_1573" },
  VZAE: { eli: "https://fedlex.data.admin.ch/eli/cc/2007/759" },
  OASA: { eli: "https://fedlex.data.admin.ch/eli/cc/2007/759" },
  BüG: { eli: "https://fedlex.data.admin.ch/eli/cc/2016/404" },
  LN: { eli: "https://fedlex.data.admin.ch/eli/cc/2016/404" },
  VGG: { sr: "173.32" },
  LTAF: { sr: "173.32" },
  SVG: { sr: "741.01" },
  LCR: { sr: "741.01" },
  MWSTG: { sr: "641.20" },
  LTVA: { sr: "641.20" },
  ArG: { sr: "822.11" },
  LTr: { sr: "822.11" },
  GlG: { sr: "151.1" },
  LEg: { sr: "151.1" },
  USG: { sr: "814.01" },
  LPE: { sr: "814.01" },
  BPG: { sr: "172.220.1" },
  LPers: { sr: "172.220.1" },
  // DSG de 2020 (en vigor desde 2023-09-01): el SR 235.1 apunta a la ley de 1993 derogada, se usa el ELI.
  DSG: { eli: "https://fedlex.data.admin.ch/eli/cc/2022/491" },
  LPD: { eli: "https://fedlex.data.admin.ch/eli/cc/2022/491" },
};

export function lawSourceForAbbreviation(abbreviation: string): LawSource | null {
  const entry = LAW_TABLE[abbreviation];
  if (!entry) return null;
  const language = IT_ABBREV.has(abbreviation) ? "it" : FR_ABBREV.has(abbreviation) ? "fr" : "de";
  return {
    ...(entry.eli ? { eli: entry.eli } : {}),
    ...(entry.sr ? { systematicNumber: entry.sr } : {}),
    language,
  };
}
