---
name: arrest
description: "Valora y prepara un embargo preventivo (Arrest) en Suiza para asegurar una deuda. Usar con Arrest, embargo preventivo, el deudor se va o esconde bienes."
---

# Embargo preventivo (Arrest)

## Base legal (lee cada articulo con `get_article`)

- El acreedor puede pedir el embargo de bienes del deudor situados en Suiza para un credito vencido no garantizado con prenda, en las causas del Art. 271 Abs. 1 SchKG, como falta de domicilio fijo; lee todas las causas y el Abs. 2.
- Lo concede el tribunal del lugar de ejecucion o donde esten los bienes si el acreedor hace verosimiles tres cosas: su credito, una causa de embargo y bienes del deudor (Art. 272 Abs. 1). Para el procedimiento posterior lee los articulos siguientes.

## Pasos

1. Comprueba credito vencido, causa de embargo y bienes concretos con su ubicacion.
2. Reune documentos que hagan verosimiles los tres elementos.
3. Advierte de la responsabilidad por embargo injustificado y de los plazos posteriores para convalidarlo.
4. Conecta con `betreibung-schkg`.

## Reglas

- No sugieras buscar bienes por medios ilicitos.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Credito vencido.
- Causa.
- Bienes y ubicacion.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud de embargo. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Pedir sin identificar bienes.
- Olvidar la responsabilidad.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
