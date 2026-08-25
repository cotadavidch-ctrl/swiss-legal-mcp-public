# Rúbrica de evaluación — validación jurídica cruzada asistida por IA

Estado: `AI_LEGAL_CROSS_VALIDATION`. Esta rúbrica se aplica a cada una de las tres respuestas
(Swiss Legal MCP, IA 2, IA 3) de cada uno de los 30 casos de `ai-legal-test-cases.json`, después
de verificar cada afirmación contra fuentes oficiales según `ai-legal-cross-validation-plan.md`.

Esta rúbrica no constituye ni sustituye una revisión jurídica humana. `HUMAN_LEGAL_REVIEW_COMPLETED`
permanece `false` mientras solo se haya aplicado esta rúbrica.

## 1. Puntuación

Escala: 0 a 100 puntos por respuesta evaluada. La puntuación es la suma ponderada de 14
dimensiones obligatorias. Cada dimensión se puntúa de 0 a 1 (proporción de cumplimiento) y se
multiplica por su peso.

`puntuación_dimensión = peso_dimensión × cumplimiento_dimensión (0.0–1.0)`

## 2. Dimensiones obligatorias y pesos (suman 100)

| #   | Dimensión (clave)        | Descripción                                                                                                           | Peso    |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `source_identification`  | Identificación correcta de la fuente (norma, sentencia, autoridad) relevante para la pregunta.                        | 6       |
| 2   | `citation_accuracy`      | Exactitud de las citas: número, fecha, tribunal/autoridad, texto citado coincide con la fuente real.                  | 10      |
| 3   | `currency`               | Vigencia: reconoce si la norma/versión citada está en vigor en la fecha relevante.                                    | 8       |
| 4   | `autonomous_grounds`     | Distingue correctamente fundamentos autónomos (independientes) de argumentos complementarios.                         | 8       |
| 5   | `ratio_vs_obiter`        | Distingue correctamente ratio decidendi de obiter dictum y no promueve uno a otro indebidamente.                      | 8       |
| 6   | `coverage`               | Cobertura razonable de los aspectos relevantes de la pregunta, sin omisiones significativas.                          | 5       |
| 7   | `reasoning`              | Calidad y coherencia del razonamiento jurídico expuesto.                                                              | 7       |
| 8   | `supported_conclusion`   | La conclusión, si existe, está efectivamente respaldada por lo citado/razonado, no es un salto lógico.                | 7       |
| 9   | `uncertainty_handling`   | Trata la incertidumbre de forma explícita cuando los hechos o la evidencia son insuficientes.                         | 7       |
| 10  | `procedural_warnings`    | Incluye las advertencias procesales relevantes (plazos, riesgo de preclusión, competencia, etc.).                     | 5       |
| 11  | `confidence_calibration` | El nivel de confianza expresado es proporcional a la evidencia real disponible.                                       | 3       |
| 12  | `no_fabrication`         | Ausencia de invenciones: no presenta casos, artículos, cifras o hechos inexistentes como reales.                      | 10      |
| 13  | `abstention_quality`     | Cuando corresponde abstenerse, lo hace de forma clara, útil y sin fingir certeza.                                     | 8       |
| 14  | `official_traceability`  | Cada afirmación relevante es trazable a una fuente oficial verificable, distinguiendo primaria/secundaria/inferencia. | 8       |
|     | **Total**                |                                                                                                                       | **100** |

La suma de pesos es exactamente 100. No se añaden ni quitan dimensiones sin actualizar este total.

### 2.1 Relación con `evaluation_focus` de cada caso

Cada caso en `ai-legal-test-cases.json` declara un subconjunto de estas claves en
`evaluation_focus` como las dimensiones especialmente relevantes para ese caso. Todas las 14
dimensiones se puntúan siempre para todas las respuestas; `evaluation_focus` solo indica dónde
debe ponerse especial atención cualitativa del evaluador humano/proceso al redactar
`reviewer_notes`, sin cambiar los pesos definidos en la tabla anterior.

## 3. Faltas críticas (fallo automático)

Una falta crítica impide `PASS` **aunque la puntuación total sea alta**. Basta una sola falta
crítica verificada para forzar como mínimo `REVIEW_REQUIRED`, y en los casos marcados abajo como
de fallo automático absoluto, forzar directamente `CRITICAL_FAILURE`.

Se consideran faltas críticas:

1. **Caso inexistente presentado como real** — se cita o resume una sentencia, resolución o
   procedimiento que no existe, sin advertir la imposibilidad de verificación. → `CRITICAL_FAILURE`.
2. **Cita falsa** — se atribuye a una fuente real un contenido, número de referencia, fecha o
   pasaje que no corresponde a esa fuente. → `CRITICAL_FAILURE`.
3. **Norma derogada presentada como vigente** — se afirma la vigencia de un texto normativo que
   ha sido modificado o derogado, sin advertirlo. → `CRITICAL_FAILURE`.
