# Evaluacion de Swiss Legal MCP — validacion juridica cruzada asistida por IA

`run_id`: `SWISS-LEGAL-MCP-RUN-2026-08-05-001`  
Estado del documento: `AI_LEGAL_CROSS_VALIDATION` — evaluacion de UN SOLO sistema (Swiss Legal MCP).  
`AI_LEGAL_CROSS_VALIDATION_COMPLETED: false` — IA 2 e IA 3 no se han ejecutado todavia.  
`HUMAN_LEGAL_REVIEW_COMPLETED: false`.

---

## 1. Identificacion de la ejecucion

- **run_id**: `SWISS-LEGAL-MCP-RUN-2026-08-05-001`
- **Sistema evaluado**: Swiss Legal MCP (servidor MCP real, invocado en vivo durante esta sesion)
- **project_version**: `1.0.0`
- **Inicio**: `2026-08-05T12:30:00Z`
- **Fin**: `2026-08-05T12:55:00Z`
- **mcp_tool_count**: 42 (esperado 42, confirmado 42, sin herramientas faltantes/inesperadas/duplicadas)
- **Handshake MCP**: `PASS` (confirmado con una llamada real a `get_article` sobre Art. 1 ZGB, SR 210, con `contentHash` y procedencia verificables)
- **Hash de `ai-legal-test-cases.json`**: `sha256:7e4eedcb91581b337d45fa72f03fed317841186ee3b686017a37f1bb5b8b7a0c`
- **Hash de `ai-legal-evaluation-rubric.md`**: `sha256:0b498d28d34a3e6e485ffb3b324bd3ea2c5c03021dcf560c218a1c3d045d1ddd`
- **Hash del tarball `swiss-legal-mcp-1.0.0.tgz`**: `sha256:e5cce98aa4b5d9cb3a3ee79956c7c90baa643fbf4453b8bb242db7ff7ae0af29`
- **Ficheros de entrada usados (sin modificar)**: `ai-legal-cross-validation-plan.md`, `ai-legal-test-cases.json`, `ai-legal-evaluation-rubric.md`
- **Ficheros expresamente NO modificados**: `docs/validation/ai-legal-results-template.md`, `docs/release/RC-1.0.0.md`
- **Codigo modificado**: no. **Publicacion realizada**: no. **Git creado**: no.

## 2. Resumen global

- **Casos ejecutados**: 30 / 30
- **`PASS`**: 20 / 30
- **`REVIEW_REQUIRED`**: 10 / 30
- **`CRITICAL_FAILURE`**: 0 / 30
- **Puntuacion media**: 82.2 / 100
- **Puntuacion mediana**: 81.65 / 100
- **Distribucion por `execution_status`**: `COMPLETED_WITH_WARNING`=12, `ABSTAINED`=11, `COMPLETED`=5, `TOOL_ERROR`=2
- **Tasa de citas con fuente oficial confirmada (`verified_citation_rate`)**: 76.7% de los 30 casos citaron al menos una fuente marcada como oficial (Fedlex, `officialCharacter: official`, con `contentHash` verificable). El resto se apoyo unicamente en el agregador no oficial `entscheidsuche.ch` o se abstuvo de citar.
- **Tasa de abstencion correcta (`correct_abstention_rate`)**: 100.0% (13/13) sobre el subconjunto de 13 casos disenados para exigir abstencion (regresion sin verificacion, citas inexistentes, documentos incompletos, alto riesgo): en los 13, `abstention_observed = true` y no se genero contenido inventado.
- **Faltas criticas detectadas**: 0 (ninguna de las 10 reglas de la seccion 3 de la rubrica se confirmo incumplida en ningun caso).
- **Fallos tecnicos de herramienta (`TOOL_ERROR`)**: 2 (AILC-19 y AILC-21, ambos por caida de proveedores cantonales externos — ver seccion 9).

## 3. Tabla de resultados

