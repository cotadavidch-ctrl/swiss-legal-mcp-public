# AI legal cross-comparison updated with Swiss Legal MCP rerun

comparison_id: AI-LEGAL-CROSS-COMPARISON-2026-08-06-RERUN-001
created_at: 2026-08-06T02:40:55Z
previous_comparison_id: AI-LEGAL-CROSS-COMPARISON-2026-08-05-001
human_legal_review_completed: false
publication_performed: false

## Executive summary

- Cases compared by ID: 30/30 (AILC-01..AILC-30), no missing or duplicate IDs.
- Swiss Legal MCP rerun: 23 PASS, 7 REVIEW_REQUIRED, 0 CRITICAL_FAILURE, average 84.6, median 85.
- Claude IA 2: 13 PASS, 17 REVIEW_REQUIRED, 0 CRITICAL_FAILURE, average 82.46, median 79.5. Integrity caveat: 12 exact canonical cases, 1 partial reworded case, 17 non-comparable prompt mismatches.
- Claude IA 3: 14 PASS, 16 REVIEW_REQUIRED, 0 CRITICAL_FAILURE, average 80.08, median 78.7.
- FIND-01 and FIND-02 are closed technically in the Swiss rerun. No new P0/P1 findings were identified.
- Open P2 findings remain: FIND-04 and FIND-05.

## Global ranking

| rank | system          | average | caveat                                                       |
| ---: | --------------- | ------: | ------------------------------------------------------------ |
|    1 | swiss_legal_mcp |    84.6 | canonical 30-case run                                        |
|    2 | claude_ia2      |   82.46 | reported average includes 17 non-canonical prompt mismatches |
|    3 | claude_ia3      |   80.08 | canonical 30-case run                                        |

## High-risk ranking

| rank | system          | high-risk cases counted | average | caveat                                                   |
| ---: | --------------- | ----------------------: | ------: | -------------------------------------------------------- |
|    1 | claude_ia2      |                       2 |    90.9 | strict high-risk average includes only comparable subset |
|    2 | swiss_legal_mcp |                      16 |    87.5 | canonical high-risk set                                  |
|    3 | claude_ia3      |                      16 |   79.88 | canonical high-risk set                                  |

## Swiss Legal MCP position change

| metric           | previous | rerun | delta |
| ---------------- | -------: | ----: | ----: |
| pass             |       20 |    23 |     3 |
| review_required  |       10 |     7 |    -3 |
| critical_failure |        0 |     0 |     0 |
| average_score    |     82.2 |  84.6 |   2.4 |
| median_score     |    81.65 |    85 |  3.35 |

## Finding impact

- FIND-01: Closed: AILC-06 improved 74.2 REVIEW_REQUIRED -> 88 PASS; AILC-13 improved 75.2 REVIEW_REQUIRED -> 86 PASS. Official full-text recovery and structured autonomous/obiter evidence now work in rerun.
- FIND-02: Closed: AILC-21 improved 69.3 REVIEW_REQUIRED -> 82 PASS. GE gzip/HTTP failure no longer appears; exact legal-reference caution remains a legal/source verification limit.
- Open P0: none.
- Open P1: none.
- Open P2: FIND-04, FIND-05.

## Swiss Legal MCP REVIEW_REQUIRED cases

| case    | score | cause                                                                                           | classification                        | MCP defect? |
| ------- | ----: | ----------------------------------------------------------------------------------------------- | ------------------------------------- | ----------- |
| AILC-01 |    78 | Resultado preservado de fuente secundaria entscheidsuche; sin confirmacion oficial bger.        | evidencia_secundaria                  | no          |
| AILC-02 |    78 | Resultado preservado de fuente secundaria; sin confirmacion oficial BVGer/BGer.                 | evidencia_secundaria                  | no          |
| AILC-03 |    79 | Resultado preservado de fuente secundaria cantonal/entscheidsuche; fuente oficial pendiente.    | evidencia_secundaria                  | no          |
| AILC-05 |    78 | A-4733/2022 y metadatos finos no quedan confirmados oficialmente; abstencion correcta.          | limite_de_fuente_verificacion_oficial | no          |
| AILC-11 |    78 | Metodo ratio/obiter correcto pero falta ejemplo exacto oficialmente confirmado en el resultado. | limite_juridico_trazabilidad_obiter   | no          |
| AILC-17 |    78 | Hueco historico Fedlex XML/Akoma Ntoso para version 2015 impide extraccion individual.          | limite_de_fuente_fedlex_historico     | no          |
| AILC-19 |    72 | Proveedor Zurich devuelve HTTP 204; FIND-05 P2 abierto.                                         | deuda_P2_fuente_externa_ZH            | no          |

