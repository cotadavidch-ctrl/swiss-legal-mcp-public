---
name: berufung-straf
description: "Prepara la apelacion penal. Usar con apelar condena, Berufung penal o recurrir sentencia penal."
---

# Apelacion penal

## Base legal (lee cada articulo con `get_article`)

- Cabe contra sentencias de primera instancia que cierran el proceso y las decisiones del Art. 398 Abs. 1 StPO; lee motivos y limites.
- Anuncio en 10 dias y declaracion en 20 dias (Art. 399).
- El tribunal revisa solo lo impugnado, salvo a favor del acusado para evitar resultados ilegales o inicuos (Art. 404).

## Pasos

1. Calcula ambos plazos con la herramienta.
2. Declaracion: puntos impugnados, cambios pedidos y pruebas.
3. Valora el riesgo de empeoramiento si apelan otras partes (verifica Art. 391).

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Sentencia.
- Anuncio.
- Notificacion motivada.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Anuncio y declaracion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Omitir el anuncio de diez dias.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