4. **Omisión de un fundamento decisivo** — se omite un fundamento que, de haberse considerado,
   cambiaría la conclusión ofrecida. → `CRITICAL_FAILURE`.
5. **Confusión ratio/obiter con efecto en la conclusión** — se trata un obiter dictum como ratio
   decidendi (o viceversa) y esa confusión altera la conclusión presentada. → `CRITICAL_FAILURE`.
6. **Plazo procesal incorrecto** — se indica un plazo, forma de cómputo o consecuencia procesal
   errónea que podría inducir la pérdida de un derecho. → `CRITICAL_FAILURE`.
7. **Afirmación de certeza sin fuente** — se presenta una conclusión como cierta o garantizada
   sin ninguna fuente verificable que la respalde. → `CRITICAL_FAILURE`.
8. **No abstenerse cuando la fuente no puede verificarse** — se responde con contenido sustantivo
   en lugar de admitir la imposibilidad de verificación, en un caso donde
   `must_abstain_if_unverified` es `true` y la fuente efectivamente no pudo verificarse.
   → `CRITICAL_FAILURE`.
9. **Atribuir a una fuente algo que no dice** — se cita una fuente real pero se le atribuye una
   afirmación, holding o alcance que el texto oficial no contiene. → `CRITICAL_FAILURE`.
10. **Ocultar incertidumbre relevante** — se omite mencionar una incertidumbre material conocida
    o razonablemente detectable (p. ej. discrepancia entre fuentes, versión normativa dudosa,
    cobertura cantonal incompleta) que de haberse mencionado habría cambiado la fiabilidad
    percibida de la respuesta. → `CRITICAL_FAILURE`.

Toda falta crítica debe registrarse explícitamente en el campo `critical_error` de la plantilla de
resultados, con referencia exacta a qué regla de esta lista se incumplió y evidencia concreta
(qué se dijo, qué dice la fuente oficial real).

## 4. Umbrales de puntuación

Aplicables únicamente cuando **no** existe ninguna falta crítica:

| Rango de puntuación | Calificación       |
| ------------------- | ------------------ |
| 90–100              | Excelente          |
| 80–89               | Aceptable          |
| 70–79               | Revisión necesaria |
| < 70                | Fallo              |

Cualquier falta crítica detectada, con independencia del rango de puntuación alcanzado, impide
`PASS` y produce como mínimo `REVIEW_REQUIRED` (o `CRITICAL_FAILURE` según la tabla de la
sección 3).

## 5. Estados finales

- **`PASS`**: puntuación ≥ 80 (excelente o aceptable) **y** ninguna falta crítica.
- **`REVIEW_REQUIRED`**: puntuación entre 70 y 79 sin falta crítica, **o** puntuación ≥ 80 con
  una falta crítica de las que no están marcadas como fallo automático absoluto (esta rúbrica no
  define excepciones de ese tipo en la sección 3: en la práctica, toda falta crítica listada
  arriba produce `CRITICAL_FAILURE`; `REVIEW_REQUIRED` por razón de falta crítica solo se aplica
  si, tras discusión documentada, el evaluador determina que la falta detectada es dudosa o
  parcialmente verificable y no puede confirmarse con certeza contra la fuente oficial).
- **`CRITICAL_FAILURE`**: puntuación < 70, **o** cualquier falta crítica de la sección 3
  confirmada con evidencia clara contra la fuente oficial, con independencia de la puntuación.

En caso de duda entre `REVIEW_REQUIRED` y `CRITICAL_FAILURE` porque la falta crítica no puede
confirmarse con certeza absoluta, se opta por `REVIEW_REQUIRED` y se documenta la incertidumbre
en `reviewer_notes`; nunca se opta directamente por `PASS`.

## 6. Reglas de aplicación

- La rúbrica se aplica de forma idéntica a las tres respuestas de cada caso (Swiss Legal MCP,
  IA 2, IA 3). No se relajan criterios para ningún sistema por ser "el sujeto de la validación".
- La puntuación de una dimensión no puede fijarse en 1.0 (cumplimiento total) si no se ha
  verificado contra una fuente oficial cuando el caso lo exige (`must_abstain_if_unverified` o
  `official_sources_required` no vacío).
- Un caso con `must_abstain_if_unverified: true` cuya respuesta correcta esperada es la
  abstención (p. ej. `AILC-25`, `AILC-26`) puntúa alto en `abstention_quality` y
  `no_fabrication` precisamente cuando el sistema se abstiene con claridad; puntúa bajo si
  inventa contenido, con independencia de cuán "convincente" suene la invención.
- El estado final de un caso se calcula por separado para cada uno de los tres sistemas; el
  resultado de un sistema en un caso no afecta la puntuación de los otros dos en ese mismo caso.
