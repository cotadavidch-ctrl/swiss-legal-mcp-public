import { parseHtml } from "@swiss-legal-mcp/shared-web";
import type { Language } from "@swiss-legal-mcp/documents";

export interface SecoListingItem {
  readonly title: string;
  readonly downloadUrl: string;
  /** Fecha de creacion/actualizacion del archivo tal como la declara la pagina (ISO). No es necesariamente la fecha de vigencia legal (ver "gultig ab"/"valable des" en el titulo). */
  readonly publicationDate?: string;
}

const CREATED_DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/;

function toIsoDate(ddMmYyyy: string): string | undefined {
  const match = CREATED_DATE_PATTERN.exec(ddMmYyyy.trim());
  if (!match) return undefined;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/**
 * Parsea la estructura HTML real de la pagina de publicaciones de SECO
 * (arbeit.swiss, ver docs/provider-contracts/seco.md): cada publicacion es
 * un `<a class="u-base-download-item">` con un `<h5 class="...__title">` de
 * texto libre y un `<div class="...__meta-info">` con tipo y fecha. El href
 * observado es relativo en aleman (`/api/media/...`) y absoluto en frances
 * (`https://backend.arbeit.swiss/...`) -- `baseUrl` resuelve el primer caso,
 * `new URL` deja el segundo intacto.
 */
export function parseSecoListing(html: string, baseUrl: string): SecoListingItem[] {
  const $ = parseHtml(html);
  const items: SecoListingItem[] = [];

  $("a.u-base-download-item").each((_index, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");
    if (!href) return;

    const title = anchor.find("h5.u-base-download-item__title").text().trim();
    if (!title) return;

    const createdText = anchor.find("span.u-base-download-item__created").text().trim();
    const publicationDate = createdText ? toIsoDate(createdText) : undefined;

    items.push({
      title,
      downloadUrl: new URL(href, baseUrl).toString(),
      ...(publicationDate ? { publicationDate } : {}),
    });
  });

  return items;
}

export const SECO_LANGUAGES: readonly Language[] = ["de", "fr"];
