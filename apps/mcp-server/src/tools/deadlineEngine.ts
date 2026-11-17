/**
 * Motor de plazos procesales (derecho federal suizo). Funcion pura y determinista: sin red,
 * sin fecha del sistema, sin datos inventados.
 *
 * Reglas codificadas (texto verificado en Fedlex el 2026-11-11 con get_article):
 *  - ATSG/LPGA  Art. 38 (inicio al dia siguiente; sabado/domingo/festivo -> siguiente dia habil;
 *    suspension), Art. 39 (entrega a Correos el ultimo dia), Art. 52 (Einsprache, 30 dias),
 *    Art. 60 (Beschwerde, 30 dias; remite a Art. 38-41).
 *  - VwVG       Art. 20 (computo), Art. 21 (entrega), Art. 22a (suspension), Art. 50 (30 dias).
 *  - BGG        Art. 44 (inicio), Art. 45 (fin), Art. 46 (suspension y excepciones), Art. 100.
 *  - SchKG      Art. 74 (Rechtsvorschlag, 10 dias desde la notificacion), Art. 31 (remite a ZPO).
 *  - ZPO        Art. 142 (inicio/computo), Art. 145 (suspension).
 *
 * Principios de seguridad:
 *  - Nunca se afirma una fecha si la notificacion no esta probada: sin prueba el resultado es
 *    `conditional` (fecha supuesta, explicitada) o `not_verified` (sin fecha).
 *  - Los festivos cantonales NO se inventan: solo se aplican los aportados por el llamador y el
 *    1 de agosto (Bundesfeiertag). Si el ultimo dia cae en una fecha que es festivo en algun
 *    canton, se devuelven AMBAS fechas y `needsHolidayConfirmation`.
 *  - Cuando es dudoso si rige la suspension, `safeDate` es siempre la fecha MAS TEMPRANA.
 *  - Una Rechtsmittelbelehrung del acto prevalece; este motor no la sustituye.
 */

export type DeadlineRuleSet =
  | "ATSG_EINSPRACHE"
  | "ATSG_BESCHWERDE"
  | "VWVG_BESCHWERDE"
  | "BGG_BESCHWERDE"
  | "SCHKG_RECHTSVORSCHLAG"
  | "ZPO_BERUFUNG"
  | "ZPO_BERUFUNG_SUMMARISCH"
  | "ZPO_BESCHWERDE"
  | "ZPO_BESCHWERDE_10TAGE"
  | "STPO_BESCHWERDE"
  | "STPO_BERUFUNG_ANMELDUNG"
  | "STPO_BERUFUNG_ERKLAERUNG"
  | "STPO_EINSPRACHE_STRAFBEFEHL";

export type NotificationProof = "proven" | "assumed" | "unknown";
export type DeadlineStatus = "computed" | "conditional" | "not_verified";

export interface DeadlineInput {
  readonly ruleSet: DeadlineRuleSet;
  /** Fecha (AAAA-MM-DD) de notificacion/Eroeffnung/Zustellung. */
  readonly notificationDate?: string;
  readonly notificationProof: NotificationProof;
  /** Envio certificado no retirado: fecha del primer intento de entrega (AAAA-MM-DD). */
  readonly firstDeliveryAttemptDate?: string;
  /** Festivos locales aportados (AAAA-MM-DD). Nunca se inventan. */
  readonly holidays?: readonly string[];
  /** BGG Art. 100 Abs. 2: true si el caso es una de las excepciones de 10 dias. */
  readonly bggTenDayException?: boolean;
  /** Procedimiento exento de suspension (BGG 46 Abs. 2 / VwVG 22a Abs. 2 / ZPO 145 Abs. 2). */
  readonly stillstandExempt?: boolean;
  /** Plazo indicado en la Rechtsmittelbelehrung (dias), para detectar discrepancias. */
  readonly statedDeadlineDays?: number;
}

export interface DeadlineStep {
  readonly step: string;
  readonly detail: string;
  readonly legalBasis: string;
}

