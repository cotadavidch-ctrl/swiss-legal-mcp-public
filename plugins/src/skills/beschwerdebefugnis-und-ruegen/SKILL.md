---
name: beschwerdebefugnis-und-ruegen
description: "Comprueba legitimacion, motivos y forma de un recurso administrativo federal. Usar con puedo recurrir, legitimacion, que puedo alegar o contenido del recurso."
---

# Legitimacion, motivos y forma

## Base legal (lee cada articulo con `get_article`)

- Puede recurrir quien participo en el procedimiento previo o no pudo, esta especialmente afectado y tiene un interes digno de proteccion (Art. 48 Abs. 1 VwVG).
- Motivos: violacion de derecho federal incluido el exceso o abuso de apreciacion, hechos mal o incompletamente constatados e inadecuacion, con las limitaciones del Art. 49.
- El escrito contiene peticiones, motivacion con medios de prueba y firma, y acompana la resolucion y los documentos (Art. 52 Abs. 1; lee la subsanacion en Abs. 2 y 3).

## Pasos

1. Verifica los tres requisitos de legitimacion con hechos concretos.
2. Ordena las quejas segun el Art. 49 y comprueba si una norma especial limita la de inadecuacion.
3. Redacta peticiones y motivacion y revisa anexos.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Resolucion.
- Participacion previa.
- Interes.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Analisis de legitimacion y escrito. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Interes meramente abstracto.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
