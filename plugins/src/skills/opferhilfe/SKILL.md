---
name: opferhilfe
description: "Orienta sobre la ayuda a victimas de delitos. Usar con soy victima, Opferhilfe, ayuda a victimas o violencia."
---

# Ayuda a victimas

## Base legal (lee cada articulo con `get_article`)

- Quien sufre un delito que afecta directamente su integridad fisica, psiquica o sexual tiene derecho a la ayuda de la ley (Art. 1 OHG; lee quien mas tiene derecho).
- Prestaciones, plazos y centros: lee la OHG con `get_article`.

## Pasos

1. Si hay peligro inmediato, indica llamar a la policia antes que nada.
2. Remite al centro cantonal de ayuda a victimas.
3. Anota plazos de las pretensiones leidos en la ley.
4. Coordina con `privatklaegerschaft-zivilklage`.

## Reglas

- Lenguaje cuidadoso: no pidas detalles innecesarios.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Tipo de hecho.
- Urgencia.
- Canton.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Orientacion y contactos. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Pedir detalles innecesarios.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
