---
name: cronologia-y-prueba
description: "Construye la cronologia de un asunto suizo con la fuente de cada evento y un cuadro hecho-prueba que muestra que hechos tienen soporte documental y cuales no. Usar con cronologia, cuadro de prueba o que puedo probar."
---

# Cronologia y cuadro de prueba

## Entrada

El asunto abierto con `alta-asunto` (`asuntos/<slug>/asunto.md`) y los documentos de la carpeta del asunto. Si no hay asunto, ejecuta primero `alta-asunto`.

## Cronologia

1. Lee los documentos y extrae cada evento con fecha: contrato, aviso, carta, resolucion, notificacion, recurso.
2. Escribe `asuntos/<slug>/cronologia.md` como tabla: fecha | evento | documento y pagina | estado del hecho.
3. Marca en la tabla:
   - **Hueco**: periodo largo sin evento que importa para un plazo o una prescripcion.
   - **Contradiccion**: dos documentos que dan fechas o cifras distintas para lo mismo. Cita ambos literalmente.
   - **Fecha sin prueba**: evento que solo consta por afirmacion de una parte.
4. Las fechas de plazo no se calculan aqui: se derivan a `plazos-y-via`.

## Cuadro de prueba

1. Por cada hecho relevante para las pretensiones, anota: hecho | quien lo afirma | documentos que lo sostienen | carga de la prueba (quien debe probarlo segun la norma) | cobertura (`suficiente`, `parcial`, `ninguna`).
2. Para el articulo que fija la carga de la prueba, usa `get_article` y cita el texto literal. Si no puedes verificarlo, `[PENDIENTE DE VERIFICAR]`.
3. Llama a `build_evidence_index` con los documentos para dejar un indice reproducible.
4. Escribe `asuntos/<slug>/prueba.md` y termina con tres listas cortas: hechos sin prueba, documentos que no sostienen ningun hecho, y pruebas que habria que obtener (peritaje, testigos, informes).

## Reglas

- Cada fila lleva documento y pagina o parrafo. Sin fuente no hay fila.
- No conviertas una afirmacion de parte en hecho probado.
- Indica sin suavizar las contradicciones que perjudican al usuario: son las que mas importan.
- Para la parte contraria, usa solo lo que consta en sus documentos; no supongas su version.

## Datos que hay que pedir

- Documentos con fecha.
- Hechos discutidos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Cronologia.md y prueba.md. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Eventos sin fuente.
- Ocultar contradicciones.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
