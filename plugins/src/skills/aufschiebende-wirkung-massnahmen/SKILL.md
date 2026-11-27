---
name: aufschiebende-wirkung-massnahmen
description: "Gestiona el efecto suspensivo y las medidas provisionales en un recurso administrativo federal. Usar con suspender la resolucion, efecto suspensivo, aufschiebende Wirkung o medidas provisionales."
---

# Efecto suspensivo y medidas provisionales

## Base legal (lee cada articulo con `get_article`)

- El recurso tiene efecto suspensivo (Art. 55 Abs. 1 VwVG); si la resolucion no versa sobre una prestacion en dinero puede retirarse (Abs. 2; lee los apartados siguientes).
- Tras presentar el recurso, la instancia puede ordenar otras medidas provisionales para mantener la situacion o proteger intereses amenazados (Art. 56).

## Pasos

1. Lee si la resolucion retira el efecto suspensivo.
2. Si lo retira, pide su restitucion explicando intereses en juego, urgencia y proporcionalidad.
3. Pide medidas concretas si el efecto suspensivo no basta.

## Reglas

- No des por suspendida la resolucion sin leerla y sin comprobar la ley especial.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Texto sobre efecto suspensivo.
- Dano.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud urgente. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Creer suspendido sin leer la resolucion.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
