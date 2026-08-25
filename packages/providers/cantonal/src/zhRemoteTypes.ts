import { z } from "zod";

/**
 * Forma real del servlet JSON de busqueda de ZH-Lex (descubierto por
 * inspeccion de red sobre el formulario real del portal, Fase 5B):
 * `GET /.../lawcollectionsearch_312548694.zhweb-zhlex-ls.zhweb-cache.json`
 * con parametros reales `referenceNumber` (numero sistematico, coincidencia
 * exacta verificada) y `enactmentTitle` (subcadena de titulo, verificado
 * contra "Gemeindegesetz"; otros nombres de parametro probados --
 * `keyword`/`query`/`searchText`/`text`/`q` -- fueron ignorados por el
 * servidor real). La variante `.zhweb-zhlex-os.` (Offizielle
 * Gesetzessammlung, historico cronologico) devuelve un `data[]` con forma
 * similar pero `entryIntoForceDate` en vez de `withdrawalDate` -- no se usa
 * aqui (el proveedor solo cubre la Loseblattsammlung/ley vigente).
 */
export const zhSearchResultEntrySchema = z.object({
  link: z.string().min(1),
  referenceNumber: z.string().min(1),
  enactmentTitle: z.string(),
  enactmentDate: z.string(),
  withdrawalDate: z.string().optional(),
});
export type ZhSearchResultEntry = z.infer<typeof zhSearchResultEntrySchema>;

export const zhSearchResponseSchema = z.object({
  data: z.array(zhSearchResultEntrySchema),
  numberOfResults: z.number().int(),
  numberOfResultPages: z.number().int(),
  moreSearchResultsThanAllowed: z.boolean(),
});
export type ZhSearchResponse = z.infer<typeof zhSearchResponseSchema>;
