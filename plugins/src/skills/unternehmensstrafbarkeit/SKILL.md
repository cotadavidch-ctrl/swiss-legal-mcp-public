---
name: unternehmensstrafbarkeit
description: "Analiza la responsabilidad penal de una empresa. Usar con responsabilidad penal de la empresa, Unternehmensstrafbarkeit o delito en la empresa."
---

# Responsabilidad penal de la empresa

## Base legal (lee cada articulo con `get_article`)

- Si un crimen o delito cometido en la actividad de la empresa no puede atribuirse a una persona por defectos de organizacion, se imputa a la empresa (Art. 102 Abs. 1 StGB); para ciertos delitos responde ademas por no impedirlos (Abs. 2; lee la lista).

## Pasos

1. Describe hecho, actividad, organigrama y controles.
2. Separa responsabilidad individual y de empresa.
3. Documenta medidas organizativas existentes.
4. Avisa de conflictos de defensa entre empresa y empleados.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Hecho.
- Organigrama.
- Controles.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Analisis organizativo. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Ignorar conflictos de defensa.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
