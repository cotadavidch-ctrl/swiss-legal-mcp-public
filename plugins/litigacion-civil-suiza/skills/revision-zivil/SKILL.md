---
name: revision-zivil
description: "Valora la revision de una sentencia civil firme suiza por hechos o pruebas descubiertos despues. Usar con revision, sentencia firme, prueba nueva despues de firme."
---

# Revision civil

## Base legal (lee cada articulo con `get_article`)

- Puede pedirse ante la ultima instancia que resolvio por los motivos del Art. 328 ZPO, como hechos relevantes o pruebas decisivas descubiertos despues.
- Plazo de 90 dias desde el descubrimiento del motivo, por escrito y motivada; pasados diez anos desde la firmeza ya no cabe, salvo la excepcion legal (Art. 329).

## Pasos

1. Fija la fecha de descubrimiento y su prueba.
2. Explica por que no pudo aportarse antes.
3. Calcula a mano los 90 dias, marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`.
4. Distingue la revision de un recurso ordinario todavia abierto.

## Reglas

- La revision es excepcional: no la presentes como una segunda apelacion.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Sentencia firme.
- Fecha del descubrimiento.
- Prueba.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud con fechas. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Presentar una segunda apelacion.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
