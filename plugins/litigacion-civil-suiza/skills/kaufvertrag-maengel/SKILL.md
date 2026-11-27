---
name: kaufvertrag-maengel
description: "Analiza defectos en una compraventa suiza: examen, aviso, garantia y prescripcion. Usar con producto defectuoso, compraventa, Maengel, garantia o Gewaehrleistung."
---

# Defectos en la compraventa

## Base legal (lee cada articulo con `get_article`)

- El comprador examina la cosa en cuanto sea posible y avisa inmediatamente de los defectos (Art. 201 Abs. 1 OR); si no, se tiene por aceptada salvo defectos no reconocibles (Abs. 2); los que aparecen despues se avisan al descubrirlos (Abs. 3).
- Cosas integradas en una obra inmueble que causan sus defectos: aviso en 60 dias (Art. 201 Abs. 4).
- La accion de garantia prescribe a los dos anos desde la entrega, salvo plazos mayores o excepciones del articulo (Art. 210; leelo completo).

## Pasos

1. Fija entrega, descubrimiento y aviso, con prueba.
2. Revisa clausulas de exclusion de garantia y el dolo (Art. 199 y 210; verificalos).
3. Elige entre las acciones de la ley y cuantifica con documentos.
4. Controla la prescripcion y como interrumpirla.

## Reglas

- No des por valida una exclusion de garantia sin leer la clausula.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Contrato.
- Entrega.
- Descubrimiento.
- Clausulas.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Analisis y carta de aviso. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Avisar tarde.
- Ignorar exclusion de garantia.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
