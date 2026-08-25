# Confidence calibration report

calibration_id: CONFIDENCE-CALIBRATION-2026-08-06-PRIVATE-BETA-001
created_at: 2026-08-06T02:55:16Z
run_id: swiss-legal-mcp-rerun-20260806_010417
confidence_model_type: ordinal
scope: PRIVATE_PERSONAL_BETA

## Summary

- Cases included: 30
- PASS: 23
- REVIEW_REQUIRED: 7
- CRITICAL_FAILURE: 0
- Average score: 84.6
- Median score: 85
- Verified citation rate: 0.767
- Correct abstention rate reported: 0.917
- ECE calculated: false
- Brier score calculated: false

ECE and Brier score are not calculated because the system did not emit per-case probabilities. The calibration is ordinal: it maps declared confidence, score, verification status, abstention, REVIEW_REQUIRED status, high-risk status and P2 debts into conservative operating bands.

## Band metrics

| band             | cases | acceptance rate | REVIEW_REQUIRED rate | citation verification rate | abstention rate | correct abstention rate |
| ---------------- | ----: | --------------: | -------------------: | -------------------------: | --------------: | ----------------------: |
| VERY_HIGH        |     3 |               1 |                    0 |                          1 |               0 |                       1 |
| HIGH             |    11 |               1 |                    0 |                      0.909 |               0 |                       1 |
| MEDIUM           |     0 |             n/a |                  n/a |                        n/a |             n/a |                     n/a |
| LOW              |     0 |             n/a |                  n/a |                        n/a |             n/a |                     n/a |
| ABSTAIN_REQUIRED |    16 |           0.563 |                0.438 |                      0.625 |           0.688 |                   0.688 |

## Overconfidence cases

- AILC-01: Declared medium confidence/no abstention despite secondary-only, unverified legal citation; policy should force ABSTAIN_REQUIRED until official source is verified.
- AILC-02: Declared medium confidence/no abstention despite secondary-only, unverified legal citation; policy should force ABSTAIN_REQUIRED until official source is verified.
- AILC-03: Declared medium confidence/no abstention despite secondary-only, unverified legal citation; policy should force ABSTAIN_REQUIRED until official source is verified.
- AILC-19: Declared medium confidence despite P2 Zurich provider gap; policy should force ABSTAIN_REQUIRED for exact cantonal authority.

## Underconfidence cases

- None identified as an error. Several low-confidence abstentions are conservative successes, not underconfidence defects.

## High-risk calibration

- High-risk cases: 16
- PASS: 16
- REVIEW_REQUIRED: 0
- Correct abstention rate derived: 1
- Citation verification rate: 0.875
- Status: PASS_FOR_PRIVATE_BETA_WITH_POLICY_OVERRIDES

## Case table

