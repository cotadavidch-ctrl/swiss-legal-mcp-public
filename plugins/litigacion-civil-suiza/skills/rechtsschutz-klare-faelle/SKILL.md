---
name: rechtsschutz-klare-faelle
description: "Valora y prepara la tutela rapida en casos claros del procedimiento civil suizo. Usar con caso claro, Rechtsschutz in klaren Faellen o desahucio rapido."
---

# Tutela en casos claros

## Base legal (lee cada articulo con `get_article`)

- El tribunal la concede en procedimiento sumario si los hechos no se discuten o se pueden probar de inmediato y la situacion juridica es clara (Art. 257 Abs. 1 ZPO).
- No cabe cuando rige el principio de oficio (Abs. 2). Lee el Abs. 3 sobre la consecuencia si faltan los requisitos.

## Pasos

1. Lista las objeciones plausibles de la otra parte: si exigen prueba compleja, esta via no sirve.
2. Reune prueba documental inmediata.
3. Redacta la solicitud explicando por que hechos y derecho son claros.
4. Prepara la alternativa ordinaria por si no se entra en el fondo.

## Reglas

- No presentes un caso discutible como claro.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Documentos inmediatos y objeciones previsibles.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud o alternativa ordinaria. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Usarlo con hechos discutidos.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
