# Estado de implementación — swiss-legal-mcp

Última actualización: 2026-08-04 (resolvedor oficial de jurisprudencia suiza local).

## Resolvedor oficial de jurisprudencia suiza

Estado: **implementado localmente; no publicado**.

Entregables:

- Cuatro herramientas MCP nuevas: `resolve_official_swiss_case`,
  `fetch_official_swiss_case_full_text`, `verify_swiss_case_identity` y
  `compare_swiss_case_sources`.
- Arquitectura de adaptadores: Tribunal Federal, Tribunal Administrativo Federal, Tribunal Penal
  Federal, portal cantonal generico, URL directa y fallback `entscheidsuche.ch` no oficial.
- Adaptador BStGer real contra `bstger.weblaw.ch`: busqueda POST
  `/api/getDocuments?withAggregations=true`, seleccion exacta por `leid` y descarga PDF por
  `/api/getDocumentFile/{leid}`.
- Adaptador Appenzell Ausserrhoden real contra `rechtsprechung.ar.ch`: busqueda POST
  `/api/.netlify/functions/searchQueryService`, seleccion exacta por titulo/fichero y descarga PDF
  oficial bajo `/download/Obergericht/...`.
- Normalizacion de BGer/TF, BGE/ATF/DTF, BVGer, BStGer, referencias AR (`O2V 19 21`,
  `O1S 18 1`), referencias cantonales ambiguas y URLs.
- Ranking explicable de candidatos con seleccion, ambiguedad y razones de descarte.
- Verificacion de identidad separada de descarga: una coincidencia de numero no basta para
  `identity_verified`.
- Recuperacion pasiva HTML/PDF-like en tests, deteccion de challenge/login/rate-limit, MIME
  ejecutable, documentos vacios o demasiado grandes.
- Integridad compatible con la politica estricta: hechos, historia procesal, alegaciones,
  razonamiento inferior, considerandos, ultimo considerando, dispositivo, costas, fundamentos
  autonomos y opiniones separadas.
- Comparacion oficial/agregador con `secondary_source_incomplete` y
  `full_text_source_mismatch` cuando el secundario omite dispositivo o estructura esencial.
- Cache auditable con `cache_miss`, `cache_hit_valid`, `cache_hit_stale` y
  `cache_invalidated`.
- Estados uniformes de uso juridico para comparabilidad, redaccion, estrategia y citas.
- Suite offline `apps/mcp-server/tests/officialSwissCaseTools.test.ts`: 93 tests.
- Validacion live BStGer ejecutada localmente: `SK.2023.1` y `RR.2024.1` devuelven PDF oficial,
  hash SHA-256, identidad verificada y `full_text_verified_official`.
- Validacion live AR ejecutada localmente: `O2V 19 21` y `O1S 18 1` devuelven PDF oficial,
  `canton_code` `AR`, tribunal `Obergericht Appenzell Ausserrhoden`, hash SHA-256, identidad
  verificada y `full_text_verified_official`.

Limitaciones:

- Los tests usan fixtures sinteticos minimos; no copian sentencias reales.
- Los adaptadores federales/cantonales son extensibles y construyen rutas/candidatos de forma
  trazable; cada portal cantonal real adicional debe implementarse y verificarse con su propio
  adaptador. AR no implica soporte automatico para AI ni para otros cantones.
- `entscheidsuche.ch` sigue siendo fuente secundaria: nunca produce
  `full_text_verified_official`.

## Fase 12 — Analisis juridico contradictorio multirrol

Estado: **implementada localmente; no publicada**.

Entregables:

- Dos herramientas MCP nuevas: `analyze_swiss_legal_positions` y `validate_multirole_legal_analysis`.
- Analisis separado por rol: `claimant_or_appellant`, `respondent_or_authority`, `opposing_party`, `prosecution`, `defence`, `first_instance_court`, `appellate_court`, `supreme_court_review`, `neutral_risk_assessment` y `deliberation_panel`.
- Seleccion deterministica de roles por `case_type` y `procedural_stage`; fiscalia y defensa solo aparecen en asuntos penales identificados.
- Separacion expresa de `party_argument`, `authority_argument`, `court_finding`, `neutral_assessment` y `predicted_outcome`.
- Reglas de exclusion para hechos no verificados, prueba no utilizable, jurisprudencia sin lectura completa, normas sin vigencia temporal confirmada y jurisdiccion concreta incompleta.
- Modelo de carga procesal con `Behauptungslast`, `Substanziierungslast`, `Beweislast`, `Mitwirkungspflicht`, `Untersuchungsgrundsatz`, `Offizialmaxime`, `Verhandlungsmaxime` y `not_verified`.
- Estandar de revision por organo decisor con estado conservador `not_verified` si competencia, via o base procesal no constan.
- Matriz argumento-contraargumento-replica sin bucles y deliberacion simulada estructurada, nunca teatral ni atribuida a personas reales.
- `jurisdiction_summary` centralizado: distingue ordenamiento suizo confirmado de las otras siete dimensiones procesales no verificadas.
- Escenarios de riesgo condicionados (`best_case`, `expected_case`, `worst_case`) y deliberacion provisional cuando faltan autoridad, via, plazo, resolucion completa, estandar o prueba verificada.
- Validador corregido para separar violaciones reales de controles correctamente aplicados; los controles como prueba excluida, hecho limitado a alegacion, roles penales excluidos o resultado condicionado quedan como informativos.
- Integracion de control con redaccion mediante `include_in_drafting_control_report`; el escrito limpio no se modifica ni recibe argumentos de contraparte, deliberacion o predicciones.
- Suite de regresion `apps/mcp-server/tests/multiroleLegalAnalysisTools.test.ts`: 37 tests offline.

Limitaciones:

- No sustituye revision por jurista cualificado.
- No usa IA ni proveedores nuevos.
- No genera acusaciones penales ni conclusiones de culpabilidad fuera de un caso penal identificado.
- No declara hechos judicialmente probados si faltan documentos, competencia o estandar de revision.

## Politica estricta de lectura completa de sentencias

Estado: **implementada localmente; no publicada**.

Entregables:

- Estados ejecutables `full_text_verified_official`, `full_text_read_unofficial`, `full_text_read`, `partial_text_only`, `headnote_only`, `snippet_only`, `inaccessible_full_text` y `extraction_incomplete`.
- Trazabilidad de lectura: fuente, URL, hash, fecha de recuperacion, fecha de lectura, version del extractor, paginas/secciones leidas, cobertura, secciones faltantes y errores.
- Comparabilidad degradada a `candidate_only` o `unverified_reference` si no consta lectura completa, ratio confirmada/probable y revision de fundamentos autonomos.
- `analyze_procedural_strategy` ya no trata snippets/resultados de busqueda como jurisprudencia mixta/favorable.
- Las herramientas de redaccion conservan jurisprudencia parcial solo en informe de control; no la incorporan silenciosamente al documento limpio como autoridad decisiva.

## Fase 11 — Redaccion, revision y refutacion juridica suiza

Estado: **implementada localmente; no publicada**.

Entregables:

- Ocho herramientas MCP nuevas: `draft_swiss_legal_document`, `review_swiss_legal_document`, `validate_procedural_requirements`, `generate_rechtsbegehren`, `build_evidence_index`, `extract_challenged_passages`, `build_rebuttal_matrix`, `validate_swiss_legal_draft`.
- Modelos estructurados y reglas deterministicas en `apps/mcp-server/src/tools/legalDraftingRules.ts`.
- Registro MCP en `apps/mcp-server/src/tools/legalDraftingTools.ts`.
- Validacion `legal_drafting_check` con estados `passed`, `warning`, `failed`, `not_verified`, `not_applicable`.
- Documento limpio separado de informe de control; el informe mantiene `human_legal_review_required`.
- Perfiles `de-CH-legal`, `fr-CH-legal`, `it-CH-legal`; prioridad inicial `de-CH-legal` con sustitucion de `ß` por `ss` y tono tecnico/sobrio.
- Rechtsbegehren numerados y warnings para peticiones no respaldadas, contradictorias o dependientes del poder de la autoridad.
- Indice de pruebas/anexos con Noven risk, anexos faltantes/duplicados y analisis de transferencia interna entre cuentas propias.
- Sistema quote-and-rebuttal con autor, funcion, contexto, ubicacion, motivacion autonoma, tipo de error, contraanalisis y consecuencia procesal.
- Propagacion estricta de estados: placeholders no pasan requisitos esenciales, hechos inciertos no se afirman categoricamente, citas de usuario no se tratan como cotejadas, pruebas ausentes no soportan argumentos actuales y cada `Rechtsbegehren` conserva traza.
- Jurisdiccion descompuesta en `country_legal_system`, `territorial_jurisdiction`, `subject_matter_jurisdiction`, `functional_jurisdiction`, `issuing_authority`, `appellate_authority`, `procedural_remedy` y `venue_or_filing_destination`; `jurisdiction` queda derivado/deprecated.
- Pruebas descompuestas en fuente de afirmacion, existencia, disponibilidad, verificacion de contenido, autenticidad, expediente, presentacion, admisibilidad, Noven y razon de no utilizabilidad.
- Suite de regresion `apps/mcp-server/tests/legalDraftingTools.test.ts`: 63 tests offline.

Limitaciones:

- No sustituye revision por jurista cualificado.
- No inventa autoridades, plazos, paginas, IBAN, saldos, funcionarios ni sentencias.
- No resuelve automaticamente normas cantonales o plazos si la informacion estructurada no los confirma.
- No elimina los warnings pendientes de revision humana/callibracion de estrategia procesal.

## Correcciones MCP Claude Desktop — exactitud jurisprudencial y temporal

Estado: **implementadas localmente; no publicadas**.

Cambios:

- `verify_legal_citation` incorpora `officialCaseVerification` para referencias federales cubiertas, con estados `officially_verified`, `aggregator_only`, `cantonal_aggregator_only`, `official_not_found`, `official_mismatch` y `unverified_reference`.
- `bger.ch`/`search.bger.ch` prevalece como fuente primaria para `1B_352/2019`, `4A_97/2026` y `9C_785/2018`; `entscheidsuche.ch` se conserva solo como traza de agregador secundario.
- Las decisiones cantonales `AC/1124/2023`/`DAAJ/117/2023` y `AC/3617/2022`/`DAAJ/97/2023` permanecen como `cantonal_aggregator_only` mientras no exista fuente oficial cantonal integrada.
- `analyze_procedural_strategy` añade comparabilidad jurisprudencial estructurada y conservadora: misma materia, procedimiento, hechos determinantes, problema probatorio, documentos/prueba, cuestión jurídica, ratio, resultado, utilidad, límites y diferencias.
- La herramienta separa por defecto hechos acreditados, alegaciones, razonamiento de instancia inferior, razonamiento del tribunal decisor, ratio decidendi, obiter y pasajes de soporte.
- La asistencia jurídica gratuita se analiza sin automatismos: no hay regla "sin abogado = unbeholfen" ni "primera deficiencia = Nachfrist"; se separan Art. 29 Abs. 3 BV, Mitwirkungspflicht, Art. 56 ZPO y derecho cantonal.
- `identify_applicable_version` añade `temporalAssessment`: `endDate` e `isHistorical` se mantienen como metadatos/inferencias y no como conclusiones jurídicas automáticas.

Pruebas añadidas/ampliadas:

- `apps/mcp-server/tests/jurisprudenceGuardrails.test.ts`: 16 tests offline.
- `apps/mcp-server/tests/citationTools.test.ts`: ampliado a 24 tests offline.
- `apps/mcp-server/tests/proceduralStrategyTools.test.ts`: ampliado a 8 tests offline.

