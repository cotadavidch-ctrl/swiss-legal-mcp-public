---
name: kosten-upr-verwaltung
description: "Estima costas, indemnizacion y asistencia gratuita en un recurso administrativo federal. Usar con costas del recurso administrativo, gastos o asistencia gratuita."
---

# Costas en el recurso administrativo

## Base legal (lee cada articulo con `get_article`)

- Las costas se imponen en regla a la parte vencida y se reducen si pierde en parte (Art. 63 Abs. 1 VwVG).
- Puede concederse una indemnizacion por gastos necesarios a quien gane total o parcialmente (Art. 64 Abs. 1).
- Tras presentar el recurso, quien no tenga medios y no pida algo desesperado puede ser eximido de costas (Art. 65 Abs. 1; lee la designacion de abogado).

## Pasos

1. Pide justificantes de ingresos, gastos y patrimonio.
2. Redacta la solicitud de gratuidad y de indemnizacion con sus partidas.
3. No des importes sin leer el reglamento de tasas aplicable.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Ingresos.
- Gastos.
- Importe.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud y estimacion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- No justificar necesidad.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
