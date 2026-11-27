---
name: hoja-encargo
description: "Redacta la hoja de encargo o contrato de mandato entre abogado y cliente en derecho suizo. Usar con hoja de encargo, Mandatsvertrag, Vollmacht o aceptar un cliente."
---

# Hoja de encargo (Mandat)

## Base legal (lee cada articulo con `get_article`)

- Con el mandato, el mandatario se obliga a gestionar el asunto conforme al contrato (Art. 394 Abs. 1 OR) y debe rendir cuentas cuando se le pida y entregar lo recibido (Art. 400 Abs. 1 OR).
- El mandato puede revocarse o denunciarse en cualquier momento por cualquiera de las partes; si es en mal momento se indemniza el dano (Art. 404 OR).
- Reglas profesionales del abogado: diligencia, independencia y evitar conflictos de intereses, entre otras (Art. 12 BGFA).

## Pasos

1. Recoge: partes, objeto del mandato, lo que queda fuera, honorarios y gastos, anticipos, comunicacion, proteccion de datos y secreto, terminacion.
2. Comprueba conflictos de intereses antes de redactar y deja constancia.
3. Redacta el contrato y, aparte, el poder (Vollmacht) limitado al asunto.
4. Advierte de plazos urgentes ya conocidos y de que las costas pueden imponerse a la parte que pierde.

## Reglas

- No fijes honorarios ni porcentajes que el usuario no haya decidido; las reglas sobre pacto de cuota litis se verifican en la ley y en el reglamento del colegio.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Partes.
- Objeto.
- Exclusiones.
- Honorarios.
- Anticipos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Contrato de mandato y poder limitado. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- No comprobar conflictos.
- Objeto ambiguo.
- Olvidar la revocacion.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