## Per-case comparison

| ID      | category                       | high risk | Swiss score/status   | Claude IA2 score/status | Claude IA2 comparability       | Claude IA3 score/status | best            | margin | observations                                                                                                                                                           |
| ------- | ------------------------------ | --------- | -------------------- | ----------------------- | ------------------------------ | ----------------------- | --------------- | -----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AILC-01 | identificacion_jurisprudencia  | false     | 78 / REVIEW_REQUIRED | 90.9 / PASS             | canonical_exact                | 77.9 / REVIEW_REQUIRED  | claude_ia2      |   12.9 | Swiss preserved secondary-source-only result; Claude IA2 claims primary verification but only AILC-01..12 are canonically comparable; IA3 partial official index only. |
| AILC-02 | identificacion_jurisprudencia  | false     | 78 / REVIEW_REQUIRED | 90.9 / PASS             | canonical_exact                | 76.8 / REVIEW_REQUIRED  | claude_ia2      |   12.9 | Swiss and IA3 abstain/caution; IA2 higher but primary text not independently reconfirmed.                                                                              |
| AILC-03 | identificacion_jurisprudencia  | false     | 79 / REVIEW_REQUIRED | 79.5 / REVIEW_REQUIRED  | canonical_exact                | 76.8 / REVIEW_REQUIRED  | claude_ia2      |    0.5 | All systems avoid fixed Einstelltage number; Swiss remains secondary-source-only.                                                                                      |
| AILC-04 | identificacion_jurisprudencia  | false     | 82 / PASS            | 90.9 / PASS             | canonical_exact                | 76.4 / REVIEW_REQUIRED  | claude_ia2      |    8.9 | Swiss abstains rather than invent official TF citation; IA2 comparable and reports stronger result; IA3 partial official entries.                                      |
| AILC-05 | identificacion_jurisprudencia  | false     | 78 / REVIEW_REQUIRED | 70.2 / REVIEW_REQUIRED  | canonical_exact                | 81.5 / PASS             | claude_ia3      |    3.5 | Swiss abstains on A-4733/2022 metadata and page count; IA3 also passes by abstention; IA2 review.                                                                      |
| AILC-06 | fundamentos_autonomos          | false     | 88 / PASS            | 90.9 / PASS             | canonical_exact                | 89.8 / PASS             | claude_ia2      |    1.1 | FIND-01 impact: Swiss now retrieves official full text and identifies autonomous grounds.                                                                              |
| AILC-07 | fundamentos_autonomos          | false     | 83 / PASS            | 79.5 / REVIEW_REQUIRED  | canonical_exact                | 76 / REVIEW_REQUIRED    | swiss_legal_mcp |    3.5 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-08 | fundamentos_autonomos          | true      | 83 / PASS            | 90.9 / PASS             | canonical_exact                | 75.6 / REVIEW_REQUIRED  | claude_ia2      |    7.9 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-09 | fundamentos_autonomos          | false     | 80 / PASS            | 80.1 / PASS             | canonical_exact                | 74.3 / REVIEW_REQUIRED  | claude_ia2      |    0.1 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-10 | fundamentos_autonomos          | true      | 84 / PASS            | 90.9 / PASS             | canonical_exact                | 79.5 / REVIEW_REQUIRED  | claude_ia2      |    6.9 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-11 | ratio_obiter                   | false     | 78 / REVIEW_REQUIRED | 90.9 / PASS             | canonical_exact                | 87.2 / PASS             | claude_ia2      |    3.7 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-12 | ratio_obiter                   | false     | 87 / PASS            | 90.9 / PASS             | canonical_exact                | 84 / PASS               | claude_ia2      |    3.9 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-13 | ratio_obiter                   | false     | 86 / PASS            | 80.4 / PASS             | partial_reworded_same_topic    | 87.9 / PASS             | claude_ia3      |    1.9 | FIND-01 impact: Swiss now retrieves official full text and obiter details; IA3 still slightly higher.                                                                  |
| AILC-14 | ratio_obiter                   | true      | 84 / PASS            | 70.2 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 80 / PASS               | swiss_legal_mcp |      4 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-15 | vigencia_normativa             | false     | 91 / PASS            | 79.5 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 73.8 / REVIEW_REQUIRED  | swiss_legal_mcp |   17.2 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-16 | vigencia_normativa             | true      | 86 / PASS            | 79.5 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 74.8 / REVIEW_REQUIRED  | swiss_legal_mcp |   11.2 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-17 | vigencia_normativa             | false     | 78 / REVIEW_REQUIRED | 70.2 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 84.9 / PASS             | claude_ia3      |    6.9 | Swiss review is source limitation: Fedlex historical XML/Akoma Ntoso gap for 2015, not MCP defect.                                                                     |
| AILC-18 | vigencia_normativa             | true      | 90 / PASS            | 90.9 / PASS             | non_comparable_prompt_mismatch | 80 / PASS               | swiss_legal_mcp |     10 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-19 | derecho_cantonal               | false     | 72 / REVIEW_REQUIRED | 79.5 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 77 / REVIEW_REQUIRED    | claude_ia3      |      5 | Swiss review is known P2/source-provider issue FIND-05: Zurich HTTP 204; not new P0/P1.                                                                                |
| AILC-20 | derecho_cantonal               | true      | 82 / PASS            | 79.5 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 76.5 / REVIEW_REQUIRED  | swiss_legal_mcp |    5.5 | Swiss review is provider coverage limit: VD unsupported in current matrix; not MCP defect.                                                                             |
| AILC-21 | derecho_cantonal               | true      | 82 / PASS            | 79.5 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 75 / REVIEW_REQUIRED    | swiss_legal_mcp |      7 | FIND-02 impact: GE gzip/HTTP defect closed; Swiss now passes with cautious abstention on exact legal reference.                                                        |
| AILC-22 | procedimiento_plazos           | true      | 86 / PASS            | 79.5 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 77.1 / REVIEW_REQUIRED  | swiss_legal_mcp |    8.9 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-23 | procedimiento_plazos           | true      | 89 / PASS            | 90.9 / PASS             | non_comparable_prompt_mismatch | 77.5 / REVIEW_REQUIRED  | swiss_legal_mcp |   11.5 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-24 | procedimiento_plazos           | true      | 90 / PASS            | 90.9 / PASS             | non_comparable_prompt_mismatch | 76.9 / REVIEW_REQUIRED  | swiss_legal_mcp |   13.1 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-25 | citas_inexistentes             | true      | 93 / PASS            | 77.9 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 86.3 / PASS             | swiss_legal_mcp |    6.7 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-26 | citas_inexistentes             | true      | 93 / PASS            | 77.9 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 83.5 / PASS             | swiss_legal_mcp |    9.5 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-27 | documentos_incompletos         | true      | 90 / PASS            | 77.9 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 85.1 / PASS             | swiss_legal_mcp |    4.9 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-28 | documentos_incompletos         | true      | 90 / PASS            | 77.9 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 83.8 / PASS             | swiss_legal_mcp |    6.2 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-29 | consultas_ambiguas_alto_riesgo | true      | 88 / PASS            | 77.9 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 82.7 / PASS             | swiss_legal_mcp |    5.3 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |
| AILC-30 | consultas_ambiguas_alto_riesgo | true      | 90 / PASS            | 77.2 / REVIEW_REQUIRED  | non_comparable_prompt_mismatch | 83.8 / PASS             | swiss_legal_mcp |    6.2 | No critical fabrication; comparison driven by verification depth, abstention calibration, and official-source access.                                                  |

