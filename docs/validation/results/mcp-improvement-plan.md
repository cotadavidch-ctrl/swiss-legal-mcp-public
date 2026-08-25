# Plan de mejora continua — Swiss Legal MCP

source_comparison_id: `AI-LEGAL-CROSS-COMPARISON-2026-08-05-001`  
backlog_id: `MCP-IMPROVEMENT-BACKLOG-2026-08-05-001`

**Este documento es una propuesta. No autoriza, ni por si mismo ni de forma implicita, ningun cambio de codigo, configuracion, proveedor o herramienta. Todo hallazgo listado tiene `implementation_status = PROPOSED_NOT_AUTHORIZED` y requiere autorizacion humana explicita antes de cualquier implementacion.**

## 1. Objetivo

Documentar, de forma priorizada y accionable, los hallazgos confirmados y no resueltos de la comparacion cruzada de validacion IA-legal (`ai-legal-cross-comparison.json`/`.md`) entre Swiss Legal MCP, Claude IA 2 y Claude IA 3, para que un responsable humano pueda decidir que cambios autorizar antes de la proxima ronda de validacion. Este plan no reemplaza el juicio humano ni la revision legal profesional; es un insumo para esa decision.

## 2. Hallazgos confirmados

Hallazgos con evidencia reproducible, verificada de forma independiente en el ejercicio de comparacion (no solo autoreportada por un sistema):

### FIND-01 [P0] — Limite fijo de caracteres/tokens en resolve_official_swiss_case (require_full_text=true) bloquea la recuperacion de texto integro de sentencias oficiales de longitud moderada

- Casos afectados: AILC-06, AILC-13
- Clasificacion de causa: `MCP_DEFECT` | Severidad: high
- Evidencia:
  - AILC-06 (2A.348/2004, caso de regresion/control positivo): resolve_official_swiss_case con require_full_text=true devolvio 'ERROR: el resultado (109.737 caracteres) excede el limite maximo de tokens permitido'.
  - AILC-13 (4C.4/2004, caso de regresion/control positivo): la MISMA herramienta, con un caso completamente distinto, devolvio exactamente el mismo valor -- 109.737 caracteres -- excediendo el mismo limite.
  - La coincidencia exacta del valor de caracteres entre dos documentos judiciales distintos es evidencia fuerte de un techo fijo/mal configurado en el pipeline de recuperacion, no de una coincidencia de longitud real de los documentos.
  - Verificacion independiente realizada en este ejercicio de comparacion: un fetch HTTP simple a servat.unibe.ch obtuvo el texto integro de 2A.348/2004 sin ningun problema de tamano, confirmando que la fuente oficial es accesible y que el fallo es atribuible a la herramienta del MCP, no a la fuente.
- Beneficio esperado: Restaura la capacidad de recuperacion de texto integro para al menos 2 de los 5 casos de regresion designados (40% de la suite de regresion), que son precisamente los casos disenados para validar el comportamiento correcto de base de la herramienta.

### FIND-02 [P1] — Fallo de decodificacion gzip/HTTP en search_cantonal_legislation para el proveedor cantonal de Ginebra (silgeneve.ch)

- Casos afectados: AILC-21
- Clasificacion de causa: `MCP_DEFECT` | Severidad: high
- Evidencia:
  - AILC-21 (caso prioritario, derecho cantonal de Ginebra): search_cantonal_legislation con canton=GE devolvio 'PARSE_ERROR: Respuesta comprimida invalida' al descargar silgeneve.ch/legis/program/books/RSG/content.htm, en dos intentos consecutivos.
  - Verificacion independiente realizada en este ejercicio de comparacion: un fetch HTTP simple a la MISMA URL exacta, en la misma sesion, devolvio HTML valido y completo (indice de rs/GE, 70.811 caracteres) sin ningun error de compresion.
  - Esto demuestra de forma directa y reproducible que el sitio oficial esta disponible y sirve contenido valido; el fallo reside en como la herramienta del MCP maneja la respuesta HTTP/gzip de ese proveedor especifico.
- Beneficio esperado: Restaura la cobertura funcional del proveedor cantonal de Ginebra, incluyendo la capacidad de detectar cambios normativos relevantes y vigentes (ver FIND-03).

## 3. Hallazgos no resueltos

Hallazgos donde la evidencia disponible no permite atribuir con certeza la causa raiz (defecto de codigo vs. indisponibilidad externa genuina vs. limitacion de cobertura declarada), o donde la verificacion contra fuente oficial primaria quedo pendiente:

