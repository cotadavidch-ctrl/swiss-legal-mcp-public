export interface ExtractedEstvReference {
  readonly circularNumber?: string;
  readonly issuedDate?: string;
}

/**
 * El numero de circular y la fecha de emision NUNCA son campos JSON
 * separados en el portal clasico de ESTV: el numero aparece en el
 * `aria-label`/titulo ("Kreisschreiben Nr. 50a: ...") y la fecha en texto
 * libre de la descripcion ("... vom DD.MM.YYYY (Direkte Bundessteuer)") --
 * ver docs/provider-contracts/estv.md. Si el texto no sigue el patron
 * esperado, el campo queda ausente.
 */
const CIRCULAR_NUMBER_PATTERN = /Kreisschreiben\s+Nr\.?\s*([0-9]+[a-z]?)/i;
const ISSUED_DATE_PATTERN = /vom\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/i;

const GERMAN_MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

/** Fecha humana alemana observada en meta-info, p.ej. "5. Dezember 2023". */
const GERMAN_HUMAN_DATE_PATTERN = /^(\d{1,2})\.\s*([A-Za-zäöü]+)\s+(\d{4})$/;

function toIsoDate(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function extractEstvReference(
  ariaLabelOrTitle: string,
  description?: string,
): ExtractedEstvReference {
  const numberMatch = CIRCULAR_NUMBER_PATTERN.exec(ariaLabelOrTitle);
  const dateMatch = description ? ISSUED_DATE_PATTERN.exec(description) : null;

  const result: { circularNumber?: string; issuedDate?: string } = {};
  if (numberMatch?.[1]) {
    result.circularNumber = numberMatch[1];
  }
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    if (day && month && year) result.issuedDate = toIsoDate(day, month, year);
  }
  return result;
}

/** Convierte "5. Dezember 2023" (fecha humana alemana real de meta-info) a ISO. Ausente si no coincide. */
export function parseGermanHumanDate(text: string): string | undefined {
  const match = GERMAN_HUMAN_DATE_PATTERN.exec(text.trim());
  if (!match) return undefined;
  const [, day, monthName, year] = match;
  const monthNumber = monthName ? GERMAN_MONTHS[monthName.toLowerCase()] : undefined;
  if (!day || !monthNumber || !year) return undefined;
  return toIsoDate(day, monthNumber, year);
}
