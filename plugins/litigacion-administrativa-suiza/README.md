# Litigacion Administrativa y Seguros Sociales Suiza

Litigacion administrativa suiza y de seguros sociales (VwVG, ATSG, BGG): recurso administrativo federal, Einsprache y recurso cantonal, y recurso al Tribunal Federal.

Autoria: texto propio, escrito para este proyecto. No deriva de ningun plugin de terceros.

## Principios comunes a todas las skills

1. Todo dato juridico (articulo, plazo, sentencia) sale de una herramienta de swiss-legal-mcp. Si la herramienta no responde o no encuentra el dato, se dice y se marca `[PENDIENTE DE VERIFICAR]`. Nunca se completa de memoria.
2. Los hechos llevan estado: `accepted`, `alleged`, `disputed` o `unknown`. Un hecho `unknown` o `alleged` no se usa como establecido.
3. Nada de datos identificables en consultas a servicios externos: nombres, direcciones y numeros de expediente se sustituyen por CLIENTE_1, PARTE_CONTRARIA_1, etc. La tabla de equivalencias queda fuera de las carpetas conectadas.
4. El resultado es un borrador para revision de una persona habilitada. No es asesoramiento juridico ni garantia de resultado.

## Estados de hechos en cada herramienta
Cada herramienta usa sus propios nombres. Al llamarlas, traduce asi:

| Estado de la skill | `analyze_procedural_strategy` | `generate_rechtsbegehren` | consejo (`prepare_legal_council`) |
|---|---|---|---|
| accepted | `accepted` | `confirmed` | `accepted` |
| alleged | `alleged` | `user_asserted` | `alleged` |
| disputed | `disputed` | `disputed` | `disputed` |
| unknown | `uncertain` | `uncertain` | `unknown` |

