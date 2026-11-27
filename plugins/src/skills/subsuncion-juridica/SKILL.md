---
name: subsuncion-juridica
description: "Revisa que cada norma y sentencia citada este conectada con un hecho concreto y una prueba del asunto. Usar con pulir escrito, conectar derecho con hechos o subsuncion."
---

# Subsuncion

## Pasos

1. Lista cada norma y sentencia del texto.
2. Para cada una identifica: requisito legal, hecho del asunto que lo cumple, prueba de ese hecho y conclusion.
3. Marca las citas sueltas y los requisitos sin hecho o sin prueba.
4. Comprueba el requisito contra el texto del articulo (`get_article`) y la sentencia contra su texto (`fetch_official_swiss_case_full_text`).
5. Reescribe los parrafos flojos y muestra los cambios.

## Reglas

- Una cita que no se puede conectar con un hecho se elimina o se marca.
- No inventes el contenido de una sentencia.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Escrito y documentos del asunto.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Tabla requisito, hecho, prueba, conclusion y texto revisado. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Citar sentencias en abstracto.
- Dejar requisitos sin hecho.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