## Fase 10 — Validacion juridica humana y live evaluation controlada

Estado: **PARCIAL AVANZADA; paquete de revision humana preparado y live evaluation controlada
ejecutada; revision humana real y calibracion pendientes**.

Entregables implementados:

- Paquete de revision en `docs/procedural-strategy/human-review/`.
- Cinco casos preparados: `legal-aid-ar`, `cantonal-admin-controlled`,
  `social-insurance-controlled`, `employment-controlled`, `uncertain-deadline-controlled`.
- Hash de input y hash de salida por caso.
- Guia de revisor, schema, adjudicacion, calibracion y live evaluation documentados.
- Comando `pnpm review:procedural-strategy --prepare`.
- Comando `pnpm review:procedural-strategy --import <path>` con validacion de schema, hashes,
  metadatos de revisor, duplicados, puntuaciones, comentarios obligatorios y hallazgos.
- Artefacto `docs/release/generated/procedural-strategy-human-validation.json`.
- Artefacto `docs/release/generated/procedural-strategy-live-evaluation.json`.
- Informe `docs/procedural-strategy/human-validation-report.md`.
- Informe `docs/procedural-strategy/live-evaluation-report.md`.
- Paquete exportable local `artifacts/procedural-strategy-human-review/`.

Estado actual:

- Casos revisados humanamente: 0.
- Revisores cualificados importados: 0.
- Live evaluation completada: si, con consultas abstractas anonimizadas contra `entscheidsuche.ch`.
- Hallazgos criticos abiertos: 0.
- Calibracion contra revision humana: no completada.

No se simulo revision humana ni se importaron respuestas ficticias. La live evaluation no sustituye
la comprobacion por un jurista cualificado.

## Fase 9 — Validacion juridica real y calibracion de estrategia procesal

Estado: **PARCIAL en validacion juridica global; evaluacion determinista local implementada e
incluida en Release 1.0 local con limitaciones documentadas**.

Entregables:

- Corpus local anonimizado/controlado en `tests/fixtures/procedural-strategy/cases.json`.
- Caso piloto `legal-aid-ar` para asistencia juridica gratuita ante el Obergericht de Appenzell
  Ausserrhoden, reconstruido desde fixture local y sin datos personales reales.
- Harness `pnpm eval:procedural-strategy`.
- Reportes `docs/procedural-strategy/evaluation-report.md` y
  `docs/release/generated/procedural-strategy-evaluation.json`.
- Taxonomia de errores juridicos en el harness.
- Plantilla de revision humana en `docs/procedural-strategy/human-review-template.md`.
- Regresion: `analyze_procedural_strategy` conserva hechos `alleged` y `uncertain` en salida
  estructurada.

Resultado local actual:

- 15/15 casos pasan.
- Errores criticos: 0.
- Hechos materiales inventados: 0.
- Plazos inventados: 0.
- Jurisprudencia inventada: 0.
- Fugas de privacidad detectadas: 0.

Limitaciones:

- El corpus es pequeno y no estadisticamente representativo.
- Solo hay un caso piloto anonimizado/controlado; los otros 14 son sinteticos juridicamente
  controlados.
- No existe revision humana cualificada completada; por tanto la Fase 9 no se declara validacion
  juridica profesional completa.
- La evaluacion live de jurisprudencia es opt-in y no se ejecuta por defecto.

## Fase 8 — Estrategia procesal avanzada

Estado: **implementada como capa determinista inicial; incluida en Release 1.0 local**.

Entregables:

- Nueva herramienta MCP activa: `analyze_procedural_strategy`.
- Input Zod estricto con expediente estructurado: jurisdicción, materia, partes, hechos, historial, decisión impugnada, pretensiones, prueba, plazos, objetivos, restricciones, documentos y fecha de análisis.
- Output estructurado: resumen del caso, competencia, admisibilidad, plazos, ley aplicable detectada, carga de prueba, prueba, jurisprudencia recuperada, opciones, estrategia, escenarios, riesgos, faltantes, advertencias, fuentes, trazas y confianza.
- Documentación nueva en `docs/procedural-strategy/`.
- ADR 0027.
- Pruebas offline en `apps/mcp-server/tests/proceduralStrategyTools.test.ts`.

Guardrails:

- No usa IA, embeddings ni proveedores nuevos.
- No inventa jurisprudencia, plazos, competencia, autoridades, resultados ni fuentes.
- No calcula plazos sin base legal real.
- No afirma aplicación jurídica cuando solo detecta citas.
- `get_transitional_provisions` sigue deliberadamente fuera del registro.

Licencia de release:

- El propietario eligió Apache License 2.0 (`Apache-2.0`) el 2026-08-03.
- `LICENSE`, `NOTICE` y los metadatos de paquetes se mantienen consistentes con Apache-2.0.

## Fase 7 — Hardening, exactitud y Release 1.0 local

Estado: **técnicamente completada en hardening local; incluida en Release 1.0 local**.

Bloqueos técnicos resueltos en esta continuación:

- Deuda `resolveDocument`: resuelta mediante `apps/mcp-server/src/tools/documentResolver.ts`.
- Timeouts de suite general: estabilizados sin subir el timeout global.
- DNS rebinding: validación previa y por redirect con lookup controlado y pruebas offline.
- Política de puertos: 443 por defecto; 80 solo con excepción explícita; credenciales embebidas bloqueadas.
- Compresión: gzip/deflate/brotli con límites de bytes comprimidos, bytes descomprimidos y ratio.
- PDF: inspección pasiva de magic bytes, cifrado, acciones, JavaScript, adjuntos, formularios, XFA, URI, updates incrementales, trailing data, hash original y límites.
- RDF: guardia offline para RDF/XML, Turtle, N-Triples y JSON-LD; sin imports, contextos remotos ni red.
- Errores: taxonomía ampliada sin retirar códigos históricos.
- Observabilidad: métricas desacopladas y pruebas de redacción de logs.
- Licencias: paquetes internos separados de terceros; fixture anidado `transport@0.0.1` clasificado como revisión manual informativa, no como dependencia externa bloqueante.

Licencia de release:

- El propietario eligió Apache License 2.0 (`Apache-2.0`) el 2026-08-03. Ver `docs/release/licensing.md`.

Regla del proyecto: una fuente o herramienta no pasa a `implementado` sin prueba de integración real contra la fuente correspondiente. Tras Fase 3, `entscheidsuche.ch` (jurisprudencia, agregador no oficial) y `fedlex` (legislación federal, fuente oficial) son los dos proveedores jurídicos reales activos en producción; el resto de fuentes (Zefix, SECO, BSV, ESTV, cantones, bger.ch directo...) siguen pendientes de fases posteriores.

## Correcciones documentales aplicadas al inicio de Fase 1

- **ECLI**: se sustituyó la afirmación "Suiza no usa ECLI (no pertenece a la UE/EEE)" por la formulación correcta: no se ha confirmado que los tribunales suizos asignen ECLI de forma sistemática; el campo permanece opcional y normalmente vacío, sin inferir su inexistencia solo por la no pertenencia a la UE/EEE. Corregido en `docs/source-audit.md` y `packages/documents/src/normalizedDocument.ts`.
- **entscheidsuche.ch**: se precisó su definición en `docs/source-audit.md` y `docs/architecture.md` — agregador jurisprudencial no oficial, proveedor primario de descubrimiento y recuperación (nunca sustituto de la fuente oficial cuando exista URL del tribunal), cobertura no garantizada ni exhaustiva. La integración futura (Fase 2) se fija como adaptador cliente MCP (`EntscheidsucheMcpProvider`), no scraping ni API REST inventada — ver ADR 0005.

## Leyenda

- **implementado** — código escrito y en uso.
- **probado** — implementado + prueba de integración real contra la fuente pasando.
- **parcial** — implementado para una parte del alcance (p. ej. un cantón de 26).
- **bloqueado** — no se puede avanzar sin resolver algo primero (fuente sin API confirmada, URL inestable, credencial pendiente, etc.).
- **pendiente** — planificado, no iniciado.

## Fase 0 — Auditoría de fuentes

| Entregable                                                                                                                         | Estado                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `docs/source-audit.md`                                                                                                             | **implementado** (documento de investigación completo, con niveles de confianza por dato) |
| `docs/architecture.md`                                                                                                             | **implementado**                                                                          |
| `docs/tool-catalog.md`                                                                                                             | **implementado**                                                                          |
| `docs/data-model.md`                                                                                                               | **implementado**                                                                          |
| `IMPLEMENTATION_STATUS.md`                                                                                                         | **implementado** (este archivo)                                                           |
| Verificaciones adicionales recomendadas (PDF de API de entscheidsuche.ch, credenciales Zefix, URLs BSV, licencia exacta de Fedlex) | **pendiente** — ver sección final de `source-audit.md`                                    |

## Fase 1 — Monorepo, transporte, CI (completada, con limitaciones anotadas)

