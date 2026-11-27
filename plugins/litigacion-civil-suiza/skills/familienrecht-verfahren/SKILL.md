---
name: familienrecht-verfahren
description: "Maneja el procedimiento de familia suizo: proteccion de la union conyugal, divorcio, medidas provisionales y cuestiones de hijos, con los plazos de recurso de 30 dias y la investigacion de oficio. Usar con Eheschutz, divorcio, Scheidung, medidas provisionales, hijos o Unterhalt."
---

# Procedimiento de familia (ZPO)

## Base legal (lee cada articulo con `get_article`)

- **Proteccion de la union conyugal** (Eheschutz): procedimiento sumario para las medidas de los Art. 172 a 179 ZGB y otras medidas de proteccion de la union (Art. 271 ZPO).
- **Divorcio**: se inicia con una solicitud conjunta o con una demanda (Art. 274 ZPO). El tribunal decide tambien sobre sus consecuencias en la misma sentencia (Art. 283 Abs. 1); la liquidacion del regimen economico puede remitirse a otro procedimiento por motivos importantes (Abs. 2). En un acuerdo completo, el escrito conjunto debe llevar el acuerdo sobre las consecuencias y las peticiones conjuntas sobre los hijos (Art. 285).
- **Medidas provisionales** durante el divorcio: el tribunal adopta las necesarias; las del tribunal de proteccion de la union siguen vigentes y solo el tribunal del divorcio puede modificarlas (Art. 276 ZPO).
- **Hijos**: el tribunal investiga los hechos de oficio y decide sin quedar vinculado por las peticiones de las partes (Art. 296 ZPO). El nino es oido personalmente, salvo que su edad u otros motivos importantes lo impidan (Art. 298).

## Recursos y plazos

- **Berufung** contra decisiones sumarias de familia (Art. 271, 276, 302 y 305 ZPO): 30 dias para recurrir y 30 para responder, y la Anschlussberufung es admisible (Art. 314 Abs. 2 ZPO). Usa `compute_legal_deadline` con `ZPO_BERUFUNG` y `stillstandExempt: true` (sin suspension en el sumario), o con `ZPO_BERUFUNG_ANTWORT` y `stillstandExempt: true` para la respuesta.
- **Sentencia de divorcio** (procedimiento ordinario): Berufung de 30 dias con la suspension de verano, Pascua y Navidad; usa `stillstandExempt: false` solo si has confirmado que no es una decision sumaria.
- **Admisibilidad**: la exigencia de CHF 10 000 se refiere a asuntos patrimoniales (Art. 308 Abs. 2 ZPO). Las cuestiones sin valor economico, como la custodia, no la tienen.
- **Novedades**: cuando el tribunal de recurso investiga de oficio, admite hechos y pruebas nuevos hasta la deliberacion (Art. 317 Abs. 1bis ZPO). Lee el articulo: cambia el riesgo de inadmision frente a `berufung-zpo`.
- **Tribunal Federal**: el umbral del Art. 74 BGG se refiere a asuntos patrimoniales; para los demas, comprueba la admisibilidad en `beschwerde-bgg`.

## Pasos

1. Abre el asunto con `alta-asunto` (materia `civil`, subarea de familia). Anonimiza siempre los datos de menores con `geheimnis-und-anonymisierung`.
2. Identifica el procedimiento: Eheschutz, divorcio, medidas provisionales o cuestion de hijos. De eso depende si es sumario y cuanto dura el plazo.
3. Calcula los plazos con `plazos-y-via`, preguntando siempre si la decision es sumaria.
4. Reune los datos que el tribunal investigara de oficio: ingresos, gastos, vivienda, situacion de los hijos (`cronologia-y-prueba`).
5. Para el recurso, sigue `berufung-zpo` o `berufungsantwort` con los plazos de esta skill.

## Reglas

- No prometas custodia, alimentos ni resultado: el tribunal decide sin quedar ligado por las peticiones en las cuestiones de hijos.
- Si no sabes si la decision es sumaria u ordinaria, calcula con el plazo mas prudente y dilo.
- Es un borrador para revision de un abogado; en asuntos con menores, extrema la anonimizacion.

## Datos que hay que pedir

- Situacion familiar.
- Ingresos.
- Vivienda.
- Hijos.
- Decision recibida.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud o recurso con peticiones sobre hijos. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Tratar sumario como ordinario.
- Datos de menores sin anonimizar.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
