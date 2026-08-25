import { z } from "zod";
import { languageSchema } from "./normalizedDocument.js";

/**
 * Modelo de comparacion entre dos versiones reales de un mismo articulo
 * (Fase 3, Fedlex). Deliberadamente separado de NormalizedDocument: una
 * comparacion no es un documento, es una relacion calculada entre dos
 * documentos. Ver docs/data-model.md.
 */

export const articleChangeKindSchema = z.enum(["added", "removed", "modified", "unchanged"]);
export type ArticleChangeKind = z.infer<typeof articleChangeKindSchema>;

export const articleTextChangeSchema = z.object({
  kind: articleChangeKindSchema,
  paragraph: z.string().min(1).optional(),
  letter: z.string().min(1).optional(),
  beforeText: z.string().min(1).optional(),
  afterText: z.string().min(1).optional(),
});
export type ArticleTextChange = z.infer<typeof articleTextChangeSchema>;

export const articleVersionRefSchema = z.object({
  eli: z.string().url(),
  date: z.iso.date(),
  text: z.string().min(1),
});
export type ArticleVersionRef = z.infer<typeof articleVersionRefSchema>;

export const articleVersionComparisonSchema = z.object({
  articleNumber: z.string().min(1),
  language: languageSchema,
  before: articleVersionRefSchema,
  after: articleVersionRefSchema,
  changes: z.array(articleTextChangeSchema),
  /**
   * "literal": los changes se derivaron de una comparacion estructural real
   * (Akoma Ntoso, eId por eId). "summary": al menos una de las dos versiones
   * carece de estructura fiable (p.ej. solo HTML/PDF historico sin XML) y
   * los changes son una aproximacion generada -- nunca se presenta como una
   * comparacion exacta en ese caso (ver hueco historico documentado en
   * docs/provider-contracts/fedlex.md).
   */
  comparisonNature: z.enum(["literal", "summary"]),
});
export type ArticleVersionComparison = z.infer<typeof articleVersionComparisonSchema>;

export function parseArticleVersionComparison(raw: unknown): ArticleVersionComparison {
  return articleVersionComparisonSchema.parse(raw);
}
