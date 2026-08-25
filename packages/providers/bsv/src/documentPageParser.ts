import { parseHtml } from "@swiss-legal-mcp/shared-web";
import type { AnyNode } from "domhandler";
import type { Cheerio, CheerioAPI } from "cheerio";
import { extractBsvDates } from "./referenceExtractor.js";

export interface BsvVersionDetail {
  readonly version: number;
  readonly documentNumber?: string;
  readonly changedDate?: string;
  readonly downloadUrl: string;
  readonly isCurrent: boolean;
  readonly effectiveDate?: string;
  readonly standDate?: string;
  readonly freeText: string;
}

const CHANGED_DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/;

function toIsoDate(ddMmYyyy: string): string | undefined {
  const match = CHANGED_DATE_PATTERN.exec(ddMmYyyy.trim());
  if (!match) return undefined;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/** Busca un `<dt>` cuyo texto coincida y devuelve el texto de su `<dd>` inmediatamente siguiente en el arbol. */
function findDtDd($: CheerioAPI, scope: Cheerio<AnyNode>, label: string): string | undefined {
  let found: string | undefined;
  scope.find("dt").each((_i, el) => {
    if (found) return;
    if ($(el).text().trim() === label) {
      const dd = $(el).nextAll("dd").first();
      if (dd.length > 0) found = dd.text().trim();
    }
  });
  return found;
}

/**
 * Parsea la pagina real de historial de versiones de un documento BSV
 * (`/de/d/{docId}`, ver docs/provider-contracts/bsv.md): cada version tiene
 * su propia fila `tr.bsv-version-details` con `data-version`, un parrafo de
 * texto libre (con "gultig ab"/"Stand"), pares dt/dd (Dokumentennummer,
 * Geandert...) y su propio enlace de descarga -- SIN parametro `?version=`
 * para la version vigente, CON el para versiones historicas (verificado en
 * vivo: version 6 = `/de/d/18452/download`, version 5 = `.../download?version=5`).
 */
export function parseBsvDocumentPage(html: string, baseUrl: string): BsvVersionDetail[] {
  const $ = parseHtml(html);
  const details: BsvVersionDetail[] = [];

  $("tr.bsv-version-details").each((_index, element) => {
    const row = $(element);
    const versionAttr = row.attr("data-version");
    const version = versionAttr ? Number(versionAttr) : undefined;
    if (!version || Number.isNaN(version)) return;

    const downloadHref = row.find("a[href*='/download']").first().attr("href");
    if (!downloadHref) return;

    const freeText = row.find("p").first().text().trim().replace(/\s+/g, " ");
    const documentNumber = findDtDd($, row, "Dokumentennummer");
    const changedRaw = findDtDd($, row, "Geändert");
    const dates = extractBsvDates(freeText);

    details.push({
      version,
      ...(documentNumber ? { documentNumber } : {}),
      ...(changedRaw && toIsoDate(changedRaw) ? { changedDate: toIsoDate(changedRaw) } : {}),
      downloadUrl: new URL(downloadHref, baseUrl).toString(),
      isCurrent: !downloadHref.includes("version="),
      ...(dates.effectiveDate ? { effectiveDate: dates.effectiveDate } : {}),
      ...(dates.standDate ? { standDate: dates.standDate } : {}),
      freeText,
    });
  });

  return details;
}
