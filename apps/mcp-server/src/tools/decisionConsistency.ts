/**
 * Comprobaciones deterministas de coherencia interna de una resolucion. No interpretan derecho:
 * comparan numeros y citas del propio texto, o con el texto literal de una norma federal leida.
 * Todo lo que devuelven son CANDIDATOS que el modelo debe leer y confirmar con una cita literal.
 */
import { ARTICLE_RE } from "./quoteVerifier.js";
import { extractNumbers } from "./opposingSubmissionAnalyzer.js";

export interface PlainStatement {
  readonly id: string;
  readonly text: string;
}

const LAWS = /\((OR\|[^)]+)\)/.exec(ARTICLE_RE.source)?.[1] ?? "BV";

/** "Art. 43, 49 und 52 ATSG" -> ["Art. 43 ATSG", "Art. 49 ATSG", "Art. 52 ATSG"]. */
export function expandListedCitations(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(
    `\\b(?:Art\\.|art\\.|arts?\\.|articles?|articoli)\\s*(\\d+[a-z]{0,2}(?:\\s*(?:,|und|et|e|bis|-|–)\\s*(?:Art\\.\\s*|art\\.\\s*)?\\d+[a-z]{0,2})+)\\s+(${LAWS})\\b`,
    "g",
  );
  for (const m of text.matchAll(re)) {
    for (const n of m[1]!.match(/\d+[a-z]{0,2}/g) ?? []) out.push(`Art. ${n} ${m[2]}`);
  }
  return out;
}

const WORD_NUMBERS: Record<string, number> = {
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  zwanzig: 20,
  dreissig: 30,
  elf: 11,
  zwölf: 12,
  sechzig: 60,
  neunzig: 90,
  trois: 3,
  quatre: 4,
  cinq: 5,
  dix: 10,
  vingt: 20,
  trente: 30,
  soixante: 60,
  onze: 11,
  douze: 12,
  undici: 11,
  dodici: 12,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
};

