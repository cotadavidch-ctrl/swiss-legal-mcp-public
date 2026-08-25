# Funciones jurídicas avanzadas (Fase 6)

Estado: **6 de 8 herramientas priorizadas activadas** (`verify_legal_citation`, `identify_applicable_version`, `search_across_sources`, `extract_legal_passages`, `compare_legal_documents`, `find_cited_sources`, `build_case_citation_network` — 7 activadas; `get_transitional_provisions` **no activada**, ver más abajo). Ninguna añade una fuente nueva: todas reutilizan exclusivamente los proveedores ya integrados en Fases 2-5 y el cierre de cobertura cantonal.

## Revisión previa de capacidades reales (obligatoria antes de implementar)

Antes de escribir cualquier herramienta se revisó qué identificadores/citas están realmente respaldados por datos, no asumidos:

| Concepto                                | Soporte real                  | Evidencia                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RS/SR federal + ELI + versión fechada   | **Real, rico**                | `packages/documents/src/normalizedDocument.ts` (`legislationMetadataSchema`: `eli`, `systematicNumber`, `version.date/endDate/isHistorical`, `inForceStatus`, `entryIntoForceDate`, `repealDate`, `articleLocation`); `FedlexProvider.getLaw`/`getArticleAtDate` ya resuelven por fecha real (`ref.date ?? todayIso()`).                                |
| RS cantonal                             | **Parcial**                   | Cada proveedor cantonal expone su propio número real (`rawMetadata`), pero **sin ELI, sin modelo de versión** — confirmado en los 5 contratos cantonales (`docs/provider-contracts/cantonal-*.md`).                                                                                                                                                     |
| BGE/ATF/DTF                             | **Real (autoidentificación)** | `packages/providers/entscheidsuche/src/mapper.ts` extrae `bgeAtfDtf` del propio id del documento (`extractBgeReference`); `searchByCaseNumber` (ya activa como `search_cases_by_reference`) hace búsqueda de frase exacta real.                                                                                                                         |
| Número de expediente                    | **Real**                      | Misma vía que BGE/ATF/DTF (`searchByCaseNumber`), formato real confirmado en `docs/source-audit.md` (ej. `6B_1234/2025`).                                                                                                                                                                                                                               |
| ECLI                                    | **Ninguno**                   | El campo existe en el esquema (`normalizedDocumentSchema.ecli`) pero **ningún proveedor lo puebla nunca** — Suiza no asigna ECLI de forma sistemática (`docs/source-audit.md`, sección 1).                                                                                                                                                              |
| `articlesCited`/`decisionsCited`        | **Ninguno**                   | Solo el `FixtureProvider` (pruebas) los rellena; ningún proveedor real los expone. `find_cited_sources`/`build_case_citation_network` dependen enteramente de extracción de texto (`packages/citations`), nunca de estos campos salvo que un proveedor real algún día los rellene (el código ya los lee si existen, con `origin: "explicit_metadata"`). |
| Búsqueda por abreviatura (`art. 41 CO`) | **Ninguno**                   | `FedlexProvider` declara `capabilities.searchByAbbreviation: false` explícitamente (no verificado en la auditoría de Fase 3).                                                                                                                                                                                                                           |
| Disposiciones transitorias              | **Ninguno**                   | `FedlexProvider` declara `capabilities.transitionalProvisions: false`; ningún otro proveedor modela el concepto.                                                                                                                                                                                                                                        |

Esta tabla determinó directamente qué se activó y qué no (ver más abajo).

## Paquete `packages/citations`

Paquete reutilizable, sin dependencia de ningún proveedor concreto (solo `@swiss-legal-mcp/core` y `@swiss-legal-mcp/documents`), con tres módulos:

