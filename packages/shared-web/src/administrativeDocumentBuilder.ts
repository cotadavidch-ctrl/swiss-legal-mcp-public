import {
  parseNormalizedDocument,
  type AdministrativeCircularMetadata,
  type ContentNature,
  type Jurisdiction,
  type Language,
  type NormalizedDocument,
} from "@swiss-legal-mcp/documents";

export interface AdministrativeCircularBuilderInput {
  readonly id: string;
  readonly provider: string;
  readonly authority: string;
  readonly sourceOriginalId: string;
  readonly title: string;
  readonly language?: Language;
  readonly jurisdiction: Jurisdiction;
  readonly fullText?: string;
  readonly summary?: string;
  readonly date?: {
    readonly decisionOrEnactment?: string;
    readonly inForceFrom?: string;
    readonly publicationDate?: string;
  };
  readonly administrativeCircular: AdministrativeCircularMetadata;
  readonly provenance: {
    readonly sourceUrl: string;
    readonly downloadUrl?: string;
    readonly retrievedAt: string;
    readonly contentHash: string;
  };
  readonly rawMetadata?: Record<string, unknown>;
}

/**
 * Normalizador compartido de "documentType: administrative_circular" para
 * SECO/BSV/ESTV (Fase 4) -- ver docs/data-model.md#extension-fase-4. Fija
 * las invariantes comunes a los tres proveedores para que ningun mapper
 * individual tenga que repetirlas:
 *
 * - `provenance.officialCharacter` siempre "official": las tres fuentes son
 *   sitios de primera parte de una autoridad federal, nunca un agregador.
 * - `contentNature` se deriva de la presencia de `fullText` (nunca se marca
 *   "literal" sin texto real adjunto, ver superRefine de NormalizedDocument).
 * - Construye el documento con `parseNormalizedDocument`, que re-valida todo
 *   el esquema Zod (incluido el bloque `administrativeCircular` requerido
 *   para este documentType) -- ningun proveedor puede saltarse la validacion.
 */
export function buildAdministrativeCircularDocument(
  input: AdministrativeCircularBuilderInput,
): NormalizedDocument {
  const contentNature: ContentNature = input.fullText ? "literal" : "summary";

  return parseNormalizedDocument({
    id: input.id,
    provider: input.provider,
    documentType: "administrative_circular",
    jurisdiction: input.jurisdiction,
    authority: input.authority,
    sourceOriginalId: input.sourceOriginalId,
    date: input.date ?? {},
    ...(input.language ? { language: input.language } : {}),
    title: input.title,
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.fullText ? { fullText: input.fullText } : {}),
    administrativeCircular: input.administrativeCircular,
    provenance: {
      sourceUrl: input.provenance.sourceUrl,
      ...(input.provenance.downloadUrl ? { downloadUrl: input.provenance.downloadUrl } : {}),
      officialSourceUrl: input.provenance.downloadUrl ?? input.provenance.sourceUrl,
      retrievedAt: input.provenance.retrievedAt,
      contentHash: input.provenance.contentHash,
      officialCharacter: "official",
    },
    rawMetadata: input.rawMetadata ?? {},
    contentNature,
  });
}
