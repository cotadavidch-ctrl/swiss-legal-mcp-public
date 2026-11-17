/**
 * Analisis heuristico de una resolucion/decision recibida (texto ya extraido): tipo de acto,
 * fechas, instruccion de recursos (Rechtsmittelbelehrung / voies de droit / rimedi giuridici),
 * plazo indicado y regla de plazo sugerida.
 *
 * Principios (el resultado NUNCA es una conclusion juridica):
 *  - Todo dato extraido lleva la cita literal del documento y su posicion; nada se infiere sin
 *    evidencia textual. Lo que no aparece se devuelve como ausente.
 *  - La fecha del documento NO es la fecha de notificacion: la notificacion se prueba con el sobre,
 *    el sello de Correos o el acuse, y la aporta el usuario. Este modulo no la deduce.
 *  - La regla de plazo es una SUGERENCIA con confianza explicita y debe revisarse.
 *  - Metodo: expresiones regulares DE/FR/IT. Puede fallar con documentos atipicos o mal escaneados.
 */
import type { DeadlineRuleSet } from "./deadlineEngine.js";
import { segmentDocument } from "./opposingSubmissionAnalyzer.js";

export type DecisionKind =
  | "verfuegung"
  | "einspracheentscheid"
  | "gerichtsentscheid"
  | "zahlungsbefehl"
  | "strafbefehl"
  | "unknown";

export interface ExtractedDate {
  readonly iso: string;
  readonly quote: string;
  readonly offset: number;
  readonly page: number | null;
  readonly context: "decision_date_candidate" | "other";
}

export interface RemedyInstruction {
  readonly found: boolean;
  readonly heading: string | null;
  readonly quote: string | null;
  readonly offset: number | null;
  readonly page: number | null;
  readonly deadlineDays: number | null;
  readonly deadlineQuote: string | null;
  readonly remedy: string | null;
  readonly filingAuthorityQuote: string | null;
}

export interface RuleSetSuggestion {
  readonly ruleSet: DeadlineRuleSet | null;
  readonly confidence: "medium" | "low" | "none";
  readonly reasons: readonly string[];
}

export interface DecisionAnalysis {
  readonly language: "de" | "fr" | "it" | "unknown";
  readonly kind: DecisionKind;
  readonly kindEvidence: string | null;
  readonly headerLines: readonly string[];
  readonly dates: readonly ExtractedDate[];
  readonly remedyInstruction: RemedyInstruction;
  readonly suggestedRuleSet: RuleSetSuggestion;
  readonly reviewFlags: readonly DecisionReviewFlag[];
  readonly warnings: readonly string[];
  readonly extractionMethod: "heuristic_regex";
  readonly requiresHumanReview: true;
}

const MONTHS: Readonly<Record<string, number>> = {
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
  janvier: 1,
  février: 2,
  fevrier: 2,
  mars: 3,
  avril: 4,
  juin: 6,
  juillet: 7,
  août: 8,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
  decembre: 12,
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  dicembre: 12,
};

const DATE_TEXT = new RegExp(
  `\\b(\\d{1,2})\\.?\\s*(?:er\\s+)?(${Object.keys(MONTHS).join("|")})\\s+(\\d{4})\\b`,
  "gi",
);
const DATE_NUMERIC = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;

