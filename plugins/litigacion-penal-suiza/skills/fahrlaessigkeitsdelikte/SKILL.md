---
name: fahrlaessigkeitsdelikte
description: "Analiza muertes y lesiones por imprudencia, incluidas las de obra o trabajo. Usar con accidente laboral, homicidio imprudente, lesiones imprudentes o accidente de obra."
---

# Imprudencia y accidentes

## Base legal (lee cada articulo con `get_article`)

- Homicidio imprudente (Art. 117 StGB).
- Lesiones imprudentes: a querella, de oficio si son graves (Art. 125).
- Riesgo por infringir reglas de la construccion (Art. 229).

## Pasos

1. Fija fecha: si es de querella corre el plazo de tres meses (`strafanzeige-strafantrag`).
2. Identifica deber de cuidado, infraccion, causalidad y evitabilidad, con peritos.
3. Coordina con seguro de accidentes y reclamacion civil.

## Reglas

- No des por probada la causalidad sin informe.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Accidente.
- Deberes.
- Informes.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Analisis causal. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Dar por probada la causalidad.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
