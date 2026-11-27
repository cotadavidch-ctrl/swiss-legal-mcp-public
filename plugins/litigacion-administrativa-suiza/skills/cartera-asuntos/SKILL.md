---
name: cartera-asuntos
description: "Muestra el estado de todos los asuntos abiertos con sus plazos proximos y riesgos. Usar con mis asuntos, cartera, que tengo abierto o que vence esta semana."
---

# Cartera de asuntos

## Pasos

1. Recorre `asuntos/*/asunto.md` y `plazos.md`.
2. Entrega una tabla: asunto, materia, fase, proximo plazo, dias que faltan, riesgo, siguiente accion.
3. Ordena por urgencia. Destaca plazos a menos de 10 dias y asuntos sin fecha de notificacion.
4. Lista aparte los asuntos sin actividad en 30 dias.

## Reglas

- No mezcles datos de un asunto en otro.
- Un plazo sin `compute_legal_deadline` o sin calculo manual marcado figura como `no verificado`.

## Datos que hay que pedir

- Carpeta base.
- Periodo de interes.
- Criterio de orden.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Tabla de asuntos ordenada por urgencia. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Dar por verificado un plazo sin calculo.
- Mezclar datos entre asuntos.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
