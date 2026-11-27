/**
 * Reglas procesales y de plazos verificadas, usadas por analyze_procedural_strategy.
 *
 * Cada extracto es LITERAL del texto oficial (Fedlex, version en vigor el 2024-03-15
 * para el OR/BGG y 2023-09-01 para la ZPO; comprobado el 2026-11-22). Antes la
 * herramienta no conocia ninguna regla procesal y devolvia un esqueleto generico.
 * Una regla aqui no sustituye la comprobacion de la version aplicable al caso.
 */

export interface ProceduralRule {
  readonly id: string;
  readonly provision: string;
  readonly excerpt: string;
  readonly consideredVersion: string;
  readonly verifiedOn: string;
}

const VERIFIED_ON = "2026-11-22";
/** Reglas de las rutas de seguros sociales, alquiler, ejecucion, penal, laboral y administrativa: extractos contrastados con Fedlex el 2026-11-24. */
const VERIFIED_ON_ROUTES = "2026-11-24";
const ZPO_VERSION = "2023-09-01";
const OR_VERSION = "2024-01-01";
const BGG_VERSION = "2024-02-01";
const BGG_CURRENT_VERSION = "2026-04-01";
const DBG_VERSION = "2026-09-02";

const RULES: readonly ProceduralRule[] = [
  {
    id: "zpo-197",
    provision: "Art. 197 ZPO",
    excerpt:
      "Dem Entscheidverfahren geht ein Schlichtungsversuch vor einer Schlichtungsbehörde voraus.",
    consideredVersion: ZPO_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "zpo-199-1",
    provision: "Art. 199 Abs. 1 ZPO",
    excerpt:
      "Bei vermögensrechtlichen Streitigkeiten mit einem Streitwert von mindestens 100 000 Franken können die Parteien gemeinsam auf die Durchführung des Schlichtungsverfahrens verzichten.",
    consideredVersion: ZPO_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "zpo-202",
    provision: "Art. 202 Abs. 1-2 ZPO",
    excerpt:
      "Das Verfahren wird durch das Schlichtungsgesuch eingeleitet. [...] Im Schlichtungsgesuch sind die Gegenpartei, das Rechtsbegehren und der Streitgegenstand zu bezeichnen.",
    consideredVersion: ZPO_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "zpo-209-3",
    provision: "Art. 209 Abs. 3 ZPO",
    excerpt:
      "Nach Eröffnung berechtigt die Klagebewilligung während dreier Monate zur Einreichung der Klage beim Gericht.",
    consideredVersion: ZPO_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "zpo-209-4",
    provision: "Art. 209 Abs. 4 ZPO",
    excerpt:
      "In Streitigkeiten aus Miete und Pacht von Wohn- und Geschäftsräumen sowie aus landwirtschaftlicher Pacht beträgt die Klagefrist 30 Tage.",
    consideredVersion: ZPO_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "zpo-243-1",
    provision: "Art. 243 Abs. 1 ZPO",
    excerpt:
      "Das vereinfachte Verfahren gilt für vermögensrechtliche Streitigkeiten bis zu einem Streitwert von 30 000 Franken.",
    consideredVersion: ZPO_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "zpo-308-2",
    provision: "Art. 308 Abs. 2 ZPO",
    excerpt:
      "In vermögensrechtlichen Angelegenheiten ist die Berufung nur zulässig, wenn der Streitwert der zuletzt aufrechterhaltenen Rechtsbegehren mindestens 10 000 Franken beträgt.",
    consideredVersion: ZPO_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "zpo-311-1",
    provision: "Art. 311 Abs. 1 ZPO",
    excerpt:
      "Die Berufung ist bei der Rechtsmittelinstanz innert 30 Tagen seit Zustellung des begründeten Entscheides beziehungsweise seit der nachträglichen Zustellung der Entscheidbegründung (Art. 239) schriftlich und begründet einzureichen.",
    consideredVersion: ZPO_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "zpo-321-2",
    provision: "Art. 321 Abs. 2 ZPO",
    excerpt:
      "Wird ein im summarischen Verfahren ergangener Entscheid oder eine prozessleitende Verfügung angefochten, so beträgt die Beschwerdefrist zehn Tage, sofern das Gesetz nichts anderes bestimmt.",
    consideredVersion: ZPO_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "bgg-100-1",
    provision: "Art. 100 Abs. 1 BGG",
    excerpt:
      "Die Beschwerde gegen einen Entscheid ist innert 30 Tagen nach der Eröffnung der vollständigen Ausfertigung beim Bundesgericht einzureichen.",
    consideredVersion: BGG_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "bgg-72-1",
    provision: "Art. 72 Abs. 1 BGG",
    excerpt: "Das Bundesgericht beurteilt Beschwerden gegen Entscheide in Zivilsachen.",
    consideredVersion: BGG_CURRENT_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "bgg-74-1",
    provision: "Art. 74 Abs. 1 BGG",
    excerpt:
      "In vermögensrechtlichen Angelegenheiten ist die Beschwerde nur zulässig, wenn der Streitwert mindestens beträgt: a. 15 000 Franken in arbeits- und mietrechtlichen Fällen; b. 30 000 Franken in allen übrigen Fällen.",
    consideredVersion: BGG_CURRENT_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "bgg-75-1",
    provision: "Art. 75 Abs. 1 BGG",
    excerpt:
      "Die Beschwerde ist zulässig gegen Entscheide letzter kantonaler Instanzen, des Bundesverwaltungsgerichts und des Bundespatentgerichts.",
    consideredVersion: BGG_CURRENT_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "bgg-90",
    provision: "Art. 90 BGG",
    excerpt: "Die Beschwerde ist zulässig gegen Entscheide, die das Verfahren abschliessen.",
    consideredVersion: BGG_CURRENT_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "bgg-95",
    provision: "Art. 95 BGG",
    excerpt:
      "Mit der Beschwerde kann die Verletzung gerügt werden von: a. Bundesrecht; b. Völkerrecht; c. kantonalen verfassungsmässigen Rechten; d. kantonalen Bestimmungen über die politische Stimmberechtigung der Bürger und Bürgerinnen und über Volkswahlen und ‑abstimmungen; e. interkantonalem Recht.",
    consideredVersion: BGG_CURRENT_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "bgg-97-1",
    provision: "Art. 97 Abs. 1 BGG",
    excerpt:
      "Die Feststellung des Sachverhalts kann nur gerügt werden, wenn sie offensichtlich unrichtig ist oder auf einer Rechtsverletzung im Sinne von Artikel 95 beruht und wenn die Behebung des Mangels für den Ausgang des Verfahrens entscheidend sein kann.",
    consideredVersion: BGG_CURRENT_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "bgg-105-1",
    provision: "Art. 105 Abs. 1 BGG",
    excerpt:
      "Das Bundesgericht legt seinem Urteil den Sachverhalt zugrunde, den die Vorinstanz festgestellt hat.",
    consideredVersion: BGG_CURRENT_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "bgg-106-2",
    provision: "Art. 106 Abs. 2 BGG",
    excerpt:
      "Es prüft die Verletzung von Grundrechten und von kantonalem und interkantonalem Recht nur insofern, als eine solche Rüge in der Beschwerde vorgebracht und begründet worden ist.",
    consideredVersion: BGG_CURRENT_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "dbg-132-1",
    provision: "Art. 132 Abs. 1 DBG",
    excerpt:
      "Gegen die Veranlagungsverfügung kann der Steuerpflichtige innert 30 Tagen nach Zustellung bei der Veranlagungsbehörde schriftlich Einsprache erheben.",
    consideredVersion: DBG_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "dbg-132-3",
    provision: "Art. 132 Abs. 3 DBG",
    excerpt: "Die Einsprache ist zu begründen und muss allfällige Beweismittel nennen.",
    consideredVersion: DBG_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "dbg-133-1",
    provision: "Art. 133 Abs. 1 DBG",
    excerpt: "Die Frist beginnt mit dem auf die Eröffnung folgenden Tage.",
    consideredVersion: DBG_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "dbg-140-1",
    provision: "Art. 140 Abs. 1 DBG",
    excerpt:
      "Der Steuerpflichtige kann gegen den Einspracheentscheid der Veranlagungsbehörde innert 30 Tagen nach Zustellung bei einer von der Steuerbehörde unabhängigen Rekurskommission schriftlich Beschwerde erheben.",
    consideredVersion: DBG_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "dbg-146",
    provision: "Art. 146 DBG",
    excerpt:
      "Gegen Entscheide letzter kantonaler Instanzen kann nach Massgabe des Bundesgerichtsgesetzes vom 17. Juni 2005 beim Bundesgericht Beschwerde geführt werden.",
    consideredVersion: DBG_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "or-197",
    provision: "Art. 197 OR",
    excerpt:
      "Der Verkäufer haftet dem Käufer sowohl für die zugesicherten Eigenschaften als auch dafür, dass die Sache nicht körperliche oder rechtliche Mängel habe, die ihren Wert oder ihre Tauglichkeit zu dem vorausgesetzten Gebrauche aufheben oder erheblich mindern.",
    consideredVersion: OR_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "or-199",
    provision: "Art. 199 OR",
    excerpt:
      "Eine Vereinbarung über Aufhebung oder Beschränkung der Gewährspflicht ist ungültig, wenn der Verkäufer dem Käufer die Gewährsmängel arglistig verschwiegen hat.",
    consideredVersion: OR_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "or-201",
    provision: "Art. 201 OR",
    excerpt:
      "Der Käufer soll, sobald es nach dem üblichen Geschäftsgange tunlich ist, die Beschaffenheit der empfangenen Sache prüfen und, falls sich Mängel ergeben, für die der Verkäufer Gewähr zu leisten hat, diesem sofort Anzeige machen.",
    consideredVersion: OR_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "or-210-6",
    provision: "Art. 210 Abs. 6 OR",
    excerpt:
      "Der Verkäufer kann die Verjährung nicht geltend machen, wenn ihm eine absichtliche Täuschung des Käufers nachgewiesen wird.",
    consideredVersion: OR_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "or-219-3",
    provision: "Art. 219 Abs. 3 OR (Fassung bis 31.12.2025)",
    excerpt:
      "Die Pflicht zur Gewährleistung für die Mängel eines Gebäudes verjährt mit dem Ablauf von fünf Jahren, vom Erwerb des Eigentums an gerechnet.",
    consideredVersion: OR_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "or-371-2",
    provision: "Art. 371 Abs. 2 OR",
    excerpt:
      "Die Ansprüche des Bestellers eines unbeweglichen Werkes wegen allfälliger Mängel des Werkes verjähren gegen den Unternehmer sowie gegen den Architekten oder den Ingenieur, die zum Zwecke der Erstellung Dienste geleistet haben, mit Ablauf von fünf Jahren seit der Abnahme des Werkes.",
    consideredVersion: OR_VERSION,
    verifiedOn: VERIFIED_ON,
  },
  {
    id: "atsg-43-1",
    provision: "Art. 43 Abs. 1 ATSG",
    excerpt:
      "Der Versicherungsträger prüft die Begehren, nimmt die notwendigen Abklärungen von Amtes wegen vor und holt die erforderlichen Auskünfte ein.",
    consideredVersion: "2024-01-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "atsg-52-1",
    provision: "Art. 52 Abs. 1 ATSG",
    excerpt:
      "Gegen Verfügungen kann innerhalb von 30 Tagen bei der verfügenden Stelle Einsprache erhoben werden; davon ausgenommen sind prozess- und verfahrensleitende Verfügungen.",
    consideredVersion: "2024-01-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "atsg-56-1",
    provision: "Art. 56 Abs. 1 ATSG",
    excerpt:
      "Gegen Einspracheentscheide oder Verfügungen, gegen welche eine Einsprache ausgeschlossen ist, kann Beschwerde erhoben werden.",
    consideredVersion: "2024-01-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "atsg-57",
    provision: "Art. 57 ATSG",
    excerpt:
      "Jeder Kanton bestellt ein Versicherungsgericht als einzige Instanz zur Beurteilung von Beschwerden aus dem Bereich der Sozialversicherung.",
    consideredVersion: "2024-01-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "atsg-60-1",
    provision: "Art. 60 Abs. 1 ATSG",
    excerpt:
      "Die Beschwerde ist innerhalb von 30 Tagen nach der Eröffnung des Einspracheentscheides oder der Verfügung, gegen welche eine Einsprache ausgeschlossen ist, einzureichen.",
    consideredVersion: "2024-01-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "vwvg-44",
    provision: "Art. 44 VwVG",
    excerpt: "Die Verfügung unterliegt der Beschwerde.",
    consideredVersion: "2022-07-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "vwvg-46a",
    provision: "Art. 46a VwVG",
    excerpt:
      "Gegen das unrechtmässige Verweigern oder Verzögern einer anfechtbaren Verfügung kann Beschwerde geführt werden.",
    consideredVersion: "2022-07-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "vwvg-50-1",
    provision: "Art. 50 Abs. 1 VwVG",
    excerpt: "Die Beschwerde ist innerhalb von 30 Tagen nach Eröffnung der Verfügung einzureichen.",
    consideredVersion: "2022-07-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "schkg-74-1",
    provision: "Art. 74 Abs. 1 SchKG",
    excerpt:
      "Will der Betriebene Rechtsvorschlag erheben, so hat er dies sofort dem Überbringer des Zahlungsbefehls oder innert zehn Tagen nach der Zustellung dem Betreibungsamt mündlich oder schriftlich zu erklären.",
    consideredVersion: "2026-01-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "schkg-80-1",
    provision: "Art. 80 Abs. 1 SchKG",
    excerpt:
      "Beruht die Forderung auf einem vollstreckbaren gerichtlichen Entscheid, so kann der Gläubiger beim Richter die Aufhebung des Rechtsvorschlags (definitive Rechtsöffnung) verlangen.",
    consideredVersion: "2026-01-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "schkg-82-1",
    provision: "Art. 82 Abs. 1 SchKG",
    excerpt:
      "Beruht die Forderung auf einer durch öffentliche Urkunde festgestellten oder durch Unterschrift bekräftigten Schuldanerkennung, so kann der Gläubiger die provisorische Rechtsöffnung verlangen.",
    consideredVersion: "2026-01-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "schkg-83-2",
    provision: "Art. 83 Abs. 2 SchKG",
    excerpt:
      "Der Betriebene kann indessen innert 20 Tagen nach der Rechtsöffnung auf dem Weg des ordentlichen Prozesses beim Gericht des Betreibungsortes auf Aberkennung der Forderung klagen.",
    consideredVersion: "2026-01-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "stpo-89",
    provision: "Art. 89 Abs. 1-2 StPO",
    excerpt:
      "Gesetzliche Fristen können nicht erstreckt werden. [...] Im Strafverfahren gibt es keine Gerichtsferien.",
    consideredVersion: "2025-04-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "stpo-354-1",
    provision: "Art. 354 Abs. 1 StPO",
    excerpt:
      "Gegen den Strafbefehl können bei der Staatsanwaltschaft innert 10 Tagen schriftlich Einsprache erheben:",
    consideredVersion: "2025-04-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "stpo-396-1",
    provision: "Art. 396 Abs. 1 StPO",
    excerpt:
      "Die Beschwerde gegen schriftlich oder mündlich eröffnete Entscheide ist innert 10 Tagen schriftlich und begründet bei der Beschwerdeinstanz einzureichen.",
    consideredVersion: "2025-04-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "stpo-399-1",
    provision: "Art. 399 Abs. 1 StPO",
    excerpt:
      "Die Berufung ist dem erstinstanzlichen Gericht innert 10 Tagen seit Eröffnung des Urteils schriftlich oder mündlich zu Protokoll anzumelden.",
    consideredVersion: "2025-04-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "stpo-399-3",
    provision: "Art. 399 Abs. 3 StPO",
    excerpt:
      "reicht dem Berufungsgericht innert 20 Tagen seit der Zustellung des begründeten Urteils eine schriftliche Berufungserklärung ein.",
    consideredVersion: "2025-04-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "bgg-78-1",
    provision: "Art. 78 Abs. 1 BGG",
    excerpt: "Das Bundesgericht beurteilt Beschwerden gegen Entscheide in Strafsachen.",
    consideredVersion: "2026-04-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "bgg-82",
    provision: "Art. 82 lit. a BGG",
    excerpt:
      "Das Bundesgericht beurteilt Beschwerden: a. gegen Entscheide in Angelegenheiten des öffentlichen Rechts;",
    consideredVersion: "2026-04-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "or-271-1",
    provision: "Art. 271 Abs. 1 OR",
    excerpt:
      "Die Kündigung ist anfechtbar, wenn sie gegen den Grundsatz von Treu und Glauben verstösst.",
    consideredVersion: "2026-10-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "or-273-1",
    provision: "Art. 273 Abs. 1 OR",
    excerpt:
      "Will eine Partei die Kündigung anfechten, so muss sie das Begehren innert 30 Tagen nach Empfang der Kündigung der Schlichtungsbehörde einreichen.",
    consideredVersion: "2026-10-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "or-336b-1",
    provision: "Art. 336b Abs. 1 OR",
    excerpt:
      "Wer gestützt auf Artikel 336 und 336a eine Entschädigung geltend machen will, muss gegen die Kündigung längstens bis zum Ende der Kündigungsfrist beim Kündigenden schriftlich Einsprache erheben.",
    consideredVersion: "2026-10-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "or-336b-2",
    provision: "Art. 336b Abs. 2 OR",
    excerpt:
      "Wird nicht innert 180 Tagen nach Beendigung des Arbeitsverhältnisses eine Klage anhängig gemacht, ist der Anspruch verwirkt.",
    consideredVersion: "2026-10-01",
    verifiedOn: VERIFIED_ON_ROUTES,
  },
  {
    id: "or-367-1bis",
    provision: "Art. 367 Abs. 1bis OR",
    excerpt:
      "Die Frist für die Mängelrüge beträgt bei einem unbeweglichen Werk 60 Tage. Die Vereinbarung einer kürzeren Frist ist unwirksam.",
    consideredVersion: "2026-01-01",
    verifiedOn: "2026-11-27",
  },
  {
    id: "or-370-4",
    provision: "Art. 370 Abs. 4 OR",
    excerpt:
      "Mängel eines unbeweglichen Werks, die bei der Abnahme und ordnungsmässigen Prüfung nicht erkennbar waren, sind innert 60 Tagen nach ihrer Entdeckung anzuzeigen.",
    consideredVersion: "2026-01-01",
    verifiedOn: "2026-11-27",
  },
  {
    id: "or-201-4",
    provision: "Art. 201 Abs. 4 OR",
    excerpt:
      "Soweit Mängel einer Sache, die bestimmungsgemäss in ein unbewegliches Werk integriert worden ist, die Mangelhaftigkeit des Werks verursacht haben, sind diese innert 60 Tagen anzuzeigen.",
    consideredVersion: "2026-01-01",
    verifiedOn: "2026-11-27",
  },
];