- **`parser.ts`**: reconoce en texto libre 5 formas de cita reales (`systematic_number` RS/SR con puntos, `bge_atf_dtf`, `case_number`, `ecli`, y `unresolvable` para artículo+abreviatura). Patrones documentados con su fuente real; ningún diccionario de abreviatura→RS inventado (no hay dato real que lo respalde).
- **`normalizer.ts`**: forma canónica por tipo (RS sin prefijo de idioma; BGE/ATF/DTF siempre al prefijo `BGE`, igual que `entscheidsuche.ch` autoidentifica sus propios documentos; ECLI en mayúsculas).
- **`resolver.ts`**: resuelve una cita ya parseada contra fuentes reales inyectadas por el llamador vía **puertos genéricos** (`CantonalCitationLookupPort`, `CaseLawCitationLookupPort`, más `LegislationProviderRegistry` para Fedlex) — el paquete nunca importa un proveedor concreto, para mantenerlo reutilizable. Ver `docs/provider-contracts/citation-resolution.md` para el contrato de match/confianza completo.

Los adaptadores reales que conectan estos puertos a los proveedores ya registrados viven en `apps/mcp-server/src/tools/citationSupport.ts` (reutiliza `resolveCantonalProvider` de `cantonalTools.ts` y `EntscheidsucheMcpProvider.searchByCaseNumber`) — no se duplica ninguna lógica de despacho por familia cantonal ya existente.

## Herramientas activadas

### 1. `verify_legal_citation`

Verifica una cita textual única. Envuelve `packages/citations` completo: parsea, normaliza, resuelve, y devuelve `match` (`exact`/`probable`/`ambiguous`/`not_found`), documento resuelto, candidatos alternativos, evidencia y advertencias. `canton` es un parámetro opcional del llamador para desambiguar un número sistemático reutilizado entre jurisdicciones — sin él, un número sistemático que coincide en Fedlex Y en un canton real se declara `ambiguous`, nunca se adivina.

Para jurisprudencia federal, `entscheidsuche.ch` es tratado como agregador secundario. La verificación oficial se expresa por separado en `officialCaseVerification`:

- `officially_verified`: referencia, fecha, sala, materia y pasaje de soporte coinciden con un registro primario de `bger.ch`/`search.bger.ch`.
- `aggregator_only`: la referencia aparece en agregador, pero no hay fuente oficial integrada que la confirme.
- `cantonal_aggregator_only`: decisión cantonal observada solo por agregador; no se presenta como oficial.
- `official_not_found`: no se encontró fuente oficial ni agregador para la referencia.
- `official_mismatch`: el registro oficial existe, pero los metadatos del agregador discrepan; prevalece la fuente oficial y se devuelve warning.
- `unverified_reference`: el identificador no entra en una forma de verificación soportada.

Los casos `1B_352/2019`, `4A_97/2026` y `9C_785/2018` están cubiertos con metadatos y URL oficial trazable de Bundesgericht. Las referencias cantonales `AC/1124/2023`/`DAAJ/117/2023` y `AC/3617/2022`/`DAAJ/97/2023` se mantienen como agregador cantonal mientras no haya fuente oficial cantonal integrada.

### 2. `identify_applicable_version`

Envuelve `FedlexProvider.getLaw`/`getArticleAtDate` (ya reales desde Fase 3) tras resolver el número sistemático de la cita. Para una cita cantonal (`canton` presente) devuelve **siempre** `status: "insufficient_history"` explícito — ningún proveedor cantonal integrado tiene modelo de versión real, nunca se inventa una fecha de vigencia.

La salida incluye `temporalAssessment`, que separa metadatos de fuente (`source_metadata`), estado temporal calculado (`calculated_temporal_status`), aplicabilidad jurídica (`legal_applicability`, siempre `not_determined` sin revisión contextual), confirmación de versión futura (`future_version_confirmation`) e inferencias. `endDate` no se interpreta por sí solo como prueba de versión sustitutiva futura, e `isHistorical` se reporta como metadato, no como conclusión jurídica automática. La confianza se separa en identidad, extracción, aplicabilidad temporal y confirmación futura.

### 3. `search_across_sources`

