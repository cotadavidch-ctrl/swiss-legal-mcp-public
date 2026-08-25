import type { InForceStatus, Language, LegislationFormat } from "@swiss-legal-mcp/documents";

export class FedlexVocabularyError extends Error {}

/**
 * Vocabulario de idiomas de la Oficina de Publicaciones de la UE, usado por
 * Fedlex en jolux:language. Codigos verificados en vivo (Fase 3, ver
 * tests/fixtures/fedlex/jolux_constitution_expression_{rm,en}.json): romanche
 * es "ROH" (no "RON"), ingles es "ENG" (no "EN"). Solo se mapean los codigos
 * realmente observados; cualquier otro lanza FedlexVocabularyError en vez de
 * adivinar.
 */
const LANGUAGE_URI_PREFIX = "http://publications.europa.eu/resource/authority/language/";
const LANGUAGE_CODE_MAP: Readonly<Record<string, Language>> = {
  DEU: "de",
  FRA: "fr",
  ITA: "it",
  ROH: "rm",
  ENG: "en",
};

export function parseLanguageUri(uri: string): Language {
  if (!uri.startsWith(LANGUAGE_URI_PREFIX)) {
    throw new FedlexVocabularyError(`URI de idioma con prefijo no reconocido: '${uri}'.`);
  }
  const code = uri.slice(LANGUAGE_URI_PREFIX.length);
  const language = LANGUAGE_CODE_MAP[code];
  if (!language) {
    throw new FedlexVocabularyError(`Codigo de idioma no reconocido: '${code}' (URI: '${uri}').`);
  }
  return language;
}

/**
 * Vocabulario jolux:inForceStatus, verificado en vivo (ver
 * tests/fixtures/fedlex/jolux_enforcement_status_vocabulary.json):
 * 0=vigente, 1=ya no publicada en la SR/RS, 2=sin objeto, 3=ya no vigente.
 * El valor 4 existe (confirmado por su rdf:type) pero no se capturo ninguna
 * etiqueta -- se mapea a "other" en vez de inventar un significado.
 */
const ENFORCEMENT_STATUS_URI_PREFIX = "https://fedlex.data.admin.ch/vocabulary/enforcement-status/";
const ENFORCEMENT_STATUS_MAP: Readonly<Record<string, InForceStatus>> = {
  "0": "in_force",
  "1": "no_longer_published",
  "2": "not_applicable",
  "3": "no_longer_in_force",
};

export function parseInForceStatusUri(uri: string): InForceStatus {
  if (!uri.startsWith(ENFORCEMENT_STATUS_URI_PREFIX)) {
    throw new FedlexVocabularyError(`URI de inForceStatus con prefijo no reconocido: '${uri}'.`);
  }
  const code = uri.slice(ENFORCEMENT_STATUS_URI_PREFIX.length);
  return ENFORCEMENT_STATUS_MAP[code] ?? "other";
}

/**
 * Vocabulario jolux:userFormat propio de Fedlex (ver
 * tests/fixtures/fedlex/jolux_manifestation_xml_20240303_de.json: valor real
 * observado "user-format/xml"). "pdf-a" se normaliza a nuestro "pdf" -- es el
 * mismo formato de manifestacion desde la perspectiva del modelo normalizado
 * (PDF/A es una variante archivable de PDF, no un formato distinto para
 * efectos de esta herramienta).
 */
const USER_FORMAT_URI_PREFIX = "https://fedlex.data.admin.ch/vocabulary/user-format/";
const USER_FORMAT_MAP: Readonly<Record<string, LegislationFormat>> = {
  xml: "xml",
  html: "html",
  "pdf-a": "pdf",
  docx: "docx",
  doc: "doc",
};

export function parseUserFormatUri(uri: string): LegislationFormat {
  if (!uri.startsWith(USER_FORMAT_URI_PREFIX)) {
    throw new FedlexVocabularyError(`URI de userFormat con prefijo no reconocido: '${uri}'.`);
  }
  const code = uri.slice(USER_FORMAT_URI_PREFIX.length);
  const format = USER_FORMAT_MAP[code];
  if (!format) {
    throw new FedlexVocabularyError(
      `Formato de manifestacion no reconocido: '${code}' (URI: '${uri}').`,
    );
  }
  return format;
}
