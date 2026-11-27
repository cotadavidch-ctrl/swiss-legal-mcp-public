---
name: zwangsmassnahmen-siegelung
description: "Reacciona ante registros e incautaciones y pide el sellado de documentos. Usar con registro, allanamiento, incautacion, Hausdurchsuchung o Siegelung."
---

# Registros, incautacion y sellado

## Base legal (lee cada articulo con `get_article`)

- Las medidas coercitivas requieren base legal, sospecha suficiente, que no baste una medida mas leve y proporcionalidad (Art. 197 Abs. 1 StPO).
- Registros por orden escrita, oral solo en urgencia con confirmacion (Art. 241). Incautacion en los casos del Art. 263.
- Sellado: quien tiene los registros u objetos y alega que no pueden incautarse debe pedirlo en TRES dias desde la retencion; mientras tanto la autoridad no puede verlos (Art. 248 Abs. 1).

## Pasos

1. Lo primero: fecha de la retencion y si ya se pidio el sellado.
2. Redacta la peticion de sellado con la causa (Art. 264, leelo).
3. Revisa la orden y el acta.
4. Haz inventario de lo retenido.

## Reglas

- El plazo de tres dias es muy corto: avisalo en la primera linea.
- No aconsejes borrar ni ocultar nada.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Fecha de retencion.
- Objetos.
- Causa de secreto.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Peticion de sellado e inventario. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Pasar los tres dias.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
