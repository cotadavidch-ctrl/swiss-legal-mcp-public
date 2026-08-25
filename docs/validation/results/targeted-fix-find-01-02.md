# Cierre puntual — FIND-01 y FIND-02

fecha: 2026-08-06
alcance: unicamente FIND-01 (AILC-06, AILC-13) y FIND-02 (AILC-21), sobre el paquete instalable real.
fuente de los hallazgos originales: `docs/validation/results/mcp-improvement-plan.md` (`source_comparison_id: AI-LEGAL-CROSS-COMPARISON-2026-08-05-001`, `backlog_id: MCP-IMPROVEMENT-BACKLOG-2026-08-05-001`).

**Este documento no autoriza publicacion ni declara revision juridica humana completada.** `human_legal_review_completed = false`. No se ha creado Git ni se ha publicado nada.

## 1. FIND-01 — limite de caracteres/tokens en `resolve_official_swiss_case`

- Hallazgo original (P0, `MCP_DEFECT`, severidad alta): AILC-06 (2A.348/2004) y AILC-13 (4C.4/2004) fallaban de forma identica con `'ERROR: el resultado (109.737 caracteres) excede el limite maximo de tokens permitido'` al llamar `resolve_official_swiss_case` con `require_full_text=true`.
- Estado verificado ahora, contra el bundle real empaquetado (`dist/stdio.js`, el mismo contenido que el tarball actual) y mediante llamadas MCP reales `tools/call` (no simuladas):

| Caso                  | Antes                                                                                  | Ahora                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| AILC-06 (2A.348/2004) | `fetch_failed`, error de limite de tokens, 109.737 caracteres                          | `fetch_status: "fetch_success"`, `isError: false`, texto recuperado: 30.561 caracteres, sin mensaje de limite de tokens |
| AILC-13 (4C.4/2004)   | `fetch_failed`, error de limite de tokens, 109.737 caracteres (identico al de AILC-06) | `fetch_status: "fetch_success"`, `isError: false`, texto recuperado: 20.752 caracteres, sin mensaje de limite de tokens |

- Repetido 3 veces consecutivas (ver seccion 4): longitudes de texto identicas en las 3 ejecuciones (30.561 y 20.752 caracteres respectivamente), `token_limit_error_present: false` en las 3.
- El nuevo umbral de tamano de respuesta (`maxOfficialCaseResponseBytes = 5.000.000` bytes, con mecanismo de paginacion por `chunk_index`/`chunk_token` para documentos que aun asi lo superen) esta muy por encima de las 109.737 caracteres que bloqueaban el caso original; ninguno de los dos casos de regresion activo el mecanismo de paginacion (`is_chunked: false` en ambos), es decir, el texto completo se devolvio en una sola respuesta.
- No se investiga aqui la anomalia `identity_mismatch` del modo `metadata_only` (FIND-04, P2) — fuera del alcance de este cierre, tal como se restringio explicitamente.

## 2. FIND-02 — decodificacion gzip/HTTP en `search_cantonal_legislation` (Ginebra)

- Hallazgo original (P1, `MCP_DEFECT`, severidad alta): AILC-21 fallaba con `'PARSE_ERROR: Respuesta comprimida invalida'` al consultar `silgeneve.ch/legis/program/books/RSG/content.htm` con `canton=GE`, en dos intentos consecutivos.
- Estado verificado ahora, misma metodologia (bundle real, llamada MCP real):

| Caso                | Antes                                                                   | Ahora                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AILC-21 (canton=GE) | `PARSE_ERROR: Respuesta comprimida invalida`, dos intentos consecutivos | `isError: false`, sin `PARSE_ERROR`, 20 documentos reales devueltos desde `https://silgeneve.ch/legis/program/books/RSG/content.htm` (misma URL exacta citada en el hallazgo original) |

- Repetido 3 veces consecutivas (ver seccion 4): 20 documentos devueltos y `parse_error_present: false` en las 3 ejecuciones.
- No se verifica aqui la sustitucion de LIASI por LASLP (FIND-03, P3) contra la fuente primaria — fuera del alcance de este cierre, tal como se restringio explicitamente.

## 3. Inventario de herramientas MCP

Handshake MCP real contra `dist/stdio.js` (el mismo binario empaquetado en el tarball actual, confirmado byte a byte — ver seccion 5):

- `expectedCount: 42` / `actualCount: 42`.
- `missingTools: []`
- `unexpectedTools: []`
- `duplicateTools: []`

