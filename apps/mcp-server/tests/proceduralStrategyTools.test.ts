import { describe, expect, it } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/registry.js";

const logger = createLogger({ level: "silent" });

async function buildClient() {
  const env = loadEnv({ NODE_ENV: "test" });
  const { providers, legislationProviders, tools } = buildRegistries(env);
  await Promise.all([providers.checkAllHealth(), legislationProviders.checkAllHealth()]);
  const server = createMcpServer({
    name: "swiss-legal-mcp-test",
    version: "0.0.0",
    tools,
    providers,
    legislationProviders,
    logger,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

function baseCase() {
  return {
    jurisdiction: { country: "CH", canton: "ZH" },
    matter: {
      area: "administrative",
      subarea: "permit",
      description: "Dispute about an administrative decision citing Art. 29 BV",
    },
    parties: [
      { role: "appellant", type: "natural_person", description: "Pseudonymized appellant A" },
      { role: "authority", type: "public_authority", description: "Cantonal authority" },
    ],
    facts: [
      {
        id: "fact-1",
        date: "2026-01-10",
        description: "The authority issued a decision",
        status: "accepted",
        sourceDocumentIds: ["fixture:case-2"],
      },
      {
        id: "fact-2",
        description: "The appellant filed all requested documents",
        status: "disputed",
      },
    ],
    proceduralHistory: [
      {
        date: "2026-01-10",
        authority: "Cantonal authority",
        action: "Decision issued",
        result: "Rejected request",
        documentId: "fixture:case-2",
      },
    ],
    challengedDecision: {
      authority: "Cantonal authority",
      decisionDate: "2026-01-10",
      notificationDate: "2026-01-13",
      reference: "synthetic-1",
      summary: "Synthetic adverse administrative decision",
      documentId: "fixture:case-2",
    },
    claims: [{ description: "Annul the decision", priority: "primary" }],
    availableEvidence: [
      {
        id: "evidence-1",
        type: "official-record",
        description: "Decision issued by the authority",
        date: "2026-01-10",
        documentId: "fixture:case-2",
        authenticity: "confirmed",
      },
      {
        id: "evidence-2",
        type: "email",
        description: "Communication about requested documents",
        authenticity: "unknown",
      },
    ],
    deadlines: [],
    objectives: ["annulment", "preserve-rights", "suspensive-effect"],
    constraints: {
      urgency: "high",
      representation: "self-represented",
      riskTolerance: "low",
      language: "de",
    },
    documents: [{ documentId: "fixture:case-2", documentType: "judgment" }],
    analysisDate: "2026-01-15",
  };
}

describe("analyze_procedural_strategy", () => {
  it("esta registrada en NODE_ENV=test y devuelve analisis conservador trazable", async () => {
    const client = await buildClient();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain("analyze_procedural_strategy");

    const result = await client.callTool({
      name: "analyze_procedural_strategy",
      arguments: baseCase(),
    });

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      warnings: string[];
      sources: Array<{ providerId: string; documentIdentifier: string; extractionMethod: string }>;
      caseSummary: {
        allegedFacts: Array<{ id: string; status: string }>;
        uncertainFacts: Array<{ id: string; status: string }>;
      };
      deadlines: Array<{ calculationStatus: string; warnings: string[] }>;
      evidenceAssessment: Array<{ evidenceId: string; strength: string }>;
      caseLawAnalysis: { limitations: string[] };
      recommendedStrategy: { immediateActions: string[]; argumentsToAvoid: string[] };
      trace: { guardrails: string[]; loadedDocuments: Array<{ status: string }> };
      confidence: Record<string, number>;
    };

    expect(structured.sources[0]).toMatchObject({
      providerId: "fixture",
      documentIdentifier: "fixture-case-2",
    });
    expect(
      structured.deadlines.some((deadline) => deadline.calculationStatus === "cannot_calculate"),
    ).toBe(true);
    expect(structured.warnings).toContain("uncertain_deadline");
    expect(
      structured.evidenceAssessment.find((item) => item.evidenceId === "evidence-2")?.strength,
    ).toBe("unknown");
    expect(structured.caseSummary.allegedFacts).toEqual([]);
    expect(structured.caseSummary.uncertainFacts).toEqual([]);
    expect(structured.caseLawAnalysis.limitations).toContain("insufficient_case_law");
    expect(structured.recommendedStrategy.argumentsToAvoid).toContain(
      "unsupported_factual_assertions",
    );
    expect(structured.trace.guardrails).toContain("no_invented_deadlines");
    expect(structured.trace.loadedDocuments[0]?.status).toBe("loaded");
    expect(structured.confidence.deadline).toBeLessThan(0.5);
  });

  it("preserva hechos alegados e inciertos con su clasificacion", async () => {
    const client = await buildClient();
    const input = {
      ...baseCase(),
      facts: [
        ...baseCase().facts,
        {
          id: "fact-alleged",
          description: "The appellant alleges that a transit bank account was counted twice",
          status: "alleged",
        },
        {
          id: "fact-uncertain",
          description: "The final bank balance is not confirmed by the fixture",
          status: "uncertain",
        },
      ],
    };

    const result = await client.callTool({
      name: "analyze_procedural_strategy",
      arguments: input,
    });
    const structured = result.structuredContent as {
      caseSummary: {
        allegedFacts: Array<{ id: string; status: string }>;
        uncertainFacts: Array<{ id: string; status: string }>;
      };
    };

    expect(structured.caseSummary.allegedFacts).toContainEqual(
      expect.objectContaining({ id: "fact-alleged", status: "alleged" }),
    );
    expect(structured.caseSummary.uncertainFacts).toContainEqual(
      expect.objectContaining({ id: "fact-uncertain", status: "uncertain" }),
    );
  });

  it("rechaza claves top-level desconocidas", async () => {
    const client = await buildClient();

    const result = await client.callTool({
      name: "analyze_procedural_strategy",
      arguments: { ...baseCase(), unexpectedField: "must-not-be-accepted" },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.type === "text" ? result.content[0].text : "").toContain(
      "Unrecognized key",
    );
  });

  it("marca documentos faltantes y corpus insuficiente sin inventar fuentes", async () => {
    const client = await buildClient();
    const input = {
      ...baseCase(),
      documents: [{ documentId: "fixture:no-such-document", documentType: "decision" }],
      availableEvidence: [],
    };

    const result = await client.callTool({
      name: "analyze_procedural_strategy",
      arguments: input,
    });
    const structured = result.structuredContent as {
      warnings: string[];
      missingInformation: string[];
      trace: { loadedDocuments: Array<{ status: string }> };
    };

    expect(structured.trace.loadedDocuments[0]?.status).toBe("not_found");
    expect(structured.warnings).toContain("missing_documents");
    expect(structured.missingInformation).toContain("evidence_inventory");
  });

  it("mantiene get_transitional_provisions fuera del registro", async () => {
    const client = await buildClient();
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).not.toContain("get_transitional_provisions");
  });

  it("confirma plazos suministrados sin calcular plazos no soportados", async () => {
    const client = await buildClient();
    const input = {
      ...baseCase(),
      deadlines: [
        {
          description: "User-supplied social insurance appeal deadline",
          date: "2026-02-12",
          basis: "External counsel calculation supplied by user",
          confirmed: true,
        },
      ],
      matter: {
        area: "social-insurance",
        subarea: "invalidity insurance",
        description: "Fixture social insurance decision with confirmed user-supplied deadline",
      },
    };

    const result = await client.callTool({
      name: "analyze_procedural_strategy",
      arguments: input,
    });
    const structured = result.structuredContent as {
      deadlines: Array<{ calculationStatus: string; calculatedDate: string | null }>;
      warnings: string[];
      confidence: Record<string, number>;
    };

    expect(structured.deadlines).toEqual([
      expect.objectContaining({ calculationStatus: "confirmed", calculatedDate: "2026-02-12" }),
    ]);
    expect(structured.warnings).not.toContain("uncertain_deadline");
    expect(structured.confidence.deadline).toBeGreaterThanOrEqual(0.65);
  });

  it("diferencia rutas de deuda y medidas suspensivas sin afirmar competencia definitiva", async () => {
    const client = await buildClient();
    const input = {
      ...baseCase(),
      matter: {
        area: "debt-enforcement",
        subarea: "opposition",
        description: "Debt enforcement opposition and legal opening route",
      },
      objectives: ["preserve-rights", "suspensive-effect"],
      challengedDecision: undefined,
      deadlines: [],
    };

    const result = await client.callTool({
      name: "analyze_procedural_strategy",
      arguments: input,
    });
    const structured = result.structuredContent as {
      jurisdictionAndCompetence: { likelyAuthorityOrCourt: string; confidence: number };
      admissibility: { appealableAct: { status: string } };
      trace: { issues: Array<{ id: string; status: string }> };
    };

    expect(structured.jurisdictionAndCompetence.likelyAuthorityOrCourt).toContain(
      "Rechtsvorschlag",
    );
    expect(structured.jurisdictionAndCompetence.confidence).toBeLessThan(0.6);
    expect(structured.admissibility.appealableAct.status).toBe("insufficient_information");
    expect(structured.trace.issues).toContainEqual(
      expect.objectContaining({ id: "suspensive_effect", status: "applicable" }),
    );
  });

  it("estructura comparabilidad jurisprudencial y deber de aclaracion para AJG sin convertir analogias en precedente directo", async () => {
    const client = await buildClient();
    const input = {
      ...baseCase(),
      jurisdiction: { country: "CH", canton: "GE" },
      matter: {
        area: "administrative",
        subarea: "assistance juridique gratuite",
        description:
          "AJG legal aid Art. 29 Abs. 3 BV with transfer between own accounts, same titular, same amount traceable, zero final balance, apparent third account and citations 1B_352/2019, 4A_97/2026, 9C_785/2018",
      },
      facts: [
        {
          id: "transfer-1",
          description:
            "The applicant transferred the same amount between own accounts with the same holder.",
          status: "alleged",
        },
        {
          id: "transfer-2",
          description:
            "The intermediate account had zero final balance and the authority saw an apparent third account.",
          status: "disputed",
        },
        {
          id: "transfer-3",
          description:
            "There is a visible contradiction and risk of double-counting assets, but the request and prior warnings must be verified.",
          status: "uncertain",
        },
      ],
      availableEvidence: [
        {
          id: "bank-1",
          type: "bank-record",
          description: "Bank statements showing same amount and zero final balance",
          authenticity: "confirmed",
        },
      ],
      constraints: {
        urgency: "high",
        representation: "self-represented",
        riskTolerance: "low",
        language: "de",
      },
    };

    const result = await client.callTool({
      name: "analyze_procedural_strategy",
      arguments: input,
    });
    const structured = result.structuredContent as {
      legalAidClarification: {
        unbeholfenAssessment: { status: string; warnings: string[] };
        proceduralLawBasis: {
          art29Abs3Bv: string;
          mitwirkungspflicht: string;
          art56Zpo: string;
          cantonalProceduralLaw: string;
          strategicInference: string;
        };
        evidentiaryPosture: {
          category: string;
          doubleCountingRisk: boolean;
          clarificationDuty: string;
        };
        mandatoryCounterargument: string;
      };
      caseLawAnalysis: {
        structuredComparability: Array<{
          verification: { reference: string; status: string };
          comparability: {
            classification: string;
            dimensions: {
              sameMatter: boolean;
              sameLegalQuestion: boolean;
              sameRatioDecidendi: boolean;
              limitsAndDifferences: string[];
            };
            judicialContent: {
              factsEstablished: string[];
              partyAllegations: string[];
              lowerAuthorityReasoning: string[];
              decidingCourtReasoning: string[];
              ratioDecidendi: string[];
            };
          };
        }>;
      };
      warnings: string[];
      trace: { guardrails: string[] };
    };

    expect(structured.legalAidClarification.unbeholfenAssessment.status).toBe("not_automatic");
    expect(structured.legalAidClarification.evidentiaryPosture).toMatchObject({
      category: "clarifiable_ambiguity_with_double_counting_risk",
      doubleCountingRisk: true,
      clarificationDuty: "arguable",
    });
    expect(structured.legalAidClarification.proceduralLawBasis).toMatchObject({
      art29Abs3Bv: "potentially_relevant_for_legal_aid",
      mitwirkungspflicht: "must_be_addressed",
      art56Zpo: "not_confirmed_direct_or_supplementary",
      cantonalProceduralLaw: "must_verify_GE",
    });
    expect(structured.legalAidClarification.mandatoryCounterargument).toContain(
      "Mitwirkungspflicht",
    );

    const byReference = new Map(
      structured.caseLawAnalysis.structuredComparability.map((entry) => [
        entry.verification.reference,
        entry,
      ]),
    );
    expect(byReference.get("1B_352/2019")?.verification.status).toBe("officially_verified");
    expect(byReference.get("1B_352/2019")?.comparability.classification).toBe("general_analogy");
    expect(byReference.get("4A_97/2026")?.comparability.classification).toBe("limited_analogy");
    expect(byReference.get("4A_97/2026")?.comparability.classification).not.toBe(
      "comparable_direct",
    );
    expect(byReference.get("9C_785/2018")?.comparability.classification).toBe("distinguishable");
    expect(byReference.get("9C_785/2018")?.comparability.dimensions.sameLegalQuestion).toBe(false);
    expect(
      byReference.get("4A_97/2026")?.comparability.judicialContent.ratioDecidendi.join(" "),
    ).toContain("formal authenticity");
    expect(structured.warnings).toContain("analogy_only");
    expect(structured.warnings).toContain("ratio_not_confirmed");
    expect(structured.trace.guardrails).toContain(
      "no_direct_comparability_from_lexical_overlap_only",
    );
    expect(structured.trace.guardrails).toContain(
      "separate_ratio_obiter_party_allegations_and_lower_court_reasoning",
    );
  });

  it("descompone jurisdiccion sin validar competencia concreta solo por pais CH", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "analyze_procedural_strategy",
      arguments: {
        ...baseCase(),
        jurisdiction: { country: "CH" },
        challengedDecision: undefined,
      },
    });
    const structured = result.structuredContent as {
      jurisdictionAndCompetence: {
        dimensions: Record<string, { status: string; value: unknown }>;
      };
    };
    expect(structured.jurisdictionAndCompetence.dimensions.country_legal_system?.status).toBe(
      "confirmed",
    );
    expect(structured.jurisdictionAndCompetence.dimensions.territorial_jurisdiction?.status).toBe(
      "not_verified",
    );
    expect(structured.jurisdictionAndCompetence.dimensions.functional_jurisdiction?.status).toBe(
      "not_verified",
    );
    expect(structured.jurisdictionAndCompetence.dimensions.appellate_authority?.status).toBe(
      "not_verified",
    );
  });
});
