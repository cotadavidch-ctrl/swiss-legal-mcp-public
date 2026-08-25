import { parseHtml } from "@swiss-legal-mcp/shared-web";

export interface BsvFolderListingItem {
  readonly docId: string;
  readonly abbreviation?: string;
  /** Descripcion completa tal como aparece en la columna Titel (incluye "gultig ab"/"Stand" en texto libre). */
  readonly description: string;
  readonly changedDate?: string;
  readonly versionCount?: number;
  readonly languages: readonly string[];
}

const CHANGED_DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/;

function toIsoDate(ddMmYyyy: string): string | undefined {
  const match = CHANGED_DATE_PATTERN.exec(ddMmYyyy.trim());
  if (!match) return undefined;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/**
 * Parsea la tabla real de una carpeta de BSV (`/de/f/{folderId}`, ver
 * docs/provider-contracts/bsv.md): fila principal con Titel/Geandert/Version/
 * Sprachen, seguida de una fila oculta `bsv-inline-versions-container` que se
 * omite deliberadamente aqui (el historial completo se obtiene por separado
 * via documentPageParser.ts sobre `/de/d/{docId}`).
 */
export function parseBsvFolderListing(html: string): BsvFolderListingItem[] {
  const $ = parseHtml(html);
  const items: BsvFolderListingItem[] = [];

  $("table.bsv-documents > tbody > tr").each((_index, element) => {
    const row = $(element);
    if (row.hasClass("bsv-inline-versions-container")) return;

    const titleColumn = row.find(".bsv-document-title-column");
    if (titleColumn.length === 0) return;

    const abbreviation = titleColumn.find("strong").first().text().trim() || undefined;
    const descriptionClone = titleColumn.clone();
    descriptionClone.find("a, .visible-xs, .hidden-xs").remove();
    const description = descriptionClone.text().trim().replace(/\s+/g, " ");

    const downloadHref = row.find("a[href*='/download']").first().attr("href");
    const docId = downloadHref ? /\/de\/d\/(\d+)\/download/.exec(downloadHref)?.[1] : undefined;
    if (!docId) return;

    const cells = row.children("td");
    const changedText = cells.eq(1).text().trim();
    const versionText = cells.eq(2).text().trim();
    const languages = row
      .find("td.hidden-xs a.bsv-versions-lang")
      .map((_i, langEl) => $(langEl).text().trim())
      .get();

    items.push({
      docId,
      ...(abbreviation ? { abbreviation } : {}),
      description,
      ...(toIsoDate(changedText) ? { changedDate: toIsoDate(changedText) } : {}),
      ...(versionText && /^\d+$/.test(versionText) ? { versionCount: Number(versionText) } : {}),
      languages,
    });
  });

  return items;
}
