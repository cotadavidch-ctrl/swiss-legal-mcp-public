---
name: erste-einvernahme
description: "Prepara la primera declaracion como investigado y controla las advertencias obligatorias. Usar con me citan a declarar, primer interrogatorio, Einvernahme o policia."
---

# Primera declaracion

## Base legal (lee cada articulo con `get_article`)

- Al inicio de la primera declaracion se informa en una lengua comprensible del procedimiento y los hechos, del derecho a no declarar ni colaborar, a un defensor y a un interprete (Art. 158 Abs. 1 StPO). Sin esas advertencias la declaracion no es utilizable (Abs. 2).
- En declaraciones policiales el investigado tiene derecho a que su defensa este presente y pregunte (Art. 159 Abs. 1).

## Pasos

1. Aclara citacion, condicion y hechos.
2. Recomienda consultar defensor antes de declarar.
3. Prepara la lista de derechos y de documentos que no entregar sin consejo.
4. Anota despues como se hizo la declaracion.

## Reglas

- No sugieras que declarar ni como mentir: la decision es del investigado con su defensor.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Citacion.
- Hechos.
- Defensor.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Guia de derechos. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Sugerir contenidos de la declaracion.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
