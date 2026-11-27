---
name: fristlose-kuendigung
description: "Analiza un despido o abandono inmediato por causa grave. Usar con despido inmediato, fristlose Kuendigung, me han echado hoy o abandono del puesto."
---

# Despido con efecto inmediato

## Base legal (lee cada articulo con `get_article`)

- Cualquiera puede resolver sin plazo por motivos importantes y debe motivarlo por escrito si se le pide (Art. 337 Abs. 1 OR).
- Sin motivo importante, el trabajador tiene derecho a lo que habria ganado hasta el fin ordinario, descontando lo ahorrado y ganado en otro empleo, y el juez puede anadir una indemnizacion limitada (Art. 337c).
- Si el trabajador abandona sin motivo, el empleador puede exigir un cuarto de un salario mensual y otros danos (Art. 337d).

## Pasos

1. Reconstruye hechos y cuanto tardo la reaccion.
2. Pide la motivacion escrita y ofrece el trabajo si procede.
3. Cuantifica salario hasta el termino ordinario y descuentos.
4. Controla plazos, marcados `[CALCULO MANUAL, SIN HERRAMIENTA]`.

## Reglas

- No califiques el motivo como grave o no grave sin los hechos.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Hechos.
- Momento de reaccion.
- Carta.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Valoracion y reclamacion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Reaccionar tarde.
- No ofrecer el trabajo.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
