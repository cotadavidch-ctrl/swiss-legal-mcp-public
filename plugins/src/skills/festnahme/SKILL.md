---
name: festnahme
description: "Actua ante una detencion policial: requisitos, derechos y aviso a la fiscalia. Usar con me han detenido, arresto, vorlaeufige Festnahme o policia se lo llevo."
---

# Detencion provisional

## Base legal (lee cada articulo con `get_article`)

- La policia detiene a quien sorprende en flagrante crimen o delito o inmediatamente despues, y a quien esta en busca (Art. 217 Abs. 1 StPO; lee los demas supuestos).
- Tras detener identifica, informa en lengua comprensible de los motivos y de los derechos del Art. 158 y avisa sin demora a la fiscalia (Art. 219 Abs. 1).

## Pasos

1. Anota hora exacta de la detencion: de ella corren los plazos de la prision preventiva (`untersuchungshaft`).
2. Comprueba informacion de derechos e interprete.
3. Pide defensor (`verteidigung`) y recomienda no declarar sin consejo.

## Reglas

- Urgente: indica contactar con un abogado penalista de guardia.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Hora.
- Lugar.
- Motivo.
- Informacion de derechos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Lista de actuaciones urgentes. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Declarar sin defensa.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
