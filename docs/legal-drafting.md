# Swiss legal drafting

Estado: implementado como capa deterministica local de redaccion, revision y refutacion juridica suiza.

## Herramientas MCP

- `validate_procedural_requirements`: determina perfil procesal y verifica decision/acto, autoridad, via, plazo, legitimacion, idioma, firma, presentacion, copias, anexos y Rechtsmittelbelehrung.
- `generate_rechtsbegehren`: genera Rechtsbegehren/Antraege numerados y separados en Hauptantrag, Eventual-/Subeventualantrag y Verfahrensantrag cuando los objetivos lo justifican.
- `build_evidence_index`: crea indice de pruebas/anexos con autenticidad, fuente, admisibilidad, riesgo de Noven y vinculo con hechos/pretensiones.
- `extract_challenged_passages`: valida pasajes literales impugnados con autor, funcion, contexto, pagina/considerando e importancia.
- `build_rebuttal_matrix`: crea matriz quote-and-rebuttal con premisa factica, premisa juridica, tipo de error, prueba, regla aplicable, jurisprudencia, contraanalisis y consecuencia solicitada.
- `draft_swiss_legal_document`: produce dos capas separadas: `cleanDocument` y `controlReport`.
- `review_swiss_legal_document`: revisa un borrador existente y propone correcciones estructurales.
- `validate_swiss_legal_draft`: ejecuta `legal_drafting_check` y bloquea `readyForFiling` si hay `failed` o datos procesales esenciales no verificados.

Estas herramientas no usan IA ni proveedores nuevos. Reutilizan estructuras de `packages/citations` y las guardas jurisprudenciales de `analyze_procedural_strategy`; si no hay fuente oficial o dato procesal verificado devuelven warnings y placeholders.

## Politica de lectura completa de sentencias

La redaccion juridica no puede usar una sentencia como autoridad decisiva si la capa de guardrails no la marca como texto completo leido. Una referencia parcial puede quedar en el `controlReport.sources` como `candidate_only`, pero no se incorpora silenciosamente al `cleanDocument`.

Estados relevantes:

- `full_text_verified_official`: texto completo leido y verificado contra fuente oficial.
- `full_text_read_unofficial`: texto completo leido desde agregador, no verificado oficialmente.
- `snippet_only`, `headnote_only`, `partial_text_only`, `inaccessible_full_text`, `extraction_incomplete`: estados no aptos para precedente.

Warnings como `full_text_not_read`, `full_text_not_verified`, `extraction_incomplete`, `missing_dispositif`, `missing_factual_section`, `missing_reasoning_section`, `missing_independent_ground_review`, `possible_context_loss` y `candidate_only` bloquean el uso decisivo. La matriz de refutacion conserva trazabilidad, pero `applicable_rule` vuelve a `[RECHTSMITTEL ZU PRÜFEN]` si la unica base disponible es jurisprudencia parcial.

## Relacion con analisis multirrol

`analyze_swiss_legal_positions` puede preparar posiciones separadas de parte, autoridad, contraparte, organos decisores, evaluacion neutral y deliberacion estructurada. Esa salida solo alimenta el informe de control cuando `include_in_drafting_control_report` se solicita expresamente. El escrito limpio no recibe automaticamente deliberacion simulada, argumentos de contraparte, predicciones de resultado ni hallazgos judiciales no verificados.

## Estados de redaccion y salida segura

Los marcadores como `[NICHT BESTÄTIGT]`, `[BITTE ERGÄNZEN]`, `[FRIST ZU PRÜFEN]`, `[NICHT VERIFIZIERT]` y equivalentes no cuentan como datos verificados. La validacion central los degrada a `not_verified`; si afectan a autoridad competente, remedio, plazo, notificacion, legitimacion, firma o requisitos de presentacion, `readyForFiling` permanece `false`.

La jurisdiccion ya no se valida con un campo generico. `country_legal_system = confirmed` solo significa que se reconoce el ordenamiento suizo. La competencia concreta se descompone en `territorial_jurisdiction`, `subject_matter_jurisdiction`, `functional_jurisdiction`, `issuing_authority`, `appellate_authority`, `procedural_remedy` y `venue_or_filing_destination`. El campo legacy `jurisdiction` se conserva como derivado/deprecated para clientes antiguos, pero solo puede aparecer como `passed` si todas las dimensiones esenciales estan confirmadas; conocer solo `CH` no basta.

