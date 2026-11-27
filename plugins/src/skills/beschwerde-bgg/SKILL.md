---
name: beschwerde-bgg
description: "Prepara una Beschwerde ante el Tribunal Federal (BGG) en materia civil, penal o de derecho publico, con control de admisibilidad, plazo y deber de motivacion estricto. Usar con recurso al Tribunal Federal, Beschwerde in Zivilsachen, Strafsachen u oeffentlich-rechtlichen Angelegenheiten, o BGG."
---

# Beschwerde ante el Tribunal Federal

## Requisitos previos

- Asunto abierto con `alta-asunto` y plazo calculado con `plazos-y-via` (`BGG_BESCHWERDE`).
- La sentencia cantonal completa. Sin la fecha de notificacion del texto integro no hay plazo calculable.

## Rama del recurso

Identifica primero la rama; cada una tiene sus reglas de admisibilidad:

- **Civil**: Art. 72 ss. BGG (esta skill detalla el umbral de valor litigioso).
- **Penal**: Art. 78 BGG (decisiones en materia penal, incluidas las acciones civiles que se tratan con la causa y la ejecucion de penas), con ultimas instancias cantonales segun el Art. 80. No rige el umbral de valor litigioso del Art. 74.
- **Derecho publico** (incluidos seguros sociales y fiscal): Art. 82 BGG, con las excepciones del Art. 83 y las instancias previas del Art. 86. Comprueba antes que la decision no entre en una excepcion del Art. 83.
  Lee el texto de cada articulo con `get_article`. Si la rama no es la civil, lo que sigue sobre umbrales no se aplica; el plazo lo calcula `compute_legal_deadline`.

## Admisibilidad civil (compruebala antes de redactar, cada punto con `get_article`)

1. **Instancia**: la Beschwerde cabe contra decisiones de la ultima instancia cantonal (Art. 75 BGG). Si queda un recurso cantonal, hay que agotarlo antes.
2. **Decision final** (Art. 90 BGG) o, si es incidental, que la ley la admita expresamente.
3. **Valor litigioso** en asuntos patrimoniales (Art. 74 BGG): CHF 15 000 en materia laboral y de alquiler, CHF 30 000 en los demas casos. Si no se alcanza, solo cabe si hay una cuestion juridica de principio u otro supuesto del Art. 74 Abs. 2. Calcula el valor sobre las ultimas pretensiones mantenidas.
4. **Plazo**: 30 dias desde la notificacion de la sentencia integra (Art. 100 Abs. 1 BGG); 10 dias en los supuestos del Abs. 2. Usa `compute_legal_deadline`.

## Motivos y deber de motivacion

- Se puede alegar violacion de derecho federal, derecho internacional y derechos constitucionales cantonales (Art. 95 BGG). El Tribunal aplica el derecho de oficio (Art. 106 Abs. 1), pero examina derechos fundamentales y derecho cantonal solo si la queja esta formulada y motivada (Art. 106 Abs. 2).
- Los hechos los fija la instancia anterior (Art. 105 Abs. 1). Solo se pueden atacar si son manifiestamente incorrectos o resultan de una violacion de derecho, y si la correccion puede cambiar el resultado (Art. 97 Abs. 1). Una critica generica de la valoracion de la prueba no basta: nombra el hecho, la prueba y por que la conclusion es arbitraria.
- El escrito debe explicar de forma concisa en que se vulnera el derecho (Art. 42 Abs. 2 BGG). Un escrito que repite lo dicho en la apelacion sin atacar la sentencia cantonal se arriesga a la inadmision.
- No se puede basar el recurso en hechos nuevos salvo lo que la ley permita; no des por buena una prueba nueva y avisa del riesgo.

## Pasos

1. Lee la sentencia cantonal y separa los fundamentos de la decision. Todos los fundamentos independientes deben atacarse.
2. Clasifica cada queja: derecho federal, hechos manifiestamente incorrectos, derechos fundamentales (con motivacion reforzada).
3. Pretensiones con `generate_rechtsbegehren` (`procedure.remedy: "Beschwerde"`): normalmente reforma de la sentencia o anulacion y devolucion.
4. Jurisprudencia (filtro `chamber` segun `case_law_plan.suggested_chambers`): solo sentencias leidas (`search_federal_cases`, `fetch_official_swiss_case_full_text`), con ficha y parrafo literal.
5. Control: `verify_quoted_passages`, `audit_legal_draft`, `revision-citas`.

## Salida

Borrador, tabla de admisibilidad con cada punto verificado o pendiente, plazo y datos que faltan. Borrador para revision de un abogado; no garantiza resultado.

## Datos que hay que pedir

- Sentencia cantonal.
- Valor litigioso.
- Rama.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Borrador y tabla de admisibilidad. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Repetir la apelacion.
- Hechos sin arbitrariedad.
- Derechos sin motivar.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
