---
name: massenentlassung
description: "Revisa un despido colectivo. Usar con despido colectivo, Massenentlassung, ERE o plan social."
---

# Despido colectivo

## Base legal (lee cada articulo con `get_article`)

- Definicion, consulta, notificacion a la oficina cantonal y plan social: lee los Art. 335d y siguientes OR con `get_article` antes de afirmar umbrales o plazos.

## Pasos

1. Cuenta despidos, plantilla y periodo.
2. Comprueba consulta a la representacion de los trabajadores y comunicaciones.
3. Revisa consecuencias de las omisiones leyendo los articulos.
4. Prepara reclamaciones individuales (`arbeitsrecht-kuendigung`).

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Plantilla.
- Numero y fechas de despidos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Control de umbrales y tramites. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Dar umbrales de memoria.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
