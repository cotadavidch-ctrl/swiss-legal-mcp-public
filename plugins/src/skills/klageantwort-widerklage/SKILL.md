---
name: klageantwort-widerklage
description: "Redacta la contestacion a la demanda civil suiza, hecho por hecho, y la reconvencion si procede. Usar con contestar demanda, Klageantwort, nos han demandado o Widerklage."
---

# Contestacion y reconvencion

## Base legal (lee cada articulo con `get_article`)

- El tribunal notifica la demanda y fija plazo para contestar por escrito (Art. 222 Abs. 1 ZPO).
- La contestacion sigue las exigencias de la demanda y debe indicar que alegaciones se reconocen y cuales se niegan (Art. 222 Abs. 2).
- La reconvencion cabe en la contestacion si la pretension se decide por el mismo tipo de procedimiento (Art. 224 Abs. 1; lee Abs. 1bis).

## Pasos

1. Anota el plazo fijado por el tribunal; es judicial y puede pedirse prorroga antes de que venza (Art. 144 Abs. 2 ZPO).
2. Revisa excepciones procesales: competencia, legitimacion, cosa juzgada, prescripcion.
3. Contesta alegacion por alegacion: reconocida, negada con motivo concreto, o desconocida.
4. Anade hechos propios con su prueba y las peticiones.
5. Valora la reconvencion y sus costas.

## Reglas

- Una negacion global puede no bastar: contesta cada hecho.
- Comprueba la prescripcion (`forderung-verzug-verjaehrung`) antes de entrar al fondo.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Demanda.
- Plazo fijado.
- Documentos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Contestacion hecho por hecho. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Negacion global.
- Pedir prorroga despues de vencido.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
