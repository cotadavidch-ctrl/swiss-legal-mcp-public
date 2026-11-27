---
name: zpo-beschwerde
description: "Prepara la Beschwerde civil suiza contra resoluciones no apelables y providencias, con el plazo correcto. Usar con ZPO Beschwerde, recurso contra auto o resolucion no apelable."
---

# Beschwerde civil (ZPO)

## Base legal (lee cada articulo con `get_article`)

- Son recurribles las resoluciones no apelables, otras resoluciones y providencias en los casos legales o si causan un perjuicio dificilmente reparable, y la demora injustificada (Art. 319 ZPO).
- Plazo de 30 dias desde la notificacion motivada; 10 dias en sumario y contra providencias; la demora puede recurrirse en cualquier momento (Art. 321).

## Pasos

1. Confirma que no cabe Berufung (Art. 308 ZPO).
2. Calcula el plazo con `ZPO_BESCHWERDE` o `ZPO_BESCHWERDE_10TAGE`.
3. Si es providencia, explica el perjuicio dificilmente reparable.
4. Formula quejas de derecho y, para los hechos, solo la constatacion manifiestamente incorrecta (verifica el Art. 320).

## Reglas

- Lee la instruccion de recursos y avisa si discrepa.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Resolucion.
- Notificacion.
- Tipo.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Borrador de queja. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Usar beschwerde donde cabe berufung.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
