---
name: beweiswuerdigung-unschuld
description: "Analiza la valoracion de la prueba y la presuncion de inocencia. Usar con presuncion de inocencia, in dubio pro reo o la prueba no basta."
---

# Inocencia y valoracion de la prueba

## Base legal (lee cada articulo con `get_article`)

- Toda persona se presume inocente hasta sentencia firme (Art. 10 Abs. 1 StPO); el tribunal valora libremente la prueba (Abs. 2) y ante dudas insuperables parte de lo mas favorable al acusado (Abs. 3; leelo).

## Pasos

1. Cuadro por elemento del delito: prueba de cargo, de descargo y fuerza.
2. Senala explicaciones alternativas apoyadas en datos.
3. Redacta la critica de la valoracion para el recurso.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Pruebas de cargo y descargo.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Cuadro por elemento. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Versiones alternativas sin base.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
