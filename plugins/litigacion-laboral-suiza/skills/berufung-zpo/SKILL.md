---
name: berufung-zpo
description: "Prepara una Berufung civil suiza (Art. 308 ss. ZPO) en fases, desde la lectura critica de la sentencia hasta la verificacion de citas, con Berufungsantraege reformatorios y control de novedades. Usar con preparar apelacion, recurrir sentencia civil o Berufung."
---

# Berufung civil (ZPO)

## Requisitos previos

- Asunto abierto con `alta-asunto` y plazo calculado con `plazos-y-via`. Sin fecha de notificacion no se redacta: se pide primero.
- Texto integro de la sentencia con sus considerandos. Si solo se tiene el fallo, se dice y se limita el trabajo a una estimacion de riesgo.

## Fase 1. Lectura critica de la sentencia

1. Separa los fundamentos de la decision (ratio decidendi) de lo dicho de pasada. Una sentencia con dos fundamentos independientes solo cae si se atacan los dos.
2. Para cada fundamento anota: norma aplicada, hecho dado por probado, prueba en que se apoya.
3. Marca los puntos donde el tribunal se aparta de lo alegado o probado por las partes.

## Fase 2. Motivos

Art. 310 ZPO solo admite dos: aplicacion incorrecta del derecho y constatacion incorrecta de los hechos. Clasifica cada ataque en uno de los dos y redactalo asi:

- **Derecho**: cita la norma correcta, di donde se aparto el tribunal y que habria resultado de aplicarla bien.
- **Hechos**: nombra el hecho concreto, la prueba del expediente que lo contradice (documento y pagina) y por que la valoracion fue incorrecta. Una critica generica de la valoracion de la prueba no basta.

## Fase 3. Novedades

Cada hecho o prueba que no estuviera en primera instancia pasa por Art. 317 Abs. 1 ZPO: se invoca sin demora y no pudo aportarse antes pese a la diligencia razonable. Revisa tambien Art. 317 Abs. 1bis (investigacion de oficio) y Abs. 2 (cambio de demanda). Lee el texto con `get_article`. Presenta al usuario el riesgo de inadmision de cada novedad y no la des por admitida.

## Fase 4. Pretensiones

1. Genera los Berufungsantraege con `generate_rechtsbegehren`. La herramienta lee `objectives` (una frase por peticion, con importe e intereses tal como los quieres) y no solo `claims`; pasa tambien `procedure.remedy: "Berufung"` y `challengedAct.reference: "Urteil <tribunal>"` para que hable de "Urteil" y no de "Verfuegung". Una peticion que anula y condena puede ir en una sola frase: la herramienta emite la anulacion y la condena como dos peticiones y conserva el importe literal. Debe pedir una decision nueva sobre el fondo (por ejemplo condena a pagar una cifra exacta con intereses), no solo anular.
   - Escribe la devolucion como pretension subsidiaria ("Eventualiter ...", "Subsidiaer ...", "Hilfsweise ..."): asi la herramienta solo pide revisar la jerarquia (`requests_require_hierarchy_review`) y no avisa de contradiccion (`contradictory_requests`). Si el aviso aparece, falta decir que es subsidiaria.
   - La herramienta no infiere porcentajes de interes ni fechas: si faltan, queda en el texto lo que escribiste y tu marcas `[PENDIENTE]`.
2. Anade como subsidiario, si procede, la devolucion al tribunal inferior. Solo es posible si una parte esencial de la demanda no se juzgo o si los hechos hay que completarlos en partes esenciales (Art. 318 Abs. 1 lit. c Ziff. 1 y 2 ZPO); lee el articulo. La devolucion no es automatica y la segunda instancia puede decidir ella misma sobre el fondo (lit. b).
3. Si faltan datos de la pretension original (interes, fecha inicial), marcalos `[PENDIENTE]`. No los rellenes.

## Fase 5. Jurisprudencia

1. Busca con `search_federal_cases`, consultas cortas y de una en una (el portal va a ritmo lento). Usa como consultas y como filtro `chamber` lo que sugiere `case_law_plan` de `prepare_legal_council` (`suggested_queries`, `suggested_chambers`).
2. Lee con `fetch_official_swiss_case_full_text` solo las pocas sentencias que encajen.
3. Una ficha por sentencia: numero de expediente, fecha, regla aplicable, parrafo literal citable y hecho del asunto al que se ancla.
4. Cita solo sentencias que hayas leido. Cualquier otra, fuera.

## Fase 6. Redaccion

Orden del escrito: encabezamiento, Berufungsantraege, resumen del procedimiento, motivos de hecho, motivos de derecho, prueba nueva si la hay, costas. Una seccion, una funcion. Cada hecho con su documento. Cada sentencia conectada a un hecho concreto del asunto, no citada en abstracto.

## Fase 7. Control antes de entregar

1. `verify_quoted_passages` sobre cada cita literal.
2. `audit_legal_draft` sobre el escrito completo.
3. `prepare_legal_council` y `validate_legal_council` para comprobar el argumento desde cinco posiciones, con las sentencias leidas. Si el validador avisa `no_authorities_cited`, vuelve a la fase 5: el consejo no puede darse por completo sin jurisprudencia leida.
4. Costas: anticipo de costas judiciales (Art. 98 ZPO) y consecuencia del impago (Art. 101 ZPO).

## Salida

Borrador del escrito, tabla de plazos, lista de datos pendientes y lista de citas verificadas y no verificadas. Recuerda que es un borrador para revision de un abogado y no garantiza el resultado.

## Datos que hay que pedir

- Sentencia integra.
- Notificacion.
- Expediente de primera instancia.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Borrador con berufungsantraege, motivos y control. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Atacar un solo fundamento.
- Novedades sin justificar.
- Pedir solo anulacion.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
