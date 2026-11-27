---
name: kuendigung-fristen-sperrfristen
description: "Calcula plazos de preaviso y periodos protegidos contra el despido. Usar con preaviso, Kuendigungsfrist, Sperrfrist, despido estando de baja o embarazo."
---

# Preaviso y periodos protegidos

## Base legal (lee cada articulo con `get_article`)

- Salvo pacto, preaviso de un mes el primer ano, dos meses del segundo al noveno y tres despues, a fin de mes (Art. 335c Abs. 1 OR).
- Tras la prueba, el empleador no puede despedir en los periodos del Art. 336c Abs. 1, entre ellos incapacidad sin culpa: 30 dias el primer ano, 90 del segundo al quinto y 180 desde el sexto, y embarazo y 16 semanas tras el parto. Lee el articulo completo y sus efectos.

## Pasos

1. Fija antiguedad, fecha de recepcion del despido y pactos.
2. Calcula preaviso y periodos protegidos a mano, marcados `[CALCULO MANUAL, SIN HERRAMIENTA]`.
3. Distingue despido nulo (en periodo protegido) de plazo suspendido (leyendo Abs. 2).
4. Combina con `arbeitsrecht-kuendigung`.

## Reglas

- El orden de las fechas decide el resultado: pide todas.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Inicio del contrato.
- Recepcion.
- Incapacidades.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Calendario con periodos protegidos. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Olvidar la suspension del preaviso.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
