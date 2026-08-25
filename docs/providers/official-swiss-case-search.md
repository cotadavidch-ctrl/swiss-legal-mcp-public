# Búsqueda federal masiva, resolución por lotes y exportación de corpus

Estado: implementado como mejora general del producto (no específica de ningún reto). Añade tres
herramientas MCP nuevas — `search_federal_cases`, `batch_resolve_official_cases`,
`export_case_corpus` — construidas sobre el resolvedor oficial ya existente
([`docs/official-swiss-case-resolver.md`](../official-swiss-case-resolver.md)) y sobre el
descubrimiento remoto ya usado por `search_cases`
([`docs/providers/entscheidsuche.md`](entscheidsuche.md)), sin modificar ninguno de los dos.

## Qué es y qué no es

`resolve_official_swiss_case` ya sabía resolver **un** caso a la vez, dada una referencia
razonablemente precisa. Lo que faltaba era la capa de **descubrimiento masivo**: dado un conjunto de
filtros (sala, idioma, rango de fechas, materia), encontrar _cuántos_ candidatos oficiales existen y
recuperarlos en volumen, con deduplicación, checkpoint y exportación reutilizable. Estas tres
herramientas nuevas cubren exactamente eso, y solo eso:

- `search_federal_cases`: **descubre** candidatos oficiales del Tribunal Federal
  (`search.bger.ch`). Nunca verifica identidad ni recupera texto completo — cada resultado llega
  marcado `identity_status: "candidate_discovered"` / `full_text_status: "not_fetched"`.
- `batch_resolve_official_cases`: **resuelve** una lista de candidatos (de `search_federal_cases` o
  de cualquier otro origen) reutilizando `resolve_official_swiss_case` para cada uno, con
  concurrencia acotada, checkpoint y continuación tras fallos individuales.
- `export_case_corpus`: **orquesta** las dos anteriores (descubrimiento → deduplicación →
  resolución por lotes) para producir una exportación JSON estable de un corpus jurisprudencial,
  con estadísticas y checkpoint de extremo a extremo.

Ninguna de las tres sustituye a `search_cases` (agregador `entscheidsuche.ch`, explícitamente no
oficial) ni a `resolve_official_swiss_case`/`fetch_official_swiss_case_full_text`
(resolución de un único caso ya conocido). Son una capa de volumen por encima de las herramientas
existentes.

## Decisión de contrato: extender vs. crear

Se evaluó extender `search_cases` (agregador `entscheidsuche.ch`) para que también devolviera
resultados "oficiales", y se descartó deliberadamente: `search_cases` es y debe seguir siendo
un agregador no oficial con esa advertencia siempre presente
(`docs/challenge-7-days/day-01-swiss/improvement-plan.md`, recomendación original del propio
proyecto). Mezclar semánticas "oficial" y "no oficial" en una misma herramienta habría creado
ambigüedad exactamente donde este producto es más estricto. Por eso se creó `search_federal_cases`
como herramienta nueva, exclusivamente oficial, con `official_only` forzado a `true` de forma no
configurable por el llamador (si se pasa `official_only: false`, se ignora y se advierte
explícitamente en `warnings`).

Para la resolución por lotes se evaluó extender `resolve_official_swiss_case` para aceptar un
array, y se descartó también: esa herramienta tiene una semántica de entrada/salida 1:1 ya estable
y documentada (un caso, una resolución). `batch_resolve_official_cases` es una herramienta nueva que
**reutiliza literalmente** `resolveOfficialSwissCase()` internamente, elemento por elemento — nunca
reimplementa lógica de identidad o de lectura completa.

## `search_federal_cases`

### Entrada

| Campo                 | Tipo                                                                                                                           | Notas                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `query`               | `string?`                                                                                                                      | Texto libre pasado a `query_words` del portal de búsqueda.                       |
| `chamber`             | `"I_public_law" \| "II_public_law" \| "I_civil_law" \| "II_civil_law" \| "criminal_law" \| "I_social_law" \| "II_social_law"?` | Mapeo documentado (no inferido) de prefijo de expediente → división.             |
| `language`            | `"de" \| "fr" \| "it"?`                                                                                                        | Default `de`.                                                                    |
| `date_from`/`date_to` | `string?` (`YYYY-MM-DD`)                                                                                                       | Filtro inclusivo, determinista, aplicado tras la recuperación.                   |
| `subject`             | `string?`                                                                                                                      | Coincidencia sobre el título del resultado enlazado; nunca por similitud difusa. |
| `document_type`       | `"judgment" \| "decision" \| "order" \| "unknown"?`                                                                            | Clasificado heurísticamente a partir del título (`Urteil`/`Verfügung`/etc.).     |
| `page`, `page_size`   | `number?`                                                                                                                      | `page_size` acotado a 1-50 (default 20).                                         |
| `max_results`         | `number?`                                                                                                                      | Acotado a 1-500 (default 100).                                                   |
| `official_only`       | `boolean?`                                                                                                                     | Siempre forzado a `true`; `false` genera una advertencia, nunca se respeta.      |
| `cursor`              | `string \| null?`                                                                                                              | Para continuar una paginación previa (ver `next_cursor` en la salida).           |

