/**
 * Analisis de estilo sobre un corpus de sentencias: que frases se repiten y en cuantas
 * sentencias, de forma determinista y verificable.
 *
 * Un modelo no puede contar con fiabilidad frases repetidas leyendo decenas de sentencias de
 * 20 000 caracteres (en la prueba real solo cuantifico 3 formulas de 47 sentencias y agoto su
 * limite de llamadas). Aqui el recuento se hace en el servidor sobre el texto oficial:
 * frecuencia POR DOCUMENTO (en cuantas sentencias aparece la frase, no cuantas veces), con
 * ejemplos literales y numeros de expediente comprobables.
 */

export interface CorpusDocument {
  readonly caseNumber: string;
  readonly text: string;
}

export interface RecurringFormula {
  readonly phrase: string;
  readonly documents: number;
  readonly share: number;
  readonly exampleCases: readonly string[];
}

export interface StructureMarker {
  readonly marker: string;
  readonly documents: number;
  readonly share: number;
}

export interface CorpusStyleReport {
  readonly documentsAnalyzed: number;
  readonly structure: readonly StructureMarker[];
  readonly dispositiveFormulas: readonly StructureMarker[];
  readonly outcomeFormulas: readonly StructureMarker[];
  readonly recurringFormulas: readonly RecurringFormula[];
  readonly sentenceOpenings: readonly StructureMarker[];
  readonly limitations: readonly string[];
}

const NGRAM = 5;