Fan-out lexico/estructurado real sobre `LegalSourceProvider.search()` (entscheidsuche/SECO/BSV/ESTV) + `LegislationProvider.searchLegislation({systematicNumber})` (Fedlex, solo si `query` tiene forma de número RS/SR real — Fedlex no tiene búsqueda de texto libre real) + un proveedor cantonal si `canton` se indica explícitamente (nunca los 26 a la fuerza). Deduplica por título normalizado; ordena de forma determinista (fuente oficial antes que agregador, después alfabético) — nunca relevancia semántica inventada. Sin embeddings, conforme a política (ver ADR).

### 4. `extract_legal_passages`

Prefiere extracción **estructurada real** (`Fedlex.getArticle`, `CantonalLexWorkProvider.getArticle` — árbol de contenido real) cuando existe (`confidence: "exact"`); si no, cae a una búsqueda de texto real dentro del `fullText` ya descargado (`confidence: "probable"`, `extractionMethod: "text_search_heuristic"`). Nunca descarga contenido nuevo más allá del documento pedido. Si el documento no tiene texto completo real, `insufficient_source_text` explícito.

### 5. `compare_legal_documents`

Diff real de párrafos (LCS determinista, sin dependencia externa) entre dos documentos/artículos ya identificados. `comparisonNature` siempre `"paragraph_diff"` — deliberadamente distinto de `compare_article_versions` (ya activa desde Fase 3), que usa comparación estructural real Akoma Ntoso eId por eId cuando ambas versiones tienen XML real y sigue siendo la opción más precisa cuando aplica.

### 6. `find_cited_sources`

Extrae citas del `fullText` real de un documento ya identificado (mismo parser de `packages/citations`) y las resuelve. **Nunca afirma aplicación/seguimiento/rechazo jurídico** — cada cita detectada expone `origin` (`"text_extraction"` en la práctica; `"explicit_metadata"` solo si el proveedor algún día puebla `articlesCited`/`decisionsCited`) y `match`, nunca un veredicto. Si el documento no tiene texto completo real, `insufficient_source_text`.

### 7. `build_case_citation_network`

Red de **un solo salto** (nunca recursiva/multi-salto) sobre hasta 10 documentos semilla: para cada uno, aplica la misma lógica que `find_cited_sources` y agrega nodos/aristas. Cada arista declara `origin`/`match`/`warnings`; nunca similitud semántica como si fuera una cita real. Si ningún documento semilla tiene texto completo real, `insufficient_source_text` en vez de una red vacía que parezca concluyente.

## Herramienta NO activada: `get_transitional_provisions`

**Deliberadamente no registrada como herramienta MCP.** Motivo real: ningún proveedor integrado modela disposiciones transitorias como estructura identificable — `FedlexProvider.capabilities.transitionalProvisions` es `false` (nunca verificado en la auditoría real de Fase 3), y ningún otro proveedor de legislación declara el concepto. La instrucción del cierre de esta fase es explícita: _"no las deduzcas por contenido"_ — es decir, está prohibido implementar una búsqueda heurística de encabezados como "Übergangsbestimmungen"/"dispositions transitoires" en texto libre, porque eso equivaldría a inventar una capacidad sin respaldo real. Mismo precedente que `search_cantonal_cases`/`get_cantonal_case` (Fase 2/5): documentado como ausente, no registrado como stub.

## Búsqueda semántica

**No implementada, no requerida.** `search_across_sources` es puramente léxico/estructurado (fan-out sobre `search()`/`searchLegislation()` reales + deduplicación + ranking determinista), sin embeddings ni base de datos vectorial, funcionando sin infraestructura externa. Ver ADR 0026 para la política completa (cuándo se justificaría evaluar una capa semántica opcional, y por qué no se activó en esta fase).

## Trazabilidad

Toda herramienta activada devuelve, cuando aplica: proveedor(es) consultado(s) (`providersConsulted`/`evidence`), fuente oficial (`officialSource`), fecha de recuperación (`retrievedAt`), identificador del documento, advertencias explícitas, y nivel de confianza (`match`/`confidence`). Ninguna herramienta genera asesoramiento jurídico, determina quién tiene razón, ni presenta una inferencia como hecho — el modelo de match (`exact`/`probable`/`ambiguous`/`not_found`) existe precisamente para que la incertidumbre real quede expuesta, nunca oculta.