export interface DeadlineResult {
  readonly status: DeadlineStatus;
  readonly ruleSet: DeadlineRuleSet;
  readonly durationDays: number | null;
  readonly notificationDateUsed: string | null;
  readonly firstDay: string | null;
  /** Ultimo dia de presentacion segun el computo completo (con suspension/festivos conocidos). */
  readonly deadlineDate: string | null;
  /** Fecha prudente: la mas temprana plausible. Presentar siempre antes de esta fecha. */
  readonly safeDate: string | null;
  readonly alternativeDates: readonly { readonly date: string; readonly condition: string }[];
  readonly stillstandApplied: boolean;
  readonly stillstandDaysSkipped: number;
  readonly needsHolidayConfirmation: boolean;
  readonly steps: readonly DeadlineStep[];
  readonly legalBasis: readonly string[];
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresHumanReview: true;
}

interface RuleSetDefinition {
  readonly days: number;
  readonly basis: readonly string[];
  readonly stillstand: "applies" | "does_not_apply_verify" | "applies_unless_exempt" | "none";
  readonly stillstandBasis: string;
  readonly computationBasis: string;
  readonly deliveryBasis: string;
  /** Norma sobre el dia inhabil y el festivo relevante (por defecto la de ATSG/VwVG/BGG). */
  readonly holidayBasis?: string;
  /** Norma sobre la presentacion en plazo (por defecto la de ATSG/VwVG/BGG). */
  readonly submissionBasis?: string;
  /** Avisos especificos del tramite, anadidos siempre al resultado. */
  readonly notes?: readonly string[];
}

const ZPO_COMMON = {
  computationBasis: "Art. 142 Abs. 1 und 3 ZPO (SR 272)",
  deliveryBasis:
    "Art. 138 Abs. 3 lit. a ZPO (envio no retirado: septimo dia tras el intento fallido)",
  holidayBasis: "Art. 142 Abs. 3 ZPO (festivo reconocido en el Gerichtsort)",
  submissionBasis: "Art. 143 ZPO",
} as const;

const ZPO_NOTES: readonly string[] = [
  "Art. 142 Abs. 1bis ZPO: si la entrega por correo ORDINARIO ocurre en sabado, domingo o festivo del Gerichtsort, la notificacion se tiene por efectuada el siguiente dia habil. Si ese es su caso, use esa fecha como notificationDate.",
  "Art. 145 Abs. 2 ZPO: la suspension de plazos no rige en el procedimiento de conciliacion ni en el sumario. Si el caso es sumario, indique stillstandExempt=true o use el conjunto de reglas sumario.",
];

const STPO_COMMON = {
  stillstand: "none",
  stillstandBasis:
    "Art. 89 Abs. 2 StPO: en el proceso penal no hay Gerichtsferien (sin suspension de plazos)",
  computationBasis: "Art. 90 Abs. 1 und 2 StPO (SR 312.0)",
  deliveryBasis:
    "Art. 85 Abs. 4 lit. a StPO (envio no retirado: septimo dia tras el intento fallido)",
  holidayBasis:
    "Art. 90 Abs. 2 StPO (festivo del canton de domicilio/sede de la parte o de su defensor)",
  submissionBasis: "Art. 91 StPO",
} as const;

