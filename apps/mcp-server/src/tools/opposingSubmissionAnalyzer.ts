/**
 * Analisis DETERMINISTA del escrito de la parte contraria para preparar la replica.
 *
 * Que hace (todo con texto literal localizable, nada generado por un modelo):
 *  - Divide cada escrito en frases con su ubicacion (documento, Rz./parrafo, posicion).
 *  - Detecta admisiones (Zugestaendnis) y las distingue de las que no lo son: argumentos
 *    eventuales, atribuciones a la otra parte y matices ("zwar ... aber").
 *  - Detecta contradicciones CANDIDATAS: cifras o fechas distintas sobre lo mismo, afirmacion y
 *    negacion de lo mismo, dentro de un escrito, entre escritos y frente a hechos del expediente.
 *  - Marca afirmaciones sin ningun medio de prueba en su parrafo y afirmaciones absolutas.
 *  - Redacta borradores de replica que devuelven a la contraparte SUS PROPIAS frases, con las
 *    normas de apoyo leidas en Fedlex el 2026-11-12 (ZGB 2, ZPO 52/55/150, BV 5/9, StPO 3/6,
 *    VwVG 12, ATSG 43).
 *  - Analiza tambien el escrito PROPIO: lo que la contraparte podria devolvernos.
 *
 * Limites (declarados tambien en la salida): es heuristico (superposicion de raices y patrones
 * lexicos DE/FR), solo ve contradicciones expresadas con palabras parecidas, y NO decide si hay
 * contradiccion juridica: propone candidatas con la cita literal para que una persona las valide.
 */

export type ProcedureFamily = "zpo" | "stpo" | "administrative" | "social_insurance" | "other";
export type OutputLanguage = "de" | "fr" | "it";
export type DocumentAuthor = "opposing_party" | "own_party";
export type FindingType =
  | "admission"
  | "contradiction_within_document"
  | "contradiction_between_documents"
  | "contradicted_by_record"
  | "unsubstantiated_assertion"
  | "absolute_assertion"
  | "misquoted_authority"
  | "own_contradiction"
  | "own_admission"
  | "unanswered_allegation"
  | "misstated_norm_content"
  | "impossible_date_range";
export type Strength = "high" | "medium" | "low";

export interface SubmissionDocument {
  readonly id: string;
  readonly label?: string | undefined;
  readonly author: DocumentAuthor;
  readonly date?: string | undefined;
  readonly text: string;
}

export interface RecordFact {
  readonly id: string;
  readonly statement: string;
  readonly source?: string | undefined;
}

export interface Statement {
  readonly id: string;
  readonly docId: string;
  readonly docLabel: string;
  readonly author: DocumentAuthor | "record";
  readonly paragraphIndex: number;
  readonly marker: string | null;
  readonly location: string;
  readonly offset: number;
  readonly text: string;
  readonly paragraphText: string;
}

export interface FindingPassage {
  readonly docId: string;
  readonly docLabel: string;
  readonly location: string;
  readonly offset: number;
  readonly text: string;
}

export interface Finding {
  readonly id: string;
  readonly type: FindingType;
  readonly strength: Strength;
  readonly passages: readonly FindingPassage[];
  readonly record?: {
    readonly id: string;
    readonly statement: string;
    readonly source: string | null;
  };
  readonly why: string;
  readonly legalAnchors: readonly string[];
  readonly reviewQuestions: readonly string[];
  readonly caveats: readonly string[];
  readonly draftRebuttal: string;
}

export interface AnalyzerInput {
  readonly documents: readonly SubmissionDocument[];
  readonly recordFacts?: readonly RecordFact[] | undefined;
  readonly procedureFamily: ProcedureFamily;
  readonly outputLanguage: OutputLanguage;
  readonly maxFindings: number;
}

export interface AnalyzerOutput {
  readonly statements: number;
  readonly findings: readonly Finding[];
  readonly exposure: readonly Finding[];
  readonly warnings: readonly string[];
}

// ---------------------------------------------------------------------------------------------
// Segmentacion
// ---------------------------------------------------------------------------------------------

const MONTHS =
  "Januar|Jänner|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre";
const ABBREVIATIONS = [
  "Art",
  "Abs",
  "lit",
  "Ziff",
  "Nr",
  "vgl",
  "bzw",
  "ca",
  "Dr",
  "Fr",
  "S",
  "Rz",
  "N",
  "Bst",
  "gem",
  "ff",
  "f",
  "al",
  "let",
  "cf",
  "ch",
  "no",
  "p",
  "resp",
  "etc",
  "inkl",
  "exkl",
  "evtl",
  "ggf",
  "usw",
  "Mio",
  "Mrd",
  "Prof",
  "Abt",
  "Anm",
];
const ABBREV_RE = new RegExp(`\\b(${ABBREVIATIONS.join("|")})\\.`, "g");
const COMPOUND_ABBREV_RE =
  /\b(z\.\s?B|d\.\s?h|u\.\s?a|i\.\s?V\.\s?m|i\.\s?S|v\.\s?a|u\.\s?U|a\.\s?a\.\s?O|e\.\s?V|p\.\s?ex)\./g;
const DATE_DAY_RE = new RegExp(`\\b(\\d{1,2})\\.(?=\\s+(?:${MONTHS})\\b)`, "g");
const MARKER_RE = /^\s*(?:(\d{1,3})\s*[.)]|(?:Rz\.?|N\.?|Ziff\.?|ch\.?)\s*(\d{1,3}))\s+/;

/** Sustituye el punto de abreviaturas y fechas por \u0001 SIN cambiar la longitud. */
function protectDots(text: string): string {
  return text
    .replace(ABBREV_RE, (m) => m.slice(0, -1) + "\u0001")
    .replace(COMPOUND_ABBREV_RE, (m) => m.replace(/\./g, "\u0001"))
    .replace(DATE_DAY_RE, (m) => m.slice(0, -1) + "\u0001");
}

interface RawParagraph {
  readonly start: number;
  readonly end: number;
  readonly marker: string | null;
  readonly textStart: number;
}

function splitParagraphs(text: string): RawParagraph[] {
  const paragraphs: RawParagraph[] = [];
  let current: { start: number; lastEnd: number; marker: string | null; textStart: number } | null =
    null;
  const flush = (): void => {
    if (current && current.lastEnd > current.textStart) {
      paragraphs.push({
        start: current.start,
        end: current.lastEnd,
        marker: current.marker,
        textStart: current.textStart,
      });
    }
    current = null;
  };
  let pos = 0;
  for (const line of text.split("\n")) {
    const lineStart = pos;
    const lineEnd = pos + line.length;
    pos = lineEnd + 1;
    if (line.trim() === "") {
      flush();
      continue;
    }
    const marker = MARKER_RE.exec(line);
    if (marker) {
      flush();
      const markerLabel = marker[1] ?? marker[2] ?? null;
      current = {
        start: lineStart,
        lastEnd: lineEnd,
        marker: markerLabel,
        textStart: lineStart + marker[0].length,
      };
    } else if (current) {
      current.lastEnd = lineEnd;
    } else {
      current = {
        start: lineStart,
        lastEnd: lineEnd,
        marker: null,
        textStart: lineStart + (line.length - line.trimStart().length),
      };
    }
  }
  flush();
  return paragraphs;
}

