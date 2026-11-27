---
name: verjaehrung-und-strafmass
description: "Controla la prescripcion penal y la suspension de la pena. Usar con prescrito, Verjaehrung, pena suspendida o bedingter Vollzug."
---

# Prescripcion y suspension de la pena

## Base legal (lee cada articulo con `get_article`)

- La accion penal prescribe segun la pena maxima: 30, 15 o 10 anos y los demas plazos del Art. 97 StGB (lee la lista y las reglas especiales).
- El tribunal suspende por regla la pena pecuniaria o privativa de hasta dos anos si la incondicional no es necesaria (Art. 42 Abs. 1; lee las condiciones).

## Pasos

1. Fija fecha de los hechos y tipo penal con su pena maxima.
2. Calcula a mano, marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`.
3. Reune datos de pronostico para la suspension.

## Reglas

- No afirmes prescripcion sin leer el tipo y las interrupciones.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Fecha de hechos.
- Tipo.
- Pronostico.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Calculo marcado y alegacion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Olvidar normas especiales.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
