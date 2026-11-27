---
name: werkvertrag-maengel
description: "Analiza defectos en un contrato de obra suizo: examen, aviso de defectos y prescripcion, con la reforma en vigor desde 2026. Usar con defectos de obra, reforma, Werkvertrag o Maengelruege."
---

# Defectos en el contrato de obra

## Base legal (lee cada articulo con `get_article`)

- Tras la entrega, el comitente examina la obra en cuanto sea posible y avisa de los defectos (Art. 367 Abs. 1 OR).
- Obra inmueble: plazo de aviso de 60 dias, sin pacto mas corto; igual para ciertos defectos que causan los de la obra inmueble (Art. 367 Abs. 1bis).
- Defectos que aparecen despues: aviso inmediato (Art. 370 Abs. 3); en obra inmueble, 60 dias desde el descubrimiento (Abs. 4).
- Prescripcion: dos anos desde la recepcion, cinco en el supuesto del Abs. 1 de piezas integradas, y cinco para la obra inmueble (Art. 371 Abs. 1 y 2).

## Pasos

1. Fija fecha del contrato, recepcion, descubrimiento de cada defecto, y fecha y forma del aviso.
2. Determina si la obra es mueble o inmueble; no lo supongas.
3. Comprueba el derecho transitorio: las reglas de 60 dias son recientes (en vigor desde 2026); verifica si se aplican a ese contrato.
4. Valora los derechos del comitente (Art. 368 OR) y la prueba pericial.
5. Interrumpe la prescripcion a tiempo (`forderung-verzug-verjaehrung`).

## Reglas

- No concluyas que el aviso fue tardio ni puntual sin las fechas.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Fecha del contrato.
- Recepcion.
- Defectos.
- Avisos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Analisis de plazos y carta de aviso. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Aplicar la reforma sin revisar derecho transitorio.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