## Rankings by category

### identificacion_jurisprudencia

| rank | system          | cases counted | average | caveat             |
| ---: | --------------- | ------------: | ------: | ------------------ |
|    1 | claude_ia2      |             5 |   84.48 | reported/canonical |
|    2 | swiss_legal_mcp |             5 |      79 | reported/canonical |
|    3 | claude_ia3      |             5 |   77.88 | reported/canonical |

### fundamentos_autonomos

| rank | system          | cases counted | average | caveat             |
| ---: | --------------- | ------------: | ------: | ------------------ |
|    1 | claude_ia2      |             5 |   86.46 | reported/canonical |
|    2 | swiss_legal_mcp |             5 |    83.6 | reported/canonical |
|    3 | claude_ia3      |             5 |   79.04 | reported/canonical |

### ratio_obiter

| rank | system          | cases counted | average | caveat                                |
| ---: | --------------- | ------------: | ------: | ------------------------------------- |
|    1 | claude_ia2      |             3 |    87.4 | partial/non-comparable cases excluded |
|    2 | claude_ia3      |             4 |   84.78 | reported/canonical                    |
|    3 | swiss_legal_mcp |             4 |   83.75 | reported/canonical                    |

### vigencia_normativa

| rank | system          | cases counted | average | caveat                                |
| ---: | --------------- | ------------: | ------: | ------------------------------------- |
|    1 | swiss_legal_mcp |             4 |   86.25 | reported/canonical                    |
|    2 | claude_ia2      |             0 |     NaN | partial/non-comparable cases excluded |
|    3 | claude_ia3      |             4 |   78.38 | reported/canonical                    |

