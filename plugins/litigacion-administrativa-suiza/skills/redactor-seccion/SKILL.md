---
name: redactor-seccion
description: "Redacta una sola seccion de un escrito suizo (hechos, derecho, peticiones, pruebas, costas) con sus fuentes. Usar con redacta los hechos, redacta este fundamento o saca los Rechtsbegehren."
---

# Redactor de una seccion

## Pasos

1. Confirma seccion, tipo de escrito, idioma y asunto.
2. Hechos: un hecho por parrafo numerado, con fecha, y la prueba ofrecida detras (`cronologia-y-prueba`).
3. Derecho: norma, texto verificado con `get_article`, aplicacion al hecho concreto y conclusion.
4. Peticiones: `generate_rechtsbegehren` con los objetivos escritos con importes e intereses.
5. Comprueba la seccion con `revision-citas`.

## Reglas

- No rellenes datos que faltan: marcalos `[PENDIENTE]`.
- No cites sentencias que no se hayan leido.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Seccion.
- Tipo de escrito.
- Idioma.
- Asunto y documentos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Texto de la seccion con fuentes y pendientes. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Redactar sin prueba ofrecida.
- Mezclar hechos con derecho.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
