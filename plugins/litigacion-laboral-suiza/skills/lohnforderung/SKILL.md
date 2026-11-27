---
name: lohnforderung
description: "Reclama salarios impagados en derecho suizo. Usar con sueldo no pagado, Lohnforderung, nomina o liquidacion final."
---

# Reclamacion de salario

## Base legal (lee cada articulo con `get_article`)

- El empleador paga el salario pactado, usual o fijado por convenio (Art. 322 Abs. 1 OR), en principio al final de cada mes (Art. 323 Abs. 1).
- Durante la relacion y un mes despues no puede renunciarse a creditos de normas imperativas (Art. 341 Abs. 1).

## Pasos

1. Cuantifica mes a mes con contrato, nominas y extractos.
2. Comprueba convenio colectivo y pagos parciales.
3. Requiere por escrito (`forderung-verzug-verjaehrung`) y controla la prescripcion.
4. Si no paga, `schlichtungsgesuch`.

## Reglas

- No incluyas partidas sin documento: marcalas como discutidas.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Nominas.
- Extractos.
- Convenio.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Tabla mensual y requerimiento. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Sumar partidas sin documento.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