| Entregable                                                                                                                                   | Estado                          | Evidencia                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Estructura de monorepo (`apps/`, `packages/`, `packages/providers/`, `docs/adr/`, `tests/`, `scripts/`)                                      | **implementado**                | ver árbol de archivos en el informe final de la tarea                                                                                                                                                                                                                                                        |
| pnpm workspaces (9 proyectos)                                                                                                                | **implementado y probado**      | `pnpm install --frozen-lockfile` → `Scope: all 9 workspace projects` / `Already up to date`                                                                                                                                                                                                                  |
| TypeScript estricto (sin `exactOptionalPropertyTypes`, ver ADR 0002)                                                                         | **implementado y probado**      | `pnpm typecheck` (`tsc --noEmit` en 8 paquetes/apps) → 0 errores                                                                                                                                                                                                                                             |
| ESLint (flat config, type-aware) + Prettier                                                                                                  | **implementado y probado**      | `pnpm lint` → 0 errores/warnings; `pnpm format` → "All matched files use Prettier code style!"                                                                                                                                                                                                               |
| Vitest configurado (workspace-wide)                                                                                                          | **implementado y probado**      | `NODE_ENV=test pnpm test` → **14 archivos, 66 tests, todos en verde**                                                                                                                                                                                                                                        |
| SDK oficial MCP (`@modelcontextprotocol/sdk@1.29.0`)                                                                                         | **implementado y probado**      | `apps/mcp-server/src/mcpServer.ts`; probado via `InMemoryTransport`+`Client` (`apps/mcp-server/tests/mcpServer.test.ts`) y via HTTP real con supertest                                                                                                                                                       |
| Transporte stdio                                                                                                                             | **implementado y probado**      | `apps/mcp-server/src/stdio.ts`; probado end-to-end (spawn real + `InMemoryTransport` equivalente) y cierre ordenado con SIGTERM (`tests/shutdown.test.ts`)                                                                                                                                                   |
| Transporte Streamable HTTP (modo stateless, un transporte por petición — ver ADR 0003)                                                       | **implementado y probado**      | `apps/mcp-server/src/httpApp.ts` + `routes/mcp.ts`; probado manualmente con script real (initialize → notifications/initialized → tools/list → tools/call) y con supertest                                                                                                                                   |
| Autenticación por bearer token en HTTP (bypass solo en `NODE_ENV=test`)                                                                      | **implementado y probado**      | `middleware/auth.ts`; probado con token ausente/incorrecto/correcto (401/401/200) en producción simulada, y con `timingSafeEqual` para comparación segura                                                                                                                                                    |
| `GET /health`                                                                                                                                | **implementado y probado**      | siempre 200, sin dependencias                                                                                                                                                                                                                                                                                |
| `GET /ready`                                                                                                                                 | **implementado y probado**      | 200 si todos los proveedores registrados están `healthy` (o no hay ninguno); 503 si alguno no lo está — probado con proveedor sano e insano                                                                                                                                                                  |
| `POST /mcp`                                                                                                                                  | **implementado y probado**      | ver transporte HTTP arriba                                                                                                                                                                                                                                                                                   |
| Logs estructurados (pino + pino-http) con redacción de `authorization`/`cookie`/tokens                                                       | **implementado**                | `packages/shared/src/logger.ts`; no se escribió una prueba dedicada a inspeccionar la redacción en Fase 1 (limitación conocida, ver abajo)                                                                                                                                                                   |
| Errores tipados                                                                                                                              | **implementado y probado**      | `packages/core/src/errors.ts`; probado en `errors.test.ts`, `toolRegistry.test.ts` y en el mapeo a `CallToolResult` (`mcpServer.test.ts`)                                                                                                                                                                    |
| Validación de variables de entorno (Zod, falla rápido, sin defaults inventados para credenciales)                                            | **implementado y probado**      | `packages/shared/src/env.ts` + `env.test.ts`                                                                                                                                                                                                                                                                 |
| Registro modular de herramientas (activación condicionada a salud de proveedor — ver ADR 0004)                                               | **implementado y probado**      | `packages/core/src/toolRegistry.ts` + `toolRegistry.test.ts` + prueba end-to-end en `mcpServer.test.ts`                                                                                                                                                                                                      |
| Registro modular de proveedores (id, estado, carácter oficial, health check, capacidades, idiomas, jurisdicciones, fecha del último control) | **implementado y probado**      | `packages/core/src/provider.ts` + `provider.test.ts`                                                                                                                                                                                                                                                         |
| `FixtureProvider` (solo `NODE_ENV=test`, doble guarda — ver ADR 0006)                                                                        | **implementado y probado**      | `packages/providers/fixture/` + `fixtureProvider.test.ts`                                                                                                                                                                                                                                                    |
| Límites configurables: tamaño de petición, timeout, concurrencia, rate limit                                                                 | **implementado y probado**      | `middleware/{concurrency,timeout,rateLimit}.ts` + `express.json({limit})`; probado con 413 real por payload excesivo, 503 por concurrencia, 429 por rate limit                                                                                                                                               |
| Identificadores de correlación por petición (`x-correlation-id`, `AsyncLocalStorage`)                                                        | **implementado**                | `packages/shared/src/correlationContext.ts` + `middleware/correlationId.ts`; se ve en las respuestas HTTP reales, sin prueba unitaria dedicada (limitación conocida)                                                                                                                                         |
| Cierre ordenado (graceful shutdown)                                                                                                          | **implementado y probado**      | `SIGTERM`/`SIGINT` en `http.ts` y `stdio.ts`; probado con spawn real de proceso + señal (`tests/shutdown.test.ts`)                                                                                                                                                                                           |
| `apps/admin-cli`                                                                                                                             | **implementado**                | reporta estado real de `ProviderRegistry`/`ToolRegistry`; sin pruebas automatizadas dedicadas (limitación conocida)                                                                                                                                                                                          |
| Dockerfile (`apps/mcp-server/Dockerfile`) + `.dockerignore`                                                                                  | **implementado, no verificado** | **Docker no está disponible en este entorno de desarrollo** (`docker: command not found`) — el Dockerfile se escribió y se razonó cuidadosamente (ver limitación abajo) pero no se pudo ejecutar `docker build` ni `docker run` realmente. No declarar "probado" hasta construirlo en un entorno con Docker. |
| `docker-compose.yml` (postgres + mcp-server)                                                                                                 | **implementado, no verificado** | validado solo como YAML sintácticamente correcto (`python3 -c "import yaml; ..."`); no se pudo levantar el stack real                                                                                                                                                                                        |
| GitHub Actions CI (`.github/workflows/ci.yml`)                                                                                               | **implementado, no verificado** | los mismos comandos (`pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test`) se ejecutaron localmente con éxito; el job `docker-build` no se pudo probar (sin Docker local) ni se ha ejecutado en GitHub Actions real todavía                                                                             |

### Comandos ejecutados como evidencia (todos en la raíz del repo, salvo que se indique otra cosa)

```
pnpm install --frozen-lockfile        # Scope: all 9 workspace projects / Already up to date
pnpm format                           # prettier --check . -> "All matched files use Prettier code style!"
pnpm lint                             # eslint . -> sin salida (0 problemas)
pnpm typecheck                        # tsc --noEmit por paquete (8 proyectos) -> "Done" en todos, 0 errores
NODE_ENV=test pnpm test               # vitest run -> Test Files 14 passed (14) / Tests 66 passed (66)
pnpm build                            # tsc -p tsconfig.json en apps/mcp-server y apps/admin-cli -> "Done"
```

### Limitaciones conocidas de Fase 1 (no ocultar)

1. **Docker no verificado en este entorno**: no hay binario `docker` disponible aquí. El `Dockerfile` se escribió razonando explícitamente sobre por qué el enfoque "un `McpServer` + `tsx` en runtime" es necesario (los paquetes internos resuelven `main`/`types` a su código TypeScript fuente, no a un `dist/` compilado — ver comentario en el propio `Dockerfile`), pero **no se ha construido ni ejecutado la imagen realmente**. Antes de confiar en ella, construirla y probarla en una máquina con Docker.
2. **Sin re-registro dinámico de herramientas**: si un proveedor pasa de sano a no sano después de arrancar el servidor MCP, las herramientas ya registradas en el `McpServer` no se retiran hasta reiniciar el proceso (ver ADR 0004). Solo `GET /ready` refleja salud en tiempo real.
3. **Timeout de petición no cancela trabajo en curso**: `middleware/timeout.ts` responde 503 al cliente pero no aborta la promesa subyacente (requeriría propagar `AbortSignal` hasta cada proveedor, fuera de alcance de Fase 1).
4. **Sin pruebas dedicadas** para: redacción real de logs sensibles (se verificó por lectura de código, no por test), correlation id end-to-end en una prueba unitaria propia, y `apps/admin-cli`.
5. **CI no ejecutado en GitHub real todavía**: el workflow existe y los comandos que invoca se probaron localmente uno por uno, pero no hay una corrida real de GitHub Actions que lo confirme (requiere push a un repositorio con Actions habilitado).

## Fase 2 — Jurisprudencia vía entscheidsuche.ch (completada; `bger.ch` directo queda para más adelante)

| Entregable                                                                                                                                                 | Estado                     | Evidencia                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exploración en vivo del MCP remoto (server_info, list_hierarchy, list_facets, search DE/FR/IT, search_by_case_number, fetch_document)                      | **implementado y probado** | 24 llamadas reales contra `https://mcp.entscheidsuche.ch/mcp`; fixtures en `tests/fixtures/entscheidsuche/` (README con el detalle de cada una)                                                                                |
| `docs/providers/entscheidsuche.md` / `docs/provider-contracts/entscheidsuche.md`                                                                           | **implementado**           | contrato técnico completo, incluidos los hallazgos no documentados por el propio servidor (idioma no expuesto, `original_url` siempre nulo en la muestra, `search_by_case_number` no exacto, `list_facets` sin jerarquía real) |
| Modelo de datos: `officialSourceUrl`/`aggregatorUrl`, `language` y `date.decisionOrEnactment` opcionales                                                   | **implementado y probado** | `packages/documents/src/normalizedDocument.ts` + tests; justificado por hallazgos reales, no por especulación                                                                                                                  |
| `EntscheidsucheRemoteClient` (cliente MCP real, timeout, retry+backoff+jitter, circuit breaker, límite de tamaño)                                          | **implementado y probado** | `packages/providers/entscheidsuche/src/remoteClient.ts`; 8 tests con transporte mockeado sobre el SDK oficial real (`remoteClient.test.ts`)                                                                                    |
| `TtlCache` / `CircuitBreaker`                                                                                                                              | **implementado y probado** | 5 + 7 tests unitarios                                                                                                                                                                                                          |
| `OfficialSourceResolver` (SSRF-safe, allowlist configurable)                                                                                               | **implementado y probado** | 11 tests (`officialSourceResolver.test.ts`), incluida protección SSRF con IPs privadas/loopback/públicas crudas construidas en runtime                                                                                         |
| `mapEntscheidsucheDocumentToNormalizedDocument`                                                                                                            | **implementado y probado** | 10 tests con documentos **reales**: federal alemán (BGE 142 III 1), cantonal francés (Vaud), cantonal italiano (Ticino), cantonal alemán (Basilea-Campaña)                                                                     |
| `EntscheidsucheMcpProvider` (7 capacidades + `LegalSourceProvider`)                                                                                        | **implementado y probado** | 18 tests con proveedor remoto falso inyectado (sin red)                                                                                                                                                                        |
| Pruebas de integración real (`RUN_LIVE_INTEGRATION_TESTS=true`)                                                                                            | **implementado y probado** | 8 tests ejecutados contra el servidor real en esta misma sesión (ver comandos finales)                                                                                                                                         |
| `search_cases`, `get_case`, `get_case_metadata`, `search_cases_by_reference`                                                                               | **activas y probadas**     | registradas en `apps/mcp-server/src/tools/entscheidsucheTools.ts`; 8 tests end-to-end vía `InMemoryTransport`+`Client` real (`apps/mcp-server/tests/entscheidsucheTools.test.ts`), incluido "proveedor caído"                  |
| `compare_cases`, `search_cases_by_article`, `extract_case_passages`, `find_supporting_cases`, `find_adverse_cases`, `build_case_line`, `verify_case_quote` | pendiente (deliberado)     | dependen de `packages/citations` (Fase 7) o de capacidades no confirmadas en el índice remoto; no activadas en esta fase por instrucción explícita                                                                             |
| Proveedor `bger` (bger.ch directo)                                                                                                                         | pendiente                  | sin API, fuera del alcance pedido para esta fase (limitada a entscheidsuche.ch + verificación oficial)                                                                                                                         |

### Limitaciones conocidas de Fase 2

1. **`officialSourceUrl` casi nunca se rellena en la práctica**: en el 100% de los documentos observados, `original_url` del proveedor remoto fue `null`. La funcionalidad de `OfficialSourceResolver` está implementada y probada, pero su impacto real hoy es bajo.
2. **`language` es opcional y a menudo ausente**: el esquema remoto no expone el idioma real de un documento; solo se rellena cuando la búsqueda usó `language_filter` de un único idioma (marcado como inferido en `rawMetadata`).
3. **`page` en `search_cases` no es acceso aleatorio real**: el backend remoto solo soporta cursores opacos (`search_after`); pedir `page > 1` implica recorrer páginas anteriores secuencialmente (O(page) llamadas remotas). Documentado en `entscheidsucheProvider.ts`.
4. **`getSourceAttribution()` requiere una llamada previa a `getDocument()`**: a diferencia de `FixtureProvider` (documentos estáticos en memoria), un proveedor remoto real no puede resolver la procedencia de un documento sin haberlo recuperado antes. Tensión conocida con la interfaz síncrona `LegalSourceProvider.getSourceAttribution()`, documentada en el propio código.
5. **El PDF de documentación de API de entscheidsuche.ch sigue sin leerse manualmente** (arrastrado desde Fase 0/1): la implementación se basó en observación directa del contrato real, que resultó suficiente.
6. **No se estresó el servicio real para provocar 429/502/503/504**: por respeto a un servicio de terceros en producción. La clasificación de errores transitorios se probó con transporte mockeado, no contra fallos reales inducidos.
7. **`search_cases_by_article` no se implementó**: no estaba en la lista de herramientas a activar en esta fase (explícitamente excluida por el encargo).