### Salida

`results[]` (cada uno con `case_number`, `decision_date`, `chamber`, `chamber_division`, `language`,
`title`, `subject`, `document_type`, `official_url`, `official_identifier`, `identity_status`,
`full_text_status`, `source_type`, `provider`, `verification_notes`), `total_discovered`
(`number | null` — **nunca inventado**: si la página no expone un contador de resultados parseable,
queda `null` con una advertencia explícita en vez de una cifra adivinada), `returned_count`,
`next_page`/`next_cursor`, `filters_applied`, `provider`, `source_status`
(`"official" | "unavailable" | "partial"`), `warnings`, `partial_results`, `deduplication_summary`.

### Paginación y volumen

Sigue automáticamente hasta 10 páginas por llamada (siempre que el HTML devuelto contenga un enlace
real de "página siguiente"; nunca depende únicamente de calcular un offset). Puede descubrir más de
100 candidatos dentro de una sola llamada cuando la fuente los tiene. Si el límite de páginas
automáticas se alcanza antes de agotar los resultados, `partial_results: true` y `next_cursor`
queda listo para continuar en una llamada siguiente.

**Advertencia de transparencia deliberada**: el nombre exacto del parámetro de paginación por
offset (`start`) de `search.bger.ch` no pudo verificarse contra la red real durante el desarrollo
(entorno sin acceso saliente a Internet — ver "Limitaciones de entorno" más abajo). Por eso la
implementación nunca depende únicamente de ese parámetro calculado: siempre prioriza el enlace de
"página siguiente" que la propia fuente devuelve en el HTML, y solo usa el offset calculado como
intento de arranque cuando no hay un cursor previo. **Debe verificarse en vivo contra
`search.bger.ch` antes de confiar en la recuperación multi-página en producción.**

### Manejo de errores y reintentos

Reintenta automáticamente (hasta 2 veces, con backoff exponencial + jitter) solo errores
transitorios: HTTP 429/502/503/504 y timeouts/errores de red. Un HTTP 404 u otro error no
transitorio se reporta una sola vez, sin reintento. **HTTP 204 se trata siempre como
`source_status: "unavailable"` con una advertencia explícita — nunca como ausencia de
jurisprudencia** (mitigación del patrón de deuda documentado como FIND-05 en
`docs/release/RC-1.0.0.md#9`; ver también `docs/challenge-7-days/day-01-swiss/limitations-analysis.md`).

## `batch_resolve_official_cases`

### Entrada

`candidates[]` (cada uno con `case_reference?`, `canonical_url?`, `resolution_id?`,
`language_hint?`), `concurrency?` (1-6, default 3), `require_official_source?`,
`require_full_text?`, `strict_identity_match?`, `retry_limit?` (0-3, default 1), `checkpoint_id?`,
`resume?`.

### Salida

`summary` (`requested`, `resolved`, `full_text_verified`, `official_extract`, `metadata_only`,
`identity_mismatch`, `failed`, `skipped`, `warnings`), `items[]` (uno por candidato, con `status`,
la `resolution` completa de `resolve_official_swiss_case` cuando existe, `error`, `warnings`,
`attempts`), `checkpoint_id`, `checkpoint_status`.

### Reglas de clasificación (`classifyBatchResolution`)

En este orden estricto, y en ningún otro:

1. Si `identity.status === "identity_mismatch"` → **siempre** `identity_mismatch`, incluso si
   además hubo un problema de red o de completitud. Nunca se deja que un `identity_mismatch` se
   confunda con un fallo de conectividad (mitigación del patrón de deuda documentado como FIND-04).
2. Si no se encontró ningún candidato → `failed`.
3. Si `reading_status === "full_text_verified_official"` → `full_text_verified_official`.
4. Si la lectura es parcial/solo encabezado/solo fragmento y la fuente es oficial →
   `official_extract`; si la fuente no es oficial en ese mismo caso → `failed` (una fuente
   secundaria nunca se cuenta como extracto válido).
