/**
 * Consejo juridico de estrategia: preparacion y validacion deterministas.
 *
 * El servidor no razona como un juez, pero puede hacer las dos mitades que un modelo hace mal:
 *  1. PREPARAR: dado el caso y la posicion del usuario, entrega el encargo de cada voz (abogado
 *     propio, abogado contrario, juez favorable, juez estricto, juez neutral) junto con el
 *     material juridico YA verificado que le corresponde y las reglas que no puede saltarse.
 *  2. VALIDAR: cuando el modelo escribe las posiciones, comprueba cada norma citada, los hechos
 *     usados, las mezclas de papeles, el lenguaje de certeza y la falta de contraargumento, y
 *     calcula la matriz de acuerdos y discrepancias.
 * Los "jueces" son perspectivas simuladas para estresar la posicion, no predicciones.
 */
import { activatedGrounds } from "./legalGroundsRegistry.js";
import { selectProceduralRoutes } from "./proceduralRulesRegistry.js";

export type CouncilSide =
  | "claimant"
  | "defendant"
  | "appellant"
  | "respondent"
  | "authority"
  | "insured"
  | "insurer"
  | "taxpayer"
  | "tax_authority"
  | "other";

export type FactStatus = "accepted" | "alleged" | "disputed" | "unknown";

export interface CouncilFact {
  readonly id: string;
  readonly description: string;
  readonly status: FactStatus;
  readonly source?: string | undefined;
}

export interface CouncilCaseInput {
  readonly side: CouncilSide;
  readonly sideLabel?: string | undefined;
  readonly matter: {
    readonly area: string;
    readonly subarea?: string | undefined;
    readonly description: string;
  };
  readonly canton?: string | undefined;
  readonly stage?: string | undefined;
  readonly facts: readonly CouncilFact[];
  readonly objectives: readonly string[];
  readonly myArguments: readonly string[];
  readonly knownOpposingArguments: readonly string[];
}

export const VOICE_IDS = [
  "my_advocate",
  "opposing_counsel",
  "judge_favorable",
  "judge_strict",
  "judge_neutral",
] as const;
export type VoiceId = (typeof VOICE_IDS)[number];

const OPPOSING_LABEL: Record<CouncilSide, string> = {
  claimant: "abogado de la parte demandada o denunciada",
  defendant: "abogado de la parte actora o denunciante",
  appellant: "abogado de la parte recurrida (o de la autoridad que dicto la resolucion)",
  respondent: "abogado de la parte recurrente",
  authority: "abogado del administrado que recurre",
  insured: "abogado de la aseguradora",
  insurer: "abogado del asegurado",
  taxpayer: "representante de la administracion tributaria",
  tax_authority: "abogado del contribuyente",
  other: "abogado de la parte contraria",
};

export interface VoiceBrief {
  readonly voice_id: VoiceId;
  readonly label: string;
  readonly mandate: string;
  readonly must_answer: readonly string[];
  readonly must_not: readonly string[];
}

const DATE_RE =
  /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b(?:19|20)\d{2}\b|\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\b/i;
const NOTIFICATION_RE = /notific|zustell|zugestellt|eröffn|notification|comunic/i;

