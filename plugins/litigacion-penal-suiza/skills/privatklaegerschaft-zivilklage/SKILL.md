---
name: privatklaegerschaft-zivilklage
description: "Constituyete como acusacion particular y reclama danos en el proceso penal. Usar con perjudicado, Privatklaegerschaft, Zivilklage adhesion o indemnizacion en penal."
---

# Acusacion particular y accion civil

## Base legal (lee cada articulo con `get_article`)

- Es acusacion particular la persona perjudicada que declara participar; la declaracion se hace como muy tarde al cierre del procedimiento previo (Art. 118 StPO).
- Puede hacer valer pretensiones civiles derivadas del delito en el proceso penal (Art. 122 Abs. 1).
- La legitimacion para recurrir exige interes juridico, con el limite sobre la pena (Art. 382).

## Pasos

1. Redacta la declaracion expresa como parte penal, civil o ambas.
2. Cuantifica y documenta el dano.
3. Revisa gastos y la ayuda a victimas (`opferhilfe`).

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Dano.
- Documentos.
- Fase.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Declaracion y peticion civil. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Declararse tras el cierre.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
