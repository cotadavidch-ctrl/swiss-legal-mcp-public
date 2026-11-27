---
name: rechtsverweigerung
description: "Reacciona cuando una autoridad o aseguradora no resuelve. Usar con no contestan, retraso, Rechtsverweigerung o Rechtsverzoegerung."
---

# Denegacion y retraso de justicia

## Base legal (lee cada articulo con `get_article`)

- Procedimiento federal: recurso por negar o retrasar una resolucion impugnable, en cualquier momento (Art. 46a y 50 Abs. 2 VwVG).
- Seguros sociales: cabe recurso si la aseguradora no dicta la resolucion pedida (Art. 56 Abs. 2 ATSG).

## Pasos

1. Documenta peticion, fechas y recordatorios.
2. Envia antes un requerimiento con plazo razonable.
3. Redacta el recurso pidiendo que se resuelva.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Peticiones y fechas.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Requerimiento y recurso. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Recurrir sin requerir antes.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