### FIND-04 [P2] — Anomalia 'identity_mismatch' en el reintento metadata_only de resolve_official_swiss_case tras el fallo de texto integro

- Casos afectados: AILC-06, AILC-13
- Clasificacion de causa: `TOOL_SELECTION_ISSUE` | Severidad: medium
- Por que queda abierto: Investigar por que el modo metadata_only reporta identity_mismatch para una referencia que el propio sistema ya confirmo como existente por otra via (search_cases_by_reference) en la misma sesion; verificar si hay un problema de normalizacion del formato de referencia (espacios, guion bajo vs punto, mayusculas) entre las dos rutas de codigo.

### FIND-05 [P2] — Fallo persistente (HTTP 204) del proveedor cantonal de Zurich; origen no concluyentemente determinado

- Casos afectados: AILC-19
- Clasificacion de causa: `EXTERNAL_PROVIDER_FAILURE` | Severidad: medium
- Por que queda abierto: Investigar si zh.ch/zhlex.zh.ch requiere un endpoint, cabecera o mecanismo de sesion distinto al usado actualmente; evaluar una estrategia de reintento con backoff o una fuente alternativa (por ejemplo, el portal judicial cantonal usado exitosamente por Claude IA 3 para confirmar estructura) como via secundaria.

### FIND-06 [P3] — Ausencia declarada de proveedor de legislacion cantonal para Vaud (VD) -- brecha de cobertura, no defecto

- Casos afectados: AILC-20
- Clasificacion de causa: `SOURCE_UNAVAILABLE` | Severidad: low
- Por que queda abierto: Evaluar, como mejora de cobertura del roadmap (no como correccion de bug), anadir un proveedor de legislacion cantonal para Vaud.

### FIND-03 [P3] — Posible desactualizacion de la referencia cantonal ginebrina 'LIASI', reemplazada por la LASLP desde el 1.1.2025

- Casos afectados: AILC-21
- Clasificacion de causa: `SOURCE_UNAVAILABLE` | Severidad: medium
- Por que queda abierto: Una vez corregido FIND-02, volver a consultar silgeneve.ch/RSG libro J con search_cantonal_legislation para confirmar contra fuente primaria si LIASI fue derogada/reemplazada por LASLP, y actualizar cualquier material de referencia interno que mencione LIASI como vigente.

Adicionalmente, **FIND-07** (informativo, no relacionado con Swiss Legal MCP) documenta que 17-18 de los 30 casos de `claude-ia2-responses.json` no son comparables al canon pese a declarar el hash correcto -- este hallazgo permanece sin resolver en el sentido de que Claude IA 2 no ha sido re-ejecutada contra el archivo verificado.

## 4. Prioridades

| Prioridad | Hallazgos                 | Criterio                                                                                                                                                          |
| --------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | FIND-01                   | Defecto confirmado con evidencia reproducible que bloquea una capacidad nuclear (recuperacion de texto integro oficial) en casos de regresion designados.         |
| P1        | FIND-02                   | Defecto confirmado con evidencia reproducible, de alcance mas acotado (un unico proveedor cantonal).                                                              |
| P2        | FIND-04, FIND-05          | Anomalia o fallo tecnico real pero sin causa raiz concluyentemente atribuida a codigo del MCP; requiere investigacion antes de poder proponer un cambio concreto. |
| P3        | FIND-03, FIND-06, FIND-07 | Mejora de cobertura, verificacion de contenido, o hallazgo informativo sin relacion directa con un defecto de codigo.                                             |

No se creo ningun hallazgo P0 sin evidencia de un defecto critico confirmado; FIND-01 cumple ese umbral por reproducirse identicamente en dos casos de regresion distintos, con verificacion independiente de que la fuente oficial subyacente si es accesible por medios estandar.

## 5. Cambios propuestos

**Ninguno de los cambios listados a continuacion esta autorizado. Se listan como propuestas para decision humana.**

