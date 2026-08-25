import {
  computeContentHash,
  parseNormalizedDocument,
  type AmendingActReference,
  type InForceStatus,
  type Language,
  type LegislationFormat,
  type NormalizedDocument,
} from "@swiss-legal-mcp/documents";

export class FedlexMappingError extends Error {}

export interface FedlexConsolidationVersion {
  readonly consolidationEli: string;
  readonly dateApplicability: string;
  readonly dateEndApplicability?: string;
}

export interface FedlexManifestationInfo {
  readonly format: LegislationFormat;
  readonly url: string;
}

/**
 * Datos ya resueltos (a partir de bindings SPARQL reales, ver vocabulary.ts
 * para el mapeo de vocabularios) necesarios para construir un
 * NormalizedDocument de tipo "legislation_law". El mapper es una funcion
 * pura: FedlexProvider es responsable de obtener estos valores via
 * FedlexSparqlClient antes de llamar aqui.
 */
export interface FedlexLawMappingInput {
  readonly workEli: string;
  readonly workTitle: string;
  readonly systematicNumber?: string;
  readonly consolidation: FedlexConsolidationVersion;
  readonly isHistorical: boolean;
  readonly language: Language;
  readonly entryIntoForceDate?: string;
  readonly repealDate?: string;
  readonly inForceStatus: InForceStatus;
  readonly officialCompilationReference?: string;
  readonly amendingActs?: readonly AmendingActReference[];
  readonly manifestation?: FedlexManifestationInfo;
  readonly structuredFormatAvailable: boolean;
  readonly fullText?: string;
  readonly retrievedAt: string;
  readonly rawMetadata?: Record<string, unknown>;
}

function expressionUrl(workEli: string, language: Language): string {
  return `${workEli}/${language}`;
}

function buildLegislationBlock(input: FedlexLawMappingInput) {
  return {
    eli: expressionUrl(input.consolidation.consolidationEli, input.language),
    ...(input.systematicNumber !== undefined ? { systematicNumber: input.systematicNumber } : {}),
    workTitle: input.workTitle,
    expressionLanguage: input.language,
    version: {
      date: input.consolidation.dateApplicability,
      ...(input.consolidation.dateEndApplicability !== undefined
        ? { endDate: input.consolidation.dateEndApplicability }
        : {}),
      isHistorical: input.isHistorical,
      structuredFormatAvailable: input.structuredFormatAvailable,
    },
    ...(input.manifestation !== undefined ? { manifestation: input.manifestation } : {}),
    inForceStatus: input.inForceStatus,
    ...(input.entryIntoForceDate !== undefined
      ? { entryIntoForceDate: input.entryIntoForceDate }
      : {}),
    ...(input.repealDate !== undefined ? { repealDate: input.repealDate } : {}),
    ...(input.officialCompilationReference !== undefined
      ? { officialCompilationReference: input.officialCompilationReference }
      : {}),
    ...(input.amendingActs !== undefined && input.amendingActs.length > 0
      ? { amendingActs: input.amendingActs }
      : {}),
  };
}

/** Mapea una norma completa (Fase 3: get_law) a NormalizedDocument (documentType "legislation_law"). */
export function mapFedlexLawToNormalizedDocument(input: FedlexLawMappingInput): NormalizedDocument {
  if (!input.workTitle.trim()) {
    throw new FedlexMappingError(
      "workTitle vacio: Fedlex no devolvio un titulo real para este acto.",
    );
  }

  const sourceUrl = `https://www.fedlex.admin.ch/eli/cc/${input.workEli.split("/eli/cc/")[1] ?? ""}/${input.language}`;
  const text = input.fullText;

  const raw = {
    id: `fedlex:${input.consolidation.consolidationEli}/${input.language}`,
    provider: "fedlex",
    documentType: "legislation_law" as const,
    jurisdiction: { level: "federal" as const },
    sourceOriginalId: expressionUrl(input.consolidation.consolidationEli, input.language),
    date: {
      ...(input.entryIntoForceDate !== undefined ? { inForceFrom: input.entryIntoForceDate } : {}),
      publicationDate: input.consolidation.dateApplicability,
    },
    language: input.language,
    title: input.workTitle,
    ...(text !== undefined ? { fullText: text } : {}),
    legislation: buildLegislationBlock(input),
    provenance: {
      sourceUrl,
      ...(input.manifestation !== undefined ? { downloadUrl: input.manifestation.url } : {}),
      officialSourceUrl: sourceUrl,
      retrievedAt: input.retrievedAt,
      contentHash: computeContentHash(
        text ?? expressionUrl(input.consolidation.consolidationEli, input.language),
      ),
      officialCharacter: "official" as const,
    },
    rawMetadata: input.rawMetadata ?? {},
    contentNature: "literal" as const,
  };

  return parseNormalizedDocument(raw);
}

export interface FedlexArticleMappingInput extends FedlexLawMappingInput {
  readonly articleNumber: string;
  readonly articleHeading?: string;
  readonly articleText: string;
}

/** Mapea un articulo concreto (Fase 3: get_article/get_article_at_date) a NormalizedDocument (documentType "legislation_article"). */
export function mapFedlexArticleToNormalizedDocument(
  input: FedlexArticleMappingInput,
): NormalizedDocument {
  if (!input.articleText.trim()) {
    throw new FedlexMappingError(
      `Texto vacio para el articulo '${input.articleNumber}': no se encontro contenido real.`,
    );
  }

  const sourceUrl = `https://www.fedlex.admin.ch/eli/cc/${input.workEli.split("/eli/cc/")[1] ?? ""}/${input.language}#art_${input.articleNumber}`;

  const raw = {
    id: `fedlex:${input.consolidation.consolidationEli}/${input.language}/art_${input.articleNumber}`,
    provider: "fedlex",
    documentType: "legislation_article" as const,
    jurisdiction: { level: "federal" as const },
    sourceOriginalId: `${expressionUrl(input.consolidation.consolidationEli, input.language)}#art_${input.articleNumber}`,
    date: {
      ...(input.entryIntoForceDate !== undefined ? { inForceFrom: input.entryIntoForceDate } : {}),
      publicationDate: input.consolidation.dateApplicability,
    },
    language: input.language,
    title: input.articleHeading
      ? `${input.workTitle} — Art. ${input.articleNumber} (${input.articleHeading})`
      : `${input.workTitle} — Art. ${input.articleNumber}`,
    fullText: input.articleText,
    legislation: {
      ...buildLegislationBlock(input),
      articleLocation: { articleNumber: input.articleNumber },
    },
    provenance: {
      sourceUrl,
      ...(input.manifestation !== undefined ? { downloadUrl: input.manifestation.url } : {}),
      officialSourceUrl: sourceUrl,
      retrievedAt: input.retrievedAt,
      contentHash: computeContentHash(input.articleText),
      officialCharacter: "official" as const,
    },
    rawMetadata: input.rawMetadata ?? {},
    contentNature: "literal" as const,
  };

  return parseNormalizedDocument(raw);
}