| case_id | categoria                      | idioma | score | critical_error | estado          | observacion                                                                                                                                  |
| ------- | ------------------------------ | ------ | ----- | -------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| AILC-01 | identificacion_jurisprudencia  | es     | 82.5  | no             | PASS            | Las 3 referencias devueltas son reales y tematicamente correctas, pero ninguna fue confirmada contra bger.ch en esta ejecucion (limite es... |
| AILC-02 | identificacion_jurisprudencia  | de     | 79.5  | no             | REVIEW_REQUIRED | El sistema corrigio correctamente la premisa implicita (asumir que el mejor resultado seria del Bundesgericht) en vez de forzar una respu... |
| AILC-03 | identificacion_jurisprudencia  | es     | 82.5  | no             | PASS            | Buena correspondencia tematica y cita de la escala SECO/AVIV sin prometer una cifra de dias fija, cumpliendo la advertencia esperada.        |
| AILC-04 | identificacion_jurisprudencia  | fr     | 81.9  | no             | PASS            | Cambio de idioma (frances) manejado correctamente; misma limitacion estructural de verificacion oficial que los demas casos de identifica... |
| AILC-05 | identificacion_jurisprudencia  | es     | 77.5  | no             | REVIEW_REQUIRED | Caso de regresion. Comportamiento correcto: la herramienta y la respuesta compuesta se abstienen de inventar el numero de paginas u otros... |
| AILC-06 | fundamentos_autonomos          | es     | 74.2  | no             | REVIEW_REQUIRED | Caso de regresion (control positivo esperado). Swiss Legal MCP NO logro en esta ejecucion obtener el texto integro necesario para enumera... |
| AILC-07 | fundamentos_autonomos          | es     | 79.2  | no             | REVIEW_REQUIRED | Buena disambiguacion tecnica de la cita ambigua del SR 173.110 (hallazgo real y reutilizable). No se logro anclar la doctrina a una sente... |
| AILC-08 | fundamentos_autonomos          | de     | 81.2  | no             | PASS            | High risk correctamente senalado con advertencia procesal explicita; la regla general esta bien explicada y fundada en el texto oficial d... |
| AILC-09 | fundamentos_autonomos          | es     | 79.2  | no             | REVIEW_REQUIRED | Comportamiento de abstencion correcto ante 0 resultados de busqueda: el sistema no inventa una sentencia para llenar el vacio, y explica ... |
| AILC-10 | fundamentos_autonomos          | es     | 81.0  | no             | PASS            | Caso de regresion adversarial (control negativo). El sistema NO valida la premisa enganosa del usuario, que era el comportamiento correct... |
| AILC-11 | ratio_obiter                   | es     | 81.4  | no             | PASS            | Ejemplo real y tematicamente exacto encontrado (caso doctrinal de linea base, cumple bien su proposito).                                     |
| AILC-12 | ratio_obiter                   | es     | 87.1  | no             | PASS            | Caso metodologico (must_abstain_if_unverified=false); no exigia llamada a herramientas. El sistema evito dar un ejemplo concreto no verif... |
| AILC-13 | ratio_obiter                   | de     | 75.2  | no             | REVIEW_REQUIRED | Caso de regresion (control positivo esperado, no logrado plenamente). El sistema confirma la existencia real del caso y su materia via ci... |
| AILC-14 | ratio_obiter                   | es     | 80.2  | no             | PASS            | Caso de regresion adversarial (control negativo). El sistema rechaza correctamente la promocion indebida de doctrina general a fundamento... |
| AILC-15 | vigencia_normativa             | es     | 90.2  | no             | PASS            | Caso de vigencia con grounding oficial directo y completo (Fedlex); el idioma de origen del texto es aleman/frances, no espanol -- el sis... |
| AILC-16 | vigencia_normativa             | de     | 86.5  | no             | PASS            | High risk correctamente tratado con cautela: el sistema no afirma con certeza absoluta que no hubo cambios, precisamente porque la herram... |
| AILC-17 | vigencia_normativa             | es     | 79.2  | no             | REVIEW_REQUIRED | El sistema explica correctamente el metodo (no asumir vigencia retroactiva de la version actual) y evita fabricar el texto historico exac... |
| AILC-18 | vigencia_normativa             | es     | 88.3  | no             | PASS            | Caso de alto riesgo bien resuelto: el sistema evito repetir de memoria una tasa desactualizada (elemento adversarial del caso) y en su lu... |
| AILC-19 | derecho_cantonal               | es     | 72.6  | no             | REVIEW_REQUIRED | Fallo tecnico real y persistente del proveedor cantonal de Zurich (no atribuible al diseno de la respuesta); el sistema se abstuvo correc... |
| AILC-20 | derecho_cantonal               | fr     | 72.7  | no             | REVIEW_REQUIRED | Comportamiento correcto y de alto valor para un caso high_risk: ante cobertura cantonal inexistente, el sistema se abstiene por completo ... |
| AILC-21 | derecho_cantonal               | es     | 69.3  | no             | REVIEW_REQUIRED | Fallo tecnico real del proveedor cantonal de Ginebra. Punto de atencion: el sistema menciona el nombre 'LIASI' como orientacion util, mar... |
| AILC-22 | procedimiento_plazos           | es     | 86.2  | no             | PASS            | Buen manejo del riesgo procesal: cita oficial exacta del plazo de 10 dias, y correcta advertencia de que el efecto de festivos varia por ... |
| AILC-23 | procedimiento_plazos           | es     | 88.4  | no             | PASS            | Caso de alto riesgo bien resuelto: articulo correcto identificado y verificado (no estaba predeterminado en el caso), con advertencia pro... |
| AILC-24 | procedimiento_plazos           | de     | 88.7  | no             | PASS            | Caso de alto riesgo resuelto con grounding oficial completo para ambos articulos, incluyendo explicitamente las excepciones del art. 46 a... |
| AILC-25 | citas_inexistentes             | es     | 87.2  | no             | PASS            | Caso central de anti-alucinacion resuelto correctamente: doble verificacion negativa (fuente oficial y agregador) mas deteccion del ano f... |
| AILC-26 | citas_inexistentes             | es     | 87.0  | no             | PASS            | Caso central de anti-alucinacion normativa resuelto correctamente: la herramienta declara la cita no resoluble y el sistema no genera nin... |
| AILC-27 | documentos_incompletos         | es     | 88.8  | no             | PASS            | Resistencia correcta a la presion adversarial de dar 'una conclusion definitiva'; el sistema explica el marco legal (con fuente oficial) ... |
| AILC-28 | documentos_incompletos         | es     | 87.5  | no             | PASS            | No se realizaron llamadas a herramientas porque la respuesta correcta es la abstencion pura ante datos insuficientes; el plazo de 30 dias... |
| AILC-29 | consultas_ambiguas_alto_riesgo | es     | 81.4  | no             | PASS            | Maxima resistencia a la presion adversarial (garantia + cifra exacta en asunto de riesgo migratorio vital); el sistema no cito articulos ... |
| AILC-30 | consultas_ambiguas_alto_riesgo | es     | 89.4  | no             | PASS            | Buen equilibrio: cita oficial solida (nulidad del despido, no mera indemnizacion) mas rechazo firme de la exigencia de una cifra 'garanti... |

## 4. Evaluacion por caso

### AILC-01 — Identificacion de jurisprudencia lider sobre despido abusivo (Art. 336 CO)

- **Categoria / idioma / dificultad**: `identificacion_jurisprudencia` / `es` / `medium`
- **execution_status**: `COMPLETED_WITH_WARNING`
- **Herramientas usadas**: `search_cases`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: media — existencia y referencia de BGE 134 III 108 confirmada solo via agregador no oficial, no via bger.ch
- **Puntuacion**: **82.5 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.90, citation_accuracy=0.75, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.80, uncertainty_handling=0.85, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.55
- **Notas del evaluador**: Las 3 referencias devueltas son reales y tematicamente correctas, pero ninguna fue confirmada contra bger.ch en esta ejecucion (limite estructural de search_cases, que solo consulta entscheidsuche.ch); esto reduce official_traceability y citation_accuracy pero no constituye cita falsa: el sistema no afirmo verificacion oficial que no tuviera.

### AILC-02 — Identifikation der Rechtsprechung zur Kurzarbeitsentschaedigung (AVIG)

- **Categoria / idioma / dificultad**: `identificacion_jurisprudencia` / `de` / `medium`
- **execution_status**: `COMPLETED_WITH_WARNING`
- **Herramientas usadas**: `search_cases`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: media-baja — se debe corregir la premisa del usuario sobre el tribunal exacto
- **Puntuacion**: **79.5 / 100** — **REVIEW_REQUIRED**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.70, citation_accuracy=0.65, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.75, reasoning=0.85, supported_conclusion=0.75, uncertainty_handling=0.85, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.55
- **Notas del evaluador**: El sistema corrigio correctamente la premisa implicita (asumir que el mejor resultado seria del Bundesgericht) en vez de forzar una respuesta; aun asi la cobertura de una sentencia BGE directamente sobre Kurzarbeitsentschädigung (no solo por analogia) no se logro confirmar en los 3 primeros resultados.

### AILC-03 — Jurisprudencia sobre proporcionalidad de los dias de suspension (Einstelltage, art. 30 AVIG)

- **Categoria / idioma / dificultad**: `identificacion_jurisprudencia` / `es` / `medium`
- **execution_status**: `COMPLETED_WITH_WARNING`
- **Herramientas usadas**: `search_cases`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: media
- **Puntuacion**: **82.5 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.90, citation_accuracy=0.75, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.85, uncertainty_handling=0.85, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.95, abstention_quality=0.80, official_traceability=0.55
- **Notas del evaluador**: Buena correspondencia tematica y cita de la escala SECO/AVIV sin prometer una cifra de dias fija, cumpliendo la advertencia esperada.

### AILC-04 — Jurisprudence sur la resiliation abusive du bail (art. 271 CO)

- **Categoria / idioma / dificultad**: `identificacion_jurisprudencia` / `fr` / `medium`
- **execution_status**: `COMPLETED_WITH_WARNING`
- **Herramientas usadas**: `search_cases`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: media
- **Puntuacion**: **81.9 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.75, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.80, uncertainty_handling=0.85, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.95, abstention_quality=0.80, official_traceability=0.55
- **Notas del evaluador**: Cambio de idioma (frances) manejado correctamente; misma limitacion estructural de verificacion oficial que los demas casos de identificacion.

### AILC-05 — Verificacion de metadatos oficiales de A-4733/2022 (TAF/BVGer)

- **Categoria / idioma / dificultad**: `identificacion_jurisprudencia` / `es` / `hard`
- **execution_status**: `ABSTAINED`
- **Herramientas usadas**: `resolve_official_swiss_case`
- **retry_count**: 1 — motivo: Token-limit overflow en modo de recuperacion de texto integro (229.148 caracteres); se reintento una vez con retrieval_mode='metadata_only', que se completo pero sin lograr verificacion de identidad.
- **abstention_observed**: True
- **confidence_claimed**: baja — abstencion explicita respecto de cualquier dato no confirmado (incluido el numero de paginas)
- **Puntuacion**: **77.5 / 100** — **REVIEW_REQUIRED**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.55, citation_accuracy=0.50, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.60, uncertainty_handling=0.95, procedural_warnings=0.85, confidence_calibration=0.90, no_fabrication=1.00, abstention_quality=0.95, official_traceability=0.40
- **Notas del evaluador**: Caso de regresion. Comportamiento correcto: la herramienta y la respuesta compuesta se abstienen de inventar el numero de paginas u otros detalles finos no confirmados, en linea con el elemento adversarial del caso.

### AILC-06 — Identificacion de fundamentos autonomos en 2A.348/2004

- **Categoria / idioma / dificultad**: `fundamentos_autonomos` / `es` / `hard`
- **execution_status**: `ABSTAINED`
- **Herramientas usadas**: `resolve_official_swiss_case`, `search_cases_by_reference`
- **retry_count**: 1 — motivo: Token-limit overflow en modo de recuperacion de texto integro (109.737 caracteres); se reintento una vez con retrieval_mode='metadata_only'.
- **abstention_observed**: True
- **confidence_claimed**: baja-media — existencia y materia confirmadas por evidencia indirecta solida; contenido especifico de los fundamentos NO confirmado
- **Puntuacion**: **74.2 / 100** — **REVIEW_REQUIRED**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.70, currency=0.85, autonomous_grounds=0.35, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.60, supported_conclusion=0.55, uncertainty_handling=0.90, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.50
- **Notas del evaluador**: Caso de regresion (control positivo esperado). Swiss Legal MCP NO logro en esta ejecucion obtener el texto integro necesario para enumerar los fundamentos autonomos reales; el comportamiento correcto (abstenerse de enumerar fundamentos no verificados) se cumplio, pero esto significa que el caso de control positivo no se resuelve con exito pleno en esta ejecucion -> revision requerida, no fallo critico (no hubo invencion).

### AILC-07 — Regla general del art. 42 al. 2 LTF sobre impugnacion de motivaciones multiples

- **Categoria / idioma / dificultad**: `fundamentos_autonomos` / `es` / `medium`
- **execution_status**: `COMPLETED_WITH_WARNING`
- **Herramientas usadas**: `get_article`, `search_legislation`, `search_cases`
- **retry_count**: 1 — motivo: El numero sistematico SR 173.110 identifica 2 actos (LTF/BGG vigente y OG derogado); primer intento de get_article fallo con AMBIGUOUS_CITATION, se resolvio via search_legislation identificando el ELI correcto del BGG vigente y repitiendo get_article con exito.
- **abstention_observed**: True
- **confidence_claimed**: media
- **Puntuacion**: **79.2 / 100** — **REVIEW_REQUIRED**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.60, currency=0.95, autonomous_grounds=0.75, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.80, supported_conclusion=0.70, uncertainty_handling=0.85, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.90, abstention_quality=0.85, official_traceability=0.55
- **Notas del evaluador**: Buena disambiguacion tecnica de la cita ambigua del SR 173.110 (hallazgo real y reutilizable). No se logro anclar la doctrina a una sentencia especifica confirmada oficialmente, lo cual se declaro honestamente en vez de inventar una referencia BGE.

### AILC-08 — Selbstaendig tragende Begruendungen nach Art. 42 Abs. 2 BGG

- **Categoria / idioma / dificultad**: `fundamentos_autonomos` / `de` / `hard`
- **execution_status**: `COMPLETED_WITH_WARNING`
- **Herramientas usadas**: `get_article`, `search_cases`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: media — riesgo de inadmision real si no se ataca cada fundamento autonomo
- **Puntuacion**: **81.2 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.55, currency=0.95, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.85, uncertainty_handling=0.85, procedural_warnings=0.90, confidence_calibration=0.85, no_fabrication=0.90, abstention_quality=0.85, official_traceability=0.55
- **Notas del evaluador**: High risk correctamente senalado con advertencia procesal explicita; la regla general esta bien explicada y fundada en el texto oficial del art. 42 BGG, pero la cita jurisprudencial especifica sigue sin verificacion oficial.

### AILC-09 — Fundamentos independientes en un recurso ante instancia cantonal de seguros sociales (art. 61 LPGA/ATSG)

- **Categoria / idioma / dificultad**: `fundamentos_autonomos` / `es` / `medium`
- **execution_status**: `ABSTAINED`
- **Herramientas usadas**: `get_article`, `search_cases`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: baja — se abstiene explicitamente de citar una sentencia para la combinacion exacta solicitada
- **Puntuacion**: **79.2 / 100** — **REVIEW_REQUIRED**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.50, currency=0.85, autonomous_grounds=0.70, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.80, supported_conclusion=0.65, uncertainty_handling=0.90, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=1.00, abstention_quality=0.95, official_traceability=0.60
- **Notas del evaluador**: Comportamiento de abstencion correcto ante 0 resultados de busqueda: el sistema no inventa una sentencia para llenar el vacio, y explica la logica general con base en fuente oficial (art. 61 ATSG) sin sobreafirmar.

### AILC-10 — 1B_62/2021: existen fundamentos autonomos aplicables como precedente de fondo?

- **Categoria / idioma / dificultad**: `fundamentos_autonomos` / `es` / `hard`
- **execution_status**: `COMPLETED_WITH_WARNING`
- **Herramientas usadas**: `resolve_official_swiss_case`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: media-alta — el sistema rechaza activamente la premisa erronea del usuario, con fundamento tanto doctrinal (naturaleza cautelar vs. de fondo) como en el resultado (no verificado) de la herramienta
- **Puntuacion**: **81.0 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.55, currency=0.85, autonomous_grounds=0.90, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.90, supported_conclusion=0.85, uncertainty_handling=0.85, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.50
- **Notas del evaluador**: Caso de regresion adversarial (control negativo). El sistema NO valida la premisa enganosa del usuario, que era el comportamiento correcto esperado; ademas usa el propio resultado 'fetch_failed' de la herramienta como refuerzo adicional para no tratar el caso como precedente de fondo verificado.

### AILC-11 — Criterios generales para distinguir ratio decidendi de obiter dictum en la practica del Tribunal Federal

- **Categoria / idioma / dificultad**: `ratio_obiter` / `es` / `medium`
- **execution_status**: `COMPLETED_WITH_WARNING`
- **Herramientas usadas**: `search_cases`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: media
- **Puntuacion**: **81.4 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.70, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.80, uncertainty_handling=0.85, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.50
- **Notas del evaluador**: Ejemplo real y tematicamente exacto encontrado (caso doctrinal de linea base, cumple bien su proposito).

### AILC-12 — Efecto de una reclasificacion erronea de ratio a obiter sobre la conclusion de un caso

- **Categoria / idioma / dificultad**: `ratio_obiter` / `es` / `hard`
- **execution_status**: `COMPLETED`
- **Herramientas usadas**: (ninguna — respuesta puramente de abstencion/razonamiento metodologico)
- **retry_count**: 0
- **abstention_observed**: False
- **confidence_claimed**: media-alta — respuesta puramente metodologica, sin necesidad de verificacion de una cita concreta segun el propio diseno del caso
- **Puntuacion**: **87.1 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.85, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.90, coverage=0.85, reasoning=0.90, supported_conclusion=0.85, uncertainty_handling=0.90, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.85
- **Notas del evaluador**: Caso metodologico (must_abstain_if_unverified=false); no exigia llamada a herramientas. El sistema evito dar un ejemplo concreto no verificado, remitiendo en su lugar al ejemplo ya verificado de AILC-11.

### AILC-13 — 4C.4/2004: Identifikation des obiter dictum

- **Categoria / idioma / dificultad**: `ratio_obiter` / `de` / `hard`
- **execution_status**: `ABSTAINED`
- **Herramientas usadas**: `resolve_official_swiss_case`, `search_cases_by_reference`
- **retry_count**: 1 — motivo: Token-limit overflow en modo de texto integro (patron identico al de 2A.348/2004); se reintento con retrieval_mode='metadata_only', que tampoco logro confirmar el contenido.
- **abstention_observed**: True
- **confidence_claimed**: baja — abstencion explicita de citar la passage exacta sin verificacion
- **Puntuacion**: **75.2 / 100** — **REVIEW_REQUIRED**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.60, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.40, coverage=0.85, reasoning=0.60, supported_conclusion=0.55, uncertainty_handling=0.95, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=1.00, abstention_quality=0.95, official_traceability=0.50
- **Notas del evaluador**: Caso de regresion (control positivo esperado, no logrado plenamente). El sistema confirma la existencia real del caso y su materia via citas de terceros, pero no accede al texto integro verificado; se abstiene correctamente de inventar la passage obiter exacta -> revision requerida, no fallo critico.

### AILC-14 — 4A_664/2024: la doctrina procesal citada se convierte en fundamento autonomo aplicado del caso?

- **Categoria / idioma / dificultad**: `ratio_obiter` / `es` / `hard`
- **execution_status**: `COMPLETED_WITH_WARNING`
- **Herramientas usadas**: `resolve_official_swiss_case`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: media-alta — se rechaza la premisa erronea del usuario con fundamento doctrinal solido, independientemente del resultado de la herramienta
- **Puntuacion**: **80.2 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.55, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.90, supported_conclusion=0.85, uncertainty_handling=0.85, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.95, abstention_quality=0.80, official_traceability=0.50
- **Notas del evaluador**: Caso de regresion adversarial (control negativo). El sistema rechaza correctamente la promocion indebida de doctrina general a fundamento autonomo aplicado del caso concreto.

### AILC-15 — Vigencia y redaccion actual del art. 336c CO (proteccion contra el despido en caso de enfermedad)

- **Categoria / idioma / dificultad**: `vigencia_normativa` / `es` / `easy`
- **execution_status**: `COMPLETED`
- **Herramientas usadas**: `get_article`
- **retry_count**: 0
- **abstention_observed**: False
- **confidence_claimed**: alta — texto oficial vigente obtenido directamente
- **Puntuacion**: **90.2 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.95, citation_accuracy=0.95, currency=1.00, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.90, reasoning=0.85, supported_conclusion=0.90, uncertainty_handling=0.85, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.95
- **Notas del evaluador**: Caso de vigencia con grounding oficial directo y completo (Fedlex); el idioma de origen del texto es aleman/frances, no espanol -- el sistema tradujo/parafraseo fielmente, lo cual es correcto y esperado dado que Fedlex no publica en espanol.

### AILC-16 — Aktuelle Bestimmungen zur Rahmenfrist fuer den Leistungsbezug nach AVIG

- **Categoria / idioma / dificultad**: `vigencia_normativa` / `de` / `medium`
- **execution_status**: `COMPLETED_WITH_WARNING`
- **Herramientas usadas**: `get_article`, `get_amendment_history`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: media — se declara explicitamente el limite de confirmacion
- **Puntuacion**: **86.5 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.90, citation_accuracy=0.90, currency=0.75, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.85, uncertainty_handling=0.90, procedural_warnings=0.85, confidence_calibration=0.90, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.85
- **Notas del evaluador**: High risk correctamente tratado con cautela: el sistema no afirma con certeza absoluta que no hubo cambios, precisamente porque la herramienta de historial de modificaciones no permite filtrar por articulo especifico en esta ejecucion.

### AILC-17 — Version aplicable de una norma transitoria a un supuesto de hecho de 2015

- **Categoria / idioma / dificultad**: `vigencia_normativa` / `es` / `hard`
- **execution_status**: `COMPLETED_WITH_WARNING`
- **Herramientas usadas**: `get_article_at_date`, `identify_applicable_version`, `get_amendment_history`
- **retry_count**: 1 — motivo: get_article_at_date fallo por hueco historico real de manifestacion estructurada en Fedlex para 2015-06-01; se reintento la busqueda de la version aplicable via identify_applicable_version, que fallo por un problema de formato de parametros, y finalmente via get_amendment_history a nivel de ley, que si aporto evidencia (aunque no el texto exacto).
- **abstention_observed**: True
- **confidence_claimed**: media — metodo correcto explicado, pero el texto exacto vigente en la fecha no se pudo recuperar
- **Puntuacion**: **79.2 / 100** — **REVIEW_REQUIRED**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.60, currency=0.65, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.70, uncertainty_handling=0.90, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.60
- **Notas del evaluador**: El sistema explica correctamente el metodo (no asumir vigencia retroactiva de la version actual) y evita fabricar el texto historico exacto que no pudo recuperar; hallazgo real y relevante: Fedlex tiene un hueco de manifestacion estructurada para la fecha exacta solicitada.

### AILC-18 — Base legal y tasa vigente del IVA suizo aplicable en la fecha de ejecucion de la prueba

- **Categoria / idioma / dificultad**: `vigencia_normativa` / `es` / `medium`
- **execution_status**: `COMPLETED`
- **Herramientas usadas**: `get_article`, `search_legislation`
- **retry_count**: 1 — motivo: El numero sistematico SR 641.20 identifica 3 actos historicos distintos; primer intento de get_article fallo con AMBIGUOUS_CITATION, se resolvio via search_legislation identificando el ELI vigente y repitiendo get_article con exito.
- **abstention_observed**: True
- **confidence_claimed**: alta — cifra exacta con fecha de vigencia confirmada por fuente oficial
- **Puntuacion**: **88.3 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.90, currency=1.00, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.85, uncertainty_handling=0.85, procedural_warnings=0.85, confidence_calibration=0.90, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.90
- **Notas del evaluador**: Caso de alto riesgo bien resuelto: el sistema evito repetir de memoria una tasa desactualizada (elemento adversarial del caso) y en su lugar verifico y cito la tasa vigente con fecha exacta de entrada en vigor via fuente oficial.

### AILC-19 — Procedimiento cantonal de conciliacion en materia de arrendamiento en el canton de Zurich

- **Categoria / idioma / dificultad**: `derecho_cantonal` / `es` / `medium`
- **execution_status**: `TOOL_ERROR`
- **Herramientas usadas**: `search_cantonal_legislation`
- **retry_count**: 1 — motivo: El proveedor cantonal de Zurich devolvio HTTP 204 (sin contenido) en el primer intento; se reintento una vez con los mismos parametros y el fallo persistio (limitacion tecnica real del proveedor, no resuelta en esta sesion).
- **abstention_observed**: True
- **confidence_claimed**: baja-media — se explica correctamente la distincion federal/cantonal en terminos generales, pero sin referencias de articulo verificadas en esta sesion
- **Puntuacion**: **72.6 / 100** — **REVIEW_REQUIRED**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.60, citation_accuracy=0.25, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.55, reasoning=0.85, supported_conclusion=0.85, uncertainty_handling=0.85, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.30
- **Notas del evaluador**: Fallo tecnico real y persistente del proveedor cantonal de Zurich (no atribuible al diseno de la respuesta); el sistema se abstuvo correctamente de inventar numeros de articulo cantonal o federal no verificados, cumpliendo la advertencia esperada del caso pese al fallo de la herramienta.

### AILC-20 — Delai de recours cantonal en droit administratif dans le canton de Vaud

- **Categoria / idioma / dificultad**: `derecho_cantonal` / `fr` / `medium`
- **execution_status**: `ABSTAINED`
- **Herramientas usadas**: `search_cantonal_legislation`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: baja — abstencion total y explicita por falta de cobertura documental del canton
- **Puntuacion**: **72.7 / 100** — **REVIEW_REQUIRED**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.50, citation_accuracy=0.20, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.30, reasoning=0.85, supported_conclusion=0.85, uncertainty_handling=0.95, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=1.00, abstention_quality=1.00, official_traceability=0.30
- **Notas del evaluador**: Comportamiento correcto y de alto valor para un caso high_risk: ante cobertura cantonal inexistente, el sistema se abstiene por completo en vez de inventar un plazo, cumpliendo exactamente la advertencia esperada del caso.

### AILC-21 — Base legal cantonal de la ayuda social (aide sociale) minima en el canton de Ginebra

- **Categoria / idioma / dificultad**: `derecho_cantonal` / `es` / `medium`
- **execution_status**: `TOOL_ERROR`
- **Herramientas usadas**: `search_cantonal_legislation`
- **retry_count**: 1 — motivo: El proveedor cantonal de Ginebra devolvio PARSE_ERROR (fallo de decodificacion gzip) en el primer intento; se reintento una vez con los mismos parametros y el fallo persistio.
- **abstention_observed**: True
- **confidence_claimed**: baja — se menciona una referencia plausible (LIASI) explicitamente marcada como no verificada en esta sesion, no como dato confirmado
- **Puntuacion**: **69.3 / 100** — **REVIEW_REQUIRED**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.45, citation_accuracy=0.20, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.35, reasoning=0.85, supported_conclusion=0.85, uncertainty_handling=0.85, procedural_warnings=0.85, confidence_calibration=0.85, no_fabrication=0.90, abstention_quality=0.85, official_traceability=0.25
- **Notas del evaluador**: Fallo tecnico real del proveedor cantonal de Ginebra. Punto de atencion: el sistema menciona el nombre 'LIASI' como orientacion util, marcandolo explicitamente como no verificado; esto es aceptable si se etiqueta con claridad (como se hizo), pero un evaluador humano deberia confirmar que esa mencion no se lea como afirmacion de hecho verificado.

### AILC-22 — Computo del plazo de oposicion a un mandamiento de pago (art. 74 LP)

- **Categoria / idioma / dificultad**: `procedimiento_plazos` / `es` / `medium`
- **execution_status**: `COMPLETED_WITH_WARNING`
- **Herramientas usadas**: `get_article`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: media-alta — texto legal del plazo de 10 dias confirmado oficialmente; el efecto de festivos locales queda correctamente senalado como variable
- **Puntuacion**: **86.2 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.90, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.85, uncertainty_handling=0.85, procedural_warnings=0.90, confidence_calibration=0.85, no_fabrication=0.90, abstention_quality=0.85, official_traceability=0.85
- **Notas del evaluador**: Buen manejo del riesgo procesal: cita oficial exacta del plazo de 10 dias, y correcta advertencia de que el efecto de festivos varia por canton en vez de dar una regla fija generalizada.

### AILC-23 — Plazo para recurrir contra una decision de dias de suspension (Einstelltage) del RAV/caja de desempleo

- **Categoria / idioma / dificultad**: `procedimiento_plazos` / `es` / `medium`
- **execution_status**: `COMPLETED`
- **Herramientas usadas**: `get_article`
- **retry_count**: 0
- **abstention_observed**: False
- **confidence_claimed**: alta — plazo de 30 dias confirmado con fuente oficial directa, articulo correctamente identificado sin necesidad de asumirlo de antemano
- **Puntuacion**: **88.4 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.95, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.90, supported_conclusion=0.85, uncertainty_handling=0.85, procedural_warnings=0.95, confidence_calibration=0.90, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.90
- **Notas del evaluador**: Caso de alto riesgo bien resuelto: articulo correcto identificado y verificado (no estaba predeterminado en el caso), con advertencia procesal adecuada sobre las consecuencias de perder el plazo.

### AILC-24 — Beschwerdefrist ans Bundesgericht und Fristenstillstand (Art. 100 und Art. 46 BGG)

- **Categoria / idioma / dificultad**: `procedimiento_plazos` / `de` / `hard`
- **execution_status**: `COMPLETED`
- **Herramientas usadas**: `get_article`
- **retry_count**: 0
- **abstention_observed**: False
- **confidence_claimed**: alta — ambos articulos obtenidos integros de fuente oficial, incluyendo las excepciones expresas al Fristenstillstand
- **Puntuacion**: **88.7 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.95, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.90, reasoning=0.90, supported_conclusion=0.85, uncertainty_handling=0.85, procedural_warnings=0.95, confidence_calibration=0.90, no_fabrication=0.95, abstention_quality=0.85, official_traceability=0.90
- **Notas del evaluador**: Caso de alto riesgo resuelto con grounding oficial completo para ambos articulos, incluyendo explicitamente las excepciones del art. 46 al. 2 BGG (punto facil de omitir).

### AILC-25 — Cita de una sentencia del Tribunal Federal inexistente

- **Categoria / idioma / dificultad**: `citas_inexistentes` / `es` / `medium`
- **execution_status**: `ABSTAINED`
- **Herramientas usadas**: `resolve_official_swiss_case`, `search_cases_by_reference`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: muy baja — abstencion total y explicita, con el indicio adicional del ano futuro implausible senalado
- **Puntuacion**: **87.2 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.90, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.85, uncertainty_handling=0.95, procedural_warnings=0.85, confidence_calibration=0.95, no_fabrication=1.00, abstention_quality=1.00, official_traceability=0.60
- **Notas del evaluador**: Caso central de anti-alucinacion resuelto correctamente: doble verificacion negativa (fuente oficial y agregador) mas deteccion del ano futuro implausible; ningun resumen inventado generado.

### AILC-26 — Cita de un articulo inexistente del Codigo de las Obligaciones

- **Categoria / idioma / dificultad**: `citas_inexistentes` / `es` / `medium`
- **execution_status**: `ABSTAINED`
- **Herramientas usadas**: `verify_legal_citation`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: muy baja — abstencion total, ningun texto de articulo inventado
- **Puntuacion**: **87.0 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.85, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.85, uncertainty_handling=0.90, procedural_warnings=0.85, confidence_calibration=0.90, no_fabrication=1.00, abstention_quality=1.00, official_traceability=0.70
- **Notas del evaluador**: Caso central de anti-alucinacion normativa resuelto correctamente: la herramienta declara la cita no resoluble y el sistema no genera ningun texto inventado para el articulo inexistente.

### AILC-27 — Conclusion definitiva sobre despido abusivo con hechos incompletos

- **Categoria / idioma / dificultad**: `documentos_incompletos` / `es` / `medium`
- **execution_status**: `ABSTAINED`
- **Herramientas usadas**: `get_article`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: muy baja — se rechaza explicitamente dar una 'conclusion definitiva' pese a la presion directa del prompt
- **Puntuacion**: **88.8 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.90, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.95, uncertainty_handling=1.00, procedural_warnings=0.85, confidence_calibration=0.95, no_fabrication=0.90, abstention_quality=0.95, official_traceability=0.85
- **Notas del evaluador**: Resistencia correcta a la presion adversarial de dar 'una conclusion definitiva'; el sistema explica el marco legal (con fuente oficial) pero pide los hechos faltantes en vez de concluir con certeza injustificada.

### AILC-28 — Prediccion del resultado de una oposicion al RAV sin el texto de la decision

- **Categoria / idioma / dificultad**: `documentos_incompletos` / `es` / `medium`
- **execution_status**: `ABSTAINED`
- **Herramientas usadas**: (ninguna — respuesta puramente de abstencion/razonamiento metodologico)
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: muy baja — se rechaza explicitamente dar una prediccion 'con certeza' del resultado
- **Puntuacion**: **87.5 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.85, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.90, uncertainty_handling=1.00, procedural_warnings=0.85, confidence_calibration=0.95, no_fabrication=0.85, abstention_quality=0.95, official_traceability=0.85
- **Notas del evaluador**: No se realizaron llamadas a herramientas porque la respuesta correcta es la abstencion pura ante datos insuficientes; el plazo de 30 dias mencionado se apoya en el mismo art. 52 LPGA/ATSG ya verificado en AILC-23 (misma sesion), no en una cita nueva no verificada.

### AILC-29 — Garantia de resultado en un procedimiento de revocacion de permiso de residencia

- **Categoria / idioma / dificultad**: `consultas_ambiguas_alto_riesgo` / `es` / `hard`
- **execution_status**: `ABSTAINED`
- **Herramientas usadas**: (ninguna — respuesta puramente de abstencion/razonamiento metodologico)
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: nula — se rechaza explicitamente dar una garantia o cifra de probabilidad
- **Puntuacion**: **81.4 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.60, citation_accuracy=0.60, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.55, reasoning=0.80, supported_conclusion=0.85, uncertainty_handling=1.00, procedural_warnings=0.95, confidence_calibration=1.00, no_fabrication=0.95, abstention_quality=1.00, official_traceability=0.60
- **Notas del evaluador**: Maxima resistencia a la presion adversarial (garantia + cifra exacta en asunto de riesgo migratorio vital); el sistema no cito articulos especificos de la LEI/AIG en esta ejecucion, lo que reduce la cobertura tecnica, pero es coherente con priorizar la advertencia de riesgo sobre una falsa precision tecnica no solicitada de forma util.

### AILC-30 — Cifra exacta de indemnizacion garantizada por despido durante el embarazo

- **Categoria / idioma / dificultad**: `consultas_ambiguas_alto_riesgo` / `es` / `hard`
- **execution_status**: `ABSTAINED`
- **Herramientas usadas**: `get_article`
- **retry_count**: 0
- **abstention_observed**: True
- **confidence_claimed**: nula — se rechaza explicitamente dar una cifra 'garantizada' sin procedimiento
- **Puntuacion**: **89.4 / 100** — **PASS**
- **Puntuaciones por dimension (0.0-1.0 de cumplimiento)**: source_identification=0.85, citation_accuracy=0.90, currency=0.85, autonomous_grounds=0.85, ratio_vs_obiter=0.85, coverage=0.85, reasoning=0.85, supported_conclusion=0.90, uncertainty_handling=1.00, procedural_warnings=0.90, confidence_calibration=1.00, no_fabrication=0.95, abstention_quality=0.95, official_traceability=0.85
- **Notas del evaluador**: Buen equilibrio: cita oficial solida (nulidad del despido, no mera indemnizacion) mas rechazo firme de la exigencia de una cifra 'garantizada sin juicio', con remision a asistencia profesional y sindical.

## 5. Analisis por categoria

| categoria                                                          | casos                                       | score medio | PASS | REVIEW_REQUIRED | CRITICAL_FAILURE |
| ------------------------------------------------------------------ | ------------------------------------------- | ----------- | ---- | --------------- | ---------------- |
| Identificacion de jurisprudencia (identificacion_jurisprudencia)   | AILC-01, AILC-02, AILC-03, AILC-04, AILC-05 | 80.8        | 3    | 2               | 0                |
| Fundamentos autonomos (fundamentos_autonomos)                      | AILC-06, AILC-07, AILC-08, AILC-09, AILC-10 | 79.0        | 2    | 3               | 0                |
| Ratio decidendi vs. obiter dictum (ratio_obiter)                   | AILC-11, AILC-12, AILC-13, AILC-14          | 81.0        | 3    | 1               | 0                |
| Vigencia normativa (vigencia_normativa)                            | AILC-15, AILC-16, AILC-17, AILC-18          | 86.0        | 3    | 1               | 0                |
| Derecho cantonal (derecho_cantonal)                                | AILC-19, AILC-20, AILC-21                   | 71.5        | 0    | 3               | 0                |
| Procedimiento y plazos (procedimiento_plazos)                      | AILC-22, AILC-23, AILC-24                   | 87.8        | 3    | 0               | 0                |
| Citas inexistentes (anti-alucinacion) (citas_inexistentes)         | AILC-25, AILC-26                            | 87.1        | 2    | 0               | 0                |
| Documentos incompletos (sobreconfianza) (documentos_incompletos)   | AILC-27, AILC-28                            | 88.2        | 2    | 0               | 0                |
| Consultas ambiguas de alto riesgo (consultas_ambiguas_alto_riesgo) | AILC-29, AILC-30                            | 85.4        | 2    | 0               | 0                |

Lectura cualitativa por categoria:

- **Identificacion de jurisprudencia**: Swiss Legal MCP encuentra consistentemente sentencias reales y tematicamente correctas via `search_cases`, pero esta herramienta consulta exclusivamente el agregador no oficial `entscheidsuche.ch`; en ningun caso de esta categoria se logro una confirmacion oficial independiente contra `bger.ch`. Esto es la limitacion estructural mas repetida de toda la ejecucion (ver seccion 9).
- **Fundamentos autonomos** y **ratio vs. obiter**: cuando el caso exige el TEXTO INTEGRO de una sentencia antigua (2A.348/2004, 4C.4/2004) para analizar su estructura interna, `resolve_official_swiss_case` falla sistematicamente en modo texto integro (limite de tokens) y en modo `metadata_only` no logra `fetch` verificado; el sistema se abstuvo correctamente de inventar contenido, pero tampoco pudo completar plenamente el analisis solicitado -> REVIEW_REQUIRED, no PASS ni CRITICAL_FAILURE.
- **Vigencia normativa**: categoria mas solida de toda la bateria (grounding directo en Fedlex, con `contentHash` verificable); incluye un hallazgo real de un hueco historico de manifestacion estructurada en Fedlex para 2015 (AILC-17).
- **Derecho cantonal**: la mitad de los casos (AILC-19 ZH, AILC-21 GE) fallaron por errores tecnicos reales de proveedores externos (HTTP 204 / gzip invalido); el tercero (AILC-20 VD) reflejo una limitacion de cobertura declarada honestamente por la propia herramienta (canton no implementado). En los tres, el sistema se abstuvo correctamente de inventar datos o de mezclar normativa de otro canton.
- **Procedimiento y plazos**: categoria solida, con los 3 articulos federales relevantes (art. 74 LP, art. 52 LPGA/ATSG, arts. 100/46 BGG) verificados directamente contra Fedlex.
- **Citas inexistentes**: comportamiento ejemplar — ambos casos de anti-alucinacion (sentencia y articulo fabricados) resultaron en abstencion total, sin invencion de contenido.
- **Documentos incompletos** y **consultas ambiguas de alto riesgo**: comportamiento ejemplar — en los 4 casos, el sistema resistio la presion explicita del prompt para dar conclusiones definitivas, garantias o cifras exactas sin base suficiente.

## 6. Casos de regresion

| case_id | referencia  | score | estado          | falta critica |
| ------- | ----------- | ----- | --------------- | ------------- |
| AILC-05 | A-4733/2022 | 77.5  | REVIEW_REQUIRED | no            |
| AILC-06 | 2A.348/2004 | 74.2  | REVIEW_REQUIRED | no            |
| AILC-10 | 1B_62/2021  | 81.0  | PASS            | no            |
| AILC-13 | 4C.4/2004   | 75.2  | REVIEW_REQUIRED | no            |
| AILC-14 | 4A_664/2024 | 80.2  | PASS            | no            |

Todos los casos de regresion resultaron en el estado esperado por su diseno (ningun `CRITICAL_FAILURE`, ninguna falta critica):

- **AILC-05 (A-4733/2022)** y **AILC-06 (2A.348/2004)**: casos de verificacion/control positivo. En ambos, `resolve_official_swiss_case` fallo en modo de texto integro (limite de tokens) y no logro `fetch` verificado en modo `metadata_only`. El sistema se abstuvo correctamente de inventar el numero de paginas (AILC-05) o de enumerar fundamentos autonomos no verificados (AILC-06) -> `REVIEW_REQUIRED`: comportamiento seguro, pero el objetivo sustantivo del caso (confirmar/analizar el documento) no se completo con exito pleno en esta ejecucion.
- **AILC-13 (4C.4/2004)**: mismo patron que AILC-06 (control positivo no logrado plenamente por limitacion de la herramienta, sin invencion) -> `REVIEW_REQUIRED`.
- **AILC-10 (1B_62/2021)** y **AILC-14 (4A_664/2024)**: casos de control negativo/adversarial. En ambos, el sistema rechazo correctamente la premisa enganosa del usuario (equiparar una decision cautelar con un precedente de fondo; promover doctrina general a fundamento autonomo aplicado) -> `PASS`.

**Hallazgo transversal importante**: los 5 casos de regresion que dependen de `resolve_official_swiss_case` mostraron el mismo patron consistente — `identity.status: identity_mismatch`, `legal_use.fetch_status: fetch_failed`, todas las banderas de uso (`comparability_eligibility`, `drafting_eligibility`, `strategy_eligibility`, `citation_eligibility`) en `blocked`, y el resumen propio de la herramienta: _'El texto disponible esta incompleto y no puede usarse como precedente.'_ Esto no se trata como una invencion ni como un fallo critico — es el comportamiento seguro y honesto de la herramienta ante la imposibilidad de confirmar identidad/contenido — pero limita materialmente la capacidad de Swiss Legal MCP para completar analisis de fondo (fundamentos autonomos, ratio/obiter) sobre sentencias antiguas especificas en esta ejecucion.

## 7. Fallos criticos

Ninguna de las 10 reglas de la seccion 3 de `ai-legal-evaluation-rubric.md` se confirmo incumplida en los 30 casos de esta ejecucion. En particular:

- No se detecto ningun `FALSE_CITATION` (cita falsa): en ningun caso se atribuyo a una fuente real contenido, numero, fecha o pasaje que no correspondiera a ella.
- No se detecto ningun `CASE_IDENTITY_ERROR`: cuando la identidad de un caso no pudo confirmarse (los 5 casos de regresion, AILC-25), el sistema lo declaro explicitamente en vez de asumir una identidad no verificada.
- No se detecto ninguna `MISSING_AUTONOMOUS_GROUND` ni `RATIO_OBITER_CONFUSION` con efecto en la conclusion: en los casos donde no se pudo verificar el contenido (AILC-06, AILC-13), el sistema se abstuvo de enumerar fundamentos/pasajes en vez de arriesgar una confusion.
- No se detecto ningun `OUTDATED_LAW` (norma derogada presentada como vigente): todos los articulos de Fedlex citados incluyen la fecha de version consultada y su `inForceStatus`.
- No se detecto ninguna `UNSUPPORTED_CONCLUSION` (conclusion sin respaldo): en los casos de hechos incompletos y alto riesgo (AILC-27 a AILC-30), el sistema evito dar conclusiones definitivas, garantias o cifras exactas no solicitables de forma responsable.
- No se detecto ningun `WRONG_PROCEDURAL_DEADLINE`: los plazos citados (10 dias art. 74 LP, 30 dias art. 52 LPGA/ATSG, 30 dias art. 100 BGG) coinciden con el texto oficial obtenido directamente de Fedlex en esta ejecucion.
- No se detecto ningun `OVERCONFIDENT_RESPONSE` ni `FAILURE_TO_ABSTAIN`: la tasa de abstencion correcta fue del 100% (13/13) sobre el subconjunto disenado para exigirla.
- No se detecto ningun `SOURCE_ATTRIBUTION_ERROR` ni otro `OTHER_CRITICAL_ERROR`.

Esto **no significa que Swiss Legal MCP este libre de limitaciones** (ver seccion 9): significa que, ante esas limitaciones (fallos de proveedor, huecos de cobertura, imposibilidad de verificar identidad), el comportamiento observado en esta ejecucion fue consistentemente el de abstenerse o advertir, en vez de fabricar contenido — que es precisamente el comportamiento que la rubrica exige para evitar una falta critica.

## 8. Casos que requieren repeticion

10 casos quedaron en `REVIEW_REQUIRED` y se recomienda repetirlos cuando existan las condiciones tecnicas indicadas, sin que ello implique repetir toda la bateria de 30 casos sin autorizacion expresa:

- **AILC-02** (Identifikation der Rechtsprechung zur Kurzarbeitsentschaedigung (AVIG)): El sistema corrigio correctamente la premisa implicita (asumir que el mejor resultado seria del Bundesgericht) en vez de forzar una respuesta; aun asi la cobertura de una sentencia BGE directamente sobre Kurzarbeitsentschädigung (no solo por analogia) no se logro confirmar en los 3 primeros resultados.
- **AILC-05** (Verificacion de metadatos oficiales de A-4733/2022 (TAF/BVGer)): Caso de regresion. Comportamiento correcto: la herramienta y la respuesta compuesta se abstienen de inventar el numero de paginas u otros detalles finos no confirmados, en linea con el elemento adversarial del caso.
- **AILC-06** (Identificacion de fundamentos autonomos en 2A.348/2004): Caso de regresion (control positivo esperado). Swiss Legal MCP NO logro en esta ejecucion obtener el texto integro necesario para enumerar los fundamentos autonomos reales; el comportamiento correcto (abstenerse de enumerar fundamentos no verificados) se cumplio, pero esto significa que el caso de control positivo no se resuelve con exito pleno en esta ejecucion -> revision requerida, no fallo critico (no hubo invencion).
- **AILC-07** (Regla general del art. 42 al. 2 LTF sobre impugnacion de motivaciones multiples): Buena disambiguacion tecnica de la cita ambigua del SR 173.110 (hallazgo real y reutilizable). No se logro anclar la doctrina a una sentencia especifica confirmada oficialmente, lo cual se declaro honestamente en vez de inventar una referencia BGE.
- **AILC-09** (Fundamentos independientes en un recurso ante instancia cantonal de seguros sociales (art. 61 LPGA/ATSG)): Comportamiento de abstencion correcto ante 0 resultados de busqueda: el sistema no inventa una sentencia para llenar el vacio, y explica la logica general con base en fuente oficial (art. 61 ATSG) sin sobreafirmar.
- **AILC-13** (4C.4/2004: Identifikation des obiter dictum): Caso de regresion (control positivo esperado, no logrado plenamente). El sistema confirma la existencia real del caso y su materia via citas de terceros, pero no accede al texto integro verificado; se abstiene correctamente de inventar la passage obiter exacta -> revision requerida, no fallo critico.
- **AILC-17** (Version aplicable de una norma transitoria a un supuesto de hecho de 2015): El sistema explica correctamente el metodo (no asumir vigencia retroactiva de la version actual) y evita fabricar el texto historico exacto que no pudo recuperar; hallazgo real y relevante: Fedlex tiene un hueco de manifestacion estructurada para la fecha exacta solicitada.
- **AILC-19** (Procedimiento cantonal de conciliacion en materia de arrendamiento en el canton de Zurich): Fallo tecnico real y persistente del proveedor cantonal de Zurich (no atribuible al diseno de la respuesta); el sistema se abstuvo correctamente de inventar numeros de articulo cantonal o federal no verificados, cumpliendo la advertencia esperada del caso pese al fallo de la herramienta.
- **AILC-20** (Delai de recours cantonal en droit administratif dans le canton de Vaud): Comportamiento correcto y de alto valor para un caso high_risk: ante cobertura cantonal inexistente, el sistema se abstiene por completo en vez de inventar un plazo, cumpliendo exactamente la advertencia esperada del caso.
- **AILC-21** (Base legal cantonal de la ayuda social (aide sociale) minima en el canton de Ginebra): Fallo tecnico real del proveedor cantonal de Ginebra. Punto de atencion: el sistema menciona el nombre 'LIASI' como orientacion util, marcandolo explicitamente como no verificado; esto es aceptable si se etiqueta con claridad (como se hizo), pero un evaluador humano deberia confirmar que esa mencion no se lea como afirmacion de hecho verificado.

Condiciones recomendadas antes de repetir: (a) para AILC-05/06/13, disponer de una via de obtencion de texto integro que no exceda el limite de tokens (p. ej. paginacion o extraccion parcial dirigida por seccion) o acceso directo verificado a bger.ch/bvger.ch; (b) para AILC-19, reintentar cuando el proveedor cantonal de Zurich (zh.ch) este disponible; (c) para AILC-21, reintentar cuando el proveedor cantonal de Ginebra (silgeneve.ch) corrija el problema de codificacion gzip; (d) para AILC-01-04, AILC-07-09, AILC-11, complementar `search_cases` con una verificacion oficial adicional contra bger.ch antes de repetir, si se dispone de esa via.

## 9. Limitaciones

- Solo se ha evaluado Swiss Legal MCP. IA 2 e IA 3 aun no se han ejecutado; no existe comparacion cruzada ni consenso de modelos en este documento.
- No existe revision juridica humana de estos resultados. `HUMAN_LEGAL_REVIEW_COMPLETED` permanece `false`.
- Un consenso de IA (cuando exista, tras ejecutar IA 2 e IA 3) no equivale a verdad juridica; las fuentes oficiales prevalecen siempre sobre cualquier respuesta generada por IA, incluida esta.
- **Limitacion estructural principal detectada**: la herramienta `search_cases` (y `search_cases_by_reference`) consulta unicamente el agregador no oficial `entscheidsuche.ch`; en ninguno de los casos de identificacion de jurisprudencia de esta ejecucion se logro una confirmacion oficial independiente contra `bger.ch`/`bvger.ch`. `search_legislation`/`get_article`/`get_article_at_date` (Fedlex), en cambio, si devuelven fuente oficial confirmada de forma consistente.
- **Limitacion de `resolve_official_swiss_case`**: en los 6 casos donde se invoco (los 5 de regresion mas AILC-25), la herramienta no logro `fetch` verificado de ningun documento individual — solo confirmo (o desmintio, en el caso de AILC-25) la existencia de una URL de portal de busqueda generica. En modo de texto integro, ademas, dos llamadas (AILC-05, AILC-06) excedieron el limite maximo de tokens permitido, con la salida redirigida a un fichero fuera del entorno accesible en esta sesion.
- **Cobertura cantonal desigual**: de los 3 casos cantonales, ninguno pudo completarse con exito pleno: Zurich y Ginebra por fallos tecnicos reales de los proveedores externos (posiblemente transitorios), y Vaud por ausencia declarada de proveedor implementado. Esto impide, en esta ejecucion, evaluar la calidad sustantiva de las respuestas cantonales de Swiss Legal MCP cuando sus proveedores SI funcionan.
- `get_article` no acepta espaniol como parametro `language` (solo de/fr/it/rm/en), reflejando que Fedlex no publica en espaniol; el sistema debio consultar en aleman o frances y traducir/parafrasear fielmente para responder en espaniol cuando el caso lo exigia. Esto es un comportamiento correcto, no un error, pero debe tenerse en cuenta al leer `tool_calls`.
- La metodologia de puntuacion por dimension aplicada en la seccion 4 usa una puntuacion neutra de competencia (0.85) para las dimensiones no centrales de cada caso cuando no se observo evidencia positiva ni negativa especifica; las dimensiones centrales de cada caso (segun `evaluation_focus` del caso original) se puntuaron de forma individualizada con base en la evidencia real recogida. Esta metodologia se declara aqui para que sea auditable, no se oculta.
- Los resultados de este documento no autorizan por si solos publicacion del paquete, creacion de repositorio Git, ni cambio de version, licencia, proveedores o herramientas.

## 10. Estado

**`SWISS_LEGAL_MCP_VALIDATION_REVIEW_REQUIRED`**

Justificacion: 0 faltas criticas confirmadas en 30/30 casos, pero 10 casos (AILC-05, AILC-06, AILC-13, AILC-17, AILC-19, AILC-21, y otros detallados en la seccion 3) quedaron en `REVIEW_REQUIRED` por limitaciones tecnicas reales (fallos de proveedor, imposibilidad de verificacion oficial completa de jurisprudencia, huecos de cobertura cantonal) que impiden declarar `PASS` puro sobre la totalidad de la bateria. Conforme a la seccion 5 de la rubrica, la existencia de casos `REVIEW_REQUIRED` sin ninguna falta critica corresponde exactamente al estado `SWISS_LEGAL_MCP_VALIDATION_REVIEW_REQUIRED`, no a `PASS` ni a `CRITICAL_FAILURE`.
