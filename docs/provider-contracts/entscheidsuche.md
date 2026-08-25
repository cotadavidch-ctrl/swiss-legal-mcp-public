# Contrato técnico — MCP remoto de entscheidsuche.ch

Verificado en vivo el 2026-07-26 contra `https://mcp.entscheidsuche.ch/mcp` (Streamable HTTP, JSON-RPC 2.0, sin autenticación, sin `Mcp-Session-Id` observado — el servidor no exige sesión). Todas las capturas crudas están en [`tests/fixtures/entscheidsuche/`](../../tests/fixtures/entscheidsuche/). Handshake: `initialize` → `notifications/initialized` → `tools/list` / `tools/call`, protocolVersion `2025-06-18` aceptado.

`serverInfo` del handshake: `{"name": "entscheidsuche", "version": "1.27.0"}`. La tool `server_info` reporta por separado `{"name": "entscheidsuche-mcp", "version": "0.1.1"}` — dos identificadores de versión distintos coexisten; no se ha intentado reconciliarlos, se documentan ambos tal cual.

## Herramientas expuestas (`tools/list`, verificado)

Exactamente seis, ni una más: `search`, `search_by_case_number`, `fetch_document`, `list_hierarchy`, `list_facets`, `server_info`.

### `search`

**Entrada** (`searchArguments`, todos opcionales salvo ninguno — `query` tiene default `"*"`):

