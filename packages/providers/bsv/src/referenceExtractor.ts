export interface ExtractedBsvDates {
  readonly effectiveDate?: string;
  readonly standDate?: string;
}

/**
 * BSV declara "gultig ab D.M.YYYY" (entrada en vigor) y "Stand D.M.YYYY"
 * (ultima actualizacion) como texto libre dentro del mismo parentesis del
 * titulo/descripcion, p.ej. "(gultig ab 1.1.2022; Stand 1.1.2026)" -- ver
 * docs/provider-contracts/bsv.md. Nunca son campos JSON separados. Si el
 * texto no sigue el patron, el campo correspondiente queda ausente.
 */
const EFFECTIVE_DATE_PATTERN = /g[uü]ltig ab\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/i;
const STAND_DATE_PATTERN = /Stand\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/i;

function toIsoDate(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function extractBsvDates(freeText: string): ExtractedBsvDates {
  const effectiveMatch = EFFECTIVE_DATE_PATTERN.exec(freeText);
  const standMatch = STAND_DATE_PATTERN.exec(freeText);
  const result: { effectiveDate?: string; standDate?: string } = {};
  if (effectiveMatch) {
    const [, day, month, year] = effectiveMatch;
    if (day && month && year) result.effectiveDate = toIsoDate(day, month, year);
  }
  if (standMatch) {
    const [, day, month, year] = standMatch;
    if (day && month && year) result.standDate = toIsoDate(day, month, year);
  }
  return result;
}
