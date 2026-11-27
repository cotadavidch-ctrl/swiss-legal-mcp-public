---
name: wiedererwaegung-revision
description: "Valora reconsideracion y revision de resoluciones administrativas federales. Usar con reconsideracion, Wiedererwaegung, revision o pruebas nuevas despues de decidir."
---

# Reconsideracion y revision (VwVG)

## Base legal (lee cada articulo con `get_article`)

- La autoridad inferior puede reconsiderar su resolucion hasta presentar su respuesta al recurso (Art. 58 VwVG).
- La instancia de recurso revisa su decision en los casos del Art. 66, como hechos o pruebas nuevos relevantes.
- Plazo de 90 dias desde el descubrimiento del motivo y, como maximo, 10 anos desde la notificacion de la decision del recurso, con la excepcion del Abs. 1bis (Art. 67).

## Pasos

1. Distingue recurso abierto, reconsideracion y revision.
2. Fija la fecha de descubrimiento y su prueba.
3. Calcula a mano los plazos, marcados `[CALCULO MANUAL, SIN HERRAMIENTA]`.

## Reglas

- Pedir reconsideracion no suspende por si solo el plazo de recurso: presenta el recurso en plazo.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Decision.
- Hecho nuevo y fecha.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud con plazos. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Pedir reconsideracion y perder el recurso.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
