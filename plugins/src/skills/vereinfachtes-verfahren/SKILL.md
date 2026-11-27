---
name: vereinfachtes-verfahren
description: "Maneja el procedimiento simplificado civil suizo: demanda simple, direccion del tribunal y hechos de oficio. Usar con procedimiento simplificado, vereinfachtes Verfahren o asuntos hasta 30000 francos."
---

# Procedimiento simplificado

## Base legal (lee cada articulo con `get_article`)

- Se aplica a litigios patrimoniales hasta CHF 30 000 y a ciertas materias sin importar la cuantia (Art. 243 ZPO).
- La demanda puede presentarse por escrito o de palabra en acta y contiene partes, peticion y objeto, entre otros datos (Art. 244 Abs. 1).
- El tribunal dispone lo necesario para resolver en la primera vista y puede ordenar escritos (Art. 246).
- El tribunal pregunta para completar hechos y prueba, y en las materias que fija la ley establece los hechos de oficio (Art. 247).

## Pasos

1. Confirma que el asunto entra en el procedimiento simplificado.
2. Redacta la demanda sencilla con peticion clara y documentos.
3. Prepara la vista: relato de cinco minutos, prueba disponible y respuestas probables.
4. Calcula recursos con `plazos-y-via`.

## Reglas

- La ayuda del tribunal no sustituye alegar y probar: reune la prueba igual.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Importe.
- Materia.
- Documentos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Demanda simple y relato oral. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Creer que el tribunal probara por la parte.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