const RULES_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

function rules(ids: readonly string[]): ProceduralRule[] {
  return ids.flatMap((id) => {
    const rule = RULES_BY_ID.get(id);
    return rule ? [rule] : [];
  });
}

export interface ProceduralRuleDeadline {
  readonly description: string;
  readonly startEvent: string;
  readonly ruleIds: readonly string[];
}

export interface ProceduralRoute {
  readonly id:
    | "civil-claim"
    | "sale-defects"
    | "federal-appeal"
    | "tax-assessment"
    | "social-insurance"
    | "tenancy-termination"
    | "debt-enforcement"
    | "criminal-procedure"
    | "employment-termination"
    | "federal-administrative";
  readonly summary: string;
  readonly rules: readonly ProceduralRule[];
  readonly deadlines: readonly ProceduralRuleDeadline[];
  readonly notes: readonly string[];
}

const FEDERAL_APPEAL_RE =
  /bundesgericht|beschwerde in zivilsachen|tribunal fédéral|recours en matière civile|tribunale federale|ricorso in materia civile/i;

const TAX_RE =
  /\bDBG\b|direkte Bundessteuer|impôt fédéral direct|imposta federale diretta|Veranlagungsverfügung/i;

const SALE_RE =
  /kauf|verkauf|gewährleistung|gewaehrleistung|sachmängel|mängel|maengel|compraventa|vente|vices|acquisto|vizi/i;

