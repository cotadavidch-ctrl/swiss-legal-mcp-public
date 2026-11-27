---
name: beweis-und-noven
description: "Ordena la prueba civil suiza y controla hasta cuando se pueden alegar hechos nuevos o cambiar la demanda. Usar con prueba, Noven, hechos nuevos, ampliar la demanda o vorsorgliche Beweisfuehrung."
---

# Prueba, hechos nuevos y cambio de demanda

## Base legal (lee cada articulo con `get_article`)

- Objeto de prueba y derecho a la prueba (Art. 150 y 152 ZPO); deber de colaborar (Art. 160).
- Practica anticipada de prueba si la ley lo da o se hace verosimil un riesgo para la prueba o un interes digno de proteccion (Art. 158).
- Hechos y pruebas nuevos en primera instancia: sin limite en el primer turno de la vista principal si no hubo segundo intercambio de escritos ni audiencia de instruccion; en otro caso solo con los requisitos de los Noven autenticos e impropios (Art. 229).
- Cambio de demanda (Art. 227) y, en la vista principal, solo con base ademas en hechos o pruebas nuevos (Art. 230).

## Pasos

1. Identifica en que momento procesal esta el asunto.
2. Clasifica cada hecho o prueba nueva: de fecha posterior o anterior que no pudo aportarse con diligencia razonable.
3. Explica el riesgo de inadmision y presentalo cuanto antes.
4. En apelacion usa `berufung-zpo` (Art. 317 ZPO).

## Reglas

- La fecha de un documento no prueba por si sola que no pudiera obtenerse antes.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Fase procesal.
- Fecha de cada hecho y prueba.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Tabla de novedades con riesgo. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Creer que la fecha del documento basta.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
