# Día 1 — Informe de implementación (mejora general del producto)

**Documento generado consumiendo herramientas MCP públicas nuevas y scripts existentes del
repositorio. No contiene lógica de producción — toda la lógica vive en `src/`, `providers/`,
servicios compartidos y herramientas MCP (ver `implementation-metadata.json`).**

## 1. Conclusión

`swiss-legal-mcp` gana tres herramientas MCP nuevas (`search_federal_cases`,
`batch_resolve_official_cases`, `export_case_corpus`) que permiten búsqueda federal masiva,
resolución oficial por lotes y exportación de corpus jurisprudenciales verificables — construidas
sobre el resolvedor oficial existente, sin modificarlo. El código nuevo pasa el typecheck estricto
completo (0 errores) y un subconjunto real de sus pruebas se ejecutó de verdad contra el build
compilado en este entorno. **La validación en vivo contra `search.bger.ch` (el objetivo de 100-140
candidatos descubiertos y 50-70 decisiones exportadas) no pudo completarse en este entorno concreto**
por falta de acceso saliente a Internet — se intentó de verdad, se documenta el intento real y su
resultado, y se recomienda explícitamente repetirla en una máquina con red real antes de considerar
esta mejora completamente validada.

## 2. Qué se construyó

Ver `docs/providers/official-swiss-case-search.md` para el contrato técnico completo. En resumen:

- **`search_federal_cases`**: descubrimiento exclusivamente oficial (`search.bger.ch`, host fijo no
  configurable) con filtros por sala/idioma/fecha/materia/tipo de documento, paginación multi-página
  real y deduplicación estable de 4 niveles. Nunca verifica identidad ni recupera texto completo —
  eso sigue siendo responsabilidad del resolvedor existente.
- **`batch_resolve_official_cases`**: resuelve una lista de candidatos reutilizando íntegramente
  `resolve_official_swiss_case` por elemento, con concurrencia acotada, reintentos solo para errores
  transitorios, checkpoint/reanudación y continuación tras fallos individuales.
- **`export_case_corpus`**: orquesta descubrimiento + deduplicación + resolución por lotes en una
  exportación JSON estable, con una puerta de inclusión dura (LIM-018) y checkpoint de dos niveles.
- **Servicio de checkpoint genérico** (`@swiss-legal-mcp/shared#saveCheckpoint`/`loadCheckpoint`),
  reutilizable por cualquier flujo futuro del producto, no solo por estas tres herramientas.

Decisión de contrato explícita: se creó `search_federal_cases` como herramienta nueva en vez de
extender `search_cases` (agregador `entscheidsuche.ch`), y `batch_resolve_official_cases` como
herramienta nueva en vez de extender `resolve_official_swiss_case` — ambas decisiones siguen la
recomendación ya presente en `improvement-plan.md` y evitan mezclar semántica oficial/no oficial o
romper un contrato 1:1 ya estable. Detalle completo en `docs/providers/official-swiss-case-search.md`.

## 3. Base: qué se verificó y cómo

| Verificación                                  | Resultado                            | Método real usado                                                                                                |
| --------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Typecheck estricto (código + pruebas nuevas)  | **PASS, 0 errores**                  | `tsc --noEmit -p tsconfig.json` por paquete                                                                      |
| Build (`tsc`)                                 | **PASS**                             | `tsc -p tsconfig.json`, dist verificado en disco                                                                 |
| Recuento de herramientas MCP (42 → 45)        | **PASS, confirmado en vivo**         | escaneo estático real del código fuente (`scripts/lib/tool-inventory.mjs`), sin duplicados                       |
| Comportamiento real de `search_federal_cases` | **5/5 escenarios ejecutados y PASS** | script Node plano contra el build compilado (host exclusivo, filtro de sala, HTTP 204, >100 candidatos, dedup)   |
| Intento real contra `search.bger.ch`          | **Ejecutado, red no disponible**     | invocación real (sin mock) con `NODE_ENV=production`; ver `implementation-results.json`                          |
| Suite completa de pruebas (`vitest run`)      | **BLOQUEADO en este entorno**        | dependencia nativa de `rolldown` solo para `darwin-x64` en este `node_modules`                                   |
| Empaquetado (`esbuild`)                       | **BLOQUEADO en este entorno**        | dependencia nativa de `esbuild` solo para `darwin-x64`                                                           |
| Handshake MCP stdio real                      | **BLOQUEADO en este entorno**        | dependencia preexistente `pdfjs-dist`/`@napi-rs/canvas` (no introducida por esta mejora) crashea el proceso hijo |

Detalle campo por campo, incluida la salida real (no resumida) del intento de red, en
`implementation-results.json`.

## 4. Las 27 pruebas obligatorias

