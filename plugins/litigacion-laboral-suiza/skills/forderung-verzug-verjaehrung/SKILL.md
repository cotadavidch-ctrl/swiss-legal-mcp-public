---
name: forderung-verzug-verjaehrung
description: "Reclama una deuda en derecho suizo: requerimiento, mora, plazo suplementario, prescripcion y su interrupcion. Usar con reclamar deuda, Mahnung, mora, prescripcion o Verjaehrung."
---

# Deudas, mora y prescripcion

## Base legal (lee cada articulo con `get_article`)

- Vencida la deuda, la mora se produce con el requerimiento; si se pacto un dia de vencimiento, al pasar ese dia (Art. 102 OR).
- En contratos bilaterales, el acreedor puede fijar un plazo adecuado para cumplir y despues elegir segun la ley (Art. 107).
- Prescripcion general de diez anos (Art. 127); cinco anos para las prestaciones del Art. 128, como alquileres e intereses periodicos.
- Se interrumpe con el reconocimiento de la deuda, o con requerimiento ejecutivo, conciliacion, demanda y otros actos legales (Art. 135).

## Pasos

1. Fija fecha de vencimiento, requerimientos y pagos.
2. Determina el plazo de prescripcion leyendo la norma especial si la hay.
3. Redacta el requerimiento con importe, base, fecha limite y consecuencia.
4. Si la prescripcion esta cerca, di cual es el acto interruptivo adecuado.

## Reglas

- No cuentes intereses sin base legal o contractual verificada.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Vencimiento.
- Contrato.
- Pagos.
- Requerimientos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Requerimiento y tabla de prescripcion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Dejar prescribir.
- Intereses sin base.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
