import {
  buildAdministrativeCircularDocument,
  type AdministrativeCircularBuilderInput,
} from "@swiss-legal-mcp/shared-web";
import type { Language, NormalizedDocument } from "@swiss-legal-mcp/documents";
import { classifySecoDocumentType, extractSecoReference } from "./referenceExtractor.js";
import type { SecoListingItem } from "./listingParser.js";

const PROVIDER_ID = "seco";
const AUTHORITY = "SECO";

export function buildSecoDocumentId(language: Language, downloadUrl: string): string {
  const pathname = new URL(downloadUrl).pathname;
  const basename = pathname.split("/").pop() ?? pathname;
  const slug = basename.replace(/\.[a-z0-9]+$/i, "");
  return `${PROVIDER_ID}:${language}:${slug}`;
}

export interface MapSecoItemOptions {
  readonly language: Language;
  readonly listingUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  /** Presente solo si ya se descargo y extrajo el PDF (get_official_document); ausente en resultados de busqueda (solo metadatos). */
  readonly fullText?: string;
}

/**
 * Normaliza un elemento del listado real de SECO (ver listingParser.ts) a
 * `documentType: administrative_circular`. Reutiliza el builder compartido
 * de packages/shared-web -- ningun campo se rellena con un valor inventado:
 * si el titulo no revela un codigo de practica o fecha de vigencia, esos
 * campos quedan ausentes (ver referenceExtractor.ts).
 */
export function mapSecoItemToNormalizedDocument(
  item: SecoListingItem,
  options: MapSecoItemOptions,
): NormalizedDocument {
  const reference = extractSecoReference(item.title);
  const administrativeDocumentType = classifySecoDocumentType(item.title, reference);
  const id = buildSecoDocumentId(options.language, item.downloadUrl);

  const input: AdministrativeCircularBuilderInput = {
    id,
    provider: PROVIDER_ID,
    authority: AUTHORITY,
    sourceOriginalId: item.downloadUrl,
    title: item.title,
    language: options.language,
    jurisdiction: { level: "federal" },
    ...(options.fullText ? { fullText: options.fullText } : {}),
    date: {
      ...(item.publicationDate ? { publicationDate: item.publicationDate } : {}),
      ...(reference.effectiveDate ? { inForceFrom: reference.effectiveDate } : {}),
    },
    administrativeCircular: {
      administrativeDocumentType,
      status: "current",
      ...(reference.referenceNumber ? { referenceNumber: reference.referenceNumber } : {}),
      ...(reference.effectiveDate ? { effectiveDate: reference.effectiveDate } : {}),
    },
    provenance: {
      sourceUrl: options.listingUrl,
      downloadUrl: item.downloadUrl,
      retrievedAt: options.retrievedAt,
      contentHash: options.contentHash,
    },
    rawMetadata: {
      rawTitle: item.title,
      ...(item.publicationDate ? { listingPublicationDate: item.publicationDate } : {}),
    },
  };

  return buildAdministrativeCircularDocument(input);
}
