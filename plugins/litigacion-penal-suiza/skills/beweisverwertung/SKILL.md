---
name: beweisverwertung
description: "Valora si una prueba penal es utilizable. Usar con prueba ilicita, Beweisverwertungsverbot, grabacion o confesion bajo presion."
---

# Pruebas prohibidas

## Base legal (lee cada articulo con `get_article`)

- Prohibidos los medios coactivos, violencia, amenazas, promesas, enganos y los que afecten a la voluntad (Art. 140 Abs. 1 StPO).
- Las pruebas obtenidas contra el Art. 140 o declaradas inutilizables por la ley no se usan en ningun caso; para otras ilicitudes rigen las reglas del Art. 141 (leelo completo, incluidas las derivadas).

## Pasos

1. Describe como se obtuvo cada prueba, con fuente.
2. Clasifica segun el Art. 141 y lee las excepciones.
3. Pide su retirada del expediente y valora las pruebas derivadas.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Origen de cada prueba.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Tabla y peticion de exclusion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- No alegar las derivadas.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