const RULES: Readonly<Record<DeadlineRuleSet, RuleSetDefinition>> = {
  ATSG_EINSPRACHE: {
    days: 30,
    basis: ["Art. 52 Abs. 1 ATSG (SR 830.1): Einsprache innert 30 Tagen"],
    stillstand: "applies",
    stillstandBasis: "Art. 38 Abs. 4 ATSG",
    computationBasis: "Art. 38 Abs. 1 und 3 ATSG",
    deliveryBasis: "Art. 38 Abs. 2bis ATSG",
  },
  ATSG_BESCHWERDE: {
    days: 30,
    basis: [
      "Art. 60 Abs. 1 ATSG (SR 830.1): Beschwerde innert 30 Tagen nach der Eroeffnung",
      "Art. 60 Abs. 2 ATSG: Art. 38-41 sinngemaess anwendbar",
    ],
    stillstand: "applies",
    stillstandBasis: "Art. 38 Abs. 4 i.V.m. Art. 60 Abs. 2 ATSG",
    computationBasis: "Art. 38 Abs. 1 und 3 i.V.m. Art. 60 Abs. 2 ATSG",
    deliveryBasis: "Art. 38 Abs. 2bis i.V.m. Art. 60 Abs. 2 ATSG",
  },
  VWVG_BESCHWERDE: {
    days: 30,
    basis: ["Art. 50 Abs. 1 VwVG (SR 172.021): Beschwerde innert 30 Tagen nach Eroeffnung"],
    stillstand: "applies_unless_exempt",
    stillstandBasis:
      "Art. 22a Abs. 1 VwVG (Abs. 2: nicht bei aufschiebender Wirkung/vorsorglichen Massnahmen und oeffentlichen Beschaffungen)",
    computationBasis: "Art. 20 Abs. 1 und 3 VwVG",
    deliveryBasis: "Art. 20 Abs. 2bis VwVG",
  },
  BGG_BESCHWERDE: {
    days: 30,
    basis: [
      "Art. 100 Abs. 1 BGG (SR 173.110): Beschwerde innert 30 Tagen nach der Eroeffnung der vollstaendigen Ausfertigung",
    ],
    stillstand: "applies_unless_exempt",
    stillstandBasis:
      "Art. 46 Abs. 1 BGG (Abs. 2: Ausnahmen, u.a. aufschiebende Wirkung/vorsorgliche Massnahmen, Wechselbetreibung, Stimmrechtssachen)",
    computationBasis: "Art. 44 Abs. 1 und Art. 45 Abs. 1 BGG",
    deliveryBasis: "Art. 44 Abs. 2 BGG",
  },
  SCHKG_RECHTSVORSCHLAG: {
    days: 10,
    basis: [
      "Art. 74 Abs. 1 SchKG (SR 281.1): Rechtsvorschlag innert zehn Tagen nach der Zustellung",
    ],
    stillstand: "does_not_apply_verify",
    stillstandBasis:
      "Art. 31 SchKG verweist auf Art. 142-145 ZPO; Art. 145 Abs. 4 ZPO ordnet den Stillstand nur fuer gerichtliche Klagen nach SchKG an",
    computationBasis: "Art. 31 SchKG i.V.m. Art. 142 ZPO",
    deliveryBasis: "Art. 138 ZPO / Art. 34 SchKG (nicht kodifiziert: Zustellung manuell pruefen)",
  },
  ZPO_BERUFUNG: {
    days: 30,
    basis: [
      "Art. 311 Abs. 1 ZPO: Berufung innert 30 Tagen seit Zustellung des begruendeten Entscheides",
    ],
    stillstand: "applies_unless_exempt",
    stillstandBasis:
      "Art. 145 Abs. 1 ZPO (Abs. 2: nicht im Schlichtungs- und im summarischen Verfahren)",
    ...ZPO_COMMON,
    notes: [
      ...ZPO_NOTES,
      "Art. 314 ZPO: contra decisiones del procedimiento SUMARIO el plazo es de 10 dias (30 en los litigios de derecho de familia de los Art. 271, 276, 302 y 305 ZPO). Para sumario use ZPO_BERUFUNG_SUMMARISCH.",
      "Art. 311 Abs. 1 ZPO: el plazo corre desde la notificacion de la sentencia FUNDAMENTADA (o de la notificacion posterior de los fundamentos, Art. 239 ZPO), no desde el dispositivo.",
    ],
  },
  ZPO_BERUFUNG_SUMMARISCH: {
    days: 10,
    basis: ["Art. 314 Abs. 1 ZPO: Berufung im summarischen Verfahren innert zehn Tagen"],
    stillstand: "none",
    stillstandBasis:
      "Art. 145 Abs. 2 lit. b ZPO: sin suspension de plazos en el procedimiento sumario",
    ...ZPO_COMMON,
    notes: [
      "Art. 314 Abs. 2 ZPO: en los litigios de derecho de familia de los Art. 271, 276, 302 y 305 ZPO el plazo es de 30 dias, no de 10. Si es su caso use ZPO_BERUFUNG con stillstandExempt=true.",
      ZPO_NOTES[0] as string,
    ],
  },
  ZPO_BESCHWERDE: {
    days: 30,
    basis: [
      "Art. 321 Abs. 1 ZPO: Beschwerde innert 30 Tagen seit Zustellung des begruendeten Entscheides",
    ],
    stillstand: "applies_unless_exempt",
    stillstandBasis:
      "Art. 145 Abs. 1 ZPO (Abs. 2: nicht im Schlichtungs- und im summarischen Verfahren)",
    ...ZPO_COMMON,
    notes: [
      ...ZPO_NOTES,
      "Art. 321 Abs. 2 ZPO: contra decisiones del procedimiento sumario, otras decisiones de primera instancia y resoluciones de ordenacion del proceso el plazo es de 10 dias. Use ZPO_BESCHWERDE_10TAGE.",
      "Art. 321 Abs. 4 ZPO: la queja por denegacion o retardo de justicia no esta sujeta a plazo.",
    ],
  },
  ZPO_BESCHWERDE_10TAGE: {
    days: 10,
    basis: [
      "Art. 321 Abs. 2 ZPO: Beschwerde innert zehn Tagen gegen summarische Entscheide, andere erstinstanzliche Entscheide und prozessleitende Verfuegungen",
    ],
    stillstand: "applies_unless_exempt",
    stillstandBasis:
      "Art. 145 Abs. 1 ZPO (Abs. 2 lit. b: no rige en el procedimiento sumario; en resoluciones de ordenacion de un proceso ordinario SI rige)",
    ...ZPO_COMMON,
    notes: [
      ...ZPO_NOTES,
      "Si la resolucion se dicta en procedimiento sumario indique stillstandExempt=true; en una resolucion de ordenacion de un proceso ordinario la suspension rige. Ante la duda, se muestra la fecha mas temprana como fecha prudente.",
    ],
  },
  STPO_BESCHWERDE: {
    days: 10,
    basis: ["Art. 396 Abs. 1 StPO: Beschwerde innert 10 Tagen schriftlich und begruendet"],
    ...STPO_COMMON,
    notes: [
      "Art. 384 StPO: el plazo corre desde la entrega/notificacion de la resolucion (sentencia: del dispositivo escrito; resolucion no escrita: desde el conocimiento).",
      "Art. 396 Abs. 2 StPO: la queja por denegacion o retardo de justicia no esta sujeta a plazo.",
      "Art. 89 Abs. 1 StPO: los plazos legales no pueden prorrogarse.",
    ],
  },
  STPO_EINSPRACHE_STRAFBEFEHL: {
    days: 10,
    basis: [
      "Art. 354 Abs. 1 StPO: Einsprache gegen den Strafbefehl bei der Staatsanwaltschaft innert 10 Tagen schriftlich",
    ],
    ...STPO_COMMON,
    notes: [
      "Art. 354 Abs. 2 StPO: la oposicion debe motivarse, salvo la de la persona acusada (que puede ser sucinta). Art. 354 Abs. 3: sin oposicion valida el Strafbefehl pasa a ser sentencia firme.",
      "Art. 354 Abs. 1bis StPO: la acusacion particular no puede impugnar la sancion impuesta.",
      "Art. 384 lit. b StPO: el plazo corre desde la notificacion del Strafbefehl. Art. 85 Abs. 4 lit. a StPO: envio certificado no retirado, septimo dia tras el intento fallido, solo si debia contar con la notificacion.",
      "Art. 89 Abs. 1 StPO: los plazos legales no pueden prorrogarse.",
    ],
  },
  STPO_BERUFUNG_ANMELDUNG: {
    days: 10,
    basis: [
      "Art. 399 Abs. 1 StPO: Anmeldung der Berufung innert 10 Tagen seit Eroeffnung des Urteils",
    ],
    ...STPO_COMMON,
    notes: [
      "Art. 384 lit. a StPO: en una sentencia el plazo corre desde la entrega o notificacion del dispositivo escrito (o desde su lectura oral si asi se abre).",
      "Tras la anmeldung corre aparte el plazo de 20 dias de la Berufungserklaerung (STPO_BERUFUNG_ERKLAERUNG), contado desde la notificacion de la sentencia fundamentada.",
      "Art. 89 Abs. 1 StPO: los plazos legales no pueden prorrogarse.",
    ],
  },
  STPO_BERUFUNG_ERKLAERUNG: {
    days: 20,
    basis: [
      "Art. 399 Abs. 3 StPO: schriftliche Berufungserklaerung innert 20 Tagen seit Zustellung des begruendeten Urteils",
    ],
    ...STPO_COMMON,
    notes: [
      "Solo procede si la Berufung se anmeldete en plazo (STPO_BERUFUNG_ANMELDUNG). La notificationDate es la de la sentencia FUNDAMENTADA.",
      "Art. 89 Abs. 1 StPO: los plazos legales no pueden prorrogarse.",
    ],
  },
};

