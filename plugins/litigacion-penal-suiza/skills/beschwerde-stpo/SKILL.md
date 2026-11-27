---
name: beschwerde-stpo
description: "Prepara la queja penal contra actos de policia, fiscalia o tribunal de primera instancia. Usar con Beschwerde StPO, recurrir decision de la fiscalia o queja penal."
---

# Queja penal (Beschwerde)

## Base legal (lee cada articulo con `get_article`)

- Cabe contra resoluciones y actos de policia, fiscalia y autoridades de contravenciones, y contra los del tribunal de primera instancia salvo los de direccion del proceso (Art. 393 Abs. 1 StPO; lee motivos en Abs. 2).
- Plazo de 10 dias, escrita y motivada; sin plazo por denegacion o retraso (Art. 396).

## Pasos

1. Identifica el acto y la instancia.
2. Calcula con `STPO_BESCHWERDE`.
3. Motiva cada queja y pide la decision concreta.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Acto.
- Fecha.
- Autoridad.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Queja motivada. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Recurrir actos de direccion excluidos.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