function buildVoices(input: CouncilCaseInput): VoiceBrief[] {
  return [
    {
      voice_id: "my_advocate",
      label: "Mi abogado",
      mandate:
        "Defiende la posicion del usuario con la mayor solidez juridica honesta: objetivo realista, via procesal, argumentos principales, pruebas que faltan y plazos.",
      must_answer: [
        "¿Cual es el objetivo realista y la via procesal?",
        "¿Cuales son los 3 a 5 argumentos principales, cada uno con su norma o sentencia?",
        "¿Que pruebas tengo y cuales debo obtener?",
        "¿Que plazos corren y cual es el primer paso?",
      ],
      must_not: [
        "No inventar hechos ni pruebas: lo que no consta se marca como dato que falta.",
        "No pronunciar un fallo ni usar formulas de sentencia.",
        "No garantizar resultados.",
      ],
    },
    {
      voice_id: "opposing_counsel",
      label: `Abogado contrario (${OPPOSING_LABEL[input.side]})`,
      mandate:
        "Defiende la posicion contraria con su mejor estrategia: atacar el punto mas debil, plantear excepciones procesales y usar las pruebas que tendria contra el usuario.",
      must_answer: [
        "¿Cuales son sus mejores argumentos, con sus normas?",
        "¿Que excepciones procesales plantearia (prescripcion, plazos, competencia, motivacion, carga de la prueba)?",
        "¿Que pruebas usaria contra el usuario?",
        "¿Cual seria su estrategia (acuerdo, dilatar, atacar un punto concreto)?",
      ],
      must_not: [
        "No concederle al usuario puntos que un abogado contrario no concederia.",
        "No pronunciar un fallo.",
      ],
    },
    {
      voice_id: "judge_favorable",
      label: "Juez favorable (lectura benevolente y rigurosa)",
      mandate:
        "Lee los argumentos del usuario con la mayor buena fe juridica posible, sin dejar de ser honesto: que le convence, con que fundamento le daria la razon y que le faltaria.",
      must_answer: [
        "¿Que argumentos le convencen y por que?",
        "¿Que fundamento juridico usaria para darle la razon?",
        "¿Que le falta al usuario para que la decision sea solida?",
      ],
      must_not: [
        "No hablar como el abogado del usuario (nada de 'mi cliente' ni 'nos conviene').",
        "No dar por probado un hecho alegado o discutido sin decir bajo que condicion.",
      ],
    },
    {
      voice_id: "judge_strict",
      label: "Juez estricto (busca por donde desestimar)",
      mandate:
        "Busca la via para desestimar: inadmisibilidad, forma, plazo, carga de la prueba, hechos no acreditados, norma que no encaja.",
      must_answer: [
        "¿Por donde desestimaria y con que norma?",
        "¿Que deberia demostrar el usuario para que no pudiera desestimar?",
        "¿Que hechos no estan acreditados?",
      ],
      must_not: [
        "No hablar como el abogado contrario (nada de estrategia de parte).",
        "No inventar defectos que el expediente no muestra.",
      ],
    },
    {
      voice_id: "judge_neutral",
      label: "Juez neutral (resultado mas probable)",
      mandate: "Estima el resultado mas probable y explica el razonamiento, sin prometer nada.",
      must_answer: [
        "¿Cual es el resultado mas probable y por que?",
        "¿De que dato concreto depende que cambie?",
      ],
      must_not: [
        "No usar certeza ('seguro', 'garantizado', porcentajes): solo alta, media o baja.",
      ],
    },
  ];
}

function missingInformation(input: CouncilCaseInput, hasDeadlines: boolean): string[] {
  const missing: string[] = [];
  if (input.facts.length === 0) missing.push("Hechos del caso: no se ha indicado ninguno.");
  if (input.facts.length > 0 && !input.facts.some((f) => DATE_RE.test(f.description))) {
    missing.push("Fechas de los hechos: ningun hecho indica una fecha.");
  }
  if (input.facts.length > 0 && input.facts.every((f) => f.status !== "accepted")) {
    missing.push(
      "Ningun hecho esta marcado como acreditado con documento o aceptado por la otra parte.",
    );
  }
  for (const fact of input.facts.filter((f) => f.status === "unknown")) {
    missing.push(`Hecho sin estado claro (${fact.id}): ${fact.description.slice(0, 100)}`);
  }
  // Un hecho que solo menciona la notificacion ("no consta la fecha de notificacion") no basta:
  // debe traer una fecha y no estar marcado como desconocido.
  const hasNotificationDate = input.facts.some(
    (f) =>
      NOTIFICATION_RE.test(f.description) && DATE_RE.test(f.description) && f.status !== "unknown",
  );
  if (hasDeadlines && !hasNotificationDate) {
    missing.push(
      "Fecha de notificacion o de cada acto que fija un plazo: sin ella no se puede calcular ningun vencimiento.",
    );
  }
  if (!input.stage) missing.push("Fase del procedimiento.");
  if (input.objectives.length === 0) missing.push("Lo que se quiere conseguir.");
  return missing;
}