const MS_PER_DAY = 86_400_000;

function parseIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Domingo de Pascua (calendario gregoriano, algoritmo de Meeus/Jones/Butcher). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Suspension legal de plazos (ATSG 38 IV, VwVG 22a I, BGG 46 I, ZPO 145 I): del 7.o dia antes de
 * Pascua al 7.o dia despues (ambos incluidos), 15 jul - 15 ago, 18 dic - 2 ene.
 */
export function isInStillstand(date: Date): boolean {
  const year = date.getUTCFullYear();
  const easter = easterSunday(year);
  const easterStart = addDays(easter, -7).getTime();
  const easterEnd = addDays(easter, 7).getTime();
  const t = date.getTime();
  if (t >= easterStart && t <= easterEnd) return true;
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  if (month === 7 && day >= 15) return true;
  if (month === 8 && day <= 15) return true;
  if (month === 12 && day >= 18) return true;
  if (month === 1 && day <= 2) return true;
  return false;
}

function isWeekend(date: Date): boolean {
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6;
}

/** Festivo federal seguro: 1 de agosto (Bundesfeiertag). */
function isFederalHoliday(date: Date): boolean {
  return date.getUTCMonth() === 7 && date.getUTCDate() === 1;
}

/**
 * Fechas que son festivo reconocido en ALGUNOS cantones (no se afirma en cual): se usan solo para
 * avisar y ofrecer fecha alternativa. No es una lista de festivos de ningun canton concreto.
 */
