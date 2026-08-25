import type { CitationType, ParsedCitation, ParsedCitationLocation } from "./citationTypes.js";

/**
 * Parser de citas legales suizas reales en texto libre. Reconoce formas de
 * cita realmente usadas en textos jurídicos suizos (RS/SR, BGE/ATF/DTF,
 * numero de expediente federal, ECLI, articulo+abreviatura) -- nunca
 * inventa un formato no verificado. No incluye un diccionario de
 * abreviatura->numero RS: `Fedlex.capabilities.searchByAbbreviation` es
 * `false` (packages/providers/fedlex/src/fedlexProvider.ts) -- no existe
 * ninguna fuente real verificada para esa resolucion, asi que el parser
 * extrae la abreviatura como texto (`lawAbbreviation`) pero el resolver
 * (resolver.ts) declina explicitamente resolverla en vez de adivinar.
 */

// RS/SR: "RS 220", "SR 210", "RS 311.0", "RS 172.220.111.3" (1-3 digitos, hasta 3 grupos punteados adicionales).
const RS_NUMBER_PATTERN = /\b(?:RS|SR)\s*(\d{1,3}(?:\.\d{1,4}){0,3})\b/g;

// Articulo: "art. 41", "Art. 41a al. 2 let. a", "Art. 41 Abs. 2 lit. a" (formas FR/DE), con abreviatura de ley opcional a continuacion.
const ARTICLE_PATTERN =
  /\bart\.?\s*(\d+[a-z]?)(?:\s*(?:al\.?|abs\.?)\s*(\d+))?(?:\s*(?:let\.?|lit\.?)\s*([a-z]))?(?:\s+([A-Z][A-Za-z]{1,10}))?/gi;

// BGE/ATF/DTF: "ATF 142 III 1", "BGE 133 II 292", "DTF 142 III 1".
const BGE_PATTERN = /\b(BGE|ATF|DTF)\s+(\d{1,3})\s+([IV]+[a-z]?)\s+(\d+)\b/g;

// Numero de expediente federal: "6B_1234/2025" (verificado real en docs/source-audit.md).
const CASE_NUMBER_PATTERN = /\b(\d[A-Z]{1,3}_\d+)\/(\d{4})\b/g;

// ECLI: "ECLI:CH:BGer:2020:6B_1234_2019" (formato ISO 6923 estandar). Reconocimiento de formato solamente -- ver nota de resolver.ts.
const ECLI_PATTERN = /\bECLI:[A-Z]{2}:[A-Za-z0-9]+:\d{4}:[A-Za-z0-9._-]+\b/g;

function toLocation(paragraph?: string, letter?: string): ParsedCitationLocation | undefined {
  if (!paragraph && !letter) return undefined;
  return {
    ...(paragraph ? { paragraph } : {}),
    ...(letter ? { letter } : {}),
  };
}

/**
 * Reconoce todas las citas reales presentes en `text`, en el orden en que
 * aparecen. Cada match se clasifica por `CitationType`; un mismo fragmento
 * de texto nunca se cuenta dos veces (los patrones no se solapan: ECLI/BGE/
 * caso se prueban antes que RS/articulo para evitar que un numero dentro de
 * un ECLI se interprete como articulo).
 */
export function parseCitations(text: string): ParsedCitation[] {
  const results: ParsedCitation[] = [];
  const claimedRanges: Array<[number, number]> = [];

  const claim = (start: number, end: number): boolean => {
    if (claimedRanges.some(([s, e]) => start < e && end > s)) return false;
    claimedRanges.push([start, end]);
    return true;
  };

  for (const match of text.matchAll(ECLI_PATTERN)) {
    if (!claim(match.index, match.index + match[0].length)) continue;
    results.push({ raw: match[0], type: "ecli", ecli: match[0] });
  }

  for (const match of text.matchAll(CASE_NUMBER_PATTERN)) {
    if (!claim(match.index, match.index + match[0].length)) continue;
    results.push({ raw: match[0], type: "case_number", caseNumber: match[0] });
  }

  for (const match of text.matchAll(BGE_PATTERN)) {
    if (!claim(match.index, match.index + match[0].length)) continue;
    const [, , volume, chamber, page] = match;
    results.push({
      raw: match[0],
      type: "bge_atf_dtf",
      bgeReference: { volume: volume!, chamber: chamber!, page: page! },
    });
  }

  for (const match of text.matchAll(RS_NUMBER_PATTERN)) {
    if (!claim(match.index, match.index + match[0].length)) continue;
    results.push({ raw: match[0], type: "systematic_number", systematicNumber: match[1] });
  }

  for (const match of text.matchAll(ARTICLE_PATTERN)) {
    if (!claim(match.index, match.index + match[0].length)) continue;
    const [, articleNumber, paragraph, letter, abbreviation] = match;
    results.push({
      raw: match[0].trim(),
      type: "unresolvable",
      ...(abbreviation ? { lawAbbreviation: abbreviation } : {}),
      location: { articleNumber: articleNumber!, ...toLocation(paragraph, letter) },
    });
  }

  return results.sort((a, b) => text.indexOf(a.raw) - text.indexOf(b.raw));
}

/** Clasifica un fragmento ya aislado (sin buscar dentro de texto libre) -- util cuando el llamador ya sabe que `input` es una unica cita. */
export function classifyCitation(input: string): CitationType {
  const trimmed = input.trim();
  if (new RegExp(`^${ECLI_PATTERN.source}$`).test(trimmed)) return "ecli";
  if (new RegExp(`^${CASE_NUMBER_PATTERN.source}$`).test(trimmed)) return "case_number";
  if (new RegExp(`^${BGE_PATTERN.source}$`).test(trimmed)) return "bge_atf_dtf";
  if (new RegExp(`^(?:RS|SR)\\s*\\d{1,3}(?:\\.\\d{1,4}){0,3}$`, "i").test(trimmed)) {
    return "systematic_number";
  }
  return "unresolvable";
}
