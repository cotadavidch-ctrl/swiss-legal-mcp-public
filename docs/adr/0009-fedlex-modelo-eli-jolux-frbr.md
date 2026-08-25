# ADR 0009 — Adopción del modelo FRBR/JOLux/ELI de Fedlex tal cual

## Estado

Aceptado e implementado (Fase 3, 2026-07-26).

## Contexto

Fedlex no documenta una API REST propia; el único punto de acceso estructurado verificado es un endpoint SPARQL público (`https://fedlex.data.admin.ch/sparqlendpoint`) que modela los datos con la ontología **JOLux** (`http://data.legilux.public.lu/resource/ontology/jolux#`), originalmente construida para el sistema legislativo de Luxemburgo. La auditoría en vivo de esta fase confirmó la cadena real Work (`jolux:ConsolidationAbstract`) → Consolidation fechada → Expression (idioma) → Manifestation (formato), con identificadores ELI (`eli/cc/...`, `eli/oc/...`) — ver `docs/provider-contracts/fedlex.md` para el detalle completo con evidencia.

## Decisión

`FedlexProvider` no inventa un modelo propio de "acto legislativo": adopta directamente la cadena FRBR/JOLux verificada, reflejada en `packages/documents/src/normalizedDocument.ts` (`LegislationMetadata`: `eli`, `systematicNumber`, `workTitle`, `expressionLanguage`, `version.{date,endDate,isHistorical,structuredFormatAvailable}`, `manifestation.{format,url}`). Ningún campo del bloque `legislation` se rellena con un valor inventado: si Fedlex no expone un dato (p. ej. referencia BBl/FF), el campo queda ausente (ver `docs/data-model.md`).

Consecuencias concretas de adoptar el modelo real en vez de uno propio simplificado:

1. **El RS/SR no es un identificador único a través del tiempo.** Confirmado con dos casos reales independientes (KVG 832.10 y Constitución 101, ver `docs/provider-contracts/fedlex.md`). `FedlexProvider.resolveWorkEli` lanza `AmbiguousCitationError` en vez de devolver silenciosamente el primer resultado.
2. **El título canónico vive en el Work (`ConsolidationAbstract`), no en la Consolidation fechada.** Verificado que las Consolidations históricas pueden tener un título de Expression genérico; el mapeador (`mapper.ts`) siempre usa el título a nivel de Work.
3. **El año en la URI ELI no es el año real de promulgación** (p. ej. RS 220 = `eli/cc/27/...`, no `eli/cc/1911/...`). El código nunca deriva una fecha a partir del ELI; siempre usa las propiedades de fecha explícitas (`jolux:dateEntryInForce`, `jolux:dateApplicability`, etc.).

## Consecuencias

- Cualquier futuro proveedor cantonal que también use JOLux (algunos cantones publican en Fedlex/plataformas compartidas) podría reutilizar `vocabulary.ts` y el patrón de mapeo; los que no usen JOLux necesitarán su propio módulo de vocabulario, registrado en el mismo `LegislationProviderRegistry` (ver ADR 0014).
- Como el modelo de datos de Fedlex es externo y no está formalmente versionado en un changelog público, un cambio futuro en JOLux podría romper `vocabulary.ts` (que lanza `FedlexVocabularyError` ante un código no reconocido en vez de adivinar) — esto es deliberado: preferir un fallo explícito y visible a una inferencia silenciosa incorrecta.
