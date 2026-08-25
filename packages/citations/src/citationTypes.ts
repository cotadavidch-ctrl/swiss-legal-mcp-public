import type { NormalizedDocument, OfficialCharacter } from "@swiss-legal-mcp/documents";

/**
 * Tipos de cita reales soportados por el parser -- ver parser.ts para la
 * evidencia de cada patron. `systematic_number` es deliberadamente generico
 * (no "rs_federal"/"rs_cantonal"): el numero RS/SR federal y un numero
 * sistematico cantonal (ej. SRSZ, RSN) comparten el mismo formato numerico
 * punteado, y no hay forma de distinguirlos por texto solo -- la
 * desambiguacion ocurre en el resolver, nunca en el parser.
 */
export type CitationType =
  "systematic_number" | "bge_atf_dtf" | "case_number" | "ecli" | "unresolvable";

/**
 * Nunca se convierte un match aproximado en una verificacion positiva (ver
 * ADR de resolucion de citas). `probable`: se encontro un unico resultado
 * real pero el proveedor no garantiza unicidad estructural (ej. numero
 * sistematico ambiguo entre RS federal y varios cantones). `ambiguous`: mas
 * de un candidato real, ninguno preferido sin informacion adicional del
 * llamador (ej. falta el parametro `canton`). `not_found`: se consulto la
 * fuente real y no devolvio nada. `exact`: identificador con garantia
 * estructural real de unicidad (ELI de Fedlex, o coincidencia por
 * `documentId` exacto).
 */
export type CitationMatchStatus = "exact" | "probable" | "ambiguous" | "not_found";

/** Ubicacion dentro de un acto, tal como aparece en la cita real (no inventada si el llamador no la incluyo). */
export interface ParsedCitationLocation {
  readonly articleNumber?: string;
  readonly paragraph?: string;
  readonly letter?: string;
}

/**
 * Resultado del parser: una cita reconocida en texto libre, sin resolver
 * todavia contra ninguna fuente. `raw` conserva el texto original exacto
 * (para trazabilidad); los demas campos son la interpretacion estructural.
 */
export interface ParsedCitation {
  readonly raw: string;
  readonly type: CitationType;
  readonly language?: "de" | "fr" | "it";
  /** Presente solo para `type: "systematic_number"`. */
  readonly systematicNumber?: string;
  /** Abreviatura de la ley citada junto al numero/articulo (ej. "CO", "OR", "ZGB"), cuando aparece en el texto real. Nunca inferida. */
  readonly lawAbbreviation?: string;
  readonly location?: ParsedCitationLocation;
  /** Presente solo para `type: "bge_atf_dtf"`. */
  readonly bgeReference?: {
    readonly volume: string;
    readonly chamber: string;
    readonly page: string;
  };
  /** Presente solo para `type: "case_number"`. */
  readonly caseNumber?: string;
  /** Presente solo para `type: "ecli"`. Formato valido no implica que el resolver pueda verificarlo (ver docs/provider-contracts/citation-resolution.md). */
  readonly ecli?: string;
}

export interface CitationEvidenceEntry {
  readonly providerConsulted: string;
  readonly sourceUrl?: string;
  readonly retrievedAt?: string;
  readonly officialCharacter?: OfficialCharacter;
  /** Explica por que este proveedor se considero (o se descarto) para esta cita. */
  readonly note?: string;
}

export interface CitationCandidate {
  readonly document: NormalizedDocument;
  readonly providerId: string;
}

/**
 * Resultado completo de resolver una cita contra las fuentes reales
 * disponibles. `document` solo esta presente cuando `match` es "exact" o
 * "probable" con un unico candidato; para "ambiguous" los candidatos viven
 * en `alternativeCandidates`, nunca en `document`.
 */
export interface CitationResolution {
  readonly parsed: ParsedCitation;
  readonly match: CitationMatchStatus;
  readonly document?: NormalizedDocument;
  readonly alternativeCandidates: readonly CitationCandidate[];
  readonly warnings: readonly string[];
  readonly evidence: readonly CitationEvidenceEntry[];
}
