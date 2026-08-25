import type { ParsedCitation } from "./citationTypes.js";

/**
 * Forma canonica de una cita ya reconocida, para comparacion/deduplicacion.
 * No resuelve nada contra ninguna fuente -- solo normaliza texto.
 */
export function normalizeCitation(citation: ParsedCitation): string {
  switch (citation.type) {
    case "systematic_number":
      return citation.systematicNumber ?? citation.raw;
    case "bge_atf_dtf": {
      const ref = citation.bgeReference;
      if (!ref) return citation.raw;
      // "BGE" es el prefijo canonico usado por entscheidsuche.ch al autoidentificar
      // sus propios documentos (ver packages/providers/entscheidsuche/src/mapper.ts,
      // extractBgeReference) -- se normaliza a ese mismo prefijo para poder comparar.
      return `BGE ${ref.volume} ${ref.chamber} ${ref.page}`;
    }
    case "case_number":
      return citation.caseNumber ?? citation.raw;
    case "ecli":
      return (citation.ecli ?? citation.raw).toUpperCase();
    case "unresolvable":
      return citation.raw.trim();
    default:
      return citation.raw;
  }
}
