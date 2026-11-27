# Litigacion Laboral Suiza

Litigacion laboral suiza (OR, ZPO, BGG): despido, oposicion escrita y plazos, conciliacion, Berufung y recurso al Tribunal Federal con el umbral laboral.

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
- `arbeitsrecht-kuendigung`: Maneja un despido controvertido en derecho laboral suizo: oposicion escrita, indemnizacion por despido abusivo, conciliacion y demanda. Usar con Kuendigung, despido, Schlichtung o Arbeitsgericht.
- `berufung-zpo`: Prepara una Berufung civil suiza (Art. 308 ss. ZPO) en fases, desde la lectura critica de la sentencia hasta la verificacion de citas, con Berufungsantraege reformatorios y control de novedades. Usar con preparar apelacion, recurrir sentencia civil o Berufung.
- `berufungsantwort`: Prepara la respuesta a una Berufung civil suiza (Art. 312 ZPO) y la Anschlussberufung (Art. 313 ZPO) cuando la sentencia tambien perjudica al usuario. Usar con contestar apelacion, Berufungsantwort o recurso adhesivo.
- `beschwerde-bgg`: Prepara una Beschwerde ante el Tribunal Federal (BGG) en materia civil, penal o de derecho publico, con control de admisibilidad, plazo y deber de motivacion estricto. Usar con recurso al Tribunal Federal, Beschwerde in Zivilsachen, Strafsachen u oeffentlich-rechtlichen Angelegenheiten, o BGG.
- `lohnforderung`: Reclama salarios impagados en derecho suizo. Usar con sueldo no pagado, Lohnforderung, nomina o liquidacion final.
- `ueberstunden`: Calcula y reclama horas extra en derecho laboral suizo. Usar con horas extra, Ueberstunden o compensacion con tiempo libre.
- `ferien`: Resuelve derechos de vacaciones en derecho laboral suizo. Usar con vacaciones, Ferien, vacaciones no disfrutadas o pago de vacaciones.
- `krankheit-lohnfortzahlung`: Analiza el salario durante enfermedad o accidente. Usar con baja, enfermedad, certificado medico, Lohnfortzahlung o seguro de perdida de ganancia.
- `kuendigung-fristen-sperrfristen`: Calcula plazos de preaviso y periodos protegidos contra el despido. Usar con preaviso, Kuendigungsfrist, Sperrfrist, despido estando de baja o embarazo.
- `fristlose-kuendigung`: Analiza un despido o abandono inmediato por causa grave. Usar con despido inmediato, fristlose Kuendigung, me han echado hoy o abandono del puesto.
- `arbeitszeugnis`: Pide o corrige un certificado de trabajo. Usar con certificado de trabajo, Arbeitszeugnis o referencia negativa.
- `konkurrenzverbot`: Revisa una prohibicion de competencia tras el contrato. Usar con no competencia, Konkurrenzverbot o me prohiben trabajar para la competencia.
- `gleichstellung-diskriminierung`: Analiza una discriminacion por sexo en el trabajo. Usar con discriminacion salarial, acoso, Gleichstellungsgesetz o despido discriminatorio.
- `aufhebungsvertrag`: Revisa un acuerdo de extincion o finiquito. Usar con acuerdo de salida, Aufhebungsvertrag, finiquito o renuncia a reclamar.
- `arbeitsgericht-kosten`: Explica costas y reglas especiales de los pleitos laborales. Usar con cuanto cuesta demandar a mi empresa, Gerichtskosten o conciliacion laboral.
- `massenentlassung`: Revisa un despido colectivo. Usar con despido colectivo, Massenentlassung, ERE o plan social.
- `schlichtungsgesuch`: Prepara la solicitud de conciliacion previa y la vista ante la autoridad de conciliacion suiza. Usar con Schlichtungsgesuch, conciliacion, Friedensrichter o Klagebewilligung.
- `klage`: Redacta la demanda civil en procedimiento ordinario suizo con peticiones, valor litigioso, hechos y prueba ofrecida. Usar con demanda, Klage, presentar la demanda o Klageschrift.
- `klageantwort-widerklage`: Redacta la contestacion a la demanda civil suiza, hecho por hecho, y la reconvencion si procede. Usar con contestar demanda, Klageantwort, nos han demandado o Widerklage.
- `vereinfachtes-verfahren`: Maneja el procedimiento simplificado civil suizo: demanda simple, direccion del tribunal y hechos de oficio. Usar con procedimiento simplificado, vereinfachtes Verfahren o asuntos hasta 30000 francos.
- `beweis-und-noven`: Ordena la prueba civil suiza y controla hasta cuando se pueden alegar hechos nuevos o cambiar la demanda. Usar con prueba, Noven, hechos nuevos, ampliar la demanda o vorsorgliche Beweisfuehrung.
- `vergleich-und-rueckzug`: Prepara una transaccion, allanamiento o desistimiento en un proceso civil suizo y explica sus efectos. Usar con acuerdo, transaccion, Vergleich, retirar la demanda o aceptar la demanda.
- `prozesskosten-upr`: Estima costas y anticipos de un proceso civil suizo y prepara la solicitud de justicia gratuita. Usar con costas, Prozesskosten, anticipo, unentgeltliche Rechtspflege o justicia gratuita.
- `zpo-beschwerde`: Prepara la Beschwerde civil suiza contra resoluciones no apelables y providencias, con el plazo correcto. Usar con ZPO Beschwerde, recurso contra auto o resolucion no apelable.
- `forderung-verzug-verjaehrung`: Reclama una deuda en derecho suizo: requerimiento, mora, plazo suplementario, prescripcion y su interrupcion. Usar con reclamar deuda, Mahnung, mora, prescripcion o Verjaehrung.
- `vorsorgliche-massnahmen`: Prepara la solicitud de medidas cautelares civiles suizas, incluidas las urgentes sin oir a la otra parte, y su oposicion. Usar con medidas cautelares, vorsorgliche Massnahmen, superprovisorisch o prohibicion urgente.
- `arrest`: Valora y prepara un embargo preventivo (Arrest) en Suiza para asegurar una deuda. Usar con Arrest, embargo preventivo, el deudor se va o esconde bienes.
- `sozialversicherung-atsg`: Maneja un caso de seguros sociales suizo (ATSG): oposicion (Einsprache), recurso cantonal, informes medicos y deber de colaboracion. Usar con SUVA, AHV, IV, desempleo, Einsprache, aseguradora o Versicherungsgericht.
- `revision-zivil`: Valora la revision de una sentencia civil firme suiza por hechos o pruebas descubiertos despues. Usar con revision, sentencia firme, prueba nueva despues de firme.
- `vollstreckung`: Prepara la ejecucion de una resolucion civil suiza que no es de dinero, o encamina el cobro por la via de la SchKG. Usar con ejecutar sentencia, Vollstreckung, no cumplen la sentencia.
- `betreibung-schkg`: Maneja una Betreibung suiza: oposicion al requerimiento de pago, levantamiento de la oposicion y accion de reconocimiento. Usar con Zahlungsbefehl, Rechtsvorschlag, Rechtsoeffnung o SchKG.
- `rechtsschutz-klare-faelle`: Valora y prepara la tutela rapida en casos claros del procedimiento civil suizo. Usar con caso claro, Rechtsschutz in klaren Faellen o desahucio rapido.