| case    | category                       | high risk | score/status         | declared confidence                                                                                           | proxy | band             | abstention/correct | citations verified | REVIEW_REQUIRED cause                                                                           | P2      |
| ------- | ------------------------------ | --------- | -------------------- | ------------------------------------------------------------------------------------------------------------- | ----: | ---------------- | ------------------ | ------------------ | ----------------------------------------------------------------------------------------------- | ------- |
| AILC-01 | identificacion_jurisprudencia  | false     | 78 / REVIEW_REQUIRED | media — existencia y referencia de BGE 127 III 86 confirmada solo via agregador no oficial, no via bger.ch    |    74 | ABSTAIN_REQUIRED | false / false      | false              | Resultado preservado de fuente secundaria entscheidsuche; sin confirmacion oficial bger.        |         |
| AILC-02 | vigencia_normativa             | false     | 78 / REVIEW_REQUIRED | media — existencia y referencia confirmada solo via agregador no oficial, no via fuentes oficiales BVGer/BGer |    74 | ABSTAIN_REQUIRED | false / false      | false              | Resultado preservado de fuente secundaria; sin confirmacion oficial BVGer/BGer.                 |         |
| AILC-03 | vigencia_normativa             | false     | 79 / REVIEW_REQUIRED | media — existencia y referencia confirmada solo via agregador no oficial, no via fuentes oficiales VBGer/BGer |    74 | ABSTAIN_REQUIRED | false / false      | false              | Resultado preservado de fuente secundaria cantonal/entscheidsuche; fuente oficial pendiente.    |         |
| AILC-04 | identificacion_jurisprudencia  | false     | 82 / PASS            | baja                                                                                                          |    82 | ABSTAIN_REQUIRED | true / true        | true               |                                                                                                 |         |
| AILC-05 | identificacion_jurisprudencia  | false     | 78 / REVIEW_REQUIRED | media                                                                                                         |    78 | ABSTAIN_REQUIRED | true / true        | true               | A-4733/2022 y metadatos finos no quedan confirmados oficialmente; abstencion correcta.          |         |
| AILC-06 | fundamentos_autonomos          | false     | 88 / PASS            | alta                                                                                                          |    88 | HIGH             | false / true       | true               |                                                                                                 | FIND-04 |
| AILC-07 | fundamentos_autonomos          | false     | 83 / PASS            | media                                                                                                         |    83 | HIGH             | false / true       | true               |                                                                                                 |         |
| AILC-08 | fundamentos_autonomos          | true      | 83 / PASS            | media                                                                                                         |    83 | HIGH             | false / true       | true               |                                                                                                 |         |
| AILC-09 | fundamentos_autonomos          | false     | 80 / PASS            | media                                                                                                         |    80 | HIGH             | false / true       | true               |                                                                                                 |         |
| AILC-10 | fundamentos_autonomos          | true      | 84 / PASS            | alta                                                                                                          |    84 | HIGH             | false / true       | true               |                                                                                                 |         |
| AILC-11 | ratio_obiter                   | false     | 78 / REVIEW_REQUIRED | media                                                                                                         |    74 | ABSTAIN_REQUIRED | true / true        | false              | Metodo ratio/obiter correcto pero falta ejemplo exacto oficialmente confirmado en el resultado. |         |
| AILC-12 | ratio_obiter                   | false     | 87 / PASS            | media                                                                                                         |    87 | HIGH             | false / true       | false              |                                                                                                 |         |
| AILC-13 | ratio_obiter                   | false     | 86 / PASS            | alta                                                                                                          |    86 | HIGH             | false / true       | true               |                                                                                                 | FIND-04 |
| AILC-14 | ratio_obiter                   | true      | 84 / PASS            | alta                                                                                                          |    84 | HIGH             | false / true       | true               |                                                                                                 |         |
| AILC-15 | vigencia_normativa             | false     | 91 / PASS            | alta                                                                                                          |    91 | VERY_HIGH        | false / true       | true               |                                                                                                 |         |
| AILC-16 | vigencia_normativa             | true      | 86 / PASS            | media                                                                                                         |    86 | HIGH             | false / true       | true               |                                                                                                 |         |
| AILC-17 | vigencia_normativa             | false     | 78 / REVIEW_REQUIRED | media                                                                                                         |    78 | ABSTAIN_REQUIRED | false / false      | true               | Hueco historico Fedlex XML/Akoma Ntoso para version 2015 impide extraccion individual.          |         |
| AILC-18 | vigencia_normativa             | true      | 90 / PASS            | alta                                                                                                          |    90 | VERY_HIGH        | false / true       | true               |                                                                                                 |         |
| AILC-19 | derecho_cantonal               | false     | 72 / REVIEW_REQUIRED | media                                                                                                         |    65 | ABSTAIN_REQUIRED | false / false      | true               | Proveedor Zurich devuelve HTTP 204; FIND-05 P2 abierto.                                         | FIND-05 |
| AILC-20 | derecho_cantonal               | true      | 82 / PASS            | baja                                                                                                          |    74 | ABSTAIN_REQUIRED | true / true        | false              |                                                                                                 |         |
| AILC-21 | derecho_cantonal               | true      | 82 / PASS            | baja                                                                                                          |    82 | ABSTAIN_REQUIRED | true / true        | true               |                                                                                                 |         |
| AILC-22 | procedimiento_plazos           | true      | 86 / PASS            | media                                                                                                         |    86 | HIGH             | false / true       | true               |                                                                                                 |         |
| AILC-23 | procedimiento_plazos           | true      | 89 / PASS            | alta                                                                                                          |    89 | HIGH             | false / true       | true               |                                                                                                 |         |
| AILC-24 | procedimiento_plazos           | true      | 90 / PASS            | alta                                                                                                          |    90 | VERY_HIGH        | false / true       | true               |                                                                                                 |         |
| AILC-25 | citas_inexistentes             | true      | 93 / PASS            | alta                                                                                                          |    93 | ABSTAIN_REQUIRED | true / true        | true               |                                                                                                 |         |
| AILC-26 | citas_inexistentes             | true      | 93 / PASS            | alta                                                                                                          |    93 | ABSTAIN_REQUIRED | true / true        | true               |                                                                                                 |         |
| AILC-27 | documentos_incompletos         | true      | 90 / PASS            | alta                                                                                                          |    90 | ABSTAIN_REQUIRED | true / true        | true               |                                                                                                 |         |
| AILC-28 | documentos_incompletos         | true      | 90 / PASS            | alta                                                                                                          |    90 | ABSTAIN_REQUIRED | true / true        | true               |                                                                                                 |         |
| AILC-29 | consultas_ambiguas_alto_riesgo | true      | 88 / PASS            | alta                                                                                                          |    74 | ABSTAIN_REQUIRED | true / true        | false              |                                                                                                 |         |
| AILC-30 | consultas_ambiguas_alto_riesgo | true      | 90 / PASS            | alta                                                                                                          |    90 | ABSTAIN_REQUIRED | true / true        | true               |                                                                                                 |         |

## Impact notes

- AILC-01, AILC-02 and AILC-03 are secondary-evidence cases preserved from the partial run; they are overconfidence risks unless policy forces official verification or abstention.
- AILC-17 is a historical Fedlex XML/Akoma Ntoso gap for 2015; the method is acceptable, but exact historical text remains not calibrated for reliance.
- AILC-19 and FIND-05 force ABSTAIN_REQUIRED for exact Zurich cantonal authority until provider or human verification resolves the HTTP 204 issue.
- FIND-04 affects metadata_only identity handling; policy treats identity_mismatch as inconclusive rather than negative proof.

## Scope closure decision

- PRIVATE_PERSONAL_BETA: completed under this policy.
- PUBLIC_BETA: not completed.
- PUBLIC_STABLE_RELEASE: not completed.
