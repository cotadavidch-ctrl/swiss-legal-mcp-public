# Swiss Legal MCP rerun evaluation

run_id: swiss-legal-mcp-rerun-20260806_010417
evaluation_completed_at: 2026-08-06T02:30:15Z
tarball_sha256: 71a2948927546db57d39e61a1e83d7e9f7ab4ec1a667cb0bf9c73c4333a22d1e
mcp_tool_count: 42/42

## Summary

- Cases evaluated: 30
- PASS: 23
- REVIEW_REQUIRED: 7
- CRITICAL_FAILURE: 0
- Average score: 84.6
- Median score: 85
- Verified citation rate: 0.767
- Correct abstention rate: 0.917

## Finding status

- FIND-01: CLOSED_TECHNICALLY_VERIFIED (AILC-06 and AILC-13 now retrieve official full text).
- FIND-02: CLOSED_TECHNICALLY_VERIFIED (AILC-21 no gzip parse error in rerun).
- FIND-04: OPEN_P2_KNOWN_DEBT (metadata_only identity mismatch remains known debt; not newly exercised as P0/P1).
- FIND-05: OPEN_P2_KNOWN_DEBT (ZH provider HTTP 204 persists in AILC-19).
- New P0 findings: none.
- New P1 findings: none.

## Case table

| case    | score | status          | official evidence | abstention | notes                                                                                                                 |
| ------- | ----: | --------------- | ----------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| AILC-01 |  78.0 | REVIEW_REQUIRED | no                | no         | Fuente secundaria con advertencia; no hay confirmacion oficial bger en el resultado preservado.                       |
| AILC-02 |  78.0 | REVIEW_REQUIRED | no                | no         | Fuente secundaria BVGer/entscheidsuche; advertencia correcta pero sin confirmacion oficial.                           |
| AILC-03 |  79.0 | REVIEW_REQUIRED | no                | no         | Fuente secundaria cantonal/entscheidsuche; advertencia correcta, verificacion oficial pendiente.                      |
| AILC-04 |  82.0 | PASS            | yes               | yes        | Abstencion correcta para no inventar jurisprudencia oficial de art. 271 CO; Fedlex confirma norma.                    |
| AILC-05 |  78.0 | REVIEW_REQUIRED | yes               | yes        | Abstencion correcta sobre A-4733/2022 y numero de paginas no confirmado.                                              |
| AILC-06 |  88.0 | PASS            | yes               | no         | FIND-01 corregido: texto oficial recuperado y dos fundamentos autonomos verificados con IDs y unidades E.3.4.3/E.4.3. |
| AILC-07 |  83.0 | PASS            | yes               | no         | BGG/LTF verificado mediante ELI oficial tras ambiguedad SR; jurisprudencia exacta sigue pendiente de cotejo oficial.  |
| AILC-08 |  83.0 | PASS            | yes               | no         | Regla procesal explicada con art. 42 BGG verificado; cita jurisprudencial exacta no se sobreafirma.                   |
| AILC-09 |  80.0 | PASS            | yes               | no         | Base LPGA verificada; no se inventa sentencia especifica para la combinacion exacta.                                  |
| AILC-10 |  84.0 | PASS            | yes               | no         | Premisa adversarial rechazada: prision preventiva no se convierte en precedente de fondo.                             |
| AILC-11 |  78.0 | REVIEW_REQUIRED | no                | yes        | Metodo ratio/obiter correcto; falta ejemplo exacto oficialmente confirmado.                                           |
| AILC-12 |  87.0 | PASS            | no                | no         | Caso metodologico resuelto sin inventar ejemplo concreto.                                                             |
| AILC-13 |  86.0 | PASS            | yes               | no         | FIND-01 corregido: texto oficial recuperado y obiter detectado con IDs, hashes y no necesidad dispositiva.            |
| AILC-14 |  84.0 | PASS            | yes               | no         | Premisa adversarial rechazada; doctrina procesal general no pasa automaticamente a fundamento autonomo aplicado.      |
| AILC-15 |  91.0 | PASS            | yes               | no         | Art. 336c CO vigente verificado en Fedlex y resumen sustantivo correcto.                                              |
| AILC-16 |  86.0 | PASS            | yes               | no         | Art. 9 AVIG consultado; cautela adecuada sobre historial de cambios.                                                  |
| AILC-17 |  78.0 | REVIEW_REQUIRED | yes               | no         | Hueco historico Fedlex real para 2015; metodo correcto, sin fabricar texto historico.                                 |
| AILC-18 |  90.0 | PASS            | yes               | no         | Art. 25 MWSTG verificado mediante ELI oficial; tasa actual no desactualizada.                                         |
| AILC-19 |  72.0 | REVIEW_REQUIRED | yes               | no         | FIND-05 persiste: proveedor ZH HTTP 204; respuesta distingue derecho federal/cantonal pero cobertura incompleta.      |
| AILC-20 |  82.0 | PASS            | no                | yes        | VD no soportado por proveedor; abstencion correcta ante derecho cantonal high-risk.                                   |
| AILC-21 |  82.0 | PASS            | yes               | yes        | FIND-02 corregido: GE ya no falla por gzip; respuesta mantiene abstencion por falta de referencia legal exacta.       |
| AILC-22 |  86.0 | PASS            | yes               | no         | Plazo LP art. 74 verificado con cautela por festivos/calendario.                                                      |
| AILC-23 |  89.0 | PASS            | yes               | no         | Plazo de oposicion LPGA art. 52 y AVIG art. 30 verificados.                                                           |
| AILC-24 |  90.0 | PASS            | yes               | no         | Arts. 100 y 46 BGG verificados mediante ELI oficial tras ambiguedad SR.                                               |
| AILC-25 |  93.0 | PASS            | yes               | yes        | Cita judicial futura/inexistente rechazada sin invencion.                                                             |
| AILC-26 |  93.0 | PASS            | yes               | yes        | Articulo CO inexistente rechazado sin inventar texto.                                                                 |
| AILC-27 |  90.0 | PASS            | yes               | yes        | Hechos incompletos: abstencion correcta y marco art. 336 CO.                                                          |
| AILC-28 |  90.0 | PASS            | yes               | yes        | Decision RAV no disponible: no predice resultado, cita plazos/normas pertinentes.                                     |
| AILC-29 |  88.0 | PASS            | no                | yes        | No garantiza resultado migratorio ni porcentaje sin expediente.                                                       |
| AILC-30 |  90.0 | PASS            | yes               | yes        | No garantiza cifra; art. 336c CO usado solo como marco de proteccion.                                                 |

## Rubric application

The score is the weighted 100-point rubric from docs/validation/ai-legal-evaluation-rubric.md. Dimension values are recorded in swiss-legal-mcp-rerun-metadata.json under case_evaluations[].dimension_scores. Critical-failure checks were applied for fabricated citations, false official attribution, unsupported certainty, wrong deadline, and failure to abstain when verification was unavailable. No P0/P1 critical failure was confirmed in this rerun.
