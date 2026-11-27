---
name: haeusliche-gewalt
description: "Pide proteccion contra violencia, amenazas y acoso en via civil y penal. Usar con violencia domestica, orden de alejamiento, acoso o stalking."
---

# Proteccion contra violencia y acoso

## Base legal (lee cada articulo con `get_article`)

- La persona afectada puede pedir al juez prohibiciones como acercarse, frecuentar lugares o contactar (Art. 28b Abs. 1 ZGB; lee los demas apartados).
- Estos litigios van al procedimiento simplificado sin importar la cuantia (Art. 243 Abs. 2 lit. b ZPO).

## Pasos

1. Si hay peligro actual, lo primero es llamar a la policia (117).
2. Lee la ley cantonal sobre expulsion del domicilio con `search_cantonal_legislation`.
3. Reune pruebas y pide medidas urgentes.
4. Coordina la denuncia penal y la ayuda a victimas.

## Reglas

- Cuida los datos de la victima: no incluyas direcciones protegidas.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Hechos.
- Pruebas.
- Peligro actual.
- Domicilio.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud de proteccion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Incluir direcciones protegidas.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
