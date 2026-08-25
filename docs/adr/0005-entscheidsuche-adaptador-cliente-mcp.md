# ADR 0005 — entscheidsuche.ch se integra como adaptador cliente MCP, no como scraper ni API REST

## Estado

Aceptado (Fase 0/1, 2026-07-26). **Implementado en Fase 2 (2026-07-26)** — `packages/providers/entscheidsuche/src/entscheidsucheProvider.ts`, probado con fixtures reales y con conexión real (`RUN_LIVE_INTEGRATION_TESTS=true`).

## Contexto

La auditoría de Fase 0 (`docs/source-audit.md`) encontró que `entscheidsuche.ch` —un agregador no oficial (asociación sin ánimo de lucro, no gubernamental) de jurisprudencia federal y cantonal suiza— ya opera un servidor MCP público sin autenticación en `https://mcp.entscheidsuche.ch/mcp`, con herramientas `search`, `search_by_case_number`, `fetch_document`, `list_hierarchy`, `list_facets`, `server_info`. Esto se verificó de forma independiente (WebFetch directo al repositorio `entscheidsuche/entscheidsuche-mcp`), no solo por el informe del agente de investigación.

## Decisión

Cuando se implemente en Fase 2, el proveedor de jurisprudencia contra esta fuente se llamará `EntscheidsucheMcpProvider` y se integrará como un **adaptador cliente MCP** (usando el `Client` del SDK oficial de MCP para hablar contra `https://mcp.entscheidsuche.ch/mcp`), no mediante scraping HTML directo de tribunales ni mediante una API REST inventada para esta fuente.

Reglas vinculantes para esa implementación futura:

- Se documenta siempre como **agregador jurisprudencial no oficial**.
- Actúa como **proveedor primario de descubrimiento y recuperación** (búsqueda y obtención de documentos), nunca como sustituto de la fuente oficial del tribunal cuando se pueda resolver su URL directa.
- Su cobertura **no se describe como garantizada ni exhaustiva** de los 26 cantones.
- Todo resultado que provenga de él debe adjuntar `UnofficialSourceWarning` (ver `packages/core/src/errors.ts`) y marcar `provenance.officialCharacter: "unofficial_aggregator"` con `aggregatorName: "entscheidsuche.ch"` (ver `packages/documents/src/normalizedDocument.ts`).

## Consecuencias

- No se ha escrito código de este proveedor en Fase 1 (correctamente, según el alcance de la fase). Este ADR fija la decisión arquitectónica para cuando se aborde en Fase 2, evitando reabrir el debate "scraper vs. API vs. cliente MCP".
- El PDF de documentación de API de entscheidsuche.ch no pudo leerse automáticamente (contenido comprimido); antes de implementar Fase 2 hay que revisarlo manualmente para confirmar límites de frecuencia y términos de uso exactos del servidor MCP.

## Actualización — Fase 2 (implementación real)

Todo lo anterior se confirmó cierto contra el servidor real (ver `docs/provider-contracts/entscheidsuche.md` para el contrato exacto observado). Hallazgos adicionales relevantes para esta decisión:

- `search_by_case_number` **no es un lookup exacto**: es una búsqueda de frase entre comillas sobre el mismo índice que `search`. Esto refuerza la necesidad de tratarlo como "descubrimiento", nunca como fuente de verdad de una cita concreta.
- En el 100% de los documentos observados (federal y cantonal, DE/FR/IT), `original_url` fue `null` — es decir, en la práctica esta fuente **casi nunca** aporta una URL oficial verificable; el aviso de "nunca sustituye la fuente oficial" no es solo cautela teórica, es la situación real.
- El PDF de documentación de API mencionado arriba se dejó sin revisar manualmente (limitación conocida, ver `IMPLEMENTATION_STATUS.md`); la implementación se basó en la observación directa del contrato real (`tools/list` + llamadas reales), que resultó suficiente y más fiable que cualquier documentación estática.
