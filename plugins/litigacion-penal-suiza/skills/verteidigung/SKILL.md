---
name: verteidigung
description: "Determina si la defensa es obligatoria o de oficio y la solicita. Usar con abogado de oficio, amtliche Verteidigung, notwendige Verteidigung o no tengo dinero para abogado."
---

# Defensa obligatoria y de oficio

## Base legal (lee cada articulo con `get_article`)

- La defensa es necesaria, entre otros casos, si la privacion de libertad supera 10 dias o amenaza pena privativa de mas de un ano (Art. 130 StPO; lee todas las letras).
- El director del procedimiento ordena defensa de oficio en los casos del Art. 132, incluido cuando faltan medios y la defensa es precisa para proteger los intereses.

## Pasos

1. Comprueba cada letra del Art. 130.
2. Redacta la solicitud con justificantes economicos.
3. Pide que no se practiquen actos sin defensa cuando es obligatoria.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Pena amenazada.
- Detencion.
- Ingresos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud de defensa. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- No pedirla a tiempo.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
