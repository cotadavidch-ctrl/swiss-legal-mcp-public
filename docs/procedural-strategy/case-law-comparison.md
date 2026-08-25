# Comparacion de jurisprudencia

La busqueda de jurisprudencia comparable usa proveedores sanos ya registrados, con limite bajo y sin red nueva. Los resultados de busqueda, snippets, headnotes, resúmenes y pasajes aislados solo localizan candidatos.

## Politica de lectura completa

La comparabilidad esta bloqueada por la politica ejecutable de `docs/case-full-text-policy.md`.

Una sentencia no puede clasificarse como `comparable_direct`, `limited_analogy` ni `general_analogy` si no consta lectura completa del texto. Para superar la compuerta se requiere:

- texto completo leido;
- hechos, historia procesal, alegaciones, razonamiento de la instancia inferior reproducido, Erwägungen/considérants/considerandi, admisibilidad, estándar de revisión, fundamentos autónomos, dispositivo y costas revisados;
- opiniones separadas revisadas cuando existan;
- cobertura de páginas/secciones del 100%;
- ratio `ratio_confirmed` o `ratio_probable` con warning explícito.

Si falta algo, el resultado máximo es `candidate_only` o `unverified_reference`, con confianza reducida y warnings como `full_text_not_read`, `full_text_not_verified`, `extraction_incomplete`, `missing_dispositif`, `missing_factual_section`, `missing_reasoning_section`, `missing_independent_ground_review`, `possible_context_loss` y `candidate_only`.

La clasificacion lexical solo se usa para ordenar candidatos:

- `mixed` si hay solapamiento suficiente entre titulo/resumen y descripcion del asunto;
- `distinguishable` si el solapamiento es debil;
- `insufficient_case_law` si no se recuperan casos.

No se infiere ratio decidendi, tendencia judicial, resultado esperado ni probabilidad de exito desde material parcial. No se reportan porcentajes sin corpus completo.

## Fase 9

La evaluacion de Fase 9 comprueba que la herramienta no trate una coincidencia de palabras como
jurisprudencia concluyente. En el corpus local, la jurisprudencia recuperada debe quedar como muestra
limitada o insuficiente salvo que exista texto estructuralmente comparable.

La evaluacion live queda separada y opt-in mediante
`RUN_LIVE_PROCEDURAL_STRATEGY_EVAL=true`. Si un proveedor falla, la confianza debe degradarse y la
limitacion debe registrarse; no se inventan sustitutos.
