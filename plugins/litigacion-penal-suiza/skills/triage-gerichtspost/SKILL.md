---
name: triage-gerichtspost
description: "Clasifica una comunicacion recibida de un tribunal o autoridad suiza, extrae fechas y plazos y propone la actuacion. Usar con me ha llegado una carta del tribunal, citacion, Verfuegung, Fristansetzung o Strafbefehl."
---

# Triaje de comunicaciones de tribunales y autoridades

## Paso 1. Clasificar

Identifica el tipo de documento: citacion (Vorladung), resolucion (Verfuegung), sentencia (Urteil), fijacion de plazo (Fristansetzung), orden penal (Strafbefehl), requerimiento de pago (Zahlungsbefehl), autorizacion para demandar (Klagebewilligung) u otro.

## Paso 2. Extraer

Anota, citando el pasaje literal: autoridad, numero de procedimiento (anonimizado al usar herramientas externas), fecha del documento, **fecha y forma de notificacion**, plazo que se indica y la instruccion de recursos si la hay.

## Paso 3. Calcular

- Si es un acto recurrible: `plazos-y-via` con `compute_legal_deadline`.
- Si es un plazo fijado por el propio tribunal ("dentro de 10 dias"), distingue plazo judicial del plazo legal: el judicial puede prorrogarse si se pide antes de que venza; el legal no (Art. 144 ZPO en materia civil).
- Si falta la fecha de notificacion, dilo y pide el sobre o el acuse.

## Paso 4. Proponer la actuacion

Una lista corta con: que hay que hacer, fecha limite, documento que hay que preparar y la skill que corresponde. Skills de recurso o actuacion de este plugin: `strafverfahren-stpo`, `strafanzeige-strafantrag`, `beschwerde-bgg`, `erste-einvernahme`, `verteidigung`, `untersuchungshaft`, `zwangsmassnahmen-siegelung`, `akteneinsicht-gehoer-straf`, `beweisverwertung`, `beweiswuerdigung-unschuld`, `privatklaegerschaft-zivilklage`, `einstellung-beschwerde`, `strafbefehlsverfahren`, `abgekuerztes-verfahren`, `hauptverhandlung-plaedoyer`, `berufung-straf`, `revision-straf`, `entschaedigung-genugtuung`, `verjaehrung-und-strafmass`, `opferhilfe`, `festnahme`, `ersatzmassnahmen`, `zeugnisverweigerung`, `opferrechte`, `beschwerde-stpo`, `unternehmensstrafbarkeit`, `vermoegensdelikte`, `fahrlaessigkeitsdelikte`, `ehre-und-drohung`, `haeusliche-gewalt`, `jugendstrafverfahren`.

## Salida

Tabla: documento | tipo | notificacion | plazo | actuacion | skill. Marca en rojo cualquier plazo con menos de 5 dias y cualquier dato que falte.

## Reglas

- No presentes nada ni contactes con el tribunal en nombre del usuario.
- La fecha de la instruccion de recursos no sustituye al calculo legal: avisa si difieren.
- Un borrador de respuesta es un borrador para revision de una persona habilitada.

## Datos que hay que pedir

- Carta completa.
- Sobre y fecha de recepcion.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Tabla tipo, plazo, actuacion y skill. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Fiarse solo de la fecha de la carta.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