function toIso(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

function pageAt(offset: number, pageStarts: readonly number[]): number | null {
  if (pageStarts.length === 0) return null;
  let page = 1;
  for (let i = 0; i < pageStarts.length; i += 1) {
    if (offset >= pageStarts[i]!) page = i + 1;
  }
  return page;
}

function detectLanguage(text: string): DecisionAnalysis["language"] {
  const sample = text.slice(0, 6000).toLowerCase();
  const score = {
    de: (sample.match(/\b(der|die|das|und|nicht|gegen|innert|verfügung|entscheid)\b/g) ?? [])
      .length,
    fr: (sample.match(/\b(le|la|les|des|une|contre|décision|délai|recours)\b/g) ?? []).length,
    it: (sample.match(/\b(il|della|degli|contro|decisione|termine|ricorso|giorni)\b/g) ?? [])
      .length,
  };
  const best = (Object.entries(score) as [keyof typeof score, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  return best[0]![1] >= 3 ? best[0]![0] : "unknown";
}

const KIND_PATTERNS: readonly [DecisionKind, RegExp][] = [
  ["einspracheentscheid", /einspracheentscheid|décision sur opposition|decisione su opposizione/i],
  ["zahlungsbefehl", /zahlungsbefehl|commandement de payer|precetto esecutivo/i],
  ["strafbefehl", /strafbefehl|ordonnance p[ée]nale|decreto d['’]accusa|decreto di accusa/i],
  ["gerichtsentscheid", /\b(urteil|jugement|sentenza|beschluss|arrêt|ordonnance)\b/i],
  ["verfuegung", /\bverfügung\b|\bverfuegung\b|\bdécision\b|\bdecisione\b|\bdisposizione\b/i],
];

const REMEDY_HEADINGS =
  /(rechtsmittelbelehrung|rechtsmittel\b|voies? de droit|indication des voies de droit|indicazione dei rimedi giuridici|rimedi giuridici|rechtsbehelfsbelehrung)/i;

const DEADLINE_PATTERNS: readonly RegExp[] = [
  /(?:innert|innerhalb\s+von|binnen)\s+(\d{1,3})\s+Tagen/i,
  /(?:dans\s+un\s+délai\s+de|dans\s+les|dans\s+un\s+délai\s+de)\s+(\d{1,3})\s+jours/i,
  /(?:entro|nel\s+termine\s+di)\s+(\d{1,3})\s+giorni/i,
  /(\d{1,3})\s+Tage(?:n)?\s+(?:seit|nach|ab)/i,
];

const REMEDY_WORDS: readonly [string, RegExp][] = [
  ["Einsprache", /\beinsprache\b|\bopposition\b|\bopposizione\b/i],
  ["Berufung", /\bberufung\b|\bappel\b|\bappello\b/i],
  ["Beschwerde", /\bbeschwerde\b|\brecours\b|\bricorso\b/i],
  ["Rechtsvorschlag", /\brechtsvorschlag\b/i],
];

export function analyzeDecisionText(
  text: string,
  pageStarts: readonly number[] = [],
): DecisionAnalysis {
  const warnings: string[] = [
    "Extraccion heuristica (expresiones regulares): puede fallar con documentos atipicos. Compruebe cada dato contra el original.",
    "La fecha del documento NO es la fecha de notificacion. La notificacion debe probarse (sobre, sello de Correos, acuse de recibo).",
  ];
  const language = detectLanguage(text);

  // Tipo de acto: el primero que coincide en la cabecera (primeros 2500 caracteres).
  const head = text.slice(0, 2500);
  let kind: DecisionKind = "unknown";
  let kindEvidence: string | null = null;
  for (const [k, re] of KIND_PATTERNS) {
    const m = re.exec(head);
    if (m) {
      kind = k;
      kindEvidence = m[0];
      break;
    }
  }

  const headerLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 8);

  // Fechas
  const dates: ExtractedDate[] = [];
  const seen = new Set<string>();
  const pushDate = (iso: string | null, match: RegExpExecArray) => {
    if (!iso) return;
    const key = `${iso}@${match.index}`;
    if (seen.has(key)) return;
    seen.add(key);
    const before = text.slice(Math.max(0, match.index - 40), match.index).toLowerCase();
    const isDecision = /(vom|du|del|datum|date|data)\s*$/.test(before) || match.index < 600;
    dates.push({
      iso,
      quote: text
        .slice(Math.max(0, match.index - 20), match.index + match[0].length + 10)
        .replace(/\s+/g, " ")
        .trim(),
      offset: match.index,
      page: pageAt(match.index, pageStarts),
      context: isDecision ? "decision_date_candidate" : "other",
    });
  };
  for (const m of text.matchAll(DATE_TEXT)) {
    pushDate(toIso(Number(m[3]), MONTHS[m[2]!.toLowerCase()]!, Number(m[1])), m);
  }
  for (const m of text.matchAll(DATE_NUMERIC)) {
    pushDate(toIso(Number(m[3]), Number(m[2]), Number(m[1])), m);
  }
  dates.sort((a, b) => a.offset - b.offset);

  // Instruccion de recursos
  let remedy: RemedyInstruction = {
    found: false,
    heading: null,
    quote: null,
    offset: null,
    page: null,
    deadlineDays: null,
    deadlineQuote: null,
    remedy: null,
    filingAuthorityQuote: null,
  };
  const headingMatch = REMEDY_HEADINGS.exec(text);
  // Se usa el ULTIMO encabezado cuando hay varios (la instruccion suele ir al final del acto).
  let chosen: RegExpExecArray | null = headingMatch;
  for (const m of text.matchAll(new RegExp(REMEDY_HEADINGS.source, "gi"))) {
    chosen = m;
  }
  if (chosen) {
    const section = text.slice(chosen.index, chosen.index + 1800);
    let deadlineDays: number | null = null;
    let deadlineQuote: string | null = null;
    for (const re of DEADLINE_PATTERNS) {
      const m = re.exec(section);
      if (m) {
        deadlineDays = Number(m[1]);
        deadlineQuote = section
          .slice(Math.max(0, m.index - 30), m.index + m[0].length + 30)
          .replace(/\s+/g, " ")
          .trim();
        break;
      }
    }
    let remedyName: string | null = null;
    for (const [name, re] of REMEDY_WORDS) {
      if (re.test(section)) {
        remedyName = name;
        break;
      }
    }
    const authority =
      /(?:bei|an|beim|à|auprès de|presso)\s+(?:der|dem|die|la|le|l’|l'|al)?\s*([^.\n]{5,120})/i.exec(
        section,
      );
    remedy = {
      found: true,
      heading: chosen[0],
      quote: section.slice(0, 600).replace(/\s+/g, " ").trim(),
      offset: chosen.index,
      page: pageAt(chosen.index, pageStarts),
      deadlineDays,
      deadlineQuote,
      remedy: remedyName,
      filingAuthorityQuote: authority ? authority[0].replace(/\s+/g, " ").trim() : null,
    };
  } else {
    warnings.push(
      "No se encontro ninguna instruccion de recursos (Rechtsmittelbelehrung / voies de droit). Un acto sin ella puede tener consecuencias para el computo del plazo: consulte con un profesional.",
    );
  }

  // Regla sugerida
  const reasons: string[] = [];
  let ruleSet: DeadlineRuleSet | null = null;
  let confidence: RuleSetSuggestion["confidence"] = "none";
  const lower = text.toLowerCase();
  const mentionsAtsg = /\batsg\b|\blpga\b|\blpgs\b|art\.\s*52\s+atsg|art\.\s*60\s+atsg/.test(lower);
  const mentionsAlv = /\bavig\b|arbeitslosen|\blacI\b|assurance-chômage|disoccupazione/i.test(text);
  const mentionsVwvg = /\bvwvg\b|\bpa\b.*procédure administrative|procedura amministrativa/i.test(
    text,
  );
  const mentionsBgg = /\bbgg\b|\blTF\b|bundesgericht|tribunal fédéral|tribunale federale/i.test(
    text,
  );

  if (kind === "zahlungsbefehl") {
    ruleSet = "SCHKG_RECHTSVORSCHLAG";
    confidence = "medium";
    reasons.push("El documento es un Zahlungsbefehl: Rechtsvorschlag (Art. 74 SchKG).");
  } else if (kind === "strafbefehl") {
    ruleSet = "STPO_EINSPRACHE_STRAFBEFEHL";
    confidence = "medium";
    reasons.push("El documento es un Strafbefehl: Einsprache en 10 dias (Art. 354 StPO).");
  } else if (remedy.remedy === "Einsprache" && (mentionsAtsg || mentionsAlv)) {
    ruleSet = "ATSG_EINSPRACHE";
    confidence = mentionsAtsg ? "medium" : "low";
    reasons.push(
      `Instruccion de ${remedy.remedy}${mentionsAtsg ? " con referencia al ATSG" : " en un contexto de seguro de paro/social"} (Art. 52 ATSG).`,
    );
  } else if (
    (remedy.remedy === "Berufung" || remedy.remedy === "Beschwerde") &&
    /\bstpo\b|strafprozessordnung|\bcpp\b|proc[ée]dure p[ée]nale|procedura penale/i.test(text)
  ) {
    ruleSet = remedy.remedy === "Berufung" ? "STPO_BERUFUNG_ANMELDUNG" : "STPO_BESCHWERDE";
    confidence = "low";
    reasons.push(
      remedy.remedy === "Berufung"
        ? "Berufung en proceso penal: primero la Anmeldung en 10 dias (Art. 399 Abs. 1 StPO); despues corre la Berufungserklaerung de 20 dias (STPO_BERUFUNG_ERKLAERUNG)."
        : "Beschwerde en proceso penal (Art. 396 StPO, 10 dias).",
    );
  } else if (
    (remedy.remedy === "Berufung" || remedy.remedy === "Beschwerde") &&
    /\bzpo\b|zivilprozessordnung|code de proc[ée]dure civile|\bcpc\b|procedura civile/i.test(text)
  ) {
    const summary =
      /summarisch|proc[ée]dure sommaire|procedura sommaria|rechts[öo]ffnung|mainlev[ée]e|vorsorgliche massnahme/i.test(
        text,
      );
    if (remedy.remedy === "Berufung") {
      ruleSet = summary ? "ZPO_BERUFUNG_SUMMARISCH" : "ZPO_BERUFUNG";
      reasons.push(
        summary
          ? "Berufung con indicios de procedimiento sumario: 10 dias (Art. 314 ZPO); en litigios de familia (Art. 271, 276, 302, 305 ZPO) son 30."
          : "Berufung en proceso civil: 30 dias (Art. 311 ZPO). Si fue procedimiento sumario son 10 dias (Art. 314 ZPO).",
      );
    } else {
      ruleSet = summary ? "ZPO_BESCHWERDE_10TAGE" : "ZPO_BESCHWERDE";
      reasons.push(
        summary
          ? "Beschwerde con indicios de procedimiento sumario: 10 dias (Art. 321 Abs. 2 ZPO)."
          : "Beschwerde en proceso civil: 30 dias (Art. 321 Abs. 1 ZPO); 10 dias si es sumario o resolucion de ordenacion (Art. 321 Abs. 2 ZPO).",
      );
    }
    confidence = "low";
  } else if (remedy.remedy === "Beschwerde" && mentionsBgg) {
    ruleSet = "BGG_BESCHWERDE";
    confidence = "low";
    reasons.push("Beschwerde con referencia al Tribunal Federal (Art. 100 BGG).");
  } else if (remedy.remedy === "Beschwerde" && mentionsAtsg) {
    ruleSet = "ATSG_BESCHWERDE";
    confidence = "low";
    reasons.push("Beschwerde en materia de seguros sociales (Art. 60 ATSG).");
  } else if (remedy.remedy === "Beschwerde" && mentionsVwvg) {
    ruleSet = "VWVG_BESCHWERDE";
    confidence = "low";
    reasons.push(
      "Beschwerde con referencia a la ley de procedimiento administrativo (Art. 50 VwVG).",
    );
  } else if (remedy.found) {
    reasons.push(
      "No se pudo asociar la instruccion de recursos a ninguna de las reglas de plazo soportadas (ATSG, VwVG, BGG, SchKG, ZPO, StPO). Los plazos cantonales y de otras leyes NO estan cubiertos.",
    );
  }

  return {
    language,
    kind,
    kindEvidence,
    headerLines,
    dates,
    remedyInstruction: remedy,
    suggestedRuleSet: { ruleSet, confidence, reasons },
    reviewFlags: reviewDecision(text),
    warnings,
    extractionMethod: "heuristic_regex",
    requiresHumanReview: true,
  };
}

// ---------------------------------------------------------------------------------------------
// Puntos impugnables de una resolucion de la autoridad
// ---------------------------------------------------------------------------------------------

export type DecisionReviewFlagType =
  | "appeal_excluded"
  | "appeal_instruction_missing"
  | "no_legal_basis_cited"
  | "examination_refused"
  | "family_support_basis"
  | "inference_without_evidence"
  | "budget_rationale"
  | "voluntary_benefit_claim"
  | "emergency_aid_not_addressed";

export interface DecisionReviewFlag {
  readonly id: string;
  readonly type: DecisionReviewFlagType;
  readonly strength: "high" | "medium" | "low";
  readonly passages: readonly {
    readonly location: string;
    readonly offset: number;
    readonly text: string;
  }[];
  readonly why: string;
  /** Solo normas cuyo texto se leyo en Fedlex (2026-11-13). */
  readonly legalAnchors: readonly string[];
  readonly reviewQuestions: readonly string[];
  readonly caveats: readonly string[];
}

const NO_LEGAL_BASIS_RE =
  /\bArt\.\s*\d+|\bArt\s+\d+|§\s*\d+|\bart\.\s*\d+\s+(?:al\.|cpv\.)|\barticles?\s+\d+|\bartikel\s+\d+|\barticolo\s+\d+/i;
const APPEAL_EXCLUDED_RE =
  /(?:Anfechtung|Rechtsmittel|anfechtbar|recours)[^.]{0,100}(?:ausgeschlo(?:ss|ß)en|nicht\s+(?:zulässig|möglich|gegeben)|exclu)|kein\s+Rechtsmittel|nicht\s+anfechtbar|unanfechtbar|(?:bei\s+)?keiner\s+Rechtsmittelinstanz|\baucun\s+recours|sans\s+(?:voie\s+de\s+)?recours|nessun\s+ricorso|\balcun\s+ricorso|nicht\s+angefochten\s+werden|kann\s+nicht\s+angefochten|ne\s+peut\s+pas\s+être\s+(?:contestée|attaquée)|non\s+può\s+essere\s+impugnat/i;
const EXAMINATION_REFUSED_RE =
  /(?:Prüfung|Abklärung|Überprüfung|Berücksichtigung)[^.]{0,140}(?:nicht\s+erforderlich|nicht\s+notwendig|unterbleibt|entfällt)|(?:nicht\s+erforderlich|nicht\s+notwendig)[^.]{0,60}(?:Prüfung|Abklärung)|(?:examen|vérification|instruction|appréciation|prise\s+en\s+compte)[^.]{0,140}(?:n['’]est\s+pas\s+(?:nécessaire|requis)|est\s+superflu|est\s+inutile)|il\s+n['’]est\s+pas\s+procédé\s+à\s+(?:la\s+vérification|l['’]examen)|(?:esame|verifica|istruttoria)[^.]{0,140}(?:non\s+è\s+necessari|è\s+superflu)|non\s+si\s+procede\s+(?:alla\s+verifica|all['’]esame)|n['’]est\s+pas\s+nécessaire\s+de\s+(?:vérifier|examiner|contrôler)|non\s+è\s+necessario\s+(?:verificare|esaminare|controllare)/i;
const INFERENCE_RE =
  /ist\s+davon\s+auszugehen|lässt?\s+darauf\s+schlie(?:ss|ß)en|lassen\s+darauf\s+schlie(?:ss|ß)en|theoretisch\s+vorhanden|grundsätzlich\s+möglich|potenzielle|ist\s+anzunehmen|il\s+y\s+a\s+lieu\s+de\s+(?:présumer|supposer)|on\s+peut\s+(?:supposer|présumer)|il\s+est\s+à\s+supposer|si\s+presume\s+che|è\s+da\s+presumere|si\s+può\s+presumere/i;
const FAMILY_RE =
  /\b(?:Bruder|Brüder|Schwester|Geschwister|frère|sœur)\b[^.]{0,200}(?:Unterstützung|unterstütz)|(?:Unterstützung|unterstütz)[^.]{0,200}\b(?:Bruder|Brüder|Schwester|Geschwister|frère|sœur)\b|\b(?:frère|sœur|frères|fratello|sorella|fratelli)\b[^.]{0,200}(?:soutien|aide|assistance|sostegno|aiuto)|(?:soutien|aide|assistance|sostegno|aiuto)[^.]{0,200}\b(?:frère|sœur|frères|fratello|sorella|fratelli)\b/i;
const BUDGET_RE =
  /(?:begrenzt|beschränkt)\w*\s+(?:finanziell\w*\s+)?Mittel|Haushaltsjahr|wirtschaftlichen\s+Haushalt(?:s)?führung\s+ist\s+die\s+Behörde|(?:ressources|moyens)\s+(?:financiers\s+)?limité|exercice\s+budgétaire|risorse\s+(?:finanziarie\s+)?limitate|esercizio\s+di\s+bilancio/i;
const VOLUNTARY_RE =
  /freiwillig\w*\s+(?:staatlich\w*\s+)?Leistung|nach\s+eigenem\s+Ermessen|\bkein\s+Rechtsanspruch|prestation\s+facultative|(?:pas|aucun)\s+de?\s*droit\s+(?:à|aux?)\s+(?:cette|la|une)\s+prestation|prestazione\s+facoltativa|nessun\s+diritto\s+(?:a|alla)\s+(?:questa\s+)?prestazione/i;

/**
 * Banderas deterministas sobre el texto de una resolucion de la autoridad. Cada una trae la frase
 * literal y su ubicacion; son candidatas a impugnacion, no conclusiones juridicas. Las normas
 * citadas se leyeron en Fedlex: Art. 5 Abs. 1, 12, 29 Abs. 2 y 29a BV; Art. 328 Abs. 1 ZGB.
 */
export function reviewDecision(text: string): DecisionReviewFlag[] {
  const flags: DecisionReviewFlag[] = [];
  const statements = segmentDocument(
    { id: "decision", label: "Resolucion", author: "opposing_party", text },
    0,
  );
  const passageOf = (st: (typeof statements)[number]) => ({
    location: st.location,
    offset: st.offset,
    text: st.text,
  });
  const add = (
    type: DecisionReviewFlagType,
    strength: DecisionReviewFlag["strength"],
    items: typeof statements,
    why: string,
    legalAnchors: string[],
    reviewQuestions: string[],
    caveats: string[] = [],
  ): void => {
    flags.push({
      id: `REV-${flags.length + 1}`,
      type,
      strength,
      passages: items.slice(0, 3).map(passageOf),
      why,
      legalAnchors,
      reviewQuestions,
      caveats,
    });
  };
  const matching = (re: RegExp) => statements.filter((st) => re.test(st.text));

  const hasRemedyHeading =
    REMEDY_HEADINGS.test(text) ||
    /(?:Einsprache|Beschwerde|Rekurs|recours|opposition|réclamation|ricorso|opposizione)\w*[^.]{0,160}(?:binnen|innert|innerhalb|dans\s+un\s+délai|entro|nel\s+termine)/i.test(
      text,
    );
  const excluded = matching(APPEAL_EXCLUDED_RE);
  if (excluded.length > 0) {
    add(
      "appeal_excluded",
      "high",
      excluded,
      "La resolución declara que no cabe recurso (o solo una reconsideración ante la misma autoridad). Una instrucción así no vincula por sí sola al tribunal.",
      [
        "Art. 29a BV (Rechtsweggarantie): acceso a una autoridad judicial; solo la ley puede excluirlo en casos excepcionales",
      ],
      [
        "¿Existe por ley cantonal o federal un recurso contra este tipo de resolución? Compruébelo antes de dar por buena la instrucción.",
        "Si la instrucción es errónea o falta, ¿qué plazo rige para recurrir? No lo asuma: verifíquelo en la ley de procedimiento aplicable.",
      ],
      [
        "Una Wiedererwägung ante la misma autoridad no sustituye un recurso ante una instancia superior.",
      ],
    );
  } else if (!hasRemedyHeading) {
    add(
      "appeal_instruction_missing",
      "medium",
      [],
      "No se encontró ninguna instrucción de recursos (Rechtsmittelbelehrung) en la resolución.",
      ["Art. 29a BV (Rechtsweggarantie)"],
      [
        "¿La resolución trae la instrucción en otro documento o en el sobre? Una instrucción ausente puede afectar al cómputo del plazo.",
      ],
    );
  }

  const voluntary = matching(VOLUNTARY_RE);
  if (voluntary.length > 0) {
    add(
      "voluntary_benefit_claim",
      "medium",
      voluntary,
      "La autoridad califica la prestación de voluntaria o discrecional, y de ahí parece derivar que no hay derecho ni recurso.",
      [
        "Art. 12 BV (Recht auf Hilfe in Notlagen): derecho a los medios indispensables para una existencia digna",
      ],
      [
        "¿El derecho cantonal aplicable concede un derecho a la prestación solicitada? La calificación de la autoridad no lo decide.",
        "¿Se distingue la ayuda ordinaria de la ayuda en situación de necesidad del Art. 12 BV?",
      ],
      [
        "El Art. 12 BV garantiza un mínimo; lo que exceda de él depende del derecho cantonal, que esta herramienta no lee.",
      ],
    );
  }

  if (!NO_LEGAL_BASIS_RE.test(text)) {
    add(
      "no_legal_basis_cited",
      "high",
      [],
      "La resolución no cita ni un solo artículo de ninguna ley: no se puede verificar en qué norma se apoya.",
      ["Art. 5 Abs. 1 BV: la base y el límite de la actuación del Estado es el derecho"],
      [
        "¿Hay una base legal indicada en otro documento del expediente?",
        "¿Qué norma habilita a la autoridad a imponer cada consecuencia del dispositivo (plazos de espera, exclusiones)?",
      ],
    );
  }

  const refused = matching(EXAMINATION_REFUSED_RE);
  if (refused.length > 0) {
    add(
      "examination_refused",
      "medium",
      refused,
      "La autoridad declara innecesario examinar un extremo que fundamenta su decisión.",
      [
        "Art. 29 Abs. 2 BV (rechtliches Gehör)",
        "Art. 12 VwVG (Untersuchungsgrundsatz) para el procedimiento federal; compruebe el equivalente en el derecho cantonal aplicable",
      ],
      [
        "¿Sobre qué hecho decisivo no se practicó prueba ni comprobación?",
        "¿Se pidió a la persona afectada que aportara la prueba que se echa en falta?",
      ],
      [
        "Que el procedimiento esté o no regido por el principio de investigación de oficio depende de la ley aplicable.",
      ],
    );
  }

  const deniesAid =
    /(?:Sozialhilfe|Unterstützung|Leistung)[^.]{0,120}(?:abgelehnt|nicht\s+anerkannt|verweigert)|(?:abgelehnt|nicht\s+anerkannt|verweigert)[^.]{0,120}(?:Sozialhilfe|Unterstützung|Leistung)|(?:aide\s+sociale|prestation|soutien)[^.]{0,120}(?:refusé|rejeté|n['’]est\s+pas\s+(?:accordé|reconnu))|(?:aiuto\s+sociale|prestazione|sostegno)[^.]{0,120}(?:rifiutat|respint|negat)/i.test(
      text,
    );
  if (
    deniesAid &&
    !/Nothilfe|Art\.\s*12\s+BV|Hilfe\s+in\s+Notlagen|aide\s+d['’]urgence|art\.\s*12\s+Cst|situations?\s+de\s+détresse|aiuto\s+d['’]urgenza|art\.\s*12\s+Cost|situazioni?\s+di\s+bisogno/i.test(
      text,
    )
  ) {
    add(
      "emergency_aid_not_addressed",
      "high",
      matching(
        /(?:Antrag|Gesuch)[^.]{0,120}abgelehnt|nicht\s+über\s+ausreichende\s+(?:finanzielle\s+)?Mittel/i,
      ),
      "La resolución deniega la prestación sin examinar el derecho a ayuda en situación de necesidad, aunque la persona declara no tener medios suficientes.",
      [
        "Art. 12 BV (Recht auf Hilfe in Notlagen): derecho a los medios indispensables para una existencia digna",
      ],
      [
        "¿Examinó la autoridad si la persona se encuentra en una situación de necesidad que activa el Art. 12 BV, con independencia de la ayuda ordinaria?",
        "¿Qué medios tiene realmente disponibles la persona hoy?",
      ],
      [
        "El Art. 12 BV garantiza solo el mínimo indispensable; el alcance concreto lo precisa la jurisprudencia, que esta herramienta no lee.",
      ],
    );
  }

  // Un familiar en una frase y el apoyo supuesto en la siguiente ("Tiene un hermano. Se presume que le ayuda").
  const FAMILY_WORD =
    /\b(?:Bruder|Brüder|Schwester|Geschwister|frère|frères|sœur|fratello|sorella|fratelli)\b/i;
  const SUPPORT_WORD =
    /unterstütz|Unterstützung|soutien|soutenir|aider|aide\b|sostegno|sostenere|aiutare|aiuto/i;
  const familyAdjacent = statements.filter((st, idx) => {
    if (!FAMILY_WORD.test(st.text)) return false;
    if (FAMILY_RE.test(st.text)) return true;
    const next = statements[idx + 1];
    return next !== undefined && SUPPORT_WORD.test(next.text) && !FAMILY_WORD.test(next.text);
  });
  const family = [...new Set([...matching(FAMILY_RE), ...familyAdjacent])];
  if (family.length > 0) {
    add(
      "family_support_basis",
      "medium",
      family,
      "La resolución se apoya en la ayuda de hermanos o de otros familiares como razón para denegar la prestación.",
      [
        "Art. 328 Abs. 1 ZGB: la obligación de apoyo se refiere a parientes en línea ascendente y descendente",
      ],
      [
        "¿En qué norma se basa la obligación de un hermano? El Art. 328 Abs. 1 ZGB no menciona a los hermanos.",
        "¿Se acreditó que el familiar vive en circunstancias favorables y que es realmente exigible?",
      ],
      [
        "Puede haber una norma cantonal que regule la subsidiariedad frente al entorno familiar: esta herramienta no la lee.",
      ],
    );
  }

  const inference = matching(INFERENCE_RE);
  if (inference.length > 0) {
    add(
      "inference_without_evidence",
      "low",
      inference,
      "Conclusiones presentadas como presunciones ('es de suponer', 'lleva a concluir') y no como hechos comprobados.",
      [],
      [
        "¿Qué prueba concreta respalda cada presunción? ¿Se dio a la persona afectada la ocasión de rebatirla?",
      ],
    );
  }

  const budget = matching(BUDGET_RE);
  if (budget.length > 0) {
    add(
      "budget_rationale",
      "medium",
      budget,
      "La denegación se apoya, en parte, en la situación presupuestaria del ente que decide.",
      ["Art. 12 BV (Recht auf Hilfe in Notlagen)"],
      [
        "¿Es admisible por ley denegar una prestación por razones presupuestarias? Compruébelo en la ley y la jurisprudencia aplicables: esta herramienta no lo ha verificado.",
      ],
    );
  }
  return flags;
}
