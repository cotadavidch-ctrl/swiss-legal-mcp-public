---
name: ehre-und-drohung
description: "Analiza insultos, amenazas y querellas relacionadas. Usar con injurias, insultos, amenazas, Beschimpfung o Drohung."
---

# Honor y amenazas

## Base legal (lee cada articulo con `get_article`)

- Insulto u otro ataque al honor, a querella (Art. 177 Abs. 1 StGB).
- Amenaza grave que causa alarma o miedo, a querella salvo los casos de oficio del Art. 180.

## Pasos

1. Conserva mensajes con fecha y origen (`conservacion-documentos`).
2. Calcula a mano el plazo de querella de tres meses.
3. Distingue critica protegida de ataque punible leyendo los tipos.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Mensajes.
- Fechas.
- Testigos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Querella o defensa. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Pasar el plazo de querella.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
