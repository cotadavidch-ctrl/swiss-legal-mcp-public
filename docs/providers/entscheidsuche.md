# Proveedor: entscheidsuche.ch (`EntscheidsucheMcpProvider`)

Estado: implementado en Fase 2 (jurisprudencia). Ver [`docs/provider-contracts/entscheidsuche.md`](../provider-contracts/entscheidsuche.md) para el contrato técnico exacto (esquemas, límites, errores) y [`docs/adr/0005-entscheidsuche-adaptador-cliente-mcp.md`](../adr/0005-entscheidsuche-adaptador-cliente-mcp.md) para la decisión arquitectónica original.

## Qué es

`entscheidsuche.ch` es un motor de búsqueda de jurisprudencia suiza mantenido por una asociación sin ánimo de lucro (no gubernamental, ver `docs/source-audit.md`). Opera un servidor MCP público en `https://mcp.entscheidsuche.ch/mcp` (Streamable HTTP, sin autenticación), verificado en vivo el 2026-07-26 (`serverInfo.name: "entscheidsuche"`, `version: "1.27.0"` en el handshake `initialize`; la herramienta interna `server_info` reporta además `"entscheidsuche-mcp" version "0.1.1"` — dos números de versión distintos para el mismo despliegue, documentado tal cual sin intentar reconciliarlos).

**Es siempre un agregador no oficial.** Todo lo que devuelve debe presentarse con esa advertencia (`UnofficialSourceWarning`, ver `packages/core/src/errors.ts`), independientemente de que el contenido en sí (una sentencia) sea una obra oficial de dominio público.

## Cómo se integra

`EntscheidsucheMcpProvider` (`packages/providers/entscheidsuche/`) es un **cliente MCP real**: usa el `Client` del SDK oficial de Model Context Protocol conectado vía `StreamableHTTPClientTransport` contra el endpoint remoto. No hace scraping HTML ni inventa una API REST — llama exactamente a las seis herramientas que el servidor remoto expone (`search`, `search_by_case_number`, `fetch_document`, `list_hierarchy`, `list_facets`, `server_info`), documentadas en el contrato técnico.

## Principios operativos

1. **Nunca sustituye la fuente oficial.** El `document_url` que devuelve el servidor apunta casi siempre al espejo propio de entscheidsuche.ch (`entscheidsuche.ch/docs/...`), no al dominio del tribunal. En la auditoría en vivo de esta fase, `original_url` fue `null` en el 100% de los casos observados (federal y cantonal, en los tres idiomas) — no hay ningún ejemplo confirmado de URL oficial del tribunal devuelta por este servidor. `OfficialSourceResolver` (ver más abajo) solo actúa cuando ese campo trae un valor no nulo; con los datos observados hasta ahora, eso será raro o inexistente en la práctica. Esto se documenta explícitamente para no prometer una capacidad que los datos reales no respaldan.
2. **Cobertura no garantizada ni exhaustiva.** `list_facets` devuelve 28 entradas de nivel superior (CH + 26 cantones + un código "TA" sin descripción localizada) pero **todas con `children: []`** en la respuesta real — pese a que la descripción de la herramienta promete un "árbol jerárquico" de tribunales y salas, el despliegue actual no lo entrega. Se documenta como limitación real del servidor, no se simula la jerarquía que falta.
3. **`search_by_case_number` no es una búsqueda exacta.** Es una búsqueda de frase entre comillas sobre el mismo índice de texto completo que `search`; buscar `"BGE 142 III 1"` devolvió 172 resultados reales (cualquier sentencia que cite esa referencia en su texto), no solo la sentencia en sí. El proveedor debe tratar el primer resultado como "más relevante", nunca como "la única coincidencia", y advertir de la ambigüedad cuando corresponda (`AmbiguousCitationError`).
4. **El idioma de un documento no viene declarado.** El esquema `SearchHit` del servidor remoto no tiene un campo de idioma. Se verificó pidiendo el mismo documento (`CH_BGE_005_BGE-142-III-1_2016`) con `language: "de"` y `language: "fr"`: el `text` devuelto es **idéntico byte a byte** en ambos casos (el documento real está en alemán); solo cambia la traducción del `title` generado por el servidor. Por eso `NormalizedDocument.language` es opcional para este proveedor (ver `docs/data-model.md`) y solo se rellena cuando la búsqueda se hizo con un `language_filter` de un único idioma (que sí demostró filtrar resultados distintos en las pruebas en vivo) — y se marca en `rawMetadata` como inferido del filtro aplicado, no como un dato leído del documento.
5. **No hay extracción de citas en esta fase.** El servidor no expone artículos ni sentencias citadas de forma estructurada; `articlesCited`/`decisionsCited` quedan ausentes. Eso pertenece a `packages/citations` (Fase 7), no a este proveedor.

## Herramientas MCP activadas en Fase 2

Solo estas cuatro, sobre las seis capacidades del proveedor:

- `search_cases` → `EntscheidsucheMcpProvider.searchCases()` → tool remota `search`
- `get_case` → `EntscheidsucheMcpProvider.fetchDocument()` → tool remota `fetch_document`
- `get_case_metadata` → igual que `get_case` pero sin forzar la carga de texto completo cuando el proveedor lo permite (ver contrato técnico: en la práctica, para obtener metadatos fiables de un documento concreto hay que llamar a `fetch_document`, ya que `search` no garantiza devolver un único documento por id)
- `search_cases_by_reference` → `EntscheidsucheMcpProvider.searchByCaseNumber()` → tool remota `search_by_case_number`

`compare_cases`, `search_cases_by_article`, `extract_case_passages`, `find_supporting_cases`, `find_adverse_cases`, `build_case_line` y `verify_case_quote` permanecen desactivadas (ver `docs/tool-catalog.md`).

## Resiliencia

Timeout configurable, reintentos con backoff exponencial + jitter solo para errores transitorios (timeout del cliente MCP, `ConnectionClosed`, y códigos HTTP 429/502/503/504 del transporte), circuit breaker simple (cerrado → abierto tras N fallos consecutivos → semiabierto tras un enfriamiento), caché en memoria con TTL configurable por tipo de dato (`server_info`, `list_hierarchy`, `list_facets`, documentos individuales) que nunca cachea errores. Detalle exacto en el contrato técnico y en `docs/adr/0007-entscheidsuche-resiliencia-cache.md`.
