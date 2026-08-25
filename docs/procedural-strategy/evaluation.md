# Evaluacion y pruebas

Cobertura automatizada inicial:

- registro MCP en `NODE_ENV=test`;
- input top-level y anidado estricto;
- carga de documento fixture;
- documento faltante sin inventar fuentes;
- plazo confirmado por usuario;
- plazo no calculable sin base legal;
- ruta de ejecucion de deudas;
- objetivo de efecto suspensivo;
- ausencia deliberada de `get_transitional_provisions`;
- salida conservadora con `insufficient_case_law`.

Los tests viven en `apps/mcp-server/tests/proceduralStrategyTools.test.ts` y no usan Internet.

## Fase 9

La evaluacion de Fase 9 esta implementada como harness determinista local:

- corpus: `tests/fixtures/procedural-strategy/cases.json`;
- comando: `pnpm eval:procedural-strategy`;
- reporte JSON: `docs/release/generated/procedural-strategy-evaluation.json`;
- reporte Markdown: `docs/procedural-strategy/evaluation-report.md`.

El corpus contiene 15 casos: 1 piloto anonimizado/controlado de asistencia juridica gratuita en
Appenzell Ausserrhoden y 14 casos sinteticos juridicamente controlados.

El evaluador no mide similitud literal. Evalua reglas estructurales sobre hechos, estados de hechos,
cronologia, documentos faltantes, competencia, via procesal, admisibilidad, legitimacion, plazos,
prueba, jurisprudencia, estrategia, contraanalisis, confianza, trazabilidad y privacidad.

No existe validacion profesional humana reclamada. Para ello debe completarse
`docs/procedural-strategy/human-review-template.md`. Mientras no exista esa revision, la Fase 9
queda parcial desde el punto de vista de validacion juridica real, aunque el harness automatizado
pase.
