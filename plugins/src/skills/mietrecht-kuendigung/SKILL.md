---
name: mietrecht-kuendigung
description: "Maneja la impugnacion de un despido de arrendamiento en derecho suizo: plazo de 30 dias ante la conciliacion, prorroga del contrato y procedimiento simplificado. Usar con Mietrecht, rescision de alquiler, anfechtung de Kuendigung o Schlichtungsbehoerde."
---

# Impugnacion del despido de un alquiler

## Base legal (lee cada articulo con `get_article`)

- La rescision es impugnable si va contra la buena fe (Art. 271 Abs. 1 OR); el arrendador debe motivarla si se le pide (Abs. 2). Pide la motivacion por escrito cuanto antes.
- **Impugnacion**: la peticion se presenta ante la autoridad de conciliacion en los 30 dias siguientes a la RECEPCION de la rescision (Art. 273 Abs. 1 OR). Usa `compute_legal_deadline` con `OR_MIETE_KUENDIGUNG_ANFECHTUNG`: calcula sin suspension de plazos y lo indica, porque no esta claro que rija la suspension para este tramite.
- **Prorroga del contrato**: la peticion es de 30 dias desde la recepcion en un contrato indefinido, y como tarde 60 dias antes del fin del contrato en uno de duracion determinada (Art. 273 Abs. 2 OR). Son dos plazos distintos del anterior: calcula el segundo a mano y marcalo `[CALCULO MANUAL, SIN HERRAMIENTA]`.
- **Procedimiento**: toda demanda va precedida de conciliacion (Art. 197 ZPO). El procedimiento simplificado rige en alquileres de vivienda y local comercial cuando se discute la proteccion frente a la rescision o la prorroga, sin importar la cuantia (Art. 243 Abs. 2 lit. c ZPO).
- **Tribunal Federal**: en asuntos de alquiler el umbral de valor litigioso es de CHF 15 000 (Art. 74 Abs. 1 lit. a BGG; ver `beschwerde-bgg`).

## Pasos

1. Abre el asunto con `alta-asunto` (materia `tenancy`).
2. Fija la fecha de RECEPCION de la rescision y como consta (sobre, acuse). Sin ella no hay plazo calculable.
3. Calcula los plazos con `plazos-y-via`. Avisa de la urgencia: son 30 dias.
4. Reune contrato, rescision, motivos alegados y comunicaciones previas (`cronologia-y-prueba`).
5. Decide con el usuario si se impugna, se pide prorroga o ambas cosas, y prepara la peticion a la conciliacion.

## Reglas

- No afirmes que la rescision es abusiva ni que habra prorroga: indica elementos a favor y en contra sin prometer resultado.
- Si la rescision no uso el formulario oficial o hay otro defecto formal, indicalo como punto a verificar con un abogado; esta skill no lo da por probado.
- Es un borrador para revision de un abogado.

## Datos que hay que pedir

- Contrato.
- Rescision.
- Fecha de recepcion.
- Formulario.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud a la conciliacion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Contar desde la fecha de la carta.
- Olvidar la prorroga.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
