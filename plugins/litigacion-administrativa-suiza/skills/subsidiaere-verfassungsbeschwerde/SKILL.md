---
name: subsidiaere-verfassungsbeschwerde
description: "Valora el recurso constitucional subsidiario ante el Tribunal Federal. Usar con recurso constitucional subsidiario, Verfassungsbeschwerde o no cabe el recurso ordinario."
---

# Recurso constitucional subsidiario

## Base legal (lee cada articulo con `get_article`)

- Cabe contra decisiones de ultima instancia cantonal cuando no es admisible un recurso de los Art. 72 a 89 BGG (Art. 113).
- Solo puede alegarse la violacion de derechos constitucionales (Art. 116).
- Se aplican por remision, entre otros, los Art. 90 a 94, 99, 100 y 106 Abs. 2 (Art. 117).

## Pasos

1. Descarta primero el recurso ordinario (`beschwerde-bgg`).
2. Formula cada derecho constitucional vulnerado con motivacion detallada.
3. Calcula el plazo con `BGG_BESCHWERDE` y lee la legitimacion del Art. 115.

## Reglas

- Una critica de legalidad ordinaria no basta.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Sentencia cantonal y derechos invocados.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Borrador con quejas constitucionales. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Criticar legalidad ordinaria.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
