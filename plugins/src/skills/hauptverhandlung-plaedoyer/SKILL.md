---
name: hauptverhandlung-plaedoyer
description: "Prepara el juicio oral penal y el informe final. Usar con juicio penal, Hauptverhandlung, alegato o Plaedoyer."
---

# Juicio oral e informe

## Base legal (lee cada articulo con `get_article`)

- Tramites del juicio principal: lee los articulos correspondientes de la StPO (a partir del Art. 328) con `get_article`.
- Valoracion de la prueba: Art. 10 StPO.

## Pasos

1. Esquema del alegato: peticion, hechos discutidos, prueba, derecho, pena y accesorias.
2. Interrogatorios con `preparacion-interrogatorio`.
3. Peticiones de prueba y su momento.
4. Prepara la peticion de indemnizacion (`entschaedigung-genugtuung`).

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Acusacion.
- Pruebas.
- Fecha.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Esquema de alegato. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Alegar hechos no probados.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
