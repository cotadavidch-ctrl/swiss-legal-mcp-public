---
name: vergleich-und-rueckzug
description: "Prepara una transaccion, allanamiento o desistimiento en un proceso civil suizo y explica sus efectos. Usar con acuerdo, transaccion, Vergleich, retirar la demanda o aceptar la demanda."
---

# Acuerdo, allanamiento y desistimiento

## Base legal (lee cada articulo con `get_article`)

- La transaccion, el allanamiento y el desistimiento que constan en acta se firman (Art. 241 Abs. 1 ZPO) y tienen el efecto de una resolucion firme (Abs. 2; lee el articulo).
- Costas segun el resultado y las reglas especiales (Art. 106).

## Pasos

1. Pide al usuario sus limites: minimo, maximo, plazos de pago y garantias.
2. Redacta clausulas claras: importe, fecha, consecuencia del impago, alcance del finiquito, costas y confidencialidad.
3. Compara con el escenario de seguir pleiteando, sin porcentajes inventados.
4. Advierte que el desistimiento puede impedir volver a plantear la pretension.

## Reglas

- No aceptes ni envies nada por el usuario.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Limites del usuario.
- Estado del pleito.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Texto de acuerdo y comparacion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Finiquito demasiado amplio.
- Olvidar costas.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