| Campo                                     | Tipo                                | Default       | Notas verificadas                                                                                                                                                               |
| ----------------------------------------- | ----------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query`                                   | string                              | `"*"`         | Lucene: `"frase exacta"`, `AND`/`OR`/`NOT`, `*`/`?` wildcards. `"*"` matchea todo.                                                                                              |
| `language`                                | `"de"\|"fr"\|"it"\|null`            | `null`        | Solo afecta idioma de highlight/título mostrado — **no filtra**.                                                                                                                |
| `sort`                                    | `"relevance"\|"date"\|"scrapedate"` | `"relevance"` | Verificado con `sort:"date"`.                                                                                                                                                   |
| `size`                                    | integer 1–100                       | `20`          | `size:99999` → error de validación (ver abajo).                                                                                                                                 |
| `search_after`                            | array \| null                       | `null`        | Cursor de paginación, tomar de `next_cursor` de la respuesta previa.                                                                                                            |
| `decision_date_from` / `decision_date_to` | string `YYYY-MM-DD` \| null         | `null`        | Inclusive.                                                                                                                                                                      |
| `scrape_date_from` / `scrape_date_to`     | string `YYYY-MM-DD` \| null         | `null`        | Fecha en que entscheidsuche.ch indexó el documento, no la fecha de la sentencia.                                                                                                |
| `hierarchy`                               | string[] \| null                    | `null`        | IDs de `list_hierarchy`/`list_facets` (p.ej. `"CH_BGer"`, `"VD_TC"`). Varias IDs = OR; con otros filtros = AND.                                                                 |
| `language_filter`                         | `("de"\|"fr"\|"it")[]` \| null      | `null`        | **Sí filtra** (verificado: `language_filter:["fr"]` y `["de"]` devuelven conjuntos de resultados distintos), pero el idioma resultante no se expone como campo en la respuesta. |
| `include_aggregations`                    | boolean                             | `false`       | Verificado: agrega un histograma trimestral de `decision_date`.                                                                                                                 |

**Salida** (`SearchResponse`):

```
{
  total: integer,
  hits: SearchHit[],
  next_cursor: array | null,   // null cuando no hay más paginas
  aggregations: { [clave]: { key: string|number, count: integer }[] } | null
}
```

`SearchHit` (único campo requerido: `id`):

| Campo           | Tipo                        | Default | Notas verificadas                                                                                                                                                                                                                                                                                                                                        |
| --------------- | --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | string                      | —       | Identificador estable, p. ej. `CH_BGE_005_BGE-142-III-1_2016`, `VD_TC_031_EF-2020-0001_2020-10-29`.                                                                                                                                                                                                                                                      |
| `title`         | string                      | `""`    | Generado por el servidor; varía de traducción según `language` (no según el idioma real del documento).                                                                                                                                                                                                                                                  |
| `abstract`      | string                      | `""`    | Para BGE/ATF suele ser el "Regeste" oficial (resumen jurídico real, no inventado). Puede contener marcado `<em>...</em>` de resaltado.                                                                                                                                                                                                                   |
| `text`          | string                      | `""`    | En `search`/`search_by_case_number`: **extracto** con resaltado (`<em>` alrededor de términos coincidentes). En `fetch_document`: **texto íntegro** (verificado: ~15.9k–84k caracteres reales, sin truncar). El esquema remoto no distingue ambos casos con un tipo distinto — hay que saber, por el nombre de la tool que se llamó, cuál de los dos es. |
| `meta`          | string                      | `""`    | Texto libre adicional (p. ej. sala/cámara).                                                                                                                                                                                                                                                                                                              |
| `canton`        | string                      | `""`    | Código de 2 letras (`ZH`, `VD`, `TI`...) o `"CH"` para federal.                                                                                                                                                                                                                                                                                          |
| `court`         | string                      | `""`    | Código derivado del `id` (p. ej. `CH_BGer`, `VD_TC`, `TI_TRAC`).                                                                                                                                                                                                                                                                                         |
| `decision_date` | string `YYYY-MM-DD` \| null | `null`  | A veces solo año (`"2017-01-01"` para una BGE registrada solo por año).                                                                                                                                                                                                                                                                                  |
| `scrape_date`   | string `YYYY-MM-DD` \| null | `null`  | Fecha de indexación por entscheidsuche.ch, no de la sentencia.                                                                                                                                                                                                                                                                                           |
| `is_pdf`        | boolean                     | `false` | —                                                                                                                                                                                                                                                                                                                                                        |
| `document_url`  | string \| null              | `null`  | **Casi siempre** un enlace a `entscheidsuche.ch/docs/...` (PDF o HTML) — el espejo propio del agregador, no la fuente oficial.                                                                                                                                                                                                                           |
| `original_url`  | string \| null              | `null`  | Pensado para la URL de la página oficial de origen. **En 100% de los casos observados en esta auditoría (federal y cantonal, los tres idiomas) fue `null`.** No asumir que existirá.                                                                                                                                                                     |
| `sort`          | array \| null               | `null`  | Valores de ordenación internos, se reenvían tal cual como `search_after` de la página siguiente.                                                                                                                                                                                                                                                         |

Sin resultados: `{"total": 0, "hits": [], "next_cursor": null, "aggregations": null}`, `isError: false`, HTTP 200. No es un error.

### `search_by_case_number`

Mismos parámetros que `search` salvo que sustituye `query` por `case_number` (string, requerido, p. ej. `"BGE 142 III 1"` o `"5A_396/2015"`). Internamente pone `case_number` entre comillas y ejecuta una búsqueda de frase exacta sobre el mismo índice — **no** es un lookup por clave única. Verificado: `case_number: "BGE 142 III 1"` devolvió `total: 172` (toda sentencia que mencione esa referencia), con la sentencia exacta como primer resultado (mejor relevancia), no como resultado único. Salida: idéntica `SearchResponse` que `search`.

### `fetch_document`

**Entrada**: `{ id: string (requerido), language?: "de"|"fr"|"it"|null }`. `language` **no cambia el contenido devuelto** (verificado: mismo documento pedido en `de` y `fr` → `text` idéntico byte a byte, solo cambia el `title` traducido).

**Salida**: `{ result: SearchHit | null }`. Cuando `id` no existe: `{"result": null}`, **`isError: false`, HTTP 200** — no lanza ni un error de protocolo ni `isError: true`. El proveedor debe interpretar `result === null` como "no encontrado" y traducirlo a `NotFoundError` en nuestra capa, porque el servidor remoto no lo hace.

Cuando existe: mismo `SearchHit`, pero con `text` = **texto íntegro** del documento (no un extracto).

### `list_hierarchy`

**Entrada**: `{ query?: string = "*", size?: integer 1–10000 = 1000 }`.
**Salida**: `{ entries: { id: string, count: integer }[] }`. Verificado con `size: 50`: entradas planas tipo `"CH"` (322141), `"CH_BGer"` (177259), `"VD_TC"` (91083), etc. — IDs cortos sin jerarquía explícita en la propia lista (el anidamiento se infiere del prefijo del id, p. ej. `VD_TC_031` empieza por `VD_TC`).

### `list_facets`

**Entrada**: ninguna (`{}`).
**Salida**: `{ result: FacetNode[] }` donde `FacetNode = { id: string, label: { de: string, fr: string, it: string, en: string|null }, children: FacetNode[] }`. Verificado: 28 nodos de nivel superior (`CH` + los 26 cantones + un código `"TA"` sin más contexto), **todos con `children: []`** en el despliegue real — pese a que la descripción de la herramienta promete un árbol jerárquico de tribunales/salas, esta instancia no lo entrega. `label.en` es siempre `null` en los datos observados (no hay traducción al inglés).

### `server_info`

**Entrada**: ninguna. **Salida**: diccionario libre (`additionalProperties: true`, sin esquema fijo). Verificado en vivo:

```json
{
  "name": "entscheidsuche-mcp",
  "version": "0.1.1",
  "elasticsearch_url": "https://entscheidsuche.pansoft.de:9200/entscheidsuche.v2-*/_search",
  "facets_url": "https://entscheidsuche.ch/docs/Facetten.json",
  "languages": ["de", "fr", "it"],
  "sort_orders": ["relevance", "date", "scrapedate"]
}
```

Nota de seguridad: expone la URL interna de su clúster Elasticsearch (`entscheidsuche.pansoft.de:9200`). No la usamos ni la exponemos como si fuera un endpoint soportado por nosotros; se cachea igual que el resto de `server_info` pero no se construye ninguna funcionalidad que dependa de ella.

## Errores observados (todos HTTP 200 — nunca hay error de transporte por validación de aplicación)

| Caso                                     | Resultado real                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parámetro fuera de rango (`size: 99999`) | `CallToolResult.isError: true`, `content[0].text` = mensaje de validación Pydantic ("Input should be less than or equal to 100 ..."). No reintentar (es un error de validación, no transitorio). |
| Nombre de herramienta inexistente        | `CallToolResult.isError: true`, `content[0].text = "Unknown tool: <nombre>"`.                                                                                                                    |
| `fetch_document` con id inexistente      | `isError: false`, `structuredContent.result: null` (ver arriba).                                                                                                                                 |
| Búsqueda sin resultados                  | `isError: false`, `total: 0, hits: []` (ver arriba).                                                                                                                                             |

Errores de transporte reales (429/502/503/504, timeout) **no se pudieron provocar de forma controlada contra el servicio en producción** (no se hizo estrés deliberado sobre un servicio de terceros); la clasificación de reintentables se basa en los tipos de error documentados por el SDK cliente oficial (`StreamableHTTPError.code` = código HTTP; `McpError` con `ErrorCode.RequestTimeout`/`ErrorCode.ConnectionClosed`) y se prueba con transporte simulado (ver `packages/providers/entscheidsuche/src/*.test.ts`).

## Paginación

Basada en cursor (`search_after` / `next_cursor`), no en offset. Verificado con dos llamadas reales encadenadas: la segunda página devuelve resultados distintos y consecutivos a la primera, sin solape. `next_cursor: null` señala que no hay más páginas.

## Límites observados

- `size`: 1–100 en `search`/`search_by_case_number`. `size`: 1–10000 en `list_hierarchy` (default 1000).
- No se documenta ningún rate limit explícito en las respuestas (sin cabeceras `Retry-After` observadas en uso normal). El cliente propio implementa límites conservadores igualmente (ver `docs/providers/entscheidsuche.md#resiliencia`).
- Tamaño de respuesta: no hay límite documentado por el servidor; el documento más largo recuperado en esta auditoría fue de ~84.000 caracteres. El cliente propio impone un límite máximo configurable de bytes de respuesta (ver ADR de resiliencia) como protección propia, no porque el servidor lo exija.

## Cobertura declarada

Federal (Tribunal Federal — `CH_BGer`/`CH_BGE`, Tribunal Administrativo Federal — `CH_BVGE`) y los 26 cantones, según `list_hierarchy`. La cobertura **no se ha verificado como exhaustiva ni actualizada en tiempo real** — no hay forma de confirmar, desde el propio servidor, qué porcentaje de sentencias realmente dictadas por cada tribunal está indexado.

## Licencia y condiciones de uso

Sin cabeceras de licencia ni Términos de Uso servidos por el propio endpoint MCP. Según la auditoría de Fase 0 (`docs/source-audit.md`): código del servidor MCP bajo licencia MIT (repositorio `entscheidsuche/entscheidsuche-mcp` en GitHub); los documentos en sí son obras oficiales de tribunales suizos, no sujetas a copyright (Art. 5 LDA/URG). No se ha confirmado ninguna condición de uso adicional específica del propio servicio MCP (rate limits, atribución obligatoria) más allá de lo ya documentado en Fase 0.

## PDF de documentación de la API, leído íntegramente en Fase 3 (corrección pendiente de Fase 2)

Fase 2 dejó pendiente la lectura manual de `https://entscheidsuche.ch/pdf/EntscheidsucheAPI.pdf` (la extracción automática había fallado). Se descargó y leyó completo en Fase 3 (12 páginas, fechado 03.07.2022, autor Jörn Erbguth). Describe un sistema **más antiguo y de más bajo nivel que el servidor MCP** que `EntscheidsucheMcpProvider` consume:

- **46 scrapers** (uno por cantón/tribunal federal), listados en `https://entscheidsuche.ch/status`, con ejecución diaria parcial y mensual completa.
- Los documentos scrapeados están disponibles directamente como archivos en `https://entscheidsuche.ch/docs/{scraper}/`: un JSON por caso (con `Signatur`, `Sprache` detectado automáticamente mediante un algoritmo que el propio PDF describe como fiable pero no perfecto — consistente con por qué `language` es poco fiable en nuestro modelo) y, según el caso, PDF y/o HTML del tribunal.
- Existe un **endpoint Elasticsearch directo** (`https://entscheidsuche.pansoft.de:9200/entscheidsuche-*/_search`) y un envoltorio propio (`https://entscheidsuche.ch/_search.php`) — el mismo dominio interno de clúster que ya se había observado expuesto en el campo `server_info` del MCP (ver sección "Nota de seguridad" arriba). El PDF confirma que ese dominio es real y documentado por el propio proyecto, no una fuga accidental.
- Existen además ficheros índice (`docs/index/`, `docs/jobs/`) y un sitemap raíz (`https://entscheidsuche.ch/sitemapindex.xml`).

**Conclusión para esta fase**: el servidor MCP (`https://mcp.entscheidsuche.ch/mcp`, `serverInfo.version 1.27.0`) es una capa más reciente y de más alto nivel sobre este mismo sistema de scrapers/Elasticsearch — no un servicio independiente. No se justifica implementar un cliente adicional contra el Elasticsearch directo o los archivos JSON crudos: el MCP ya expone (`search`, `fetch_document`, etc.) una interfaz más estable y tipada sobre los mismos datos. Se documenta aquí como contexto, no como una fuente alternativa a integrar.
