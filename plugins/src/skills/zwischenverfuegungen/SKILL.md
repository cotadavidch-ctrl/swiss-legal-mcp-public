---
name: zwischenverfuegungen
description: "Decide si una resolucion incidental administrativa puede o debe recurrirse ya. Usar con resolucion incidental, Zwischenverfuegung, competencia o recusacion."
---

# Resoluciones incidentales

## Base legal (lee cada articulo con `get_article`)

- Contra las incidentales notificadas por separado sobre competencia y recusacion cabe recurso y despues ya no (Art. 45 VwVG).
- Las demas solo si causan perjuicio irreparable o si estimar el recurso lleva a una decision final que ahorre un procedimiento costoso (Art. 46 Abs. 1).

## Pasos

1. Clasifica la resolucion.
2. Si es de competencia o recusacion, recurre ya y calcula el plazo.
3. En los demas casos justifica el requisito del Art. 46.

## Reglas

- Perder el plazo de una incidental del Art. 45 la hace inatacable: avisalo.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Resolucion incidental y fecha.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Decision recurrir o no. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Dejar firme una de competencia.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
