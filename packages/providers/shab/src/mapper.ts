import {
  parseNormalizedDocument,
  type Language,
  type NormalizedDocument,
} from "@swiss-legal-mcp/documents";
import type { ShabRemotePublication } from "./remoteTypes.js";

const PROVIDER_ID = "shab";
const AUTHORITY = "SHAB";

function toIsoDate(isoDateTime: string | null | undefined): string | undefined {
  if (!isoDateTime) return undefined;
  return isoDateTime.slice(0, 10);
}

export interface MapShabPublicationOptions {
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly language?: Language;
}

/**
 * Normaliza una publicacion real de SHAB (`GET /api/v1/publications`, ver
 * remoteTypes.ts) a `documentType: shab_entry`. Nunca infiere
 * `affectedEntity`/`relatedPublicationIds`: solo se rellenan cuando la
 * fuente los declara explicitamente en el propio objeto `content`/`meta`.
 * No implementada por `ShabProvider` en produccion (bloqueado por
 * `robots.txt`, ver docs/providers/shab.md) -- probada aqui contra fixtures
 * reales para cuando exista un canal de acceso autorizado.
 */
export function mapShabPublicationToNormalizedDocument(
  raw: ShabRemotePublication,
  options: MapShabPublicationOptions,
): NormalizedDocument {
  const { meta } = raw;
  const language: Language = options.language ?? meta.language;
  const title =
    (language === "de" || language === "en" || language === "it" || language === "fr"
      ? meta.title[language]
      : undefined) ?? meta.title.de;

  const debtor = raw.content?.debtor;
  const affectedEntity =
    debtor?.selectType === "person" && (debtor.person?.prename || debtor.person?.name)
      ? {
          type: "person" as const,
          ...(debtor.person?.prename || debtor.person?.name
            ? {
                displayName: [debtor.person?.prename, debtor.person?.name]
                  .filter(Boolean)
                  .join(" "),
              }
            : {}),
        }
      : debtor?.selectType === "company" && debtor.companies?.company?.name
        ? {
            type: "company" as const,
            displayName: debtor.companies.company.name,
            ...(debtor.companies.company.uidOrganisationId
              ? { uid: debtor.companies.company.uidOrganisationId }
              : {}),
          }
        : undefined;

  const registrationOffice = meta.registrationOffice
    ? {
        displayName: meta.registrationOffice.displayName,
        ...(meta.registrationOffice.uid ? { uid: meta.registrationOffice.uid } : {}),
      }
    : undefined;

  return parseNormalizedDocument({
    id: `${PROVIDER_ID}:${meta.publicationNumber}`,
    provider: PROVIDER_ID,
    documentType: "shab_entry",
    jurisdiction: { level: "federal" },
    authority: AUTHORITY,
    sourceOriginalId: meta.id,
    date: {
      publicationDate: toIsoDate(meta.publicationDate),
    },
    language,
    title,
    shabPublication: {
      publicationNumber: meta.publicationNumber,
      rubric: meta.rubric,
      ...(meta.subRubric ? { subRubric: meta.subRubric } : {}),
      publicationState: meta.publicationState === "PUBLISHED" ? "published" : "cancelled",
      ...(toIsoDate(meta.expirationDate) ? { expirationDate: toIsoDate(meta.expirationDate) } : {}),
      ...(affectedEntity ? { affectedEntity } : {}),
      ...(registrationOffice ? { registrationOffice } : {}),
      ...(meta.cantons && meta.cantons.length > 0 ? { cantons: meta.cantons } : {}),
      ...(meta.legalRemedy ? { legalBasisText: meta.legalRemedy } : {}),
      ...(meta.repeatedPublications && meta.repeatedPublications.length > 0
        ? { relatedPublicationIds: meta.repeatedPublications }
        : {}),
    },
    provenance: {
      sourceUrl: options.sourceUrl,
      retrievedAt: options.retrievedAt,
      contentHash: options.contentHash,
      officialCharacter: "official",
    },
    rawMetadata: { dossierReference: meta.dossierReference ?? null },
    contentNature: "summary",
  });
}