const STOPWORDS = new Set([
  "para",
  "como",
  "pero",
  "sobre",
  "entre",
  "desde",
  "hasta",
  "donde",
  "cuando",
  "tiene",
  "tengo",
  "esta",
  "este",
  "esto",
  "estos",
  "estas",
  "otra",
  "otro",
  "porque",
  "durante",
  "mediante",
  "ante",
  "caso",
  "parte",
  "mismo",
  "misma",
  "hacia",
  "segun",
  "tras",
  "sido",
  "ser",
  "fue",
  "con",
  "los",
  "las",
  "del",
  "que",
  "una",
  "uno",
  "por",
  "sin",
  "han",
  "hay",
  "nos",
  "mis",
  "sus",
]);

/** Palabras vacias de las lenguas en que llegan los casos: no sirven como consulta al portal. */
const QUERY_STOPWORDS = new Set([
  // aleman
  "wegen",
  "klage",
  "klagen",
  "abgewiesen",
  "gegen",
  "durch",
  "nachdem",
  "ueber",
  "über",
  "wurde",
  "wurden",
  "wird",
  "werden",
  "sowie",
  "nicht",
  "einer",
  "eines",
  "einem",
  "einen",
  "dass",
  "haben",
  "sind",
  "zugestellt",
  "gericht",
  "urteil",
  "vom",
  "zum",
  "zur",
  "oder",
  "nebst",
  "franken",
  // frances e italiano
  "pour",
  "dans",
  "avec",
  "sans",
  "contre",
  "selon",
  "entre",
  "della",
  "delle",
  "nella",
  "contro",
  "sentenza",
  "jugement",
]);

/** Sala del Tribunal Federal que suele tratar cada materia (4A: I civil; 5A: II civil). */
const CHAMBERS_BY_AREA: Record<string, readonly string[]> = {
  civil: ["I_civil_law", "II_civil_law"],
  employment: ["I_civil_law"],
  tenancy: ["I_civil_law"],
  "debt-enforcement": ["II_civil_law"],
  criminal: ["criminal_law"],
  "social-insurance": ["I_social_law", "II_social_law"],
  tax: ["II_public_law"],
  administrative: ["I_public_law", "II_public_law"],
  constitutional: ["I_public_law", "II_public_law"],
};

