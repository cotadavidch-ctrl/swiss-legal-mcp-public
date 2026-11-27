---
name: ueberstunden
description: "Calcula y reclama horas extra en derecho laboral suizo. Usar con horas extra, Ueberstunden o compensacion con tiempo libre."
---

# Horas extraordinarias

## Base legal (lee cada articulo con `get_article`)

- El trabajador debe hacer horas extra en lo que pueda y sea exigible (Art. 321c Abs. 1 OR); pueden compensarse con tiempo libre de igual duracion si el trabajador consiente (Abs. 2).
- Si no se compensan y nada se pacto por escrito ni en convenio, la ley regula su pago con suplemento (Abs. 3; leelo).

## Pasos

1. Reconstruye horas por dia con registros y testigos.
2. Distingue horas extra y horas que excedan el maximo de la ley de trabajo (verifica esa ley).
3. Revisa pactos escritos de exclusion.
4. Cuantifica y reclama.

## Reglas

- Sin registro, indica el riesgo de prueba.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Registro de horas.
- Pactos.
- Convenio.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Calculo diario. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- No distinguir horas extra y exceso legal.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
