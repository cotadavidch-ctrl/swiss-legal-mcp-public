---
name: arbeitsgericht-kosten
description: "Explica costas y reglas especiales de los pleitos laborales. Usar con cuanto cuesta demandar a mi empresa, Gerichtskosten o conciliacion laboral."
---

# Costas en pleitos laborales

## Base legal (lee cada articulo con `get_article`)

- En la conciliacion no se conceden indemnizaciones a las partes (Art. 113 Abs. 1 ZPO) y en ciertos litigios no hay costas judiciales (Abs. 2).
- En el procedimiento de decision tampoco hay costas judiciales en las materias del Art. 114, entre ellas la relacion de trabajo hasta el limite que fija el articulo (leelo).

## Pasos

1. Calcula el valor litigioso.
2. Comprueba el limite del Art. 114 y las excepciones.
3. Distingue costas judiciales de la indemnizacion a la otra parte.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Valor litigioso y materia.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Explicacion de costas. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Confundir tasas judiciales e indemnizacion.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
