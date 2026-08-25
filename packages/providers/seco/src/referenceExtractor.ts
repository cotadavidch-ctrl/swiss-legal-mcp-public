export interface ExtractedSecoReference {
  readonly referenceNumber?: string;
  readonly effectiveDate?: string;
}

/**
 * `referenceNumber`/`effectiveDate` NUNCA existen como campos separados en la
 * fuente de SECO: solo aparecen como subcadenas de texto libre dentro del
 * titulo (ver docs/provider-contracts/seco.md, hallazgo real verificado en
 * vivo). Estas expresiones regulares son tolerantes: si el titulo no sigue
 * el patron esperado, el campo correspondiente queda ausente -- nunca se
 * inventa un valor.
 */

/** Captura el codigo de practica entre parentesis, p.ej. "AVIG-Praxis KAE", "Bulletin LACI RHT". */
const PRACTICE_CODE_PATTERN = /\(([^()]*(?:Praxis|LACI)[^()]*)\)/i;

/** Fallback para "Themenspezifische Fachweisungen" numeradas, p.ej. "Weisung 2024/02". */
const NUMBERED_INSTRUCTION_PATTERN = /Weisung\s+(\d{4}\/\d{2})/;

/** "gultig ab"/"valable des" seguido de D.M.YYYY (alemán/frances, verificado en vivo). */
const EFFECTIVE_DATE_PATTERN = /(?:g[uü]ltig ab|valable d[eè]s)\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/i;

/** Fallback observado en guias/leitfaden: "Stand: D.M.YYYY". */
const STAND_DATE_PATTERN = /Stand:?\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i;

function toIsoDate(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function extractSecoReference(title: string): ExtractedSecoReference {
  const practiceMatch = PRACTICE_CODE_PATTERN.exec(title);
  const numberedMatch = practiceMatch ? undefined : NUMBERED_INSTRUCTION_PATTERN.exec(title);

  const dateMatch = EFFECTIVE_DATE_PATTERN.exec(title) ?? STAND_DATE_PATTERN.exec(title);

  const result: { referenceNumber?: string; effectiveDate?: string } = {};
  if (practiceMatch?.[1]) {
    result.referenceNumber = practiceMatch[1].trim();
  } else if (numberedMatch?.[1]) {
    result.referenceNumber = numberedMatch[1];
  }
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    if (day && month && year) {
      result.effectiveDate = toIsoDate(day, month, year);
    }
  }
  return result;
}

/** "Leitfaden"/"Guide" -> guidance; codigo de practica real -> practice; resto -> directive (traduccion honesta de "Weisung"). */
export function classifySecoDocumentType(
  title: string,
  reference: ExtractedSecoReference,
): "guidance" | "practice" | "directive" {
  if (/leitfaden|guide/i.test(title)) return "guidance";
  if (reference.referenceNumber) return "practice";
  return "directive";
}
