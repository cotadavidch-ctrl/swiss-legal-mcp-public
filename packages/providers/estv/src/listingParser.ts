import { parseHtml } from "@swiss-legal-mcp/shared-web";
import { extractEstvReference, parseGermanHumanDate } from "./referenceExtractor.js";

export interface EstvListingItem {
  readonly title: string;
  readonly description?: string;
  readonly downloadUrl: string;
  readonly filename?: string;
  readonly circularNumber?: string;
  readonly issuedDate?: string;
  readonly publicationDate?: string;
}

/**
 * Parsea la estructura HTML real del portal clasico de ESTV
 * (`www.estv.admin.ch/de/kreisschreiben-*`, ver docs/provider-contracts/estv.md):
 * cada circular es un `<a class="download-item" aria-label="Download Kreisschreiben
 * Nr. X: Titulo">` con un `<h4 class="download-item__title">`, un
 * `<p class="download-item__description">` de texto libre (incluye "vom
 * DD.MM.YYYY") y un `<p class="download-item__meta-info">` con 3 spans:
 * tipo, tamano y fecha humana alemana ("5. Dezember 2023"). El href ya es
 * absoluto en la fuente real (dominio DAM `www.estv.admin.ch/dam/...`).
 */
export function parseEstvListing(html: string): EstvListingItem[] {
  const $ = parseHtml(html);
  const items: EstvListingItem[] = [];

  $("a.download-item").each((_index, element) => {
    const anchor = $(element);
    const downloadUrl = anchor.attr("href");
    if (!downloadUrl) return;

    const ariaLabel = anchor.attr("aria-label") ?? "";
    const title = anchor.find("h4.download-item__title").text().trim() || ariaLabel;
    if (!title) return;

    const description = anchor.find("p.download-item__description").text().trim() || undefined;
    const filename = anchor.attr("download");

    const metaSpans = anchor
      .find("p.download-item__meta-info span.meta-info__item")
      .map((_i, span) => $(span).text().trim())
      .get();
    const humanDate = metaSpans[2];
    const publicationDate = humanDate ? parseGermanHumanDate(humanDate) : undefined;

    const reference = extractEstvReference(ariaLabel || title, description);

    items.push({
      title,
      downloadUrl,
      ...(description ? { description } : {}),
      ...(filename ? { filename } : {}),
      ...(reference.circularNumber ? { circularNumber: reference.circularNumber } : {}),
      ...(reference.issuedDate ? { issuedDate: reference.issuedDate } : {}),
      ...(publicationDate ? { publicationDate } : {}),
    });
  });

  return items;
}
