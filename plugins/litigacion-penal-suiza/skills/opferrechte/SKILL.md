---
name: opferrechte
description: "Hace valer los derechos de la victima en el proceso penal. Usar con derechos de la victima, proteccion, no quiero ver al acusado o persona de confianza."
---

# Derechos de la victima

## Base legal (lee cada articulo con `get_article`)

- La victima tiene derechos especiales: proteccion de la personalidad, persona de confianza, medidas de proteccion y negativa a declarar sobre ciertas preguntas, entre otros (Art. 117 Abs. 1 StPO; lee las remisiones).

## Pasos

1. Determina si la persona es victima en sentido legal.
2. Pide las medidas concretas y cita su articulo.
3. Coordina con `privatklaegerschaft-zivilklage` y `opferhilfe`.

## Reglas

- Lenguaje cuidadoso.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Condicion de victima y temores.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud de proteccion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Confundir victima y denunciante.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
