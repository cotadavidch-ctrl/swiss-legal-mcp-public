# Analisis juridico contradictorio multirrol

Estado: implementado localmente con dos herramientas MCP:

- `analyze_swiss_legal_positions`
- `validate_multirole_legal_analysis`

La capacidad produce una simulacion analitica estructurada y auditable. No presenta ningun rol como persona real y no sustituye asesoramiento juridico profesional.

## Roles

La herramienta determina primero `case_type`, `procedural_stage`, `applicable_roles`, `non_applicable_roles` y `reason_for_role_selection`.

Roles soportados:

- `claimant_or_appellant`
- `respondent_or_authority`
- `opposing_party`
- `prosecution`
- `defence`
- `first_instance_court`
- `appellate_court`
- `supreme_court_review`
- `neutral_risk_assessment`
- `deliberation_panel`

`prosecution` y `defence` solo son aplicables si el asunto se identifica como penal. En asuntos administrativos, civiles, fiscales, sociales, laborales, arrendaticios o de ejecucion, esos roles quedan como `not_applicable`.

## Separacion de capas

Cada rol tiene su propio objeto con posicion procesal, objetivo, carga de alegacion/prueba, hechos admisibles, hechos disputados, prueba utilizable, prueba excluida, normas, jurisprudencia, estandar de revision, argumentos, contraargumentos, peticiones, supuestos, preguntas abiertas, confianza y revision humana requerida.

La salida distingue:

- `party_argument`
- `authority_argument`
- `court_finding`
- `neutral_assessment`
- `predicted_outcome`

Un argumento de parte no se convierte en `court_finding` ni en conclusion neutral por estar mejor formulado. Los roles judiciales solo pueden formular hallazgos provisionales sobre hechos confirmados y prueba utilizable.

## Reglas de uso de soporte

Hechos:

- `confirmed` y `accepted_for_drafting` pueden usarse como hechos.
- `disputed`, `uncertain` y `user_asserted` solo pueden usarse como alegaciones etiquetadas.
- `contradicted`, `not_verified` y `unavailable` generan exclusiones o preguntas abiertas.

Prueba:

- Solo `usable_as_current_support` o prueba con existencia confirmada, disponibilidad para la herramienta, contenido verificado, autenticidad suficiente, presencia confirmada en expediente, presentacion ya hecha y admisibilidad confirmada puede soportar un hallazgo actual.
- `user_described_only`, `existence_not_confirmed`, `missing` o `referenced_but_not_available` no son prueba documental utilizable.
- Prueba nueva con `proposed_new_evidence`, `possible_noven`, `likely_noven` o `noven_risk` queda como propuesta procesal.

Jurisprudencia:

- `full_text_read` y `full_text_verified` son utilizables.
- `snippet_only`, `headnote_only`, `partial_text_only`, `candidate_only` y `unverified_reference` se excluyen como soporte decisivo.

Normas:

- Una norma solo se marca utilizable si su estado temporal es `temporal_validity_confirmed`.
- Citas sin version temporal confirmada quedan en exclusiones y remediation.

Jurisdiccion:

- `country_legal_system = confirmed` solo reconoce el ordenamiento suizo.
- No confirma competencia territorial, material, funcional, autoridad emisora, autoridad de recurso, via procesal ni destino de presentacion.
- La salida incluye `jurisdiction_summary` con `confirmed_dimensions`,
  `unverified_dimensions`, `contradicted_dimensions`, `failed_dimensions` y contadores.
- Si solo consta `country: CH`, la narrativa debe decir:
  "El ordenamiento suizo está confirmado. Las otras siete dimensiones procesales no están
  verificadas." No debe decir que las ocho dimensiones estan no verificadas.

## Carga y estandar

El modelo de carga separa:

- `Behauptungslast`
- `Substanziierungslast`
- `Beweislast`
- `Mitwirkungspflicht`
- `Untersuchungsgrundsatz`
- `Offizialmaxime`
- `Verhandlungsmaxime`

Si la maxima procesal o su base juridica no estan confirmadas, la salida conserva `procedural_maxim: not_verified` y `burden_uncertain: true`.

Los organos decisores informan estandar de revision por separado. Si no consta competencia, via o base procesal, `standard_status` queda `not_verified`.

## Integracion con redaccion

`include_in_drafting_control_report` permite que el analisis alimente la capa de control. No modifica automaticamente `draft_swiss_legal_document` ni inserta en el escrito limpio:

- deliberacion simulada;
- argumentos de contraparte;
- predicciones de resultado;
- hallazgos judiciales no verificados.

## Validacion

`validate_multirole_legal_analysis` separa violaciones reales de controles correctamente
aplicados. Los controles aplicados son informativos y no degradan el estado global.

Violaciones reales, cuando aparecen por uso incorrecto de material no verificado o por
inconsistencia de salida:

- `role_leakage`
- `unsupported_argument`
- `unverified_fact_used_as_fact`
- `unusable_evidence_used`
- `partial_case_used`
- `court_finding_without_basis`
- `predicted_outcome_presented_as_fact`
- `jurisdiction_overstated`
- `unconditional_outcome_with_missing_essentials`
- `validator_code_message_mismatch`
- `narrative_state_mismatch`
- `jurisdiction_summary_mismatch`
- `outcome_condition_mismatch`
- `evidence_status_narrative_mismatch`
- `role_status_mismatch`

Warnings conservadores:

- `burden_holder_not_verified`
- `standard_of_review_not_verified`

Controles aplicados correctamente:

- `unverified_fact_correctly_limited_to_allegation`
- `unusable_evidence_correctly_excluded`
- `partial_case_correctly_excluded`
- `prosecution_role_correctly_excluded`
- `defence_role_correctly_excluded`
- `jurisdiction_correctly_left_unverified`
- `standard_of_review_correctly_left_unverified`
- `burden_holder_correctly_left_unverified`
- `predicted_outcome_correctly_conditioned`
- `court_finding_correctly_withheld`
- `independent_ground_correctly_left_unreviewed`
- `new_evidence_correctly_flagged_as_noven_risk`

Tambien mantiene controles generales:

- `jurisdiction_overstated`
- `confidence_overstated`

Severidades: `blocker`, `major`, `warning`, `informational`.

Estados globales:

- `passed`: sin blockers, majors ni warnings.
- `passed_with_warnings`: solo warnings y controles informativos.
- `failed`: al menos un `major`, sin blockers.
- `blocked`: al menos un `blocker`.

El resumen incluye `blocker`, `major`, `warning`, `informational`, `controls_applied` y
`true_violations`.

## Escenarios y deliberacion

`neutral_risk_assessment` expone `best_case`, `best_case_conditions`, `expected_case`,
`expected_case_conditions`, `worst_case`, `worst_case_conditions`, `outcome_range`,
`outcome_range_basis` y `confidence`.

Si faltan elementos esenciales como autoridad, via, plazo, resolucion completa, estandar de
revision o prueba verificada:

- `expected_case` debe ser `cannot_assess`;
- `best_case` debe ser un resultado `conditional_*`;
- `worst_case` debe expresar riesgo de inadmisibilidad o desestimacion;
- las condiciones deben dejar claro que el escenario aplica solo si los elementos faltantes se
  verifican.

`deliberation_panel` expone `preferred_outcome`, `preferred_outcome_status`,
`conditions_for_preferred_outcome`, `missing_elements_preventing_final_outcome`,
`alternative_outcomes` y `outcome_is_conditional`. En un expediente incompleto no debe proponer
un grant/dismiss categorico; el resultado preferente conservador es solicitar/verificar elementos
adicionales.