### Comandos ejecutados como evidencia de Fase 2 (todos en la raíz del repo)

```
pnpm format                                              # -> "All matched files use Prettier code style!"
pnpm lint                                                 # -> sin salida (0 problemas)
pnpm typecheck                                            # -> "Done" en 9 paquetes/apps, 0 errores
NODE_ENV=test pnpm test                                   # -> Test Files 21 passed | 1 skipped (22) / Tests 135 passed | 8 skipped (143)
pnpm build                                                # -> apps/mcp-server y apps/admin-cli compilan sin errores
RUN_LIVE_INTEGRATION_TESTS=true NODE_ENV=test pnpm test -- entscheidsuche
                                                           # -> Test Files 22 passed (22) / Tests 143 passed (143)
                                                           #    (incluye las 8 pruebas de integración real contra
                                                           #    https://mcp.entscheidsuche.ch/mcp: healthCheck,
                                                           #    getServerInfo, listHierarchy, searchCases en DE/FR/IT,
                                                           #    get_case real, NotFoundError real)
```

## Fase 3 — Fedlex (completada; legislación cantonal, SECO/BSV/ESTV, Zefix/SHAB quedan fuera de alcance)

| Entregable                                                                                                                                                          | Estado                                                                                                                            | Evidencia                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auditoría en vivo del endpoint SPARQL (JOLux, ELI, RS/SR, RDF, idiomas, vigencia, versiones, Akoma Ntoso)                                                           | **implementado y probado**                                                                                                        | 24 fixtures reales + README en `tests/fixtures/fedlex/`; consultas verificadas en Constitución, Código de Obligaciones, ZGB, ATSG, AVIG, KVG (actual y derogada)   |
| `docs/providers/fedlex.md` / `docs/provider-contracts/fedlex.md`                                                                                                    | **implementado**                                                                                                                  | contrato técnico completo con propiedades JOLux reales, patrones ELI, resolución temporal, hallazgos de seguridad y de ambigüedad de RS/SR                         |
| Modelo de datos: `NormalizedDocument.legislation` (Work/Consolidation/Expression/Manifestation, `inForceStatus`, `amendingActs`, etc.) + `ArticleVersionComparison` | **implementado y probado**                                                                                                        | `packages/documents/src/normalizedDocument.ts`, `packages/documents/src/articleComparison.ts`; 23 tests (17 + 6 nuevos)                                            |
| `packages/shared/{TtlCache,CircuitBreaker}` (extraídos de `entscheidsuche` para reutilizar en Fedlex)                                                               | **implementado y probado**                                                                                                        | movidos de `packages/providers/entscheidsuche` a `packages/shared`, mismos tests                                                                                   |
| `FedlexSparqlClient` (consultas parametrizadas, timeout, retry+backoff+jitter, circuit breaker, caché, límite de tamaño, `ask()`)                                   | **implementado y probado**                                                                                                        | `packages/providers/fedlex/src/sparqlClient.ts`; 26 tests con `fetch` mockeado                                                                                     |
| `FedlexSourceResolver` (SSRF-safe, bloquea explícitamente `intranet.fedlex.admin.ch`)                                                                               | **implementado y probado**                                                                                                        | 13 tests, incluido el caso real de `intranet.fedlex.admin.ch`                                                                                                      |
| `akomaNtosoParser` (XXE-safe, XML-bomb-safe, validación estructural real vía `XMLValidator`, extracción por `eId`)                                                  | **implementado y probado**                                                                                                        | 14 tests contra el documento Akoma Ntoso real de 536KB (232 artículos), incluidos XXE, bomba XML, XML malformado, extracción de letra real (`lbl_a`)               |
| `vocabulary.ts` (idiomas EU, `inForceStatus`, `userFormat`)                                                                                                         | **implementado y probado**                                                                                                        | 10 tests con los códigos reales verificados en vivo (`ROH`, `ENG`, no adivinados)                                                                                  |
| `mapFedlexLawToNormalizedDocument` / `mapFedlexArticleToNormalizedDocument`                                                                                         | **implementado y probado**                                                                                                        | 10 tests con datos derivados de fixtures reales (Constitución vigente, histórica, KVG derogada)                                                                    |
| `FedlexProvider` (`LegislationProvider`: 6 capacidades)                                                                                                             | **implementado y probado**                                                                                                        | 13 tests con `FedlexSparqlClient` falso inyectado (sin red) + 9 tests de integración real (`RUN_LIVE_INTEGRATION_TESTS=true`)                                      |
| `LegislationProviderRegistry` + extensión de `ToolRegistry`/`ToolContext`                                                                                           | **implementado y probado**                                                                                                        | `packages/core/src/legislationProvider.ts`; reutilizado sin romper ningún test de Fase 1/2                                                                         |
| `search_legislation`, `get_law`, `get_article`, `get_article_at_date`, `compare_article_versions`, `get_amendment_history`                                          | **activas y probadas**                                                                                                            | registradas en `apps/mcp-server/src/tools/fedlexTools.ts`; 10 tests end-to-end vía `InMemoryTransport`+`Client` real (`apps/mcp-server/tests/fedlexTools.test.ts`) |
| `get_transitional_provisions`, `verify_legal_citation`, `search_cantonal_legislation`, `identify_applicable_version`, `identify_related_regulations`                | pendiente (deliberado)                                                                                                            | sin soporte real, probado y documentado en esta fase (ver `docs/tool-catalog.md` por qué cada una queda fuera)                                                     |
| Licencia exacta de reutilización de datos Fedlex                                                                                                                    | **bloqueado** para uso comercial/redistribución hasta confirmar el texto literal (arrastrado desde Fase 0, sigue sin confirmarse) |
| Legislación cantonal, SECO/BSV/ESTV, Zefix/SHAB                                                                                                                     | fuera de alcance de Fase 3                                                                                                        | explícitamente excluido por el encargo; queda para Fases 4-6                                                                                                       |

### Hallazgos reales nuevos descubiertos durante Fase 3 (no anticipados en la auditoría de Fase 0)

1. **RS/SR "101" es ambiguo**: identifica tanto la Constitución de 1999 vigente como su predecesora derogada, la Constitución de 1874 (`eli/cc/1/1_1_1`). Descubierto durante la integración en vivo del proveedor, no durante la auditoría inicial — confirma que la reutilización de RS entre una norma y su predecesora es un patrón general, no aislado del caso KVG 832.10 ya conocido.
2. **El corte real de disponibilidad de Akoma Ntoso/XML para la Constitución es `2021-01-01`**, no "30 de mayo de 2022" como se estimó en Fase 0. Localizado escaneando en vivo formato por formato las 38 versiones fechadas reales (`tests/fixtures/fedlex/akoma_ntoso_cutover_scan_constitution.json`).
3. **`bif:contains` (búsqueda de texto libre de Virtuoso) no está disponible**: probado en vivo, rechazado con HTTP 400 "Illegal requests in query". `FILTER(CONTAINS(...))` sí funciona y es rápido con `LIMIT` (confirmado <1s), documentado como limitación real de `search_legislation`.
4. **`fast-xml-parser` es deliberadamente tolerante con XML malformado** (no lanza ante algunas etiquetas mal cerradas); se añadió `XMLValidator.validate()` (función real de la misma librería) como verificación estructural previa al parseo, tras detectar esto durante la propia escritura de pruebas.

### Limitaciones conocidas de Fase 3 (no ocultar)

1. **Sin adaptador de extracción de texto sobre HTML/PDF histórico** (ver ADR 0012): `get_article`/`get_article_at_date`/`compare_article_versions` fallan con `NotFoundError` explícito para cualquier versión sin manifestación XML, en vez de aproximar. Reduce la cobertura práctica de estas tres herramientas al rango con XML real (variable por acto).
2. **`get_amendment_history` nunca rellena `amendingActs`**: Fedlex no expone un predicado real que vincule una `Consolidation` con el acto (OC/AS) que la modificó; solo se reportan las transiciones de fecha observables.
3. **`search_legislation` con `abbreviation` no está implementada**: `ProviderCapabilities.searchByAbbreviation = false`; la herramienta devuelve `ToolDisabledError` explícito si se usa ese parámetro.
4. **El diff de `compare_article_versions` es de grano grueso** (todo el artículo como bloque `modified`/`unchanged`), no por párrafo/letra individual — ver ADR 0013.
5. **Licencia exacta de Fedlex sigue sin confirmarse literalmente** (arrastrado desde Fase 0).
6. **No se implementó ningún proveedor cantonal**: `LegislationProviderRegistry` está preparado (ver ADR 0014) pero solo `fedlex` está registrado.
7. **No se estresó el endpoint real para provocar 429/502/503/504**: por respeto a un servicio público en producción; la clasificación de errores transitorios se probó con `fetch` mockeado.

### Correcciones pendientes de Fase 2, resueltas en Fase 3

1. **PDF de documentación de la API de entscheidsuche.ch, leído íntegramente** (2026-07-26): las 12 páginas se descargaron y leyeron completas. Describe un sistema de scrapers (46, uno por cantón/tribunal federal) + acceso directo a archivos JSON/PDF/HTML (`entscheidsuche.ch/docs/{scraper}/`) + un endpoint Elasticsearch directo (`entscheidsuche.pansoft.de:9200`, el mismo dominio ya observado expuesto en `server_info` en Fase 2) + sitemap. Es un sistema más antiguo y de más bajo nivel que el servidor MCP que `EntscheidsucheMcpProvider` ya integra; confirma y contextualiza las decisiones de Fase 2, no las cambia. No se justifica un cliente adicional contra Elasticsearch/archivos crudos. Ver `docs/provider-contracts/entscheidsuche.md`.
2. **`bger.ch` directo no se implementó en Fase 3** (confirmado): `packages/providers/` solo contiene `entscheidsuche`, `fedlex` y `fixture` — ningún paquete `bger`. Sigue fuera de alcance, sin fecha fijada.
3. **La jurisprudencia sigue dependiendo exclusivamente de un agregador no oficial** (`entscheidsuche.ch`): sin cambios respecto a Fase 2 — `EntscheidsucheMcpProvider` sigue marcado `officialCharacter: "unofficial_aggregator"` y toda respuesta de sus 4 herramientas activas incluye la advertencia correspondiente (`UnofficialSourceWarning`). Fedlex (Fase 3), en cambio, es fuente oficial de primer orden (`officialCharacter: "official"`) — la distinción entre ambos proveedores queda clara en `docs/architecture.md` y en cada resultado devuelto al usuario.

### Comandos ejecutados como evidencia de Fase 3 (todos en la raíz del repo)

```
pnpm format                                              # -> "All matched files use Prettier code style!"
pnpm lint                                                 # -> sin salida (0 problemas)
pnpm typecheck                                            # -> "Done" en 10 paquetes/apps, 0 errores
NODE_ENV=test pnpm test                                   # -> Test Files 28 passed | 2 skipped (30) / Tests 230 passed | 17 skipped (247)
pnpm build                                                # -> apps/mcp-server y apps/admin-cli compilan sin errores
RUN_LIVE_INTEGRATION_TESTS=true pnpm exec vitest run packages/providers/fedlex
                                                           # -> Test Files 7 passed (7) / Tests 86 passed (86)
                                                           #    (incluye las 9 pruebas de integracion real contra
                                                           #    https://fedlex.data.admin.ch/sparqlendpoint:
                                                           #    healthCheck, getLaw por ELI, getArticle Art. 1 real,
                                                           #    getArticleAtDate en cobertura XML real (>=2021-01-01),
                                                           #    getArticle NotFoundError en hueco historico real (2005),
                                                           #    getAmendmentHistory con >30 versiones reales,
                                                           #    searchLegislation con RS ambiguo real (832.10),
                                                           #    AmbiguousCitationError real para RS 101,
                                                           #    NotFoundError real para un RS inexistente)
RUN_LIVE_INTEGRATION_TESTS=true NODE_ENV=test pnpm test -- fedlex
                                                           # -> (el argumento tras "--" no restringe el runner de
                                                           #    vitest en este monorepo; ejecuta la suite completa
                                                           #    con ambas integraciones reales habilitadas)
                                                           #    Test Files 30 passed (30) / Tests 247 passed (247)
```