function toInt(raw: string): number | null {
  const w = WORD_NUMBERS[raw.toLowerCase()];
  if (w !== undefined) return w;
  const n = Number(raw.replace(/['’\s\u00a0.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// --- Limites numericos -------------------------------------------------------------------------

type Unit = "days" | "money" | "months";
const NUM = String.raw`(\d{1,3}(?:[' ’\u00a0]\d{3})+|\d+)`;
const MONEY_AFTER = String.raw`\s*(?:CHF|Fr\.)\s*${NUM}`;
const DAYS = String.raw`(?:Tag(?:e|en)?|jours?|giorni|\w*tage|\w*tagen)`;
const MONTH_UNIT = String.raw`(?:Monat(?:e|en)?|mois|mesi|mese)`;
const MONEY_UNIT = String.raw`(?:francs?|franchi|Franken|CHF|Fr\.)`;
const CAP = String.raw`(?:höchstens|maximal|maximum\s+de|au\s+plus|au\s+maximum|bis\s+zu|al\s+massimo|massimo\s+di|al\s+più|fino\s+a)`;
const FLOOR = String.raw`(?:mindestens|au\s+moins|au\s+minimum|almeno|minimo\s+di|come\s+minimo)`;

interface Bound {
  readonly statementId: string;
  readonly unit: Unit;
  readonly min: number | null;
  readonly max: number | null;
  readonly text: string;
}

function numWords(): string {
  return Object.keys(WORD_NUMBERS).join("|");
}

function unitValues(text: string, unit: Unit): number[] {
  const values: number[] = [];
  if (unit === "money") {
    const re = new RegExp(`(?:CHF|Fr\\.)\\s*${NUM}|${NUM}\\s*${MONEY_UNIT}`, "gi");
    for (const m of text.matchAll(re)) {
      const v = toInt(m[1] ?? m[2] ?? "");
      if (v !== null) values.push(v);
    }
    return values;
  }
  const u = unit === "days" ? DAYS : MONTH_UNIT;
  const re = new RegExp(`\\b(${NUM}|${numWords()})\\s+(?:\\w+\\s+)?${u}\\b`, "gi");
  for (const m of text.matchAll(re)) {
    const v = toInt(m[1]!);
    if (v !== null) values.push(v);
  }
  return values;
}

function boundsIn(s: PlainStatement): Bound[] {
  const out: Bound[] = [];
  const push = (unit: Unit, min: number | null, max: number | null): void => {
    out.push({ statementId: s.id, unit, min, max, text: s.text });
  };
  const range = new RegExp(
    `(?:fourchette\\s+de|entre|zwischen|von|tra|da)\\s+(?:CHF\\s*|Fr\\.\\s*)?${NUM}\\s*(?:à|et|und|bis|e|a)\\s*(?:CHF\\s*|Fr\\.\\s*)?${NUM}\\s*${MONEY_UNIT}`,
    "i",
  ).exec(s.text);
  if (range) push("money", toInt(range[1]!), toInt(range[2]!));
  const rangeDays = new RegExp(
    `(?:fourchette\\s+de|entre|zwischen|von|tra|da)\\s+${NUM}\\s*(?:à|et|und|bis|e|a)\\s*${NUM}\\s+${DAYS}`,
    "i",
  ).exec(s.text);
  if (rangeDays) push("days", toInt(rangeDays[1]!), toInt(rangeDays[2]!));
  for (const [unit, u] of [
    ["days", DAYS],
    ["months", MONTH_UNIT],
  ] as const) {
    for (const m of s.text.matchAll(
      new RegExp(`${CAP}\\s+(${NUM}|${numWords()})\\s+${u}\\b`, "gi"),
    )) {
      push(unit, null, toInt(m[1]!));
    }
  }
  for (const m of s.text.matchAll(
    new RegExp(`${CAP}(?:${MONEY_AFTER}|\\s+${NUM}\\s*${MONEY_UNIT})`, "gi"),
  )) {
    push("money", null, toInt(m[1] ?? m[2] ?? ""));
  }
  for (const m of s.text.matchAll(
    new RegExp(`${FLOOR}(?:${MONEY_AFTER}|\\s+${NUM}\\s*${MONEY_UNIT})`, "gi"),
  )) {
    push("money", toInt(m[1] ?? m[2] ?? ""), null);
  }
  return out;
}

function stems(text: string): Set<string> {
  const s = new Set<string>();
  for (const w of text.toLowerCase().match(/\p{L}{6,}/gu) ?? []) s.add(w.slice(0, 6));
  return s;
}

export interface LimitCandidate {
  readonly type: "limit_exceeded";
  readonly boundStatement: string;
  readonly valueStatement: string;
  readonly unit: Unit;
  readonly limit: { readonly min: number | null; readonly max: number | null };
  readonly value: number;
  readonly boundText: string;
  readonly valueText: string;
  readonly why: string;
}

/** Valores del mismo tipo que superan el tope o no alcanzan el suelo que la propia resolucion cita. */
const LIMIT_CONTRAST =
  /\b(?:mentre|während|obwohl|hingegen|aber|mais|alors\s+que|tandis\s+que|jedoch|toutefois|dagegen|pourtant|tuttavia|bien\s+que|benché|dennoch|ma)\b/i;

const LIMIT_VERB =
  /\b(?:darf|dürfen|kann|können|beträgt|dauert|peut|doit|dure|durer|può|deve|dura|durare)\b/i;

export function findLimitViolations(
  statements: readonly PlainStatement[],
  window = 80,
): LimitCandidate[] {
  const out: LimitCandidate[] = [];
  const seen = new Set<string>();
  statements.forEach((s, i) => {
    for (const b of boundsIn(s)) {
      const boundStems = stems(`${i > 0 ? statements[i - 1]!.text : ""} ${b.text}`);
      for (let j = 0; j < statements.length; j++) {
        if (j === i && !LIMIT_CONTRAST.test(s.text) && !LIMIT_VERB.test(s.text)) continue;
        const t = statements[j]!;
        const near = Math.abs(j - i) <= window;
        const shared = [...stems(t.text)].some((x) => boundStems.has(x));
        if (!(near && shared) && Math.abs(j - i) > 1) continue;
        for (const v of unitValues(t.text, b.unit)) {
          const over = b.max !== null && v > b.max;
          const under = b.min !== null && v < b.min;
          if (!over && !under) continue;
          if (boundsIn(t).some((x) => x.max === v || x.min === v)) continue;
          const key = `${b.statementId}|${t.id}|${v}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            type: "limit_exceeded",
            boundStatement: b.statementId,
            valueStatement: t.id,
            unit: b.unit,
            limit: { min: b.min, max: b.max },
            value: v,
            boundText: b.text,
            valueText: t.text,
            why: `${over ? "Supera el máximo" : "No alcanza el mínimo"} (${over ? b.max : b.min}) que la propia resolución enuncia en ${b.statementId}. Compruebe si es el mismo concepto y si la resolución justifica la excepción.`,
          });
        }
      }
    }
  });
  return out;
}

// --- Plazo y via de recurso frente al ATSG ----------------------------------------------------

export interface AppealIssue {
  readonly type: "appeal_period_mismatch" | "appeal_authority_mismatch";
  readonly statementId: string;
  readonly text: string;
  readonly found: string;
  readonly norm: string;
  readonly normExcerpt: string;
  readonly normVerifiedOn: string;
  readonly why: string;
}

const ATSG_52 =
  "Art. 52 Abs. 1 ATSG: Gegen Verfügungen kann innerhalb von 30 Tagen bei der verfügenden Stelle Einsprache erhoben werden; davon ausgenommen sind prozess- und verfahrensleitende Verfügungen.";
const ATSG_60 =
  "Art. 60 Abs. 1 ATSG: Die Beschwerde ist innerhalb von 30 Tagen nach der Eröffnung des Einspracheentscheides oder der Verfügung, gegen welche eine Einsprache ausgeschlossen ist, einzureichen.";

/**
 * Solo cuando la resolucion cita el ATSG o el AVIG (el ATSG rige alli): la Einsprache va a la
 * autoridad que dicto la resolucion, en 30 dias; la Beschwerde, en 30 dias. Texto leido en Fedlex
 * el 2026-11-14. No se aplica a otras leyes.
 */
export function findAppealIssues(
  statements: readonly PlainStatement[],
  fullText: string,
): AppealIssue[] {
  if (!/\b(?:ATSG|LPGA|AVIG|LACI)\b/.test(fullText)) return [];
  const out: AppealIssue[] = [];
  const periodRe = new RegExp(
    `(?:binnen|innert|innerhalb\\s+von|dans\\s+un\\s+délai\\s+de|entro|nel\\s+termine\\s+di)\\s+(\\d+|${Object.keys(WORD_NUMBERS).join("|")})\\s+(?:Tagen|Tage|jours|giorni)`,
    "i",
  );
  for (const s of statements) {
    const kind = /\bEinsprache\w*|\bopposition\b|\bopposizione\b|\breclamo\b/i.test(s.text)
      ? "opposition"
      : /\bBeschwerde\w*|\brecours\b|\bricorso\b/i.test(s.text)
        ? "beschwerde"
        : null;
    if (!kind) continue;
    const p = periodRe.exec(s.text);
    if (!p) continue;
    const days = toInt(p[1]!);
    if (days !== null && days !== 30) {
      out.push({
        type: "appeal_period_mismatch",
        statementId: s.id,
        text: s.text,
        found: `${days} días`,
        norm: kind === "opposition" ? "Art. 52 Abs. 1 ATSG" : "Art. 60 Abs. 1 ATSG",
        normExcerpt: kind === "opposition" ? ATSG_52 : ATSG_60,
        normVerifiedOn: "2026-11-14",
        why: `La instrucción fija ${days} días; el ATSG prevé 30 días. Confirme que el ATSG rige en este procedimiento y si hay una norma especial.`,
      });
    }
    if (
      kind === "opposition" &&
      /direkt\s+(?:beim|bei\s+dem)\s+\w*gericht|(?:Einsprache|Einsprachen)[^.]{0,60}(?:RAV|verfügenden)[^.]{0,40}ausgeschlossen/i.test(
        s.text,
      )
    ) {
      out.push({
        type: "appeal_authority_mismatch",
        statementId: s.id,
        text: s.text,
        found: "Einsprache dirigida a un tribunal o excluida ante la autoridad que resolvió",
        norm: "Art. 52 Abs. 1 ATSG",
        normExcerpt: ATSG_52,
        normVerifiedOn: "2026-11-14",
        why: "El ATSG prevé la Einsprache ante la autoridad que dictó la resolución ('verfügende Stelle'), no directamente ante un tribunal.",
      });
    }
  }
  return out;
}

// --- Fechas en tension --------------------------------------------------------------------------

export interface DateCandidate {
  readonly type: "dates_in_tension" | "effect_before_cause" | "same_event_two_dates";
  readonly statementIds: readonly string[];
  readonly dates: readonly string[];
  readonly text: string;
  readonly why: string;
}

const datesOf = (text: string): string[] => [...(extractNumbers(text).get("date") ?? [])].sort();

const LOOSE_MONTHS =
  "januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre";

/** Fechas sin año ("7 juillet"): clave "mes-dia" para comparar dentro de una frase. */
function looseDates(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(
    new RegExp(`\\b(\\d{1,2})(?:\\.|er|º)?\\s+(${LOOSE_MONTHS})\\b`, "gi"),
  )) {
    out.add(`${m[2]!.toLowerCase()}-${m[1]!.padStart(2, "0")}`);
  }
  return [...out];
}

/** Fechas con su posicion en el texto (orden de aparicion). */
function positionedDates(text: string): { iso: string; at: number }[] {
  const out: { iso: string; at: number }[] = [];
  const re = /\b\d{1,2}(?:\.|er)?\s+(?:[A-Za-zÀ-ÿ]{3,9})\s+\d{4}\b|\b\d{1,2}\.\d{1,2}\.\d{4}\b/g;
  for (const m of text.matchAll(re)) {
    const d = datesOf(m[0])[0];
    if (d) out.push({ iso: d, at: m.index });
  }
  return out;
}

const CONTRAST =
  /einerseits|andererseits|während|obwohl|jedoch|hingegen|dagegen|ohne\s+dass|alors\s+que|tandis\s+que|bien\s+que|sans\s+qu|d['’]une\s+part|d['’]autre\s+part|mentre|invece|senza\s+che/i;
const CAUSE_MARKER =
  /(?:faisait\s+suite\s+(?:à|au|aux)|fait\s+suite\s+(?:à|au|aux)|suite\s+(?:à|au|aux)|im\s+Anschluss\s+an|in\s+Folge|infolge|aufgrund|gestützt\s+auf|en\s+réponse\s+à|consécutif\s+à|als\s+Folge\s+(?:von|der|des))/i;
const EMPLOYMENT_END =
  /(?:Ende\s+des\s+Arbeitsverhältnisses|Arbeitsverhältnis\w*\s+(?:endete|endet|ende)|Beendigung\s+des\s+Arbeitsverhältnisses|Kündigungstermin|fin\s+(?:des\s+rapports\s+de\s+travail|du\s+contrat))/gi;

/** Fechas que se contradicen o se invierten dentro de la propia resolucion (candidatos). */
export function findDateTensions(statements: readonly PlainStatement[]): DateCandidate[] {
  const out: DateCandidate[] = [];
  for (const s of statements) {
    const ds = datesOf(s.text);
    const loose = looseDates(s.text);
    if (ds.length < 2 && loose.length >= 2 && CONTRAST.test(s.text)) {
      out.push({
        type: "dates_in_tension",
        statementIds: [s.id],
        dates: loose,
        text: s.text,
        why: "La misma frase contrapone dos fechas distintas (sin año). Compruebe si designan el mismo hecho y cuál es la correcta.",
      });
    }
    if (ds.length >= 2 && CONTRAST.test(s.text)) {
      out.push({
        type: "dates_in_tension",
        statementIds: [s.id],
        dates: ds,
        text: s.text,
        why: "La misma frase contrapone dos fechas distintas. Compruebe si designan el mismo hecho y cuál es la correcta.",
      });
    }
    const cause = CAUSE_MARKER.exec(s.text);
    if (cause) {
      const before = datesOf(s.text.slice(0, cause.index));
      const after = datesOf(s.text.slice(cause.index + cause[0].length));
      const sameRef = /^\s*(?:le\s+)?(?:même|selben|gleichen|derselben|dasselbe|identique)/i.test(
        s.text.slice(cause.index + cause[0].length),
      );
      // Caso 2: ambas fechas antes del marcador y el marcador remite a "el mismo hecho".
      if (sameRef && after.length === 0) {
        const positioned = positionedDates(s.text.slice(0, cause.index));
        if (positioned.length >= 2 && positioned[positioned.length - 1]!.iso < positioned[0]!.iso) {
          out.push({
            type: "effect_before_cause",
            statementIds: [s.id],
            dates: [positioned[positioned.length - 1]!.iso, positioned[0]!.iso],
            text: s.text,
            why: "La frase dice que algo fechado antes 'hace seguimiento' del mismo hecho fechado después. Compruebe el orden cronológico.",
          });
        }
      }
      if (before.length > 0 && after.length > 0 && before[before.length - 1]! < after[0]!) {
        out.push({
          type: "effect_before_cause",
          statementIds: [s.id],
          dates: [before[before.length - 1]!, after[0]!],
          text: s.text,
          why: "La frase presenta como consecuencia algo fechado antes de su causa. Compruebe el orden cronológico.",
        });
      }
    }
  }
  const endDates = new Map<string, Set<string>>();
  for (const s of statements) {
    for (const m of s.text.matchAll(EMPLOYMENT_END)) {
      for (const d of datesOf(s.text.slice(m.index, m.index + 140))) {
        const ids = endDates.get(d) ?? new Set<string>();
        ids.add(s.id);
        endDates.set(d, ids);
      }
    }
  }
  if (endDates.size >= 2 && !out.some((x) => x.type === "dates_in_tension")) {
    out.push({
      type: "same_event_two_dates",
      statementIds: [...new Set([...endDates.values()].flatMap((x) => [...x]))],
      dates: [...endDates.keys()].sort(),
      text: "",
      why: "El fin de la relación laboral figura con fechas distintas en la resolución.",
    });
  }
  return out;
}

// --- Dos valores para la misma referencia -------------------------------------------------------

export interface SameReferenceCandidate {
  readonly type: "same_reference_two_values";
  readonly statementId: string;
  readonly kind: "money" | "days";
  readonly values: readonly number[];
  readonly text: string;
  readonly why: string;
}

const SAME_REFERENCE =
  /\b(?:denselben|dieselbe|derselben|dasselbe|selben|gleichzeitig|même|mêmes|simultanément|stess[oa]|stessi|stesse|contemporaneamente)\b/i;
const ZERO_WORD = /\b(?:nul|nulle|null|zéro|zero|gratuit)\b/i;

/** "vier und elf Tage" -> [4, 11]. */
function wordDayPairs(text: string): number[] {
  const out: number[] = [];
  const names = Object.keys(WORD_NUMBERS).join("|");
  const re = new RegExp(
    `\\b(\\d+|${names})\\s+(?:und|et|e)\\s+(\\d+|${names})\\s+(?:\\w+\\s+){0,2}\\w*(?:Tage|Tagen|jours|giorni)`,
    "gi",
  );
  for (const m of text.matchAll(re)) {
    for (const g of [m[1], m[2]]) {
      const v = toInt(g!);
      if (v !== null) out.push(v);
    }
  }
  return out;
}

/**
 * Una frase que habla de "lo mismo" (mismo mes, mismo periodo, misma fuente) y da dos valores
 * distintos (importes o dias) sin explicar la diferencia. Es un CANDIDATO: puede haber una
 * rectificacion declarada en otra frase.
 */
export function findSameReferenceConflicts(
  statements: readonly PlainStatement[],
): SameReferenceCandidate[] {
  const out: SameReferenceCandidate[] = [];
  for (const s of statements) {
    if (!SAME_REFERENCE.test(s.text)) continue;
    const money = new Set(unitValues(s.text, "money"));
    if (money.size > 0 && ZERO_WORD.test(s.text)) money.add(0);
    const days = new Set([...unitValues(s.text, "days"), ...wordDayPairs(s.text)]);
    for (const [kind, set] of [
      ["money", money],
      ["days", days],
    ] as const) {
      if (set.size >= 2) {
        out.push({
          type: "same_reference_two_values",
          statementId: s.id,
          kind,
          values: [...set].sort((a, b) => a - b),
          text: s.text,
          why: "La frase asigna valores distintos a la misma referencia. Compruebe si la resolución explica la diferencia o si es una contradicción.",
        });
      }
    }
  }
  return out;
}

// --- Aritmetica de excedentes y faltantes -------------------------------------------------------

export interface ArithmeticCandidate {
  readonly type: "arithmetic_mismatch";
  readonly statementId: string;
  readonly stated: number;
  readonly keyword: string;
  readonly amounts: readonly number[];
  readonly text: string;
  readonly why: string;
}

const BALANCE_WORD =
  /(Überschuss|Fehlbetrag|Defizit|Differenz|Restbetrag|Saldo|excédent|déficit|solde|différence|montant\s+restant|eccedenza|disavanzo|differenza)/i;

/**
 * Un excedente, faltante o saldo declarado que no sale de ninguna resta de los importes que la
 * propia resolucion cita (en la frase y la anterior). Se comprueban restas de dos y de tres importes.
 * Candidato: puede haber importes que no figuran en el texto.
 */
export function findArithmeticMismatches(
  statements: readonly PlainStatement[],
): ArithmeticCandidate[] {
  const out: ArithmeticCandidate[] = [];
  statements.forEach((s, i) => {
    const m = BALANCE_WORD.exec(s.text);
    if (!m) return;
    const after = s.text.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const statedAll = unitValues(after, "money");
    const stated = statedAll[0];
    if (stated === undefined || stated === 0) return;
    const pool = [
      ...new Set([
        ...unitValues(s.text, "money"),
        ...(i > 0 ? unitValues(statements[i - 1]!.text, "money") : []),
        ...(i > 1 ? unitValues(statements[i - 2]!.text, "money") : []),
      ]),
    ].filter((v) => v !== stated);
    if (pool.length < 2 || pool.length > 9) return;
    const tol = 1;
    let ok = false;
    for (const a of pool) {
      for (const b of pool) {
        if (a === b) continue;
        if (Math.abs(a - b - stated) <= tol) ok = true;
        for (const c of pool) {
          if (c === a || c === b) continue;
          if (Math.abs(a - b - c - stated) <= tol || Math.abs(a + b - c - stated) <= tol) ok = true;
        }
      }
    }
    if (!ok) {
      out.push({
        type: "arithmetic_mismatch",
        statementId: s.id,
        stated,
        keyword: m[1]!,
        amounts: pool.sort((x, y) => x - y),
        text: s.text,
        why: `El importe declarado (${stated}) no resulta de ninguna resta de los importes que la resolución cita (${pool.join(", ")}). Recalcule y compruebe si falta algún importe.`,
      });
    }
  });
  return out;
}