function isCommonCantonalHoliday(date: Date): string | null {
  const year = date.getUTCFullYear();
  const easter = easterSunday(year);
  const key = iso(date);
  const candidates: [string, string][] = [
    [iso(addDays(easter, -2)), "Karfreitag"],
    [iso(addDays(easter, 1)), "Ostermontag"],
    [iso(addDays(easter, 39)), "Auffahrt"],
    [iso(addDays(easter, 50)), "Pfingstmontag"],
    [iso(addDays(easter, 60)), "Fronleichnam"],
    [`${year}-01-01`, "Neujahr"],
    [`${year}-01-02`, "Berchtoldstag"],
    [`${year}-12-25`, "Weihnachten"],
    [`${year}-12-26`, "Stephanstag"],
    [`${year}-05-01`, "Tag der Arbeit"],
    [`${year}-08-15`, "Mariae Himmelfahrt"],
    [`${year}-11-01`, "Allerheiligen"],
    [`${year}-12-08`, "Mariae Empfaengnis"],
  ];
  return candidates.find(([d]) => d === key)?.[1] ?? null;
}

function emptyResult(
  ruleSet: DeadlineRuleSet,
  status: DeadlineStatus,
  warnings: string[],
  assumptions: string[] = [],
): DeadlineResult {
  const rule = RULES[ruleSet];
  return {
    status,
    ruleSet,
    durationDays: rule.days,
    notificationDateUsed: null,
    firstDay: null,
    deadlineDate: null,
    safeDate: null,
    alternativeDates: [],
    stillstandApplied: false,
    stillstandDaysSkipped: 0,
    needsHolidayConfirmation: false,
    steps: [],
    legalBasis: rule.basis,
    assumptions,
    warnings,
    requiresHumanReview: true,
  };
}

