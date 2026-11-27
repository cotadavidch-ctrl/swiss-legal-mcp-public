---
name: vollstreckung
description: "Prepara la ejecucion de una resolucion civil suiza que no es de dinero, o encamina el cobro por la via de la SchKG. Usar con ejecutar sentencia, Vollstreckung, no cumplen la sentencia."
---

# Ejecucion de resoluciones

## Base legal (lee cada articulo con `get_article`)

- Si no cabe ejecucion directa, se presenta solicitud ante el tribunal de ejecucion con los requisitos y documentos (Art. 338 ZPO).
- El tribunal examina de oficio la ejecutabilidad y da plazo a la parte vencida, que en el fondo solo puede oponer hechos posteriores como los que fija la ley (Art. 341).

## Pasos

1. Distingue: dinero y garantias van por la SchKG (`betreibung-schkg`); hacer, no hacer o entregar, por la ZPO.
2. Reune la resolucion, certificacion de firmeza o ejecutabilidad y prueba del incumplimiento.
3. Pide la medida de ejecucion concreta.
4. Anticipa la oposicion posible.

## Reglas

- No sugieras ejecutar por cuenta propia.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Resolucion.
- Certificado de firmeza.
- Incumplimiento.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud de ejecucion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Mezclar deuda de dinero con ejecucion zpo.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
