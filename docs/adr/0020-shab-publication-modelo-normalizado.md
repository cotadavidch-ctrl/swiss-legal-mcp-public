# ADR 0020 — Bloque `shabPublication` en `NormalizedDocument`

## Estado

Aceptado e implementado (Fase 5, 2026-07-27).

## Contexto

`documentType: "shab_entry"` existía en el enum desde Fase 0/1, pero sin un bloque de metadatos dedicado (a diferencia de `legislation` y `administrativeCircular`). La auditoría en vivo de Fase 5 confirmó la forma real de una publicación del Schweizerisches Handelsamtsblatt (`GET /api/v1/publications`): metadatos estructurados por rúbrica (`meta.rubric`/`meta.subRubric`), estado (`PUBLISHED`/`CANCELLED`), y — crucialmente — que ciertas rúbricas (`KK`, quiebras/sucesiones) exponen datos personales reales de individuos (nombre, fecha de nacimiento, fecha de defunción, domicilio) en el campo `content.debtor`.

## Decisión

1. `shabPublicationMetadataSchema` (`packages/documents/src/normalizedDocument.ts`) modela: `publicationNumber`, `rubric`/`subRubric` (códigos reales de la fuente, nunca traducidos a una taxonomía inventada), `publicationState`, `editionNumber`, `expirationDate`, `affectedEntity` (opcional, con `type: "company"|"person"|"other"`), `registrationOffice`, `cantons`, `legalBasisText`, `relatedPublicationIds`. Obligatorio para `documentType: "shab_entry"` (superRefine, mismo patrón que `legislation`/`administrativeCircular`).
2. **`affectedEntity.type: "person"` es una señal de privacidad deliberada**, no solo un campo descriptivo: distingue el caso donde la publicación expone datos de un individuo real (verificado en la rúbrica `KK`) del caso donde expone datos de una empresa. Cualquier consumidor de este modelo debe tratar `type: "person"` con las mismas cautelas de privacidad documentadas en `docs/providers/shab.md`.
3. **`relatedPublicationIds` nunca se infiere** — solo se rellena si la fuente declara la relación de forma estructurada (`repeatedPublications`), nunca por similitud de título o proximidad de fecha, siguiendo el mismo principio ya establecido para `administrativeCircular.supersedesDocuments` (ADR 0015).
4. El modelo se implementó y probó (`mapShabPublicationToNormalizedDocument`, `packages/providers/shab/src/mapper.ts`) contra datos reales capturados en la auditoría (con datos personales redactados en el fixture, ver `tests/fixtures/shab/README.md`), **aunque `ShabProvider` nunca lo pueble en producción** (bloqueado por política de la fuente, ver ADR 0021) — el modelo queda listo para el día en que exista un canal de acceso autorizado.

## Consecuencias

- Si en el futuro aparece un canal de acceso autorizado a SHAB (p. ej. una extensión de Zefix, o un acuerdo directo con SECO), la normalización ya está implementada y probada; solo haría falta conectar `ShabProvider` a peticiones de red reales.
- Ningún otro proveedor de Fase 5 necesitó un nuevo bloque de metadatos: la legislación cantonal se modela con `documentType: "official_publication"` sin extender el esquema (ver ADR 0023).