- **FIND-01** (P0): Investigar el limite de tokens/caracteres configurado para la recuperacion de texto integro y evaluar: (a) aumentar el limite a un valor que cubra sentencias de longitud tipica del Tribunal Federal/Tribunal Administrativo Federal, (b) implementar paginacion o resumen progresivo en vez de fallo total cuando se excede el limite, y (c) investigar por que el reintento en modo metadata_only devuelve 'identity.status=identity_mismatch' para el mismo case_reference que si fue encontrado correctamente en el intento de texto integro (ver FIND-04).
- **FIND-02** (P1): Revisar el manejo de encabezados Content-Encoding/Accept-Encoding y la logica de decodificacion gzip usada especificamente para silgeneve.ch; anadir manejo de fallback (peticion sin gzip, o deteccion de contenido no realmente comprimido pese al encabezado) antes de declarar PARSE_ERROR.
- **FIND-03** (P3): Una vez corregido FIND-02, volver a consultar silgeneve.ch/RSG libro J con search_cantonal_legislation para confirmar contra fuente primaria si LIASI fue derogada/reemplazada por LASLP, y actualizar cualquier material de referencia interno que mencione LIASI como vigente.
- **FIND-04** (P2): Investigar por que el modo metadata_only reporta identity_mismatch para una referencia que el propio sistema ya confirmo como existente por otra via (search_cases_by_reference) en la misma sesion; verificar si hay un problema de normalizacion del formato de referencia (espacios, guion bajo vs punto, mayusculas) entre las dos rutas de codigo.
- **FIND-05** (P2): Investigar si zh.ch/zhlex.zh.ch requiere un endpoint, cabecera o mecanismo de sesion distinto al usado actualmente; evaluar una estrategia de reintento con backoff o una fuente alternativa (por ejemplo, el portal judicial cantonal usado exitosamente por Claude IA 3 para confirmar estructura) como via secundaria.
- **FIND-06** (P3): Evaluar, como mejora de cobertura del roadmap (no como correccion de bug), anadir un proveedor de legislacion cantonal para Vaud.
- **FIND-07** (P3): N/A para el codigo del MCP. Se recomienda que el propietario del proceso de validacion re-ejecute Claude IA 2 contra el archivo canonico verificado (ai-legal-test-cases.json, hash 7e4eedcb...) antes de usar sus resultados en AILC-13 a AILC-30 para cualquier decision de mejora continua futura.

## 6. Pruebas requeridas

Antes de autorizar cualquier cambio de codigo derivado de este plan:

- **FIND-01**:
  - Prueba de regresion que recupere el texto integro de 2A.348/2004 y 4C.4/2004 y verifique que no se produce error de limite de tokens.
  - Prueba con al menos 3 sentencias adicionales de longitud similar o mayor (>100.000 caracteres) para confirmar que el limite corregido cubre el rango realista de documentos oficiales suizos.
- **FIND-02**:
  - Prueba de regresion que descargue silgeneve.ch/legis/program/books/RSG/content.htm y verifique una respuesta HTML valida.
  - Prueba adicional contra al menos 2 paginas mas profundas del mismo dominio (por ejemplo, una ley especifica dentro de RSG) para confirmar que la correccion no es especifica de una sola URL.
- **FIND-03**:
  - Prueba manual/asistida por humano contra silgeneve.ch libro J tras la correccion de FIND-02.
- **FIND-04**:
  - Prueba unitaria de resolve_official_swiss_case en modo metadata_only para 2A.348/2004 y 4C.4/2004, verificando que identity.status no sea identity_mismatch para referencias validas conocidas.
- **FIND-05**:
  - Prueba de regresion contra el proveedor cantonal de Zurich una vez identificado un endpoint estable.
- **FIND-06**:
  - Prueba de cobertura para VD una vez implementado un proveedor.

Todas las pruebas deben ejecutarse contra los casos de regresion designados en `ai-legal-test-cases.json` sin modificar dicho archivo, y sus resultados deben incorporarse a una nueva ronda de `swiss-legal-mcp-run-metadata.json`/`swiss-legal-mcp-evaluation.md` antes de cerrar cada hallazgo.

## 7. Orden de implementacion (propuesto, sujeto a autorizacion humana)

1. FIND-01 (P0) — corregir el limite de tokens/caracteres en `resolve_official_swiss_case`. Es la base para poder cerrar FIND-04, que depende del mismo pipeline.
2. FIND-04 (P2) — investigar la anomalia `identity_mismatch`, aprovechando el mismo trabajo de diagnostico de FIND-01.
3. FIND-02 (P1) — corregir la decodificacion HTTP/gzip del proveedor cantonal de Ginebra. Es la base para poder abordar FIND-03.
4. FIND-03 (P3) — verificar LIASI vs. LASLP contra fuente primaria, una vez restaurado el acceso de FIND-02.
5. FIND-05 (P2) — investigar el proveedor cantonal de Zurich, en paralelo a lo anterior (no depende de ningun otro hallazgo).
6. FIND-06 (P3) — evaluar, como decision de producto/roadmap separada, la adicion de un proveedor para Vaud.
7. FIND-07 (P3, informativo) — coordinar con el propietario del proceso de validacion la re-ejecucion de Claude IA 2 contra el archivo canonico verificado, en paralelo, sin bloquear los demas puntos.

