---
name: actualizar-asunto
description: "Anota un hecho nuevo en un asunto abierto: notificacion, escrito, llamada, pago o resolucion, y revisa que plazos y riesgos cambian. Usar con anota en el asunto, ha pasado algo o actualiza el asunto."
---

# Actualizar un asunto

## Pasos

1. Identifica el asunto (`asuntos/<slug>/asunto.md`). Si no existe, usa `alta-asunto`.
2. Anade al historial `asuntos/<slug>/historial.md` una linea: fecha del hecho, fecha en que se anota, que paso, documento que lo prueba y quien lo aporta.
3. Si es una resolucion, carta de autoridad o requerimiento, pasa a `triage-gerichtspost` y recalcula plazos con `plazos-y-via`.
4. Actualiza el estado de los hechos afectados y la cronologia (`cronologia-y-prueba`).
5. Registra la version en el almacen con `create_or_update_matter` (registro minimo) y un `change_summary` de una linea.
6. Di en tres lineas que cambia: plazos, riesgos y siguiente accion.

## Reglas

- No borres ni reescribas entradas anteriores del historial: corrige con una entrada nueva.
- Sin documento, el hecho queda como `alleged`.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Fecha y fuente del hecho.
- Documento.
- Quien lo aporta.
- Plazo que menciona.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Linea de historial y resumen de cambios en plazos y riesgos. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Anotar sin fecha de recepcion.
- Sobrescribir entradas.
- No recalcular plazos.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
