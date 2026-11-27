---
name: ersatzmassnahmen
description: "Propone medidas sustitutivas de la prision preventiva. Usar con alternativa a la prision, fianza, Ersatzmassnahmen o retirada de pasaporte."
---

# Medidas sustitutivas

## Base legal (lee cada articulo con `get_article`)

- El tribunal ordena medidas mas leves en lugar de la prision si cumplen el mismo fin (Art. 237 Abs. 1 StPO), como fianza, retirada de documentos u obligaciones de residencia (Abs. 2; lee la lista).

## Pasos

1. Vincula cada motivo de prision con una medida que lo neutralice.
2. Aporta arraigo, domicilio, trabajo y garantias disponibles.
3. Incluye la propuesta en la oposicion o en la peticion de libertad.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Arraigo.
- Garantias.
- Riesgos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Propuesta concreta. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Medidas que no neutralizan el riesgo.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
