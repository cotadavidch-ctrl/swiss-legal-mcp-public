# ADR 0014 — Matriz `ProviderCapabilities` y `LegislationProviderRegistry` separado

## Estado

Aceptado e implementado (Fase 3, 2026-07-26).

## Contexto

El encargo exige una matriz `ProviderCapabilities` explícita (mínimo: `fullTextSearch`, `searchByTitle`, `searchByAbbreviation`, `searchBySystematicNumber`, `searchByEli`, `getCurrentVersion`, `getHistoricalVersion`, `compareVersions`, `getArticle`, `getArticleAtDate`, `amendmentHistory`, `transitionalProvisions`, `entryIntoForce`, `repealInformation`, `multilingual`, `rdf`, `xml`, `akomaNtoso`, `html`, `pdf`), y un registro preparado para proveedores cantonales futuros sin implementarlos aún.

## Decisión

1. **`ProviderCapabilities`** vive en `packages/core/src/legislationProvider.ts`, no en `packages/providers/fedlex`, porque es el contrato que cualquier proveedor de legislación (incluidos los cantonales futuros) debe declarar. `FEDLEX_CAPABILITIES` (en `fedlexProvider.ts`) es la instancia concreta de Fedlex, con cada campo justificado por evidencia real (ver comentarios en el código y `docs/provider-contracts/fedlex.md`):
   - `searchByAbbreviation: false` y `transitionalProvisions: false` -- sin verificar/implementar en esta fase, documentado como tal, no como "false" arbitrario.
   - `amendmentHistory: true` pero con la limitación real de que `amendingActs` queda siempre vacío (ver `getAmendmentHistory`) -- Fedlex no expone un predicado que vincule una Consolidation con el acto que la modificó.
2. **`LegislationProviderRegistry`** (mismo archivo) es una clase hermana de `ProviderRegistry` (`packages/core/src/provider.ts`, pensada para jurisprudencia), no una extensión de la misma. Se decidió separarlas porque `LegislationProvider` necesita métodos que `LegalSourceProvider` no modela bien (`getArticleAtDate`, `compareArticleVersions`, `getAmendmentHistory` no encajan en `getDocument(id)`).
3. **`ToolRegistry`** (`packages/core/src/toolRegistry.ts`) se extendió para aceptar un `LegislationProviderRegistry` opcional como segundo argumento del constructor, y `ToolContext.legislationProviders` es opcional: las fases anteriores (jurisprudencia) no necesitan tocar este campo, y `activation()` comprueba `requiredProviderIds` contra ambos registros (`providers.info(id) ?? legislationProviders?.info(id)`).

## Consecuencias

- Un futuro proveedor cantonal de legislación se registra en el mismo `LegislationProviderRegistry` sin tocar `FedlexProvider`, `search_legislation`, ni el resto de las 6 herramientas -- estas ya reciben `context.legislationProviders` de forma genérica (`apps/mcp-server/src/tools/fedlexTools.ts`). Lo que sí requerirá trabajo futuro es una herramienta de "buscar en todos los proveedores de legislación disponibles" si se quiere una vista unificada federal+cantonal; en Fase 3, `search_legislation` solo consulta `fedlex` (hardcoded en `getFedlexProvider`).
- Si un futuro proveedor de legislación no usa JOLux ni SPARQL, deberá implementar su propio cliente/mapper, pero puede reutilizar `packages/core/src/legislationProvider.ts` (la interfaz) y `packages/documents/src/normalizedDocument.ts` (el bloque `legislation`) sin cambios.
