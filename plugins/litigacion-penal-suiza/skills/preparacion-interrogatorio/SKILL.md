---
name: preparacion-interrogatorio
description: "Prepara el interrogatorio de partes, testigos y peritos ante un tribunal suizo, con los documentos que los contradicen. Usar con preparar vista, interrogatorio, testigos o Beweisabnahme."
---

# Preparacion de interrogatorios

## Base legal (lee cada articulo con `get_article`)

- Se prueban los hechos juridicamente relevantes y discutidos (Art. 150 Abs. 1 ZPO) y cada parte tiene derecho a que se practique la prueba idonea ofrecida en forma y plazo (Art. 152 Abs. 1 ZPO).
- Partes y terceros deben colaborar en la prueba, declarar con verdad y entregar documentos, con las excepciones de la ley (Art. 160 ZPO).
- En penal y en procedimiento administrativo rigen otras normas: leelas antes con `get_article`.

## Pasos

1. Para cada hecho discutido, anota quien puede declarar y que documento lo apoya o contradice.
2. Prepara preguntas cortas, una por hecho, abiertas con testigos propios y cerradas para confrontar contradicciones.
3. Anticipa las preguntas de la otra parte y los puntos debiles propios.
4. Indica los derechos de negativa a declarar que haya que comprobar.

## Reglas

- No prepares ni sugieras declaraciones falsas ni dirijas el testimonio de terceros.
- Ten en cuenta que en muchos procedimientos suizos pregunta el tribunal: las listas son propuestas.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Hechos discutidos.
- Personas.
- Documentos.
- Fecha de la vista.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Guion por persona con documentos de apoyo. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Preguntar sin saber la respuesta posible.
- Sugerir testimonios.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
