# Plantilla de resultados — validación jurídica cruzada asistida por IA

Estado: `AI_LEGAL_CROSS_VALIDATION`. Esta plantilla se completa **después** de ejecutar los 30
casos de `ai-legal-test-cases.json` con los tres sistemas (Swiss Legal MCP, IA 2, IA 3), verificar
cada afirmación contra fuentes oficiales y puntuar con `ai-legal-evaluation-rubric.md`.

En este repositorio, esta plantilla existe en blanco (sin resultados reales todavía). No se ha
ejecutado ningún caso. Completar esta plantilla con datos inventados o supuestos está
prohibido: cada fila debe corresponder a una ejecución real y verificada.

`HUMAN_LEGAL_REVIEW_COMPLETED: false` — completar esta plantilla con resultados de IA no
constituye ni sustituye una revisión jurídica humana.

## 1. Tabla por caso (una tabla por `case_id`, repetida 30 veces, una por cada sistema evaluado)

Para cada caso de `ai-legal-test-cases.json`, se completa un bloque como el siguiente, repetido
tres veces (una fila por sistema: Swiss Legal MCP, IA 2, IA 3).

### Caso: `<case_id>` — `<title del caso>`

| Campo                                                                               | Swiss Legal MCP | IA 2 | IA 3 |
| ----------------------------------------------------------------------------------- | --------------- | ---- | ---- |
| `case_id`                                                                           |                 |      |      |
| `modelo` (nombre + versión exacta)                                                  |                 |      |      |
| `respuesta` (texto completo o enlace al registro completo)                          |                 |      |      |
| `herramientas usadas`                                                               |                 |      |      |
| `fuentes citadas`                                                                   |                 |      |      |
| `fuentes verificadas` (sí/no, por cada fuente citada)                               |                 |      |      |
| `score` (0–100, según rúbrica)                                                      |                 |      |      |
| `critical_error` (ninguna / regla incumplida de la rúbrica sección 3)               |                 |      |      |
| `discrepancies` (frente a los otros dos sistemas y frente a la fuente oficial)      |                 |      |      |
| `confidence_claimed` (nivel de confianza expresado por el sistema)                  |                 |      |      |
| `confidence_supported` (¿ese nivel está respaldado por la evidencia verificada?)    |                 |      |      |
| `abstention_expected` (`true`/`false`, según `must_abstain_if_unverified` del caso) |                 |      |      |
| `abstention_observed` (`true`/`false`, ¿el sistema se abstuvo realmente?)           |                 |      |      |
| `reviewer_notes`                                                                    |                 |      |      |
| `final_status` (`PASS` / `REVIEW_REQUIRED` / `CRITICAL_FAILURE`)                    |                 |      |      |

> Repetir este bloque para cada uno de los 30 `case_id` (`AILC-01` a `AILC-30`) antes de
> completar el resumen global.

## 2. Tabla comparativa resumida

Vista rápida de los 30 casos, una fila por caso, sin el detalle completo de la sección 1
(que sirve como registro auditable de respaldo).

