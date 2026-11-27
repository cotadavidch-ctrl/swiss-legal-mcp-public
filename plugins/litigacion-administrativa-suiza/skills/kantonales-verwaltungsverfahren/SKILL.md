---
name: kantonales-verwaltungsverfahren
description: "Localiza el procedimiento administrativo cantonal aplicable y prepara el recurso cantonal. Usar con recurso cantonal, Rekurs, autoridad cantonal o municipal."
---

# Procedimiento administrativo cantonal

## Base legal (lee cada articulo con `get_article`)

- Cada canton tiene su ley de procedimiento: localizala con `search_cantonal_legislation` y lee los articulos con `get_cantonal_article`. El VwVG federal no se aplica por defecto.

## Pasos

1. Identifica canton y autoridad.
2. Localiza ley, instancia, plazo, forma, efecto suspensivo y costas.
3. Cita cada articulo con su texto leido; si la herramienta no cubre el canton, dilo y pide el texto.
4. Calcula el plazo segun la ley cantonal y marcalo `[CALCULO MANUAL, SIN HERRAMIENTA]`.

## Reglas

- No traslades plazos federales a un recurso cantonal.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Canton.
- Autoridad.
- Resolucion.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Ley localizada y borrador. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Aplicar plazos federales.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