/** Pistas para buscar jurisprudencia: las voces deben apoyarse en sentencias leidas, no recordadas. */
function caseLawPlan(input: CouncilCaseInput) {
  const words = (text: string | undefined) =>
    (text ?? "")
      .split(/[\s,.;:()"'/]+/)
      .map((t) => t.trim())
      .filter(
        (t) =>
          t.length >= 5 &&
          !/\d/.test(t) &&
          !STOPWORDS.has(t.toLowerCase()) &&
          !QUERY_STOPWORDS.has(t.toLowerCase()),
      );
  // Primero los terminos juridicos de la materia, despues las palabras largas de la descripcion
  // (en aleman los conceptos juridicos suelen ser compuestos largos).
  const fromSubarea = words(input.matter.subarea);
  const fromDescription = words(input.matter.description).sort((a, b) => b.length - a.length);
  const unique = [
    ...new Set([...fromSubarea, ...fromDescription].map((t) => t.toLowerCase())),
  ].slice(0, 6);
  const chambers = CHAMBERS_BY_AREA[input.matter.area] ?? [];
  return {
    why: "Las voces deben citar sentencias que hayan leido en texto oficial, no de memoria. Cada una se comprueba en validate_legal_council (campo authorities).",
    how: [
      "Use search_federal_cases con consultas cortas (una o dos palabras suelen dar mas resultados que frases), de una en una.",
      "Lea con fetch_official_swiss_case_full_text solo las pocas sentencias que encajen (el portal se consulta a ritmo lento).",
      "Cite en authorities el numero de expediente exacto, por ejemplo 8C_128/2017.",
    ],
    suggested_queries: unique,
    suggested_chambers: chambers,
    suggested_chamber_hint:
      chambers.length > 0
        ? `Para esta materia use el filtro chamber de search_federal_cases: ${chambers.join(" o ")}.`
        : "Sin sala sugerida para esta materia: pruebe sin filtro de sala.",
  };
}

export function prepareCouncil(input: CouncilCaseInput) {
  const text = [
    input.matter.description,
    ...input.facts.map((f) => f.description),
    ...input.objectives,
    ...input.myArguments,
    ...input.knownOpposingArguments,
  ].join(" ");
  const routes = selectProceduralRoutes({
    area: input.matter.area,
    subarea: input.matter.subarea,
    text,
    claimsText: input.objectives.join(" "),
  });
  const grounds = activatedGrounds(text);
  const hasDeadlines = routes.some((route) => route.deadlines.length > 0);
  const byStatus = (status: FactStatus) => input.facts.filter((f) => f.status === status);
  return {
    case_frame: {
      side: input.side,
      side_label: input.sideLabel ?? null,
      opposing_side: OPPOSING_LABEL[input.side],
      matter: input.matter,
      canton: input.canton ?? null,
      stage: input.stage ?? null,
      objectives: input.objectives,
      facts: {
        accepted: byStatus("accepted"),
        alleged: byStatus("alleged"),
        disputed: byStatus("disputed"),
        unknown: byStatus("unknown"),
      },
      missing_information: missingInformation(input, hasDeadlines),
    },
    verified_legal_material: {
      procedural_routes: routes.map((route) => ({
        id: route.id,
        summary: route.summary,
        rules: route.rules.map((rule) => ({
          provision: rule.provision,
          excerpt: rule.excerpt,
          considered_version: rule.consideredVersion,
          verified_on: rule.verifiedOn,
        })),
        deadlines: route.deadlines,
        notes: route.notes,
      })),
      known_grounds: grounds.map((ground) => ({
        id: ground.id,
        topic: ground.topic,
        summary: ground.summary,
        sources: ground.sources.map((s) => ({
          identifier: s.identifier,
          excerpt: s.excerpt,
          verified_on: s.verifiedOn,
        })),
        what_to_check: ground.whatToCheck,
        caveats: ground.caveats,
      })),
      note: "Solo es material YA verificado en una fuente oficial. Toda otra norma o sentencia que cite una voz debe pasar por verify_legal_citation o verify_review_findings y se revalida en validate_legal_council.",
    },
    voices: buildVoices(input),
    case_law_plan: caseLawPlan(input),
    cross_review_protocol: [
      "Cada voz trabaja por separado: no usa lo que dijo otra hasta esta fase.",
      "Cada voz critica, sin saber de quien es, el punto mas debil de las otras cuatro (campo cross_review del consejo).",
      "Se resumen solo las criticas que sobreviven.",
    ],
    synthesis_template: [
      "Tabla: voz, posicion en una frase, argumento mas fuerte, riesgo principal.",
      "Mi mejor argumento y el mejor argumento en mi contra (aunque se rechace).",
      "Opciones (recurrir, negociar, esperar, desistir) con ventajas, riesgos y costes, y la recomendada. Probabilidad solo alta/media/baja.",
      "Datos que, si resultaran falsos, cambiarian la recomendacion.",
      "Plan de pasos con plazos.",
      "Que parte NO esta verificada con texto oficial.",
    ],
    next_step:
      "Cada voz escribe su posicion con los campos de validate_legal_council (voice_id, position, outcome_leaning, confidence, arguments con norms/authorities/facts_used, risks). Despues llame a validate_legal_council con facts y council.",
    rules: [
      "Los hechos son solo los del caso; lo que falta se marca como dato que falta.",
      "Los jueces y el abogado contrario son perspectivas simuladas, no predicciones ni garantias.",
      "No sustituye la revision de un profesional.",
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Validacion
// ---------------------------------------------------------------------------------------------

export type NormVerdict = "verified" | "not_found" | "unavailable";

export interface CouncilArgument {
  readonly claim: string;
  readonly norms: readonly string[];
  readonly authorities: readonly string[];
  readonly factsUsed: readonly string[];
  readonly conditional: boolean;
}

export interface CouncilVoice {
  readonly voiceId: VoiceId;
  readonly position: string;
  readonly outcomeLeaning: "favorable_to_me" | "unfavorable_to_me" | "mixed";
  readonly confidence: "low" | "medium" | "high";
  readonly arguments: readonly CouncilArgument[];
  readonly risks: readonly string[];
}

export interface CouncilSynthesis {
  readonly recommendation?: string | undefined;
  readonly strongestArgumentAgainst?: string | undefined;
  readonly missingDataThatChangesRecommendation?: readonly string[] | undefined;
  readonly unverifiedParts?: readonly string[] | undefined;
}

export interface CouncilToValidate {
  readonly voices: readonly CouncilVoice[];
  readonly crossReview: readonly { reviewer: string; target: string; weakestPoint: string }[];
  readonly synthesis?: CouncilSynthesis | undefined;
}

export interface CouncilFlag {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly voice?: VoiceId;
  readonly detail: string;
}

const GUARANTEE_RE =
  /garantiz|seguro que (?:gan|prosper|vas a ganar)|sin duda alguna|\b100\s?%|certainly will win|wird sicher|garantiert|sicher gewinnen/i;
const ADVOCACY_RE =
  /mi cliente|nuestro cliente|nos conviene|mi mandante|unser mandant|meine mandantin|notre client/i;
const JUDGMENT_RE =
  /die beschwerde wird (?:abgewiesen|gutgeheissen)|se estima el recurso|se desestima el recurso|\bfallo:|wird gutgeheissen|wird abgewiesen/i;

export async function validateCouncil(
  council: CouncilToValidate,
  facts: readonly CouncilFact[],
  verifyNorm: (citation: string) => Promise<NormVerdict>,
  verifyAuthority?: (reference: string) => Promise<NormVerdict>,
) {
  const flags: CouncilFlag[] = [];
  const factById = new Map(facts.map((f) => [f.id, f]));
  const present = new Set(council.voices.map((v) => v.voiceId));
  for (const id of VOICE_IDS) {
    if (!present.has(id)) {
      flags.push({
        severity: "error",
        code: "voice_missing",
        voice: id,
        detail: `Falta la voz ${id}.`,
      });
    }
  }

  // Cada cita unica se comprueba una sola vez.
  const citations = [
    ...new Set(council.voices.flatMap((v) => v.arguments.flatMap((a) => a.norms))),
  ];
  const verdicts = new Map<string, NormVerdict>();
  for (const citation of citations) verdicts.set(citation, await verifyNorm(citation));

  // Las sentencias citadas (numero de expediente o BGE) tambien se comprueban: antes solo se
  // comprobaban las normas y una voz podia citar una sentencia inexistente sin ninguna advertencia.
  const authorityList = [
    ...new Set(council.voices.flatMap((v) => v.arguments.flatMap((a) => a.authorities))),
  ];
  const authorityVerdicts = new Map<string, NormVerdict>();
  for (const reference of authorityList) {
    authorityVerdicts.set(
      reference,
      verifyAuthority ? await verifyAuthority(reference) : "unavailable",
    );
  }

  const perVoice = council.voices.map((voice) => {
    let verifiedNorms = 0;
    let verifiedAuthorities = 0;
    let problems = 0;
    for (const argument of voice.arguments) {
      if (argument.norms.length === 0 && argument.authorities.length === 0) {
        problems += 1;
        flags.push({
          severity: "warning",
          code: "unsupported_argument",
          voice: voice.voiceId,
          detail: `Argumento sin norma ni sentencia: "${argument.claim.slice(0, 90)}"`,
        });
      }
      for (const norm of argument.norms) {
        const verdict = verdicts.get(norm);
        if (verdict === "verified") {
          verifiedNorms += 1;
        } else if (verdict === "not_found") {
          problems += 1;
          flags.push({
            severity: "error",
            code: "norm_not_found",
            voice: voice.voiceId,
            detail: `La norma "${norm}" no existe o no se encontro en la fuente oficial.`,
          });
        } else {
          problems += 1;
          flags.push({
            severity: "warning",
            code: "norm_unverified",
            voice: voice.voiceId,
            detail: `No se pudo verificar "${norm}" (fuente no disponible o ley sin identificador comprobado).`,
          });
        }
      }
      for (const authority of argument.authorities) {
        const verdict = authorityVerdicts.get(authority);
        if (verdict === "verified") {
          verifiedAuthorities += 1;
        } else if (verdict === "not_found") {
          problems += 1;
          flags.push({
            severity: "error",
            code: "authority_not_found",
            voice: voice.voiceId,
            detail: `La sentencia "${authority}" no se encontro en la fuente oficial.`,
          });
        } else {
          problems += 1;
          flags.push({
            severity: "warning",
            code: "authority_unverified",
            voice: voice.voiceId,
            detail: `No se pudo verificar la sentencia "${authority}" (fuente no disponible o pausa del portal).`,
          });
        }
      }
      for (const factId of argument.factsUsed) {
        const fact = factById.get(factId);
        if (!fact) {
          problems += 1;
          flags.push({
            severity: "error",
            code: "unknown_fact",
            voice: voice.voiceId,
            detail: `El argumento usa el hecho "${factId}", que no consta en el caso.`,
          });
        } else if (fact.status !== "accepted" && !argument.conditional) {
          problems += 1;
          flags.push({
            severity: "warning",
            code: "uncertain_fact_used_as_established",
            voice: voice.voiceId,
            detail: `El hecho ${factId} esta "${fact.status}" y se usa sin marcar el argumento como condicional.`,
          });
        }
      }
    }
    const isJudge = voice.voiceId.startsWith("judge_");
    if (isJudge && ADVOCACY_RE.test(voice.position)) {
      flags.push({
        severity: "warning",
        code: "role_leakage_advocacy_in_judge",
        voice: voice.voiceId,
        detail: "Una voz de juez habla como abogado de una parte.",
      });
    }
    if (!isJudge && JUDGMENT_RE.test(voice.position)) {
      flags.push({
        severity: "warning",
        code: "role_leakage_judgment_in_advocate",
        voice: voice.voiceId,
        detail: "Un abogado pronuncia un fallo como si fuera el tribunal.",
      });
    }
    if (GUARANTEE_RE.test(voice.position)) {
      flags.push({
        severity: "warning",
        code: "guarantee_language",
        voice: voice.voiceId,
        detail: "Lenguaje de certeza o garantia: solo se admite alta, media o baja.",
      });
    }
    if (voice.confidence === "high" && problems > 0) {
      flags.push({
        severity: "warning",
        code: "confidence_overstated",
        voice: voice.voiceId,
        detail: `Confianza alta con ${problems} problema(s) de verificacion o de soporte.`,
      });
    }
    return {
      voice_id: voice.voiceId,
      outcome_leaning: voice.outcomeLeaning,
      confidence: voice.confidence,
      arguments: voice.arguments.length,
      verified_norms: verifiedNorms,
      verified_authorities: verifiedAuthorities,
      problems,
    };
  });

  const favorable = council.voices.find((v) => v.voiceId === "judge_favorable");
  const strict = council.voices.find((v) => v.voiceId === "judge_strict");
  if (favorable && strict && favorable.outcomeLeaning === strict.outcomeLeaning) {
    flags.push({
      severity: "warning",
      code: "judges_not_differentiated",
      detail:
        "El juez favorable y el estricto llegan a la misma inclinacion: no estan estresando la posicion.",
    });
  }
  if (favorable && favorable.outcomeLeaning === "unfavorable_to_me") {
    flags.push({
      severity: "warning",
      code: "judge_favorable_unfavorable",
      voice: "judge_favorable",
      detail:
        "El juez favorable concluye en contra; revise si realmente lee los argumentos con buena fe.",
    });
  }

  if (council.crossReview.length < 3) {
    flags.push({
      severity: "warning",
      code: "cross_review_incomplete",
      detail: `Revision cruzada con ${council.crossReview.length} critica(s); se esperan al menos 3.`,
    });
  }

  const citedAuthorities = council.voices.flatMap((voice) =>
    voice.arguments.flatMap((argument) => argument.authorities),
  );
  if (citedAuthorities.length === 0) {
    flags.push({
      severity: "warning",
      code: "no_authorities_cited",
      detail:
        "Ninguna voz cita jurisprudencia. Siga el case_law_plan de prepare_legal_council: busque y lea sentencias reales y citelas en authorities con su numero de expediente. Sin ellas, el consejo se apoya solo en las normas.",
    });
  }

  const synthesis = council.synthesis;
  if (!synthesis) {
    flags.push({ severity: "error", code: "synthesis_missing", detail: "Falta la sintesis." });
  } else {
    if (!synthesis.recommendation) {
      flags.push({
        severity: "error",
        code: "synthesis_missing_recommendation",
        detail: "La sintesis no recomienda nada.",
      });
    }
    if (!synthesis.strongestArgumentAgainst) {
      flags.push({
        severity: "error",
        code: "synthesis_missing_strongest_dissent",
        detail: "La sintesis oculta el mejor argumento en contra.",
      });
    }
    if (!synthesis.missingDataThatChangesRecommendation?.length) {
      flags.push({
        severity: "warning",
        code: "synthesis_missing_kill_switches",
        detail: "Falta indicar que datos cambiarian la recomendacion.",
      });
    }
    if (!synthesis.unverifiedParts) {
      flags.push({
        severity: "warning",
        code: "synthesis_missing_unverified_parts",
        detail: "Falta indicar que parte no esta verificada con texto oficial.",
      });
    }
    if (synthesis.recommendation && GUARANTEE_RE.test(synthesis.recommendation)) {
      flags.push({
        severity: "warning",
        code: "guarantee_language",
        detail: "La recomendacion usa lenguaje de certeza.",
      });
    }
  }

  const leanings = council.voices.map((v) => v.outcomeLeaning);
  const count = (l: string) => leanings.filter((x) => x === l).length;
  const tally = {
    favorable_to_me: count("favorable_to_me"),
    unfavorable_to_me: count("unfavorable_to_me"),
    mixed: count("mixed"),
  };
  const majority = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mixed";
  const dissenters = perVoice
    .filter((v) => v.outcome_leaning !== majority)
    .sort(
      (a, b) =>
        b.verified_norms + b.verified_authorities - (a.verified_norms + a.verified_authorities),
    );
  const errors = flags.filter((f) => f.severity === "error").length;
  const warnings = flags.filter((f) => f.severity === "warning").length;
  return {
    status: errors === 0 ? (warnings === 0 ? "ready" : "ready_with_warnings") : "needs_work",
    errors,
    warnings,
    flags,
    voices: perVoice,
    disagreement_matrix: {
      tally,
      majority_leaning: majority,
      strongest_dissent: dissenters[0] ?? null,
      dissenting_voices: dissenters.map((d) => d.voice_id),
    },
    verified_authorities: [...authorityVerdicts.entries()]
      .filter(([, v]) => v === "verified")
      .map(([k]) => k),
    unverified_authorities: [...authorityVerdicts.entries()]
      .filter(([, v]) => v !== "verified")
      .map(([k, v]) => ({ reference: k, verdict: v })),
    verified_norms: [...verdicts.entries()].filter(([, v]) => v === "verified").map(([k]) => k),
    unverified_norms: [...verdicts.entries()]
      .filter(([, v]) => v !== "verified")
      .map(([k, v]) => ({ citation: k, verdict: v })),
    note: "Valida forma, verificacion de normas, uso de hechos y coherencia de papeles. No valora si la estrategia es juridicamente acertada: eso lo decide un profesional.",
  };
}