| case_id | Swiss Legal MCP | IA 2 | IA 3 | fuente oficial | discrepancias | resultado |
| ------- | --------------- | ---- | ---- | -------------- | ------------- | --------- |
| AILC-01 |                 |      |      |                |               |           |
| AILC-02 |                 |      |      |                |               |           |
| AILC-03 |                 |      |      |                |               |           |
| AILC-04 |                 |      |      |                |               |           |
| AILC-05 |                 |      |      |                |               |           |
| AILC-06 |                 |      |      |                |               |           |
| AILC-07 |                 |      |      |                |               |           |
| AILC-08 |                 |      |      |                |               |           |
| AILC-09 |                 |      |      |                |               |           |
| AILC-10 |                 |      |      |                |               |           |
| AILC-11 |                 |      |      |                |               |           |
| AILC-12 |                 |      |      |                |               |           |
| AILC-13 |                 |      |      |                |               |           |
| AILC-14 |                 |      |      |                |               |           |
| AILC-15 |                 |      |      |                |               |           |
| AILC-16 |                 |      |      |                |               |           |
| AILC-17 |                 |      |      |                |               |           |
| AILC-18 |                 |      |      |                |               |           |
| AILC-19 |                 |      |      |                |               |           |
| AILC-20 |                 |      |      |                |               |           |
| AILC-21 |                 |      |      |                |               |           |
| AILC-22 |                 |      |      |                |               |           |
| AILC-23 |                 |      |      |                |               |           |
| AILC-24 |                 |      |      |                |               |           |
| AILC-25 |                 |      |      |                |               |           |
| AILC-26 |                 |      |      |                |               |           |
| AILC-27 |                 |      |      |                |               |           |
| AILC-28 |                 |      |      |                |               |           |
| AILC-29 |                 |      |      |                |               |           |
| AILC-30 |                 |      |      |                |               |           |

`resultado` en esta tabla es el `final_status` consolidado del caso (el peor de los tres
`final_status` individuales, o una nota si difieren entre sistemas — p. ej.
`MCP: PASS / IA2: REVIEW_REQUIRED / IA3: CRITICAL_FAILURE`).

## 3. Resumen global

Completar únicamente después de llenar las 30 filas de la sección 2.

- **Total de casos ejecutados**: `__ / 30`
- **Casos `PASS`** (los tres sistemas, o desglosado por sistema): `__`
- **Casos `REVIEW_REQUIRED`**: `__`
- **Casos `CRITICAL_FAILURE`**: `__`
- **Faltas críticas detectadas** (lista, con `case_id`, sistema y regla de la sección 3 de la
  rúbrica incumplida): `__`
- **Discrepancias entre modelos** (número total de casos con al menos una discrepancia entre los
  tres sistemas): `__`
- **Discrepancias resueltas por fuente oficial** (de las anteriores, cuántas se resolvieron con
  una fuente oficial verificable, frente a cuántas quedaron sin resolver como `REVIEW_REQUIRED`):
  `__`
- **Tasa de citas verificadas** (fuentes citadas que pudieron confirmarse contra fuente oficial /
  total de fuentes citadas, por sistema): `__`
- **Tasa de abstención correcta** (`abstention_observed == abstention_expected` cuando
  `abstention_expected == true`, por sistema): `__`
- **Calibración de confianza** (casos donde `confidence_claimed` no coincide con
  `confidence_supported`, por sistema): `__`
- **Categorías débiles** (categorías de `ai-legal-test-cases.json` con mayor proporción de
  `REVIEW_REQUIRED`/`CRITICAL_FAILURE`): `__`
- **Casos que deben repetirse** (con motivo documentado según sección 4.7 del plan): `__`
- **Cambios recomendados** (propuestas surgidas de los hallazgos, sin implementarlas en esta
  fase): `__`
- **Cambios realmente autorizados** (debe quedar en `ninguno` mientras esta validación no derive
  en una decisión explícita y separada de cambio de código, proveedor, herramienta, versión o
  licencia — esta plantilla, por sí sola, no autoriza ningún cambio): `ninguno`

## 4. Recordatorios de cierre

- `HUMAN_LEGAL_REVIEW_COMPLETED` permanece `false` al completar esta plantilla. Solo cambia a
  `true` cuando una persona jurista cualificada complete una revisión humana independiente
  documentada (formato equivalente a `docs/procedural-strategy/human-review-template.md`,
  aplicado a estos 30 casos).
- `AI_LEGAL_CROSS_VALIDATION_COMPLETED` solo puede marcarse `true` cuando las 30 filas de la
  sección 2 y sus 30 bloques detallados de la sección 1 estén completos con datos reales
  verificados, no antes.
- Ningún resultado de esta plantilla autoriza publicación del paquete, creación de Git, cambio de
  versión, cambio de licencia o cambio de proveedores/herramientas por sí solo.
