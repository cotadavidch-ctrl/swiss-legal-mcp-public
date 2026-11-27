---
name: akteneinsicht-gehoer-straf
description: "Pide acceso al sumario y ejerce el derecho a ser oido en el proceso penal. Usar con ver el expediente penal, Akteneinsicht o no me dejan participar."
---

# Expediente y audiencia en penal

## Base legal (lee cada articulo con `get_article`)

- Las partes tienen derecho a ser oidas, incluido consultar el expediente, participar en actuaciones, tener abogado y pronunciarse (Art. 107 Abs. 1 StPO).
- Con el procedimiento pendiente pueden consultar el expediente como muy tarde tras la primera declaracion del investigado y la practica de las demas pruebas importantes (Art. 101 Abs. 1; lee las restricciones).

## Pasos

1. Redacta la peticion indicando piezas.
2. Si se deniega, anota la resolucion y su recurso.
3. Indexa lo recibido y marca contradicciones.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Fase y piezas pedidas.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Peticion e indice. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- No recurrir la negativa.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
