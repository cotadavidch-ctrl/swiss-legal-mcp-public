---
name: jugendstrafverfahren
description: "Orienta en procedimientos penales contra menores. Usar con menor denunciado, Jugendstrafverfahren o mi hijo y la policia."
---

# Proceso penal de menores

## Base legal (lee cada articulo con `get_article`)

- Rige la ley procesal de menores y, en lo no regulado, la StPO, con excepciones (Art. 3 JStPO).
- Lee en la JStPO la defensa, la participacion de los padres y los recursos antes de afirmar nada.

## Pasos

1. Confirma edad en la fecha de los hechos.
2. Informa a representantes legales y pide defensa.
3. Anonimiza siempre los datos del menor.
4. Comprueba cada plazo en la JStPO.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Edad.
- Citacion.
- Representantes.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Plan de actuacion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Aplicar reglas de adultos.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
