# ADR 0013 — Separación entre texto oficial literal y diferencias calculadas

## Estado

Aceptado e implementado (Fase 3, 2026-07-26).

## Contexto

`compare_article_versions` debe "preservar texto anterior y posterior" y "distinguir cambio literal de resumen generado", sin nunca presentar una comparación aproximada (p. ej. sobre HTML sin estructura) como si fuera exacta.

## Decisión

Se modela la comparación como un tipo separado de `NormalizedDocument`, en `packages/documents/src/articleComparison.ts` (`ArticleVersionComparison`), no como un documento más:

- `before`/`after` guardan el ELI, la fecha y el **texto literal completo** de cada versión (nunca un resumen).
- `changes` es una lista de `{kind: "added"|"removed"|"modified"|"unchanged", beforeText?, afterText?}` -- el cálculo del diff en sí.
- `comparisonNature: "literal" | "summary"` marca explícitamente si el diff proviene de una comparación estructural real (Akoma Ntoso, eId por eId) o de una aproximación.

En la implementación actual de Fase 3, `FedlexProvider.compareArticleVersions()` solo llega a construir el resultado si **ambas** versiones tienen manifestación XML real (si no, `getArticleInternal` ya lanzó `NotFoundError` antes, ver ADR 0012) -- por construcción, `comparisonNature` es siempre `"literal"` en esta fase; el valor `"summary"` queda modelado para cuando una fase futura implemente el adaptador HTML (ADR 0012) y permita comparar una versión con XML contra otra sin él.

## Consecuencias

- Separar este modelo de `NormalizedDocument` evita mezclar "documento de la fuente" con "cálculo derivado por el sistema" (principio de trazabilidad de `docs/data-model.md`), y deja sitio para un algoritmo de diff más fino (por `eId` de párrafo/letra) sin tocar el esquema de documento.
- El diff actual (`changes`) es de grano grueso: compara el texto completo del artículo como un único bloque (`modified`/`unchanged`), no párrafo por párrafo. Refinar esto a diffs por `eId` de párrafo/letra (ya localizables vía `akomaNtosoParser.ts`, ver `findNodeByEId`) queda como mejora natural de una fase futura, no como parte de esta implementación mínima verificada.