function splitSentences(text: string, from: number, to: number): { start: number; end: number }[] {
  const slice = protectDots(text.slice(from, to));
  const result: { start: number; end: number }[] = [];
  const boundary = /[.!?;](?:\s+|\n)(?=[A-ZÄÖÜÉÈÀÂÊÎÔÛ«„“"(])/g;
  let last = 0;
  for (const m of slice.matchAll(boundary)) {
    const end = m.index + 1;
    result.push({ start: from + last, end: from + end });
    last = m.index + m[0].length;
  }
  result.push({ start: from + last, end: to });
  return result
    .map((r) => {
      const raw = text.slice(r.start, r.end);
      const lead = raw.length - raw.trimStart().length;
      const trimmed = raw.trim();
      return { start: r.start + lead, end: r.start + lead + trimmed.length };
    })
    .filter((r) => r.end - r.start >= 12);
}

/** Encabezado de seccion ("II. SACHVERHALT", "# **III. BESCHWERDEGRÜNDE**", linea en mayusculas). */
function headingInfo(raw: string): { id: string } | null {
  const t = raw
    .replace(/[#*_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length < 3 || t.length > 160) return null;
  const letters = t.replace(/[^\p{L}]/gu, "");
  const upper = t.replace(/[^\p{Lu}]/gu, "");
  const mostlyUpper = letters.length >= 6 && upper.length / letters.length >= 0.8;
  const roman = /^([IVX]{1,6}|[A-Z])\.\s+(\S.*)$/.exec(t);
  if (roman && (mostlyUpper || (!/[.!?]$/.test(t) && t.length <= 100))) return { id: roman[1]! };
  if (mostlyUpper) return { id: t.slice(0, 40) };
  return null;
}

export function segmentDocument(
  doc: { id: string; label: string; author: Statement["author"]; text: string },
  startIndex: number,
): Statement[] {
  const statements: Statement[] = [];
  const paragraphs = splitParagraphs(doc.text);
  let counter = startIndex;
  let section: string | null = null;
  let sectionParagraph = 0;
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphText = doc.text.slice(paragraph.textStart, paragraph.end).trim();
    // La primera linea corta sin punto final es el titulo del escrito: no es un parrafo.
    if (
      paragraphIndex === 0 &&
      !paragraph.marker &&
      paragraphText.length <= 100 &&
      !/[.!?]$/.test(paragraphText)
    ) {
      return;
    }
    const heading = paragraph.marker ? null : headingInfo(paragraphText);
    if (heading) {
      section = heading.id;
      sectionParagraph = 0;
      return;
    }
    sectionParagraph += 1;
    for (const s of splitSentences(doc.text, paragraph.textStart, paragraph.end)) {
      counter += 1;
      const inSection = `Abs. ${sectionParagraph}`;
      const label = paragraph.marker ? `Rz. ${paragraph.marker}` : inSection;
      const sectionLabel = section
        ? `, Abschnitt ${section.length > 6 ? `«${section}»` : section}`
        : "";
      statements.push({
        id: `S${counter}`,
        docId: doc.id,
        docLabel: doc.label,
        author: doc.author,
        paragraphIndex,
        marker: paragraph.marker,
        location: `${doc.label}${sectionLabel}, ${label}`,
        offset: s.start,
        text: doc.text.slice(s.start, s.end),
        paragraphText,
      });
    }
  });
  return statements;
}

// ---------------------------------------------------------------------------------------------
// Rasgos de una frase
// ---------------------------------------------------------------------------------------------

const ADMISSION_RE =
  /\b(?:r[äa]um\w*\s+(?:\w+\s+){0,3}ein|gibt\s+(?:\w+\s+){0,2}zu|gesteht|zugestanden|zugegeben|anerkennt|anerkannt|unbestritten\w*|nicht\s+bestritten|nicht\s+in\s+abrede|trifft\s+zu|ist\s+(?:richtig|korrekt|zutreffend)|zutreffend\s+ist|korrekt\s+ist|admet|reconna[iî]t|conc[èe]de|n['’]est\s+pas\s+contest\w+|incontest\w+|il\s+est\s+exact|est\s+exact|ammette|riconosce|incontestat\w+|non\s+(?:è|e)\s+contestat\w+)\b/i;
const NEGATED_ADMISSION_RE =
  /\b(?:r[äa]um\w*\s+(?:\w+\s+){0,3}nicht\s+ein|gibt\s+(?:\w+\s+){0,2}nicht\s+zu|nicht\s+(?:richtig|korrekt|zutreffend)|trifft\s+nicht\s+zu|bestreit\w+|ne\s+reconna[iî]t\s+pas|n['’]admet\s+pas|contest\w+)\b/i;
const HEDGE_RE =
  /\b(?:zwar|allerdings|jedoch|indessen|sofern|falls|hypothetisch|certes|toutefois|cependant|à\s+supposer|même\s+si|tuttavia|pur\s+essendo)\b/i;
const EVENTUAL_RE =
  /\b(?:eventualiter|subeventualiter|eventuell|selbst\s+wenn|angenommen|unterstellt|par\s+hypoth[èe]se|à\s+titre\s+subsidiaire|subsidiairement|en\s+tout\s+[ée]tat\s+de\s+cause)\b/i;
const REPORTED_SPEECH_RE =
  /\b(?:behauptet\w*|macht\s+geltend|machen\s+geltend|führt\s+aus|führen\s+aus|bringt\s+vor|bringen\s+vor|argumentiert|ist\s+der\s+(?:ansicht|auffassung)|prétend\w*|soutient|soutiennent|allègue\w*|fait\s+valoir)\b/i;
const ABSOLUTE_RE =
  /\b(?:nie|niemals|stets|immer|jederzeit|ausnahmslos|keinesfalls|zu\s+keinem\s+zeitpunkt|in\s+keinem\s+fall|sämtliche\w*|jamais|toujours|en\s+aucun\s+cas|à\s+aucun\s+moment|aucunement)\b/i;
const EVIDENCE_RE =
  /\b(?:beilage\w*|beil\.|act\.|beweismittel\w*|urkunde\w*|zeug\w+|edition|gutachten|expertise|beweis\w*|pi[èe]ces?|moyens?\s+de\s+preuve|annexes?|allegat\w+|prova|bo\s*:)\b|\b(?:beil\.|act\.)\s*\d+|\bBO\b/i;
const LEGAL_RE =
  /\bArt\.\s*\d|\bBGE\b|\bATF\b|\bDTF\b|\b\d[A-Z][_.]\d+\/\d{4}\b|rechtswidrig|nichtig/i;
const NEGATION_RE =
  /\b(?:nicht|kein(?:e|en|em|er|es)?|nie|niemals|weder|keinesfalls|aucun\w*|jamais|sans|ne\s+\S+\s+pas|nessun\w*)\b/i;

const STOPWORDS = new Set(
  (
    "dass daß dies diese dieser dieses diesen diesem eine einen einem einer eines sind wird wurde wurden werden haben hatte hatten sein seine seiner seinen ihrer ihre ihren nicht auch oder aber sowie nach beim bei vom von zum zur über unter durch gegen ohne weil dann doch noch nur schon sich ihm ihn ihr wir sie aus als wie wenn mehr sehr hier dort damit dafür dabei davon dazu darauf daher deshalb also jedoch allerdings ferner zudem insbesondere gemäss " +
    "dans pour avec sans sont être avoir cette cela leur leurs plus mais donc ainsi aussi comme entre sous sur par"
  ).split(" "),
);

function stems(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^\p{L}]+/u)) {
    if (raw.length < 4 || STOPWORDS.has(raw)) continue;
    out.add(raw.slice(0, 6));
  }
  return out;
}

type NumberKind = "amount" | "date" | "percent" | "days" | "weeks" | "months" | "years" | "hours";

function normalizeAmount(raw: string): string | null {
  let value = raw.replace(/['’\s]/g, "").replace(/[.,]+$/, "");
  const lastDot = value.lastIndexOf(".");
  const lastComma = value.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    value =
      lastComma > lastDot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (lastComma >= 0) {
    value = /,\d{1,2}$/.test(value) ? value.replace(",", ".") : value.replace(/,/g, "");
  }
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

const MONTH_INDEX: Record<string, number> = {
  januar: 1,
  jänner: 1,
  janvier: 1,
  februar: 2,
  février: 2,
  märz: 3,
  mars: 3,
  april: 4,
  avril: 4,
  mai: 5,
  juni: 6,
  juin: 6,
  juli: 7,
  juillet: 7,
  august: 8,
  août: 8,
  september: 9,
  septembre: 9,
  oktober: 10,
  octobre: 10,
  november: 11,
  novembre: 11,
  dezember: 12,
  décembre: 12,
};

function isoDate(y: string, m: number, d: string): string | null {
  const dd = Number(d);
  if (m < 1 || m > 12 || dd < 1 || dd > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function extractNumbers(text: string): Map<NumberKind, Set<string>> {
  const out = new Map<NumberKind, Set<string>>();
  const add = (kind: NumberKind, value: string | null): void => {
    if (!value) return;
    const set = out.get(kind) ?? new Set<string>();
    set.add(value);
    out.set(kind, set);
  };
  for (const m of text.matchAll(/(?:CHF|Fr\.|SFr\.|EUR|€)\s*(\d[\d'’.,]*)/g)) {
    add("amount", normalizeAmount(m[1]!));
  }
  for (const m of text.matchAll(/(\d[\d'’.,]*)\s*(?:Franken|francs|CHF)\b/g)) {
    add("amount", normalizeAmount(m[1]!));
  }
  for (const m of text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g)) {
    add("date", isoDate(m[3]!, Number(m[2]), m[1]!));
  }
  for (const m of text.matchAll(
    new RegExp(`\\b(\\d{1,2})(?:\\.|er)?\\s+(${MONTHS})\\s+(\\d{4})\\b`, "gi"),
  )) {
    add("date", isoDate(m[3]!, MONTH_INDEX[m[2]!.toLowerCase()] ?? 0, m[1]!));
  }
  for (const m of text.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*(?:%|Prozent|pour\s+cent)/g)) {
    add("percent", normalizeAmount(m[1]!));
  }
  const durations: [RegExp, NumberKind][] = [
    [/\b(\d{1,3})\s*(?:Tage[n]?|jours?|giorni)\b/gi, "days"],
    [/\b(\d{1,3})\s*(?:Wochen|semaines?|settimane)\b/gi, "weeks"],
    [/\b(\d{1,3})\s*(?:Monat[e]?[n]?|mois|mesi)\b/gi, "months"],
    [/\b(\d{1,3})\s*(?:Jahr[e]?[n]?|ans?|années?|anni)\b/gi, "years"],
    [/\b(\d{1,3})\s*(?:Stunden|heures?|ore)\b/gi, "hours"],
  ];
  for (const [re, kind] of durations) {
    for (const m of text.matchAll(re)) add(kind, String(Number(m[1])));
  }
  return out;
}

interface Features {
  readonly statement: Statement;
  readonly stems: Set<string>;
  readonly numbers: Map<NumberKind, Set<string>>;
  readonly negated: boolean;
  readonly admission: boolean;
  readonly qualified: boolean;
  readonly eventual: boolean;
  readonly reported: boolean;
  readonly absolute: boolean;
  readonly legal: boolean;
  readonly evidenceInParagraph: boolean;
}

/** "wird nicht anerkannt" o "kein Anspruch ... anerkannt" son lo contrario de una admision. */
function isRealAdmission(t: string): boolean {
  const m = ADMISSION_RE.exec(t);
  if (!m || NEGATED_ADMISSION_RE.test(t)) return false;
  const clause =
    t
      .slice(Math.max(0, m.index - 60), m.index)
      .split(/[,;:]/)
      .pop() ?? "";
  return !NEGATION_RE.test(clause);
}

function featuresOf(statement: Statement): Features {
  const t = statement.text;
  return {
    statement,
    stems: stems(t),
    numbers: extractNumbers(t),
    negated: NEGATION_RE.test(t),
    admission: isRealAdmission(t),
    qualified: HEDGE_RE.test(t),
    eventual: EVENTUAL_RE.test(t) || EVENTUAL_RE.test(statement.paragraphText.slice(0, 120)),
    reported: REPORTED_SPEECH_RE.test(t),
    absolute: ABSOLUTE_RE.test(t),
    legal: LEGAL_RE.test(t),
    evidenceInParagraph: EVIDENCE_RE.test(statement.paragraphText),
  };
}

// ---------------------------------------------------------------------------------------------
// Comparacion de frases
// ---------------------------------------------------------------------------------------------

function jaccard(a: Set<string>, b: Set<string>): { score: number; shared: number } {
  let shared = 0;
  for (const s of a) if (b.has(s)) shared += 1;
  const union = a.size + b.size - shared;
  return { score: union === 0 ? 0 : shared / union, shared };
}

interface Conflict {
  readonly kind: "numeric" | "polarity";
  /** Descripcion en español, solo para los campos 'why' dirigidos al usuario. */
  readonly detail: string;
  readonly score: number;
  readonly numeric?: { readonly unit: NumberKind; readonly a: string[]; readonly b: string[] };
}

const UNIT_LABEL: Record<OutputLanguage, Record<NumberKind, string>> = {
  de: {
    amount: "Betrag",
    date: "Datum",
    percent: "Prozentsatz",
    days: "Tage",
    weeks: "Wochen",
    months: "Monate",
    years: "Jahre",
    hours: "Stunden",
  },
  fr: {
    amount: "montant",
    date: "date",
    percent: "pourcentage",
    days: "jours",
    weeks: "semaines",
    months: "mois",
    years: "années",
    hours: "heures",
  },
  it: {
    amount: "importo",
    date: "data",
    percent: "percentuale",
    days: "giorni",
    weeks: "settimane",
    months: "mesi",
    years: "anni",
    hours: "ore",
  },
};

/** Detalle del conflicto en el idioma del borrador (nunca en español dentro de un escrito). */
function detailFor(c: Conflict, lang: OutputLanguage): string {
  if (c.numeric) {
    const label = UNIT_LABEL[lang][c.numeric.unit];
    const a = c.numeric.a.join("/");
    const b = c.numeric.b.join("/");
    return lang === "fr" ? `${label} : ${a} contre ${b}` : `${label}: ${a} gegenüber ${b}`;
  }
  return lang === "fr"
    ? "l'une des affirmations affirme ce que l'autre nie"
    : "die eine Aussage bejaht, was die andere verneint";
}

const SCOPE_MARKER_RE =
  /^(?:erst|zweit|dritt|viert|fünft|sechst|siebt|neunt|zehnt|janua|febru|märz|april|juni|juli|augus|septe|oktob|novem|dezem|janvi|févri|mars|avril|juin|juill|août|décem|premi|deuxi|troisi|quatr|cinqu)/;

function compare(a: Features, b: Features, minScore: number, minShared: number): Conflict | null {
  if (a.stems.size < 4 || b.stems.size < 4) return null;
  const { score, shared } = jaccard(a.stems, b.stems);
  if (score < minScore || shared < minShared) return null;
  for (const [kind, valuesA] of a.numbers) {
    const valuesB = b.numbers.get(kind);
    if (!valuesB) continue;
    const common = [...valuesA].some((v) => valuesB.has(v));
    if (!common) {
      // Si las frases difieren en un ordinal o un mes, hablan de supuestos distintos
      // (p. ej. "segundo año: 60 dias" frente a "tercer año: 90 dias"): no es contradiccion.
      const onlyA = [...a.stems].filter((x) => !b.stems.has(x));
      const onlyB = [...b.stems].filter((x) => !a.stems.has(x));
      if ([...onlyA, ...onlyB].some((x) => SCOPE_MARKER_RE.test(x))) continue;
      return {
        kind: "numeric",
        score,
        detail: `${kind}: ${[...valuesA].join("/")} frente a ${[...valuesB].join("/")}`,
        numeric: { unit: kind, a: [...valuesA], b: [...valuesB] },
      };
    }
  }
  if (a.negated !== b.negated && score >= Math.max(minScore, 0.6) && shared >= 5) {
    return {
      kind: "polarity",
      score,
      detail: "una frase afirma y la otra niega lo mismo (mismas palabras clave)",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Normas de apoyo (texto leido en Fedlex el 2026-11-12) y redaccion
// ---------------------------------------------------------------------------------------------

interface Anchors {
  readonly goodFaith: string;
  readonly goodFaithProcedure: string;
  readonly noProofNeeded: string;
  readonly mustSubstantiate: string;
  readonly inquisitorial: string;
}

function anchorsFor(family: ProcedureFamily, lang: OutputLanguage): Anchors {
  const fr = lang === "fr";
  const zgb = fr ? "art. 2 al. 1 CC" : "Art. 2 Abs. 1 ZGB";
  const bv = fr ? "art. 5 al. 3 Cst." : "Art. 5 Abs. 3 BV";
  switch (family) {
    case "zpo":
      return {
        goodFaith: zgb,
        goodFaithProcedure: fr ? "art. 52 CPC" : "Art. 52 ZPO",
        noProofNeeded: fr ? "art. 150 al. 1 CPC" : "Art. 150 Abs. 1 ZPO",
        mustSubstantiate: fr ? "art. 55 al. 1 CPC" : "Art. 55 Abs. 1 ZPO",
        inquisitorial: "",
      };
    case "stpo":
      return {
        goodFaith: fr ? "art. 3 al. 2 let. a CPP" : "Art. 3 Abs. 2 lit. a StPO",
        goodFaithProcedure: fr ? "art. 3 al. 2 let. b CPP" : "Art. 3 Abs. 2 lit. b StPO",
        noProofNeeded: "",
        mustSubstantiate: "",
        inquisitorial: fr ? "art. 6 CPP" : "Art. 6 StPO",
      };
    case "administrative":
      return {
        goodFaith: bv,
        goodFaithProcedure: fr ? "art. 9 Cst." : "Art. 9 BV",
        noProofNeeded: "",
        mustSubstantiate: "",
        inquisitorial: fr ? "art. 12 PA" : "Art. 12 VwVG",
      };
    case "social_insurance":
      return {
        goodFaith: bv,
        goodFaithProcedure: fr ? "art. 9 Cst." : "Art. 9 BV",
        noProofNeeded: "",
        mustSubstantiate: "",
        inquisitorial: fr ? "art. 43 LPGA" : "Art. 43 ATSG",
      };
    default:
      return {
        goodFaith: bv,
        goodFaithProcedure: fr ? "art. 9 Cst." : "Art. 9 BV",
        noProofNeeded: "",
        mustSubstantiate: "",
        inquisitorial: "",
      };
  }
}

function q(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= 700) return `«${t}»`;
  return `«${t.slice(0, 350).trimEnd()} […] ${t.slice(-250).trimStart()}»`;
}

const CHECK = (lang: OutputLanguage): string => (lang === "fr" ? "[À VÉRIFIER" : "[PRÜFEN");

type AdmissionMode = "firm" | "qualified" | "legal" | "eventual" | "reported";

function admissionMode(f: Features): AdmissionMode {
  if (f.reported) return "reported";
  if (f.eventual) return "eventual";
  if (f.legal) return "legal";
  if (f.qualified) return "qualified";
  return "firm";
}

function draftAdmission(f: Features, a: Anchors, lang: OutputLanguage): string {
  const loc = f.statement.location;
  const quote = q(f.statement.text);
  const check = CHECK(lang);
  const mode = admissionMode(f);
  if (lang === "fr") {
    if (mode === "reported") {
      return `[NE PAS UTILISER COMME AVEU : le passage (${loc}) ${quote} semble résumer la position d'une autre personne et non un aveu de la partie adverse. Vérifier l'auteur de l'affirmation.]`;
    }
    if (mode === "eventual") {
      return `Même selon la partie adverse, ne serait-ce qu'à titre subsidiaire (${loc}) : ${quote}. Cette concession reste subordonnée à sa position principale et ne vaut pas aveu du fait ; elle montre toutefois que la partie adverse n'exclut pas le principe de la prétention. ${check} : une argumentation subsidiaire ne lie pas ; l'utiliser comme argument et non comme fait non contesté.]`;
    }
    if (mode === "legal") {
      return `La partie adverse reconnaît (${loc}) : ${quote}. Il s'agit d'une appréciation juridique, qui ne lie pas le tribunal, mais qui peut être invoquée comme argument (${a.goodFaith}). ${check} : ne pas la présenter comme un fait non contesté.]`;
    }
    const base = `La partie adverse admet elle-même (${loc}) : ${quote}.`;
    const limit =
      mode === "qualified"
        ? " La partie adverse restreint toutefois elle-même cette concession ; il convient de répondre à la restriction."
        : "";
    if (a.noProofNeeded) {
      return `${base}${limit} Ce fait n'est dès lors pas litigieux ; la preuve ne porte que sur les faits pertinents et contestés (${a.noProofNeeded}). ${check} : le fait est-il pertinent et la partie adverse ne l'a-t-elle pas retiré ou nuancé ailleurs ?]`;
    }
    return `${base}${limit} La partie adverse doit se laisser opposer cette déclaration (${a.goodFaith}). ${check} : ${a.inquisitorial ? `la maxime inquisitoire (${a.inquisitorial}) ne lie pas l'autorité ; l'aveu vaut comme déclaration de partie. ` : ""}confirmer le contexte.]`;
  }
  if (mode === "reported") {
    return `[NICHT ALS ZUGESTÄNDNIS VERWENDEN: Die Passage (${loc}) ${quote} gibt offenbar die Position einer anderen Person wieder und ist kein Zugeständnis der Gegenpartei. Urheber der Aussage prüfen.]`;
  }
  if (mode === "eventual") {
    return `Selbst nach Auffassung der Gegenpartei, wenn auch nur eventualiter (${loc}): ${quote}. Dieses Vorbringen steht unter dem Vorbehalt ihres Hauptstandpunkts und ist kein Zugeständnis der Tatsache; es zeigt aber, dass die Gegenpartei den Anspruch dem Grundsatz nach nicht ausschliesst. ${check}: Eventualvorbringen binden nicht; nur als Argument verwenden, nicht als unbestrittene Tatsache.]`;
  }
  if (mode === "legal") {
    return `Die Gegenpartei anerkennt in ${loc}: ${quote}. Es handelt sich um eine rechtliche Würdigung, die das Gericht nicht bindet, aber als Argument entgegengehalten werden kann (${a.goodFaith}). ${check}: Nicht als unbestrittene Tatsache darstellen.]`;
  }
  const base = `Die Gegenpartei räumt in ${loc} selbst ein: ${quote}.`;
  const limit =
    mode === "qualified"
      ? " Die Gegenpartei schränkt dieses Zugeständnis allerdings selbst ein; der Einschränkung ist im Einzelnen zu begegnen."
      : "";
  if (a.noProofNeeded) {
    return `${base}${limit} Diese Tatsache ist damit nicht streitig; Beweis ist nur über rechtserhebliche, streitige Tatsachen zu führen (${a.noProofNeeded}). ${check}: Ist die Tatsache rechtserheblich, und hat die Gegenpartei sie an anderer Stelle nicht widerrufen oder relativiert?]`;
  }
  return `${base}${limit} Die Gegenpartei hat sich bei dieser Aussage behaften zu lassen (${a.goodFaith}). ${check}: ${a.inquisitorial ? `Es gilt der Untersuchungsgrundsatz (${a.inquisitorial}); das Zugeständnis bindet die Behörde nicht, ist aber als Parteiauskunft zu würdigen. ` : ""}Kontext bestätigen.]`;
}

function draftContradiction(
  a: Features,
  b: Features,
  c: Conflict,
  an: Anchors,
  lang: OutputLanguage,
  within: boolean,
): string {
  const check = CHECK(lang);
  const anchorList = [an.goodFaith, an.goodFaithProcedure].filter((x) => x).join(", ");
  if (lang === "fr") {
    return `La partie adverse se contredit. Elle expose (${a.statement.location}) : ${q(a.statement.text)}, alors qu'elle soutient (${b.statement.location}) : ${q(b.statement.text)}. Ces deux affirmations ne sont pas conciliables (${detailFor(c, lang)}). Un tel comportement contradictoire ne mérite pas la protection du droit (${anchorList}). ${check} : ${within ? "" : "les deux écritures portent-elles sur le même fait et la même période ? "}la divergence est-elle réelle et non une différence de périmètre ?]`;
  }
  return `Die Gegenpartei widerspricht sich selbst. Sie führt in ${a.statement.location} aus: ${q(a.statement.text)}, während sie in ${b.statement.location} geltend macht: ${q(b.statement.text)}. Beide Vorbringen lassen sich nicht miteinander vereinbaren (${detailFor(c, lang)}). Ein solch widersprüchliches Verhalten verdient keinen Rechtsschutz (${anchorList}). ${check}: ${within ? "" : "Beziehen sich beide Eingaben auf dieselbe Tatsache und denselben Zeitraum? "}Liegt ein echter Widerspruch vor und nicht bloss ein unterschiedlicher Bezugsrahmen?]`;
}

function draftRecord(
  f: Features,
  fact: RecordFact,
  c: Conflict,
  an: Anchors,
  lang: OutputLanguage,
): string {
  const src = fact.source ? ` (${fact.source})` : "";
  const check = CHECK(lang);
  if (lang === "fr") {
    return `L'allégation de la partie adverse (${f.statement.location}) : ${q(f.statement.text)} est contredite par le dossier (${fact.id}${src}) : ${q(fact.statement)} (${detailFor(c, lang)}). Elle est expressément contestée.${an.mustSubstantiate ? ` Il appartient à la partie adverse d'alléguer les faits et d'indiquer les moyens de preuve (${an.mustSubstantiate}).` : ""} ${check} : la pièce est-elle bien au dossier et porte-t-elle sur le même fait ?]`;
  }
  return `Die Behauptung der Gegenpartei (${f.statement.location}): ${q(f.statement.text)} steht im Widerspruch zu den Akten (${fact.id}${src}): ${q(fact.statement)} (${detailFor(c, lang)}). Sie wird ausdrücklich bestritten.${an.mustSubstantiate ? ` Es obliegt der Gegenpartei, die Tatsachen darzulegen und die Beweismittel anzugeben (${an.mustSubstantiate}).` : ""} ${check}: Ist die Urkunde aktenkundig, und bezieht sie sich auf dieselbe Tatsache?]`;
}

function draftUnsubstantiated(f: Features, an: Anchors, lang: OutputLanguage): string {
  const check = CHECK(lang);
  if (lang === "fr") {
    return `L'allégation de la partie adverse (${f.statement.location}) : ${q(f.statement.text)} n'est étayée par aucun moyen de preuve. Elle est contestée.${an.mustSubstantiate ? ` La partie qui allègue doit indiquer ses moyens de preuve (${an.mustSubstantiate}).` : ""} ${check} : aucune pièce n'est-elle citée plus loin dans l'écriture ?]`;
  }
  return `Die Behauptung der Gegenpartei (${f.statement.location}): ${q(f.statement.text)} ist mit keinem Beweismittel belegt und wird bestritten.${an.mustSubstantiate ? ` Wer Tatsachen behauptet, hat die Beweismittel anzugeben (${an.mustSubstantiate}).` : ""} ${check}: Wird an anderer Stelle der Eingabe ein Beweismittel genannt?]`;
}

function draftAbsolute(f: Features, lang: OutputLanguage): string {
  const check = CHECK(lang);
  if (lang === "fr") {
    return `La partie adverse affirme de manière absolue (${f.statement.location}) : ${q(f.statement.text)}. Un seul contre-exemple suffit à réfuter cette affirmation : ${check} : citer ici la pièce ou le fait du dossier qui la contredit.]`;
  }
  return `Die Gegenpartei behauptet in ${f.statement.location} uneingeschränkt: ${q(f.statement.text)}. Ein einziges Gegenbeispiel widerlegt diese Behauptung: ${check}: Hier die Urkunde bzw. Tatsache aus den Akten einsetzen, die dem widerspricht.]`;
}

function draftUnanswered(f: Features, a: Anchors, lang: OutputLanguage): string {
  const check = CHECK(lang);
  if (lang === "fr") {
    return `Il a été allégué (${f.statement.location}) : ${q(f.statement.text)}. La partie adverse ne s'est pas déterminée sur ce fait ; elle ne l'a ni admis ni contesté en particulier, comme l'exige ${a.noProofNeeded ? "l'art. 222 al. 2 CPC" : "la procédure"}. Ce fait n'est dès lors pas litigieux et il n'y a pas lieu de l'établir (${a.noProofNeeded}). ${check} : la partie adverse l'a-t-elle contesté en d'autres termes ? Sa contestation générale suffit-elle ?]`;
  }
  return `In ${f.statement.location} wurde vorgebracht: ${q(f.statement.text)}. Die Gegenpartei hat sich dazu nicht geäussert; sie hat diese Tatsachenbehauptung weder anerkannt noch im Einzelnen bestritten, wie es Art. 222 Abs. 2 ZPO verlangt. Die Tatsache ist daher nicht streitig, und darüber ist kein Beweis zu führen (${a.noProofNeeded}). ${check}: Hat die Gegenpartei sie mit anderen Worten bestritten? Enthält ihre Eingabe eine Pauschalbestreitung, und genügt diese?]`;
}

export function draftNormContent(
  where: string,
  citation: string,
  theirText: string,
  unit: string,
  theirValues: string[],
  officialValues: string[],
  lang: OutputLanguage,
): string {
  const check = CHECK(lang);
  const label = UNIT_LABEL[lang === "it" ? "de" : lang][unit as NumberKind] ?? unit;
  if (lang === "fr") {
    return `La partie adverse se réfère à ${citation} (${where}) : ${q(theirText)}. Or ${citation} ne mentionne pas ${theirValues.join("/")} (${label}), mais ${officialValues.join("/")}. L'argumentation repose ainsi sur un contenu inexact de la norme. ${check} : lire l'article dans sa version applicable à la date pertinente et vérifier que le chiffre ne vise pas un autre cas.]`;
  }
  return `Die Gegenpartei beruft sich in ${where} auf ${citation}: ${q(theirText)}. ${citation} nennt jedoch nicht ${theirValues.join("/")} (${label}), sondern ${officialValues.join("/")}. Die Argumentation beruht damit auf einem unzutreffenden Normgehalt. ${check}: Artikel in der zum massgebenden Zeitpunkt geltenden Fassung lesen und prüfen, ob die Zahl nicht einen anderen Fall betrifft.]`;
}

const DATE_TOKEN = `(?:\\d{1,2}\\.\\d{1,2}\\.\\d{4}|\\d{1,2}(?:\\.|er)?\\s+(?:${MONTHS})\\s+\\d{4})`;
const RANGE_RE = new RegExp(
  `\\b(?:vom|von|ab\\s+dem|zwischen\\s+dem|du|entre\\s+le)\\s+(${DATE_TOKEN})\\s+(?:bis\\s+und\\s+mit|bis\\s+zum|bis|und\\s+dem|und|au|et\\s+le)\\s+(${DATE_TOKEN})`,
  "gi",
);

function dateTokenToIso(token: string): string | null {
  const numeric = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(token);
  if (numeric) return isoDate(numeric[3]!, Number(numeric[2]), numeric[1]!);
  const written = new RegExp(`^(\\d{1,2})(?:\\.|er)?\\s+(${MONTHS})\\s+(\\d{4})$`, "i").exec(token);
  if (written)
    return isoDate(written[3]!, MONTH_INDEX[written[2]!.toLowerCase()] ?? 0, written[1]!);
  return null;
}

export interface ImpossibleRange {
  readonly start: string;
  readonly end: string;
}

/** Periodos "vom X bis Y" cuyo final es anterior al principio. Solo lee fechas completas. */
export function findImpossibleDateRanges(text: string): ImpossibleRange[] {
  const out: ImpossibleRange[] = [];
  for (const m of text.matchAll(RANGE_RE)) {
    const a = dateTokenToIso(m[1]!);
    const b = dateTokenToIso(m[2]!);
    if (a && b && b < a) out.push({ start: a, end: b });
  }
  return out;
}

const ACT_DATE_RE = new RegExp(
  `\\b(Verfügung|Entscheid|Urteil|Beschluss)\\s+(?:des|der)\\s+([^.,;()]{3,80}?)\\s+vom\\s+(${DATE_TOKEN})`,
  "gi",
);

export interface ActDate {
  readonly key: string;
  readonly iso: string;
}

/** "Verfügung des <Autoridad> vom <fecha>": la misma resolución con la misma autoridad. */
export function actDatesIn(text: string): ActDate[] {
  const out: ActDate[] = [];
  for (const m of text.matchAll(ACT_DATE_RE)) {
    const iso = dateTokenToIso(m[3]!);
    if (!iso) continue;
    const authority = m[2]!.toLowerCase().replace(/\s+/g, " ").trim();
    out.push({ key: `${m[1]!.toLowerCase()}|${authority}`, iso });
  }
  return out;
}

/** Pares de frases que dan fechas distintas a la misma resolución de la misma autoridad. */
function actDateConflicts(
  group: readonly Features[],
): { a: Features; b: Features; d1: string; d2: string }[] {
  const firstSeen = new Map<string, { f: Features; iso: string }[]>();
  for (const f of group) {
    for (const d of actDatesIn(f.statement.text)) {
      const list = firstSeen.get(d.key) ?? [];
      if (!list.some((x) => x.iso === d.iso)) list.push({ f, iso: d.iso });
      firstSeen.set(d.key, list);
    }
  }
  const out: { a: Features; b: Features; d1: string; d2: string }[] = [];
  for (const list of firstSeen.values()) {
    if (list.length < 2) continue;
    const [first, second] = list;
    if (first && second && first.f.statement.id !== second.f.statement.id) {
      out.push({ a: first.f, b: second.f, d1: first.iso, d2: second.iso });
    }
  }
  return out;
}

function draftImpossibleRange(
  f: Features,
  r: ImpossibleRange,
  lang: OutputLanguage,
  own: boolean,
): string {
  const check = CHECK(lang);
  if (own) return "";
  if (lang === "fr") {
    return `La partie adverse allègue (${f.statement.location}) : ${q(f.statement.text)}. La période indiquée est contradictoire en soi : la date de fin (${r.end}) précède la date de début (${r.start}). L'indication est inexploitable et elle est contestée. ${check} : s'agit-il d'une simple erreur de plume que la partie adverse pourrait rectifier, et quelle période était visée ?]`;
  }
  return `Die Gegenpartei macht in ${f.statement.location} geltend: ${q(f.statement.text)}. Der angegebene Zeitraum ist in sich widersprüchlich: Das Enddatum (${r.end}) liegt vor dem Anfangsdatum (${r.start}). Die Angabe ist unbrauchbar und wird bestritten. ${check}: Handelt es sich um einen blossen Schreibfehler, den die Gegenpartei berichtigen könnte, und welcher Zeitraum war gemeint?]`;
}

/**
 * Recorta el texto oficial al tramo que corresponde a la cita de la contraparte: desde donde
 * empieza su cita hasta el final de esa frase o apartado. Nunca corta a mitad de palabra y marca
 * con [...] si no pudo cerrar la frase.
 */
export function officialExcerpt(closest: string | null, theirQuote: string): string | null {
  if (!closest) return null;
  const text = closest.replace(/\s+/g, " ").trim();
  const probe = theirQuote.replace(/\s+/g, " ").trim().slice(0, 20).toLowerCase();
  const found = probe.length >= 10 ? text.toLowerCase().indexOf(probe) : -1;
  const from = found >= 0 ? found : 0;
  const rest = text.slice(from);
  const minLen = Math.floor(theirQuote.length * 0.6);
  const re = /[.;]\s+(?=\d+\s|[A-ZÄÖÜÉÈÀ])/g;
  for (const m of rest.matchAll(re)) {
    if (m.index + 1 >= minLen) return rest.slice(0, m.index + 1);
  }
  const cut = rest.slice(0, Math.max(minLen, theirQuote.length + 40));
  if (cut.length >= rest.length) return rest.replace(/…$/, "").trim();
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()} [...]`;
}

export function draftMisquote(
  where: string,
  citation: string,
  theirText: string,
  officialText: string | null,
  lang: OutputLanguage,
): string {
  const check = CHECK(lang);
  if (lang === "fr") {
    return `La partie adverse cite ${citation} (${where}) comme suit : ${q(theirText)}. Cette citation n'est pas littérale.${officialText ? ` Le texte officiel est : ${q(officialText)}.` : ""} L'argumentation repose ainsi sur un texte inexact. ${check} : comparer avec le texte officiel en vigueur à la date pertinente.]`;
  }
  return `Die Gegenpartei zitiert ${citation} (${where}) wie folgt: ${q(theirText)}. Dieses Zitat ist nicht wörtlich.${officialText ? ` Massgebend ist der amtliche Wortlaut: ${q(officialText)}.` : ""} Die Argumentation stützt sich damit auf einen unzutreffenden Normtext. ${check}: Mit dem amtlichen Text in der massgebenden Fassung vergleichen.]`;
}

// ---------------------------------------------------------------------------------------------
// Analisis
// ---------------------------------------------------------------------------------------------

const MAX_STATEMENTS = 1500;

function passageOf(s: Statement): FindingPassage {
  return {
    docId: s.docId,
    docLabel: s.docLabel,
    location: s.location,
    offset: s.offset,
    text: s.text,
  };
}

function strengthFromScore(score: number, base: Strength): Strength {
  if (base === "low") return "low";
  return score >= 0.6 ? base : "low";
}

/**
 * Estructura que NO es una afirmacion comparable: filas de tabla, entradas de la lista de anexos,
 * apartados de una lista y peticiones (Rechtsbegehren). Calibrado con escritos reales: sin esto,
 * "Beilage 2: CHF 2'650" y "Beilage 3: CHF 2'640" salian como contradiccion.
 */
function isStructuralNoise(text: string): boolean {
  if ((text.match(/\|/g) ?? []).length >= 2) return true;
  if (/^\s*(?:[-•*]\s*)?(?:Beilage|Beil\.|act\.|Anlage|Annexe|Pièce|Allegato)\s*\d+/i.test(text)) {
    return true;
  }
  if (/^\s*(?:[a-z]|[ivx]{1,4})[.)]\s/.test(text)) return true;
  return /^\s*(?:Es\s+sei(?:en)?\b|Es\s+wird\s+beantragt|Die\s+\p{L}+\s+sei(?:en)?\b|Antrag\b)/iu.test(
    text,
  );
}

const OPPONENT_SUBJECT_RE =
  /\b(?:vorinstanz|sdam|gegenpartei|gegenseite|vernehmlassung|beklagte[rn]?|behörde|kantonsgericht|gericht|einzelrichter|autorité|partie\s+adverse|tribunal)\b/i;
const OWN_SUBJECT_RE = /\b(?:rekurrent|beschwerdeführer|kläger|gesuchsteller|recourant|ich|wir)\b/i;

/** En el escrito propio, "la Behörde reconoce..." no es una admision nuestra. */
function ownAdmissionSubject(text: string): boolean {
  return !(OPPONENT_SUBJECT_RE.test(text) && !OWN_SUBJECT_RE.test(text));
}

/** En el escrito propio, un periodo entre comillas o calificado de imposible lo cita como error ajeno. */
function quotesSomeoneElsesRange(text: string): boolean {
  return /[«»“”„]/.test(text) || /unm[öo]glich|impossible/i.test(text);
}

/** Raices que designan a las partes o a los escritos: aparecen en casi todas las frases y no prueban nada. */
const PARTY_STEMS = new Set([
  "kläger",
  "beklag",
  "gegenp",
  "partei",
  "klage",
  "klagea",
  "duplik",
  "replik",
  "klägeri",
  "demand",
  "défend",
  "partie",
  "advers",
]);

function contentStems(all: Set<string>): Set<string> {
  return new Set([...all].filter((x) => !PARTY_STEMS.has(x)));
}

export function analyzeSubmissions(input: AnalyzerInput): AnalyzerOutput {
  const warnings: string[] = [];
  const lang: OutputLanguage = input.outputLanguage === "it" ? "de" : input.outputLanguage;
  if (input.outputLanguage === "it") {
    warnings.push(
      "El borrador se redacta en alemán (idioma 'it' no soportado para la redacción); los pasajes citados conservan su idioma original.",
    );
  }
  const anchors = anchorsFor(input.procedureFamily, lang);

  const all: Statement[] = [];
  let counter = 0;
  for (const doc of input.documents) {
    const label = doc.label ?? doc.id;
    const segmented = segmentDocument(
      { id: doc.id, label, author: doc.author, text: doc.text },
      counter,
    );
    counter += segmented.length;
    all.push(...segmented);
  }
  let statements = all;
  if (statements.length > MAX_STATEMENTS) {
    warnings.push(
      `Se analizaron solo las primeras ${MAX_STATEMENTS} frases de ${statements.length}: divida el análisis por escrito.`,
    );
    statements = statements.slice(0, MAX_STATEMENTS);
  }

  const features = statements.map(featuresOf);
  const opposing = features.filter((f) => f.statement.author === "opposing_party");
  const own = features.filter((f) => f.statement.author === "own_party");
  const comparable = (f: Features): boolean => !isStructuralNoise(f.statement.text);
  const cmpOpposing = opposing.filter(comparable);
  const cmpOwn = own.filter(comparable);

  const findings: Finding[] = [];
  let findingCounter = 0;
  const nextId = (prefix: string): string => `${prefix}-${(findingCounter += 1)}`;

  // --- Admisiones ---
  for (const f of opposing) {
    if (!f.admission) continue;
    const caveats: string[] = [];
    let strength: Strength = "high";
    if (f.eventual) {
      strength = "low";
      caveats.push(
        "Aparece en un argumento eventual/subsidiario (eventualiter, selbst wenn...): normalmente NO es una admisión vinculante.",
      );
    }
    if (f.reported) {
      strength = "low";
      caveats.push(
        "La frase atribuye la afirmación a otra persona (behauptet, macht geltend...): puede estar resumiendo NUESTRA postura y no admitiendo nada.",
      );
    }
    if (f.qualified && strength === "high") {
      strength = "medium";
      caveats.push("Admisión matizada ('zwar... aber', 'sofern'...): lea la frase completa.");
    }
    if (f.legal && strength === "high") {
      strength = "medium";
      caveats.push(
        "Parece una admisión sobre una cuestión jurídica, que no vincula al tribunal (iura novit curia): úsela como argumento, no como hecho acreditado.",
      );
    }
    findings.push({
      id: nextId("ADM"),
      type: "admission",
      strength,
      passages: [passageOf(f.statement)],
      why: "La frase contiene una expresión de reconocimiento o ausencia de controversia (p. ej. 'räumt ein', 'unbestritten', 'il est exact').",
      legalAnchors: [anchors.noProofNeeded, anchors.goodFaith, anchors.inquisitorial].filter(
        (x) => x,
      ),
      reviewQuestions: [
        "¿Es admisión de un HECHO (vinculante) o valoración jurídica?",
        "¿Se retira o se matiza en otra parte del escrito?",
        "¿Es la afirmación de la contraparte o la resume de la nuestra?",
      ],
      caveats,
      draftRebuttal: draftAdmission(f, anchors, lang),
    });
  }

  // --- Contradicciones entre frases de la contraparte ---
  const contradictedKeys = new Set<string>();
  const seenPairs = new Set<string>();
  // El hallazgo especifico de "misma resolucion con dos fechas" prevalece sobre el comparador general.
  const actPairKeys = new Set<string>();
  for (const c of actDateConflicts(opposing)) {
    actPairKeys.add(`${c.a.statement.id}|${c.b.statement.id}`);
    actPairKeys.add(`${c.b.statement.id}|${c.a.statement.id}`);
  }
  for (let i = 0; i < cmpOpposing.length; i += 1) {
    for (let j = i + 1; j < cmpOpposing.length; j += 1) {
      const a = cmpOpposing[i]!;
      const b = cmpOpposing[j]!;
      const c = compare(a, b, 0.4, 3);
      if (!c) continue;
      if (a.eventual !== b.eventual) continue;
      const key = `${a.statement.id}|${b.statement.id}`;
      if (seenPairs.has(key) || actPairKeys.has(key)) continue;
      seenPairs.add(key);
      contradictedKeys.add(`${a.statement.docId}:${a.statement.offset}`);
      contradictedKeys.add(`${b.statement.docId}:${b.statement.offset}`);
      const within = a.statement.docId === b.statement.docId;
      const base: Strength = c.kind === "numeric" ? "medium" : "low";
      findings.push({
        id: nextId("CON"),
        type: within ? "contradiction_within_document" : "contradiction_between_documents",
        strength: strengthFromScore(c.score, base),
        passages: [passageOf(a.statement), passageOf(b.statement)],
        why: `Candidata a contradicción (${c.kind === "numeric" ? "cifras o fechas distintas sobre lo mismo" : "afirma y niega lo mismo"}): ${c.detail}. Similitud de contenido ${(c.score * 100).toFixed(0)}%.`,
        legalAnchors: [anchors.goodFaith, anchors.goodFaithProcedure].filter((x) => x),
        reviewQuestions: [
          "¿Se refieren al mismo hecho, sujeto y período?",
          "¿Es una contradicción real o una diferencia de enfoque (p. ej. dos importes de conceptos distintos)?",
          within
            ? "¿Hay un 'zwar/aber' o una reserva que las concilie?"
            : "¿Es un escrito posterior que corrige legítimamente al anterior (nova admisible)?",
        ],
        caveats: [
          "Detección heurística por palabras: puede producir falsos positivos. Valide las dos citas literales en el original.",
        ],
        draftRebuttal: draftContradiction(a, b, c, anchors, lang, within),
      });
    }
  }

  // --- Contra el expediente ---
  const recordFeatures: { fact: RecordFact; f: Features }[] = (input.recordFacts ?? []).map(
    (fact) => ({
      fact,
      f: featuresOf({
        id: `R-${fact.id}`,
        docId: `record:${fact.id}`,
        docLabel: fact.id,
        author: "record",
        paragraphIndex: 0,
        marker: null,
        location: fact.id,
        offset: 0,
        text: fact.statement,
        paragraphText: fact.statement,
      }),
    }),
  );
  for (const a of cmpOpposing) {
    for (const { fact, f } of recordFeatures) {
      const c = compare(a, f, 0.3, 3);
      if (!c) continue;
      findings.push({
        id: nextId("REC"),
        type: "contradicted_by_record",
        strength: strengthFromScore(c.score, c.kind === "numeric" ? "high" : "medium"),
        passages: [passageOf(a.statement)],
        record: { id: fact.id, statement: fact.statement, source: fact.source ?? null },
        why: `La afirmación contradice un hecho del expediente (${c.detail}).`,
        legalAnchors: [anchors.mustSubstantiate].filter((x) => x),
        reviewQuestions: [
          "¿El documento del expediente está efectivamente aportado y es auténtico?",
          "¿Se refiere al mismo hecho y a la misma fecha?",
        ],
        caveats: [
          "El hecho del expediente lo ha aportado usted: compruebe que la fuente sea citable (Beilage/act.).",
        ],
        draftRebuttal: draftRecord(a, fact, c, anchors, lang),
      });
    }
  }

  // --- Periodos con el final antes del principio ---
  for (const f of opposing) {
    for (const r of findImpossibleDateRanges(f.statement.text)) {
      findings.push({
        id: nextId("DAT"),
        type: "impossible_date_range",
        strength: "medium",
        passages: [passageOf(f.statement)],
        why: `El periodo indicado es imposible: termina el ${r.end}, antes de empezar el ${r.start}.`,
        legalAnchors: [],
        reviewQuestions: [
          "¿Es un simple error de escritura que la contraparte puede corregir?",
          "¿Cuál era el periodo real y cambia el resultado?",
        ],
        caveats: [
          "Puede ser un error tipográfico sin trascendencia: úselo para cuestionar la fiabilidad de la afirmación, no como prueba de mala fe.",
        ],
        draftRebuttal: draftImpossibleRange(f, r, lang, false),
      });
    }
  }

  // --- La misma resolucion con dos fechas distintas ---
  for (const c of actDateConflicts(opposing)) {
    const within = c.a.statement.docId === c.b.statement.docId;
    const conflict: Conflict = {
      kind: "numeric",
      score: 0.5,
      detail: `fecha: ${c.d1} frente a ${c.d2}`,
      numeric: { unit: "date", a: [c.d1], b: [c.d2] },
    };
    findings.push({
      id: nextId("CON"),
      type: within ? "contradiction_within_document" : "contradiction_between_documents",
      strength: "low",
      passages: [passageOf(c.a.statement), passageOf(c.b.statement)],
      why: `La misma resolución de la misma autoridad aparece con dos fechas distintas (${c.d1} y ${c.d2}).`,
      legalAnchors: [anchors.goodFaith, anchors.goodFaithProcedure].filter((x) => x),
      reviewQuestions: [
        "¿Son realmente dos resoluciones distintas de la misma autoridad?",
        "¿Es un error de escritura o hay dos fechas legítimas (fecha de la resolución y de notificación)?",
      ],
      caveats: [
        "Puede tratarse de resoluciones distintas de una misma autoridad: compruebe los números de expediente.",
      ],
      draftRebuttal: draftContradiction(c.a, c.b, conflict, anchors, lang, within),
    });
  }

  // --- Afirmaciones sin medio de prueba (una por parrafo) y absolutas ---
  const seenParagraphs = new Set<string>();
  let unsubstantiated = 0;
  for (const f of opposing) {
    const para = `${f.statement.docId}:${f.statement.paragraphIndex}`;
    if (
      !f.legal &&
      !f.admission &&
      !f.evidenceInParagraph &&
      f.statement.text.length >= 60 &&
      f.stems.size >= 5 &&
      (f.numbers.size > 0 || f.absolute) &&
      !seenParagraphs.has(para) &&
      unsubstantiated < 15
    ) {
      seenParagraphs.add(para);
      unsubstantiated += 1;
      findings.push({
        id: nextId("UNS"),
        type: "unsubstantiated_assertion",
        strength: "low",
        passages: [passageOf(f.statement)],
        why: "Afirmación fáctica concreta (con cifras, fechas o términos absolutos) en un párrafo sin ninguna referencia a medio de prueba.",
        legalAnchors: [anchors.mustSubstantiate].filter((x) => x),
        reviewQuestions: [
          "¿Aporta el escrito el medio de prueba en otro lugar (Beilage, Zeuge)?",
          "¿Es un hecho notorio o admitido que no necesite prueba?",
        ],
        caveats: [
          "Solo mira el mismo párrafo: revise el escrito entero antes de afirmar que falta prueba.",
        ],
        draftRebuttal: draftUnsubstantiated(f, anchors, lang),
      });
    }
    if (f.absolute && !f.legal && f.statement.text.length >= 40) {
      findings.push({
        id: nextId("ABS"),
        type: "absolute_assertion",
        strength: "low",
        passages: [passageOf(f.statement)],
        why: "Afirmación absoluta (nie, stets, ausnahmslos, jamais...): basta un contraejemplo del expediente para desmontarla.",
        legalAnchors: [],
        reviewQuestions: ["¿Hay en el expediente algún hecho o documento que la contradiga?"],
        caveats: [],
        draftRebuttal: draftAbsolute(f, lang),
      });
    }
  }

  // --- Hechos nuestros que la contraparte no contesto (solo ZPO: Art. 222 Abs. 2 / 150 Abs. 1) ---
  if (anchors.noProofNeeded && opposing.length > 0) {
    const BLANKET_RE =
      /\b(?:s[äa]mtliche|alle|jegliche)\b[^.]{0,120}\b(?:bestritten|nicht\s+anerkannt)\b|\bwird\s+(?:hiermit\s+)?bestritten\b|\bwerden\s+bestritten\b|\bnicht\s+ausdr[üu]cklich\s+anerkannt\w*\b/i;
    const blanket = opposing.some((f) => BLANKET_RE.test(f.statement.text));
    let flagged = 0;
    for (const f of own) {
      if (flagged >= 15) break;
      if (f.legal || f.eventual || f.statement.text.length < 60 || f.stems.size < 5) continue;
      if (f.numbers.size === 0 && !/\d{2,}/.test(f.statement.text)) continue;
      const mine = contentStems(f.stems);
      let best = { score: 0, shared: 0 };
      let maxShared = 0;
      let closest: Features | null = null;
      for (const o of opposing) {
        const j = jaccard(mine, contentStems(o.stems));
        if (j.shared > maxShared) maxShared = j.shared;
        if (j.score > best.score) {
          best = j;
          closest = o;
        }
      }
      if (best.score >= 0.15 || maxShared >= 2) continue;
      flagged += 1;
      findings.push({
        id: nextId("UNA"),
        type: "unanswered_allegation",
        strength: blanket ? "low" : "medium",
        passages: [passageOf(f.statement)],
        why: `Hecho nuestro con datos concretos al que ninguna frase de la contraparte parece responder.${
          closest
            ? ` La frase más parecida es "${closest.statement.text.slice(0, 160)}" (${closest.statement.location}, similitud ${(best.score * 100).toFixed(0)}%): compruebe si de verdad lo contesta.`
            : ""
        }`,
        legalAnchors: [anchors.noProofNeeded, "Art. 222 Abs. 2 ZPO"],
        reviewQuestions: [
          "¿La contraparte lo contesta con otras palabras o en un escrito que no ha aportado al análisis?",
          blanket
            ? "Hay una cláusula general de bestreiten en su escrito: ¿basta para negar este hecho en particular? Verifíquelo en doctrina y jurisprudencia (esta herramienta no lo ha verificado)."
            : "¿Hay una negación general que cubra este hecho?",
          "¿Es un hecho relevante para el resultado?",
        ],
        caveats: [
          "Art. 222 Abs. 2 ZPO regula la Klageantwort; si el escrito analizado es otro (p. ej. Duplik), compruebe qué carga de contestar rige en esa fase.",
          "La herramienta solo compara palabras: una respuesta con vocabulario distinto no se detecta.",
        ],
        draftRebuttal: draftUnanswered(f, anchors, lang),
      });
    }
  }

  // --- Escrito propio: lo que nos pueden devolver ---
  const exposure: Finding[] = [];
  let exposureCounter = 0;
  const nextExposure = (prefix: string): string => `${prefix}-${(exposureCounter += 1)}`;
  const exposureSeen = new Set<string>();
  for (const c of actDateConflicts(own)) {
    exposureSeen.add(`${c.a.statement.id}|${c.b.statement.id}`);
    exposureSeen.add(`${c.b.statement.id}|${c.a.statement.id}`);
    exposure.push({
      id: nextExposure("EXR"),
      type: "own_contradiction",
      strength: "medium",
      passages: [passageOf(c.a.statement), passageOf(c.b.statement)],
      why: `Su propio texto da dos fechas (${c.d1} y ${c.d2}) a la misma resolución de la misma autoridad. La contraparte o el tribunal podrían señalarlo.`,
      legalAnchors: [],
      reviewQuestions: [
        "¿Cuál es la fecha correcta de la resolución? Compruébelo en el original.",
        "¿Son dos resoluciones distintas? Entonces identifíquelas con el número de expediente.",
      ],
      caveats: ["Corrija o aclare la fecha ANTES de presentar el escrito."],
      draftRebuttal: "",
    });
  }
  for (const f of own) {
    if (quotesSomeoneElsesRange(f.statement.text)) continue;
    for (const r of findImpossibleDateRanges(f.statement.text)) {
      exposure.push({
        id: nextExposure("EXD"),
        type: "impossible_date_range",
        strength: "medium",
        passages: [passageOf(f.statement)],
        why: `Su propio texto indica un periodo imposible: termina el ${r.end}, antes de empezar el ${r.start}. La contraparte podría usarlo para cuestionar la fiabilidad del escrito.`,
        legalAnchors: [],
        reviewQuestions: ["¿Es un error de escritura? Corríjalo antes de presentar el escrito."],
        caveats: ["Corrija la fecha ANTES de presentar el escrito."],
        draftRebuttal: "",
      });
    }
  }
  for (let i = 0; i < cmpOwn.length; i += 1) {
    for (let j = i + 1; j < cmpOwn.length; j += 1) {
      const a = cmpOwn[i]!;
      const b = cmpOwn[j]!;
      const c = compare(a, b, 0.4, 3);
      if (!c || a.eventual !== b.eventual) continue;
      const key = `${a.statement.id}|${b.statement.id}`;
      if (exposureSeen.has(key)) continue;
      exposureSeen.add(key);
      exposure.push({
        id: nextExposure("EXP"),
        type: "own_contradiction",
        strength: strengthFromScore(c.score, c.kind === "numeric" ? "medium" : "low"),
        passages: [passageOf(a.statement), passageOf(b.statement)],
        why: `Su propio texto contiene dos frases que la contraparte podría presentar como contradictorias (${c.detail}).`,
        legalAnchors: [],
        reviewQuestions: [
          "¿Puede armonizarse con una frase puente o corregir una de las dos?",
          "¿Es una diferencia real de conceptos que conviene aclarar expresamente?",
        ],
        caveats: ["Corrija o aclare ANTES de presentar el escrito."],
        draftRebuttal: "",
      });
    }
  }
  for (const f of own) {
    if (f.admission && !f.eventual && !f.reported && ownAdmissionSubject(f.statement.text)) {
      exposure.push({
        id: nextExposure("EXA"),
        type: "own_admission",
        strength: "medium",
        passages: [passageOf(f.statement)],
        why: "Esta frase puede leerse como una admisión suya que la contraparte podría invocar.",
        legalAnchors: [],
        reviewQuestions: [
          "¿Es intencionado admitir este hecho?",
          "¿Conviene reformularlo como argumento eventual o con reserva expresa?",
        ],
        caveats: [],
        draftRebuttal: "",
      });
    }
  }

  for (let i = 0; i < findings.length; i += 1) {
    const f = findings[i]!;
    const p = f.passages[0];
    if (f.type === "admission" && p && contradictedKeys.has(`${p.docId}:${p.offset}`)) {
      findings[i] = {
        ...f,
        caveats: [
          ...f.caveats,
          "Hay una contradicción candidata con otra frase de la contraparte: puede haber retirado o matizado esta admisión en otro escrito. Revise ambos antes de darla por incontrovertida.",
        ],
        reviewQuestions: [
          ...f.reviewQuestions,
          "¿Ha retirado la contraparte esta admisión y con qué fundamento (error, hechos nuevos)?",
        ],
      };
    }
  }

  // Una contradiccion que afecta a una admision (posible retirada de lo admitido) pesa mas.
  const admissionKeys = new Set(
    findings
      .filter((f) => f.type === "admission" && f.strength !== "low")
      .map((f) => `${f.passages[0]!.docId}:${f.passages[0]!.offset}`),
  );
  for (let i = 0; i < findings.length; i += 1) {
    const f = findings[i]!;
    if (
      f.type === "contradiction_between_documents" &&
      f.strength === "low" &&
      f.passages.some((p) => admissionKeys.has(`${p.docId}:${p.offset}`))
    ) {
      findings[i] = {
        ...f,
        strength: "medium",
        why: `${f.why} Afecta a una admisión: la contraparte puede haberla retirado en un escrito posterior.`,
        caveats: [
          ...f.caveats,
          "Una admisión de hecho solo puede retirarse en condiciones restringidas; compruebe si el escrito posterior explica el cambio.",
        ],
      };
    }
  }

  const order: Record<Strength, number> = { high: 0, medium: 1, low: 2 };
  const typeOrder: Record<FindingType, number> = {
    admission: 0,
    contradicted_by_record: 1,
    contradiction_between_documents: 2,
    contradiction_within_document: 3,
    misquoted_authority: 4,
    unsubstantiated_assertion: 5,
    unanswered_allegation: 4.5,
    impossible_date_range: 2.5,
    misstated_norm_content: 4.2,
    absolute_assertion: 6,
    own_contradiction: 7,
    own_admission: 8,
  };
  const sorted = [...findings].sort(
    (x, y) => order[x.strength] - order[y.strength] || typeOrder[x.type] - typeOrder[y.type],
  );
  if (sorted.length > input.maxFindings) {
    warnings.push(
      `Hay ${sorted.length} hallazgos; se devuelven los ${input.maxFindings} más fuertes (aumente maxFindings para ver más).`,
    );
  }
  return {
    statements: statements.length,
    findings: sorted.slice(0, input.maxFindings),
    exposure,
    warnings,
  };
}

// ---------------------------------------------------------------------------------------------
// Esqueleto del escrito de replica
// ---------------------------------------------------------------------------------------------

const BRIEF_SECTIONS: readonly {
  readonly types: readonly FindingType[];
  readonly de: string;
  readonly fr: string;
}[] = [
  {
    types: ["admission"],
    de: "Zu den Zugeständnissen der Gegenpartei",
    fr: "Sur les aveux de la partie adverse",
  },
  {
    types: [
      "contradiction_within_document",
      "contradiction_between_documents",
      "contradicted_by_record",
      "impossible_date_range",
    ],
    de: "Zu den Widersprüchen in den Vorbringen der Gegenpartei",
    fr: "Sur les contradictions de la partie adverse",
  },
  {
    types: ["misquoted_authority", "misstated_norm_content"],
    de: "Zu den unzutreffend wiedergegebenen Rechtsgrundlagen",
    fr: "Sur les bases légales inexactement reproduites",
  },
  {
    types: ["unsubstantiated_assertion", "absolute_assertion"],
    de: "Zu den unbelegten und pauschalen Behauptungen",
    fr: "Sur les allégations non étayées et absolues",
  },
  {
    types: ["unanswered_allegation"],
    de: "Zu den nicht bestrittenen Tatsachen",
    fr: "Sur les faits non contestés",
  },
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

export interface BriefSkeleton {
  readonly text: string;
  readonly included: readonly string[];
  readonly excluded: readonly { readonly id: string; readonly reason: string }[];
}

/**
 * Ordena los hallazgos en un esqueleto de escrito. Incluye solo hallazgos de fuerza media o alta
 * (o todos con includeLow) y NUNCA los que la propia herramienta marca como no utilizables.
 */
export function composeBriefSkeleton(
  findings: readonly Finding[],
  lang: OutputLanguage,
  includeLow: boolean,
): BriefSkeleton {
  const l: "de" | "fr" = lang === "fr" ? "fr" : "de";
  const included: string[] = [];
  const excluded: { id: string; reason: string }[] = [];
  const parts: string[] = [
    l === "fr"
      ? "PROJET : non prêt à être déposé. Tous les points [À VÉRIFIER] doivent être clarifiés avant tout usage."
      : "ENTWURF: nicht einreichungsreif. Sämtliche [PRÜFEN]-Hinweise sind vor einer Verwendung zu klären.",
  ];
  let paragraph = 0;
  let section = 0;
  for (const def of BRIEF_SECTIONS) {
    const items: Finding[] = [];
    for (const f of findings) {
      if (!def.types.includes(f.type)) continue;
      if (f.draftRebuttal.startsWith("[NICHT") || f.draftRebuttal.startsWith("[NE PAS")) {
        excluded.push({ id: f.id, reason: "marcado por la herramienta como no utilizable" });
      } else if (f.strength === "low" && !includeLow) {
        excluded.push({ id: f.id, reason: "fuerza baja (use includeLowStrength para incluirlo)" });
      } else {
        items.push(f);
      }
    }
    if (items.length === 0) continue;
    parts.push(`${ROMAN[section] ?? String(section + 1)}. ${def[l]}`);
    section += 1;
    for (const f of items) {
      paragraph += 1;
      parts.push(`${paragraph}. ${f.draftRebuttal}`);
      included.push(f.id);
    }
  }
  if (included.length === 0) {
    parts.push(
      l === "fr"
        ? "Aucun constat de force suffisante : voir la liste des constats."
        : "Keine Feststellung von ausreichender Stärke: siehe Liste der Feststellungen.",
    );
  }
  return { text: parts.join("\n\n"), included, excluded };
}