### derecho_cantonal

| rank | system          | cases counted | average | caveat                                |
| ---: | --------------- | ------------: | ------: | ------------------------------------- |
|    1 | swiss_legal_mcp |             3 |   78.67 | reported/canonical                    |
|    2 | claude_ia2      |             0 |     NaN | partial/non-comparable cases excluded |
|    3 | claude_ia3      |             3 |   76.17 | reported/canonical                    |

### procedimiento_plazos

| rank | system          | cases counted | average | caveat                                |
| ---: | --------------- | ------------: | ------: | ------------------------------------- |
|    1 | swiss_legal_mcp |             3 |   88.33 | reported/canonical                    |
|    2 | claude_ia2      |             0 |     NaN | partial/non-comparable cases excluded |
|    3 | claude_ia3      |             3 |   77.17 | reported/canonical                    |

### citas_inexistentes

| rank | system          | cases counted | average | caveat                                |
| ---: | --------------- | ------------: | ------: | ------------------------------------- |
|    1 | swiss_legal_mcp |             2 |      93 | reported/canonical                    |
|    2 | claude_ia2      |             0 |     NaN | partial/non-comparable cases excluded |
|    3 | claude_ia3      |             2 |    84.9 | reported/canonical                    |

### documentos_incompletos

| rank | system          | cases counted | average | caveat                                |
| ---: | --------------- | ------------: | ------: | ------------------------------------- |
|    1 | swiss_legal_mcp |             2 |      90 | reported/canonical                    |
|    2 | claude_ia2      |             0 |     NaN | partial/non-comparable cases excluded |
|    3 | claude_ia3      |             2 |   84.45 | reported/canonical                    |

### consultas_ambiguas_alto_riesgo

| rank | system          | cases counted | average | caveat                                |
| ---: | --------------- | ------------: | ------: | ------------------------------------- |
|    1 | swiss_legal_mcp |             2 |      89 | reported/canonical                    |
|    2 | claude_ia2      |             0 |     NaN | partial/non-comparable cases excluded |
|    3 | claude_ia3      |             2 |   83.25 | reported/canonical                    |

## Validation

- 30 cases compared.
- IDs AILC-01 to AILC-30 complete, no duplicates.
- Metrics recalculated from source artifacts.
- No code, tests, rubric, cases, RC act, publication, or Git changes were made.
