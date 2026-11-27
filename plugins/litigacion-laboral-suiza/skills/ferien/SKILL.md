---
name: ferien
description: "Resuelve derechos de vacaciones en derecho laboral suizo. Usar con vacaciones, Ferien, vacaciones no disfrutadas o pago de vacaciones."
---

# Vacaciones

## Base legal (lee cada articulo con `get_article`)

- Al menos cuatro semanas por ano de servicio y cinco hasta los 20 anos cumplidos; prorrata en anos incompletos (Art. 329a OR).
- Se conceden en el ano, con dos semanas seguidas al menos; el empleador fija las fechas teniendo en cuenta los deseos del trabajador (Art. 329c).
- Durante la relacion no pueden sustituirse por dinero (Art. 329d Abs. 2).

## Pasos

1. Calcula devengo, disfrute y saldo.
2. Revisa reducciones por ausencias (Art. 329b, leelo).
3. Determina el salario de vacaciones a la salida.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Antiguedad.
- Dias disfrutados.
- Ausencias.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Saldo y valor. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Pagar vacaciones durante el contrato.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
