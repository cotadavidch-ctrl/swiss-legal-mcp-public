import { describe, expect, it } from "vitest";
import { authorityVerdictFromWarnings } from "../src/tools/legalCouncilTools.js";
import {
  prepareCouncil,
  validateCouncil,
  VOICE_IDS,
  type CouncilToValidate,
  type CouncilVoice,
  type NormVerdict,
} from "../src/tools/legalCouncil.js";

const FACTS = [
  {
    id: "f1",
    description: "Compra de la vivienda el 15 de marzo de 2024",
    status: "accepted" as const,
  },
  {
    id: "f2",
    description: "El vendedor tapo la humedad con pintura en 2023",
    status: "alleged" as const,
  },
  {
    id: "f3",
    description: "No consta la fecha de notificacion de la sentencia",
    status: "unknown" as const,
  },
];

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    side: "claimant" as const,
    matter: {
      area: "civil",
      subarea: "Grundstückkauf, Sachgewährleistung",
      description:
        "Compra de vivienda con defectos de construccion, CHF 98 500, recurso al Bundesgericht",
    },
    canton: "BE",
    facts: FACTS,
    objectives: ["Reduccion de precio o indemnizacion de CHF 98 500"],
    myArguments: [],
    knownOpposingArguments: [],
    ...overrides,
  };
}

function voice(id: CouncilVoice["voiceId"], overrides: Partial<CouncilVoice> = {}): CouncilVoice {
  return {
    voiceId: id,
    position: "Posicion razonada de la voz.",
    outcomeLeaning: "mixed",
    confidence: "medium",
    risks: [],
    arguments: [
      {
        claim: "Argumento con soporte",
        norms: ["Art. 210 Abs. 6 OR"],
        authorities: [],
        factsUsed: ["f1"],
        conditional: false,
      },
    ],
    ...overrides,
  };
}

function fullCouncil(overrides: Partial<CouncilToValidate> = {}): CouncilToValidate {
  return {
    voices: [
      voice("my_advocate", { outcomeLeaning: "favorable_to_me" }),
      voice("opposing_counsel", { outcomeLeaning: "unfavorable_to_me" }),
      voice("judge_favorable", { outcomeLeaning: "favorable_to_me" }),
      voice("judge_strict", { outcomeLeaning: "unfavorable_to_me" }),
      voice("judge_neutral", { outcomeLeaning: "mixed" }),
    ],
    crossReview: [
      { reviewer: "a", target: "b", weakestPoint: "x" },
      { reviewer: "b", target: "c", weakestPoint: "y" },
      { reviewer: "c", target: "d", weakestPoint: "z" },
    ],
    synthesis: {
      recommendation: "Recurrir si se acredita el aviso de defectos.",
      strongestArgumentAgainst: "La prescripcion si no hubo engaño.",
      missingDataThatChangesRecommendation: ["Fecha de notificacion"],
      unverifiedParts: ["Hecho f2"],
    },
    ...overrides,
  };
}

const allVerified = async (): Promise<NormVerdict> => "verified";

