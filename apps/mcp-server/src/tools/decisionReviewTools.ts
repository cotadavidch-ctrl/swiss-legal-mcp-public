import { z } from "zod";
import type { ToolContext, ToolRegistry } from "@swiss-legal-mcp/core";
import { analyzeDecisionText } from "./decisionDocumentAnalyzer.js";
import { extractNumbers, segmentDocument, type Statement } from "./opposingSubmissionAnalyzer.js";
import { activatedGrounds } from "./legalGroundsRegistry.js";
import { resolveCantonalProvider } from "./cantonalTools.js";
import {
  expandListedCitations,
  findArithmeticMismatches,
  findAppealIssues,
  findDateTensions,
  findLimitViolations,
  findSameReferenceConflicts,
} from "./decisionConsistency.js";
import { loadSourceText } from "./quoteTools.js";
import {
  ARTICLE_RE,
  collapseWhitespace,
  lawSourceForAbbreviation,
  verifyQuoteAgainstText,
} from "./quoteVerifier.js";

/**
 * Revision de una resolucion de la autoridad en DOS pasos, para que la lectura semantica la haga el
 * modelo que usa la herramienta y las garantias (frases literales, normas reales) las den las
 * herramientas:
 *
 *   1. prepare_decision_review: segmenta el texto en frases numeradas con su ubicacion, extrae
 *      fechas, importes, plazos y normas citadas, y devuelve una lista de comprobacion GENERICA
 *      (valida para cualquier resolucion) con las normas de apoyo leidas en Fedlex.
 *   2. verify_review_findings: comprueba que cada defecto que afirme el modelo cita una frase
 *      LITERAL de la resolucion y que cada articulo citado existe en Fedlex.
 *
 * Ninguna regla de esta lista se ha escrito mirando un caso concreto de evaluacion.
 */

interface VerifiedNorm {
  readonly id: string;
  readonly citation: string;
  /** Extracto LITERAL leido en Fedlex el 2026-11-13 (version vigente a esa fecha). */
  readonly excerpt: string;
  readonly appliesTo: string;
}

const NORMS: readonly VerifiedNorm[] = [
  {
    id: "bv5-1",
    citation: "Art. 5 Abs. 1 BV",
    excerpt: "Grundlage und Schranke staatlichen Handelns ist das Recht.",
    appliesTo: "toda actuación estatal",
  },
  {
    id: "bv5-2",
    citation: "Art. 5 Abs. 2 BV",
    excerpt: "Staatliches Handeln muss im öffentlichen Interesse liegen und verhältnismässig sein.",
    appliesTo: "toda actuación estatal",
  },
  {
    id: "bv5-3",
    citation: "Art. 5 Abs. 3 BV",
    excerpt: "Staatliche Organe und Private handeln nach Treu und Glauben.",
    appliesTo: "toda actuación estatal",
  },
  {
    id: "bv8-1",
    citation: "Art. 8 Abs. 1 BV",
    excerpt: "Alle Menschen sind vor dem Gesetz gleich.",
    appliesTo: "toda actuación estatal",
  },
  {
    id: "bv8-2",
    citation: "Art. 8 Abs. 2 BV",
    excerpt:
      "Niemand darf diskriminiert werden, namentlich nicht wegen der Herkunft, der Rasse, des Geschlechts, des Alters, der Sprache, der sozialen Stellung, der Lebensform, der religiösen, weltanschaulichen oder politischen Überzeugung oder wegen einer körperlichen, geistigen oder psychischen Behinderung.",
    appliesTo: "toda actuación estatal",
  },
  {
    id: "bv9",
    citation: "Art. 9 BV",
    excerpt:
      "Jede Person hat Anspruch darauf, von den staatlichen Organen ohne Willkür und nach Treu und Glauben behandelt zu werden.",
    appliesTo: "toda actuación estatal",
  },
  {
    id: "bv12",
    citation: "Art. 12 BV",
    excerpt:
      "Wer in Not gerät und nicht in der Lage ist, für sich zu sorgen, hat Anspruch auf Hilfe und Betreuung und auf die Mittel, die für ein menschenwürdiges Dasein unerlässlich sind.",
    appliesTo: "situaciones de necesidad",
  },
  {
    id: "bv29-2",
    citation: "Art. 29 Abs. 2 BV",
    excerpt: "Die Parteien haben Anspruch auf rechtliches Gehör.",
    appliesTo: "todo procedimiento ante autoridades",
  },
  {
    id: "bv29a",
    citation: "Art. 29a BV",
    excerpt:
      "Jede Person hat bei Rechtsstreitigkeiten Anspruch auf Beurteilung durch eine richterliche Behörde. Bund und Kantone können durch Gesetz die richterliche Beurteilung in Ausnahmefällen ausschliessen.",
    appliesTo: "acceso a un juez",
  },
  {
    id: "bv36",
    citation: "Art. 36 BV",
    excerpt:
      "Einschränkungen von Grundrechten bedürfen einer gesetzlichen Grundlage. Schwerwiegende Einschränkungen müssen im Gesetz selbst vorgesehen sein.",
    appliesTo:
      "restricción de derechos fundamentales (Abs. 2: interés público, Abs. 3: proporcionalidad, Abs. 4: núcleo intangible)",
  },
  {
    id: "zgb328",
    citation: "Art. 328 Abs. 1 ZGB",
    excerpt:
      "Wer in günstigen Verhältnissen lebt, ist verpflichtet, Verwandte in auf- und absteigender Linie zu unterstützen, die ohne diesen Beistand in Not geraten würden.",
    appliesTo: "obligación de apoyo entre parientes",
  },
  {
    id: "vwvg12",
    citation: "Art. 12 VwVG",
    excerpt:
      "Die Behörde stellt den Sachverhalt von Amtes wegen fest und bedient sich nötigenfalls folgender Beweismittel:",
    appliesTo: "procedimiento administrativo FEDERAL",
  },
  {
    id: "vwvg30-1",
    citation: "Art. 30 Abs. 1 VwVG",
    excerpt: "Die Behörde hört die Parteien an, bevor sie verfügt.",
    appliesTo: "procedimiento administrativo FEDERAL (Abs. 2 prevé excepciones)",
  },
  {
    id: "vwvg35",
    citation: "Art. 35 Abs. 1 und 2 VwVG",
    excerpt:
      "Schriftliche Verfügungen sind, auch wenn die Behörde sie in Briefform eröffnet, als solche zu bezeichnen, zu begründen und mit einer Rechtsmittelbelehrung zu versehen. Die Rechtsmittelbelehrung muss das zulässige ordentliche Rechtsmittel, die Rechtsmittelinstanz und die Rechtsmittelfrist nennen.",
    appliesTo: "procedimiento administrativo FEDERAL",
  },
  {
    id: "vwvg38",
    citation: "Art. 38 VwVG",
    excerpt: "Aus mangelhafter Eröffnung darf den Parteien kein Nachteil erwachsen.",
    appliesTo: "procedimiento administrativo FEDERAL",
  },
  {
    id: "atsg42",
    citation: "Art. 42 ATSG",
    excerpt:
      "Die Parteien haben Anspruch auf rechtliches Gehör. Sie müssen nicht angehört werden vor Verfügungen, die durch Einsprache anfechtbar sind.",
    appliesTo: "seguros sociales FEDERALES",
  },
  {
    id: "atsg43",
    citation: "Art. 43 Abs. 1 ATSG",
    excerpt:
      "Der Versicherungsträger prüft die Begehren, nimmt die notwendigen Abklärungen von Amtes wegen vor und holt die erforderlichen Auskünfte ein.",
    appliesTo: "seguros sociales FEDERALES",
  },
  {
    id: "atsg49",
    citation: "Art. 49 Abs. 3 ATSG",
    excerpt:
      "Die Verfügungen werden mit einer Rechtsmittelbelehrung versehen. Sie sind zu begründen, wenn sie den Begehren der Parteien nicht voll entsprechen.",
    appliesTo: "seguros sociales FEDERALES",
  },
  {
    id: "atsg56",
    citation: "Art. 56 Abs. 1 ATSG",
    excerpt:
      "Gegen Einspracheentscheide oder Verfügungen, gegen welche eine Einsprache ausgeschlossen ist, kann Beschwerde erhoben werden.",
    appliesTo: "seguros sociales FEDERALES",
  },
];

