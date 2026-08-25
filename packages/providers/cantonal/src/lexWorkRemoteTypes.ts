import { z } from "zod";

/**
 * Forma real de `GET /api/de/texts_of_law/lightweight_index?show_abrogated=false`
 * en la plataforma LexWork (verificado en vivo contra Berna, Fase 5 -- ver
 * docs/provider-contracts/cantonal-lexwork.md). La respuesta es un objeto
 * indexado por `systematic_category_id` (como string), cada valor un array
 * de entradas de ley.
 */
export const lexWorkTextOfLawEntrySchema = z.object({
  id: z.number().int(),
  systematic_number: z.string().min(1),
  systematic_category_id: z.number().int(),
  title: z.string().min(1),
  abrogated: z.boolean(),
  // Verificado en vivo: algunos cantones (ej. Luzern) tienen leyes
  // catalogadas sin documento estructurado digitalizado todavia --
  // `structured_document_id` es real pero puede venir `null`.
  structured_document_id: z.number().int().nullable(),
});
export type LexWorkTextOfLawEntry = z.infer<typeof lexWorkTextOfLawEntrySchema>;

export const lexWorkLightweightIndexSchema = z.record(
  z.string(),
  z.array(lexWorkTextOfLawEntrySchema),
);
export type LexWorkLightweightIndex = z.infer<typeof lexWorkLightweightIndexSchema>;

/**
 * Forma real de `GET /api/{lang}/texts_of_law/{numeroSistematico}/show_as_json`
 * (verificado en vivo contra Berna, ley 324.111, Fase 5 -- ver
 * docs/provider-contracts/cantonal-lexwork.md). `content` es un arbol
 * recursivo real (titulo -> articulo -> parrafo) con nodos `type: "article"`
 * que traen `number`/`text`/`html_content` por idioma -- confirma que la
 * granularidad de articulo es real, no una suposicion.
 */
export interface LexWorkContentNode {
  // Verificado en vivo: algunos nodos internos (ej. referencias a notas al
  // pie) traen `uid: null` -- real, no todos los nodos del arbol tienen un
  // identificador propio.
  readonly uid: string | null;
  readonly type: string;
  readonly number?: Record<string, string>;
  readonly text?: Record<string, string>;
  readonly html_content?: Record<string, string>;
  readonly children?: readonly LexWorkContentNode[];
}

export const lexWorkContentNodeSchema: z.ZodType<LexWorkContentNode> = z.lazy(() =>
  z.object({
    uid: z.string().nullable(),
    type: z.string(),
    number: z.record(z.string(), z.string()).optional(),
    text: z.record(z.string(), z.string()).optional(),
    html_content: z.record(z.string(), z.string()).optional(),
    children: z.array(lexWorkContentNodeSchema).optional(),
  }),
);

const lexWorkVersionSummarySchema = z.object({
  id: z.number().int(),
  version_dates_str: z.string(),
  structured_document_id: z.number().int(),
  title: z.string(),
  abbreviation: z.string().optional(),
});

const lexWorkSelectedVersionSchema = z.object({
  id: z.number().int(),
  structured_document_id: z.number().int(),
  version_dates_str: z.string(),
  json_content: z.object({
    document: z.object({
      header: z.record(z.string(), z.string()).optional(),
      content: lexWorkContentNodeSchema,
      footer: z.record(z.string(), z.string()).optional(),
    }),
  }),
  pdf_link_tol: z.string().optional(),
});

export const lexWorkShowAsJsonSchema = z.object({
  text_of_law: z.object({
    systematic_number: z.string(),
    title: z.string(),
    abbreviation: z.string().optional(),
    enactment: z.string().nullable().optional(),
    abrogated: z.boolean(),
    canonical_link: z.string().optional(),
    pdf_link: z.string().optional(),
    current_version: lexWorkVersionSummarySchema,
    selected_version: lexWorkSelectedVersionSchema,
    old_versions: z.array(lexWorkVersionSummarySchema),
    future_versions: z.array(lexWorkVersionSummarySchema),
  }),
});
export type LexWorkShowAsJson = z.infer<typeof lexWorkShowAsJsonSchema>;
