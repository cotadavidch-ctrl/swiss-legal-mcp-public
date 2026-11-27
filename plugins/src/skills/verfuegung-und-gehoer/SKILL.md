---
name: verfuegung-und-gehoer
description: "Revisa si una resolucion administrativa federal cumple requisitos y si se respeto el derecho a ser oido. Usar con me han dictado una resolucion, derecho de audiencia, rechtliches Gehoer o Verfuegung defectuosa."
---

# Resolucion y derecho a ser oido

## Base legal (lee cada articulo con `get_article`)

- Es resolucion la orden de una autoridad en un caso concreto, basada en derecho publico federal, sobre derechos u obligaciones (Art. 5 VwVG; lee la lista completa).
- Las partes tienen derecho a ser oidas (Art. 29) y la autoridad las oye antes de resolver, salvo las excepciones del Art. 30 Abs. 2.
- Las resoluciones escritas se designan como tales, se motivan y llevan instruccion de recursos (Art. 35).

## Pasos

1. Comprueba que el acto es una resolucion y quien la dicto.
2. Revisa designacion, motivacion e instruccion de recursos.
3. Anota si hubo audiencia, sobre que y con que plazo; si una excepcion la justifica.
4. Explica la consecuencia posible de cada defecto sin darla por segura y calcula el recurso con `plazos-y-via`.

## Reglas

- No dejes pasar el plazo discutiendo el defecto: recurre en plazo.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Resolucion y comunicaciones previas.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Lista de defectos y recurso. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Alegar defecto y dejar vencer el plazo.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
