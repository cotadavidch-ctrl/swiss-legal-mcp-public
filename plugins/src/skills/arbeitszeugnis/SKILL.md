---
name: arbeitszeugnis
description: "Pide o corrige un certificado de trabajo. Usar con certificado de trabajo, Arbeitszeugnis o referencia negativa."
---

# Certificado de trabajo

## Base legal (lee cada articulo con `get_article`)

- El trabajador puede pedir en cualquier momento un certificado sobre tipo y duracion de la relacion, rendimiento y conducta (Art. 330a Abs. 1 OR); si lo pide, solo sobre tipo y duracion (Abs. 2).

## Pasos

1. Compara el certificado con funciones y evaluaciones documentadas.
2. Redacta la peticion de correccion frase por frase.
3. Propon el texto alternativo veraz.

## Reglas

- El certificado debe ser veraz: no propongas elogios sin base.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Certificado actual.
- Evaluaciones.
- Funciones.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Texto alternativo y peticion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Pedir afirmaciones no veraces.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
