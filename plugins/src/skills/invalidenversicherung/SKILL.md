---
name: invalidenversicherung
description: "Analiza un caso del seguro de invalidez suizo. Usar con IV, renta de invalidez, grado de invalidez o integracion."
---

# Seguro de invalidez

## Base legal (lee cada articulo con `get_article`)

- Lee en la IVG las normas sobre incapacidad, deber de reducir el dano y derecho a la renta (entre ellas Art. 7 y 28) con `get_article`.
- Procedimiento y pruebas: ATSG (Art. 43, 44, 61).

## Pasos

1. Distingue medidas de integracion y renta.
2. Ordena informes medicos y sus contradicciones.
3. Revisa el calculo comparativo de ingresos con documentos.
4. Si hay proyecto de decision, anota el plazo que fija para objetar.

## Reglas

- No estimes un grado de invalidez sin informes.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Informes.
- Ingresos.
- Proyecto de decision.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Objecion o recurso. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Estimar grados sin informes.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
