# ADR 0023 — Legislación cantonal usa `documentType: "official_publication"`, no extiende el bloque `legislation`

## Estado

Aceptado e implementado (Fase 5, 2026-07-27).

## Contexto

`legislationMetadataSchema` (Fase 3, ver ADR 0009) modela la cadena FRBR/JOLux real de Fedlex, con `eli: z.string().url()` como campo **obligatorio** — una URL ELI (European Legislation Identifier) real, verificada en cada acto federal consultado. Ni la plataforma LexWork (Berna) ni ZH-Lex (Zúrich) exponen un identificador equivalente a un ELI: LexWork usa un `systematic_number` propio del cantón (p. ej. "324.111"), y ZH-Lex usa una "Ordnungsnummer" (p. ej. "131.1") combinada con fechas de vigencia en la URL — ninguno de los dos es una URL ELI real ni admite construir una de forma no inventada.

La instrucción explícita de Fase 5 fue: "Extiende el modelo únicamente cuando sea necesario... No modifiques el modelo si la información puede representarse correctamente con los tipos existentes."

## Decisión

1. `CantonalLexWorkProvider` y `CantonalZhProvider` normalizan sus documentos con `documentType: "official_publication"` (tipo genérico ya existente desde Fase 0/1, sin bloque de metadatos obligatorio) — **no** con `documentType: "legislation_law"`/`"legislation_article"`, y por tanto **no** rellenan el bloque `legislation`.
2. El número sistemático/Ordnungsnummer, el estado de derogación (`abrogated`), las fechas de vigencia y el identificador interno de la plataforma se preservan en `rawMetadata` (campo ya existente, sin `superRefine`, pensado exactamente para datos específicos de fuente que no encajan en un bloque estructurado) — no se inventa un valor de `eli` falso ni se relaja la obligatoriedad real de `eli` para actos federales, que sigue reflejando una invariante verificada de Fedlex.
3. Se descartó explícitamente la alternativa de hacer `eli` opcional en `legislationMetadataSchema` para "encajar" la legislación cantonal: eso habría debilitado una garantía real y verificada del modelo federal (todo acto de Fedlex consultado en Fase 3 tiene un ELI real) solo para acomodar una fuente cantonal que genuinamente no tiene ese concepto — exactamente el tipo de modificación de modelo que la instrucción de Fase 5 pide evitar.

## Consecuencias

- `search_cantonal_legislation`/`get_cantonal_law` devuelven `NormalizedDocument` con `documentType: "official_publication"`, `jurisdiction: { level: "cantonal", canton: "BE"|"ZH" }`, y los identificadores reales en `rawMetadata` — consultable y normalizado, pero sin la riqueza estructurada (versión FRBR, estado `inForceStatus`, historial de enmiendas) que sí tiene la legislación federal de Fedlex.
- Si en el futuro un cantón expusiera un identificador verdaderamente equivalente a un ELI (poco probable dado que ELI es una convención europea, no suiza-cantonal), la decisión debería revisarse caso por caso, no aplicarse por defecto a todos los cantones.
- Cualquier futuro adaptador cantonal adicional debe seguir el mismo patrón (`official_publication` + `rawMetadata`) salvo que audite y confirme una estructura genuinamente distinta que justifique un nuevo bloque de metadatos — no extender `legislation` por conveniencia.