## 4. Repetibilidad (3 ejecuciones consecutivas independientes)

| Ejecucion                                        | AILC-06 (caracteres) | AILC-13 (caracteres) | AILC-21 (documentos) | `finalStatus` |
| ------------------------------------------------ | -------------------- | -------------------- | -------------------- | ------------- |
| 1                                                | 30.561               | 20.752               | 20                   | PASS          |
| 2                                                | 30.561               | 20.752               | 20                   | PASS          |
| 3 (persistida en `targeted-fix-find-01-02.json`) | 30.561               | 20.752               | 20                   | PASS          |

Resultados identicos en las 3 ejecuciones — comportamiento deterministico, no un exito intermitente.

## 5. Tarball y paquete

- `tarballName`: `swiss-legal-mcp-1.0.0.tgz`
- `tarballSha256`: `71a2948927546db57d39e61a1e83d7e9f7ab4ec1a667cb0bf9c73c4333a22d1e`
- Generado con `pnpm pack` real (no `--dry-run`) contra el estado actual del codigo fuente.
- `dist_matches_packaged_tarball: true` — el `dist/stdio.js` en disco usado para el handshake MCP es, byte a byte, el mismo contenido empaquetado dentro del tarball (verificado extrayendo el tarball a un directorio temporal y comparando ambos buffers).
- Contenido del tarball (8 archivos, sin cambios respecto al cierre de warnings previo): `dist/stdio.js`, `dist/.source-hash.json`, `LICENSE`, `NOTICE`, `package.json`, `README.md`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`.

## 6. Codigo modificado en este cierre

Ninguno. La implementacion de FIND-01 y FIND-02 (paginacion/umbral ampliado en `apps/mcp-server/src/tools/officialSwissCaseResolver.ts` y `officialSwissCaseTools.ts`; correccion de decodificacion en la ruta compartida de `packages/shared-web/src/secureHttpClient.ts`) ya estaba presente en el arbol de trabajo al iniciar este cierre. No se encontro ningun fallo real durante la inspeccion ni la ejecucion dirigida que requiriera modificar codigo de aplicacion.

Unico archivo nuevo: `scripts/targeted-fix-find-01-02-check.mjs` — script de validacion puntual (no forma parte del pipeline de `ci`/`release:prepare`/`release:check`), usado exclusivamente para generar `targeted-fix-find-01-02.json` mediante un handshake MCP real y las 3 llamadas dirigidas de esta seccion.

## 7. Fuera de alcance (no tocado)

- FIND-03, FIND-04, FIND-05, FIND-06, FIND-07 (P2/P3) — sin cambios, sin nueva investigacion.
- `docs/validation/ai-legal-test-cases.json` — no modificado.
- `docs/validation/results/mcp-improvement-plan.md` / `mcp-improvement-backlog.json` / `ai-legal-cross-comparison.json`/`.md` — no modificados.
- No se ejecuto de nuevo `pnpm run ci`, `pnpm release:prepare`, `pnpm release:check` ni la suite completa de tests en este cierre (ya verificados en un ciclo previo, segun el estado declarado al iniciar esta tarea).

## 8. Estado del RC

Los tres casos dirigidos (AILC-06, AILC-13, AILC-21) y el inventario de herramientas (42/42, sin discrepancias) terminan en PASS. `docs/release/RC-1.0.0.md` se actualiza en consecuencia (nueva entrada en la seccion de cambios cerrados y en el resultado de gates), sin modificar `HUMAN_LEGAL_REVIEW_COMPLETED`/`CONFIDENCE_CALIBRATION_COMPLETED` (ambos permanecen `false`) ni declarar publicacion aprobada.

## 9. Bloqueos y siguiente paso

- Sin bloqueos tecnicos para FIND-01 y FIND-02 especificamente.
- Pendiente, fuera de este cierre: FIND-04 (P2, `identity_mismatch` en modo `metadata_only`), FIND-05 (P2, proveedor cantonal de Zurich), FIND-03/FIND-06/FIND-07 (P3), y sobre todo la revision juridica humana cualificada y la calibracion de confianza (seccion 9 del acta RC-1.0.0.md), que siguen sin completarse y no se declaran completadas aqui.
- Siguiente paso recomendado: entregar este cierre puntual junto con el acta RC-1.0.0.md actualizada para decision humana sobre si procede avanzar a FIND-04/FIND-05 o directamente a la revision juridica cualificada pendiente.