Ningún comando omitido, ninguna prueba deshabilitada silenciosamente, ninguna capacidad no implementada presentada como si lo estuviera.

### Propuesta de Fase 4 (sin implementar)

No se avanza a Fase 4 en esta sesión, por instrucción explícita. Dos vías posibles, sin decidir cuál priorizar:

1. **Seguir el plan original**: SECO (AVIG-Praxis) / BSV / ESTV, según la tabla de abajo — ninguna de las tres tiene la viabilidad ni la estructura de datos de Fedlex (PDFs monolíticos, sin SPARQL/API), así que requerirá diseño de extracción propio antes de alcanzar la granularidad de párrafo que sí se logró aquí.
2. **Cerrar primero la limitación conocida de Fedlex** (ver ADR 0012): construir el adaptador de extracción de texto sobre HTML/PDF histórico para las versiones anteriores a la cobertura Akoma Ntoso real (variable por acto, ej. `2021-01-01` para la Constitución), ampliando la cobertura práctica de `get_article`/`get_article_at_date`/`compare_article_versions`. Requeriría una auditoría en vivo de la estructura HTML real de esas manifestaciones (siguiendo la misma metodología usada para Akoma Ntoso en esta fase) antes de escribir el parser, para no repetir el error de inventar estructura sin verificarla.

## Revisión arquitectónica pre-Fase 4 (2026-07-26)

Revisión completa solicitada explícitamente antes de iniciar Fase 4, sin implementar funcionalidad nueva. Alcance: modelo normalizado, interfaces de proveedor, Tool Registry, `ProviderCapabilities`, sistema de errores, seguridad, rendimiento, ADRs, deuda técnica y roadmap.

**Veredicto: apto para comenzar Fase 4.** No se encontró ningún error crítico (nada roto, ninguna vulnerabilidad de seguridad, ningún riesgo de pérdida de datos). Se encontraron 2 correcciones demostrables de bajo riesgo, aplicadas en esta misma revisión:

1. `apps/admin-cli` había quedado desincronizado tras Fase 3: nunca registraba `FedlexProvider` ni `LegislationProviderRegistry`, así que el CLI reportaba un estado incompleto del sistema. Corregido en `apps/admin-cli/src/registry.ts` e `index.ts` (mismo patrón que `apps/mcp-server`).
2. ADR 0007 citaba rutas de archivo (`packages/providers/entscheidsuche/src/{cache,circuitBreaker}.ts`) que ya no existen desde que esas clases se movieron a `packages/shared` en Fase 3. Se añadió una nota de actualización sin reescribir la decisión histórica.

Deuda técnica identificada (no corregida en esta revisión, por instrucción explícita — ver justificación de cada punto en el informe entregado en el chat de esta sesión):

- **Alta**: `ProviderRegistry`/`LegislationProviderRegistry` casi duplicados byte a byte; helpers SSRF duplicados entre `OfficialSourceResolver` y `FedlexSourceResolver`; las 10 herramientas MCP tienen el proveedor hardcodeado (bloqueante real para Fase 6, cuando existan proveedores cantonales múltiples); `NormalizedDocument` no tiene bloques de metadatos dedicados para `administrative_circular`/`company_record`/`shab_entry` (solo `legislation` los tiene, con `superRefine`) — relevante de inmediato porque Fase 4 (SECO/BSV/ESTV) es la primera en poblar `administrative_circular` con datos reales; errores internos de Fedlex (`XmlSecurityError`, `FedlexVocabularyError`, `FedlexMappingError`) no forman parte de la jerarquía `LegalMcpError` y escaparían como `INTERNAL_ERROR` genérico.
- **Media**: `TtlCache` sin límite de tamaño ni barrido periódico; `ProviderCapabilities` es booleano puro (no expresa soporte parcial/histórico/experimental); `LegislationSearchQuery.status` solo cubre 2 de los 5 valores reales de `InForceStatus`; nombres de parámetro de fecha inconsistentes entre herramientas hermanas de Fedlex (`date`/`atDate`/`dateBefore`+`dateAfter`); ningún cliente HTTP hace streaming (ya documentado como límite conocido); `normalize()`/`getMetadata()` de `LegalSourceProvider` sin llamadores reales fuera de tests.
- **Baja**: orden de parámetros ligeramente distinto entre `ProviderUnavailableError`/`RateLimitedError`; sin tuning explícito de pool de conexiones HTTP; ADR 0004 no menciona `LegislationProviderRegistry` (información ya cubierta por ADR 0014, no contradictoria).

Recomendación de orden de fases: mantener el plan original (Fase 4 → 5 → 6 → 7 → 8), con una salvedad concreta — antes de mapear datos reales de SECO/BSV/ESTV a `documentType: "administrative_circular"`, decidir si ese tipo necesita un bloque de metadatos dedicado (mirroring `legislation`) para no repetir, por tercera vez, el patrón de campos sueltos sin disciplina de esquema que ya existe para `case`.

## Fase 4 — SECO, BSV, ESTV (completada, 2026-07-27)

Prerrequisitos resueltos antes de implementar (los 3 exigidos, ningún otro): (1) bloque `administrativeCircular` en `NormalizedDocument` (ver ADR 0015); (2) `XmlSecurityError`/`FedlexVocabularyError`/`FedlexMappingError` traducidos a `ProviderResponseError` en `FedlexProvider` antes de llegar al límite MCP; (3) `TtlCache` con `maxEntries`/LRU (ver ADR 0019). Los tres se resolvieron en la revisión arquitectónica pre-Fase 4 (2026-07-26), antes del arranque de esta fase.

| Proveedor/herramienta          | Estado                   | Nota                                                                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proveedor `seco` (AVIG-Praxis) | **completado**           | HTML real de `arbeit.swiss` parseado (`packages/providers/seco`); solo PDFs monolíticos, sin granularidad de párrafo; sin archivo histórico para las Weisungen "núcleo". Ver `docs/provider-contracts/seco.md`.                                                               |
| Proveedor `bsv`                | **completado**           | Estructura real revalidada (portal DNN/2sxc en `sozialversicherungen.admin.ch`, no el 404 de Fase 0); único de los tres con historial de versiones real y descargable por versión. Solo rama IV (carpeta 5661) auditada en profundidad. Ver `docs/provider-contracts/bsv.md`. |
| Proveedor `estv`               | **completado (parcial)** | Portal clásico (`www.estv.admin.ch/de/kreisschreiben-*`) implementado; el sistema JSF de MWST-Infos (`gate.estv.admin.ch`) requiere JavaScript real y queda **fuera de alcance**, documentado como limitación. Ver `docs/provider-contracts/estv.md`.                         |

**Componentes compartidos nuevos** (`packages/shared-web`, ADR 0016/0017): `SecureHttpClient` (SSRF + timeout + reintentos + circuit breaker + redirecciones controladas + límite de tamaño + hash sha256), `parseHtml`/`extractSanitizedText` (cheerio), `extractPdfText` (pdf-parse, con rechazo explícito de PDF no textuales vía `NonTextualDocumentError`), `buildAdministrativeCircularDocument` (normalización compartida), `buildOfficialSourceAttribution`. Generalización de la validación de dominio en `DomainAllowlistResolver` (`packages/shared`), reemplazando la duplicación entre `OfficialSourceResolver`/`FedlexSourceResolver` solo para los proveedores nuevos (Fase 2-3 no se tocaron, fuera de alcance).

**Herramientas MCP activadas (4):** `search_seco_documents`, `search_bsv_documents`, `search_estv_documents`, `get_official_document` (compartida, dispatcher por `provider`, soporta `documentId` o `officialUrl` validada). Registradas en `apps/mcp-server` y `apps/admin-cli` (ambos puntos de entrada sincronizados, ver corrección de Fase 3 más arriba).

**Capacidades reales por proveedor** (prosa, no un campo `ProviderCapabilities` nuevo -- fuera de alcance de Fase 4 resolver esa deuda):

| Capacidad                          | SECO                                 | BSV                                                       | ESTV                                                              |
| ---------------------------------- | ------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Búsqueda de texto libre            | sí (sobre listado HTML)              | sí (sobre listado HTML)                                   | sí (sobre listado HTML, 3 páginas agregadas)                      |
| Historial de versiones descargable | no                                   | **sí** (`?version=N`, verificado 6 versiones reales)      | no (acumulación de entradas independientes por año)               |
| Multilingüe                        | sí (DE/FR, PDF separados por idioma) | sí (`?lang=fr/it` sobre el mismo docId)                   | no (solo DE implementado)                                         |
| Formato                            | PDF únicamente                       | PDF únicamente                                            | PDF únicamente (clásico); HTML+JS en MWST-Infos (no implementado) |
| Relaciones de sustitución          | no expuestas                         | solo en prosa libre del PDF, no extraídas automáticamente | no expuestas                                                      |

**Resultados de pruebas:** `packages/shared-web` 19 tests; `packages/providers/seco` 25 tests + 3 de integración real opcionales; `packages/providers/bsv` 19 tests + 3 de integración real opcionales; `packages/providers/estv` 15 tests + 3 de integración real opcionales; `apps/mcp-server/tests/administrativeTools.test.ts` 7 tests; adiciones a `packages/core`/`packages/shared` (errores tipados nuevos + `DomainAllowlistResolver`) 15 tests. **Las 9 pruebas de integración real (3 por proveedor, `RUN_LIVE_{SECO,BSV,ESTV}_TESTS=true`) se ejecutaron contra las fuentes reales durante esta fase y las 9 pasaron** (healthCheck, searchDocuments y fetchDocument con extracción de texto real, para los tres proveedores).

**Limitaciones y riesgos documentados:**

- ESTV: el sistema JSF de MWST-Infos no está cubierto (requiere Playwright, deliberadamente no implementado -- ver ADR 0017).
- BSV: solo la rama IV (carpeta 5661) se auditó en profundidad; el resto de ramas (AHV, EL, BV, KV, UV, EO, FamZ, International) se asume estructuralmente idéntica pero no verificada individualmente.
- Los tres proveedores dependen de parsing HTML de un sitio no versionado por API -- un cambio de plantilla/CSS en cualquiera de los tres podría romper el parser sin previo aviso; no hay contrato formal con ninguna de las tres fuentes.
- Referencias inconsistentes entre superficies del mismo documento, documentadas y no reconciliadas: BSV ("318.507.13 d KSIR" en el PDF vs. "318.507.31" como Dokumentennummer del portal); ESTV (nombre de archivo vs. aria-label vs. pie de página del PDF, tres formas distintas para el Kreisschreiben Nr. 50a).
- Ningún campo `declaredBindingCharacter` se pobló en ninguno de los tres proveedores: ninguna fuente lo declaró explícitamente durante la auditoría (ver ADR 0015).

## Fase 5 — SHAB y legislación cantonal (Fase 5A + Fase 5B, completa, 2026-07-27)