describe("prepareCouncil", () => {
  it("entrega las cinco voces con encargo y prohibiciones", () => {
    const out = prepareCouncil(baseInput());
    expect(out.voices.map((v) => v.voice_id)).toEqual([...VOICE_IDS]);
    for (const v of out.voices) {
      expect(v.must_answer.length).toBeGreaterThan(0);
      expect(v.must_not.length).toBeGreaterThan(0);
    }
  });

  it("nombra a la parte contraria segun el lado del usuario", () => {
    expect(prepareCouncil(baseInput({ side: "claimant" })).case_frame.opposing_side).toContain(
      "demandada",
    );
    expect(prepareCouncil(baseInput({ side: "insured" })).case_frame.opposing_side).toContain(
      "aseguradora",
    );
    expect(prepareCouncil(baseInput({ side: "taxpayer" })).case_frame.opposing_side).toContain(
      "administracion tributaria",
    );
  });

  it("incluye el material verificado de la via procesal con extractos literales", () => {
    const out = prepareCouncil(baseInput());
    const routes = out.verified_legal_material.procedural_routes;
    expect(routes.map((r) => r.id)).toEqual(
      expect.arrayContaining(["civil-claim", "sale-defects", "federal-appeal"]),
    );
    const provisions = routes.flatMap((r) => r.rules.map((rule) => rule.provision));
    expect(provisions).toContain("Art. 210 Abs. 6 OR");
    expect(out.verified_legal_material.note).toContain("YA verificado");
  });

  it("separa los hechos por estado y senala lo que falta", () => {
    const out = prepareCouncil(baseInput({ stage: undefined }));
    expect(out.case_frame.facts.accepted).toHaveLength(1);
    expect(out.case_frame.facts.alleged).toHaveLength(1);
    expect(out.case_frame.facts.unknown).toHaveLength(1);
    const missing = out.case_frame.missing_information.join(" ");
    expect(missing).toContain("Hecho sin estado claro (f3)");
    expect(missing).toContain("Fecha de notificacion");
    expect(missing).toContain("Fase del procedimiento");
  });

  it("incluye un plan de jurisprudencia con consultas utiles y la sala segun la materia", () => {
    const plan = prepareCouncil(
      baseInput({
        matter: {
          area: "civil",
          subarea: "Werkvertrag, Mängelhaftung",
          description:
            "Klage auf CHF 31 200 wegen Mängeln abgewiesen, verspätete Mängelrüge, Berufung",
        },
      }),
    ).case_law_plan;
    // terminos de la materia primero; sin palabras vacias como "klage", "wegen" o "abgewiesen"
    expect(plan.suggested_queries.slice(0, 2)).toEqual(["werkvertrag", "mängelhaftung"]);
    for (const useless of ["klage", "wegen", "abgewiesen"]) {
      expect(plan.suggested_queries).not.toContain(useless);
    }
    expect(plan.suggested_queries).toContain("mängelrüge");
    expect(plan.suggested_chambers).toEqual(["I_civil_law", "II_civil_law"]);
    expect(JSON.stringify(plan.suggested_queries)).not.toMatch(/\b\d[A-Z]_\d+\/\d{4}\b/);
  });

  it("la sala sugerida cambia con la materia", () => {
    const chambers = (area: string) =>
      prepareCouncil(baseInput({ matter: { area, description: "Streit um Leistungen" } }))
        .case_law_plan.suggested_chambers;
    expect(chambers("social-insurance")).toEqual(["I_social_law", "II_social_law"]);
    expect(chambers("criminal")).toEqual(["criminal_law"]);
    expect(chambers("employment")).toEqual(["I_civil_law"]);
    expect(chambers("other")).toEqual([]);
  });

  it("sin hechos ni objetivos lo dice, no lo inventa", () => {
    const out = prepareCouncil(baseInput({ facts: [], objectives: [] }));
    const missing = out.case_frame.missing_information.join(" ");
    expect(missing).toContain("no se ha indicado ninguno");
    expect(missing).toContain("Lo que se quiere conseguir");
  });
});

