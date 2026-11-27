---
name: akteneinsicht-verwaltung
description: "Pide y analiza el expediente administrativo federal. Usar con consultar el expediente, Akteneinsicht o no me ensenan los documentos."
---

# Consulta del expediente

## Base legal (lee cada articulo con `get_article`)

- La parte tiene derecho a consultar en su asunto los escritos, los documentos usados como prueba y las demas piezas que fija el Art. 26 Abs. 1 VwVG; las limitaciones estan en los articulos siguientes (leelos).

## Pasos

1. Redacta la peticion indicando asunto, piezas y plazo.
2. Pide que se suspenda o amplie el plazo para pronunciarte si el expediente no llega a tiempo, sabiendo que los plazos legales no se prorrogan.
3. Haz un indice del expediente recibido y marca huecos (`cronologia-y-prueba`).

## Reglas

- Trata los datos de terceros con `geheimnis-und-anonymisierung`.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Asunto.
- Piezas.
- Plazo en curso.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Peticion e indice. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- No fechar la peticion.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
