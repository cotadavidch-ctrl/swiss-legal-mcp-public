import { computeContentHash, parseNormalizedDocument } from "@swiss-legal-mcp/documents";
import type { Jurisdiction, Language, NormalizedDocument } from "@swiss-legal-mcp/documents";
import type { OfficialSourceResolver } from "./officialSourceResolver.js";
import type { RemoteSearchHit } from "./remoteTypes.js";

const PROVIDER_ID = "entscheidsuche";
const AGGREGATOR_NAME = "entscheidsuche.ch";

/** Se lanza cuando un hit remoto no trae lo minimo indispensable para normalizar (nunca se inventa el dato faltante). */
export class EntscheidsucheMappingError extends Error {
  constructor(hitId: string, reason: string) {
    super(`No se pudo normalizar el documento '${hitId}' de entscheidsuche.ch: ${reason}`);
    this.name = "EntscheidsucheMappingError";
  }
}

export interface MapHitOptions {
  /** true si `hit.text` proviene de fetch_document (texto integro); false si viene de search/search_by_case_number (extracto resaltado). */
  readonly isFullText: boolean;
  readonly resolver: OfficialSourceResolver;
  /**
   * Solo se rellena `language` cuando la busqueda se ejecuto con un
   * `language_filter` de un unico idioma (ver docs/provider-contracts/entscheidsuche.md
   * -- el esquema remoto no expone el idioma real del documento).
   */
  readonly inferredLanguage?: Language;
  readonly retrievedAt?: string;
}

const HIGHLIGHT_TAG_PATTERN = /<\/?em>/g;

function stripHighlightMarkup(text: string): string {
  return text.replace(HIGHLIGHT_TAG_PATTERN, "");
}

// Sin anclas \b: el id usa "_" como separador, y "_" cuenta como caracter de
// palabra en JS (\w incluye "_"), asi que \b nunca marcaria un limite ahi.
const BGE_ID_SEGMENT_PATTERN = /BGE-(\d+)-([IVXLC]+)-(\d+)/i;

/**
 * Extrae una cita BGE/ATF/DTF SOLO cuando el id remoto contiene el segmento
 * estructurado "BGE-<vol>-<parte>-<pagina>" (p.ej. "BGE-142-III-1" dentro de
 * "CH_BGE_005_BGE-142-III-1_2016"). No se intenta extraer numeros de
 * expediente cantonales del `title` libre: seria una heuristica fragil sobre
 * texto no estructurado (ver docs/providers/entscheidsuche.md).
 */
function extractBgeReference(id: string): string | undefined {
  const match = BGE_ID_SEGMENT_PATTERN.exec(id);
  if (!match) return undefined;
  return `BGE ${match[1]} ${match[2]} ${match[3]}`;
}

function detectLanguageFromContent(text: string): Language | undefined {
  const normalized = text.toLowerCase();
  const scores: Record<Language, number> = {
    de: countMatches(
      normalized,
      /\b(?:der|die|das|und|nicht|beschwerde|gericht|sachverhalt|erwägung|entscheid|vorinstanz|bundesgericht)\b/g,
    ),
    fr: countMatches(
      normalized,
      /\b(?:le|la|les|des|une|est|pas|recours|tribunal|considérant|considérants|décision|autorité|fédéral)\b/g,
    ),
    it: countMatches(
      normalized,
      /\b(?:il|la|gli|della|delle|ricorso|tribunale|considerando|decisione|autorità|federale)\b/g,
    ),
    rm: 0,
    en: countMatches(
      normalized,
      /\b(?:the|and|court|appeal|judgment|decision|federal|consideration)\b/g,
    ),
  };
  const [language, score] = Object.entries(scores).sort((left, right) => right[1] - left[1])[0] as [
    Language,
    number,
  ];
  return score >= 3 ? language : undefined;
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

function mapJurisdiction(hit: RemoteSearchHit): Jurisdiction {
  const canton = hit.canton.trim().toUpperCase();
  if (canton === "CH" || canton === "") {
    if (hit.court.startsWith("CH_") || canton === "CH") {
      return { level: "federal" };
    }
    throw new EntscheidsucheMappingError(
      hit.id,
      `no se pudo determinar la jurisdiccion (canton='${hit.canton}', court='${hit.court}').`,
    );
  }
  if (canton.length === 2) {
    return { level: "cantonal", canton };
  }
  throw new EntscheidsucheMappingError(hit.id, `canton con formato inesperado: '${hit.canton}'.`);
}

/**
 * Convierte un SearchHit crudo de entscheidsuche.ch al modelo normalizado
 * comun. Ver docs/provider-contracts/entscheidsuche.md para la justificacion
 * de cada decision de mapeo (que campos se dejan ausentes y por que).
 */
export function mapEntscheidsucheDocumentToNormalizedDocument(
  hit: RemoteSearchHit,
  options: MapHitOptions,
): NormalizedDocument {
  const title = stripHighlightMarkup(hit.title);
  const abstract = stripHighlightMarkup(hit.abstract);
  const bodyText = stripHighlightMarkup(hit.text);

  if (!hit.document_url) {
    // No observado en la muestra real de Fase 2 (100% de los hits tenian
    // document_url); si ocurriera, fallamos explicitamente en vez de
    // inventar una URL de agregador.
    throw new EntscheidsucheMappingError(hit.id, "el hit remoto no trae document_url.");
  }

  const officialResolution = options.resolver.resolve(hit.original_url);

  const fullText = options.isFullText && bodyText.length > 0 ? bodyText : undefined;
  const summary = abstract.length > 0 ? abstract : undefined;
  const contentForHash = fullText ?? summary ?? title;
  const detectedLanguage = detectLanguageFromContent(fullText ?? summary ?? title);
  const language = fullText
    ? (detectedLanguage ?? options.inferredLanguage)
    : (options.inferredLanguage ?? detectedLanguage);

  const draft = {
    id: `${PROVIDER_ID}:${hit.id}`,
    provider: PROVIDER_ID,
    documentType: "case" as const,
    jurisdiction: mapJurisdiction(hit),
    authority: hit.court.length > 0 ? hit.court : undefined,

    bgeAtfDtf: extractBgeReference(hit.id),
    sourceOriginalId: hit.id,

    date: {
      decisionOrEnactment: hit.decision_date ?? undefined,
    },
    ...(language !== undefined ? { language } : {}),
    title,
    ...(summary !== undefined ? { summary } : {}),
    ...(fullText !== undefined ? { fullText } : {}),
    excerptOnly: !options.isFullText,

    provenance: {
      sourceUrl: hit.document_url,
      downloadUrl: hit.is_pdf ? hit.document_url : undefined,
      ...(officialResolution.isOfficialCandidate && hit.original_url
        ? { officialSourceUrl: hit.original_url }
        : {}),
      aggregatorUrl: hit.document_url,
      retrievedAt: options.retrievedAt ?? new Date().toISOString(),
      contentHash: computeContentHash(contentForHash),
      officialCharacter: "unofficial_aggregator" as const,
      aggregatorName: AGGREGATOR_NAME,
    },
    rawMetadata: {
      ...hit,
      languageInferredFromFilter: options.inferredLanguage !== undefined,
      languageDetectedFromContent: detectedLanguage ?? null,
      officialSourceResolution: officialResolution,
    },
    contentNature: "literal" as const,
  };

  return parseNormalizedDocument(draft);
}
