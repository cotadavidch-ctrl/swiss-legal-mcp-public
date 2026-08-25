# ADR 0012 — Akoma Ntoso obligatorio para extracción de artículo; sin adaptador HTML histórico

## Estado

Aceptado e implementado (Fase 3, 2026-07-26). Limitación deliberada, documentada explícitamente para la propuesta de Fase 4.

## Contexto

El encargo original de Fase 3 pedía: "si el histórico anterior a Akoma Ntoso requiere HTML, otro XML, u otra representación, crear un adaptador separado dentro de FedlexProvider y documentar la diferencia". La auditoría en vivo localizó el corte real y exacto para la Constitución federal: todas las Consolidations desde `2000-01-01` hasta `2020-01-01` inclusive solo tienen manifestaciones `doc`/`pdf-a` (sin XML ni HTML); la primera con Akoma Ntoso real es `2021-01-01` (ver `tests/fixtures/fedlex/akoma_ntoso_cutover_scan_constitution.json`). Este corte es un dato empírico de este acto concreto, no una fecha documentada por Fedlex ni necesariamente igual para otros actos.

## Decisión

**No se implementó un adaptador de extracción de texto sobre HTML/PDF histórico en esta fase.** En su lugar, `FedlexProvider.getArticleInternal()` verifica si la manifestación resuelta para la versión elegida es `xml`; si no lo es, lanza `NotFoundError` explícito indicando el hueco histórico real, en vez de:

- aproximar la extracción de artículo con regex sobre HTML (prohibido explícitamente por el encargo), o
- fingir estructura donde no existe.

`get_law` sí funciona para cualquier versión histórica (devuelve la manifestación disponible, sea cual sea su formato, vía `legislation.manifestation`), porque no requiere localizar un artículo dentro del documento. Solo `get_article`, `get_article_at_date` y `compare_article_versions` -- que necesitan granularidad de artículo -- están limitados por esta carencia.

## Consecuencias

- **Limitación real y activa**: para cualquier acto cuya cobertura XML no llegue tan atrás como la fecha solicitada, `get_article`/`get_article_at_date`/`compare_article_versions` fallan con `NotFoundError` en vez de devolver un resultado aproximado. Esto es preferible a un resultado incorrecto, pero reduce la cobertura práctica de estas tres herramientas al rango con XML real (variable por acto, no universal).
- **Propuesta explícita para Fase 4** (ver `IMPLEMENTATION_STATUS.md`): construir un adaptador HTML→texto estructurado (localizando artículos por ancla/heading en el HTML real de Fedlex, verificando primero su estructura en vivo igual que se hizo con Akoma Ntoso) para extender la cobertura histórica de estas tres herramientas. No se implementa ahora para no inventar una estructura HTML sin verificarla exhaustivamente primero, lo que habría requerido una nueva ronda completa de auditoría en vivo fuera del alcance de esta fase.
- Esta limitación se refleja honestamente en `ProviderCapabilities`: `getArticle`/`getArticleAtDate`/`compareVersions` se marcan `true` porque funcionan de verdad dentro del rango con XML, no `false` -- la limitación se comunica vía el mensaje de `NotFoundError`, no ocultando la capacidad que sí existe.