## 8. Criterios de aceptacion

- FIND-01: `resolve_official_swiss_case` con `require_full_text=true` recupera correctamente el texto integro de AILC-06 (2A.348/2004) y AILC-13 (4C.4/2004) sin error de limite de tokens, en al menos 3 ejecuciones consecutivas.
- FIND-02: `search_cantonal_legislation` con `canton=GE` recupera correctamente contenido de silgeneve.ch sin PARSE_ERROR, en al menos 3 ejecuciones consecutivas y contra al menos 2 URLs distintas del dominio.
- FIND-04: el modo `metadata_only` de `resolve_official_swiss_case` no reporta `identity_mismatch` para una referencia previamente confirmada como existente por `search_cases_by_reference` en la misma sesion.
- FIND-05: se determina de forma concluyente si el fallo HTTP 204 del proveedor de Zurich es atribuible a la herramienta o es una limitacion externa genuina, con evidencia documentada en cualquiera de los dos sentidos.
- Ningun criterio de aceptacion de este plan se considera cumplido sin que la correccion correspondiente pase, ademas, por revision legal humana antes de su despliegue a produccion (`human_legal_review_completed` debe pasar a `true` en un ciclo posterior, fuera del alcance de este documento).

## 9. Criterios de rollback

- Si una correccion de FIND-01 (cambio de limite de tokens o introduccion de paginacion) degrada la latencia de otras herramientas del MCP mas alla de un umbral acordado por el equipo de ingenieria, revertir el cambio y volver al comportamiento de fallo explicito actual (que ya se abstiene correctamente en vez de fabricar contenido).
- Si una correccion de FIND-02 (manejo de gzip/HTTP) introduce fallos nuevos en otros proveedores cantonales que actualmente funcionan correctamente, revertir el cambio y limitar cualquier ajuste a codigo especifico del dominio silgeneve.ch.
- En todos los casos, cualquier cambio debe poder revertirse de forma aislada, sin afectar el comportamiento de las herramientas que en esta comparacion no mostraron ningun defecto (por ejemplo, las herramientas de legislacion federal, verificacion de citas y deteccion de fabricacion, que se comportaron correctamente en 20 de 30 casos).
- Ningun rollback de este plan revierte, modifica ni reinterpreta los 30 casos de prueba, la rubrica de evaluacion, ni el acta RC-1.0.0.md.

## 10. Repeticion de validacion

Tras implementar y autorizar cualquiera de los cambios de la Seccion 5:

1. Re-ejecutar Swiss Legal MCP contra los 30 casos de `ai-legal-test-cases.json` (sin modificarlo), generando un nuevo `swiss-legal-mcp-responses.json`/`-run-metadata.json`/`-evaluation.md` con un `run_id` distinto.
2. Confirmar especificamente que AILC-06, AILC-13, AILC-19 y AILC-21 (los casos con hallazgo tecnico) pasan a `execution_status=COMPLETED` (o equivalente) sin los errores documentados en este ciclo.
3. Coordinar con el propietario del proceso de validacion la re-ejecucion de Claude IA 2 contra el archivo canonico verificado (FIND-07), de forma que una futura comparacion de 3 vias sea completamente valida para los 30 casos, no solo para 12-13.
4. Repetir este mismo proceso de comparacion cruzada de 9 fases con los nuevos artefactos, produciendo una nueva version de `ai-legal-cross-comparison.json`/`.md` y `mcp-improvement-backlog.json`/`-plan.md`, sin sobrescribir los de este ciclo.
5. Solo despues de una ronda de validacion cruzada sin `MCP_DEFECT` confirmados pendientes, y con revision legal humana explicita, considerar el estado `AI_LEGAL_CROSS_VALIDATION_PASS`.

## 11. Limites

- Este plan **no autoriza ningun cambio**. Es una propuesta para decision humana.
- Este plan no modifica, ni recomienda modificar, los 30 casos de `ai-legal-test-cases.json`, la rubrica de evaluacion, ni el acta RC-1.0.0.md.
- Este plan no cambia proveedores ni herramientas del MCP; unicamente propone investigar y corregir el comportamiento de proveedores/herramientas ya existentes.
- Este plan no constituye asesoria legal ni sustituye la revision de un profesional del derecho suizo antes de que cualquier respuesta del MCP se use en un caso real.
- Este plan no publica, no crea Git ni realiza ninguna otra accion fuera de la generacion de los 4 archivos de documentacion solicitados en `docs/validation/results/`.
- `human_legal_review_completed = false` y `publication_performed = false` en todo momento durante la elaboracion de este plan.
