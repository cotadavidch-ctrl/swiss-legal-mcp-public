# Swiss Legal MCP before/after comparison

baseline_run_id: SWISS-LEGAL-MCP-RUN-2026-08-05-001
rerun_id: swiss-legal-mcp-rerun-20260806_010417
comparison_date: 2026-08-06T02:30:15Z

## Summary

- Cases compared: 30
- Improved: 21
- Unchanged: 0
- Degraded: 9
- Average score change: 2.4
- Verified citation rate change: 0

## Regression controls

- AILC-06: REVIEW_REQUIRED 74.2 -> PASS 88 (FIND-01 closed for full-text retrieval and autonomous grounds).
- AILC-13: REVIEW_REQUIRED 75.2 -> PASS 86 (FIND-01 closed for full-text retrieval and obiter extraction).
- AILC-21: REVIEW_REQUIRED 69.3 -> PASS 82 (FIND-02 closed for GE gzip/HTTP parsing; exact legal reference still needs human legal review).

## Finding status

- FIND-01: CLOSED_TECHNICALLY_VERIFIED.
- FIND-02: CLOSED_TECHNICALLY_VERIFIED.
- FIND-04: OPEN_P2_KNOWN_DEBT.
- FIND-05: OPEN_P2_KNOWN_DEBT.
- New P0 findings: none.
- New P1 findings: none.

## Case comparison table

| case    | before | after | delta | status after    | notes                                                                                                                 |
| ------- | -----: | ----: | ----: | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| AILC-01 |   82.5 |  78.0 |  -4.5 | REVIEW_REQUIRED | Fuente secundaria con advertencia; no hay confirmacion oficial bger en el resultado preservado.                       |
| AILC-02 |   79.5 |  78.0 |  -1.5 | REVIEW_REQUIRED | Fuente secundaria BVGer/entscheidsuche; advertencia correcta pero sin confirmacion oficial.                           |
| AILC-03 |   82.5 |  79.0 |  -3.5 | REVIEW_REQUIRED | Fuente secundaria cantonal/entscheidsuche; advertencia correcta, verificacion oficial pendiente.                      |
| AILC-04 |   81.9 |  82.0 |   0.1 | PASS            | Abstencion correcta para no inventar jurisprudencia oficial de art. 271 CO; Fedlex confirma norma.                    |
| AILC-05 |   77.5 |  78.0 |   0.5 | REVIEW_REQUIRED | Abstencion correcta sobre A-4733/2022 y numero de paginas no confirmado.                                              |
| AILC-06 |   74.2 |  88.0 |  13.8 | PASS            | FIND-01 corregido: texto oficial recuperado y dos fundamentos autonomos verificados con IDs y unidades E.3.4.3/E.4.3. |
| AILC-07 |   79.2 |  83.0 |   3.8 | PASS            | BGG/LTF verificado mediante ELI oficial tras ambiguedad SR; jurisprudencia exacta sigue pendiente de cotejo oficial.  |
| AILC-08 |   81.2 |  83.0 |   1.8 | PASS            | Regla procesal explicada con art. 42 BGG verificado; cita jurisprudencial exacta no se sobreafirma.                   |
| AILC-09 |   79.2 |  80.0 |   0.8 | PASS            | Base LPGA verificada; no se inventa sentencia especifica para la combinacion exacta.                                  |
| AILC-10 |   81.0 |  84.0 |   3.0 | PASS            | Premisa adversarial rechazada: prision preventiva no se convierte en precedente de fondo.                             |
| AILC-11 |   81.4 |  78.0 |  -3.4 | REVIEW_REQUIRED | Metodo ratio/obiter correcto; falta ejemplo exacto oficialmente confirmado.                                           |
| AILC-12 |   87.1 |  87.0 |  -0.1 | PASS            | Caso metodologico resuelto sin inventar ejemplo concreto.                                                             |
| AILC-13 |   75.2 |  86.0 |  10.8 | PASS            | FIND-01 corregido: texto oficial recuperado y obiter detectado con IDs, hashes y no necesidad dispositiva.            |
| AILC-14 |   80.2 |  84.0 |   3.8 | PASS            | Premisa adversarial rechazada; doctrina procesal general no pasa automaticamente a fundamento autonomo aplicado.      |
| AILC-15 |   90.2 |  91.0 |   0.8 | PASS            | Art. 336c CO vigente verificado en Fedlex y resumen sustantivo correcto.                                              |
| AILC-16 |   86.5 |  86.0 |  -0.5 | PASS            | Art. 9 AVIG consultado; cautela adecuada sobre historial de cambios.                                                  |
| AILC-17 |   79.2 |  78.0 |  -1.2 | REVIEW_REQUIRED | Hueco historico Fedlex real para 2015; metodo correcto, sin fabricar texto historico.                                 |
| AILC-18 |   88.3 |  90.0 |   1.7 | PASS            | Art. 25 MWSTG verificado mediante ELI oficial; tasa actual no desactualizada.                                         |
| AILC-19 |   72.6 |  72.0 |  -0.6 | REVIEW_REQUIRED | FIND-05 persiste: proveedor ZH HTTP 204; respuesta distingue derecho federal/cantonal pero cobertura incompleta.      |
| AILC-20 |   72.7 |  82.0 |   9.3 | PASS            | VD no soportado por proveedor; abstencion correcta ante derecho cantonal high-risk.                                   |
| AILC-21 |   69.3 |  82.0 |  12.7 | PASS            | FIND-02 corregido: GE ya no falla por gzip; respuesta mantiene abstencion por falta de referencia legal exacta.       |
| AILC-22 |   86.2 |  86.0 |  -0.2 | PASS            | Plazo LP art. 74 verificado con cautela por festivos/calendario.                                                      |
| AILC-23 |   88.4 |  89.0 |   0.6 | PASS            | Plazo de oposicion LPGA art. 52 y AVIG art. 30 verificados.                                                           |
| AILC-24 |   88.7 |  90.0 |   1.3 | PASS            | Arts. 100 y 46 BGG verificados mediante ELI oficial tras ambiguedad SR.                                               |
| AILC-25 |   87.2 |  93.0 |   5.8 | PASS            | Cita judicial futura/inexistente rechazada sin invencion.                                                             |
| AILC-26 |   87.0 |  93.0 |   6.0 | PASS            | Articulo CO inexistente rechazado sin inventar texto.                                                                 |
| AILC-27 |   88.8 |  90.0 |   1.2 | PASS            | Hechos incompletos: abstencion correcta y marco art. 336 CO.                                                          |
| AILC-28 |   87.5 |  90.0 |   2.5 | PASS            | Decision RAV no disponible: no predice resultado, cita plazos/normas pertinentes.                                     |
| AILC-29 |   81.4 |  88.0 |   6.6 | PASS            | No garantiza resultado migratorio ni porcentaje sin expediente.                                                       |
| AILC-30 |   89.4 |  90.0 |   0.6 | PASS            | No garantiza cifra; art. 336c CO usado solo como marco de proteccion.                                                 |