**Fase 5A** (alcance confirmado con el usuario: Zefix fuera; muestra representativa de 5 cantones, no los 26). **Fase 5B** (cierre explícitamente exigido por el usuario: "Fase 5 todavía no debe considerarse cerrada" — auditar en vivo los 21 cantones restantes, implementar la máxima cobertura verificable, entregar matriz de los 26 con evidencia real, decidir "Fase 5 completa" o "incompleta" antes de proponer Fase 6).

| Proveedor/herramienta                                                                                                    | Estado                                         | Nota                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proveedor `shab`                                                                                                         | **implementado, bloqueado por robots.txt**     | API real confirmada (`/api/v1/publications` de shab.ch/amtsblattportal.ch), pero ambos dominios declaran `Disallow: /` para todo user-agent y no publican terminos de reutilizacion — el proveedor nunca hace peticiones reales, ver `docs/providers/shab.md`. |
| Proveedor `cantonal-*` LexWork (19 cantones: BE, LU, UR, OW, NW, GL, ZG, SH, AR, AI, SG, GR, AG, TG, SO, BS, BL, FR, VS) | **completado y probado en vivo (Fase 5B)**     | Un `CantonalLexWorkProvider` por canton (mismo adaptador, parametrizado por `LEXWORK_CANTONS`). Catálogo, texto completo de la versión vigente y artículo individual reales — `healthCheck()` real ejecutado y pasando para los 19 durante esta fase.          |
| Proveedor `cantonal-zh` (ZH-Lex, Zúrich)                                                                                 | **completado y probado (ampliado en Fase 5B)** | HTML real con número sistemático + fechas de vigencia codificadas en la URL; recupera una ley conocida. Fase 5B añadió `searchDocuments()` real vía el servlet JSON de búsqueda descubierto en esta fase. Sin extracción de artículo (no explorada).           |
| Jurisprudencia cantonal (los 26 cantones)                                                                                | **cubierta (Fase 5B)**                         | Verificado en vivo que `entscheidsuche.ch` (Fase 2, agregador ya aceptado) indexa jurisprudencia real de los 26 cantones (conteos reales por canton) — satisface el criterio sin adaptadores dedicados nuevos.                                                 |
| Proveedor `zefix`                                                                                                        | **fuera de alcance de Fase 5**                 | explícitamente diferido — API REST oficial confirmada en Fase 0 (Swagger), requiere credenciales por email a `zefix@bj.admin.ch`                                                                                                                               |
| Schwyz (SZ)                                                                                                              | auditado, **no implementado**                  | HTML/PDF simple, sin API estructurada                                                                                                                                                                                                                          |
| Neuchâtel (NE), Jura (JU)                                                                                                | auditados, **no implementados**                | Sistema propio ASP.NET, sin API JSON pública; requerirían scraper HTML dedicado                                                                                                                                                                                |
| Ticino (TI), Vaud (VD)                                                                                                   | auditados, **bloqueados** (evidencia real)     | Ticino: HTTP 403 a peticiones automatizadas; Vaud: "Accès non autorisé" a nivel de dominio (incluido su propio robots.txt)                                                                                                                                     |
| Ginebra (GE)                                                                                                             | auditado, **no implementado**                  | interfaz legada JS/frames, complejidad no resuelta en el tiempo disponible (no bloqueo de acceso)                                                                                                                                                              |
| `search_shab_publications`, `get_shab_publication`                                                                       | **implementadas, bloqueadas permanentemente**  | registradas en el catálogo con estado `blocked` explícito, nunca `active`                                                                                                                                                                                      |
| `search_cantonal_legislation`, `get_cantonal_law`                                                                        | **activas y probadas (canton-aware)**          | 19 cantones LexWork + Zúrich; requieren parámetro `canton`, cada respuesta incluye familia/capacidades/limitaciones                                                                                                                                            |
| `get_cantonal_article`                                                                                                   | **activa y probada (canton-aware)**            | Solo los 19 cantones LexWork (real); Zúrich devuelve error explícito de familia no soportada, nunca una aproximación                                                                                                                                           |
| `search_cantonal_cases`, `get_cantonal_case`                                                                             | pendiente                                      | no existe proveedor de jurisprudencia cantonal directo; cobertura ya satisfecha por `entscheidsuche.ch`                                                                                                                                                        |
| `search_companies`, `get_company`, `get_company_people`, `get_company_publications`, `get_company_history`               | pendiente                                      | dependen del proveedor `zefix`, fuera de alcance de Fase 5                                                                                                                                                                                                     |

**Hallazgo de proceso (Fase 5A):** al ejecutar los comandos finales se detectó y corrigió una condición de carrera preexistente en `apps/mcp-server/src/{stdio,http}.ts` (los manejadores de `SIGTERM`/`SIGINT` se registraban después del log de "conectado"/"escuchando"). Se corrigió reordenando el registro antes del log.

**Investigación definitiva en Fase 5B** (exigida explícitamente por el usuario): el residuo de intermitencia tenía DOS causas reales distintas, ambas aisladas con evidencia directa, no por suposición:

1. El test invocaba `npx tsx <archivo>`; `npx` lanza `tsx` como un proceso HIJO propio (npx → tsx → node), de modo que la señal enviada por el test solo llegaba al proceso `npx`, nunca al proceso node real que ejecuta el servidor. Corregido invocando `node --import tsx <archivo>` directamente (un único proceso, confirmado con `ps`).
2. Con la causa 1 corregida, un lote de 15 ejecuciones seguía mostrando 1 fallo sin patrón claro. Depuración directa (`healthCheck()` manual, captura de stdout completa) reveló el mecanismo exacto: el test usa un puerto HTTP fijo (3910); si una ejecución anterior queda interrumpida (p. ej. por el timeout de un comando en lote) sin que su proceso hijo se cierre, ese proceso huérfano sigue ocupando el puerto. La siguiente ejecución del test falla al arrancar con `EADDRINUSE` real (verificado en vivo con `lsof`/logs), muriendo antes de imprimir la línea de "escuchando" — el test entonces falla con "timeout esperando condición", un síntoma que parece intermitente pero cuya causa real es determinista y verificable. Corregido usando `MCP_HTTP_PORT=0` (asignación automática por el sistema operativo, sin colisión posible) y registrando en `http.ts` el puerto REAL asignado (`httpServer.address().port`) en vez del valor de configuración (que sería siempre "0"). Esto requirió relajar `MCP_HTTP_PORT` de `.positive()` a `.nonnegative()` en `packages/shared/src/env.ts` (0 es un valor real y estándar de Node.js, no un error de configuración). Se aumentó además el timeout de espera de arranque de 10s a 45s: bajo carga real del sistema (verificado con `uptime`, no relacionado con este código), arrancar un proceso node completo con todos los registros de proveedores puede tardar más de 10s de forma legítima, sin que eso indique un fallo del cierre ordenado.

Verificación final: 5 ejecuciones consecutivas del test corregido (puerto 0 + timeout 45s), en la misma máquina bajo la misma carga real elevada que producía fallos con la versión anterior — resultados documentados en la entrega final de esta fase.

**Decisión de cierre de Fase 5: FASE 5 COMPLETA**, según el criterio acordado con el usuario (matriz de los 26 cantones con auditoría/clasificación/implementación-o-bloqueo-documentado para todos). Deuda técnica explícita y no oculta: ver sección de Fase 5B más abajo.

## Cierre de cobertura cantonal (Parte A, completo, 2026-07-27)

Exigido explícitamente por el usuario antes de avanzar a cualquier función jurídica avanzada: auditar en vivo los 6 cantones aún sin legislación implementada tras Fase 5B (SZ, NE, JU, TI, VD, GE), implementar la máxima cobertura verificable con acceso público/legítimo/reproducible, y declarar honestamente si 26/26 no fuera alcanzable.

- **`cantonal-sz` (Schwyz)**: implementado y probado en vivo. Colección sistemática real en una página HTML (425 entradas verificadas) + PDF real por acto; un PDF sin capa de texto se rechaza explícitamente (`NonTextualDocumentError`, sin OCR). Ver `docs/provider-contracts/cantonal-sz.md`.
- **`cantonal-ge`/`cantonal-ne` (plataforma SIL, Ginebra/Neuchâtel)**: implementados y probados en vivo. Un único `CantonalSilProvider` compartido y parametrizado — descubrimiento en vivo de que ambos cantones usan la misma plataforma comercial real (ARCHILEXMP sa). Bug de codificación real (charset windows-1252 declarado solo en el HTML, no en la cabecera HTTP) corregido explícitamente. Ver `docs/provider-contracts/cantonal-sil.md`.
- **`cantonal-ju` (Jura)**: implementado parcialmente, probado en vivo. Solo `getDocument` (idn+id ya conocidos, vía GET directo); sin búsqueda real (5 parámetros probados sin efecto). Ver `docs/provider-contracts/cantonal-ju.md`.
- **Ticino (TI), Vaud (VD)**: re-auditados para determinar la causa precisa del bloqueo (no solo constatarlo): F5 BIG-IP WAF real (TI, cookies `TSPD_101`/`BIGipServer*`), muro de acceso de aplicación real (VD, "Accès non autorisé" en su propio portal de publicación). Sin alternativa oficial no-agregador dentro del tiempo de auditoría; LexFind.ch descartado por instrucción explícita del usuario. Regresión verificable con `RUN_LIVE_TI_TESTS`/`RUN_LIVE_VD_TESTS` en `liveIntegration.test.ts`. Ningún intento de evasión de WAF/CAPTCHA.
- **`search_cantonal_legislation`/`get_cantonal_law`**: ampliadas para cubrir también SZ/GE/NE (search+get) y JU (solo get, con parámetro adicional `idn`). Envelope ampliado con `technicalFamily` (renombrado desde `family`), `language`, `documentIdentifier`, `canonicalOfficialUrl`, `contentFormat`, `contentHash`.
- **`get_cantonal_article`**: sin cambios — sigue exclusiva de los 19 cantones LexWork; SZ/SIL/JU devuelven error explícito de familia no soportada, igual que ZH.

**Resultado: 24/26 cantones con legislación implementada** (19 LexWork + ZH parcial + SZ + GE + NE completos + JU parcial); **TI y VD permanecen legítimamente bloqueados — 26/26 no fue alcanzable** con acceso público, legítimo y reproducible, declarado así explícitamente en vez de forzar una implementación o simular acceso. Ver ADR 0025 y `docs/providers/cantonal-legislation.md` (matriz completa actualizada).

**Decisión de cierre: COBERTURA CANTONAL CERRADA (Parte A completa)**, según el criterio acordado con el usuario. Deuda técnica explícita: sin historial de versiones para SZ/SIL/JU; sin `get_cantonal_article` para las 3 familias nuevas; sin búsqueda real para JU; SIL no cubre libros adicionales reales (modificaciones futuras, concordatos, legislación comunal); título de documento de JU no verificado en vivo (expuesto con nota explícita en `rawMetadata.titleSource`).

## Fase 6 — Funciones jurídicas avanzadas (Parte B, COMPLETA, 2026-07-28)

Exigido explícitamente por el usuario, solo una vez validado el cierre de cobertura cantonal (Parte A): convertir swiss-legal-mcp en una herramienta capaz de localizar, validar, relacionar y comparar fuentes jurídicas suizas con trazabilidad completa, **sin añadir ninguna fuente nueva**.

**Revisión previa de capacidades** (exigida antes de implementar): se revisaron identificadores normalizados, citas legislativas/jurisprudenciales, ECLI, números de expediente, BGE/ATF/DTF, RS federal/cantonal, `articlesCited`/`decisionsCited`, fechas de vigencia, versiones históricas y metadatos de procedencia — encontrando que RS+ELI+versión están ricamente modelados solo en Fedlex; BGE/ATF/DTF y número de expediente tienen respaldo real vía autoidentificación + `search_by_case_number`; ECLI y `articlesCited`/`decisionsCited` **nunca** están poblados por ningún proveedor real. Esta revisión determinó directamente el alcance activado. Ver `docs/providers/advanced-legal-functions.md`.

