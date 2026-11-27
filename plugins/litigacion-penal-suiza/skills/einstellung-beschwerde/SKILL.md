---
name: einstellung-beschwerde
description: "Recurre o defiende un archivo del procedimiento penal. Usar con archivo, Einstellungsverfuegung o han archivado mi denuncia."
---

# Archivo y su recurso

## Base legal (lee cada articulo con `get_article`)

- La fiscalia archiva total o parcialmente en los casos del Art. 319 Abs. 1 StPO, como falta de sospecha suficiente o de tipo penal.
- Las partes pueden impugnar el archivo en 10 dias ante la instancia de queja (Art. 322 Abs. 2).

## Pasos

1. Fecha de notificacion y calculo con `STPO_BESCHWERDE`.
2. Rebate cada motivo de archivo con pruebas.
3. Pide diligencias concretas.
4. Comprueba legitimacion (`privatklaegerschaft-zivilklage`).

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Resolucion de archivo y notificacion.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Queja con diligencias. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- No acreditar legitimacion.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
