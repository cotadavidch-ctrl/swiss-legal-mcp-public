---
name: cerrar-asunto
description: "Cierra un asunto: resultado, plazos que quedan vivos, documentos que se conservan y lecciones. Usar con cerrar asunto, asunto terminado o archivar."
---

# Cierre de un asunto

## Pasos

1. Confirma el motivo: sentencia firme, acuerdo, retirada, abandono.
2. Comprueba que no queda plazo vivo: recurso contra la ultima resolucion, ejecucion, costas, revision.
3. Escribe `asuntos/<slug>/cierre.md`: resultado, importes, plazos descartados con su razon, documentos entregados y conservados.
4. Marca el asunto como cerrado con `create_or_update_matter` y `change_summary` de cierre.
5. Indica al usuario que documentos devolver y cuales conservar (`conservacion-documentos`).

## Reglas

- No borres ficheros al cerrar.
- Si la firmeza no consta, el asunto no se cierra: se deja en espera.

## Datos que hay que pedir

- Motivo del cierre.
- Ultima resolucion y su notificacion.
- Importes pendientes.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Cierre.md con resultado, plazos descartados y documentos. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Cerrar con recurso abierto.
- No comprobar costas ni ejecucion.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
