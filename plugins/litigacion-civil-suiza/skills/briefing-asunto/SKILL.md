---
name: briefing-asunto
description: "Resume el estado de un asunto: posiciones, hechos, prueba, plazos, riesgos y decisiones pendientes. Usar con ponme al dia, briefing del asunto o donde estamos."
---

# Briefing de un asunto

## Pasos

1. Lee `asunto.md`, `historial.md`, `cronologia.md`, `prueba.md` y `plazos.md`. Consulta `get_matter_state`.
2. Entrega en una pagina: asunto y posicion; pretensiones; los tres hechos decisivos con su estado; prueba que falta; proximo plazo con fecha y base; riesgos; decisiones que debe tomar el usuario.
3. Marca las contradicciones entre ficheros y las fechas sin fuente.
4. Si piden valorar la estrategia, usa `prepare_legal_council` y `validate_legal_council`.

## Reglas

- Nada que no este en los ficheros del asunto: lo que falte se lista como dato pendiente.
- No des probabilidades de exito en porcentaje.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Slug del asunto.
- Destinatario del resumen.
- Decision que se quiere tomar.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Una pagina con posiciones, hechos, prueba, plazos, riesgos y decisiones. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Presentar alegaciones como hechos.
- Omitir el plazo mas cercano.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
