---
name: revision-straf
description: "Valora la revision de una condena penal firme. Usar con revision penal, prueba nueva tras condena o Revision."
---

# Revision penal

## Base legal (lee cada articulo con `get_article`)

- Puede pedirla quien este gravado por sentencia firme, orden penal u otras decisiones, por los motivos del Art. 410 StPO (leelos).
- Forma y plazos: Art. 411.

## Pasos

1. Identifica el motivo y la prueba nueva.
2. Comprueba el plazo en el Art. 411.
3. Explica por que cambiaria el resultado.

## Reglas

- Via excepcional: no es una segunda apelacion.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Sentencia firme y prueba nueva.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Usar via excepcional como recurso.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