/** Mayor importe en francos (CHF) mencionado en el texto, o null. */
export function largestChfAmount(text: string): number | null {
  const NUMBER = String.raw`(\d{1,3}(?:[ '\u2019\u00a0\u202f.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
  const re = new RegExp(
    String.raw`(?:CHF|Fr\.|Franken)\s*${NUMBER}|${NUMBER}\s*(?:CHF|Franken)`,
    "gi",
  );
  const amounts: number[] = [];
  for (const match of text.matchAll(re)) {
    const raw = (match[1] ?? match[2] ?? "").replace(/[ '\u2019\u00a0\u202f]/g, "");
    // 98.500 / 98,500 (separador de miles) frente a 98.50 (decimales)
    const normalized = /^\d{1,3}([.,]\d{3})+$/.test(raw)
      ? raw.replace(/[.,]/g, "")
      : raw.replace(",", ".");
    const value = Number(normalized);
    if (Number.isFinite(value) && value > 0) amounts.push(value);
  }
  return amounts.length > 0 ? Math.max(...amounts) : null;
}

export function selectProceduralRoutes(input: {
  readonly area: string;
  readonly subarea?: string | undefined;
  readonly text: string;
  /** Texto de las pretensiones: el valor litigioso sale de aqui antes que del relato (p. ej. precio de compra). */
  readonly claimsText?: string | undefined;
}): ProceduralRoute[] {
  const routes: ProceduralRoute[] = [];
  const isCivilClaim = input.area === "civil" || input.area === "employment";
  if (isCivilClaim) {
    const amount =
      (input.claimsText ? largestChfAmount(input.claimsText) : null) ??
      largestChfAmount(input.text);
    const valueRules: string[] =
      amount === null
        ? []
        : amount <= 30_000
          ? ["zpo-243-1"]
          : amount >= 100_000
            ? ["zpo-199-1"]
            : [];
    const valueNote =
      amount === null
        ? "Streitwert nicht erkennbar: Verfahrensart (vereinfacht bis CHF 30 000, Art. 243 Abs. 1 ZPO) und Berufungsfähigkeit (ab CHF 10 000, Art. 308 Abs. 2 ZPO) hängen davon ab."
        : amount <= 30_000
          ? `Streitwert ca. CHF ${amount}: vereinfachtes Verfahren (Art. 243 Abs. 1 ZPO), sofern kein Ausnahmefall nach Art. 243 Abs. 3 ZPO vorliegt.`
          : `Streitwert ca. CHF ${amount}: über CHF 30 000, daher nicht das vereinfachte Verfahren nach Art. 243 Abs. 1 ZPO (Ausnahmen in Art. 243 Abs. 2 ZPO vorbehalten).`;
    routes.push({
      id: "civil-claim",
      summary:
        "Zivilklage: zuerst Schlichtungsgesuch bei der Schlichtungsbehörde, danach Klage beim Gericht innert drei Monaten nach Klagebewilligung; Berufung und Bundesgerichtsbeschwerde als Rechtsmittel.",
      rules: rules([
        "zpo-197",
        "zpo-202",
        ...valueRules,
        "zpo-209-3",
        "zpo-308-2",
        "zpo-311-1",
        "bgg-100-1",
      ]),
      deadlines: [
        {
          description: "Klage beim Gericht nach erfolglosem Schlichtungsversuch",
          startEvent: "Eröffnung der Klagebewilligung (drei Monate)",
          ruleIds: ["zpo-209-3"],
        },
        {
          description: "Berufung gegen den erstinstanzlichen Endentscheid",
          startEvent:
            "Zustellung des begründeten Entscheides (30 Tage; 10 Tage im summarischen Verfahren)",
          ruleIds: ["zpo-311-1", "zpo-321-2"],
        },
        {
          description: "Beschwerde in Zivilsachen an das Bundesgericht",
          startEvent:
            "Eröffnung der vollständigen Ausfertigung des kantonalen Entscheides (30 Tage)",
          ruleIds: ["bgg-100-1"],
        },
      ],
      notes: [
        valueNote,
        "Ausnahmen vom Schlichtungsverfahren in Art. 198 ZPO prüfen (z. B. summarisches Verfahren, einzige kantonale Instanz).",
      ],
    });
  }

  if (isCivilClaim && FEDERAL_APPEAL_RE.test(`${input.text} ${input.claimsText ?? ""}`)) {
    const amount =
      (input.claimsText ? largestChfAmount(input.claimsText) : null) ??
      largestChfAmount(input.text);
    const threshold =
      amount === null
        ? "Streitwert nicht erkennbar: Streitwertgrenze CHF 30 000 (CHF 15 000 in arbeits- und mietrechtlichen Fällen), Art. 74 Abs. 1 BGG; darunter nur bei Rechtsfrage von grundsätzlicher Bedeutung (Art. 74 Abs. 2 lit. a BGG)."
        : amount >= 30_000
          ? `Streitwert ca. CHF ${amount}: erreicht die Streitwertgrenze von CHF 30 000 (Art. 74 Abs. 1 lit. b BGG); in arbeits- und mietrechtlichen Fällen gilt CHF 15 000 (lit. a).`
          : `Streitwert ca. CHF ${amount}: unter CHF 30 000; die Beschwerde ist nur bei Rechtsfrage von grundsätzlicher Bedeutung zulässig (Art. 74 Abs. 2 lit. a BGG), in arbeits- und mietrechtlichen Fällen gilt CHF 15 000.`;
    routes.push({
      id: "federal-appeal",
      summary:
        "Beschwerde in Zivilsachen an das Bundesgericht: Zivilsache, Streitwertgrenze, Entscheid der letzten kantonalen Instanz, Endentscheid; Sachverhalt grundsätzlich bindend, Rüge nur bei offensichtlicher Unrichtigkeit; Grundrechtsrügen müssen begründet werden.",
      rules: rules([
        "bgg-72-1",
        "bgg-74-1",
        "bgg-75-1",
        "bgg-90",
        "bgg-95",
        "bgg-97-1",
        "bgg-105-1",
        "bgg-106-2",
        "bgg-100-1",
      ]),
      deadlines: [
        {
          description: "Beschwerde in Zivilsachen an das Bundesgericht",
          startEvent:
            "Eröffnung der vollständigen Ausfertigung des kantonalen Entscheides (30 Tage)",
          ruleIds: ["bgg-100-1"],
        },
      ],
      notes: [
        threshold,
        "Sachverhaltsrügen nur unter den Voraussetzungen von Art. 97 Abs. 1 BGG (offensichtlich unrichtig = willkürlich); die Verletzung von Grundrechten und kantonalem Recht muss ausdrücklich gerügt und begründet werden (Art. 106 Abs. 2 BGG).",
        "Zulässigkeit der Beschwerde, Rechtsbegehren und Begründung in der Beschwerdeschrift prüfen (Art. 42 BGG).",
      ],
    });
  }

  if (input.area === "tax" || TAX_RE.test(input.text)) {
    routes.push({
      id: "tax-assessment",
      summary:
        "Direkte Bundessteuer: Einsprache gegen die Veranlagungsverfügung bei der Veranlagungsbehörde (30 Tage ab Zustellung), danach Beschwerde an die kantonale Steuerrekurskommission (30 Tage ab Einspracheentscheid) und, gegen Entscheide letzter kantonaler Instanzen, Beschwerde an das Bundesgericht.",
      rules: rules(["dbg-132-1", "dbg-132-3", "dbg-133-1", "dbg-140-1", "dbg-146", "bgg-100-1"]),
      deadlines: [
        {
          description: "Einsprache gegen die Veranlagungsverfügung",
          startEvent:
            "Zustellung der Veranlagungsverfügung (30 Tage; die Frist beginnt am folgenden Tag, Art. 133 Abs. 1 DBG)",
          ruleIds: ["dbg-132-1", "dbg-133-1"],
        },
        {
          description: "Beschwerde an die kantonale Steuerrekurskommission",
          startEvent: "Zustellung des Einspracheentscheids (30 Tage)",
          ruleIds: ["dbg-140-1"],
        },
        {
          description: "Beschwerde an das Bundesgericht",
          startEvent:
            "Eröffnung der vollständigen Ausfertigung des letztinstanzlichen kantonalen Entscheides (30 Tage)",
          ruleIds: ["dbg-146", "bgg-100-1"],
        },
      ],
      notes: [
        "Gilt für die direkte Bundessteuer (DBG). Kantons- und Gemeindesteuern richten sich nach dem kantonalen Steuergesetz (StHG-Rahmen): Fristen und Instanzen dort gesondert prüfen.",
        "Die Einsprache ist zu begründen und muss allfällige Beweismittel nennen (Art. 132 Abs. 3 DBG); Veranlagungen nach pflichtgemässem Ermessen sind nur wegen offensichtlicher Unrichtigkeit anfechtbar.",
        "Fällt der letzte Tag auf einen Samstag, Sonntag oder staatlich anerkannten Feiertag, läuft die Frist am nächsten Werktag ab (Art. 133 Abs. 1 DBG); das Fristende ist mit dem Zustelldatum zu berechnen.",
      ],
    });
  }

  if (input.area === "civil" && SALE_RE.test(`${input.subarea ?? ""} ${input.text}`)) {
    routes.push({
      id: "sale-defects",
      summary:
        "Kaufrechtliche Sachgewährleistung: Mängelanzeige, Verjährung und Wegbedingung hängen vom Vertragsdatum und von Arglist ab.",
      rules: rules([
        "or-197",
        "or-201",
        "or-201-4",
        "or-199",
        "or-210-6",
        "or-367-1bis",
        "or-370-4",
        "or-219-3",
        "or-371-2",
      ]),
      deadlines: [
        {
          description: "Mängelanzeige an den Verkäufer",
          startEvent: "Entdeckung des Mangels (sofort, Art. 201 Abs. 3 OR)",
          ruleIds: ["or-201"],
        },
        {
          description: "Verjährung der Gewährleistungsansprüche beim Kauf eines Gebäudes",
          startEvent:
            "Erwerb des Eigentums (fünf Jahre, Art. 219 Abs. 3 OR in der Fassung bis 31.12.2025)",
          ruleIds: ["or-219-3"],
        },
        {
          description:
            "Verjährung der Mängelansprüche gegen den Unternehmer eines unbeweglichen Werkes",
          startEvent: "Abnahme des Werkes (fünf Jahre, Art. 371 Abs. 2 OR)",
          ruleIds: ["or-371-2"],
        },
      ],
      notes: [
        "Seit dem 1. Januar 2026 gelten für unbewegliche Werke und für integrierte Sachen 60-tägige Rügefristen (Art. 201 Abs. 4, Art. 367 Abs. 1bis und Art. 370 Abs. 4 OR). Das anwendbare Recht hängt vom Vertragsdatum ab: Übergangsrecht prüfen.",
        "Art. 219 Abs. 3 OR ist in der geltenden Fassung aufgehoben; der zitierte Wortlaut gilt nur für Altfälle (Fassung bis 31.12.2025).",
        "Art. 219a OR (Mängelrüge 60 Tage, in Kraft seit 1.1.2026): Anwendung auf Verträge vor dem 1.1.2026 anhand des Übergangsrechts prüfen; die Änderung vom 20.12.2024 enthält keine eigene Übergangsbestimmung.",
        "Art. 210 Abs. 6 OR: Bei nachgewiesener absichtlicher Täuschung kann der Verkäufer die Verjährung nicht geltend machen; Art. 199 OR: Freizeichnung bei arglistigem Verschweigen ungültig.",
      ],
    });
  }
  if (input.area === "social-insurance") {
    routes.push({
      id: "social-insurance",
      summary:
        "Sozialversicherung (ATSG): Einsprache bei der verfügenden Stelle (30 Tage), danach Beschwerde an das kantonale Versicherungsgericht (30 Tage ab Einspracheentscheid) und Beschwerde an das Bundesgericht.",
      rules: rules([
        "atsg-43-1",
        "atsg-52-1",
        "atsg-56-1",
        "atsg-57",
        "atsg-60-1",
        "bgg-82",
        "bgg-100-1",
      ]),
      deadlines: [
        {
          description: "Einsprache gegen die Verfügung",
          startEvent: "Eröffnung der Verfügung (30 Tage)",
          ruleIds: ["atsg-52-1"],
        },
        {
          description: "Beschwerde an das kantonale Versicherungsgericht",
          startEvent: "Eröffnung des Einspracheentscheides (30 Tage)",
          ruleIds: ["atsg-60-1", "atsg-57"],
        },
        {
          description: "Beschwerde an das Bundesgericht",
          startEvent:
            "Eröffnung der vollständigen Ausfertigung des kantonalen Entscheides (30 Tage)",
          ruleIds: ["bgg-82", "bgg-100-1"],
        },
      ],
      notes: [
        "Fristberechnung und Stillstand: Art. 38-41 ATSG (Art. 60 Abs. 2 ATSG); eine nur gegen Unterschrift zugestellte Mitteilung gilt spätestens am siebenten Tag nach dem ersten erfolglosen Zustellungsversuch als erfolgt (Art. 38 Abs. 2bis ATSG, im Text prüfen).",
        "Der Versicherungsträger klärt den Sachverhalt von Amtes wegen ab (Art. 43 ATSG); die versicherte Person hat zumutbare Untersuchungen zu dulden und mitzuwirken.",
        "Ausnahmen von der Beschwerde an das Bundesgericht (Art. 83 BGG) vorab prüfen.",
      ],
    });
  }

  if (input.area === "tenancy") {
    routes.push({
      id: "tenancy-termination",
      summary:
        "Mietrecht: Anfechtung der Kündigung innert 30 Tagen nach Empfang bei der Schlichtungsbehörde; danach Klagefrist von 30 Tagen nach der Klagebewilligung; Beschwerde an das Bundesgericht ab CHF 15 000 Streitwert.",
      rules: rules(["or-271-1", "or-273-1", "zpo-197", "zpo-209-4", "bgg-74-1", "bgg-100-1"]),
      deadlines: [
        {
          description: "Anfechtung der Kündigung bei der Schlichtungsbehörde",
          startEvent: "Empfang der Kündigung (30 Tage)",
          ruleIds: ["or-273-1"],
        },
        {
          description:
            "Klage beim Gericht nach der Klagebewilligung (Miete von Wohn- und Geschäftsräumen)",
          startEvent: "Eröffnung der Klagebewilligung (30 Tage)",
          ruleIds: ["zpo-209-4"],
        },
      ],
      notes: [
        "Die Frist von Art. 273 Abs. 1 OR beginnt mit dem EMPFANG der Kündigung, nicht mit ihrem Datum. Die Erstreckung des Mietverhältnisses (Art. 273 Abs. 2 OR) hat eigene Fristen.",
        "Streitwertgrenze für die Beschwerde in Zivilsachen in mietrechtlichen Fällen: CHF 15 000 (Art. 74 Abs. 1 lit. a BGG).",
      ],
    });
  }

  if (input.area === "debt-enforcement") {
    routes.push({
      id: "debt-enforcement",
      summary:
        "Schuldbetreibung (SchKG): Rechtsvorschlag innert zehn Tagen nach Zustellung des Zahlungsbefehls; Gläubiger verlangt Rechtsöffnung (definitiv oder provisorisch); der Betriebene kann nach provisorischer Rechtsöffnung innert 20 Tagen auf Aberkennung klagen.",
      rules: rules(["schkg-74-1", "schkg-80-1", "schkg-82-1", "schkg-83-2"]),
      deadlines: [
        {
          description: "Rechtsvorschlag gegen den Zahlungsbefehl",
          startEvent: "Zustellung des Zahlungsbefehls (zehn Tage)",
          ruleIds: ["schkg-74-1"],
        },
        {
          description: "Aberkennungsklage nach provisorischer Rechtsöffnung",
          startEvent: "Rechtsöffnung (20 Tage)",
          ruleIds: ["schkg-83-2"],
        },
      ],
      notes: [
        "Wird die Forderung nur teilweise bestritten, ist der bestrittene Betrag genau anzugeben, sonst gilt die ganze Forderung als bestritten (Art. 74 Abs. 2 SchKG).",
        "Die Fristen des SchKG können nicht durch Vertrag geändert werden (Art. 33 Abs. 1 SchKG); verlängert werden kann nur unter den Voraussetzungen von Art. 33 Abs. 2 SchKG.",
      ],
    });
  }

  if (input.area === "criminal") {
    routes.push({
      id: "criminal-procedure",
      summary:
        "Strafverfahren (StPO): Einsprache gegen den Strafbefehl und Beschwerde innert 10 Tagen; Berufung mit Anmeldung innert 10 Tagen und Berufungserklärung innert 20 Tagen; keine Gerichtsferien und keine Erstreckung gesetzlicher Fristen.",
      rules: rules([
        "stpo-354-1",
        "stpo-396-1",
        "stpo-399-1",
        "stpo-399-3",
        "stpo-89",
        "bgg-78-1",
        "bgg-100-1",
      ]),
      deadlines: [
        {
          description: "Einsprache gegen den Strafbefehl",
          startEvent: "Zustellung des Strafbefehls (10 Tage)",
          ruleIds: ["stpo-354-1", "stpo-89"],
        },
        {
          description: "Beschwerde gegen einen Entscheid",
          startEvent: "Eröffnung des Entscheides (10 Tage)",
          ruleIds: ["stpo-396-1"],
        },
        {
          description: "Anmeldung der Berufung",
          startEvent: "Eröffnung des Urteils (10 Tage)",
          ruleIds: ["stpo-399-1"],
        },
        {
          description: "Berufungserklärung",
          startEvent: "Zustellung des begründeten Urteils (20 Tage)",
          ruleIds: ["stpo-399-3"],
        },
      ],
      notes: [
        "Ohne gültige Einsprache wird der Strafbefehl zum rechtskräftigen Urteil (Art. 354 Abs. 3 StPO, im Text prüfen).",
        "Beschwerde in Strafsachen an das Bundesgericht: Art. 78 ff. BGG; es gilt keine Streitwertgrenze.",
      ],
    });
  }

  if (input.area === "employment") {
    routes.push({
      id: "employment-termination",
      summary:
        "Missbräuchliche Kündigung des Arbeitsverhältnisses: schriftliche Einsprache bis zum Ende der Kündigungsfrist; Klage innert 180 Tagen nach Beendigung des Arbeitsverhältnisses, sonst Verwirkung.",
      rules: rules(["or-336b-1", "or-336b-2"]),
      deadlines: [
        {
          description: "Schriftliche Einsprache gegen die Kündigung",
          startEvent: "Kündigung (längstens bis zum Ende der Kündigungsfrist)",
          ruleIds: ["or-336b-1"],
        },
        {
          description: "Klage auf Entschädigung (Verwirkungsfrist)",
          startEvent: "Beendigung des Arbeitsverhältnisses (180 Tage; Klage anhängig machen)",
          ruleIds: ["or-336b-2"],
        },
      ],
      notes: [
        "Diese beiden Fristen sind keine Rechtsmittelfristen und werden von compute_legal_deadline nicht berechnet: von Hand nach dem Ende der Kündigungsfrist bzw. des Arbeitsverhältnisses bestimmen.",
        "Streitwertgrenze für die Beschwerde in Zivilsachen in arbeitsrechtlichen Fällen: CHF 15 000 (Art. 74 Abs. 1 lit. a BGG).",
      ],
    });
  }

  if (input.area === "administrative") {
    routes.push({
      id: "federal-administrative",
      summary:
        "Verwaltungsverfahren des Bundes (VwVG): Beschwerde gegen die Verfügung innert 30 Tagen nach Eröffnung; bei Rechtsverweigerung oder -verzögerung jederzeit. Für kantonale Behörden gilt das kantonale Verfahrensrecht.",
      rules: rules(["vwvg-44", "vwvg-46a", "vwvg-50-1", "bgg-82", "bgg-100-1"]),
      deadlines: [
        {
          description: "Beschwerde gegen die Verfügung",
          startEvent: "Eröffnung der Verfügung (30 Tage)",
          ruleIds: ["vwvg-50-1"],
        },
      ],
      notes: [
        "Das VwVG gilt für Verfügungen von Bundesbehörden. Bei einer kantonalen oder kommunalen Behörde zuerst das anwendbare kantonale Verfahrensgesetz bestimmen.",
        "Rechtsmittelbelehrung der Verfügung prüfen: Instanz, Frist und Form.",
      ],
    });
  }

  return routes;
}
