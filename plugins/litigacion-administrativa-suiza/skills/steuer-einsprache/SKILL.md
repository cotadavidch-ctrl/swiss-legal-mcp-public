---
name: steuer-einsprache
description: "Impugna una tasacion del impuesto federal directo. Usar con impuestos, Veranlagung, Steuer Einsprache o Hacienda suiza."
---

# Reclamacion fiscal (DBG)

## Base legal (lee cada articulo con `get_article`)

- Oposicion contra la tasacion, recurso ante la comision cantonal y despues Tribunal Federal: lee los Art. 132, 133, 140 y 146 DBG con `get_article`.
- Los impuestos cantonales siguen la ley cantonal.

## Pasos

1. Fija la fecha de notificacion.
2. Usa `analyze_procedural_strategy` (materia `tax`) para las reglas.
3. Calcula el plazo y marcalo `[CALCULO MANUAL, SIN HERRAMIENTA]`; la herramienta de plazos no cubre el DBG.
4. Motiva y ofrece pruebas; en tasacion de oficio lee las exigencias reforzadas.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Tasacion.
- Notificacion.
- Justificantes.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Reclamacion motivada. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- En tasacion de oficio no motivar.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
