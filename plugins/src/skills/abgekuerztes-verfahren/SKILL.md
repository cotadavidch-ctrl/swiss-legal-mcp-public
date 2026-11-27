---
name: abgekuerztes-verfahren
description: "Valora el procedimiento abreviado penal. Usar con acuerdo con la fiscalia, abgekuerztes Verfahren o conformidad."
---

# Procedimiento abreviado

## Base legal (lee cada articulo con `get_article`)

- El investigado puede pedirlo hasta la acusacion si reconoce los hechos esenciales y las pretensiones civiles al menos en principio (Art. 358 Abs. 1 StPO; lee las exclusiones y los articulos siguientes).

## Pasos

1. Compara con el procedimiento ordinario: hechos admitidos, pena propuesta, civiles y recursos limitados.
2. Verifica requisitos en el texto.
3. Deja la decision al investigado con su defensor.

## Reglas

- No presentes el acuerdo como conveniente sin analisis; nunca sugieras admitir hechos falsos.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Propuesta.
- Hechos.
- Civiles.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Comparacion para decidir. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Admitir hechos falsos.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