describe("validateCouncil", () => {
  it("un consejo completo, con normas y sentencias verificadas y sintesis completa, sale 'ready'", async () => {
    const council = fullCouncil({
      voices: fullCouncil().voices.map((v) =>
        v.voiceId === "my_advocate"
          ? {
              ...v,
              arguments: [{ ...v.arguments[0]!, authorities: ["4A_1/2020"] }],
            }
          : v,
      ),
    });
    const out = await validateCouncil(council, FACTS, allVerified, allVerified);
    expect(out.status).toBe("ready");
    expect(out.errors).toBe(0);
    expect(out.verified_norms).toEqual(["Art. 210 Abs. 6 OR"]);
    expect(out.verified_authorities).toEqual(["4A_1/2020"]);
  });

  it("sin ninguna sentencia citada avisa y no sale 'ready'", async () => {
    const out = await validateCouncil(fullCouncil(), FACTS, allVerified);
    expect(
      out.flags.some((f) => f.code === "no_authorities_cited" && f.severity === "warning"),
    ).toBe(true);
    expect(out.status).toBe("ready_with_warnings");
  });

  it("detecta voces que faltan y una sintesis ausente", async () => {
    const council = fullCouncil({ voices: [voice("my_advocate")], synthesis: undefined });
    const out = await validateCouncil(council, FACTS, allVerified);
    expect(out.status).toBe("needs_work");
    const codes = out.flags.map((f) => f.code);
    expect(codes.filter((c) => c === "voice_missing")).toHaveLength(4);
    expect(codes).toContain("synthesis_missing");
  });

  it("marca como error una norma inexistente y como aviso una no verificable", async () => {
    const council = fullCouncil({
      voices: fullCouncil().voices.map((v) =>
        v.voiceId === "my_advocate"
          ? {
              ...v,
              arguments: [
                {
                  claim: "a",
                  norms: ["Art. 5000 OR"],
                  authorities: [],
                  factsUsed: [],
                  conditional: false,
                },
                {
                  claim: "b",
                  norms: ["Art. 3 XYZ"],
                  authorities: [],
                  factsUsed: [],
                  conditional: false,
                },
              ],
            }
          : v,
      ),
    });
    const verify = async (citation: string): Promise<NormVerdict> =>
      citation === "Art. 5000 OR"
        ? "not_found"
        : citation === "Art. 3 XYZ"
          ? "unavailable"
          : "verified";
    const out = await validateCouncil(council, FACTS, verify);
    expect(out.flags.some((f) => f.code === "norm_not_found" && f.severity === "error")).toBe(true);
    expect(out.flags.some((f) => f.code === "norm_unverified" && f.severity === "warning")).toBe(
      true,
    );
    expect(out.status).toBe("needs_work");
  });

  it("detecta un hecho que no consta y un hecho alegado usado como establecido", async () => {
    const council = fullCouncil({
      voices: fullCouncil().voices.map((v) =>
        v.voiceId === "judge_strict"
          ? {
              ...v,
              arguments: [
                {
                  claim: "a",
                  norms: ["Art. 201 OR"],
                  authorities: [],
                  factsUsed: ["f99"],
                  conditional: false,
                },
                {
                  claim: "b",
                  norms: ["Art. 201 OR"],
                  authorities: [],
                  factsUsed: ["f2"],
                  conditional: false,
                },
                {
                  claim: "c",
                  norms: ["Art. 201 OR"],
                  authorities: [],
                  factsUsed: ["f2"],
                  conditional: true,
                },
              ],
            }
          : v,
      ),
    });
    const out = await validateCouncil(council, FACTS, allVerified);
    const codes = out.flags.map((f) => f.code);
    expect(codes).toContain("unknown_fact");
    expect(codes.filter((c) => c === "uncertain_fact_used_as_established")).toHaveLength(1);
  });

  it("detecta mezcla de papeles, lenguaje de certeza y confianza alta sin soporte", async () => {
    const council = fullCouncil({
      voices: fullCouncil().voices.map((v) => {
        if (v.voiceId === "judge_favorable") {
          return { ...v, position: "Nos conviene alegar la prescripcion porque mi cliente gana." };
        }
        if (v.voiceId === "my_advocate") {
          return {
            ...v,
            position: "Die Beschwerde wird gutgeheissen. Es seguro que ganaremos, garantizado.",
          };
        }
        if (v.voiceId === "judge_neutral") {
          return {
            ...v,
            confidence: "high" as const,
            arguments: [
              {
                claim: "sin soporte",
                norms: [],
                authorities: [],
                factsUsed: [],
                conditional: false,
              },
            ],
          };
        }
        return v;
      }),
    });
    const codes = (await validateCouncil(council, FACTS, allVerified)).flags.map((f) => f.code);
    expect(codes).toContain("role_leakage_advocacy_in_judge");
    expect(codes).toContain("role_leakage_judgment_in_advocate");
    expect(codes).toContain("guarantee_language");
    expect(codes).toContain("unsupported_argument");
    expect(codes).toContain("confidence_overstated");
  });

  it("avisa de jueces no diferenciados y de revision cruzada incompleta", async () => {
    const council = fullCouncil({
      voices: fullCouncil().voices.map((v) =>
        v.voiceId === "judge_strict" ? { ...v, outcomeLeaning: "favorable_to_me" as const } : v,
      ),
      crossReview: [{ reviewer: "a", target: "b", weakestPoint: "x" }],
    });
    const codes = (await validateCouncil(council, FACTS, allVerified)).flags.map((f) => f.code);
    expect(codes).toContain("judges_not_differentiated");
    expect(codes).toContain("cross_review_incomplete");
  });

  it("exige que la sintesis recomiende y no oculte el mejor argumento en contra", async () => {
    const council = fullCouncil({ synthesis: { unverifiedParts: [] } });
    const out = await validateCouncil(council, FACTS, allVerified);
    const codes = out.flags.map((f) => f.code);
    expect(codes).toContain("synthesis_missing_recommendation");
    expect(codes).toContain("synthesis_missing_strongest_dissent");
    expect(out.status).toBe("needs_work");
  });

  it("verifica las sentencias citadas: inexistente es error, no comprobable es aviso", async () => {
    const withAuthorities = (list: string[]) =>
      fullCouncil({
        voices: fullCouncil().voices.map((v) =>
          v.voiceId === "my_advocate"
            ? {
                ...v,
                arguments: [
                  {
                    claim: "a",
                    norms: ["Art. 210 Abs. 6 OR"],
                    authorities: list,
                    factsUsed: ["f1"],
                    conditional: false,
                  },
                ],
              }
            : v,
        ),
      });
    const verifyAuthority = async (ref: string): Promise<NormVerdict> =>
      ref === "4A_1/2020" ? "verified" : ref === "4A_999/2099" ? "not_found" : "unavailable";
    const out = await validateCouncil(
      withAuthorities(["4A_1/2020", "4A_999/2099", "BGE 1/1"]),
      FACTS,
      allVerified,
      verifyAuthority,
    );
    expect(out.verified_authorities).toEqual(["4A_1/2020"]);
    expect(out.unverified_authorities.map((a) => a.reference).sort()).toEqual([
      "4A_999/2099",
      "BGE 1/1",
    ]);
    expect(out.flags.some((f) => f.code === "authority_not_found" && f.severity === "error")).toBe(
      true,
    );
    expect(
      out.flags.some((f) => f.code === "authority_unverified" && f.severity === "warning"),
    ).toBe(true);
    expect(out.status).toBe("needs_work");
  });

  it("sin verificador de sentencias no inventa verificacion", async () => {
    const out = await validateCouncil(fullCouncil(), FACTS, allVerified);
    expect(out.verified_authorities).toEqual([]);
  });

  it("calcula la matriz de acuerdos y senala la discrepancia mas fuerte", async () => {
    const out = await validateCouncil(fullCouncil(), FACTS, allVerified);
    expect(out.disagreement_matrix.tally).toEqual({
      favorable_to_me: 2,
      unfavorable_to_me: 2,
      mixed: 1,
    });
    expect(out.disagreement_matrix.dissenting_voices.length).toBeGreaterThan(0);
    expect(out.disagreement_matrix.strongest_dissent).not.toBeNull();
  });
});

describe("authorityVerdictFromWarnings", () => {
  it("una sentencia sin ningun enlace en la respuesta del portal es 'not_found'", () => {
    expect(
      authorityVerdictFromWarnings([
        "document_fetch_failed",
        "redirect_to_search_page",
        "invalid_download_url",
        "no_exact_official_document_link_found",
      ]),
    ).toBe("not_found");
    expect(authorityVerdictFromWarnings(["source_not_found"])).toBe("not_found");
  });

  it("ante bloqueo, pausa o error de red nunca afirma que no existe", () => {
    for (const blocker of [
      "bger_cooldown_active",
      "bot_challenge",
      "request_timeout",
      "http_503",
    ]) {
      expect(
        authorityVerdictFromWarnings([
          "redirect_to_search_page",
          "no_exact_official_document_link_found",
          blocker,
        ]),
      ).toBe("unavailable");
    }
    expect(authorityVerdictFromWarnings([])).toBe("unavailable");
    expect(authorityVerdictFromWarnings(["document_fetch_failed"])).toBe("unavailable");
  });
});