**Paquete `packages/citations`** (nuevo, reutilizable, sin dependencia de proveedores concretos): `parser.ts` (5 tipos de cita reales reconocidos por regex documentada), `normalizer.ts` (forma canónica por tipo), `resolver.ts` (resolución vía puertos genéricos inyectados por el llamador — `CantonalCitationLookupPort`, `CaseLawCitationLookupPort`, `LegislationProviderRegistry`). 29 tests propios (`parser.test.ts` 12, `normalizer.test.ts` 4, `resolver.test.ts` 13).

**7 de las 8 herramientas priorizadas activadas y probadas:** `verify_legal_citation`, `identify_applicable_version`, `search_across_sources`, `extract_legal_passages`, `compare_legal_documents`, `find_cited_sources`, `build_case_citation_network` — ver `docs/tool-catalog.md` (sección "Funciones jurídicas avanzadas") para el detalle de cada una.

**`get_transitional_provisions` NO activada (deliberado)**: `Fedlex.capabilities.transitionalProvisions: false` (nunca verificado); ningún otro proveedor modela el concepto; deducción por heurística de texto explícitamente prohibida por el usuario ("no las deduzcas por contenido"). Mismo precedente que `search_cantonal_cases`/`get_cantonal_case`: documentado como ausente, no registrado como stub.

**Búsqueda semántica**: no implementada, no requerida como infraestructura del servidor — política documentada en ADR 0026.

**Pruebas**: 75 tests offline nuevos (`packages/citations` 29 + `apps/mcp-server/tests/{citationTools,searchAcrossSourcesTools,extractPassagesTools,compareDocumentsTools,citationNetworkTools}.test.ts` 46), 0 fallos, `pnpm typecheck`/`pnpm lint` limpios en las 16 unidades del monorepo (incluida la nueva `packages/citations`). `timeout`/`429`/`502`/`503`/`504`/circuit breaker/caché/SSRF no se duplican por herramienta: cubiertos una sola vez en `packages/shared-web/src/secureHttpClient.test.ts`, mismo criterio que el cierre de cobertura cantonal (ADR 0025).

**Documentación**: `docs/providers/advanced-legal-functions.md` (nuevo), `docs/provider-contracts/citation-resolution.md` (nuevo), ADR 0026, más actualizaciones a `docs/architecture.md`, `docs/tool-catalog.md`, `docs/data-model.md`, `docs/source-audit.md` (sección ECLI reverificada).

**Deuda técnica explícita**: `find_cited_sources`/`build_case_citation_network` dependen enteramente de citation-extraction por regex (5 patrones documentados), no de un parser jurídico completo; `compare_legal_documents` usa diff de párrafos (no estructural) fuera de Fedlex; resolución cantonal de citas requiere `cantonHint` explícito del llamador; texto completo de versiones antiguas/futuras de leyes LexWork sigue sin verificar (heredado de Fase 5B); Zefix sigue bloqueado por credenciales; Ticino/Vaud siguen legítimamente bloqueados.

## Trabajo futuro: síntesis jurisprudencial avanzada y verificación de borradores (no planificado, más allá de las 8 herramientas priorizadas de Fase 6)

Distinto del "Fase 7" que propone el cierre de esta entrega (hardening/auditoría final/release 1.0, ver más abajo) — esto es trabajo de producto adicional, no una fase numerada todavía:

| Herramienta                                                                                                                       | Estado        | Nota                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `compare_cases`, `search_cases_by_article`, `find_supporting_cases`, `find_adverse_cases`, `build_case_line`, `verify_case_quote` | pendiente     | dependen de índices de citas cruzadas de jurisprudencia más maduros que los construidos en Fase 6 (que operan sobre documentos ya identificados, no sobre todo el corpus de `entscheidsuche.ch`) |
| `identify_applicable_law`, `identify_jurisdiction`, `build_legal_source_pack`, `verify_draft_sources`, `create_citation_report`   | pendiente     | herramientas de síntesis que agregan resultados ya verificados de las herramientas de Fase 6, no acceden a fuentes directamente                                                                  |
| `identify_deadlines`                                                                                                              | **bloqueado** | ninguna fuente de plazos procesales identificada en Fase 0; requiere investigación dedicada antes de planificar proveedor                                                                        |

## Nota histórica sobre la propuesta de hardening posterior a Fase 6

Esta sección reemplaza la antigua propuesta "Fase 8 (= Fase 7 en la terminología del cierre de Fase 6)". Ese alcance ya se ejecutó como **Fase 7 — Hardening, exactitud y Release 1.0 local** al inicio de este documento. El resultado actual no es "propuesto/no implementado": el hardening técnico local está completado y la licencia Apache-2.0 ya fue elegida por el propietario.

## Resumen cuantitativo

