---
name: entschaedigung-genugtuung
description: "Reclama gastos de defensa e indemnizacion tras absolucion, archivo o medidas ilicitas. Usar con absuelto, indemnizacion, Genugtuung o gastos de abogado."
---

# Indemnizacion del investigado

## Base legal (lee cada articulo con `get_article`)

- Con absolucion o archivo, el investigado tiene derecho a los gastos de defensa y demas partidas del Art. 429 StPO (lee la lista).
- Medidas coercitivas ilicitas o detencion excesiva dan derecho a indemnizacion y reparacion (Art. 431).

## Pasos

1. Reune facturas, perdida de ingresos y dias privados de libertad.
2. Presenta la solicitud antes de la decision final.
3. Lee las causas de reduccion (Art. 430).

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Facturas.
- Dias detenido.
- Perdidas.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud detallada. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Presentarla tarde.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
