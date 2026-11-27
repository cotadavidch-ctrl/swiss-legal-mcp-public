---
name: vermoegensdelikte
description: "Analiza denuncias o defensas por estafa, apropiacion indebida y hurto. Usar con estafa, Betrug, Veruntreuung, hurto o me han enganado con dinero."
---

# Delitos patrimoniales

## Base legal (lee cada articulo con `get_article`)

- Estafa: engano astuto con animo de lucro que lleva a un acto perjudicial (Art. 146 Abs. 1 StGB).
- Apropiacion indebida de cosas o valores confiados (Art. 138). Hurto y sus agravantes (Art. 139). Lee cada texto y si se persigue a querella entre allegados.

## Pasos

1. Descompone el tipo en elementos y asigna prueba a cada uno.
2. Distingue el incumplimiento civil de la estafa: la astucia debe estar probada.
3. Denuncia con `strafanzeige-strafantrag` o defensa con `beweiswuerdigung-unschuld`.

## Reglas

- No califiques como delito un impago sin el engano.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Engano o confianza.
- Dano.
- Pruebas.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Analisis por elementos. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Llamar estafa a un impago.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