5. Si el fetch falló o el acceso está restringido → `failed`.
6. En cualquier otro caso → `metadata_only`.

### Concurrencia, reintentos y checkpoint

Concurrencia acotada mediante un pool de workers (nunca dispara todas las solicitudes a la vez).
Reintenta cada candidato individualmente, solo para errores transitorios (mismo criterio que
`search_federal_cases`), hasta `retry_limit` veces. Un fallo individual **nunca detiene el lote**:
cada candidato se resuelve de forma independiente y los fallos se registran uno a uno.

Si se pasa `checkpoint_id`, el progreso se persiste tras cada elemento resuelto
(`@swiss-legal-mcp/shared#saveCheckpoint`). Con `resume: true` sobre el mismo `checkpoint_id`, los
elementos ya resueltos con éxito **nunca se vuelven a solicitar** (se marcan `skipped`). El
checkpoint solo se borra cuando el lote termina sin ningún fallo (`summary.failed === 0`); en caso
contrario permanece para poder reanudar.

## `export_case_corpus`

### Entrada

`filters` (mismo shape que los filtros de `search_federal_cases`, sin `page`/`max_results`),
`minimum_size?` (default 50), `target_size?` (default 60, nunca menor que `minimum_size`),
`max_candidates?` (default 140), `page_size?`, `concurrency?`, `checkpoint_id?`, `resume?`.

### Salida

Documento JSON con `schema_version`, `generated_at`, `provider`, `filters`, y seis cubos separados
de entradas (`included`, `official_extracts`, `metadata_only`, `identity_mismatches`,
`excluded_incomplete`, `failed`), `deduplication_summary`, `statistics`
(`candidates_discovered`, `candidates_resolved`, conteos por cubo, `duplicates_removed`,
`minimum_target`, `objective_target`, `minimum_target_reached`, `objective_target_reached`,
`duration_ms`), `checkpoint`, `warnings`.

### La puerta de inclusión dura (LIM-018)

Un caso solo cuenta en `included` (texto completo oficial verificable) si se cumplen
**simultáneamente**:

- `identity_status === "identity_verified"`
- `source_status === "official"`
- `completeness_status === "complete"`
- `reading_status === "full_text_verified_official"`

Si `batch_resolve_official_cases` clasificó un elemento como `full_text_verified_official` pero no
pasa esta puerta más estricta (por ejemplo, identidad solo `identity_probable`, no
`identity_verified`), el elemento se reclasifica como `excluded_incomplete` — **nunca se cuela en
`included`**. Esto es deliberadamente más estricto que la clasificación del lote, precisamente
porque un corpus exportado se asume reutilizable como base de análisis, y no solo como resultado de
una consulta puntual.

### Honestidad sobre el tamaño alcanzado

Si `included.length < minimum_size`, la exportación **nunca lo oculta**: añade una advertencia
explícita (`minimum_corpus_size_not_reached: included=N minimum=M. This reflects real
official-source availability under the given filters, not a fabricated shortfall.`) y
`statistics.minimum_target_reached` queda en `false`. No hay ningún mecanismo que rellene el corpus
con entradas de menor calidad para alcanzar la cifra.

### Checkpoint de dos niveles

`export_case_corpus` persiste su propio checkpoint de descubrimiento (candidatos ya descubiertos,
cursor, si el descubrimiento terminó) bajo `checkpoint_id`, y delega un checkpoint anidado
(`${checkpoint_id}:batch`) a `batch_resolve_official_cases` para la fase de resolución. Ambos se
borran solo cuando el descubrimiento terminó **y** se alcanzó `minimum_size`; en cualquier otro
caso, ambos permanecen para poder reanudar sin volver a descubrir ni resolver lo ya hecho.

## Deduplicación estable (compartida por las tres herramientas)

Implementada una sola vez en `apps/mcp-server/src/tools/caseDeduplication.ts` y reutilizada por
`search_federal_cases` y `export_case_corpus` para que ambas apliquen exactamente el mismo criterio.
Orden estricto, en este orden y en ningún otro:

1. identificador oficial (`official_identifier`, p. ej. el `docid` de `search.bger.ch`);
2. número de expediente + fecha de decisión;
3. URL oficial canónica (normalizada: mismo host + path, parámetros de query ordenados);
4. hash estable de metadatos — solo si ninguno de los anteriores existe.

**Nunca se deduplica por similitud de título.** Dos decisiones con el mismo título mostrado pero
identificador/expediente/URL/hash distintos se consideran siempre decisiones diferentes.

