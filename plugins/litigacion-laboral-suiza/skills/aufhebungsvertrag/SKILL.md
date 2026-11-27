---
name: aufhebungsvertrag
description: "Revisa un acuerdo de extincion o finiquito. Usar con acuerdo de salida, Aufhebungsvertrag, finiquito o renuncia a reclamar."
---

# Acuerdo de extincion

## Base legal (lee cada articulo con `get_article`)

- Durante la relacion y un mes despues el trabajador no puede renunciar a creditos que nacen de normas imperativas o de convenio (Art. 341 Abs. 1 OR).

## Pasos

1. Compara lo que se ofrece con lo que corresponderia: preaviso, periodos protegidos, vacaciones, horas, bono.
2. Revisa efectos sobre el seguro de desempleo y avisa de que deben verificarse.
3. Propon cambios de texto y plazo para pensarlo.

## Reglas

- No firmes ni aceptes por el usuario.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Propuesta.
- Contrato.
- Saldo de derechos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Comparacion y texto alternativo. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Aceptar renuncias nulas.
- Olvidar efectos en desempleo.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