type Category = "formal" | "base legal" | "material" | "probatorio" | "procesal" | "interno";

interface ChecklistItem {
  readonly id: string;
  readonly category: Category;
  readonly topic: string;
  readonly question: string;
  readonly normIds: readonly string[];
  /** Pistas GENERICAS: solo senalan donde mirar, no deciden nada. */
  readonly cue: RegExp | null;
}

const CHECKLIST: readonly ChecklistItem[] = [
  {
    id: "F1",
    category: "formal",
    topic: "Instruccion de recursos",
    question:
      "¿La resolución trae una instrucción de recursos? ¿Nombra el recurso admisible, la instancia y el plazo? ¿Excluye el recurso o lo limita a una reconsideración? ¿Es coherente con el derecho aplicable?",
    normIds: ["vwvg35", "bv29a", "atsg49", "atsg56", "vwvg38"],
    cue: /Rechtsmittel|Rekurs|Beschwerde|Einsprache|Anfechtung|anfechtbar|voies?\s+de\s+droit|recours|opposition|ricorso/i,
  },
  {
    id: "F2",
    category: "formal",
    topic: "Autoridad competente",
    question:
      "¿Decide la autoridad que según la ley es competente? ¿Hay una delegación visible o decide otra en su lugar?",
    normIds: ["bv5-1"],
    cue: /zuständig|Zuständigkeit|anstelle|delegi|comp[ée]tent|competenza|verfügt\s+(?:\w+\s+)?selbst|entbehrlich|anstatt|statt\s+der|au\s+lieu\s+d|à\s+la\s+place|sans\s+délégation|ohne\s+Delegation|incomp[ée]tent|incompetente|al\s+posto\s+di|invece\s+di|senza\s+delega|compétence|competenza\s+del/i,
  },
  {
    id: "F3",
    category: "formal",
    topic: "Fecha, firma y notificacion",
    question:
      "¿Constan fecha, firma, número de expediente y la forma de notificación? ¿Hay datos de identificación incoherentes?",
    normIds: ["vwvg35", "vwvg38"],
    cue: /Eröffnung|eröffnet|Zustellung|zugestellt|Unterschrift|notifi|signé|Datum|notifica|notificata|firma|signature|data\s+di\s+invio|date\s+d['’]envoi/i,
  },
  {
    id: "F4",
    category: "formal",
    topic: "Motivacion",
    question:
      "¿La resolución explica los motivos de cada consecuencia que impone o se limita a conclusiones?",
    normIds: ["vwvg35", "atsg49", "bv29-2"],
    cue: /Begründung|Erwägung|rechtliche\s+Beurteilung|motifs|considérants|considerazioni|motivazione|motivi|motivation/i,
  },
  {
    id: "B1",
    category: "base legal",
    topic: "Base legal de cada consecuencia",
    question:
      "Para cada consecuencia del dispositivo (denegación, sanción, plazo de espera, exclusión, obligación), ¿se cita la norma que la prevé? ¿La norma citada existe y dice lo que se afirma?",
    normIds: ["bv5-1", "bv36"],
    cue: /wird\s+(?:vollständig\s+)?(?:abgelehnt|verweigert|gekürzt|eingestellt|auferlegt|angeordnet|verfügt)|aufgefordert|verpflichtet|frühestens|Sanktion|Busse|Einstelltage|sont\s+refus|est\s+refus|ordonn|est\s+(?:infligée|infligé|prononcé)|sera\s+exécut|multa|sanzione|è\s+respint|rifiutat|giorni\s+di\s+sospensione|suspension/i,
  },
  {
    id: "B2",
    category: "base legal",
    topic: "Normas citadas",
    question:
      "¿Qué normas cita la resolución? ¿Hay afirmaciones jurídicas importantes sin ninguna cita? ¿Alguna cita parece inexistente o mal atribuida?",
    normIds: ["bv5-1"],
    cue: /\bArt\.\s*\d|§\s*\d|\bart\.\s*\d|Gesetz|Verordnung|Reglement|loi\b|ordonnance|legge\b|ordinanza|\bartt?\.\s*\d/i,
  },
  {
    id: "M1",
    category: "material",
    topic: "Criterios que la ley preve",
    question:
      "¿La resolución aplica criterios, requisitos o exclusiones automáticos que la ley no establece (por ejemplo, requisitos absolutos o sin examinar el caso concreto)?",
    normIds: ["bv5-1", "bv9"],
    cue: /zwingend|ausschliesslich|ausschließlich|unabhängig\s+von|in\s+sämtlichen|pauschal|automatisch|ohne\s+Rücksicht|exclusivement|sans\s+égard|obbligatoriamente|esclusivamente|indipendentemente|automaticamente|systématiquement|de\s+manière\s+absolue/i,
  },
  {
    id: "M2",
    category: "material",
    topic: "Proporcionalidad",
    question:
      "¿La consecuencia impuesta es proporcionada al hecho y al fin perseguido? ¿Se sopesaron alternativas más suaves?",
    normIds: ["bv5-2", "bv36"],
    cue: /Sanktion|Busse|Kürzung|Einstellung|Gebühr|Wartefrist|Karenz|Sperre|Frist\s+von|Monate|Tage|amende|sanction|délai|termine|mesi|giorni|mois|jours|multa|sanzione/i,
  },
  {
    id: "M3",
    category: "material",
    topic: "Igualdad y discriminacion",
    question:
      "¿Algún criterio decisivo se basa en edad, origen, nacionalidad, sexo, idioma, religión, discapacidad u otro rasgo del Art. 8 Abs. 2 BV? ¿Hay un trato diferente sin justificación?",
    normIds: ["bv8-1", "bv8-2"],
    cue: /\bAlter\b|Alters|Nationalit|Staatsangehörig|Ausländ|ausländisch|Herkunft|Geschlecht|Religion|Sprache|Behinder|Zivilstand|nationalit|étranger|origine|\bâge\b|età|straniero|nazionalit|cittadinanza|religione|\bsesso\b|genere|\bsexe\b|handicap|\bgenre\b/i,
  },
  {
    id: "M4",
    category: "material",
    topic: "Derechos fundamentales y necesidad",
    question:
      "¿Está en juego la existencia, el alojamiento o los medios básicos de la persona? ¿Se examinó el derecho a ayuda en situación de necesidad con independencia de la prestación ordinaria?",
    normIds: ["bv12", "bv36"],
    cue: /Notlage|Existenz|Notfall|Nothilfe|Obdach|Existenzminimum|menschenwürdig|nécessité|détresse|urgence|necessità|emergenza|minimo\s+vitale|aiuto\s+d['’]urgenza|bisogno|minimum\s+vital|aide\s+d['’]urgence/i,
  },
  {
    id: "M5",
    category: "material",
    topic: "Obligaciones familiares o de terceros",
    question:
      "¿La resolución exige o presume ayuda de familiares u otras personas? ¿En qué norma se basa esa obligación y alcanza realmente a esas personas?",
    normIds: ["zgb328"],
    cue: /Bruder|Brüder|Schwester|Geschwister|Familienangehörig|Verwandt|Eltern|Kinder|famille|frère|sœur|parent|fratello|sorella|famiglia|genitori|fils|fille|enfants/i,
  },
  {
    id: "P1",
    category: "probatorio",
    topic: "Hechos probados o presumidos",
    question:
      "¿Qué hechos decisivos están comprobados con una prueba y cuáles se dan por supuestos o se presumen? ¿Se presenta como hecho lo que es una suposición?",
    normIds: ["bv9", "bv29-2"],
    cue: /davon\s+auszugehen|anzunehmen|vermutet|lässt?\s+darauf|lassen\s+darauf|offenbar|vermutlich|wahrscheinlich|schliesst?\s+darauf|présum|il\s+y\s+a\s+lieu\s+de\s+supposer|semble|si\s+presume|è\s+da\s+presumere|sembra|probabilmente|apparentemente|vraisemblablement|probablement/i,
  },
  {
    id: "P2",
    category: "probatorio",
    topic: "Carga de la prueba",
    question:
      "¿Quién debe probar qué? ¿Se exige a la persona probar un hecho negativo o imposible, o se invierte la carga sin base?",
    normIds: ["bv9", "bv29-2"],
    cue: /nachgewiesen|Nachweis|beweisen|Beweis|Beweislast|glaubhaft|dargetan|prouver|preuve|prova|dimostrare|onere\s+della\s+prova|charge\s+de\s+la\s+preuve|fardeau|démontrer/i,
  },
  {
    id: "P3",
    category: "probatorio",
    topic: "Prueba ignorada o no practicada",
    question:
      "¿Hay documentos o pruebas aportados que la resolución no leyó, no valoró o declaró innecesarios? ¿Se omite una comprobación que habría sido decisiva?",
    normIds: ["bv29-2", "vwvg12", "atsg43"],
    cue: /nicht\s+gelesen|nicht\s+berücksichtigt|unberücksichtigt|nicht\s+geprüft|nicht\s+erforderlich|nicht\s+notwendig|verzichtet|absehen|übergangen|unterbleibt|unerheblich|unbeachtlich|nicht\s+protokolliert|nicht\s+näher|gelten\s+als|pas\s+lu|pas\s+pris\s+en\s+compte|renoncé|dépourvus?\s+de\s+force|force\s+probante|réputés|n['’]est\s+pas\s+procédé|non\s+letto|non\s+considerat|non\s+esaminat|rinuncia|irrilevante|privi\s+di\s+forza\s+probante|écarté|ignoré/i,
  },
  {
    id: "R1",
    category: "procesal",
    topic: "Audiencia previa (rechtliches Gehoer)",
    question:
      "¿Se oyó a la persona antes de decidir? ¿Pudo ver el expediente y comentar los elementos desfavorables? Si no hay ninguna mención a la audiencia, ¿es un indicio de que no hubo?",
    normIds: ["bv29-2", "vwvg30-1", "atsg42"],
    cue: /angehört|Anhörung|Stellungnahme|Akteneinsicht|Einsicht|Äusserung|verweigert|rechtliches\s+Gehör|Gelegenheit|entendu|droit\s+d['’]être\s+entendu|audition|consult\w+\s+(?:du\s+)?dossier|consulter\s+les\s+pièces|observations|sentit[oa]|audizione|consultazione\s+degli\s+atti|diritto\s+di\s+essere\s+sentito|osservazioni|consultare/i,
  },
  {
    id: "R2",
    category: "procesal",
    topic: "Investigacion de oficio",
    question:
      "¿La autoridad comprobó por sí misma los hechos decisivos, o se limitó a reprochar a la persona no haberlos probado?",
    normIds: ["vwvg12", "atsg43"],
    cue: /Abklärung|abgeklärt|Untersuchung|von\s+Amtes\s+wegen|Erhebung|Prüfung|geprüft|instruction|enquête|vérification|accertamento|istruzione|verifica|indagine|d['’]ufficio|d['’]office|constater/i,
  },
  {
    id: "I1",
    category: "interno",
    topic: "Coherencia de fechas, importes y hechos",
    question:
      "Compare las fechas, importes, plazos y cifras de `keyFacts` entre sí y con el texto. ¿Hay periodos con el final antes del principio, cifras que no cuadran, fechas que deberían ir en otro orden, o un hecho dado de dos maneras distintas?",
    normIds: ["bv9", "bv29-2"],
    cue: null,
  },
  {
    id: "I2",
    category: "interno",
    topic: "Contradicciones del razonamiento",
    question:
      "¿La resolución se contradice (reconoce un hecho y luego lo niega, aplica un criterio y lo descarta, usa una cifra y otra distinta)?",
    normIds: ["bv9", "bv29-2"],
    cue: /einerseits|andererseits|obwohl|jedoch|widerspr|dennoch|d['’]une\s+part|d['’]autre\s+part|bien\s+que|da\s+un\s+lato|dall['’]altro|benché|tuttavia|contraddizion|contradiction|pourtant|toutefois/i,
  },
];

const FINDING_SCHEMA = {
  checklistId: "id del punto de la lista (p. ej. F1, B1, P3)",
  quote: "copia LITERAL de una frase de la resolución (de `statements[].text`); es obligatoria",
  claim: "el defecto que afirma, en una o dos frases",
  norms:
    "citas exactas de normas, p. ej. 'Art. 29 Abs. 2 BV' (solo si puede indicar el artículo; use `verifiedNorms` como guía)",
  severity: "alta | media | baja",
};

const MAX_STATEMENTS_DEFAULT = 250;

function statementCues(statements: readonly Statement[], cue: RegExp | null, limit = 12): string[] {
  if (!cue) return [];
  return statements
    .filter((s) => cue.test(s.text))
    .slice(0, limit)
    .map((s) => s.id);
}

const FEDERAL_ABBREVIATIONS =
  /\((OR\|[^)]+)\)/.exec(ARTICLE_RE.source)?.[1] ?? "BV";

function keyFactsOf(statements: readonly Statement[], fullText: string) {
  const dates: { iso: string; statement: string; location: string }[] = [];
  const amounts: { value: string; statement: string; location: string }[] = [];
  const durations: { unit: string; value: string; statement: string; location: string }[] = [];
  for (const s of statements) {
    const nums = extractNumbers(s.text);
    for (const d of nums.get("date") ?? []) {
      dates.push({ iso: d, statement: s.id, location: s.location });
    }
    for (const a of nums.get("amount") ?? []) {
      amounts.push({ value: a, statement: s.id, location: s.location });
    }
    for (const unit of ["days", "weeks", "months", "years"] as const) {
      for (const v of nums.get(unit) ?? []) {
        durations.push({ unit, value: v, statement: s.id, location: s.location });
      }
    }
  }
  const cited: { citation: string; statement: string }[] = [];
  const cantonal: { citation: string; statement: string }[] = [];
  for (const s of statements) {
    for (const m of s.text.matchAll(new RegExp(ARTICLE_RE.source, "g"))) {
      cited.push({ citation: m[0], statement: s.id });
    }
    // Francés e italiano: "art. 29 al. 2 Cst.", "article 9 Cst.", "art. 12 cpv. 1 LAS".
    for (const m of s.text.matchAll(
      new RegExp(
        `\\b(?:art(?:icle|icolo)?\\.?)\\s*(\\d+[a-z]{0,2})(?:,?\\s*(?:al(?:inéa|\\.)|cpv\\.|capoverso)\\s*\\d+[a-z]?(?:\\s*(?:et|e|,|-|–)\\s*\\d+[a-z]?)*)?(?:\\s*(?:let\\.|lit\\.)\\s*[a-z])?\\s+(${FEDERAL_ABBREVIATIONS})\\b`,
        "g",
      ),
    )) {
      if (/^Art\./.test(m[0])) continue; // ya recogido por ARTICLE_RE
      cited.push({ citation: m[0].replace(/^art(?:icle|icolo)?\.?/i, "Art."), statement: s.id });
    }
    for (const c of expandListedCitations(s.text)) {
      cited.push({ citation: c, statement: s.id });
    }
    for (const m of s.text.matchAll(
      /§\s*\d+[a-z]?(?:\s+Abs\.\s*\d+)?(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöü]+)?/g,
    )) {
      cantonal.push({ citation: m[0].trim(), statement: s.id });
    }
    for (const m of s.text.matchAll(
      /\b[Aa]rt(?:icle|\.)\s*(\d+[a-z]?)(?:,?\s*(?:al(?:inéa|\.)|cpv\.)\s*\d+)?\s+(?:de\s+la\s+loi[^()]{0,100}\((?:[^;)]*;\s*)?([A-Z]{2,8})\b|(?:de\s+la\s+|du\s+)?([A-Z]{2,8})\b)/g,
    )) {
      const abbr = m[2] ?? m[3];
      if (!abbr || new RegExp(`^(?:${FEDERAL_ABBREVIATIONS})$`).test(abbr)) continue;
      cantonal.push({ citation: `Art. ${m[1]} ${abbr}`, statement: s.id });
    }
  }
  dates.sort((x, y) => x.iso.localeCompare(y.iso));
  return {
    dates,
    amounts,
    durations,
    citedFederalNorms: cited,
    citedCantonalNormsNotVerifiable: cantonal,
    anyNormCited: cited.length + cantonal.length > 0 || /\bart\.\s*\d/i.test(fullText),
  };
}

const findingInput = z.object({
  checklistId: z.string().min(1).max(10).optional(),
  quote: z.string().min(8).max(3000),
  claim: z.string().min(5).max(1500),
  norms: z.array(z.string().min(3).max(120)).max(8).optional(),
  severity: z.enum(["alta", "media", "baja"]).optional(),
});

export interface NormCheck {
  readonly citation: string;
  readonly status: "verified_exists" | "not_found" | "source_unavailable" | "unverifiable";
  readonly scope: "federal" | "cantonal" | null;
  readonly officialExcerpt: string | null;
  /** Texto completo (acotado) para comprobar la coherencia con la afirmacion; no se devuelve. */
  readonly fullText: string | null;
  readonly note: string | null;
  /** Solo si se pidio una fecha de referencia y la norma es federal. */
  readonly versionAtDate?: {
    readonly date: string;
    readonly officialExcerpt: string | null;
    readonly differsFromCurrent: boolean | null;
    readonly note: string | null;
  };
}

interface NormOptions {
  readonly canton?: string | undefined;
  readonly asOfDate?: string | undefined;
}

/**
 * Leyes cantonales cuyo numero sistematico se LEYO en la fuente oficial del canton el 2026-11-13.
 * Solo cantones con acceso a nivel de articulo (LexWork). No se inventa ninguna correspondencia.
 */
const CANTONAL_LAWS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  AR: { SHG: "851.1", GG: "151.11", VRPG: "143.1" },
  GE: { LGD: "rsg_l1_20", LPA: "rsg_e5_10" },
  SG: { ALVG: "361.0", SHG: "381.1", VRP: "951.1" },
};

const SUPPORTED_ABBREVIATIONS = [
  "OR",
  "CO",
  "ZGB",
  "CC",
  "ATSG",
  "LPGA",
  "BGG",
  "LTF",
  "VwVG",
  "PA",
  "SchKG",
  "LP",
  "AVIG",
  "LACI",
  "StGB",
  "CP",
  "BV",
  "Cst",
  "Cost",
  "IVG",
  "LAI",
  "AHVG",
  "LAVS",
  "UVG",
  "LAA",
  "BVG",
  "LPP",
  "StHG",
  "LHID",
  "KVG",
  "LAMal",
  "DBG",
  "LIFD",
  "RPG",
  "LAT",
  "VZAE",
  "OASA",
  "BüG",
  "LN",
  "VGG",
  "LTAF",
  "SVG",
  "LCR",
  "MWSTG",
  "LTVA",
  "ArG",
  "LTr",
  "GlG",
  "LEg",
  "USG",
  "LPE",
  "BPG",
  "LPers",
  "DSG",
  "LPD",
  "StPO",
  "CPP",
  "ZPO",
  "CPC",
  "ZUG",
  "LAS",
  "AIG",
  "LEI",
  "AsylG",
  "LAsi",
];

/** Restos de HTML en el texto de los portales cantonales (p. ej. "&nbsp;<strong>*</strong>"). */
export function cleanCantonalHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+\*\s*(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

const ABBR_CACHE = new Map<string, string>();

/** Titulos exactos (sin sigla) de las leyes cantonales mas citadas; solo se acepta una coincidencia unica. */
const TITLE_ALIASES: Readonly<Record<string, { query: string; title: RegExp }>> = {
  SHG: {
    query: "Sozialhilfe",
    title: /^(?:Gesetz über (?:die )?(?:öffentliche )?Sozialhilfe|Sozialhilfegesetz)$/,
  },
  VRPG: { query: "Verwaltungsrechtspflege", title: /^(?:Gesetz über die )?Verwaltungsrechtspflege(?:gesetz)?$/ },
  VRG: { query: "Verwaltungsrechtspflege", title: /^(?:Gesetz über die )?Verwaltungsrechtspflege(?:gesetz)?$/ },
  VRP: { query: "Verwaltungsrechtspflege", title: /^(?:Gesetz über die )?Verwaltungsrechtspflege(?:gesetz)?$/ },
  StG: { query: "Steuergesetz", title: /^(?:Steuergesetz|Gesetz über die Staats- und Gemeindesteuern)$/ },
  BauG: { query: "Baugesetz", title: /^(?:Baugesetz|Planungs- und Baugesetz)$/ },
  PBG: { query: "Baugesetz", title: /^(?:Planungs- und Baugesetz|Gesetz über das Planungs- und Bauwesen)$/ },
};
const NOT_A_LAW = new Set([
  "Abs", "Absatz", "Ziff", "Ziffer", "lit", "und", "der", "die", "das", "des", "vom", "im", "bis",
  "BGE", "ATF", "DTF", "Art", "Satz", "Nr", "al", "cpv", "let",
]);

/**
 * Siglas de leyes cantonales: primero la tabla leida a mano; si no esta, se busca en el catalogo
 * oficial del canton una ley cuyo titulo termina en "(SIGLA)". Solo se acepta si hay UNA unica
 * coincidencia: con ambiguedad o sin ella, la norma queda sin verificar (no se adivina).
 */
async function resolveCantonalSr(
  context: ToolContext & { signal?: AbortSignal },
  canton: string,
  abbr: string,
): Promise<string | undefined> {
  const code = canton.toUpperCase();
  const fixed = CANTONAL_LAWS[code]?.[abbr];
  if (fixed) return fixed;
  if (NOT_A_LAW.has(abbr)) return undefined;
  const key = `${code}|${abbr}`;
  const cached = ABBR_CACHE.get(key);
  if (cached) return cached;
  try {
    const resolved = resolveCantonalProvider(context.providers, code);
    if (resolved.family !== "lexwork" && resolved.family !== "sil") return undefined;
    const out = await (
      resolved.provider as unknown as {
        searchDocuments: (p: { query: string; pageSize: number }) => Promise<{
          results: {
            title?: string;
            sourceOriginalId?: string;
            rawMetadata?: Record<string, unknown>;
          }[];
        }>;
      }
    ).searchDocuments({ query: `${abbr})`, pageSize: 50 });
    const ids = new Set<string>();
    const end = new RegExp(`[(,;]\\s*${abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`);
    for (const r of out.results) {
      if (!end.test(r.title ?? "")) continue;
      const id =
        resolved.family === "sil"
          ? (r.sourceOriginalId ?? "")
          : asText(r.rawMetadata?.["systematicNumber"]);
      if (id) ids.add(id);
    }
    if (ids.size === 0 && resolved.family === "lexwork") {
      // Cantones cuyos titulos no llevan sigla: se acepta solo un titulo EXACTO conocido para esa sigla.
      const alias = TITLE_ALIASES[abbr];
      if (alias) {
        const wide = await (
          resolved.provider as unknown as {
            searchDocuments: (p: { query: string; pageSize: number }) => Promise<{
              results: { title?: string; rawMetadata?: Record<string, unknown> }[];
            }>;
          }
        ).searchDocuments({ query: alias.query, pageSize: 100 });
        for (const r of wide.results) {
          if (!alias.title.test((r.title ?? "").trim())) continue;
          const id = asText(r.rawMetadata?.["systematicNumber"]);
          if (id) ids.add(id);
        }
      }
    }
    if (ids.size !== 1) return undefined;
    const sr = [...ids][0]!;
    ABBR_CACHE.set(key, sr);
    return sr;
  } catch {
    return undefined;
  }
}

async function checkNorm(
  citation: string,
  cache: Map<string, NormCheck>,
  context: ToolContext & { signal?: AbortSignal },
  opts: NormOptions = {},
): Promise<NormCheck> {
  const key = `${citation.replace(/\s+/g, " ").trim().toLowerCase()}|${opts.canton ?? ""}|${opts.asOfDate ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = { fullText: null as string | null };
  const federal = new RegExp(ARTICLE_RE.source, "i").exec(citation);
  let result: NormCheck;
  if (federal) {
    const abbreviation = SUPPORTED_ABBREVIATIONS.find(
      (a) => a.toLowerCase() === federal[2]!.toLowerCase(),
    );
    const law = abbreviation ? lawSourceForAbbreviation(abbreviation) : null;
    if (!law) {
      result = {
        citation,
        status: "unverifiable",
        scope: null,
        officialExcerpt: null,
        ...base,
        note: "Ley sin identificador Fedlex comprobado.",
      };
    } else {
      const articleSource = {
        type: "article" as const,
        ...(law.eli ? { eli: law.eli } : {}),
        ...(law.systematicNumber ? { systematicNumber: law.systematicNumber } : {}),
        articleNumber: federal[1]!,
        language: law.language,
      };
      const loaded = await loadSourceText(articleSource, context);
      if (loaded.ok) {
        const current = collapseWhitespace(loaded.text);
        let versionAtDate: NormCheck["versionAtDate"];
        if (opts.asOfDate) {
          const dated = await loadSourceText({ ...articleSource, date: opts.asOfDate }, context);
          versionAtDate = dated.ok
            ? {
                date: opts.asOfDate,
                officialExcerpt: collapseWhitespace(dated.text).slice(0, 600),
                differsFromCurrent: collapseWhitespace(dated.text) !== current,
                note: null,
              }
            : {
                date: opts.asOfDate,
                officialExcerpt: null,
                differsFromCurrent: null,
                note: dated.note ?? "No se pudo obtener la versión a esa fecha.",
              };
        }
        result = {
          citation,
          status: "verified_exists",
          scope: "federal",
          officialExcerpt: current.slice(0, 600),
          fullText: current.slice(0, 20_000),
          note: null,
          ...(versionAtDate ? { versionAtDate } : {}),
        };
      } else if (/NOT_FOUND|not\s+found|no\s+se\s+encontr|no\s+existe/i.test(loaded.note ?? "")) {
        result = {
          citation,
          status: "not_found",
          scope: "federal",
          officialExcerpt: null,
          ...base,
          note: loaded.note,
        };
      } else {
        result = {
          citation,
          status: "source_unavailable",
          scope: "federal",
          officialExcerpt: null,
          ...base,
          note: loaded.note,
        };
      }
    }
  } else {
    const cantonal =
      /(?:Art\.|§)\s*(\d+[a-z]{0,2})(?:\s*Abs\.\s*\d+[a-z]?(?:\s*(?:und|bis|,|-|–)\s*\d+[a-z]?)*)?(?:\s*lit\.\s*[a-z])?\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöü]{1,8})\b/.exec(
        citation,
      );
    const sr =
      opts.canton && cantonal
        ? await resolveCantonalSr(context, opts.canton, cantonal[2]!)
        : undefined;
    if (!cantonal || !opts.canton || !sr) {
      result = {
        citation,
        status: "unverifiable",
        scope: null,
        officialExcerpt: null,
        ...base,
        note: /§/.test(citation) && !opts.canton
          ? "Norma cantonal o comunal con '§': indique 'canton' para verificarla (solo cantones con lectura de artículos)."
          : opts.canton
            ? `La sigla '${cantonal?.[2] ?? "?"}' no se pudo resolver de forma única en el catálogo oficial del cantón ${opts.canton.toUpperCase()} (sin coincidencia, ambigua o canton sin lectura de artículos).`
            : "No se reconoce como ley federal soportada. Indique 'canton' para verificar derecho cantonal de los cantones con acceso a artículo.",
      };
    } else {
      try {
        const resolved = resolveCantonalProvider(context.providers, opts.canton);
        const doc = await (
          resolved.provider as unknown as {
            getArticle: (
              sr: string,
              article: string,
            ) => Promise<{ fullText?: string; contentNature?: string }>;
          }
        ).getArticle(sr, cantonal[1]!);
        if (doc.fullText && doc.contentNature === "literal") {
          const text = collapseWhitespace(cleanCantonalHtml(doc.fullText));
          result = {
            citation,
            status: "verified_exists",
            scope: "cantonal",
            officialExcerpt: text.slice(0, 600),
            fullText: text.slice(0, 20_000),
            note: "Versión vigente en la fuente cantonal; no se puede obtener la versión a otra fecha.",
          };
        } else {
          result = {
            citation,
            status: "source_unavailable",
            scope: "cantonal",
            officialExcerpt: null,
            ...base,
            note: "La fuente cantonal no devolvió el texto literal.",
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result = {
          citation,
          status: /NOT_FOUND|No se encontro/i.test(message) ? "not_found" : "source_unavailable",
          scope: "cantonal",
          officialExcerpt: null,
          ...base,
          note: /NOT_FOUND|No se encontro/i.test(message)
            ? "No figura en la versión vigente de la ley cantonal (puede estar derogado, renumerado o no existir): compruebe la versión de la fecha de los hechos."
            : message.slice(0, 240),
        };
      }
    }
  }
  cache.set(key, result);
  return result;
}

const ROMANCE_STOP = new Set([
  "également","cependant","toutefois","lorsque","pourtant","ensuite","notamment","indépendamment",
  "expressément","société","entreprise","destinataire","procès-verbal","parcelle","décision",
]);

/** Raices de palabras de parte o de procedimiento: no son contenido de la norma. */
const PROCEDURE_STEMS = new Set([
  "gesuch",
  "antrag",
  "beschw",
  "behörd",
  "verfüg",
  "kläger",
  "beklag",
  "rekurr",
  "sozial",
  "gemein",
  "erwägu",
  "sachve",
  "décisi",
  "admini",
  "autori",
  "procéd",
  "servic",
]);

const MONTHS = new Set([
  "januar","februar","märz","april","juni","juli","august","september","oktober","november","dezember",
]);

/**
 * Garantias constitucionales generales: su texto es abstracto, asi que "terminos que no aparecen"
 * es siempre cierto y no informa. Para ellas no se emite la senal lexica.
 */
const GENERAL_CLAUSE_RE = /^Art\.\s*(5|9)\b.*\bBV\b/i;
/** Garantias constitucionales de texto abstracto: la senal lexica no informa. */
const NO_LEXICAL_RE = /^Art\.\s*(5|8|9|12|29|29a|36)\b.*\bBV\b/i;

/** Marcas de coleccion sistematica cantonal que delatan el canton de la resolucion. */
const CANTON_MARKERS: readonly [RegExp, string][] = [
  [/\bLS\s+\d{3}(?:\.\d+)*/, "ZH"],
  [/\bbGS\s+\d{3}(?:\.\d+)*/, "AR"],
  [/\bBSG\s+\d{3}(?:\.\d+)*/, "BE"],
  [/\bsGS\s+\d{3}(?:\.\d+)*/, "SG"],
  [/\bSAR\s+\d{3}(?:\.\d+)*/, "AG"],
];

export function cantonConflictWarning(text: string, declared: string | undefined): string | null {
  const found = new Set<string>();
  for (const [re, canton] of CANTON_MARKERS) if (re.test(text)) found.add(canton);
  if (found.size === 0) return null;
  const list = [...found].join(", ");
  if (!declared) {
    return `El texto cita normas con marcas de coleccion cantonal (${list}); indique 'canton' para verificar derecho cantonal si el cantón tiene acceso a artículo.`;
  }
  if (!found.has(declared.toUpperCase())) {
    return `Posible canton equivocado: indico '${declared.toUpperCase()}' pero el texto cita normas con marcas de coleccion de ${list}. Las leyes cantonales no se verificaran contra el canton correcto.`;
  }
  return null;
}

type NormFit =
  | "no_norm"
  | "not_applicable"
  | "unverified"
  | "general_clause_only"
  | "specific_weak"
  | "specific";
const NORM_FIT_NOTE: Record<NormFit, string> = {
  no_norm: "",
  not_applicable: "",
  unverified: "",
  specific: "",
  general_clause_only:
    "Las únicas normas verificadas son garantías generales de la BV (Art. 5, 8, 9, 12, 29, 29a, 36): confirman que el artículo existe, pero no sustentan por sí solas el defecto concreto. Busque la norma específica.",
  specific_weak:
    "La norma específica verificada contiene pocos de los términos de la cita: compruebe que es la norma que corresponde al defecto.",
};

const STOP_TERMS = new Set(
  "diese dieser dieses diesen einer einen eines werden wurde wurden sowie jedoch daher dabei damit haben hatte kann kann nicht auch eine".split(
    " ",
  ),
);

/**
 * Terminos (sustantivos alemanes en mayuscula, 6+ letras) de la frase de la resolucion y de la
 * afirmacion que NO aparecen en el texto oficial del articulo invocado. Es una senal LEXICA: puede
 * apuntar a que el articulo no trata lo que se le atribuye (p. ej. 'Bruder' frente a un articulo
 * que solo habla de parientes en linea recta), pero no prueba nada por si sola.
 */
const ROMANCE_FUNCTION_WORDS =
  /\b(?:le|la|les|des|du|est|que|pour|dans|une|aux|par|sur|il|elle|qui|dont|della|che|per|del|nel|sono)\b/gi;

export function termsNotInNorm(sourceTexts: readonly string[], normText: string): string[] {
  const stem = (w: string): string => w.toLowerCase().slice(0, 6);
  const normStems = new Set((normText.match(/\p{L}{4,}/gu) ?? []).map((w) => stem(w)));
  const missing = new Set<string>();
  for (const text of sourceTexts) {
    // En frances e italiano los sustantivos van en minuscula: se miran las palabras largas.
    const romance = (text.match(ROMANCE_FUNCTION_WORDS) ?? []).length >= 4;
    const candidates = romance
      ? (text.match(/\p{L}{8,}/gu) ?? [])
      : (text.match(/\p{Lu}\p{Ll}{5,}/gu) ?? []);
    for (const w of candidates) {
      const lower = w.toLowerCase();
      if (STOP_TERMS.has(lower) || MONTHS.has(lower) || PROCEDURE_STEMS.has(stem(w))) continue;
      if (romance && ROMANCE_STOP.has(lower)) continue;
      if (!normStems.has(stem(w))) missing.add(w);
    }
  }
  return [...missing].slice(0, 8);
}

export function registerDecisionReviewTools(tools: ToolRegistry): void {
  tools.register({
    name: "prepare_decision_review",
    description:
      "Prepara la REVISIÓN de una resolución de la autoridad (Verfügung, décision) para que usted, el modelo, haga la lectura jurídica con garantías. Devuelve: (1) la resolución segmentada en frases numeradas con su ubicación; (2) hechos clave extraídos (fechas, importes, plazos, normas citadas); (3) una lista de comprobación GENÉRICA (formal, base legal, material, probatorio, procesal, interno) con pistas de dónde mirar y las normas de apoyo, cuyo texto se leyó en Fedlex; (4) señales preliminares por patrones. NO concluye nada: lea cada frase, decida qué defectos hay y devuélvalos con una cita LITERAL a verify_review_findings. No afirme defectos sin citar la frase. Con `canton`, verifica además artículos cantonales citados con su sigla (p. ej. 'Art. 2 BauG') en los cantones con lectura de artículos; en los demás quedan sin verificar. Requiere revisión jurídica humana.",
    inputSchema: {
      text: z.string().min(40).max(200_000),
      maxStatements: z.number().int().min(20).max(600).default(MAX_STATEMENTS_DEFAULT),
      verifyCitedNorms: z.boolean().default(true),
      canton: z.string().length(2).optional(),
      asOfDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input, context: ToolContext & { signal?: AbortSignal }) => {
      const analysis = analyzeDecisionText(input.text);
      const all = segmentDocument(
        { id: "decision", label: "Resolución", author: "opposing_party", text: input.text },
        0,
      );
      const statements = all.slice(0, input.maxStatements);
      const warnings: string[] = [
        "Las pistas (`cueStatementIds`) solo señalan dónde mirar; que no haya pista no significa que no haya defecto.",
        "La lista de comprobación es genérica. Las normas son federales o constitucionales: para una resolución cantonal o comunal, el derecho cantonal solo se verifica si se indica `canton` y el cantón tiene lectura de artículos (19 cantones LexWork y Ginebra); en los demás (p. ej. Zúrich) queda sin verificar.",
      ];
      const cantonWarning = cantonConflictWarning(input.text, input.canton);
      if (cantonWarning) warnings.push(cantonWarning);
      if (all.length > statements.length) {
        warnings.push(
          `Se devuelven las primeras ${statements.length} de ${all.length} frases (aumente maxStatements).`,
        );
      }
      // Cada articulo federal que cita la resolucion se resuelve en Fedlex: si no existe, lo marca
      // la propia herramienta; si existe, entrega el texto oficial para comparar con lo que se afirma.
      const keyFacts = keyFactsOf(statements, input.text);
      const citedNormChecks: {
        citation: string;
        statements: string[];
        status: string;
        scope: string | null;
        officialExcerpt: string | null;
        versionAtDate: NormCheck["versionAtDate"] | null;
        note: string | null;
      }[] = [];
      const automaticFindings: {
        type: "cited_norm_not_found" | "cantonal_article_not_in_current_version";
        severity: "alta" | "media";
        citation: string;
        statements: string[];
        quote: string | null;
        why: string;
      }[] = [];
      if (input.verifyCitedNorms) {
        const normCache = new Map<string, NormCheck>();
        const byCitation = new Map<string, string[]>();
        for (const c of keyFacts.citedFederalNorms) {
          const list = byCitation.get(c.citation) ?? [];
          if (!list.includes(c.statement)) list.push(c.statement);
          byCitation.set(c.citation, list);
        }
        if (input.canton) {
          const federalAbbr = new RegExp(`^(?:${FEDERAL_ABBREVIATIONS})$`);
          const isCantonalAbbr = (a: string): boolean =>
            /^[A-ZÄÖÜ][A-Za-zÄÖÜäöü]{1,8}$/.test(a) && !NOT_A_LAW.has(a) && !federalAbbr.test(a);
          for (const c of keyFacts.citedCantonalNormsNotVerifiable) {
            const abbr = c.citation.split(/\s+/).pop() ?? "";
            if (!isCantonalAbbr(abbr) || !/^(?:Art\.|§)/.test(c.citation)) continue;
            const list = byCitation.get(c.citation) ?? [];
            if (!list.includes(c.statement)) list.push(c.statement);
            byCitation.set(c.citation, list);
          }
          for (const st of statements) {
            for (const m of st.text.matchAll(
              /(?:Art\.|§)\s*\d+[a-z]{0,2}(?:\s*Abs\.\s*\d+[a-z]?(?:\s*(?:und|bis|,|-|–)\s*\d+[a-z]?)*)?(?:\s*lit\.\s*[a-z])?\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöü]{1,8})\b/g,
            )) {
              if (!isCantonalAbbr(m[1]!)) continue;
              const list = byCitation.get(m[0]) ?? [];
              if (!list.includes(st.id)) list.push(st.id);
              byCitation.set(m[0], list);
            }
          }
        }
        for (const [citation, ids] of [...byCitation.entries()].slice(0, 15)) {
          const check = await checkNorm(citation, normCache, context, {
            canton: input.canton,
            asOfDate: input.asOfDate,
          });
          citedNormChecks.push({
            citation,
            statements: ids,
            status: check.status,
            scope: check.scope,
            officialExcerpt: check.officialExcerpt,
            versionAtDate: check.versionAtDate ?? null,
            note: check.note,
          });
          if (check.status === "not_found" && check.scope === "cantonal") {
            automaticFindings.push({
              type: "cantonal_article_not_in_current_version",
              severity: "media",
              citation,
              statements: ids,
              quote: statements.find((x) => x.id === ids[0])?.text ?? null,
              why: `La resolución cita '${citation}', pero ese artículo no figura en la versión vigente de la ley cantonal. Puede estar derogado o renumerado desde la fecha de los hechos: compruebe la versión aplicable antes de afirmar que no existe.`,
            });
          } else if (check.status === "not_found") {
            automaticFindings.push({
              type: "cited_norm_not_found",
              severity: "alta",
              citation,
              statements: ids,
              quote: statements.find((x) => x.id === ids[0])?.text ?? null,
              why: `La resolución cita '${citation}', pero ese artículo no existe en la fuente oficial: la norma citada es inexistente o está mal atribuida.`,
            });
          }
        }
      }
      const knownIssues = activatedGrounds(input.text).map((g) => ({
        id: g.id,
        topic: g.topic,
        jurisdiction: g.jurisdiction,
        summary: g.summary,
        triggeredByStatements: statements
          .filter((x) => g.cue.test(x.text))
          .slice(0, 6)
          .map((x) => x.id),
        triggeredByHeader:
          g.cueScope === "header"
            ? (input.text
                .slice(0, 900)
                .split("\n")
                .find((line) => g.cue.test(line))
                ?.trim() ?? null)
            : null,
        verifiedSources: g.sources,
        whatToCheck: g.whatToCheck,
        caveats: g.caveats,
      }));
      const byId = new Map(NORMS.map((n) => [n.id, n]));
      return {
        status: "prepared" as const,
        language: analysis.language,
        kind: analysis.kind,
        statementCount: all.length,
        statements: statements.map((s) => ({
          id: s.id,
          location: s.location,
          offset: s.offset,
          text: s.text,
        })),
        keyFacts,
        knownIssues,
        citedNormChecks,
        automaticFindings,
        consistencyFindings: {
          note: "Candidatos deterministas (números y plazos de la propia resolución, plazos del ATSG). Léalos y, si los confirma, envíelos a verify_review_findings con la cita literal.",
          limitViolations: findLimitViolations(statements),
          dateTensions: findDateTensions(statements),
          sameReferenceConflicts: findSameReferenceConflicts(statements),
          arithmeticMismatches: findArithmeticMismatches(statements),
          appealIssues: findAppealIssues(statements, input.text),
        },
        checklist: CHECKLIST.map((item) => {
          const cueStatementIds = statementCues(statements, item.cue);
          return {
            id: item.id,
            category: item.category,
            topic: item.topic,
            question: item.question,
            cueStatementIds,
            noCueFound: item.cue !== null && cueStatementIds.length === 0,
            norms: item.normIds.map((id) => byId.get(id)?.citation).filter((x): x is string => !!x),
          };
        }),
        verifiedNorms: NORMS.map((n) => ({
          citation: n.citation,
          literalExcerpt: n.excerpt,
          appliesTo: n.appliesTo,
          source: "Fedlex, leído el 2026-11-13",
        })),
        preliminarySignals: analysis.reviewFlags.map((f) => ({
          type: f.type,
          strength: f.strength,
          statements: f.passages.map((p) => p.text),
        })),
        howToAnswer: {
          steps: [
            "Lea todas las frases de `statements`.",
            "Revise `automaticFindings` (artículos citados que no existen o, en derecho cantonal, que no figuran en la versión vigente) y `citedNormChecks` (texto oficial de cada artículo citado: compare con lo que la resolución afirma que dice). Si la resolución parafrasea correctamente una norma real, NO es un defecto.",
            "Revise `consistencyFindings`: candidatos calculados sobre el propio texto (valores por encima de un máximo o por debajo de un mínimo que la resolución enuncia, fechas contradictorias, dos valores para lo mismo, plazo o vía de recurso distintos del ATSG). Confírmelos o descártelos leyendo la frase.",
            "Revise `knownIssues`: cada una trae lo que dicen la ley o la jurisprudencia, con texto literal y fuente. Compárelo con lo que la resolución afirma.",
            "Recorra `checklist` punto por punto y decida si hay un defecto; use `cueStatementIds` como punto de partida.",
            "Para cada defecto, redacte un hallazgo con una cita LITERAL de `statements[].text` y cite la norma MÁS ESPECÍFICA que lo sustenta: primero la de la propia ley aplicable (federal o cantonal, con su sigla y, si es cantonal, pase `canton`), y las garantías generales de la BV (Art. 5, 9) solo como complemento; para defectos de prueba o de motivación considere también el Art. 29 Abs. 2 BV.",
            "Llame a verify_review_findings con el texto original de la resolución y su lista de hallazgos.",
            "Presente al usuario solo lo que la verificación marque como 'supported' o 'quote_only', indicando lo no verificado. 'supported' solo prueba que la cita es literal y que el artículo existe: revise `normFit` (si es `general_clause_only` o `specific_weak`, busque la norma que corresponde).",
          ],
          findingSchema: FINDING_SCHEMA,
        },
        warnings,
        requiresHumanReview: true as const,
      };
    },
  });

  tools.register({
    name: "verify_review_findings",
    description:
      "Verifica los hallazgos que usted ha formulado sobre una resolución: comprueba que la cita de cada uno es LITERAL en el texto de la resolución (y en qué frase está) y que cada artículo citado EXISTE en Fedlex, devolviendo un extracto oficial. Estado por hallazgo: 'supported' (cita literal y normas existentes), 'quote_only' (cita literal, alguna norma sin verificar) o 'rejected' (cita no literal o norma federal inexistente: no lo presente como hecho; un artículo cantonal que no figura en la versión vigente queda como quote_only). Verifica forma y existencia, no el acierto jurídico: lo decide un profesional. Derecho cantonal: se verifica con `canton` en los cantones con lectura de artículos (versión vigente); el resto queda sin verificar.",
    inputSchema: {
      text: z.string().min(40).max(200_000),
      findings: z.array(findingInput).min(1).max(40),
      verifyNorms: z.boolean().default(true),
      canton: z.string().length(2).optional(),
      asOfDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input, context: ToolContext & { signal?: AbortSignal }) => {
      const statements = segmentDocument(
        { id: "decision", label: "Resolución", author: "opposing_party", text: input.text },
        0,
      );
      const collapsedStatements = statements.map((s) => ({ s, c: collapseWhitespace(s.text) }));
      const cache = new Map<string, NormCheck>();
      const results: {
        index: number;
        checklistId: string | null;
        severity: string | null;
        claim: string;
        status: "supported" | "quote_only" | "rejected";
        quote: {
          status: string;
          statementId: string | null;
          location: string | null;
          closestPassage: string | null;
          similarity: number | null;
        };
        normFit: NormFit;
        norms: (Omit<NormCheck, "fullText"> & { termsNotInNorm: string[] })[];
        reasons: string[];
      }[] = [];
      for (const [index, f] of input.findings.entries()) {
        const verification = verifyQuoteAgainstText(f.quote, input.text);
        const quoteOk =
          verification.status === "verified_exact" || verification.status === "verified_normalized";
        const probe = collapseWhitespace(f.quote).slice(0, 50);
        const located = quoteOk ? collapsedStatements.find((x) => x.c.includes(probe)) : undefined;
        const norms: NormCheck[] = [];
        for (const citation of f.norms ?? []) {
          norms.push(
            input.verifyNorms
              ? await checkNorm(citation, cache, context, {
                  canton: input.canton,
                  asOfDate: input.asOfDate,
                })
              : {
                  citation,
                  status: "source_unavailable",
                  scope: null,
                  officialExcerpt: null,
                  fullText: null,
                  note: "verifyNorms=false",
                },
          );
        }
        const reasons: string[] = [];
        if (!quoteOk) {
          reasons.push(
            verification.status === "near_match_altered"
              ? "La cita no es literal (se parece a un pasaje pero con palabras distintas)."
              : "La cita no aparece en la resolución.",
          );
        }
        for (const n of norms) {
          if (n.status === "not_found" && n.scope !== "cantonal") {
            reasons.push(
              `El artículo '${n.citation}' no existe o no se encontró en la fuente oficial (Fedlex o fuente cantonal).`,
            );
          }
        }
        const status: "supported" | "quote_only" | "rejected" =
          reasons.length > 0
            ? "rejected"
            : norms.every((n) => n.status === "verified_exists")
              ? "supported"
              : "quote_only";
        const normTerms = norms.map((n) => ({
          n,
          terms:
            n.fullText && !NO_LEXICAL_RE.test(n.citation)
              ? termsNotInNorm([f.quote], n.fullText)
              : [],
        }));
        const verifiedNorms = norms.filter((n) => n.status === "verified_exists");
        const normFit: NormFit =
          /^I\d/.test(f.checklistId ?? "")
            ? "not_applicable"
            : norms.length === 0
            ? "no_norm"
            : verifiedNorms.length === 0
              ? "unverified"
              : verifiedNorms.every((n) => GENERAL_CLAUSE_RE.test(n.citation))
                ? "general_clause_only"
                : normTerms.some((x) => x.n.status === "verified_exists" && x.terms.length >= 4) &&
                    !normTerms.some(
                      (x) =>
                        x.n.status === "verified_exists" &&
                        !GENERAL_CLAUSE_RE.test(x.n.citation) &&
                        x.terms.length < 4,
                    )
                  ? "specific_weak"
                  : "specific";
        if (status === "supported" && (normFit === "general_clause_only" || normFit === "specific_weak")) {
          reasons.push(NORM_FIT_NOTE[normFit]);
        }
        results.push({
          index,
          checklistId: f.checklistId ?? null,
          severity: f.severity ?? null,
          claim: f.claim,
          status,
          normFit,
          quote: {
            status: verification.status,
            statementId: located?.s.id ?? null,
            location: located?.s.location ?? null,
            closestPassage: quoteOk ? null : verification.closestPassage,
            similarity: verification.similarity,
          },
          norms: norms.map(({ fullText, ...rest }) => ({
            ...rest,
            termsNotInNorm:
              fullText && !NO_LEXICAL_RE.test(rest.citation)
                ? termsNotInNorm([f.quote], fullText)
                : [],
          })),
          reasons,
        });
      }
      const count = (s: string): number => results.filter((r) => r.status === s).length;
      return {
        status: "verified" as const,
        summary: {
          total: results.length,
          supported: count("supported"),
          quoteOnly: count("quote_only"),
          rejected: count("rejected"),
          supportedOnlyByGeneralClauses: results.filter(
            (r) => r.status === "supported" && r.normFit === "general_clause_only",
          ).length,
        },
        results,
        warnings: [
          ...(cantonConflictWarning(input.text, input.canton) ? [cantonConflictWarning(input.text, input.canton)!] : []),
          "Verificado: que la cita es literal y que el artículo existe. NO verificado: que el artículo diga lo que se le atribuye ni que el razonamiento sea correcto. `termsNotInNorm` es una señal léxica: términos de la cita o de la afirmación que no aparecen en el artículo invocado.",
          "Si indicó `asOfDate`, `versionAtDate` compara el artículo a esa fecha con el vigente (solo derecho federal). El derecho cantonal solo se verifica en versión vigente.",
          "No presente como hecho ningún hallazgo 'rejected'. Los 'quote_only' llevan normas sin verificar (derecho cantonal o fuente no disponible).",
        ],
        requiresHumanReview: true as const,
      };
    },
  });
}