interface CountOutcome {
  readonly end: Date;
  readonly skipped: number;
}

/** Cuenta `days` dias desde `first` (inclusive), saltando los dias de suspension si procede. */
function countDays(first: Date, days: number, withStillstand: boolean): CountOutcome {
  let counted = 0;
  let skipped = 0;
  let cursor = first;
  for (;;) {
    if (withStillstand && isInStillstand(cursor)) {
      skipped += 1;
    } else {
      counted += 1;
      if (counted === days) return { end: cursor, skipped };
    }
    cursor = addDays(cursor, 1);
  }
}

export function computeDeadline(input: DeadlineInput): DeadlineResult {
  const rule = RULES[input.ruleSet];
  const warnings: string[] = [
    "Verificar siempre contra la Rechtsmittelbelehrung del acto; si difiere de este calculo, prevalece la instruccion y debe aclararse con la autoridad.",
    "Resultado orientativo: requiere revision juridica humana antes de confiar en el en un caso real.",
  ];
  const assumptions: string[] = [];
  const steps: DeadlineStep[] = [];
  warnings.push(...(rule.notes ?? []));

  if (input.notificationProof === "unknown" || !input.notificationDate) {
    return emptyResult(input.ruleSet, "not_verified", [
      ...warnings,
      "Sin fecha de notificacion no se calcula ningun plazo. Indique la fecha de notificacion y como se prueba (sobre, sello de Correos, acuse).",
    ]);
  }

  let notification = parseIso(input.notificationDate);
  if (!notification) {
    return emptyResult(input.ruleSet, "not_verified", [
      ...warnings,
      `Fecha de notificacion no valida: '${input.notificationDate}' (formato AAAA-MM-DD).`,
    ]);
  }

  if (input.firstDeliveryAttemptDate) {
    const attempt = parseIso(input.firstDeliveryAttemptDate);
    if (!attempt) {
      return emptyResult(input.ruleSet, "not_verified", [
        ...warnings,
        `Fecha del primer intento de entrega no valida: '${input.firstDeliveryAttemptDate}'.`,
      ]);
    }
    const fictional = addDays(attempt, 7);
    assumptions.push(
      `Envio no retirado: la notificacion se considera efectuada, como muy tarde, el septimo dia tras el primer intento fallido (${iso(fictional)}) (${rule.deliveryBasis}). Aplica solo si el destinatario debia contar con una notificacion; si recogio el envio antes, usar la fecha real.`,
    );
    steps.push({
      step: "Notificacion ficticia por envio no retirado",
      detail: `Primer intento ${iso(attempt)} + 7 dias = ${iso(fictional)}`,
      legalBasis: rule.deliveryBasis,
    });
    if (fictional.getTime() > notification.getTime()) {
      assumptions.push(
        `Se usa la fecha de notificacion aportada (${iso(notification)}) por ser anterior a la ficcion legal: calculo prudente.`,
      );
    } else {
      notification = fictional;
    }
  }

  if (input.ruleSet === "BGG_BESCHWERDE" && input.bggTenDayException === undefined) {
    warnings.push(
      "Art. 100 Abs. 2 BGG fija 10 dias (no 30) en ciertos casos (autoridades de vigilancia en materia de ejecucion y quiebras, asistencia judicial internacional, restitucion de menores, etc.). No se ha confirmado que no aplique: compruebe la excepcion.",
    );
  }
  let days = rule.days;
  if (input.ruleSet === "BGG_BESCHWERDE" && input.bggTenDayException === true) {
    days = 10;
    steps.push({
      step: "Plazo reducido",
      detail: "Excepcion de 10 dias declarada por el llamador",
      legalBasis: "Art. 100 Abs. 2 BGG",
    });
  }
  if (input.statedDeadlineDays !== undefined && input.statedDeadlineDays !== days) {
    warnings.push(
      `La Rechtsmittelbelehrung indica ${input.statedDeadlineDays} dias pero la regla legal codificada es ${days}. Discrepancia: aclarar; ante la duda usar el plazo mas corto.`,
    );
  }

  const firstDay = addDays(notification, 1);
  steps.push({
    step: "Inicio del plazo",
    detail: `Notificacion ${iso(notification)}: el plazo empieza al dia siguiente (${iso(firstDay)}); el dia de la notificacion no cuenta.`,
    legalBasis: rule.computationBasis,
  });

  let stillstandMode: "yes" | "no" | "uncertain";
  if (input.stillstandExempt === true) {
    stillstandMode = "no";
    steps.push({
      step: "Sin suspension",
      detail: "Procedimiento declarado exento de suspension por el llamador",
      legalBasis: rule.stillstandBasis,
    });
  } else if (rule.stillstand === "none") {
    stillstandMode = "no";
    steps.push({
      step: "Sin suspension",
      detail: "Este tramite no admite suspension de plazos (ver base legal).",
      legalBasis: rule.stillstandBasis,
    });
  } else if (rule.stillstand === "does_not_apply_verify") {
    stillstandMode = "uncertain";
    warnings.push(
      "Rechtsvorschlag: se calcula sin suspension (fecha mas temprana, la prudente). Si usted sostiene que rige la suspension, la fecha alternativa se muestra aparte; verifique.",
    );
  } else {
    stillstandMode = "yes";
  }

  const main = countDays(firstDay, days, stillstandMode === "yes");
  const withoutStillstand = countDays(firstDay, days, false);

  if (stillstandMode === "yes" && main.skipped > 0) {
    steps.push({
      step: "Suspension de plazos",
      detail: `${main.skipped} dia(s) en suspension (Pascua +-7 dias, 15.7-15.8, 18.12-2.1) no cuentan.`,
      legalBasis: rule.stillstandBasis,
    });
  }
  steps.push({
    step: "Ultimo dia (bruto)",
    detail: `${days} dia(s) contados desde ${iso(firstDay)} terminan el ${iso(main.end)}.`,
    legalBasis: rule.computationBasis,
  });

  const knownHolidays = new Set((input.holidays ?? []).filter((h) => parseIso(h) !== null));
  const invalidHolidays = (input.holidays ?? []).filter((h) => parseIso(h) === null);
  if (invalidHolidays.length > 0) {
    warnings.push(`Festivos ignorados por formato invalido: ${invalidHolidays.join(", ")}.`);
  }

  const rollForward = (end: Date): { date: Date; ambiguous: string | null; rolled: string[] } => {
    let date = end;
    const rolled: string[] = [];
    for (;;) {
      if (isWeekend(date)) {
        rolled.push(`${iso(date)} es sabado/domingo`);
      } else if (isFederalHoliday(date)) {
        rolled.push(`${iso(date)} es el 1 de agosto (Bundesfeiertag)`);
      } else if (knownHolidays.has(iso(date))) {
        rolled.push(`${iso(date)} es festivo aportado`);
      } else {
        return { date, ambiguous: isCommonCantonalHoliday(date), rolled };
      }
      date = addDays(date, 1);
    }
  };

  const rolledMain = rollForward(main.end);
  if (rolledMain.rolled.length > 0) {
    steps.push({
      step: "Vencimiento en dia inhabil",
      detail: `${rolledMain.rolled.join("; ")} -> el plazo termina el siguiente dia habil (${iso(rolledMain.date)}).`,
      legalBasis: rule.computationBasis,
    });
  }

  const alternativeDates: { date: string; condition: string }[] = [];
  let needsHolidayConfirmation = false;
  let deadline = rolledMain.date;
  if (rolledMain.ambiguous) {
    needsHolidayConfirmation = true;
    const next = rollForward(addDays(rolledMain.date, 1));
    warnings.push(
      `${iso(rolledMain.date)} es ${rolledMain.ambiguous}, festivo reconocido en algunos cantones. El festivo relevante se rige por ${rule.holidayBasis ?? "Art. 38 Abs. 3 ATSG / Art. 45 Abs. 2 BGG / Art. 20 Abs. 3 VwVG (canton de domicilio/sede de la parte)"}. Confirme el calendario cantonal.`,
    );
    alternativeDates.push({
      date: iso(next.date),
      condition: `si ${iso(rolledMain.date)} (${rolledMain.ambiguous}) es festivo en el canton relevante`,
    });
  }

  let safe = deadline;
  if (stillstandMode === "yes") {
    const noSuspension = rollForward(withoutStillstand.end).date;
    if (noSuspension.getTime() < safe.getTime()) {
      safe = noSuspension;
      alternativeDates.push({
        date: iso(deadline),
        condition: "si la suspension de plazos aplica al procedimiento concreto",
      });
      warnings.push(
        `Si la suspension no aplicara (excepciones: ${rule.stillstandBasis}), el plazo vencería el ${iso(noSuspension)}. Se recomienda presentar antes de esa fecha.`,
      );
    }
  }
  if (stillstandMode === "uncertain") {
    const withSuspension = rollForward(countDays(firstDay, days, true).end).date;
    deadline = rollForward(withoutStillstand.end).date;
    safe = deadline;
    if (withSuspension.getTime() !== deadline.getTime()) {
      alternativeDates.push({
        date: iso(withSuspension),
        condition: "solo si rigiera la suspension de plazos (no confirmado para este tramite)",
      });
    }
  }

  steps.push({
    step: "Presentacion",
    detail: `Los escritos deben entregarse a la autoridad o a Correos Suizos, como muy tarde, el ultimo dia del plazo (${rule.submissionBasis ?? "Art. 39 Abs. 1 ATSG / Art. 21 Abs. 1 VwVG / Art. 48 Abs. 1 BGG segun el caso"}).`,
    legalBasis: rule.submissionBasis ?? "Art. 39 ATSG; Art. 21 VwVG; Art. 48 BGG",
  });

  let status: DeadlineStatus = "computed";
  if (input.notificationProof === "assumed") {
    status = "conditional";
    assumptions.push(
      `La fecha de notificacion (${iso(notification)}) es una SUPOSICION no probada. Si la notificacion real fue anterior, el plazo vence antes.`,
    );
    warnings.push(
      "Notificacion no probada: resultado condicional. Recupere el sobre, el sello de Correos o el acuse de recibo.",
    );
  }
  if (needsHolidayConfirmation || alternativeDates.length > 0) {
    if (status === "computed") status = "conditional";
  }

  return {
    status,
    ruleSet: input.ruleSet,
    durationDays: days,
    notificationDateUsed: iso(notification),
    firstDay: iso(firstDay),
    deadlineDate: iso(deadline),
    safeDate: iso(safe),
    alternativeDates,
    stillstandApplied: stillstandMode === "yes" && main.skipped > 0,
    stillstandDaysSkipped: stillstandMode === "yes" ? main.skipped : 0,
    needsHolidayConfirmation,
    steps,
    legalBasis: [...rule.basis, rule.computationBasis, rule.stillstandBasis],
    assumptions,
    warnings,
    requiresHumanReview: true,
  };
}