Los hechos conservan estado durante todo el flujo. Solo `confirmed` y `accepted_for_drafting` pueden redactarse como afirmaciones limpias. `uncertain`, `inferred`, `user_asserted`, `source_asserted` y `not_verified` se formulan con cautela y marcador visible. `contradicted` exige indicar que existe una contradiccion pendiente.

Las citas distinguen `quote_matches_user_input`, `quote_extracted_from_source`, `quote_verified_against_source`, `context_checked`, `source_location_verified` y `source_document_full_text_read`. Una frase aportada por el usuario sin cotejo documental no puede convertirse en `quote_verified_against_source`; el escrito limpio usa parafrasis o `[WORTLAUT NICHT VERIFIZIERT]`.

Las pruebas usan estados procedimentales: `in_record_confirmed`, `available_not_yet_filed`, `proposed_new_evidence`, `missing`, `existence_not_confirmed`, `inadmissible`, `noven_risk`, `authenticity_unconfirmed` y `reference_only`. Ademas, el informe conserva dimensiones separadas: `assertion_source`, `existence_status`, `availability_status`, `content_verification_status`, `authenticity_status`, `in_record_status`, `filing_status`, `admissibility_status`, `noven_status`, `usable_as_current_support` y `reason`.

Una afirmacion del usuario no equivale a documento verificado. Si el documento no esta disponible para la herramienta, la prueba queda como `availability_status = referenced_but_not_available`, `content_verification_status = user_described_only`, `usable_as_current_support = false` y `reason = document_not_available_for_verification`. `claimed_to_be_in_record` tampoco equivale a `in_record_confirmed`. Una prueba nueva conserva `filing_status = proposed_new_evidence` y `noven_status = possible_noven`.

Solo una prueba con existencia confirmada por fuente, documento disponible para la herramienta, contenido verificado contra documento, autenticidad suficiente, presencia en expediente confirmada, estado de presentacion adecuado y admisibilidad confirmada puede usarse como soporte actual. La salida distingue `aktenkundig`, `neu einzureichen`, `neu einzureichen / Noven-Risiko` y `derzeit nicht verfügbar`.

Cada `Rechtsbegehren` conserva `original_request`, `normalized_request`, `classification`, `status`, `reason`, estados de base legal, competencia y encaje procesal, y `retained_in_final_draft`. La herramienta no descarta peticiones silenciosamente y separa Hauptantrag, Eventualantrag y Verfahrensantrag cuando cumplen funciones procesales distintas.

Sin resolucion completa, una posible motivacion autonoma queda como `independent_grounds_not_reviewed` o `possible_independent_ground`; no se declara `independent_ground_not_challenged` hasta que el fundamento autonomo este confirmado y pueda comprobarse si fue atacado.

La fecha del sistema no se usa como fecha de firma o presentacion. Si no hay fecha confirmada, el documento muestra `[DATUM DER UNTERZEICHNUNG]`. Las costas no se anaden automaticamente; sin procedimiento, contraparte, competencia y base legal verificados se usa `costs_request_not_verified` o `[KOSTENANTRAG ZU PRÜFEN]`.

## Perfiles documentales

La determinacion no intercambia automaticamente `Einsprache`, `Beschwerde` y `Rekurs`. El llamador puede fijar `procedure.requestedDocumentType`; si falta, se infiere de forma conservadora desde la via, el acto y los objetivos. Si no puede confirmarse, aparecen warnings como `procedural_remedy_not_confirmed`, `deadline_not_confirmed`, `competent_authority_not_confirmed`, `jurisdiction_not_confirmed`, `procedural_language_not_confirmed` y `standing_not_confirmed`.

