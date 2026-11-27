---
name: atsg-revision-wiedererwaegung
description: "Pide la revision o reconsideracion de una decision firme de un seguro social. Usar con decision firme de la SUVA o IV, informes nuevos o reconsideracion."
---

# Revision y reconsideracion (ATSG)

## Base legal (lee cada articulo con `get_article`)

- La aseguradora dicta resolucion escrita sobre prestaciones relevantes o discutidas (Art. 49 ATSG).
- Una decision firme se revisa si aparecen hechos o pruebas nuevos relevantes que no podian aportarse antes (Art. 53 Abs. 1); la reconsideracion de decisiones manifiestamente erroneas esta en el Abs. 2 (leelo).

## Pasos

1. Identifica la decision firme y lo nuevo.
2. Explica por que no pudo aportarse antes.
3. Redacta la solicitud y avisa de que la reconsideracion puede no ser exigible.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Decision firme.
- Informe nuevo.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Presentar lo ya conocido como nuevo.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
