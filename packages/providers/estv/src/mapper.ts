import {
  buildAdministrativeCircularDocument,
  type AdministrativeCircularBuilderInput,
} from "@swiss-legal-mcp/shared-web";
import type { NormalizedDocument } from "@swiss-legal-mcp/documents";
import type { EstvListingItem } from "./listingParser.js";

const PROVIDER_ID = "estv";
const AUTHORITY = "ESTV/AFC";

export function buildEstvDocumentId(item: EstvListingItem): string {
  const slugSource =
    item.filename ?? new URL(item.downloadUrl).pathname.split("/").pop() ?? item.downloadUrl;
  const slug = slugSource.replace(/\.[a-z0-9]+$/i, "");
  return `${PROVIDER_ID}:${slug}`;
}

export interface MapEstvItemOptions {
  readonly listingUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly fullText?: string;
}

/**
 * Normaliza un item del listado real de ESTV a
 * `documentType: administrative_circular`, `administrativeDocumentType:
 * "circular"` (Kreisschreiben = circular, sin necesidad de clasificacion
 * adicional). `referenceNumber` usa el numero declarado en el aria-label
 * ("Nr. 50a") como valor canonico -- ver docs/provider-contracts/estv.md
 * sobre los otros dos formatos de referencia observados (nombre de archivo,
 * pie de pagina del PDF), preservados en rawMetadata sin reconciliar.
 */
export function mapEstvItemToNormalizedDocument(
  item: EstvListingItem,
  options: MapEstvItemOptions,
): NormalizedDocument {
  const id = buildEstvDocumentId(item);

  const input: AdministrativeCircularBuilderInput = {
    id,
    provider: PROVIDER_ID,
    authority: AUTHORITY,
    sourceOriginalId: item.downloadUrl,
    title: item.title,
    language: "de",
    jurisdiction: { level: "federal" },
    ...(options.fullText ? { fullText: options.fullText } : {}),
    ...(item.description ? { summary: item.description } : {}),
    date: {
      ...(item.issuedDate ? { decisionOrEnactment: item.issuedDate } : {}),
      ...(item.publicationDate ? { publicationDate: item.publicationDate } : {}),
    },
    administrativeCircular: {
      administrativeDocumentType: "circular",
      status: "current",
      ...(item.circularNumber ? { referenceNumber: `Nr. ${item.circularNumber}` } : {}),
      ...(item.issuedDate ? { issuedDate: item.issuedDate } : {}),
    },
    provenance: {
      sourceUrl: options.listingUrl,
      downloadUrl: item.downloadUrl,
      retrievedAt: options.retrievedAt,
      contentHash: options.contentHash,
    },
    rawMetadata: {
      rawTitle: item.title,
      ...(item.filename ? { filename: item.filename } : {}),
    },
  };

  return buildAdministrativeCircularDocument(input);
}
