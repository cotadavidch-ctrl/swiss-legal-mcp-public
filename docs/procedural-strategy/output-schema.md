# Output schema

La salida es estructurada y separa datos, inferencias y advertencias:

- `caseSummary`: caracterizacion, postura, hechos aceptados/disputados y faltantes.
- `jurisdictionAndCompetence`: jurisdiccion probable, autoridad/ruta, competencia territorial y material, fuentes y confianza.
- `admissibility`: legitimacion, acto impugnable, agotamiento, forma, idioma, representacion y riesgos.
- `deadlines`: plazos confirmados, inciertos o no calculables.
- `applicableLaw`: citas detectadas en materiales del usuario, sin afirmar aplicacion juridica.
- `burdenOfProof`: cuestiones probatorias que requieren base legal concreta.
- `evidenceAssessment`: prueba por hecho, fuerza, autenticidad, admisibilidad y brechas.
- `legalAidClarification`: analisis conservador de asistencia juridica gratuita cuando los hechos lo sugieren; separa Art. 29 Abs. 3 BV, Mitwirkungspflicht, Art. 56 ZPO, derecho procesal cantonal e inferencia estrategica. No concluye "sin abogado = unbeholfen" ni "primera deficiencia = Nachfrist automatica".
- `caseLawAnalysis`: casos favorables, desfavorables, mixtos o distinguibles dentro de la muestra recuperada. Cuando el usuario aporta referencias jurisprudenciales, `structuredComparability` verifica fuente oficial/agregador y evalua dimensiones obligatorias: misma materia, procedimiento, hechos determinantes, problema probatorio, estado de documentos/prueba, cuestion juridica, ratio decidendi, resultado relevante, utilidad estrategica, limites y diferencias.
- `proceduralOptions`: opciones trazables con precondiciones, ventajas, riesgos y viabilidad.
- `recommendedStrategy`: secuencia procesal conservadora.
- `scenarioAnalysis`: mejor caso, caso probable y caso adverso.
- `risks`: riesgo, probabilidad, impacto y mitigacion.
- `missingInformation`: informacion que impide conclusiones mas firmes.
- `warnings`: limites y advertencias.
- `sources`: fuentes documentales cargadas.
- `trace`: cronologia, issues, documentos cargados y guardrails.
- `confidence`: confianza por dimension, no una puntuacion unica de victoria.

## Comparabilidad jurisprudencial

Las clasificaciones estructuradas posibles son:

- `comparable_direct`: solo si coinciden sustancialmente hechos determinantes y cuestion juridica central.
- `limited_analogy`: hay utilidad limitada y trazable, pero difieren materia, procedimiento, ratio o resultado.
- `general_analogy`: utilidad general, sin precedente directo.
- `distinguishable`: diferencias juridicas o facticas dominantes.
- `irrelevant`: sin utilidad procesal identificable.
- `unverified_reference`: referencia no verificada.

Coincidencias lexicas como `Kontoauszuege`, `rechtliches Gehoer` o `antizipierte Beweiswuerdigung` nunca bastan para `comparable_direct`. La salida separa hechos acreditados, alegaciones de parte, razonamiento de instancia inferior, razonamiento del tribunal decisor, ratio decidendi, resultado, pasajes de soporte y si se leyo texto completo o solo resumen/fragmento.
