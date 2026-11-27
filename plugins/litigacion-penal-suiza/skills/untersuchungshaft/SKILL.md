---
name: untersuchungshaft
description: "Defiende frente a la prision preventiva: requisitos, plazos y puesta en libertad. Usar con detenido, Untersuchungshaft, prision preventiva o libertad."
---

# Prision preventiva

## Base legal (lee cada articulo con `get_article`)

- La regla es la libertad; la privacion solo cabe segun la ley y se levanta cuando faltan sus requisitos (Art. 212 StPO).
- Requisitos: sospecha vehemente de crimen o delito y peligro de fuga, colusion o reiteracion en los terminos del Art. 221.
- La fiscalia pide la prision al tribunal de medidas como muy tarde 48 horas despues de la detencion (Art. 224 Abs. 2), y el tribunal decide como muy tarde 48 horas tras la peticion (Art. 226 Abs. 1). Prorroga: Art. 227.

## Pasos

1. Anota hora de detencion y de cada peticion.
2. Discute cada motivo con hechos: arraigo, trabajo, familia, pruebas ya aseguradas.
3. Propon medidas sustitutivas concretas.
4. Revisa el plazo y las vias de recurso con `strafverfahren-stpo`.

## Reglas

- Urgente: recomienda defensor de inmediato.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Hora de detencion.
- Motivos.
- Arraigo.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Escrito de libertad y medidas. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- No discutir cada motivo.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