## Checkpoint genérico (`@swiss-legal-mcp/shared`)

`packages/shared/src/checkpointStore.ts` añade un servicio de checkpoint/reanudación genérico
(`saveCheckpoint`, `loadCheckpoint`, `checkpointExists`, `deleteCheckpoint`), reutilizado por
`batch_resolve_official_cases` y `export_case_corpus`, y disponible para cualquier flujo futuro del
producto que necesite persistir progreso de un proceso largo. Escritura atómica (archivo temporal +
rename), resolución de directorio con la misma convención ya usada por la caché del resolvedor
oficial (`SWISS_LEGAL_CHECKPOINT_DIR` → `SWISS_LEGAL_CACHE_DIR`/checkpoints → directorio temporal
del sistema operativo).

## Límites del proveedor y seguridad

- `search_federal_cases` solo construye URLs contra `search.bger.ch`/`bger.ch`/`www.bger.ch` (lista
  cerrada, no configurable). Cualquier otro host queda fuera del alcance de esta herramienta.
- Timeout de 15s por solicitud, límite de 8 MB por respuesta.
- La concurrencia de `batch_resolve_official_cases` está acotada a un máximo de 6 workers
  simultáneos para no sobrecargar la fuente oficial.
- El transporte HTTP de `search_federal_cases` es independiente del transporte del resolvedor de un
  único caso (`officialSwissCaseResolver.ts`); ambos comparten el mismo principio (bloqueo por
  entorno de pruebas salvo `SWISS_LEGAL_MCP_LIVE_HTTP=1`, bloqueo explícito de transporte simulado en
  `NODE_ENV=production`) pero son módulos separados, sin acoplar sus mocks de pruebas.
- No se expone ningún nuevo servidor HTTP ni se altera el transporte stdio existente.

## Limitaciones de entorno documentadas honestamente

Esta funcionalidad se implementó y se probó (typecheck estricto + suite de pruebas offline con
transporte HTTP simulado) en un entorno de desarrollo **sin acceso saliente a Internet** y con
`node_modules` instalado para una plataforma distinta (`darwin-x64`) a la del propio entorno de
ejecución (`linux-x64`), lo que además impidió ejecutar la suite completa de pruebas (`vitest`,
que depende de un binario nativo de `rolldown` solo disponible para `darwin-x64` en ese
`node_modules`) y el empaquetado (`esbuild`, mismo problema). Se pudo, en cambio:

- verificar el _typecheck_ estricto completo (cero errores) de todo el código nuevo y de las
  pruebas nuevas;
- compilar (`tsc`, sin necesidad de binarios nativos) y ejecutar directamente contra el build
  compilado un subconjunto real de los escenarios de `search_federal_cases`/deduplicación (sin
  red, con transporte simulado), confirmando en tiempo de ejecución real —no solo por tipos— que
  la lógica de filtrado, paginación, deduplicación y HTTP 204 se comporta como se describe aquí;
  el resto de los escenarios de esta capa quedaron verificados solo por typecheck en este entorno,
  a la espera de ejecutarse con `pnpm test` en una máquina de desarrollo estándar;
- confirmar mediante un escaneo estático del código fuente (no una ejecución) que el número total
  de herramientas MCP registradas pasó de 42 (documentado en `docs/release/RC-1.0.0.md`) a 45, sin
  nombres duplicados.

No se pudo, en este entorno concreto:

- ejecutar la suite completa de pruebas (`vitest run`) ni el empaquetado (`pnpm build:package`);
- levantar el servidor MCP compilado vía stdio para un handshake real (el proceso hijo falla al
  arrancar por la misma causa: una dependencia preexistente de extracción de texto de PDF —
  `pdfjs-dist`/`@napi-rs/canvas`, ya presente antes de este trabajo, no introducida por él —
  requiere un binario nativo solo disponible para `darwin-x64`);
- ejecutar la validación en vivo contra `search.bger.ch` real (descubrimiento de 100-140
  candidatos, exportación de un corpus de 50-70 decisiones), por falta de acceso saliente a
  Internet.

**Se recomienda explícitamente ejecutar `pnpm install && pnpm test && pnpm build:package && pnpm
test:claude-desktop` en una máquina de desarrollo con acceso a Internet y sin esta discrepancia de
plataforma antes de dar por completada la validación de esta funcionalidad**, y repetir entonces la
validación en vivo contra `search.bger.ch` descrita en
`docs/challenge-7-days/day-01-swiss/implementation-report.md`.
