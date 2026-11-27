---
name: strafbefehlsverfahren
description: "Decide y gestiona la oposicion a una orden penal. Usar con Strafbefehl, me ha llegado una multa penal u oponerme."
---

# Orden penal y oposicion

## Base legal (lee cada articulo con `get_article`)

- Oposicion por escrito ante la fiscalia en 10 dias (Art. 354 Abs. 1 StPO).
- Con oposicion, la fiscalia practica las pruebas necesarias; si quien se opuso no comparece sin excusa a una citacion se aplican las consecuencias del Art. 355 (leelo).

## Pasos

1. Calcula con `STPO_EINSPRACHE_STRAFBEFEHL` y avisa primero.
2. Explica efectos de no oponerse, incluida la firmeza y antecedentes (verifica).
3. Prepara oposicion breve y plan de pruebas.
4. Recuerda asistir a toda citacion.

## Reglas

- No dejes vencer el plazo mientras se estudia el fondo.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Orden penal y fecha.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Oposicion y plan. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- No comparecer a citaciones.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