Se escribieron 4 archivos de pruebas nuevos (colocados junto al código fuente, mismo patrón que
`packages/shared/src/checkpointStore.test.ts`), cubriendo las 27 categorías exigidas — varias con más
de una prueba por rigor:

- `apps/mcp-server/src/tools/caseDeduplication.test.ts` — 8 pruebas (deduplicación por los 4 niveles,
  no-deduplicación por título, prioridad de niveles, normalización de URL).
- `apps/mcp-server/src/tools/officialFederalCaseSearch.test.ts` — 16 pruebas (exclusividad oficial,
  filtros de sala/idioma/fecha/materia, paginación multi-página, >100 candidatos, deduplicación,
  HTTP 204, timeout, reintento transitorio, error no transitorio, resultados parciales).
- `apps/mcp-server/src/tools/officialFederalCaseBatch.test.ts` — 11 pruebas (clasificación
  `identity_mismatch`/`metadata_only`/`official_extract`/`full_text_verified_official`/`failed`,
  resolución por lotes con fallos parciales, concurrencia acotada, checkpoint/reanudación).
- `apps/mcp-server/src/tools/caseCorpusExport.test.ts` — 5 pruebas (exportación JSON válida y
  serializable, honestidad cuando no se alcanza el tamaño mínimo, checkpoint vivo/limpiado,
  no-fabricación de entradas incluidas).

Todas typecheckean sin errores. 5 escenarios (los que no dependen de `officialSwissCaseResolver.ts`)
se ejecutaron además de verdad en este sandbox contra el build compilado, con resultado real PASS
(ver sección 3). El resto quedó verificado solo por tipos en este entorno concreto — recomendación
explícita de ejecutar `pnpm test` en una máquina de desarrollo estándar antes de dar la suite por
completamente confirmada. Detalle exacto en `implementation-results.json`.

## 5. Limitaciones de entorno (honestidad explícita)

Este entorno de desarrollo tiene dos limitaciones estructurales independientes, ninguna causada por
el código de esta mejora:

1. **Sin acceso saliente a Internet.** Confirmado en la fase de análisis inicial (`curl`/`nslookup`
   contra `search.bger.ch` y `google.com` fallaron por "network unreachable") y confirmado de nuevo
   aquí con una invocación real de `search_federal_cases` sin mock (`NODE_ENV=production`), que
   recibió `fetch failed`.
2. **`node_modules` instalado para `darwin-x64`, sandbox `linux-x64`.** Afecta a tres dependencias
   nativas independientes: `@rolldown/binding-*` (usado por `vite`/`vitest`), `@esbuild/*` (usado por
   el empaquetado y por `tsx`), y `@napi-rs/canvas` (usado por `pdfjs-dist`, a su vez usado por
   `officialSwissCaseResolver.ts` para extraer texto de PDFs — dependencia preexistente, no
   introducida por esta mejora). Esto bloquea `vitest run`, `pnpm build:package` y cualquier
   arranque real del servidor MCP compilado en este entorno concreto.

Ninguna de las dos limitaciones se puede resolver sin acceso a Internet o sin ejecutar en la
plataforma nativa del proyecto. Se documentan aquí en vez de simularse o silenciarse.

## 6. Acción recomendada / próxima acción

1. En una máquina de desarrollo con acceso real a Internet y `node_modules` instalado para su propia
   plataforma: `pnpm install && pnpm test && pnpm build && pnpm build:package && pnpm
test:claude-desktop`.
2. Repetir la validación en vivo: `search_federal_cases` filtrado a "II. zivilrechtliche Abteilung"
   (`chamber: "II_civil_law"`) + alemán + un periodo amplio (por ejemplo `date_from: "2015-01-01"`,
   `date_to: "2025-12-31"`, como en el intento real documentado en `implementation-results.json`),
   seguido de `export_case_corpus` con los mismos filtros (`minimum_size: 50`, `target_size: 60`,
   `max_candidates: 140`).
3. Sustituir `corpus-v2.json` por la salida real de ese `export_case_corpus`. Si
   `statistics.included_count >= 50`, generar un nuevo tarball (`pnpm pack`), reinstalar la beta
   local y repetir el Día 1 (análisis de estilo judicial / skill de redacción / escrito ficticio)
   sobre `corpus-v2.json` real — tal como pedía el objetivo original del reto. Si
   `statistics.included_count < 50` incluso con red real, documentar la limitación oficial
   demostrada (no asumirla) antes de declarar el objetivo alcanzado.

## 7. Bloque de estado

Ver el bloque de estado estructurado completo (todos los campos exigidos) en la respuesta final de
esta sesión de trabajo y en `implementation-results.json`/`implementation-metadata.json`.
