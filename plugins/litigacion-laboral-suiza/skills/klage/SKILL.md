---
name: klage
description: "Redacta la demanda civil en procedimiento ordinario suizo con peticiones, valor litigioso, hechos y prueba ofrecida. Usar con demanda, Klage, presentar la demanda o Klageschrift."
---

# Demanda (Klage)

## Base legal (lee cada articulo con `get_article`)

- El procedimiento ordinario se inicia con la demanda (Art. 220 ZPO).
- La demanda contiene partes y representantes, peticiones, valor litigioso, alegaciones de hecho, la prueba de cada hecho alegado, fecha y firma (Art. 221 Abs. 1; lee el articulo completo y sus anexos obligatorios en Abs. 2).

## Pasos

1. Comprueba autorizacion para demandar y su plazo (`schlichtungsgesuch`).
2. Verifica competencia y tipo de procedimiento (hasta CHF 30 000 usa `vereinfachtes-verfahren`).
3. Peticiones con `generate_rechtsbegehren`: importes exactos, intereses con tipo y fecha.
4. Hechos numerados, uno por parrafo, cada uno con su prueba (`cronologia-y-prueba`).
5. Derecho: breve, cada requisito conectado a un hecho (`subsuncion-juridica`).
6. Indice de anexos, `revision-citas` y consejo de estrategia (`prepare_legal_council`).

## Reglas

- Un hecho no alegado o sin prueba ofrecida es un riesgo: dilo.
- No infles la pretension sin base.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Autorizacion.
- Hechos.
- Prueba.
- Importes.
- Intereses.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Demanda con anexos numerados. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Hechos sin prueba ofrecida.
- Peticiones no ejecutables.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