## Skills
- `alta-asunto`: Abre un asunto de derecho suizo. Recoge hechos con estado, la resolucion impugnada, la fecha de notificacion y lo que falta, y guarda el asunto con create_or_update_matter. Usar con nuevo asunto, abrir caso o alta del asunto.
- `cronologia-y-prueba`: Construye la cronologia de un asunto suizo con la fuente de cada evento y un cuadro hecho-prueba que muestra que hechos tienen soporte documental y cuales no. Usar con cronologia, cuadro de prueba o que puedo probar.
- `plazos-y-via`: Determina la via procesal suiza y calcula el plazo con base legal usando compute_legal_deadline y analyze_procedural_strategy, con la fecha de notificacion como dato critico. Usar con plazo de recurso, que recurso procede o cuando vence.
- `revision-citas`: Revisa todas las citas de un escrito suizo antes de presentarlo con las herramientas de swiss-legal-mcp y entrega un informe de lo verificado, lo alterado y lo pendiente. Usar con revisar citas, comprobar el escrito o antes de presentar.
- `geheimnis-und-anonymisierung`: Protocolo de secreto profesional y anonimizacion antes de usar documentos de un asunto con herramientas externas, segun el derecho suizo. Usar con anonimizar, secreto profesional, datos de clientes o proteccion de datos.
- `triage-gerichtspost`: Clasifica una comunicacion recibida de un tribunal o autoridad suiza, extrae fechas y plazos y propone la actuacion. Usar con me ha llegado una carta del tribunal, citacion, Verfuegung, Fristansetzung o Strafbefehl.
- `actualizar-asunto`: Anota un hecho nuevo en un asunto abierto: notificacion, escrito, llamada, pago o resolucion, y revisa que plazos y riesgos cambian. Usar con anota en el asunto, ha pasado algo o actualiza el asunto.
- `briefing-asunto`: Resume el estado de un asunto: posiciones, hechos, prueba, plazos, riesgos y decisiones pendientes. Usar con ponme al dia, briefing del asunto o donde estamos.
- `cartera-asuntos`: Muestra el estado de todos los asuntos abiertos con sus plazos proximos y riesgos. Usar con mis asuntos, cartera, que tengo abierto o que vence esta semana.
- `cerrar-asunto`: Cierra un asunto: resultado, plazos que quedan vivos, documentos que se conservan y lecciones. Usar con cerrar asunto, asunto terminado o archivar.
- `configuracion-despacho`: Configura el perfil de trabajo: quien usa las skills, en que cantones, idiomas, materias, reglas de anonimizacion y formato de entregables. Usar con configurar, primer uso o cambiar mi perfil.
- `perfil-estilo`: Aprende el estilo de redaccion del usuario a partir de escritos propios y lo aplica a los borradores. Usar con mi estilo, aprende como escribo o aplica mi estilo.
- `redactor-seccion`: Redacta una sola seccion de un escrito suizo (hechos, derecho, peticiones, pruebas, costas) con sus fuentes. Usar con redacta los hechos, redacta este fundamento o saca los Rechtsbegehren.
- `subsuncion-juridica`: Revisa que cada norma y sentencia citada este conectada con un hecho concreto y una prueba del asunto. Usar con pulir escrito, conectar derecho con hechos o subsuncion.
- `preparacion-interrogatorio`: Prepara el interrogatorio de partes, testigos y peritos ante un tribunal suizo, con los documentos que los contradicen. Usar con preparar vista, interrogatorio, testigos o Beweisabnahme.
- `hoja-encargo`: Redacta la hoja de encargo o contrato de mandato entre abogado y cliente en derecho suizo. Usar con hoja de encargo, Mandatsvertrag, Vollmacht o aceptar un cliente.
- `conservacion-documentos`: Prepara la instruccion al cliente sobre que documentos y datos conservar y cuales pedir en un asunto suizo. Usar con que tengo que guardar, conservar pruebas o pedir documentos.
- `seguimiento-externos`: Prepara borradores de seguimiento a peritos, traductores, aseguradoras de defensa juridica y colegas que colaboran en un asunto. Usar con estado a colaboradores, escribe al perito o seguimiento.
- `verwaltungsbeschwerde-vwvg`: Prepara una Beschwerde administrativa federal (VwVG) contra una resolucion de una autoridad federal, con plazo y denegacion o retraso injustificado. Usar con recurso administrativo, Verfuegung federal o VwVG.
- `sozialversicherung-atsg`: Maneja un caso de seguros sociales suizo (ATSG): oposicion (Einsprache), recurso cantonal, informes medicos y deber de colaboracion. Usar con SUVA, AHV, IV, desempleo, Einsprache, aseguradora o Versicherungsgericht.
- `beschwerde-bgg`: Prepara una Beschwerde ante el Tribunal Federal (BGG) en materia civil, penal o de derecho publico, con control de admisibilidad, plazo y deber de motivacion estricto. Usar con recurso al Tribunal Federal, Beschwerde in Zivilsachen, Strafsachen u oeffentlich-rechtlichen Angelegenheiten, o BGG.
- `verfuegung-und-gehoer`: Revisa si una resolucion administrativa federal cumple requisitos y si se respeto el derecho a ser oido. Usar con me han dictado una resolucion, derecho de audiencia, rechtliches Gehoer o Verfuegung defectuosa.
- `akteneinsicht-verwaltung`: Pide y analiza el expediente administrativo federal. Usar con consultar el expediente, Akteneinsicht o no me ensenan los documentos.
- `beschwerdebefugnis-und-ruegen`: Comprueba legitimacion, motivos y forma de un recurso administrativo federal. Usar con puedo recurrir, legitimacion, que puedo alegar o contenido del recurso.
- `aufschiebende-wirkung-massnahmen`: Gestiona el efecto suspensivo y las medidas provisionales en un recurso administrativo federal. Usar con suspender la resolucion, efecto suspensivo, aufschiebende Wirkung o medidas provisionales.
- `wiedererwaegung-revision`: Valora reconsideracion y revision de resoluciones administrativas federales. Usar con reconsideracion, Wiedererwaegung, revision o pruebas nuevas despues de decidir.
- `kosten-upr-verwaltung`: Estima costas, indemnizacion y asistencia gratuita en un recurso administrativo federal. Usar con costas del recurso administrativo, gastos o asistencia gratuita.
- `kantonales-verwaltungsverfahren`: Localiza el procedimiento administrativo cantonal aplicable y prepara el recurso cantonal. Usar con recurso cantonal, Rekurs, autoridad cantonal o municipal.
- `subsidiaere-verfassungsbeschwerde`: Valora el recurso constitucional subsidiario ante el Tribunal Federal. Usar con recurso constitucional subsidiario, Verfassungsbeschwerde o no cabe el recurso ordinario.
- `staatshaftung-bund`: Analiza una reclamacion de danos contra la Confederacion por actos de sus funcionarios. Usar con danos causados por la administracion federal, Staatshaftung o responsabilidad del Estado.
- `rueckforderung-sozialversicherung`: Responde a una peticion de devolucion de prestaciones de un seguro social. Usar con me piden devolver dinero, Rueckforderung, remision o Erlass.
- `atsg-revision-wiedererwaegung`: Pide la revision o reconsideracion de una decision firme de un seguro social. Usar con decision firme de la SUVA o IV, informes nuevos o reconsideracion.
- `arbeitslosenversicherung`: Defiende una suspension de prestaciones del seguro de desempleo suizo. Usar con desempleo, RAV, dias de suspension o Einstelltage.
- `invalidenversicherung`: Analiza un caso del seguro de invalidez suizo. Usar con IV, renta de invalidez, grado de invalidez o integracion.
- `steuer-einsprache`: Impugna una tasacion del impuesto federal directo. Usar con impuestos, Veranlagung, Steuer Einsprache o Hacienda suiza.
- `migration-bewilligung`: Defiende un asunto de permiso de extranjeria. Usar con permiso de residencia, Aufenthaltsbewilligung, revocacion o expulsion.
- `bau-einsprache`: Prepara una oposicion o recurso en materia de construccion. Usar con licencia de obra, Baubewilligung, Baueinsprache o vecino que construye.
- `zwischenverfuegungen`: Decide si una resolucion incidental administrativa puede o debe recurrirse ya. Usar con resolucion incidental, Zwischenverfuegung, competencia o recusacion.
- `rechtsverweigerung`: Reacciona cuando una autoridad o aseguradora no resuelve. Usar con no contestan, retraso, Rechtsverweigerung o Rechtsverzoegerung.
