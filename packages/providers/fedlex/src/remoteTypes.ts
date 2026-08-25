import { z } from "zod";

/**
 * Esquema generico de resultados SPARQL 1.1 JSON, verificado contra
 * respuestas reales del endpoint publico de Fedlex (ver
 * tests/fixtures/fedlex/*.json). No es una invencion: cada campo aqui
 * (`head.vars`, `results.bindings[].{type,value,datatype,xml:lang}`) se
 * observo tal cual en las capturas reales.
 */
export const sparqlBindingValueSchema = z.object({
  type: z.enum(["uri", "literal", "typed-literal", "bnode"]),
  value: z.string(),
  datatype: z.string().optional(),
  "xml:lang": z.string().optional(),
});
export type SparqlBindingValue = z.infer<typeof sparqlBindingValueSchema>;

export const sparqlJsonResultSchema = z.object({
  head: z.object({
    vars: z.array(z.string()),
    link: z.array(z.string()).optional(),
  }),
  results: z.object({
    distinct: z.boolean().optional(),
    ordered: z.boolean().optional(),
    bindings: z.array(z.record(z.string(), sparqlBindingValueSchema)),
  }),
});
export type SparqlJsonResult = z.infer<typeof sparqlJsonResultSchema>;

/**
 * Forma real de una respuesta a una consulta ASK, verificada en vivo:
 * `{ "head": { "link": [] }, "boolean": true }` -- deliberadamente distinta
 * de una respuesta SELECT (no tiene `results.bindings`, tiene `boolean`
 * directamente). Confundir ambas formas hace que la validacion Zod falle
 * (bug real encontrado y corregido durante la integracion en vivo de esta
 * fase: healthCheck() usaba ASK contra el schema de SELECT).
 */
export const sparqlAskResultSchema = z.object({
  head: z.object({ link: z.array(z.string()).optional() }),
  boolean: z.boolean(),
});
export type SparqlAskResult = z.infer<typeof sparqlAskResultSchema>;

/**
 * Convierte el resultado real de una consulta `SELECT ?p ?o WHERE { <iri> ?p ?o }`
 * (patron "describe" usado en toda la auditoria de Fase 3) en un mapa
 * predicado -> valores. Preserva multivaluacion real (p.ej. jolux:isRealizedBy
 * con 5 idiomas, jolux:publicationDate repetido).
 */
export function groupPredicateObjectBindings(
  result: SparqlJsonResult,
): Map<string, SparqlBindingValue[]> {
  const map = new Map<string, SparqlBindingValue[]>();
  for (const binding of result.results.bindings) {
    const predicate = binding["p"];
    const object = binding["o"];
    if (!predicate || !object) continue;
    const existing = map.get(predicate.value);
    if (existing) {
      existing.push(object);
    } else {
      map.set(predicate.value, [object]);
    }
  }
  return map;
}

/** Extrae los valores de una unica variable de proyeccion (p.ej. "work", "consolidation") en orden. */
export function extractColumn(result: SparqlJsonResult, variable: string): SparqlBindingValue[] {
  return result.results.bindings
    .map((binding) => binding[variable])
    .filter((value): value is SparqlBindingValue => value !== undefined);
}
