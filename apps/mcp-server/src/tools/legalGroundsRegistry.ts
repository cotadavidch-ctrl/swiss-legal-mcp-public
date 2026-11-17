/**
 * Base de conocimiento VERIFICADA de motivos que las resoluciones suelen invocar.
 *
 * Cada entrada recoge lo que dicen la ley o la jurisprudencia sobre un tipo de motivo, con el TEXTO
 * LITERAL de la fuente, su identificador exacto y la fecha en que se leyo. Regla de la casa: no
 * entra nada que no se haya leido en la fuente; lo que solo conocemos de oidas (p. ej. una sentencia
 * citada por otra) se marca "no verificado en la fuente oficial".
 *
 * Una entrada se ACTIVA cuando la resolucion contiene senales de ese motivo (cue). Entonces se
 * entrega al modelo junto a las frases afectadas y las comprobaciones que debe hacer. La entrada
 * NO concluye que la resolucion este mal: aporta lo verificado para que se compare.
 *
 * Para anadir una entrada: leer la fuente (Fedlex, portal del tribunal), copiar los extractos tal
 * cual, anotar la fecha y, si es un archivo, su hash. Los tests comprueban que los extractos no
 * estan vacios y que cada fuente tiene identificador y fecha.
 */

export type SourceKind = "statute" | "court_decision" | "cited_by_court";

export interface GroundSource {
  readonly kind: SourceKind;
  /** Identificador exacto: articulo y SR, o tribunal, numero y fecha. */
  readonly identifier: string;
  /** Extracto LITERAL de la fuente. */
  readonly excerpt: string;
  readonly verifiedOn: string;
  /** Como se verifico (p. ej. "Fedlex" o "PDF del tribunal, sha256 ..."). */
  readonly verifiedFrom: string;
}

export interface LegalGround {
  readonly id: string;
  readonly topic: string;
  readonly jurisdiction: string;
  /** Senales en el texto de la resolucion que activan la entrada. */
  readonly cue: RegExp;
  /** Donde buscar la senal: "header" = primeros 900 caracteres; "anywhere" = todo el texto. */
  readonly cueScope: "header" | "anywhere";
  readonly summary: string;
  readonly sources: readonly GroundSource[];
  readonly whatToCheck: readonly string[];
  readonly caveats: readonly string[];
}

const TODAY = "2026-11-13";
const FEDLEX = "Fedlex, texto vigente leído el 2026-11-13";
const AR_PDF =
  "PDF de la sentencia (AR_OG_004_O4V-21-28), sha256 1d398288ea1a210f232a9574fc0ad602063dbc38ee39681ebc08bf768b39a248";

