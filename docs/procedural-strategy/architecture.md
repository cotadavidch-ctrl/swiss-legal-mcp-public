# Fase 8: estrategia procesal

Estado: implementada como herramienta MCP determinista `analyze_procedural_strategy`.

La herramienta vive en `apps/mcp-server/src/tools/proceduralStrategyTools.ts` y no añade proveedores juridicos nuevos. Usa:

- el expediente aportado por el usuario;
- documentos ya recuperables por proveedores registrados;
- `packages/citations` para detectar citas en hechos y descripcion;
- busquedas conservadoras sobre proveedores disponibles para jurisprudencia comparable.

No usa IA, embeddings, modelos estadisticos ni reglas no trazadas. Si no hay fuente o dato suficiente devuelve `insufficient_information`, `cannot_calculate`, `insufficient_case_law` o advertencias equivalentes.

## Flujo

1. Validacion Zod estricta de entrada.
2. Carga de documentos referenciados por `documentId`.
3. Construccion de cronologia.
4. Identificacion de cuestiones procesales basicas.
5. Analisis conservador de plazos, sin calcular plazos no soportados.
6. Ruta procesal tentativa por materia.
7. Matriz de prueba y brechas.
8. Busqueda limitada de jurisprudencia comparable en proveedores sanos.
9. Opciones, estrategia, escenarios y riesgos con confianza separada por dimension.

## Guardrails

- No garantiza exito.
- No declara competencia definitiva.
- No inventa jurisprudencia, plazos, autoridades ni normas.
- No resuelve ECLI o abreviaturas sistematicamente.
- No registra cuerpos completos, documentos privados ni secretos.
- Recomienda revision profesional cuando el riesgo procesal es alto.
