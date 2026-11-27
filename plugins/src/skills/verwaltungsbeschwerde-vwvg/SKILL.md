---
name: verwaltungsbeschwerde-vwvg
description: "Prepara una Beschwerde administrativa federal (VwVG) contra una resolucion de una autoridad federal, con plazo y denegacion o retraso injustificado. Usar con recurso administrativo, Verfuegung federal o VwVG."
---

# Beschwerde administrativa federal (VwVG)

## Base legal (verifica cada articulo con `get_article`)

- La resolucion (Verfuegung) esta sujeta a Beschwerde (Art. 44 VwVG).
- Plazo: 30 dias desde la notificacion de la resolucion (Art. 50 Abs. 1 VwVG). Usa `compute_legal_deadline` con `VWVG_BESCHWERDE`.
- Denegacion o retraso injustificado de una resolucion impugnable: Beschwerde en cualquier momento (Art. 46a y Art. 50 Abs. 2 VwVG).
- Si la resolucion es cantonal o de una autoridad no federal, no se aplica esta skill: comprueba el derecho cantonal con `get_cantonal_article` y `search_cantonal_legislation`.

## Pasos

1. Abre el asunto con `alta-asunto` (materia `administrative`).
2. Identifica la autoridad que decidio, la instancia de recurso que indica la instruccion de recursos y la fecha de notificacion.
3. Calcula el plazo (`plazos-y-via`). Si la instruccion de recursos falta o es defectuosa, dilo: puede afectar al computo y debe valorarse con un abogado.
4. Pretensiones con `generate_rechtsbegehren`: anulacion, reforma, efecto suspensivo si procede (el campo `suspensiveEffectRequested`).
5. Jurisprudencia y citas (`revision-citas`).

## Reglas

- Distingue claramente la pretension principal de la subsidiaria.
- Si el expediente administrativo esta incompleto, lista el documento que falta y propone pedir la consulta del expediente.

## Datos que hay que pedir

- Resolucion.
- Notificacion.
- Instancia.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Borrador de recurso. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Dar por federal un acto cantonal.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
