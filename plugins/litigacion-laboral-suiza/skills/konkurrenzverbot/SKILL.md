---
name: konkurrenzverbot
description: "Revisa una prohibicion de competencia tras el contrato. Usar con no competencia, Konkurrenzverbot o me prohiben trabajar para la competencia."
---

# Prohibicion de competencia

## Base legal (lee cada articulo con `get_article`)

- El trabajador capaz puede obligarse por escrito a no competir tras la relacion, en las condiciones del Art. 340 OR (leelo completo).
- Debe limitarse adecuadamente en lugar, tiempo y objeto; solo en circunstancias especiales supera tres anos, y el juez puede reducirla (Art. 340a).

## Pasos

1. Comprueba forma escrita y acceso a clientela o secretos.
2. Evalua limites y pena convencional.
3. Revisa las causas de extincion del Art. 340c (leelo).

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Clausula.
- Funciones.
- Acceso a clientes.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Analisis de validez y limites. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Ignorar la forma escrita.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