- Fuentes auditadas en Fase 0: 11 de 12 bloques del encargo (fuentes municipales quedaron explícitamente pendientes de investigar).
- Herramientas MCP catalogadas: 38. **14 activas y probadas** (4 de `entscheidsuche` + 6 de `fedlex` + 4 de `seco`/`bsv`/`estv`), 5 bloqueadas por fuente (BSV desbloqueado en Fase 4), 19 pendientes de fase posterior.
- Infraestructura de Fase 1: 66 tests (sin cambios).
- Proveedor `entscheidsuche` (Fase 2): 59 tests propios del paquete + 8 tests de integración de herramientas en `apps/mcp-server` + 8 tests de integración real opcionales (`RUN_LIVE_INTEGRATION_TESTS=true`) = 75 tests.
- Proveedor `fedlex` (Fase 3): 77 tests propios del paquete (`sparqlClient`, `officialSourceResolver`, `vocabulary`, `mapper`, `akomaNtosoParser`, `fedlexProvider`) + 10 tests de integración de herramientas en `apps/mcp-server` (`fedlexTools.test.ts`) + 9 tests de integración real opcionales (`RUN_LIVE_INTEGRATION_TESTS=true`) = 87 tests nuevos de Fedlex + 9 de `apps/mcp-server`. Tras la revisión arquitectónica pre-Fase 4, `fedlexProvider.test.ts` sumó 2 tests más (traducción de errores internos a `ProviderResponseError`).
- Revisión arquitectónica pre-Fase 4 y prerrequisitos: `normalizedDocument.test.ts` +6 tests (`administrativeCircular`), `errors.test.ts` +1 (ampliado en Fase 4 a +5 con los errores de descarga/seguridad), `ttlCache.test.ts` +4 (límite/LRU) = 12 tests nuevos antes de empezar Fase 4.
- Proveedor `seco` (Fase 4): 25 tests propios del paquete (`listingParser`, `referenceExtractor`, `mapper`, `secoProvider`) + 3 de integración real opcionales.
- Proveedor `bsv` (Fase 4): 19 tests propios del paquete (`folderListingParser`, `documentPageParser`, `referenceExtractor`, `mapper`, `bsvProvider`) + 3 de integración real opcionales.
- Proveedor `estv` (Fase 4): 15 tests propios del paquete (`listingParser`, `referenceExtractor`, `mapper`, `estvProvider`) + 3 de integración real opcionales.
- `packages/shared-web` (Fase 4, nuevo): 19 tests (`secureHttpClient`, `htmlParser`, `pdfTextExtractor`, `administrativeDocumentBuilder`).
- `packages/shared`/`packages/core` (Fase 4, adiciones): `domainAllowlistResolver.test.ts` 10 tests + `errors.test.ts` ampliado con 1 test adicional para los 4 errores nuevos de seguridad/descarga.
- `apps/mcp-server/tests/administrativeTools.test.ts` (Fase 4): 7 tests.
- Total del repositorio tras Fase 4: **339 tests pasando + 26 tests de integración real opcionales** (8 de `entscheidsuche` + 9 de `fedlex` + 3 de `seco` + 3 de `bsv` + 3 de `estv`) = **365 tests en total con todas las integraciones reales habilitadas**, 0 errores de lint, 0 errores de typecheck, formato conforme a Prettier. **Las 26 integraciones reales se ejecutaron durante esta fase y las 26 pasaron.**
- `normalizedDocumentSchema` (Fase 5A, bloque `shabPublication`): +6 tests en `packages/documents`.
- `packages/providers/shab` (Fase 5A, nuevo): 10 tests (`mapper.test.ts` 6 + `shabProvider.test.ts` 4). Sin pruebas de integración real: el proveedor nunca hace peticiones de red por diseño (bloqueado por `robots.txt`), así que no aplica un flag `RUN_LIVE_SHAB_TESTS`.
- `packages/core` (Fase 5B): `toolRegistry.test.ts` +3 tests para `requireAnyProviderIds` ("al menos uno healthy" en sus 3 estados: pending/blocked/active).
- `packages/providers/cantonal` (Fase 5A+5B): `cantonalLexWorkProvider.test.ts` 10 tests (7 Fase 5A + 3 Fase 5B: getDocument, getArticle, getSourceAttribution real) + `cantonalZhProvider.test.ts` 9 tests (7 Fase 5A + 2 Fase 5B: searchDocuments) + `liveIntegration.test.ts` 26 tests de integración real opcionales (`RUN_LIVE_CANTONAL_TESTS=true`): healthCheck real para los 19 cantones LexWork + getDocument/getArticle reales de Berna + healthCheck/fetchDocument/searchDocuments reales de Zúrich.
- `apps/mcp-server/tests/{shabTools,cantonalTools}.test.ts` (Fase 5A+5B): 3 + 9 = 12 tests (`cantonalTools.test.ts` reescrito en Fase 5B para el diseño canton-aware, de 4 a 9 tests).
- Total del repositorio tras Fase 5 (5A+5B): **390 tests pasando + 52 tests de integración real opcionales** (`NODE_ENV=test pnpm test`, ejecutado al cierre: 53 archivos pasando, 6 omitidos, 0 fallos) = **442 tests en total con todas las integraciones reales habilitadas**, 0 errores de lint, 0 errores de typecheck, formato conforme a Prettier, build limpio. **Las 52 integraciones reales (incluidas las 26 nuevas de Fase 5B: healthCheck real de los 19 cantones LexWork + getDocument/getArticle reales de Berna + healthCheck/fetchDocument/searchDocuments reales de Zúrich) se ejecutaron durante esta fase y las 52 pasaron** (`RUN_LIVE_INTEGRATION_TESTS=true RUN_LIVE_SECO_TESTS=true RUN_LIVE_BSV_TESTS=true RUN_LIVE_ESTV_TESTS=true RUN_LIVE_CANTONAL_TESTS=true`: 255 tests, 31 archivos, 0 fallos).
- `packages/providers/cantonal` (cierre de cobertura cantonal): `cantonalSzProvider.test.ts` 11 tests (search por número/query/paginación, catálogo malformado, getDocument+extracción, PDF escaneado rechazado, NotFoundError, getArticle no soportado, healthCheck, caché, getSourceAttribution) + `cantonalSilProvider.test.ts` 10 tests (GE: search+paginación+catálogo malformado+getDocument+charset+NotFoundError+getArticle+healthCheck; NE: search+getDocument+id del proveedor) + `cantonalJuProvider.test.ts` 8 tests (round-trip id, id inválido, PDF escaneado rechazado, getDocument real, NotFoundError, search no soportado, healthCheck, getSourceAttribution) + `liveIntegration.test.ts` ampliado de 26 a 37 tests de integración real opcionales (nuevos: SZ 2, GE 2, NE 2, JU 2, TI 1, VD 1, más 1 chequeo estructural offline de cobertura 26/26 — `RUN_LIVE_SZ_TESTS`/`RUN_LIVE_NE_TESTS`/`RUN_LIVE_GE_TESTS`/`RUN_LIVE_JU_TESTS`/`RUN_LIVE_TI_TESTS`/`RUN_LIVE_VD_TESTS`/`RUN_LIVE_CANTONAL_TESTS`). Total del paquete: 84 tests (48 offline pasando + 36 de integración real opcionales).
- `apps/mcp-server/tests/cantonalTools.test.ts` (cierre de cobertura cantonal): ampliado de 9 a 16 tests (nuevos: routing y envelope para SZ/SIL/JU en las 3 herramientas, incluido el requisito `idn` de Jura y el rechazo explícito de `get_cantonal_article` por familia).
- Total del repositorio tras el cierre de cobertura cantonal: **48 tests offline nuevos** (29 en `packages/providers/cantonal` + 7 en `apps/mcp-server` + 12 de conteo bruto verificado con `vitest run` ejecutado durante esta fase) suman al total de Fase 5. Verificado en esta misma sesión con `NODE_ENV=test pnpm test --testTimeout=30000`: **427 tests pasando, 62 omitidos (opt-in), 0 fallos** (con el timeout por defecto de 5000ms, 11 de esos 427 fallan por timeout puro bajo la carga real elevada de la máquina — verificado re-ejecutándolos aislados y con timeout ampliado: los 11 pasan; ninguno pertenece a `packages/providers/cantonal` ni a `apps/mcp-server/tests/cantonalTools.test.ts`). `pnpm build` limpio (admin-cli + mcp-server). Con `RUN_LIVE_CANTONAL_TESTS=true` (más `RUN_LIVE_TI_TESTS`/`RUN_LIVE_VD_TESTS`), las 37 pruebas de integración real de `packages/providers/cantonal` se ejecutaron 3 veces en esta sesión (aisladas y dentro de un barrido completo) y las 37 pasaron siempre.
- **Barrido final de todas las integraciones reales disponibles** (`RUN_LIVE_INTEGRATION_TESTS=true RUN_LIVE_SECO_TESTS=true RUN_LIVE_BSV_TESTS=true RUN_LIVE_ESTV_TESTS=true RUN_LIVE_CANTONAL_TESTS=true`, exigido por los comandos finales): 489 tests totales, 465 pasando, **24 fallos** — ninguno en `packages/providers/cantonal` ni en las herramientas cantonales de `apps/mcp-server` (verificado explícitamente, cero coincidencias). Los 24 fallos reales se concentran en dos proveedores federales preexistentes, no tocados en esta fase: `entscheidsuche` (7 fallos, `ProviderUnavailableError: Circuit breaker abierto` — el propio circuit breaker del cliente se abrió por el volumen de peticiones reales simultáneas del barrido completo, comportamiento de resiliencia funcionando como está diseñado, no un fallo del proveedor) y `seco` (3 fallos: 2 de integración real por timeout/fallo de red puntual contra `arbeit.swiss`, 1 test con fixture mockeada que superó el timeout por carga de la máquina). No se investigaron a fondo por estar fuera del alcance de esta fase (cierre de cobertura cantonal); quedan documentados aquí sin ocultarlos, no se declaran resueltos.
- Bloqueos activos que requieren acción humana antes de continuar con proveedores reales adicionales: solicitud de credenciales Zefix (explícitamente fuera de alcance de Fase 5); confirmación de licencia exacta de Fedlex (el PDF de entscheidsuche.ch ya se leyó, ver corrección de Fase 2 más arriba). La revalidación de URLs BSV quedó **resuelta en Fase 4**. SHAB queda **bloqueado por política de la fuente** (no por falta de desarrollo) desde Fase 5.
- Bloqueo de infraestructura: verificar el `Dockerfile` y `docker-compose.yml` en una máquina con Docker instalado (no disponible en este entorno de desarrollo, sin cambios desde Fase 1).
- Deuda técnica restante tras Fase 5B (revisada; varios ítems de Fase 5A quedaron resueltos): (1) el mecanismo real de recuperación de texto completo de versiones antiguas/futuras de una ley LexWork no se verificó (solo la versión vigente); (2) `CantonalZhProvider` no implementa extracción de artículo individual (la estructura HTML interna no se exploró a fondo); (3) 6 de los 26 cantones siguen sin legislación implementada (SZ/NE/JU sin API estructurada, TI/VD bloqueados por acceso, GE por complejidad) — cada uno con evidencia real documentada, no genérica; (4) la condición de carrera del registro de manejadores de señal de `apps/mcp-server/src/{stdio,http}.ts` se investigó a fondo en Fase 5B: la causa real era que el test invocaba `npx tsx` (proceso hijo anidado que no reenvía la señal de forma fiable), corregido invocando `node --import tsx` directamente (un único proceso) — ver detalle en comandos finales.
- `packages/citations` (Fase 6, nuevo): `parser.test.ts` 12 tests + `normalizer.test.ts` 4 tests + `resolver.test.ts` 13 tests = 29 tests. Sin pruebas de integración real: el paquete nunca hace peticiones de red por diseño (resolución inyectada por el llamador vía puertos), así que no aplica un flag `RUN_LIVE_CITATIONS_TESTS`.
- `apps/mcp-server/tests/citationTools.test.ts` (Fase 6 + correcciones de exactitud, `verify_legal_citation` + `identify_applicable_version`): 24 tests.
- `apps/mcp-server/tests/searchAcrossSourcesTools.test.ts` (Fase 6): 7 tests.
- `apps/mcp-server/tests/extractPassagesTools.test.ts` (Fase 6): 10 tests.
- `apps/mcp-server/tests/compareDocumentsTools.test.ts` (Fase 6): 5 tests.
- `apps/mcp-server/tests/citationNetworkTools.test.ts` (Fase 6, `find_cited_sources` + `build_case_citation_network`): 9 tests.
- Total del repositorio tras Fase 6: **75 tests offline nuevos** (29 en `packages/citations` + 46 en `apps/mcp-server`), todos verificados en esta sesión: `pnpm exec vitest run packages/citations apps/mcp-server/tests/{citationTools,searchAcrossSourcesTools,extractPassagesTools,compareDocumentsTools,citationNetworkTools}.test.ts` → **75 tests pasando, 0 fallos** (8 archivos). `pnpm typecheck` limpio en las 16 unidades del monorepo (incluida `packages/citations`, nueva). `pnpm lint` limpio sobre todos los archivos de Fase 6. Sin integraciones reales nuevas: Fase 6 reutiliza exclusivamente proveedores ya cubiertos por las integraciones reales existentes (`RUN_LIVE_INTEGRATION_TESTS`/`RUN_LIVE_SECO_TESTS`/`RUN_LIVE_BSV_TESTS`/`RUN_LIVE_ESTV_TESTS`/`RUN_LIVE_CANTONAL_TESTS`, ya ejecutadas en el cierre de cobertura cantonal), no se añadió ningún flag nuevo.
- Deuda técnica de Fase 6 (no oculta): `find_cited_sources`/`build_case_citation_network` dependen enteramente de citation-extraction por regex (5 patrones documentados en `docs/provider-contracts/citation-resolution.md`), no de un parser jurídico completo ni de campos `articlesCited`/`decisionsCited` reales (ningún proveedor los puebla); `compare_legal_documents` usa diff de párrafos (LCS propio) en vez de comparación estructural fuera de Fedlex; la resolución cantonal de una cita requiere que el llamador provea `cantonHint` explícito (sin él, cualquier número sistemático cantonal queda `not_found`, nunca se consultan los 26 proveedores cantonales a la fuerza); `get_transitional_provisions` permanece sin activar por falta de respaldo real en cualquier proveedor.

## Fase 7 / Fase 8 interna — hardening local y release gate (actualizado, 2026-08-03)

Estado: **técnicamente completada para hardening local; Release 1.0 local preparada**. Se implementaron mejoras locales verificables y artefactos de release.

Cambios aplicados:

- Deuda `resolveDocument`: extraída a `apps/mcp-server/src/tools/documentResolver.ts`, compartida por `extract_legal_passages` y `compare_legal_documents`, sin exportarla como API pública.
- Estabilización de tests: `NODE_ENV=test pnpm test` pasa en ejecución normal (`70 passed | 5 skipped`, `540 passed | 62 skipped`).
- Timeouts específicos: los tests PDF pesados de SECO/BSV usan timeout local de 45s para cobertura instrumentada; ESTV conserva timeout local de 15s. No se subió el timeout global.
- Shutdown stdio: el test espera 100 ms tras el log de conectado antes de enviar SIGTERM para evitar una carrera bajo carga real.
- Scripts locales añadidos: `test:coverage`, `test:security`, `test:integration`, `benchmark`, `api:inventory`, `build:verify`, `licenses:check`, `release:prepare`, `release:check`, `ci`.
- Artefactos locales: `docs/release/generated/api-inventory.json`, `sbom.cdx.json`, `pnpm-sbom.cdx.json`, `third-party-licenses.json`, `build-hashes.json`, `benchmark-baseline.json`, checksums y `release-manifest.json`.
- Documentación nueva: `README.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `SUPPORT.md`, `docs/security/`, `docs/release/`, `docs/operations/`, `docs/troubleshooting/`.

Bloqueos del release gate:

- Ningún bloqueo técnico conocido tras Fase 7/Fase 8.

Warnings actuales del release gate:

- 1 paquete fixture de dependencia requiere revisión manual de licencia.
- Docker no está disponible en este entorno local.
- Git no está inicializado.
- La publicación externa no se ha realizado.

Comandos finales relevantes ejecutados:

```
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
NODE_ENV=test pnpm test
pnpm build
pnpm test:coverage
pnpm test:security
pnpm test:integration
pnpm benchmark
pnpm sbom                         # falla: pnpm 11 exige --sbom-format
pnpm run sbom                     # genera docs/release/generated/sbom.cdx.json
pnpm sbom --sbom-format cyclonedx --out docs/release/generated/pnpm-sbom.cdx.json
pnpm licenses:check
pnpm build:verify
pnpm ci                           # comando incorporado de pnpm; ejecuta install limpio
pnpm run ci                       # CI local real; falla al final por release gate BLOCKED
pnpm release:prepare
pnpm release:check                # BLOCKED
pnpm pack --dry-run
```

Docker no se ejecutó: `command -v docker` devolvió código 1 en este entorno.

## Secure updater, encryption and breach detection (actualizado, 2026-08-03)

Estado: implementado como capacidad local manual y no automática; pendiente de operar con un
servicio de distribución real porque no se publica nada desde este repositorio.

- Nuevo paquete interno: `packages/updater`.
- Updater separado del servidor MCP: no se ejecutan actualizaciones dentro de herramientas jurídicas.
- Manifiesto Zod estricto, Ed25519, SHA-256, anti-downgrade, anti-replay, canales `stable`/`rc`/`beta`/`alpha`.
- Descarga controlada por allowlist; tests usan solo servidor local `localhost`.
- Instalación fixture atómica con staging, backup y rollback explícito.
- Cifrado opcional de objetos con AES-256-GCM; derivación con scrypt; rotación probada.
- Detección local de señales de brecha: token inválido repetido, firma inválida, artefacto manipulado, SSRF, traversal, secreto en log, fixture en production, stdout contaminado, downgrade y proveedor anómalo.
- Nuevos comandos: `pnpm test:updater`, `pnpm test:breach-detection`, `pnpm update-security:check`.
- Release gate ampliado con `docs/release/generated/update-security-acceptance.json` y aceptación Claude Desktop.