Soporta perfiles para `Einsprache`, `Beschwerde`, `Rekurs`, `Wiedererwägungsgesuch`, `Revisionsgesuch`, `Stellungnahme`, `Replik`, `Duplik`, `Gesuch`, `Ergänzung`, `Akteneinsichtsgesuch`, `Fristerstreckungsgesuch`, `Rechtsvorschlag`, `Zahlungsaufschubsgesuch`, vorsorgliche Massnahmen, Gesuch um aufschiebende Wirkung, Gesuch um unentgeltliche Rechtspflege, aussergerichtliche Aufforderung, Vergleichsvorschlag, Kündigung y rechtliches Memorandum.

## Lengua y tono

Perfiles previstos: `de-CH-legal`, `fr-CH-legal`, `it-CH-legal`. La prioridad inicial es `de-CH-legal`: el borrador elimina `ß`, usa `ss`, mantiene terminologia suiza como `Rechtsbegehren`, `Beilagenverzeichnis`, `Vorinstanz`, `Kosten- und Entschädigungsfolgen`, y evita lenguaje acusatorio.

Perfiles de tono: `neutral_formal`, `firm_respectful`, `conciliatory`, `urgent_procedural`, `defensive`, `settlement_oriented`, `judicial_technical`. Por defecto se usa `firm_respectful`, salvo documentos judiciales complejos, propuestas de acuerdo o solicitudes simples donde procede otro tono.

## Subsumtion

Cada argumento se representa internamente mediante:

- `legal_rule`
- `legal_test`
- `relevant_facts`
- `application`
- `counterargument`
- `conclusion`
- `requested_consequence`

La capa actual genera una subsuncion conservadora y verificable. No acumula citas como si eso sustituyera la aplicacion de hechos al estandar juridico.

## Quote-and-rebuttal

Los pasajes impugnados conservan texto exacto, pagina, parrafo, apartado/considerando, idioma, autor, contexto anterior/posterior, funcion, importancia y si son motivacion autonoma. Una frase no verificada se marca `quote_not_verified`.

La matriz de refutacion distingue, entre otros, `aktenwidrige Feststellung`, `unvollständige Sachverhaltsfeststellung`, `widersprüchliche Begründung`, `unzureichende Begründung`, `unzutreffende rechtliche Würdigung`, `überspannte Mitwirkungspflicht`, `unzulässige doppelte Berücksichtigung` y `Verletzung der Begründungspflicht`. No eleva automaticamente la intensidad a `willkürlich`; la validacion exige estandar juridico y prueba documental concreta.

## Transferencias internas

Para cuentas propias se comprueba mismo titular, cantidad trazable, diferencia explicable por comision, fecha, cuenta origen/intermedia/destino cuando constan, saldo final cero, ausencia de incremento patrimonial, posible doble computo, opacidad documental, deber de colaboracion, deber de aclaracion posible y riesgo de Noven.

Formula base:

> Eine Übertragung zwischen Konten desselben Inhabers begründet für sich allein keinen zusätzlichen Vermögenszufluss; erforderlich wäre eine selbständige wirtschaftliche Zunahme oder eine nachvollziehbare Begründung abweichender Verfügbarkeit.

No afirma que una transferencia interna sea siempre irrelevante.

## Legal drafting check

`validate_swiss_legal_draft` devuelve estados `passed`, `warning`, `failed`, `not_verified` o `not_applicable` para:

`country_legal_system`, `territorial_jurisdiction`, `subject_matter_jurisdiction`, `functional_jurisdiction`, `issuing_authority`, `appellate_authority`, `venue_or_filing_destination`, `jurisdiction` deprecated, `competent_authority`, `procedural_remedy`, `deadline`, `standing`, `procedural_language`, `requests`, `facts`, `chronology`, `evidence`, `burden_of_proof`, `legal_basis`, `temporal_applicability`, `case_law`, `citations`, `challenged_passages`, `independent_grounds`, `rebuttals`, `attachments`, `tone`, `swiss_orthography`, `internal_consistency`, `unsupported_claims`, `invented_data`, `human_review_required`.

`readyForFiling` solo puede ser `true` si no hay `failed` y si los datos procesales esenciales no quedan `not_verified`.

## Limitaciones

La capa no sustituye revision juridica profesional. No calcula plazos no modelados, no inventa autoridad competente, no crea citas o paginas, no convierte fuentes no oficiales en oficiales y mantiene `human_legal_review_required` en el informe de control.
