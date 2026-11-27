---
name: arbeitsrecht-kuendigung
description: "Maneja un despido controvertido en derecho laboral suizo: oposicion escrita, indemnizacion por despido abusivo, conciliacion y demanda. Usar con Kuendigung, despido, Schlichtung o Arbeitsgericht."
---

# Despido y reclamaciones laborales (OR y ZPO)

## Secuencia y plazos (verifica con `get_article`)

1. **Oposicion escrita al despido**: quien quiera reclamar indemnizacion por despido abusivo debe oponerse por escrito ante quien despide, como muy tarde hasta el final del plazo de preaviso (Art. 336b Abs. 1 OR). Es un plazo que `compute_legal_deadline` no cubre: calculalo a mano y marcalo `[CALCULO MANUAL, SIN HERRAMIENTA]`.
2. **Accion**: si no hay acuerdo, la reclamacion de indemnizacion caduca si no se plantea en 180 dias desde el fin de la relacion laboral (Art. 336b Abs. 2 OR). Mide a partir de la fecha real de fin del contrato.
3. **Cuantia de la indemnizacion por despido abusivo**: la fija el juez segun las circunstancias y no puede superar seis meses de salario del trabajador (Art. 336a Abs. 2 OR; el Abs. 3 trata el supuesto del Art. 336 Abs. 2 lit. c). Lee el articulo antes de estimar la pretension.
4. **Conciliacion previa**: toda demanda civil va precedida de un intento de conciliacion (Art. 197 ZPO). Despues se obtiene la autorizacion para demandar y hay un plazo para presentar la demanda (Art. 209 ZPO; verifica el plazo en el articulo).
5. **Procedimiento simplificado**: se aplica a asuntos patrimoniales hasta CHF 30 000 y a ciertos casos sin importar la cuantia (Art. 243 ZPO).

## Que hay que reunir

- Contrato, comunicaciones del despido con su fecha y modo de entrega, motivos alegados, ultimas nominas.
- Cronologia y cuadro de prueba (`cronologia-y-prueba`) con el motivo real, el motivo alegado y la prueba de cada uno.

## Pasos

1. Abre el asunto (`alta-asunto`, materia `employment`).
2. Fija las tres fechas clave: despido, fin del preaviso y fin del contrato.
3. Valora la causa de abusividad (Art. 336 OR) leyendo el articulo con `get_article`; no la des por probada.
4. Estrategia con `analyze_procedural_strategy` y, si hay riesgo, consejo con `prepare_legal_council`.
5. Si se llega a recurso, el Tribunal Federal exige CHF 15 000 en materia laboral (`beschwerde-bgg`).

## Reglas

- Si falta la fecha del despido o de su recepcion, dilo: sin ella no hay plazos.
- No afirmes que un despido es abusivo; indica los elementos a favor y en contra.

## Datos que hay que pedir

- Contrato.
- Carta de despido.
- Recepcion.
- Motivo.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Oposicion escrita y calendario. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Oponerse tarde.
- Confundir fin de preaviso y de contrato.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
