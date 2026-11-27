---
name: migration-bewilligung
description: "Defiende un asunto de permiso de extranjeria. Usar con permiso de residencia, Aufenthaltsbewilligung, revocacion o expulsion."
---

# Permisos de extranjeria

## Base legal (lee cada articulo con `get_article`)

- Los motivos de revocacion y el principio de proporcionalidad estan en la AIG (entre otros Art. 62 y 96): leelos con `get_article`.
- La via de recurso depende de la autoridad: usa `kantonales-verwaltungsverfahren` y comprueba las excepciones del Art. 83 BGG.

## Pasos

1. Identifica permiso, decision, motivo y plazo.
2. Reune datos de arraigo, trabajo, familia y antecedentes.
3. Estructura la ponderacion de intereses con hechos probados.

## Reglas

- Asunto sensible: recomienda abogado desde el primer paso.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Permiso.
- Decision.
- Arraigo.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Ponderacion de intereses y recurso. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Actuar sin abogado en caso de expulsion.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