function normalizeBody(text: string): string {
  // Se descarta el encabezado (composicion, partes) y el pie de navegacion del portal.
  const start = text.search(
    /Sachverhalt\s*:|Erwägung|in\s+Erwägung|Faits\s*:|Considérant|Fatti\s*:/i,
  );
  const end = text.search(/Im Namen der|Au nom de la|In nome della/);
  const body = text.slice(start >= 0 ? start : 0, end > 0 ? end : undefined);
  return body
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(body: string): string[] {
  return body
    .split(" ")
    .map((token) => token.replace(/\d+/g, "#"))
    .filter((token) => token.length > 0 && !/_{3,}/.test(token));
}

function share(count: number, total: number): number {
  return total === 0 ? 0 : Number((count / total).toFixed(3));
}

function countMarkers(
  documents: readonly CorpusDocument[],
  markers: readonly (readonly [string, RegExp])[],
): StructureMarker[] {
  return markers
    .map(([marker, pattern]) => {
      const count = documents.filter((doc) => pattern.test(doc.text)).length;
      return { marker, documents: count, share: share(count, documents.length) };
    })
    .filter((entry) => entry.documents > 0)
    .sort((a, b) => b.documents - a.documents);
}

const STRUCTURE: readonly (readonly [string, RegExp])[] = [
  ["Sachverhalt:", /Sachverhalt\s*:/],
  ["Erwägungen:", /Erwägungen\s*:/],
  ["Besetzung", /Besetzung/],
  ["Verfahrensbeteiligte", /Verfahrensbeteiligte/],
  ["Gegenstand", /Gegenstand/],
];

const DISPOSITIVE: readonly (readonly [string, RegExp])[] = [
  ["Demnach erkennt das Bundesgericht:", /Demnach\s+erkennt\s+das\s+Bundesgericht\s*:/],
  [
    "Demnach verfügt der Präsident / die Präsidentin",
    /Demnach\s+verfügt\s+(?:der\s+Präsident|die\s+Präsidentin)/,
  ],
  ["erkennt das präsidierende Mitglied", /erkennt\s+das\s+präsidierende\s+Mitglied/],
  ["erkannt:", /(?:^|[\r\n])\s*erkannt\s*:/],
  [
    "Demnach erkennt der Einzelrichter / die Einzelrichterin",
    /Demnach\s+erkennt\s+(?:der\s+Einzelrichter|die\s+Einzelrichterin)/,
  ],
  [
    "im Verfahren nach Art. 32 Abs. 2 BGG verfügt:",
    /im\s+Verfahren\s+nach\s+Art\.\s*32\s+Abs\.\s*2\s+BGG\s+verfügt/,
  ],
];

const OUTCOMES: readonly (readonly [string, RegExp])[] = [
  [
    "Die Beschwerde wird abgewiesen",
    /Die\s+Beschwerde\s+(?:in\s+Zivilsachen\s+)?wird\s+abgewiesen/,
  ],
  [
    "…abgewiesen, soweit darauf einzutreten ist",
    /abgewiesen,\s+soweit\s+darauf\s+einzutreten\s+ist/,
  ],
  [
    "Auf die Beschwerde wird nicht eingetreten",
    /Auf\s+die\s+(?:Beschwerde|subsidiäre\s+Verfassungsbeschwerde)[^.]{0,60}wird\s+nicht\s+eingetreten/,
  ],
  [
    "Die Beschwerde wird gutgeheissen",
    /Die\s+Beschwerde\s+(?:in\s+Zivilsachen\s+)?wird\s+gutgeheissen/,
  ],
  ["Die Beschwerde wird teilweise gutgeheissen", /wird\s+teilweise\s+gutgeheissen/],
  ["Das Verfahren wird als gegenstandslos abgeschrieben", /als\s+gegenstandslos\s+abgeschrieben/],
  [
    "Das Verfahren wird abgeschrieben (Rückzug)",
    /Rückzug[^.]{0,80}abgeschrieben|abgeschrieben[^.]{0,80}Rückzug/,
  ],
];

/** Frases de `NGRAM` palabras presentes en al menos `minDocs` documentos. */
function frequentNgrams(tokenized: readonly string[][], minDocs: number): Map<string, Set<number>> {
  const all = new Map<string, Set<number>>();
  tokenized.forEach((tokens, index) => {
    for (let i = 0; i + NGRAM <= tokens.length; i += 1) {
      const gram = tokens.slice(i, i + NGRAM).join(" ");
      let set = all.get(gram);
      if (!set) {
        set = new Set();
        all.set(gram, set);
      }
      set.add(index);
    }
  });
  for (const [gram, set] of all) if (set.size < minDocs) all.delete(gram);
  return all;
}

/** Extiende una frase hacia la derecha mientras la palabra siguiente conserve >= 80 % de los documentos. */
function extendPhrase(
  start: readonly string[],
  startDocs: ReadonlySet<number>,
  tokenized: readonly string[][],
): { phrase: string[]; docs: Set<number> } {
  let phrase = [...start];
  let docs = new Set(startDocs);
  for (let step = 0; step < 40; step += 1) {
    const nextCount = new Map<string, Set<number>>();
    for (const index of docs) {
      const tokens = tokenized[index]!;
      for (let i = 0; i + phrase.length < tokens.length; i += 1) {
        let matches = true;
        for (let k = 0; k < phrase.length; k += 1) {
          if (tokens[i + k] !== phrase[k]) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
        const next = tokens[i + phrase.length]!;
        let set = nextCount.get(next);
        if (!set) {
          set = new Set();
          nextCount.set(next, set);
        }
        set.add(index);
      }
    }
    let best: [string, Set<number>] | null = null;
    for (const entry of nextCount) if (!best || entry[1].size > best[1].size) best = entry;
    if (!best || best[1].size < Math.ceil(docs.size * 0.8)) break;
    phrase = [...phrase, best[0]];
    docs = best[1];
  }
  return { phrase, docs };
}

export interface CorpusStyleOptions {
  /** Proporcion minima de sentencias para considerar recurrente una frase (por defecto 0,25). */
  readonly minShare?: number;
  readonly topN?: number;
}

export function analyzeCorpusStyle(
  documents: readonly CorpusDocument[],
  options: CorpusStyleOptions = {},
): CorpusStyleReport {
  const total = documents.length;
  const minShare = options.minShare ?? 0.25;
  const topN = options.topN ?? 30;
  const minDocs = Math.max(2, Math.ceil(total * minShare));
  const limitations = [
    `Muestra de ${total} sentencia(s): las frecuencias son por sentencia (en cuantas aparece la frase), no por aparicion, y describen SOLO esta muestra.`,
    "Los numeros dentro de las frases se sustituyen por '#'; los nombres anonimizados se excluyen.",
    "Las sentencias del Tribunal Federal no indican quien redacta: el estilo es de la sala y la materia, no de un juez.",
  ];
  if (total < 10) limitations.push("Menos de 10 sentencias: los patrones son orientativos.");

  const bodies = documents.map((doc) => normalizeBody(doc.text));
  const tokenized = bodies.map(tokenize);

  const grams = total >= 2 ? frequentNgrams(tokenized, minDocs) : new Map<string, Set<number>>();
  const used = new Set<string>();
  const formulas: RecurringFormula[] = [];
  const ordered = [...grams.entries()].sort((a, b) => b[1].size - a[1].size);
  for (const [gram, docs] of ordered) {
    if (used.has(gram)) continue;
    const { phrase, docs: finalDocs } = extendPhrase(gram.split(" "), docs, tokenized);
    // marca como usadas todas las 5-gramas de la frase extendida para no repetirla desplazada
    for (let i = 0; i + NGRAM <= phrase.length; i += 1) {
      used.add(phrase.slice(i, i + NGRAM).join(" "));
    }
    if (phrase.length < 6) continue;
    // Una frase que es casi todo numeros y signos ("( Art. # Abs. # BGG") no es una formula de estilo.
    const wordCount = phrase.filter((token) => /^[A-Za-zÄÖÜäöüß]{3,}$/.test(token)).length;
    if (wordCount < 4) continue;
    formulas.push({
      phrase: phrase.join(" "),
      documents: finalDocs.size,
      share: share(finalDocs.size, total),
      exampleCases: [...finalDocs].slice(0, 3).map((index) => documents[index]!.caseNumber),
    });
  }
  formulas.sort((a, b) => b.documents - a.documents || b.phrase.length - a.phrase.length);
  // Se descartan las variantes contenidas en otra frase mas larga que aparece casi en las mismas
  // sentencias (la misma formula empezando una palabra antes o despues).
  const distinct = formulas.filter(
    (candidate) =>
      !formulas.some(
        (other) =>
          other !== candidate &&
          other.phrase.length > candidate.phrase.length &&
          other.phrase.includes(candidate.phrase) &&
          other.documents >= Math.ceil(candidate.documents * 0.9),
      ),
  );

  const openings = new Map<string, Set<number>>();
  bodies.forEach((body, index) => {
    const sentences = body.split(/(?<=[.:;])\s+(?=[A-ZÄÖÜ])/);
    for (const sentence of sentences) {
      const words = sentence.split(" ");
      if (words.length < 6) continue;
      const key = words.slice(0, 3).join(" ");
      if (/\d|_{3}/.test(key)) continue;
      let set = openings.get(key);
      if (!set) {
        set = new Set();
        openings.set(key, set);
      }
      set.add(index);
    }
  });
  const sentenceOpenings = [...openings.entries()]
    .filter(([, set]) => set.size >= minDocs)
    .map(([marker, set]) => ({ marker, documents: set.size, share: share(set.size, total) }))
    .sort((a, b) => b.documents - a.documents)
    .slice(0, 15);

  return {
    documentsAnalyzed: total,
    structure: countMarkers(documents, STRUCTURE),
    dispositiveFormulas: countMarkers(documents, DISPOSITIVE),
    outcomeFormulas: countMarkers(documents, OUTCOMES),
    recurringFormulas: distinct.slice(0, topN),
    sentenceOpenings,
    limitations,
  };
}