export const LEGAL_GROUNDS: readonly LegalGround[] = [
  {
    id: "competence-delegation",
    topic: "Competencia de la autoridad que decide (servicio u oficina en lugar de la autoridad)",
    jurisdiction:
      "Cantón de Appenzell Ausserrhoden (SHG AR); el principio de legalidad de la competencia es general",
    cue: /Sozialdienst|Soziale\s+Dienste|Sozialamt|Fachstelle|Dienststelle|Leitung\s+\w*\s*(?:Dienst|Amt)|Leiter(?:in)?\s+(?:des\s+)?(?:Sozial)?(?:amt|dienst)|service\s+social|office\s+de/i,
    cueScope: "header",
    summary:
      "Según el Obergericht de Appenzell Ausserrhoden, un servicio social no tiene competencia originaria para dictar resoluciones de ayuda social: necesita una delegación de la autoridad municipal de ayuda social con base en la Gemeindeordnung u otro reglamento comunal, y un manual interno no basta.",
    sources: [
      {
        kind: "court_decision",
        identifier:
          "Obergericht Appenzell Ausserrhoden, 4. Abteilung, Urteil vom 28. April 2022 (O4V 21 28), E. 4.3",
        excerpt:
          "Aus dem Sozialhilfegesetz ergibt sich im Weiteren keine originäre Verfügungskompetenz der SDAM, auch wenn diese nach Art. 9 Abs. 3 lit. e SHG für die Geltendmachung von Rückerstattungen verantwortlich ist. Art. 8 Abs. 4 und Art. 33 Abs. 2 SHG implizieren vielmehr ausdrücklich, dass es für Verfügungen der SDAM einer Kompetenzdelegation der zuständigen Gemeinde [...] bedarf.",
        verifiedOn: TODAY,
        verifiedFrom: AR_PDF,
      },
      {
        kind: "court_decision",
        identifier:
          "Obergericht Appenzell Ausserrhoden, Urteil vom 28. April 2022 (O4V 21 28), E. 4.4",
        excerpt:
          "Eine Kompetenzdelegation im Sinne von Art. 8 Abs. 4 SHG an die SDAM anstelle der Sozialhilfebehörde bedarf daher in der Gemeinde H. einer Grundlage in der Gemeindeordnung oder allenfalls einem anderen Gemeindereglement.",
        verifiedOn: TODAY,
        verifiedFrom: "PDF de la sentencia, mismo archivo y hash",
      },
      {
        kind: "court_decision",
        identifier:
          "Obergericht Appenzell Ausserrhoden, Urteil vom 28. April 2022 (O4V 21 28), E. 4.4 (final)",
        excerpt:
          "Entgegen der Auffassung der SDAM genügt eine bloss auf internen Verwaltungsweisungen vorgenommene Zuständigkeitsübertragung nicht (BGE 129 V 485 E. 2.2)",
        verifiedOn: TODAY,
        verifiedFrom: "PDF de la sentencia, mismo archivo y hash",
      },
      {
        kind: "court_decision",
        identifier:
          "Obergericht Appenzell Ausserrhoden, Urteil vom 28. April 2022 (O4V 21 28), E. 4.4 (conclusión)",
        excerpt:
          "Infolgedessen muss der Schluss gezogen werden, dass der SDAM aufgrund fehlender rechtsgenüglicher Kompetenzübertragung vorliegend keine Verfügungskompetenz zukam, womit eine sachlich und funktionell unzuständige Behörde die Verfügung [...] erliess.",
        verifiedOn: TODAY,
        verifiedFrom: "PDF de la sentencia, mismo archivo y hash",
      },
      {
        kind: "statute",
        identifier: "Art. 8 Abs. 3 und 4 SHG AR (bGS 851.1)",
        excerpt:
          "Die Sozialhilfebehörde ist ferner zuständig für a) die Anordnung von konkreten Massnahmen, b) die Festsetzung und Gewährung von Leistungen. 4 Die Gemeinde kann die Kompetenzen nach Abs. 3 ganz oder teilweise an den Sozialdienst delegieren.",
        verifiedOn: TODAY,
        verifiedFrom: "Fuente cantonal oficial (ar.clex.ch), versión vigente leída el 2026-11-13",
      },
      {
        kind: "statute",
        identifier: "Art. 9 Abs. 3 lit. f SHG AR (bGS 851.1)",
        excerpt:
          "f) die Antragstellung an die Sozialhilfebehörde, soweit Verfügungen zu treffen sind.",
        verifiedOn: TODAY,
        verifiedFrom: "Fuente cantonal oficial (ar.clex.ch), versión vigente leída el 2026-11-13",
      },
      {
        kind: "statute",
        identifier: "Art. 33 Abs. 2 SHG AR (bGS 851.1)",
        excerpt:
          "Soweit die Gemeinde Kompetenzen an den Sozialdienst delegiert hat, ist gegen Verfügungen des Sozialdienstes der Rekurs an die Sozialhilfebehörde gegeben.",
        verifiedOn: TODAY,
        verifiedFrom: "Fuente cantonal oficial (ar.clex.ch), versión vigente leída el 2026-11-13",
      },
      {
        kind: "statute",
        identifier: "Art. 4 Abs. 1 GG AR (bGS 151.11)",
        excerpt:
          "Die Gemeinden legen ihre Organisation im Rahmen von Verfassung und Gesetz in der Gemeindeordnung fest.",
        verifiedOn: TODAY,
        verifiedFrom: "Fuente cantonal oficial (ar.clex.ch), versión vigente leída el 2026-11-13",
      },
      {
        kind: "cited_by_court",
        identifier: "BGE 129 V 485 E. 2.2",
        excerpt:
          "(citada por el Obergericht en la sentencia anterior; NO leída en la fuente oficial)",
        verifiedOn: TODAY,
        verifiedFrom: "no verificado en la fuente oficial: solo consta como cita del Obergericht",
      },
    ],
    whatToCheck: [
      "¿Quién firma y dicta la resolución: la autoridad municipal o cantonal de ayuda social, o un servicio, oficina o dirección?",
      "Si dicta un servicio u oficina, ¿cita la resolución la delegación que le da competencia (reglamento comunal, Gemeindeordnung, convenio intercomunal)? ¿Está en un acto formal y publicado, o solo en un manual o instrucción interna?",
      "¿La delegación proviene de la autoridad competente? Una comuna sede no puede delegar más de lo que le atribuye el convenio.",
      "¿La resolución indica a qué instancia se recurre y es coherente con quién la dictó?",
    ],
    caveats: [
      "La sentencia es del cantón de Appenzell Ausserrhoden y aplica su Sozialhilfegesetz (bGS 851.1). En otro cantón decide su propia ley y su organización comunal: compruebe la ley cantonal aplicable.",
      "Esta herramienta no lee derecho cantonal ni comprueba si la sentencia sigue vigente: confirme que no hay cambios legales o jurisprudencia posterior.",
      "La entrada no afirma que la resolución analizada sea incompetente: solo aporta lo que el tribunal exigió.",
    ],
  },
  {
    id: "residence-duration-ground",
    topic: "Denegación por una duración mínima de estancia o residencia en Suiza",
    jurisdiction: "Derecho federal (ZUG, AIG, AsylG); el derecho cantonal puede regular más",
    cue: /(?:seit|nach|innert)\s+(?:weniger|mindestens|lediglich|erst)\s+(?:als\s+)?(?:\w+\s+)?(?:Jahre|Jahr|Monate|Monat)|Wohnsitzdauer|Aufenthaltsdauer|Karenzfrist|Mindestaufenthalt|Mindestwohn|(?:zwei|drei|fünf|zehn|2|3|5|10)\s+Jahre\s+(?:in\s+der\s+Schweiz|Wohnsitz|Aufenthalt)|moins\s+de\s+\w+\s+ans|durée\s+(?:minimale\s+)?de\s+(?:séjour|résidence)/i,
    cueScope: "anywhere",
    summary:
      "En las normas federales leídas, el domicilio de asistencia nace de vivir en el cantón 'con la intención de permanencia' y se tiene por constituido con el registro de residencia: no fijan un número de años de estancia como requisito de la ayuda. Las excepciones federales son específicas por estatus (EU/EFTA tras perder el empleo, rechazados de asilo).",
    sources: [
      {
        kind: "statute",
        identifier: "Art. 4 Abs. 1 und 2 ZUG (SR 851.1)",
        excerpt:
          "Der Bedürftige hat seinen Wohnsitz nach diesem Gesetz (Unterstützungswohnsitz) in dem Kanton, in dem er sich mit der Absicht dauernden Verbleibens aufhält. Dieser Kanton wird als Wohnkanton bezeichnet. Die polizeiliche Anmeldung, für Ausländer die Ausstellung einer Anwesenheitsbewilligung, gilt als Wohnsitzbegründung, wenn nicht nachgewiesen ist, dass der Aufenthalt schon früher oder erst später begonnen hat oder nur vorübergehender Natur ist.",
        verifiedOn: TODAY,
        verifiedFrom: FEDLEX,
      },
      {
        kind: "statute",
        identifier: "Art. 12 Abs. 1 ZUG (SR 851.1)",
        excerpt: "Die Unterstützung der Schweizer Bürger obliegt dem Wohnkanton.",
        verifiedOn: TODAY,
        verifiedFrom: FEDLEX,
      },
      {
        kind: "statute",
        identifier: "Art. 61a Abs. 1 AIG (SR 142.20)",
        excerpt:
          "Das Aufenthaltsrecht von Staatsangehörigen der Mitgliedstaaten der EU und der EFTA mit einer Aufenthaltsbewilligung erlischt sechs Monate nach unfreiwilliger Beendigung des Arbeitsverhältnisses, wenn dieses vor Ablauf der ersten zwölf Monate des Aufenthalts endet.",
        verifiedOn: TODAY,
        verifiedFrom: FEDLEX,
      },
      {
        kind: "statute",
        identifier: "Art. 82 Abs. 1 AsylG (SR 142.31)",
        excerpt:
          "Für die Ausrichtung von Sozialhilfeleistungen und Nothilfe gilt kantonales Recht. Personen mit einem rechtskräftigen Wegweisungsentscheid, denen eine Ausreisefrist angesetzt worden ist, werden von der Sozialhilfe ausgeschlossen.",
        verifiedOn: TODAY,
        verifiedFrom: FEDLEX,
      },
      {
        kind: "statute",
        identifier: "Art. 12 BV (SR 101)",
        excerpt:
          "Wer in Not gerät und nicht in der Lage ist, für sich zu sorgen, hat Anspruch auf Hilfe und Betreuung und auf die Mittel, die für ein menschenwürdiges Dasein unerlässlich sind.",
        verifiedOn: TODAY,
        verifiedFrom: FEDLEX,
      },
    ],
    whatToCheck: [
      "¿Qué norma exacta prevé esa duración mínima? ¿La cita la resolución (artículo, ley)? Una duración mínima sin base legal indicada es una afirmación sin fundamento visible.",
      "¿Cuál es el estatus de residencia de la persona (nacional suizo, permiso C o B, UE/EFTA, asilo)? Las reglas cambian según el estatus: compare con AIG 61a y AsylG 82.",
      "¿La duración se invoca para denegar la ayuda ordinaria o también la ayuda en situación de necesidad (Art. 12 BV)?",
      "¿La resolución distingue 'domicilio de asistencia' (ZUG 4: intención de permanencia) de 'tiempo de estancia'?",
    ],
    caveats: [
      "No se afirma que ninguna ley cantonal pueda prever requisitos de estancia: solo que las normas federales verificadas aquí no los fijan. La ley cantonal no se lee en esta herramienta.",
      "Los extractos son de la versión vigente el 2026-11-13; compruebe la versión aplicable al momento de los hechos.",
    ],
  },
  {
    id: "family-support-basis",
    topic: "Denegación por apoyo supuesto de hermanos u otros familiares",
    jurisdiction: "Derecho federal (ZGB)",
    cue: /\b(?:Bruder|Brüder|Schwester|Geschwister|frère|sœur)\b[^.]{0,200}(?:Unterstützung|unterstütz|aide)|(?:Unterstützung|unterstütz|aide)[^.]{0,200}\b(?:Bruder|Brüder|Schwester|Geschwister|frère|sœur)\b/i,
    cueScope: "anywhere",
    summary:
      "El Art. 328 Abs. 1 ZGB obliga a apoyar a 'Verwandte in auf- und absteigender Linie': el texto no menciona a los hermanos.",
    sources: [
      {
        kind: "statute",
        identifier: "Art. 328 Abs. 1 ZGB (SR 210)",
        excerpt:
          "Wer in günstigen Verhältnissen lebt, ist verpflichtet, Verwandte in auf- und absteigender Linie zu unterstützen, die ohne diesen Beistand in Not geraten würden.",
        verifiedOn: TODAY,
        verifiedFrom: FEDLEX,
      },
      {
        kind: "statute",
        identifier: "Art. 329 Abs. 1 ZGB (SR 210)",
        excerpt:
          "Der Anspruch auf Unterstützung ist gegen die Pflichtigen in der Reihenfolge ihrer Erbberechtigung geltend zu machen und geht auf die Leistung, die zum Lebensunterhalt des Bedürftigen erforderlich und den Verhältnissen des Pflichtigen angemessen ist.",
        verifiedOn: TODAY,
        verifiedFrom: FEDLEX,
      },
    ],
    whatToCheck: [
      "¿En qué norma se basa la resolución para exigir ayuda de un hermano? El Art. 328 Abs. 1 ZGB no los incluye.",
      "¿Se acreditó que el familiar vive 'in günstigen Verhältnissen' y que la ayuda es exigible y efectiva?",
      "¿Se exige a la persona probar que el familiar se negó 'definitivamente' (inversión de la carga)?",
    ],
    caveats: [
      "Puede existir una norma cantonal de subsidiariedad frente al entorno familiar: esta herramienta no la lee.",
    ],
  },
  {
    id: "origin-based-treatment",
    topic: "Nacionalidad u origen usados como factor en contra (agravante, reducción, exclusión)",
    jurisdiction: "Derecho federal (BV); la ley especial puede prever diferencias por estatus",
    cue: /(?:Staatsangehörigkeit|Nationalität|ausländische\s+Herkunft|Herkunft)[^.]{0,120}(?:erschwer|aggrav|Kürzung|reduz|ausgeschlossen|zu\s+Lasten)|(?:erschwer|aggrav)[^.]{0,120}(?:Staatsangehörigkeit|Nationalität|Herkunft)|nationalité[^.]{0,120}aggravant|aggravant[^.]{0,120}nationalité|origine\s+étrangère[^.]{0,80}(?:aggrav|réduct)|(?:origine|nazionalità|cittadinanza)[^.]{0,120}(?:aggravant|a\s+sfavore)|(?:aggravant|a\s+sfavore)[^.]{0,120}(?:origine|nazionalità|cittadinanza)|origine\s+\w+[^.]{0,80}aggravant/i,
    cueScope: "anywhere",
    summary:
      "El Art. 8 Abs. 2 BV prohíbe discriminar, entre otros motivos, por origen. Si una resolución usa la nacionalidad o el origen como agravante o como motivo para peor trato sin relación con la conducta imputada, hay que comprobar si existe una base legal que justifique la diferencia.",
    sources: [
      {
        kind: "statute",
        identifier: "Art. 8 Abs. 2 BV (SR 101)",
        excerpt:
          "Niemand darf diskriminiert werden, namentlich nicht wegen der Herkunft, der Rasse, des Geschlechts, des Alters, der Sprache, der sozialen Stellung, der Lebensform, der religiösen, weltanschaulichen oder politischen Überzeugung oder wegen einer körperlichen, geistigen oder psychischen Behinderung.",
        verifiedOn: "2026-11-14",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-14",
      },
    ],
    whatToCheck: [
      "¿La resolución explica qué relación tiene la nacionalidad o el origen con el comportamiento que se sanciona?",
      "¿Cita una norma que permita tratar distinto por ese motivo? Si no, la diferencia carece de base verificable.",
    ],
    caveats: [
      "El Art. 8 Abs. 2 BV menciona 'Herkunft'; no enumera expresamente 'Staatsangehörigkeit'. Que la diferencia sea o no discriminatoria lo decide un profesional con la jurisprudencia, que esta herramienta no lee.",
      "El derecho de extranjería prevé diferencias legítimas por estatus; no toda diferencia es discriminatoria.",
    ],
  },
  {
    id: "social-insurance-appeal-instruction",
    topic: "Plazo y vía de la Einsprache y de la Beschwerde en seguros sociales (ATSG, AVIG)",
    jurisdiction: "Derecho federal (ATSG, SR 830.1)",
    cue: /\b(?:ATSG|LPGA|AVIG|LACI)\b/,
    cueScope: "anywhere",
    summary:
      "Según el ATSG, contra las resoluciones cabe Einsprache en 30 días ante la propia autoridad que resolvió, y la Beschwerde se interpone en 30 días tras la notificación del Einspracheentscheid. Compare la instrucción de recursos de la resolución con esos textos.",
    sources: [
      {
        kind: "statute",
        identifier: "Art. 52 Abs. 1 ATSG (SR 830.1)",
        excerpt:
          "Gegen Verfügungen kann innerhalb von 30 Tagen bei der verfügenden Stelle Einsprache erhoben werden; davon ausgenommen sind prozess- und verfahrensleitende Verfügungen.",
        verifiedOn: "2026-11-14",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-14",
      },
      {
        kind: "statute",
        identifier: "Art. 60 Abs. 1 ATSG (SR 830.1)",
        excerpt:
          "Die Beschwerde ist innerhalb von 30 Tagen nach der Eröffnung des Einspracheentscheides oder der Verfügung, gegen welche eine Einsprache ausgeschlossen ist, einzureichen.",
        verifiedOn: "2026-11-14",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-14",
      },
    ],
    whatToCheck: [
      "¿Indica la resolución un plazo distinto de 30 días o una autoridad distinta de la que resolvió?",
      "¿Se notificó la resolución a la persona afectada? Un plazo solo corre desde la notificación.",
    ],
    caveats: [
      "Algunas leyes especiales prevén vías o plazos distintos; confirme que el ATSG rige en este procedimiento.",
    ],
  },
  {
    id: "ar-decision-form-and-appeal",
    topic:
      "Contenido de la resolución e instrucción de recursos en Appenzell Ausserrhoden (VRPG AR)",
    jurisdiction: "Cantón de Appenzell Ausserrhoden (VRPG, bGS 143.1)",
    cue: /Appenzell\s+Ausserrhoden|\bbGS\s+\d{3}|\bVRPG\b/,
    cueScope: "anywhere",
    summary:
      "En AR, una resolución debe contener, entre otros, los hechos y la motivación con las normas aplicadas y la instrucción de recursos (Art. 18 VRPG). Una instrucción incorrecta no puede perjudicar a la persona, y si falta, el recurso es admisible en dos meses desde la notificación (Art. 34 VRPG). La Beschwerde ante el Obergericht se presenta por escrito en 30 días (Art. 55 VRPG).",
    sources: [
      {
        kind: "statute",
        identifier: "Art. 18 Abs. 1 lit. c y f VRPG AR (bGS 143.1)",
        excerpt:
          "Verfügungen haben zu enthalten: [...] c) den Sachverhalt und die Begründung unter Angabe der angewendeten Vorschriften; [...] f) die Rechtsmittelbelehrung;",
        verifiedOn: "2026-11-14",
        verifiedFrom: "ar.clex.ch (LexWork), versión vigente leída el 2026-11-14",
      },
      {
        kind: "statute",
        identifier: "Art. 34 VRPG AR (bGS 143.1)",
        excerpt:
          "1 Aus einer unrichtigen Rechtsmittelbelehrung dürfen der betroffenen Person keine Nachteile erwachsen. 2 Ist die Rechtsmittelbelehrung bei einer weiterziehbaren Verfügung unterblieben, so ist die Einreichung des Rechtsmittels innert zwei Monaten seit Zustellung der Verfügung zulässig.",
        verifiedOn: "2026-11-14",
        verifiedFrom: "ar.clex.ch (LexWork), versión vigente leída el 2026-11-14",
      },
      {
        kind: "statute",
        identifier: "Art. 55 Abs. 1 VRPG AR (bGS 143.1)",
        excerpt: "Die Beschwerde ist schriftlich innert 30 Tagen beim Obergericht einzureichen.",
        verifiedOn: "2026-11-14",
        verifiedFrom: "ar.clex.ch (LexWork), versión vigente leída el 2026-11-14",
      },
    ],
    whatToCheck: [
      "¿Contiene la resolución hechos, motivación con las normas aplicadas y una instrucción de recursos?",
      "¿La instrucción indica una vía y un plazo distintos de los del VRPG? Una instrucción incorrecta o ausente no puede perjudicar a la persona (Art. 34 VRPG).",
    ],
    caveats: [
      "Texto vigente en la fuente cantonal: no se puede comprobar la versión a la fecha de la resolución.",
      "La ley especial aplicable puede prever otra vía; el Art. 55 VRPG regula la Beschwerde general ante el Obergericht.",
    ],
  },
  {
    id: "decision-notification",
    topic: "Notificación de la resolución a la persona afectada y ejecución antes de notificar",
    jurisdiction:
      "Derecho federal (ATSG, VwVG); en procedimientos cantonales rige la ley cantonal de procedimiento",
    cue: /(?:nicht|keine?)\s+(?:vorgesehen|zugestellt|eröffnet)[^.]{0,80}(?:Eröffnung|Zustellung|Verfügung)|(?:Eröffnung|Zustellung)[^.]{0,80}nicht\s+vorgesehen|nur\s+(?:der|dem)\s+[\wäöü]+\s+(?:zugestellt|eröffnet)|vor\s+(?:jeder\s+|der\s+)?(?:Eröffnung|Zustellung|Notifikation)[^.]{0,60}(?:vollzogen|vollstreckt|ausgeführt)|avant\s+(?:toute\s+)?notification|exécut\w+\s+avant|non\s+notifi/i,
    cueScope: "anywhere",
    summary:
      "Una resolución se debe abrir (notificar) por escrito a las partes; en los seguros sociales regidos por el ATSG debe llevar instrucción de recursos y motivación si no estima plenamente lo pedido, y una apertura defectuosa no puede perjudicar a la persona. Si la resolución solo se entrega a un tercero, o se ejecuta antes de notificarla, compruebe qué norma de procedimiento rige y si se respetó.",
    sources: [
      {
        kind: "statute",
        identifier: "Art. 49 Abs. 1 und 3 ATSG (SR 830.1)",
        excerpt:
          "Über Leistungen, Forderungen und Anordnungen, die erheblich sind oder mit denen die betroffene Person nicht einverstanden ist, hat der Versicherungsträger schriftlich Verfügungen zu erlassen. [...] Die Verfügungen werden mit einer Rechtsmittelbelehrung versehen. Sie sind zu begründen, wenn sie den Begehren der Parteien nicht voll entsprechen. Aus einer mangelhaften Eröffnung einer Verfügung darf der betroffenen Person kein Nachteil erwachsen.",
        verifiedOn: "2026-11-14",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-14",
      },
      {
        kind: "statute",
        identifier: "Art. 34 Abs. 1 VwVG (SR 172.021)",
        excerpt: "Die Behörde eröffnet Verfügungen den Parteien schriftlich.",
        verifiedOn: "2026-11-14",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-14",
      },
    ],
    whatToCheck: [
      "¿A quién se notifica la resolución? ¿Se notifica a la persona afectada?",
      "¿Se ejecuta antes de notificarla? Un plazo de recurso solo corre desde la apertura válida.",
    ],
    caveats: [
      "ATSG y VwVG rigen en procedimientos federales o de seguros sociales; para un procedimiento cantonal hay que mirar la ley cantonal, que esta herramienta lee solo en AR.",
      "El VwVG se leyó en la versión vigente a 2026-11-14, que Fedlex marca con fecha de fin 2026-12-31.",
    ],
  },
  {
    id: "alv-suspension",
    topic:
      "Suspensión en el derecho a la prestación del seguro de desempleo (Einstellung): causas, autoridad competente y duración",
    jurisdiction: "Derecho federal (AVIG, SR 837.0; ATSG, SR 830.1)",
    cue: /Einstellung\w*\s+in\s+der\s+Anspruchsberechtigung|Einstelltage|Einstellungsdauer|\bAVIG\b[^.]{0,200}\bEinstellung|suspension\s+du\s+droit\s+à\s+l['’]indemnité|\bLACI\b[^.]{0,200}suspension/i,
    cueScope: "anywhere",
    summary:
      "Según el AVIG Art. 30, la suspensión exige una de las causas enumeradas (p. ej. desempleo por culpa propia), la dicta la autoridad cantonal o la caja según el caso, y su duración depende del grado de culpa con un máximo de 60 días por causa. El ATSG Art. 43 impone al asegurador investigar de oficio y dejar constancia escrita de las informaciones orales.",
    sources: [
      {
        kind: "statute",
        identifier: "Art. 30 Abs. 1 AVIG (SR 837.0)",
        excerpt:
          "Der Versicherte ist in der Anspruchsberechtigung einzustellen, wenn er: a. durch eigenes Verschulden arbeitslos ist; [...]",
        verifiedOn: "2026-11-14",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-14",
      },
      {
        kind: "statute",
        identifier: "Art. 30 Abs. 2 AVIG (SR 837.0)",
        excerpt:
          "Die kantonale Amtsstelle verfügt Einstellungen nach Absatz 1 Buchstaben c, d und g sowie nach Absatz 1 Buchstabe e, sofern die Auskunfts- oder Meldepflicht gegenüber ihr oder dem Arbeitsamt verletzt wurde. In den übrigen Fällen verfügen die Kassen.",
        verifiedOn: "2026-11-14",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-14",
      },
      {
        kind: "statute",
        identifier: "Art. 30 Abs. 3 AVIG (SR 837.0)",
        excerpt:
          "Die Dauer der Einstellung bemisst sich nach dem Grad des Verschuldens und beträgt je Einstellungsgrund höchstens 60 Tage, im Falle von Absatz 1 Buchstabe g höchstens 25 Tage.",
        verifiedOn: "2026-11-14",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-14",
      },
      {
        kind: "statute",
        identifier: "Art. 43 Abs. 1 und 3 ATSG (SR 830.1)",
        excerpt:
          "Der Versicherungsträger prüft die Begehren, nimmt die notwendigen Abklärungen von Amtes wegen vor und holt die erforderlichen Auskünfte ein. Mündlich erteilte Auskünfte sind schriftlich festzuhalten. [...] Er muss diese Personen vorher schriftlich mahnen und auf die Rechtsfolgen hinweisen; ihnen ist eine angemessene Bedenkzeit einzuräumen.",
        verifiedOn: "2026-11-14",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-14",
      },
    ],
    whatToCheck: [
      "¿La causa de suspensión invocada es una de las que enumera el Art. 30 Abs. 1 AVIG, y qué hechos probados la sostienen?",
      "¿Quién dicta la resolución: la autoridad cantonal o la caja? El Art. 30 Abs. 2 AVIG reparte la competencia según la causa.",
      "¿La duración respeta el máximo de 60 días por causa (Abs. 3) y se motiva por el grado de culpa?",
      "¿Se investigó de oficio y se dejó constancia escrita de las informaciones orales (Art. 43 ATSG)?",
    ],
    caveats: [
      "El texto es el vigente a 2026-11-14; no se comprobó la versión a la fecha de la resolución.",
      "Las normas de ejecución del AVIG (AVIV) y las directrices administrativas no se leyeron aquí.",
    ],
  },
  {
    id: "foreigners-measures",
    topic:
      "Medidas de extranjería (revocación de permisos): causas, proporcionalidad y ejercicio de la discrecionalidad",
    jurisdiction: "Derecho federal (AIG/LEI, SR 142.20)",
    cue: /\b(?:AIG|LEI|AuG)\b|Widerruf\s+der\s+(?:Aufenthalts|Niederlassungs)?bewilligung|révocation\s+de\s+l['’]autorisation\s+de\s+(?:séjour|établissement)|revoca\s+del(?:l['’]autorizzazione|\s+permesso)/i,
    cueScope: "anywhere",
    summary:
      "El AIG Art. 62 enumera las causas por las que se pueden revocar permisos (excluida la de establecimiento) y el Art. 96 obliga a ponderar los intereses públicos, la situación personal y la integración; si la medida es fundada pero desproporcionada cabe un apercibimiento.",
    sources: [
      {
        kind: "statute",
        identifier: "Art. 62 Abs. 1 AIG (SR 142.20)",
        excerpt:
          "Die zuständige Behörde kann Bewilligungen, ausgenommen die Niederlassungsbewilligung, und andere Verfügungen nach diesem Gesetz widerrufen, wenn die Ausländerin oder der Ausländer: [...]",
        verifiedOn: "2026-11-14",
        verifiedFrom: "Fedlex, texto leído el 2026-11-14 (versión con fin 2026-12-31)",
      },
      {
        kind: "statute",
        identifier: "Art. 96 AIG (SR 142.20)",
        excerpt:
          "Die zuständigen Behörden berücksichtigen bei der Ermessensausübung die öffentlichen Interessen und die persönlichen Verhältnisse sowie die Integration der Ausländerinnen und Ausländer. [...] Ist eine Massnahme begründet, aber den Umständen nicht angemessen, so kann die betroffene Person unter Androhung dieser Massnahme verwarnt werden.",
        verifiedOn: "2026-11-14",
        verifiedFrom: "Fedlex, texto leído el 2026-11-14 (versión con fin 2026-12-31)",
      },
    ],
    whatToCheck: [
      "¿Cuál de las causas del Art. 62 Abs. 1 AIG invoca la resolución y qué hechos probados la sostienen? Si el motivo no figura en esa lista, la revocación carece de base verificable.",
      "¿Pondera la resolución los intereses públicos, la situación personal y la integración (Art. 96 AIG), o se limita a una consecuencia automática?",
      "¿Se consideró un apercibimiento (Art. 96 Abs. 2 AIG) antes de revocar?",
    ],
    caveats: [
      "Esta entrada no sustituye la lectura de las demás normas aplicables (p. ej. Art. 33 y 63 AIG, tratados con la UE); no se leyeron aquí.",
      "Fedlex marca la versión leída con fecha de fin 2026-12-31: la versión a la fecha de la resolución puede diferir.",
    ],
  },
  {
    id: "social-insurance-recovery",
    topic:
      "Devolución de prestaciones de seguros sociales indebidamente percibidas (Rückerstattung)",
    jurisdiction:
      "Derecho federal (ATSG, SR 830.1); la ayuda social cantonal tiene su propia regulación",
    cue: /Rückerstattung|Rückforderung|zurückzuerstatten|zurückerstatten|restitution\s+de\s+prestations|remboursement\s+de\s+prestations|restituzione\s+delle\s+prestazioni/i,
    cueScope: "anywhere",
    summary:
      "Según el ATSG Art. 25, las prestaciones percibidas indebidamente se devuelven, salvo buena fe y gran rigor; el derecho a reclamarlas caduca a los tres años desde que la institución lo supo y, como máximo, a los cinco años desde el pago.",
    sources: [
      {
        kind: "statute",
        identifier: "Art. 25 Abs. 1 ATSG (SR 830.1)",
        excerpt:
          "Unrechtmässig bezogene Leistungen sind zurückzuerstatten. Wer Leistungen in gutem Glauben empfangen hat, muss sie nicht zurückerstatten, wenn eine grosse Härte vorliegt.",
        verifiedOn: "2026-11-15",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-15",
      },
      {
        kind: "statute",
        identifier: "Art. 25 Abs. 2 ATSG (SR 830.1)",
        excerpt:
          "Der Rückforderungsanspruch erlischt drei Jahre, nachdem die Versicherungseinrichtung davon Kenntnis erhalten hat, spätestens aber fünf Jahre seit der Auszahlung der einzelnen Leistung.",
        verifiedOn: "2026-11-15",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-15",
      },
    ],
    whatToCheck: [
      "¿Desde cuándo conocía la institución el hecho que fundamenta la devolución? ¿Se respetan los tres años y el límite absoluto de cinco años desde cada pago?",
      "¿Se examinó la buena fe y el gran rigor antes de exigir la devolución?",
    ],
    caveats: [
      "Si se trata de ayuda social cantonal, la devolución se rige por la ley cantonal y no por el ATSG.",
      "El texto leído es el vigente; no se comprobó la versión a la fecha de la resolución.",
    ],
  },
  {
    id: "social-insurance-duties",
    topic:
      "Deberes de información y de colaboración en los seguros sociales (Aufklärung, Beratung, Mitwirkung)",
    jurisdiction: "Derecho federal (ATSG, SR 830.1)",
    cue: /Mitwirkungspflicht|Auskunftspflicht|Meldepflicht|Beratungspflicht|Aufklärungspflicht|devoir\s+de\s+collaborer|obligation\s+de\s+(?:collaborer|renseigner)|obbligo\s+di\s+collaborare/i,
    cueScope: "anywhere",
    summary:
      "El ATSG obliga a los aseguradores a informar y asesorar gratuitamente (Art. 27) y a las personas aseguradas a colaborar y dar las informaciones necesarias (Art. 28). Una sanción por falta de colaboración exige comprobar qué información se pidió y si se advirtió de las consecuencias (Art. 43 Abs. 3 ATSG).",
    sources: [
      {
        kind: "statute",
        identifier: "Art. 27 Abs. 1 und 2 ATSG (SR 830.1)",
        excerpt:
          "Die Versicherungsträger und Durchführungsorgane der einzelnen Sozialversicherungen sind verpflichtet, im Rahmen ihres Zuständigkeitsbereiches die interessierten Personen über ihre Rechte und Pflichten aufzuklären. [...] Jede Person hat Anspruch auf grundsätzlich unentgeltliche Beratung über ihre Rechte und Pflichten.",
        verifiedOn: "2026-11-15",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-15",
      },
      {
        kind: "statute",
        identifier: "Art. 28 Abs. 1 und 2 ATSG (SR 830.1)",
        excerpt:
          "Die Versicherten und ihre Arbeitgeber haben beim Vollzug der Sozialversicherungsgesetze unentgeltlich mitzuwirken. [...] Wer Versicherungsleistungen beansprucht, muss unentgeltlich alle Auskünfte erteilen, die zur Abklärung des Anspruchs, zur Festsetzung der Versicherungsleistungen und zur Durchsetzung des Regressanspruchs erforderlich sind.",
        verifiedOn: "2026-11-15",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-15",
      },
    ],
    whatToCheck: [
      "¿Qué información concreta se pidió a la persona y cuándo? ¿Se le advirtió por escrito de las consecuencias de no colaborar (Art. 43 Abs. 3 ATSG)?",
      "¿Cumplió el asegurador su deber de informar y asesorar (Art. 27 ATSG) antes de imputar un incumplimiento?",
    ],
    caveats: [
      "Aplica a seguros sociales regidos por el ATSG; la ayuda social cantonal tiene sus propios deberes de colaboración.",
    ],
  },
  {
    id: "insurance-court-procedure",
    topic:
      "Procedimiento ante el tribunal cantonal de seguros: hechos, pruebas, costas y forma de la sentencia",
    jurisdiction:
      "Derecho federal (ATSG Art. 61, SR 830.1); el procedimiento concreto lo regula el derecho cantonal",
    cue: /Versicherungsgericht|tribunal\s+(?:cantonal\s+)?des\s+assurances|tribunale\s+(?:cantonale\s+)?delle\s+assicurazioni/i,
    cueScope: "anywhere",
    summary:
      "El ATSG Art. 61 exige un procedimiento sencillo, rápido y, por regla, público; que el tribunal establezca los hechos relevantes con la colaboración de las partes y practique las pruebas necesarias; que la parte vencedora tenga derecho a la indemnización de costas; y que las sentencias lleven motivación e instrucción de recursos.",
    sources: [
      {
        kind: "statute",
        identifier: "Art. 61 lit. c ATSG (SR 830.1)",
        excerpt:
          "Das Versicherungsgericht stellt unter Mitwirkung der Parteien die für den Entscheid erheblichen Tatsachen fest; es erhebt die notwendigen Beweise und ist in der Beweiswürdigung frei.",
        verifiedOn: "2026-11-15",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-15",
      },
      {
        kind: "statute",
        identifier: "Art. 61 lit. g und h ATSG (SR 830.1)",
        excerpt:
          "Die obsiegende Beschwerde führende Person hat Anspruch auf Ersatz der Parteikosten. [...] Die Entscheide werden, versehen mit einer Begründung und einer Rechtsmittelbelehrung sowie mit den Namen der Mitglieder des Versicherungsgerichts schriftlich eröffnet.",
        verifiedOn: "2026-11-15",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-15",
      },
    ],
    whatToCheck: [
      "¿Practicó el tribunal las pruebas necesarias o se limitó a las del asegurador?",
      "¿Se decidió sobre las costas y la indemnización de la parte vencedora?",
    ],
    caveats: [
      "El procedimiento detallado es cantonal; el Art. 61 ATSG fija solo exigencias mínimas.",
    ],
  },
  {
    id: "iv-pension-basis",
    topic:
      "Renta de invalidez (IV): requisitos, prioridad de la integración y deber de colaboración",
    jurisdiction: "Derecho federal (IVG, SR 831.20; ATSG, SR 830.1)",
    cue: /\bIVG\b|\bLAI\b|Invalidenrente|Invalidenversicherung|IV-Stelle|rente\s+d['’]invalidité|assurance-invalidité|rendita\s+d['’]invalidità/i,
    cueScope: "anywhere",
    summary:
      "Según el IVG Art. 28 la renta exige que no puedan restablecerse la capacidad de ganancia o de actuar en el ámbito de actividad con medidas de integración razonables, una incapacidad de trabajo media de al menos el 40 % durante un año y una invalidez de al menos el 40 % tras ese año. No se concede renta mientras no se hayan agotado las posibilidades de integración. El Art. 7 IVG obliga a la persona asegurada a hacer lo razonable para reducir la incapacidad.",
    sources: [
      {
        kind: "statute",
        identifier: "Art. 28 Abs. 1 IVG (SR 831.20)",
        excerpt:
          "Anspruch auf eine Rente haben Versicherte, die: a. ihre Erwerbsfähigkeit oder die Fähigkeit, sich im Aufgabenbereich zu betätigen, nicht durch zumutbare Eingliederungsmassnahmen wieder herstellen, erhalten oder verbessern können; b. während eines Jahres ohne wesentlichen Unterbruch durchschnittlich mindestens 40 Prozent arbeitsunfähig (Art. 6 ATSG) gewesen sind; und c. nach Ablauf dieses Jahres zu mindestens 40 Prozent invalid (Art. 8 ATSG) sind.",
        verifiedOn: "2026-11-15",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-15 (notas editoriales omitidas)",
      },
      {
        kind: "statute",
        identifier: "Art. 28 Abs. 1bis IVG (SR 831.20)",
        excerpt:
          "Eine Rente nach Absatz 1 wird nicht zugesprochen, solange die Möglichkeiten zur Eingliederung im Sinne von Artikel 8 Absätze 1 und 1ter nicht ausgeschöpft sind.",
        verifiedOn: "2026-11-15",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-15 (notas editoriales omitidas)",
      },
      {
        kind: "statute",
        identifier: "Art. 7 Abs. 1 IVG (SR 831.20)",
        excerpt:
          "Die versicherte Person muss alles ihr Zumutbare unternehmen, um die Dauer und das Ausmass der Arbeitsunfähigkeit (Art. 6 ATSG) zu verringern und den Eintritt einer Invalidität (Art. 8 ATSG) zu verhindern.",
        verifiedOn: "2026-11-15",
        verifiedFrom: "Fedlex, texto vigente leído el 2026-11-15 (notas editoriales omitidas)",
      },
    ],
    whatToCheck: [
      "¿Qué porcentajes de incapacidad de trabajo y de invalidez establece la resolución y con qué pruebas médicas y de otro tipo?",
      "¿Se agotaron las posibilidades de integración antes de denegar o conceder la renta (Art. 28 Abs. 1bis IVG)?",
      "Si se reprocha falta de colaboración, ¿hubo advertencia escrita y plazo (Art. 43 Abs. 3 ATSG)?",
    ],
    caveats: [
      "Texto vigente a 2026-11-15 (Fedlex marca la versión con fin 2026-12-31); no se comprobó la versión a la fecha de la resolución.",
      "Las ordenanzas (IVV) y la jurisprudencia sobre el cálculo del grado de invalidez no se leyeron aquí.",
    ],
  },
];

/** Entradas activadas por el texto de la resolucion. */
export function activatedGrounds(text: string): LegalGround[] {
  const header = text.slice(0, 900);
  return LEGAL_GROUNDS.filter((g) => g.cue.test(g.cueScope === "header" ? header : text));
}
