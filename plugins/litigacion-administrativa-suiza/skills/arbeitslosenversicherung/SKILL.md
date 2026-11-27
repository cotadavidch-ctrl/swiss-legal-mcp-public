---
name: arbeitslosenversicherung
description: "Defiende una suspension de prestaciones del seguro de desempleo suizo. Usar con desempleo, RAV, dias de suspension o Einstelltage."
---

# Seguro de desempleo

## Base legal (lee cada articulo con `get_article`)

- Los motivos y la duracion de la suspension estan en el Art. 30 AVIG; lee el texto y la ordenanza con `get_article` antes de afirmar nada.
- La via de recurso es la del ATSG (`sozialversicherung-atsg`).

## Pasos

1. Identifica el reproche, los dias suspendidos y la fecha de notificacion.
2. Reune justificantes de busquedas y comunicaciones.
3. Valora motivo, culpa y proporcionalidad y calcula la oposicion con `ATSG_EINSPRACHE`.

## Reglas

- La oposicion corre 30 dias: avisa primero.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Decision.
- Dias suspendidos.
- Busquedas.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Oposicion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- No aportar justificantes.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
