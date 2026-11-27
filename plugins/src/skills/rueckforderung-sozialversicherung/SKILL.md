---
name: rueckforderung-sozialversicherung
description: "Responde a una peticion de devolucion de prestaciones de un seguro social. Usar con me piden devolver dinero, Rueckforderung, remision o Erlass."
---

# Devolucion de prestaciones (ATSG)

## Base legal (lee cada articulo con `get_article`)

- Las prestaciones cobradas indebidamente se devuelven; quien las recibio de buena fe no devuelve si le causaria una situacion muy dificil (Art. 25 Abs. 1 ATSG).
- El derecho a reclamar caduca en los plazos del Abs. 2 (leelos).

## Pasos

1. Separa dos cuestiones: si la devolucion procede y si cabe la remision por buena fe y dificultad grave.
2. Comprueba plazos de caducidad y calculo del importe.
3. Impugna con `sozialversicherung-atsg` y prepara la solicitud de remision.

## Reglas

- No afirmes buena fe sin los hechos.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Decision.
- Pagos.
- Situacion economica.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Impugnacion y remision. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Mezclar impugnacion y remision.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
