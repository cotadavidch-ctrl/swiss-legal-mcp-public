import {
  buildAdministrativeCircularDocument,
  type AdministrativeCircularBuilderInput,
} from "@swiss-legal-mcp/shared-web";
import type { NormalizedDocument } from "@swiss-legal-mcp/documents";
import type { BsvVersionDetail } from "./documentPageParser.js";

const PROVIDER_ID = "bsv";
const AUTHORITY = "BSV/OFAS";

export function buildBsvDocumentId(docId: string, version?: number, isCurrent = true): string {
  return isCurrent ? `${PROVIDER_ID}:${docId}` : `${PROVIDER_ID}:${docId}:v${version}`;
}

export interface MapBsvVersionOptions {
  readonly docId: string;
  readonly abbreviation?: string;
  readonly description: string;
  readonly folderUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly fullText?: string;
}

/**
 * Normaliza una version concreta (parseBsvDocumentPage) a
 * `documentType: administrative_circular`. `status` refleja unicamente el
 * historial de versiones DE ESTE MISMO documento (isCurrent), nunca una
 * sustitucion inferida entre documentos distintos -- ver
 * docs/provider-contracts/bsv.md (relaciones de sustitucion solo declaradas
 * en prosa libre, no extraidas automaticamente).
 */
export function mapBsvVersionToNormalizedDocument(
  version: BsvVersionDetail,
  options: MapBsvVersionOptions,
): NormalizedDocument {
  const id = buildBsvDocumentId(options.docId, version.version, version.isCurrent);
  const title = options.abbreviation
    ? `${options.abbreviation}: ${options.description}`
    : options.description;

  const input: AdministrativeCircularBuilderInput = {
    id,
    provider: PROVIDER_ID,
    authority: AUTHORITY,
    sourceOriginalId: options.docId,
    title,
    language: "de",
    jurisdiction: { level: "federal" },
    ...(options.fullText ? { fullText: options.fullText } : {}),
    date: {
      ...(version.changedDate ? { publicationDate: version.changedDate } : {}),
      ...(version.effectiveDate ? { inForceFrom: version.effectiveDate } : {}),
    },
    administrativeCircular: {
      administrativeDocumentType: "circular",
      status: version.isCurrent ? "current" : "superseded",
      version: String(version.version),
      ...(version.documentNumber ? { referenceNumber: version.documentNumber } : {}),
      ...(version.effectiveDate ? { effectiveDate: version.effectiveDate } : {}),
    },
    provenance: {
      sourceUrl: options.folderUrl,
      downloadUrl: version.downloadUrl,
      retrievedAt: options.retrievedAt,
      contentHash: options.contentHash,
    },
    rawMetadata: {
      rawDescription: options.description,
      freeText: version.freeText,
      ...(version.standDate ? { standDate: version.standDate } : {}),
    },
  };

  return buildAdministrativeCircularDocument(input);
}
