import { z } from "zod";

/**
 * Esquemas Zod del contrato REAL observado del servidor MCP remoto (ver
 * docs/provider-contracts/entscheidsuche.md). Toda respuesta remota se valida
 * contra estos esquemas antes de usarse -- nunca se confia ciegamente en un
 * servidor de terceros, aunque sea publico y sin autenticacion.
 */

export const remoteSearchHitSchema = z.object({
  id: z.string().min(1),
  title: z.string().default(""),
  abstract: z.string().default(""),
  text: z.string().default(""),
  meta: z.string().default(""),
  canton: z.string().default(""),
  court: z.string().default(""),
  decision_date: z.string().nullable().optional(),
  scrape_date: z.string().nullable().optional(),
  is_pdf: z.boolean().default(false),
  document_url: z.string().nullable().optional(),
  original_url: z.string().nullable().optional(),
  sort: z.array(z.unknown()).nullable().optional(),
});
export type RemoteSearchHit = z.infer<typeof remoteSearchHitSchema>;

export const remoteAggregationBucketSchema = z.object({
  key: z.union([z.string(), z.number()]),
  count: z.number().int(),
});

export const remoteSearchResponseSchema = z.object({
  total: z.number().int(),
  hits: z.array(remoteSearchHitSchema),
  next_cursor: z.array(z.unknown()).nullable().optional(),
  aggregations: z.record(z.string(), z.array(remoteAggregationBucketSchema)).nullable().optional(),
});
export type RemoteSearchResponse = z.infer<typeof remoteSearchResponseSchema>;

export const remoteFetchDocumentResponseSchema = z.object({
  result: remoteSearchHitSchema.nullable(),
});
export type RemoteFetchDocumentResponse = z.infer<typeof remoteFetchDocumentResponseSchema>;

export const remoteHierarchyEntrySchema = z.object({
  id: z.string().min(1),
  count: z.number().int(),
});
export const remoteHierarchyResponseSchema = z.object({
  entries: z.array(remoteHierarchyEntrySchema),
});
export type RemoteHierarchyResponse = z.infer<typeof remoteHierarchyResponseSchema>;

export interface RemoteFacetNode {
  readonly id: string;
  readonly label: {
    readonly de?: string | null;
    readonly fr?: string | null;
    readonly it?: string | null;
    readonly en?: string | null;
  };
  readonly children: readonly RemoteFacetNode[];
}

export const remoteFacetNodeSchema: z.ZodType<RemoteFacetNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    label: z.object({
      de: z.string().nullable().optional(),
      fr: z.string().nullable().optional(),
      it: z.string().nullable().optional(),
      en: z.string().nullable().optional(),
    }),
    children: z.array(remoteFacetNodeSchema),
  }),
);
export const remoteFacetsResponseSchema = z.object({
  result: z.array(remoteFacetNodeSchema),
});
export type RemoteFacetsResponse = z.infer<typeof remoteFacetsResponseSchema>;

/** server_info no tiene esquema fijo remoto (additionalProperties: true). */
export const remoteServerInfoSchema = z.record(z.string(), z.unknown());
export type RemoteServerInfo = z.infer<typeof remoteServerInfoSchema>;
