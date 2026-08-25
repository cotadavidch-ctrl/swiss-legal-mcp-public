import { describe, expect, it } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/registry.js";
import { classifyCaseLawReference, formatSwissAmount } from "../src/tools/legalDraftingRules.js";

const logger = createLogger({ level: "silent" });
const draftingTools = [
  "draft_swiss_legal_document",
  "review_swiss_legal_document",
  "validate_procedural_requirements",
  "generate_rechtsbegehren",
  "build_evidence_index",
  "extract_challenged_passages",
  "build_rebuttal_matrix",
  "validate_swiss_legal_draft",
];

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

function baseDraft(overrides: Record<string, unknown> = {}) {
  return {
    jurisdiction: { country: "CH", canton: "ZH" },
    authority: {
      issuingAuthority: "Sozialbehörde Zürich",
      competentAuthority: "Bezirksrat Zürich",
      addressee: "Bezirksrat Zürich",
    },
    challengedAct: {
      type: "decision",
      decisionDate: "2026-07-01",
      notificationDate: "2026-07-03",
      reference: "BR-2026-1",
      summary:
        "Beschwerde betreffend unentgeltliche Rechtspflege und interne Übertragung zwischen eigenen Konten.",
      legalRemedyInstructionAvailable: true,
      legalRemedyInstruction: "Beschwerde innert 30 Tagen",
    },
    procedure: {
      requestedDocumentType: "Beschwerde",
      remedy: "Beschwerde",
      deadlineDate: "2026-08-02",
      suspensiveEffectRequested: true,
      language: "de",
      signatureRequired: true,
      filingRequirements: ["schriftlich", "begründet", "unterzeichnet"],
      copiesRequired: 2,
    },
    parties: [
      { role: "appellant", name: "A.", address: "[BITTE ERGÄNZEN]" },
      { role: "authority", name: "Sozialbehörde Zürich" },
    ],
    objectives: ["remand for new decision", "aufschiebende Wirkung", "unentgeltliche Rechtspflege"],
    claims: [
      {
        id: "claim-remand",
        description: "Rückweisung zur neuen Beurteilung wegen doppelter Berücksichtigung",
        priority: "main",
      },
      {
        id: "claim-legal-aid",
        description: "unentgeltliche Rechtspflege",
        priority: "procedural",
      },
    ],
    facts: [
      {
        id: "fact-transfer",
        description:
          "Der Betrag von CHF 2’650.00 wurde zwischen Konten desselben Inhabers übertragen.",
        status: "aktenkundig",
        date: "2026-06-10",
        amountChf: 2650,
        account: "Privatkonto",
        holder: "A.",
        evidenceIds: ["ev-origin", "ev-target"],
      },
      {
        id: "fact-zero",
        description: "Das Zwischenkonto wies nach der Übertragung einen Saldo von CHF 0.00 auf.",
        status: "aktenkundig",
        date: "2026-06-11",
        evidenceIds: ["ev-target"],
      },
    ],
    evidence: [
      {
        evidenceId: "ev-origin",
        name: "Kontoauszug Privatkonto",
        type: "bank_statement",
        date: "2026-06-10",
        issuer: "Bank",
        page: "2",
        attachment: "B1",
        provesFactIds: ["fact-transfer"],
        linkedClaimIds: ["claim-remand"],
        authenticity: "confirmed",
        source: "filed_record",
        admissibility: "likely",
        amountChf: 2650,
        account: "Privatkonto",
        holder: "A.",
      },
      {
        evidenceId: "ev-target",
        name: "Kontoauszug Sparkonto",
        type: "bank_statement",
        date: "2026-06-11",
        issuer: "Bank",
        page: "1",
        attachment: "B2",
        provesFactIds: ["fact-transfer", "fact-zero"],
        linkedClaimIds: ["claim-remand"],
        authenticity: "confirmed",
        source: "filed_record",
        admissibility: "likely",
        amountChf: 2650,
        account: "Sparkonto",
        holder: "A.",
        finalBalanceChf: 0,
      },
    ],
    attachments: [
      { id: "B1", label: "Beilage 1", evidenceId: "ev-origin" },
      { id: "B2", label: "Beilage 2", evidenceId: "ev-target" },
    ],
    challengedPassages: [
      {
        id: "ground-main",
        exactText: "Der Betrag von CHF 2’650.00 ist als zusätzliches Vermögen zu berücksichtigen.",
        sourceDocumentId: "decision-1",
        page: "3",
        consideration: "2.1",
        language: "de",
        author: "decision_authority",
        function: "evidence_assessment",
        importance: "decisive",
        autonomousGround: false,
        contextBefore: "Die Behörde würdigt die eingereichten Kontoauszüge.",
        contextAfter: "Das Gesuch wird abgewiesen.",
        quoteVerified: true,
      },
    ],
    citations: ["Art. 29 Abs. 3 BV"],
    caseLawReferences: ["4A_97/2026"],
    tone: "firm_respectful",
    detailLevel: "gerichtlich",
    languageProfile: "de-CH-legal",
    place: "Zürich",
    draftingDate: "2026-08-01",
    ...overrides,
  };
}

describe("legal drafting MCP tools", () => {
  it("registers all Swiss legal drafting tools in NODE_ENV=test", async () => {
    const client = await buildClient();
    const { tools } = await client.listTools();
    for (const tool of draftingTools) expect(tools.map((item) => item.name)).toContain(tool);
  });

  it.each([
    ["Einsprache administrative", "Einsprache", "Einsprache"],
    ["Beschwerde cantonal", "Beschwerde", "Beschwerde"],
    ["Gesuch um unentgeltliche Rechtspflege", "UnentgeltlicheRechtspflege", "Gesuch"],
    ["Fristerstreckungsgesuch", "Fristerstreckungsgesuch", "Fristerstreckungsgesuch"],
    ["Akteneinsichtsgesuch", "Akteneinsichtsgesuch", "Akteneinsichtsgesuch"],
    ["Rechtsvorschlag", "Rechtsvorschlag", "Rechtsvorschlag"],
    ["Carta extrajudicial", "AussergerichtlicheAufforderung", "aussergerichtliche Aufforderung"],
  ])("determines document profile for %s", async (_label, documentType, remedy) => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_procedural_requirements",
      arguments: baseDraft({
        procedure: { ...baseDraft().procedure, requestedDocumentType: documentType, remedy },
      }),
    });
    const structured = result.structuredContent as { documentType: string; confidence: number };
    expect(structured.documentType).toBe(documentType);
    expect(structured.confidence).toBeGreaterThan(0.5);
  });

  it("warns when procedural remedy is not confirmed", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_procedural_requirements",
      arguments: baseDraft({
        challengedAct: {
          type: "decision",
          decisionDate: "2026-07-01",
          notificationDate: "2026-07-03",
        },
        procedure: { requestedDocumentType: "Beschwerde", language: "de" },
      }),
    });
    const structured = result.structuredContent as { warnings: string[] };
    expect(structured.warnings).toContain("procedural_remedy_not_confirmed");
  });

  it("warns when deadline is not confirmed", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_procedural_requirements",
      arguments: baseDraft({
        procedure: { requestedDocumentType: "Beschwerde", remedy: "Beschwerde", language: "de" },
      }),
    });
    const structured = result.structuredContent as { warnings: string[] };
    expect(structured.warnings).toContain("deadline_not_confirmed");
  });

  it("does not invent missing essential data", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft({ authority: {}, challengedAct: {}, procedure: {} }),
    });
    const structured = result.structuredContent as {
      cleanDocument: string;
      warnings: string[];
      readyForFiling: boolean;
    };
    expect(structured.cleanDocument).toContain("[ZUSTÄNDIGE BEHÖRDE ZU PRÜFEN]");
    expect(structured.cleanDocument).toContain("[FRIST ZU PRÜFEN]");
    expect(structured.readyForFiling).toBe(false);
    expect(structured.warnings).toContain("competent_authority_not_confirmed");
  });

  it("keeps unofficial case law as warning material", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft({ caseLawReferences: ["AC/1124/2023"] }),
    });
    const structured = result.structuredContent as {
      controlReport: { sources: Array<{ sourceStatus: string }> };
      legal_drafting_check: { case_law: string };
    };
    expect(structured.controlReport.sources[0]?.sourceStatus).toBe("cantonal_aggregator_only");
    expect(structured.legal_drafting_check.case_law).toBe("warning");
  });

  it("does not put partial case law into the clean draft as decisive authority", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft({ citations: [], caseLawReferences: ["4A_114/2013"] }),
    });
    const structured = result.structuredContent as {
      cleanDocument: string;
      controlReport: {
        sources: Array<{
          reference: string;
          comparability: string;
          decisiveUseAllowed: boolean;
          warnings: string[];
        }>;
      };
    };
    expect(structured.controlReport.sources[0]?.reference).toBe("4A_114/2013");
    expect(structured.controlReport.sources[0]?.comparability).toBe("candidate_only");
    expect(structured.controlReport.sources[0]?.decisiveUseAllowed).toBe(false);
    expect(structured.controlReport.sources[0]?.warnings).toContain("full_text_not_read");
    expect(structured.cleanDocument).not.toContain("4A_114/2013");
  });

  it("keeps official source and aggregator trace for a covered Bundesgericht judgment", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft({ caseLawReferences: ["4A_97/2026"] }),
    });
    const structured = result.structuredContent as {
      controlReport: { sources: Array<{ sourceStatus: string; officialSource: string }> };
    };
    expect(structured.controlReport.sources[0]?.sourceStatus).toBe("officially_verified");
    expect(structured.controlReport.sources[0]?.officialSource).toContain("bger.ch");
  });

  it("extracts a verified literal quote with location", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "extract_challenged_passages",
      arguments: baseDraft(),
    });
    const structured = result.structuredContent as {
      passages: Array<{ exactText: string; quoteStatus: string; page: string }>;
    };
    expect(structured.passages[0]?.exactText).toContain("CHF 2’650.00");
    expect(structured.passages[0]?.quoteStatus).toBe("quote_verified_against_source");
    expect(structured.passages[0]?.page).toBe("3");
  });

  it("rejects adversarial promotion of open-question obiter as decisive autonomous ratio", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "extract_challenged_passages",
      arguments: baseDraft({
        challengedPassages: [
          {
            ...baseDraft().challengedPassages[0],
            id: "4C4-obiter",
            exactText:
              "Ob zwischen den Parteien eine einfache Gesellschaft bestand, kann offen gelassen werden.",
            function: "conclusion",
            importance: "decisive",
            autonomousGround: true,
            consideration: "4.2",
            contextBefore: "Das Bundesgericht prüft zunächst die verbindlichen Feststellungen.",
            contextAfter:
              "Selbst wenn eine einfache Gesellschaft angenommen würde, änderte dies am Ausgang nichts.",
            quoteVerified: true,
            quoteVerification: {
              quote_matches_user_input: true,
              quote_extracted_from_source: true,
              quote_verified_against_source: true,
              context_checked: true,
              source_location_verified: true,
              source_document_full_text_read: true,
            },
          },
        ],
      }),
    });
    const structured = result.structuredContent as {
      passages: Array<{
        caller_asserted_function: string;
        caller_asserted_importance: string;
        caller_asserted_autonomous_ground: boolean;
        function: string;
        importance: string;
        autonomousGround: boolean;
        verified_function: string;
        classification_status: string;
        semantic_conflicts: string[];
        classification_blockers: string[];
        necessary_for_dispositive: boolean;
        sufficient_for_dispositive: boolean;
      }>;
      warnings: string[];
    };
    const passage = structured.passages[0]!;
    expect(passage.caller_asserted_function).toBe("conclusion");
    expect(passage.caller_asserted_importance).toBe("decisive");
    expect(passage.caller_asserted_autonomous_ground).toBe(true);
    expect(passage.verified_function).toBe("obiter_dictum");
    expect(passage.function).toBe("obiter_dictum");
    expect(passage.importance).toBe("low");
    expect(passage.autonomousGround).toBe(false);
    expect(passage.classification_status).toBe("conflict_detected");
    expect(passage.semantic_conflicts).toEqual(
      expect.arrayContaining([
        "open_question_vs_decisive",
        "caller_assertion_vs_source_text",
        "obiter_vs_autonomous_ground",
      ]),
    );
    expect(passage.classification_blockers.length).toBeGreaterThan(0);
    expect(passage.necessary_for_dispositive).toBe(false);
    expect(passage.sufficient_for_dispositive).toBe(false);
    expect(structured.warnings).toContain("classification_conflict_detected");
  });

  it("does not present an unverified paraphrase as literal quote", async () => {
    const client = await buildClient();
    const input = baseDraft({
      challengedPassages: [
        {
          ...baseDraft().challengedPassages[0],
          exactText: "Die Behörde habe die Unterlagen ignoriert.",
          quoteVerified: false,
        },
      ],
    });
    const result = await client.callTool({ name: "extract_challenged_passages", arguments: input });
    const structured = result.structuredContent as {
      passages: Array<{ quoteStatus: string }>;
      warnings: string[];
    };
    expect(structured.passages[0]?.quoteStatus).toBe("quote_matches_user_input");
    expect(structured.warnings).toContain("quote_not_verified");
  });

  it("marks a sentence reproducing opposing-party allegations", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "extract_challenged_passages",
      arguments: baseDraft({
        challengedPassages: [
          {
            ...baseDraft().challengedPassages[0],
            author: "opposing_party",
            function: "allegation",
          },
        ],
      }),
    });
    const structured = result.structuredContent as { warnings: string[] };
    expect(structured.warnings).toContain("passage_is_party_allegation_not_authority_finding");
  });

  it("builds rebuttal for a passage contradicted by bank statements", async () => {
    const client = await buildClient();
    const result = await client.callTool({ name: "build_rebuttal_matrix", arguments: baseDraft() });
    const structured = result.structuredContent as {
      rebuttalMatrix: Array<{
        error_type: string;
        supporting_documents: string[];
        counterargument: string;
      }>;
    };
    expect(structured.rebuttalMatrix[0]?.error_type).toBe("unzulässige doppelte Berücksichtigung");
    expect(structured.rebuttalMatrix[0]?.supporting_documents).toContain("ev-origin");
    expect(structured.rebuttalMatrix[0]?.counterargument).toContain(
      "keinen zusätzlichen Vermögenszufluss",
    );
  });

  it("detects double counting of an internal transfer", async () => {
    const client = await buildClient();
    const result = await client.callTool({ name: "build_evidence_index", arguments: baseDraft() });
    const structured = result.structuredContent as {
      internalTransferAnalysis: { possible_double_counting: boolean; same_holder: boolean };
      warnings: string[];
    };
    expect(structured.internalTransferAnalysis.possible_double_counting).toBe(true);
    expect(structured.internalTransferAnalysis.same_holder).toBe(true);
    expect(structured.warnings).toContain("possible_double_counting");
  });

  it("detects intermediate account with zero final balance", async () => {
    const client = await buildClient();
    const result = await client.callTool({ name: "build_evidence_index", arguments: baseDraft() });
    const structured = result.structuredContent as {
      internalTransferAnalysis: { zero_final_balance_intermediate_account: boolean };
    };
    expect(structured.internalTransferAnalysis.zero_final_balance_intermediate_account).toBe(true);
  });

  it("detects explainable bank commission differences", async () => {
    const client = await buildClient();
    const input = baseDraft({
      evidence: [
        { ...baseDraft().evidence[0], amountChf: 2650 },
        { ...baseDraft().evidence[1], amountChf: 2638 },
      ],
    });
    const result = await client.callTool({ name: "build_evidence_index", arguments: input });
    const structured = result.structuredContent as {
      internalTransferAnalysis: { commission_difference_explainable: boolean };
      warnings: string[];
    };
    expect(structured.internalTransferAnalysis.commission_difference_explainable).toBe(true);
    expect(structured.warnings).toContain("bank_fee_difference_detected");
  });

  it("detects contradictory reasoning through unsupported conflicting requests", async () => {
    const client = await buildClient();
    const input = baseDraft({ objectives: ["annulment", "remand for new decision"] });
    const result = await client.callTool({ name: "generate_rechtsbegehren", arguments: input });
    const structured = result.structuredContent as { warnings: string[] };
    expect(structured.warnings).toContain("contradictory_requests");
  });

  it("detects two independent grounds and warns when one is not attacked", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "build_rebuttal_matrix",
      arguments: baseDraft({
        challengedPassages: [
          baseDraft().challengedPassages[0],
          {
            ...baseDraft().challengedPassages[0],
            id: "ground-alt",
            exactText:
              "Die fehlende Mitwirkung bildet eine selbständig tragende Eventualbegründung und führt ebenfalls zur Abweisung.",
            function: "alternative_ground",
            autonomousGround: true,
          },
        ],
      }),
    });
    const structured = result.structuredContent as {
      rebuttalMatrix: unknown[];
      warnings: string[];
    };
    expect(structured.rebuttalMatrix).toHaveLength(2);
    expect(structured.warnings).toContain("independent_ground_not_challenged");
  });

  it("fails validation when subsidiary autonomous ground is not attacked", async () => {
    const client = await buildClient();
    const input = baseDraft({
      challengedPassages: [
        {
          ...baseDraft().challengedPassages[0],
          id: "ground-sub",
          exactText:
            "Die fehlende Mitwirkung bildet eine selbständig tragende Eventualbegründung und führt ebenfalls zur Abweisung.",
          function: "alternative_ground",
          autonomousGround: true,
        },
      ],
    });
    const result = await client.callTool({
      name: "validate_swiss_legal_draft",
      arguments: { ...input, cleanDocument: "Beschwerde ohne Angriff auf Eventualbegründung." },
    });
    const structured = result.structuredContent as {
      checks: { independent_grounds: string };
      readyForFiling: boolean;
    };
    expect(structured.checks.independent_grounds).toBe("failed");
    expect(structured.readyForFiling).toBe(false);
  });

  it("flags a truncated quote that changes or lacks verification", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "extract_challenged_passages",
      arguments: baseDraft({
        challengedPassages: [
          {
            ...baseDraft().challengedPassages[0],
            exactText: "Der Betrag [...] ist zu berücksichtigen.",
            quoteVerified: false,
          },
        ],
      }),
    });
    const structured = result.structuredContent as { warnings: string[] };
    expect(structured.warnings).toContain("quote_not_verified");
  });

  it("flags unjustified use of willkuer", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "review_swiss_legal_document",
      arguments: {
        ...baseDraft({ citations: [] }),
        cleanDocument: "Die Behörde handelt willkürlich.",
      },
    });
    const structured = result.structuredContent as {
      warnings: string[];
      suggestedCorrections: string[];
    };
    expect(structured.warnings).toContain("unjustified_willkuer");
    expect(structured.suggestedCorrections).toContain(
      "lower_intensity_or_add_willkuer_standard_and_record_support",
    );
  });

  it("allows aktenwidrig when a concrete document contradicts the passage", async () => {
    const client = await buildClient();
    const result = await client.callTool({ name: "build_rebuttal_matrix", arguments: baseDraft() });
    const structured = result.structuredContent as {
      rebuttalMatrix: Array<{ error_type: string }>;
    };
    expect(structured.rebuttalMatrix[0]?.error_type).toBe("unzulässige doppelte Berücksichtigung");
  });

  it("warns when the attachment contradicting the decision is missing", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "build_evidence_index",
      arguments: baseDraft({
        attachments: [{ id: "B1", label: "Beilage 1", evidenceId: "ev-origin" }],
      }),
    });
    const structured = result.structuredContent as { warnings: string[] };
    expect(structured.warnings).toContain("cited_attachment_missing");
  });

  it("fails final validation for cited but nonexistent attachment", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_swiss_legal_draft",
      arguments: {
        ...baseDraft({ attachments: [] }),
        cleanDocument: "Beweis: Beilage 2.",
      },
    });
    const structured = result.structuredContent as { checks: { attachments: string } };
    expect(structured.checks.attachments).toBe("failed");
  });

  it("warns for request not supported by reasoning", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "generate_rechtsbegehren",
      arguments: baseDraft({ claims: [], objectives: ["aufschiebende Wirkung"] }),
    });
    const structured = result.structuredContent as { warnings: string[] };
    expect(structured.warnings).toContain("request_not_supported_by_reasoning");
  });

  it("marks Noven risk for new evidence", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "build_evidence_index",
      arguments: baseDraft({ evidence: [{ ...baseDraft().evidence[0], source: "new" }] }),
    });
    const structured = result.structuredContent as {
      evidenceIndex: Array<{ procedural_status: string; risk: string }>;
    };
    expect(structured.evidenceIndex[0]?.procedural_status).toBe("proposed_new_evidence");
    expect(structured.evidenceIndex[0]?.risk).toBe("noven_risk");
  });

  it("separates lower-instance findings from reviewing-court reasoning", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "extract_challenged_passages",
      arguments: baseDraft({
        challengedPassages: [
          {
            ...baseDraft().challengedPassages[0],
            author: "lower_instance",
            function: "fact",
          },
          {
            ...baseDraft().challengedPassages[0],
            id: "review",
            author: "reviewing_court",
            function: "legal_interpretation",
          },
        ],
      }),
    });
    const structured = result.structuredContent as {
      passages: Array<{ author: string; function: string }>;
    };
    expect(structured.passages.map((passage) => passage.author)).toEqual([
      "lower_instance",
      "reviewing_court",
    ]);
  });

  it("produces Swiss German text without eszett", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft(),
    });
    const structured = result.structuredContent as { cleanDocument: string };
    expect(structured.cleanDocument).not.toContain("ß");
  });

  it("uses Swiss legal terminology", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft(),
    });
    const structured = result.structuredContent as { cleanDocument: string };
    expect(structured.cleanDocument).toContain("Rechtsbegehren");
    expect(structured.cleanDocument).toContain("Beil");
  });

  it("keeps firm_respectful tone and avoids accusatory phrasing", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft(),
    });
    const structured = result.structuredContent as {
      cleanDocument: string;
      legal_drafting_check: { tone: string };
    };
    expect(structured.cleanDocument).not.toContain("absichtlich");
    expect(structured.legal_drafting_check.tone).toBe("passed");
  });

  it("separates clean document from control report", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft(),
    });
    const structured = result.structuredContent as {
      cleanDocument: string;
      controlReport: { human_legal_review_required: boolean };
    };
    expect(structured.cleanDocument).not.toContain("human_legal_review_required");
    expect(structured.controlReport.human_legal_review_required).toBe(true);
  });

  it("protects against invented filing data", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_swiss_legal_draft",
      arguments: {
        ...baseDraft(),
        cleanDocument: "Aktenzeichen 2026/999. IBAN CH1200000000000000000.",
      },
    });
    const structured = result.structuredContent as { checks: { invented_data: string } };
    expect(structured.checks.invented_data).toBe("failed");
  });

  it("extracts unverified passages from source text when no structured passages are supplied", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "extract_challenged_passages",
      arguments: baseDraft({
        challengedPassages: [],
        sourceText:
          "Die Gesuchstellerin behauptet, alle Unterlagen eingereicht zu haben. Zudem wäre das Gesuch mangels Mitwirkung abzuweisen.",
      }),
    });
    const structured = result.structuredContent as {
      passages: Array<{ id: string; quoteStatus: string; autonomousGround: boolean }>;
      warnings: string[];
    };
    expect(structured.passages).toHaveLength(2);
    expect(structured.passages[0]?.quoteStatus).toBe("quote_not_verified");
    expect(structured.passages[1]?.autonomousGround).toBe(false);
    expect(structured.passages[1]).toMatchObject({
      classification_status: "insufficient_context",
      sufficient_for_dispositive: false,
    });
    expect(structured.warnings).toContain("quote_not_verified");
  });

  it("reviews eszett, missing attachments and unconfirmed requirements with separate suggestions", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "review_swiss_legal_document",
      arguments: {
        ...baseDraft({ authority: {}, attachments: [] }),
        cleanDocument: "Die Vorinstanz muß Beilage 2 berücksichtigen. [BEILAGE FEHLT]",
      },
    });
    const structured = result.structuredContent as {
      suggestedCorrections: string[];
      warnings: string[];
    };
    expect(structured.suggestedCorrections).toContain("replace_eszett_with_ss");
    expect(structured.suggestedCorrections).toContain("add_missing_attachment_or_remove_reference");
    expect(structured.suggestedCorrections).toContain(
      "verify_procedural_requirements_before_filing",
    );
    expect(structured.warnings).toContain("swiss_orthography_failed");
  });

  it("does not flag willkuer when Art. 9 BV and confirmed record support are present", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_swiss_legal_draft",
      arguments: {
        ...baseDraft({ citations: ["Art. 9 BV"] }),
        cleanDocument:
          "Die Beweiswürdigung erweist sich als willkürlich, soweit sie dem bestätigten Kontoauszug widerspricht.",
      },
    });
    const structured = result.structuredContent as { warnings: string[]; checks: { tone: string } };
    expect(structured.warnings).not.toContain("unjustified_willkuer");
    expect(structured.checks.tone).toBe("passed");
  });

  it("marks case law check not_applicable when no case references are supplied", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_swiss_legal_draft",
      arguments: { ...baseDraft({ caseLawReferences: [] }), cleanDocument: "Sachlicher Entwurf." },
    });
    const structured = result.structuredContent as { checks: { case_law: string } };
    expect(structured.checks.case_law).toBe("not_applicable");
  });

  it("uses conservative default tones for settlement, extension and ordinary requests", async () => {
    const client = await buildClient();
    const settlement = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft({
        procedure: { ...baseDraft().procedure, requestedDocumentType: "Vergleichsvorschlag" },
        tone: undefined,
      }),
    });
    const extension = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft({
        procedure: { ...baseDraft().procedure, requestedDocumentType: "Fristerstreckungsgesuch" },
        tone: undefined,
      }),
    });
    const request = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft({
        procedure: { ...baseDraft().procedure, requestedDocumentType: "Gesuch" },
        tone: undefined,
      }),
    });

    expect(
      (settlement.structuredContent as { legal_drafting_check: { tone: string } })
        .legal_drafting_check.tone,
    ).toBe("passed");
    expect(
      (extension.structuredContent as { legal_drafting_check: { tone: string } })
        .legal_drafting_check.tone,
    ).toBe("passed");
    expect(
      (request.structuredContent as { legal_drafting_check: { tone: string } }).legal_drafting_check
        .tone,
    ).toBe("passed");
  });

  it("classifies record contradiction without internal-transfer double counting", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "build_rebuttal_matrix",
      arguments: baseDraft({
        evidence: [
          {
            ...baseDraft().evidence[0],
            type: "court_record",
            name: "Protokoll der Anhörung",
            linkedClaimIds: ["claim-remand"],
            amountChf: undefined,
            account: undefined,
            holder: undefined,
          },
        ],
        challengedPassages: [
          {
            ...baseDraft().challengedPassages[0],
            exactText: "Die Anhörung habe am 10. Juni 2026 nicht stattgefunden.",
            function: "fact",
          },
        ],
      }),
    });
    const structured = result.structuredContent as {
      rebuttalMatrix: Array<{ error_type: string; counterargument: string }>;
    };
    expect(structured.rebuttalMatrix[0]?.error_type).toBe("aktenwidrige Feststellung");
    expect(structured.rebuttalMatrix[0]?.counterargument).toContain("Widerspruch");
  });

  it("classifies unsupported legal interpretation as legal error without inventing proof", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "build_rebuttal_matrix",
      arguments: baseDraft({
        evidence: [],
        challengedPassages: [
          {
            ...baseDraft().challengedPassages[0],
            exactText: "Art. 29 BV verleiht keinen Anspruch auf rechtliches Gehör.",
            function: "legal_interpretation",
          },
        ],
      }),
    });
    const structured = result.structuredContent as {
      rebuttalMatrix: Array<{ error_type: string; counteranalysis: string; residual_risk: string }>;
    };
    expect(structured.rebuttalMatrix[0]?.error_type).toBe("unzutreffende rechtliche Würdigung");
    expect(structured.rebuttalMatrix[0]?.counteranalysis).toContain("Voraussetzungen");
    expect(structured.rebuttalMatrix[0]?.residual_risk).toBe("high");
  });

  it("does not let placeholders pass essential procedural checks", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_procedural_requirements",
      arguments: baseDraft({
        authority: { competentAuthority: "[NICHT BESTÄTIGT]" },
        challengedAct: {
          ...baseDraft().challengedAct,
          notificationDate: undefined,
          reference: "[BITTE ERGÄNZEN]",
        },
        procedure: {
          ...baseDraft().procedure,
          remedy: "[RECHTSMITTEL ZU PRÜFEN]",
          deadlineDate: "[FRIST ZU PRÜFEN]",
          filingRequirements: ["[BITTE ERGÄNZEN]"],
        },
      }),
    });
    const structured = result.structuredContent as {
      requirements: Record<string, { status: string }>;
      warnings: string[];
    };
    expect(structured.requirements.competent_authority?.status).toBe("not_verified");
    expect(structured.requirements.procedural_remedy?.status).toBe("not_verified");
    expect(structured.requirements.deadline?.status).toBe("not_verified");
    expect(structured.requirements.filing_requirements?.status).toBe("not_verified");
    expect(structured.warnings).toContain("competent_authority_not_confirmed");
  });

  it("keeps uncertain facts out of categorical drafting", async () => {
    const client = await buildClient();
    const uncertain = "Die Vorinstanz holte keinen vollständigen Kontoauszug ein.";
    const result = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft({
        facts: [{ id: "f-uncertain", description: uncertain, status: "uncertain" }],
      }),
    });
    const structured = result.structuredContent as {
      cleanDocument: string;
      controlReport: { factsUsed: unknown[]; unverifiedFacts: unknown[] };
    };
    expect(structured.controlReport.factsUsed).toHaveLength(0);
    expect(structured.controlReport.unverifiedFacts).toHaveLength(1);
    expect(structured.cleanDocument).toContain(
      `Soweit ersichtlich: ${uncertain} [NICHT VERIFIZIERT]`,
    );
    expect(structured.cleanDocument).not.toContain(`1. ${uncertain}\n`);
  });

  it("separates quote verification dimensions for user-supplied text without source", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "extract_challenged_passages",
      arguments: baseDraft({
        challengedPassages: [
          {
            ...baseDraft().challengedPassages[0],
            exactText: "Benutzerzitat ohne Quellabgleich.",
            quoteVerified: undefined,
            quoteVerification: { quote_matches_user_input: true },
          },
        ],
      }),
    });
    const structured = result.structuredContent as {
      passages: Array<{
        quoteStatus: string;
        quoteVerification: {
          quote_verified_against_source: boolean;
          source_document_full_text_read: boolean;
        };
      }>;
      warnings: string[];
    };
    expect(structured.passages[0]?.quoteStatus).toBe("quote_matches_user_input");
    expect(structured.passages[0]?.quoteVerification.quote_verified_against_source).toBe(false);
    expect(structured.passages[0]?.quoteVerification.source_document_full_text_read).toBe(false);
    expect(structured.warnings).toContain("quote_not_verified");
  });

  it("does not use missing evidence as current support", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "build_rebuttal_matrix",
      arguments: baseDraft({
        evidence: [
          {
            ...baseDraft().evidence[0],
            proceduralStatus: "missing",
            authenticity: "unknown",
          },
        ],
      }),
    });
    const structured = result.structuredContent as {
      rebuttalMatrix: Array<{ supporting_documents: string[]; error_type: string }>;
      warnings: string[];
    };
    expect(structured.rebuttalMatrix[0]?.supporting_documents).toEqual([]);
    expect(structured.rebuttalMatrix[0]?.error_type).toBe("not_determined");
    expect(structured.warnings).toContain("evidence_missing");
  });

  it("traces all proposed Rechtsbegehren without silently dropping any", async () => {
    const client = await buildClient();
    const objectives = [
      "Aufhebung",
      "Gewährung der unentgeltlichen Rechtspflege",
      "Rückweisung",
      "Nachfrist",
      "Edition eines Kontoauszugs",
      "Kosten- und Entschädigungsfolgen",
    ];
    const result = await client.callTool({
      name: "generate_rechtsbegehren",
      arguments: baseDraft({ objectives }),
    });
    const structured = result.structuredContent as {
      requests: Array<{
        original_request: string;
        status: string;
        reason: string;
        retained_in_final_draft: boolean;
      }>;
    };
    for (const objective of objectives) {
      expect(
        structured.requests.some((request) => request.original_request.includes(objective)),
      ).toBe(true);
    }
    expect(structured.requests.every((request) => request.status && request.reason)).toBe(true);
  });

  it("does not diagnose unchallenged independent grounds without full decision text", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "build_rebuttal_matrix",
      arguments: baseDraft({
        challengedPassages: [
          {
            ...baseDraft().challengedPassages[0],
            id: "possible-ground",
            function: "alternative_ground",
            autonomousGround: true,
            quoteVerified: undefined,
            quoteVerification: { quote_matches_user_input: true },
          },
        ],
      }),
    });
    const structured = result.structuredContent as { warnings: string[] };
    expect(structured.warnings).toContain("independent_grounds_not_reviewed");
    expect(structured.warnings).not.toContain("independent_ground_not_challenged");
  });

  it("runs the bank drafting case end to end without silent state upgrades", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft({
        authority: { competentAuthority: "[NICHT BESTÄTIGT]" },
        procedure: {
          ...baseDraft().procedure,
          remedy: "[RECHTSMITTEL ZU PRÜFEN]",
          deadlineDate: "[FRIST ZU PRÜFEN]",
        },
        challengedAct: {
          ...baseDraft().challengedAct,
          notificationDate: undefined,
        },
        facts: [
          ...baseDraft().facts,
          {
            id: "authority_did_not_request_full_statement",
            description: "Die Vorinstanz holte keinen vollständigen Kontoauszug ein.",
            status: "uncertain",
          },
        ],
        evidence: [
          ...baseDraft().evidence,
          {
            evidenceId: "E3",
            name: "Angekündigter Kontoauszug",
            type: "bank_statement",
            proceduralStatus: "existence_not_confirmed",
            authenticity: "unknown",
            linkedClaimIds: ["claim-remand"],
          },
          {
            evidenceId: "E6",
            name: "Neuer Bankbeleg",
            type: "bank_statement",
            proceduralStatus: "noven_risk",
            authenticity: "confirmed",
            source: "new",
            linkedClaimIds: ["claim-remand"],
          },
        ],
        challengedPassages: [
          {
            ...baseDraft().challengedPassages[0],
            quoteVerified: undefined,
            quoteVerification: { quote_matches_user_input: true },
          },
          {
            ...baseDraft().challengedPassages[0],
            id: "possible-ground",
            function: "alternative_ground",
            autonomousGround: true,
            quoteVerified: undefined,
            quoteVerification: { quote_matches_user_input: true },
          },
        ],
        objectives: [
          "Aufhebung",
          "Gewährung der unentgeltlichen Rechtspflege",
          "Rückweisung",
          "Nachfrist",
          "Edition eines Kontoauszugs",
          "Kosten- und Entschädigungsfolgen",
        ],
        draftingDate: "2026-08-03",
      }),
    });
    const structured = result.structuredContent as {
      cleanDocument: string;
      readyForFiling: boolean;
      legal_drafting_check: Record<string, string>;
      controlReport: {
        rebuttals: Array<{
          quoteVerification: { quote_verified_against_source: boolean };
          supporting_documents: string[];
          error_type: string;
        }>;
        evidence: Array<{
          evidence_id: string;
          procedural_status: string;
          usable_as_current_support: boolean;
        }>;
        unverifiedFacts: unknown[];
      };
      warnings: string[];
    };
    expect(structured.readyForFiling).toBe(false);
    expect(structured.legal_drafting_check.competent_authority).toBe("not_verified");
    expect(structured.legal_drafting_check.procedural_remedy).toBe("not_verified");
    expect(structured.legal_drafting_check.deadline).toBe("not_verified");
    expect(structured.legal_drafting_check.notification_date).toBe("not_verified");
    expect(
      structured.controlReport.rebuttals[0]?.quoteVerification.quote_verified_against_source,
    ).toBe(false);
    expect(structured.warnings).toContain("independent_grounds_not_reviewed");
    expect(
      structured.controlReport.evidence.find((item) => item.evidence_id === "E3")
        ?.usable_as_current_support,
    ).toBe(false);
    expect(
      structured.controlReport.evidence.find((item) => item.evidence_id === "E6")
        ?.procedural_status,
    ).toBe("noven_risk");
    expect(structured.controlReport.unverifiedFacts).toHaveLength(1);
    expect(structured.cleanDocument).toContain("[NICHT VERIFIZIERT]");
    expect(structured.cleanDocument).toContain("[DATUM DER UNTERZEICHNUNG]");
    expect(structured.cleanDocument).toContain("[KOSTENANTRAG ZU PRÜFEN]");
  });

  it("does not treat country CH alone as concrete jurisdiction", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_procedural_requirements",
      arguments: baseDraft({
        jurisdiction: { country: "CH" },
        authority: {},
        procedure: { requestedDocumentType: "Beschwerde" },
      }),
    });
    const structured = result.structuredContent as {
      requirements: Record<string, { status: string }>;
      jurisdictionDimensions: Record<string, { status: string }>;
    };
    expect(structured.jurisdictionDimensions.country_legal_system?.status).toBe("confirmed");
    expect(structured.jurisdictionDimensions.territorial_jurisdiction?.status).toBe("not_verified");
    expect(structured.jurisdictionDimensions.subject_matter_jurisdiction?.status).toBe(
      "not_verified",
    );
    expect(structured.jurisdictionDimensions.functional_jurisdiction?.status).toBe("not_verified");
    expect(structured.requirements.jurisdiction?.status).toBe("not_verified");
  });

  it("keeps concrete jurisdiction unverified when canton is known but authority is missing", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_procedural_requirements",
      arguments: baseDraft({ authority: {}, jurisdiction: { country: "CH", canton: "ZH" } }),
    });
    const structured = result.structuredContent as {
      jurisdictionDimensions: Record<string, { status: string }>;
    };
    expect(structured.jurisdictionDimensions.territorial_jurisdiction?.status).toBe("confirmed");
    expect(structured.jurisdictionDimensions.appellate_authority?.status).toBe("not_verified");
    expect(structured.jurisdictionDimensions.functional_jurisdiction?.status).toBe("not_verified");
  });

  it("does not infer appellate authority from issuing authority", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_procedural_requirements",
      arguments: baseDraft({
        authority: { issuingAuthority: "Sozialbehörde Zürich" },
        jurisdiction: { country: "CH", canton: "ZH" },
      }),
    });
    const structured = result.structuredContent as {
      jurisdictionDimensions: Record<string, { status: string }>;
    };
    expect(structured.jurisdictionDimensions.issuing_authority?.status).toBe("confirmed");
    expect(structured.jurisdictionDimensions.appellate_authority?.status).toBe("not_verified");
  });

  it("keeps functional jurisdiction separate from territorial jurisdiction", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_procedural_requirements",
      arguments: baseDraft({
        authority: { issuingAuthority: "Sozialbehörde Zürich" },
        jurisdiction: {
          country: "CH",
          canton: "ZH",
          territorialJurisdiction: "ZH",
          subjectMatterJurisdiction: "Sozialhilfe",
        },
      }),
    });
    const structured = result.structuredContent as {
      jurisdictionDimensions: Record<string, { status: string }>;
    };
    expect(structured.jurisdictionDimensions.territorial_jurisdiction?.status).toBe("confirmed");
    expect(structured.jurisdictionDimensions.subject_matter_jurisdiction?.status).toBe("confirmed");
    expect(structured.jurisdictionDimensions.functional_jurisdiction?.status).toBe("not_verified");
  });

  it("marks all jurisdiction dimensions confirmed only when each concrete element is supplied", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_procedural_requirements",
      arguments: baseDraft({
        jurisdiction: {
          country: "CH",
          canton: "ZH",
          territorialJurisdiction: "ZH",
          subjectMatterJurisdiction: "Sozialhilfe",
          functionalJurisdiction: "Bezirksrat als Rechtsmittelinstanz",
          venueOrFilingDestination: "Bezirksrat Zürich",
        },
        authority: {
          issuingAuthority: "Sozialbehörde Zürich",
          competentAuthority: "Bezirksrat Zürich",
          appellateAuthority: "Bezirksrat Zürich",
          addressee: "Bezirksrat Zürich",
        },
      }),
    });
    const structured = result.structuredContent as {
      requirements: Record<string, { status: string }>;
      jurisdictionDimensions: Record<string, { status: string }>;
    };
    expect(
      Object.values(structured.jurisdictionDimensions).every((item) => item.status === "confirmed"),
    ).toBe(true);
    expect(structured.requirements.jurisdiction?.status).toBe("passed");
  });

  it("keeps placeholder authorities unverified", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_procedural_requirements",
      arguments: baseDraft({
        authority: {
          issuingAuthority: "[NICHT BESTÄTIGT]",
          competentAuthority: "[NICHT BESTÄTIGT]",
        },
      }),
    });
    const structured = result.structuredContent as {
      jurisdictionDimensions: Record<string, { status: string }>;
    };
    expect(structured.jurisdictionDimensions.issuing_authority?.status).toBe("not_verified");
    expect(structured.jurisdictionDimensions.appellate_authority?.status).toBe("not_verified");
  });

  it("flags contradiction between remedy and indicated appellate authority", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "validate_procedural_requirements",
      arguments: baseDraft({
        procedure: { ...baseDraft().procedure, remedy: "Rechtsvorschlag" },
        authority: {
          issuingAuthority: "Betreibungsamt Zürich",
          competentAuthority: "Bezirksrat Zürich",
        },
      }),
    });
    const structured = result.structuredContent as {
      jurisdictionDimensions: Record<string, { status: string }>;
      warnings: string[];
    };
    expect(structured.jurisdictionDimensions.functional_jurisdiction?.status).toBe("contradicted");
    expect(structured.jurisdictionDimensions.appellate_authority?.status).toBe("contradicted");
    expect(structured.warnings).toContain("functional_jurisdiction_contradicted");
  });

  it("separates user-asserted evidence from source-verified evidence", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "build_evidence_index",
      arguments: baseDraft({
        attachments: [],
        evidence: [
          {
            ...baseDraft().evidence[0],
            evidenceId: "E1",
            source: "filed_record",
            attachment: undefined,
            authenticity: "confirmed",
          },
        ],
      }),
    });
    const structured = result.structuredContent as {
      evidenceIndex: Array<Record<string, unknown>>;
    };
    expect(structured.evidenceIndex[0]?.assertion_source).toBe("user");
    expect(structured.evidenceIndex[0]?.existence_status).toBe("user_asserted");
    expect(structured.evidenceIndex[0]?.availability_status).toBe("referenced_but_not_available");
    expect(structured.evidenceIndex[0]?.content_verification_status).toBe("user_described_only");
    expect(structured.evidenceIndex[0]?.in_record_status).toBe("claimed_to_be_in_record");
    expect(structured.evidenceIndex[0]?.usable_as_current_support).toBe(false);
    expect(structured.evidenceIndex[0]?.reason).toBe("document_not_available_for_verification");
  });

  it("marks available attached evidence as verified current support", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "build_evidence_index",
      arguments: baseDraft({
        evidence: [
          { ...baseDraft().evidence[0], source: "filed_record", authenticity: "confirmed" },
        ],
      }),
    });
    const structured = result.structuredContent as {
      evidenceIndex: Array<Record<string, unknown>>;
    };
    expect(structured.evidenceIndex[0]?.availability_status).toBe("available_to_tool");
    expect(structured.evidenceIndex[0]?.content_verification_status).toBe(
      "verified_against_document",
    );
    expect(structured.evidenceIndex[0]?.in_record_status).toBe("in_record_confirmed");
    expect(structured.evidenceIndex[0]?.usable_as_current_support).toBe(true);
  });

  it("preserves new evidence as proposed with possible Noven issue", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "build_evidence_index",
      arguments: baseDraft({
        evidence: [
          {
            ...baseDraft().evidence[0],
            source: "new",
            proceduralStatus: "proposed_new_evidence",
            attachment: undefined,
          },
        ],
      }),
    });
    const structured = result.structuredContent as {
      evidenceIndex: Array<Record<string, unknown>>;
    };
    expect(structured.evidenceIndex[0]?.filing_status).toBe("proposed_new_evidence");
    expect(structured.evidenceIndex[0]?.noven_status).toBe("possible_noven");
    expect(structured.evidenceIndex[0]?.admissibility_status).toBe("noven_risk");
    expect(structured.evidenceIndex[0]?.usable_as_current_support).toBe(false);
  });

  it("runs the blind bank case with decomposed jurisdiction and evidence dimensions", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: baseDraft({
        jurisdiction: { country: "CH" },
        authority: {},
        procedure: {
          requestedDocumentType: "Beschwerde",
          language: "de",
          signatureRequired: true,
          filingRequirements: ["schriftlich", "begründet", "unterzeichnet"],
        },
        challengedAct: {
          type: "decision",
          decisionDate: "2026-07-01",
          summary: "Bankunterlagen und mögliche doppelte Berücksichtigung.",
        },
        attachments: [],
        evidence: [
          {
            ...baseDraft().evidence[0],
            evidenceId: "E1",
            attachment: undefined,
            source: "filed_record",
            authenticity: "confirmed",
          },
          {
            ...baseDraft().evidence[1],
            evidenceId: "E2",
            attachment: undefined,
            source: "filed_record",
            authenticity: "confirmed",
          },
          {
            evidenceId: "E3",
            name: "Nicht bestätigter Kontoauszug",
            type: "bank_statement",
            proceduralStatus: "existence_not_confirmed",
            linkedClaimIds: ["claim-remand"],
          },
          {
            evidenceId: "E6",
            name: "Neuer vollständiger Kontoauszug",
            type: "bank_statement",
            source: "new",
            proceduralStatus: "proposed_new_evidence",
            linkedClaimIds: ["claim-remand"],
          },
        ],
        draftingDate: "2026-08-04",
      }),
    });
    const structured = result.structuredContent as {
      cleanDocument: string;
      readyForFiling: boolean;
      legal_drafting_check: Record<string, string>;
      controlReport: {
        jurisdictionDimensions: Record<string, { status: string }>;
        evidence: Array<Record<string, unknown>>;
      };
    };
    expect(structured.readyForFiling).toBe(false);
    expect(structured.controlReport.jurisdictionDimensions.country_legal_system?.status).toBe(
      "confirmed",
    );
    expect(structured.controlReport.jurisdictionDimensions.territorial_jurisdiction?.status).toBe(
      "not_verified",
    );
    expect(
      structured.controlReport.jurisdictionDimensions.subject_matter_jurisdiction?.status,
    ).toBe("not_verified");
    expect(structured.controlReport.jurisdictionDimensions.functional_jurisdiction?.status).toBe(
      "not_verified",
    );
    expect(structured.controlReport.jurisdictionDimensions.appellate_authority?.status).toBe(
      "not_verified",
    );
    expect(structured.controlReport.jurisdictionDimensions.procedural_remedy?.status).toBe(
      "not_verified",
    );
    expect(structured.legal_drafting_check.jurisdiction).toBe("not_verified");
    for (const id of ["E1", "E2"]) {
      const item = structured.controlReport.evidence.find(
        (candidate) => candidate.evidence_id === id,
      );
      expect(item?.existence_status).toBe("user_asserted");
      expect(item?.availability_status).toBe("referenced_but_not_available");
      expect(item?.content_verification_status).toBe("user_described_only");
      expect(item?.usable_as_current_support).toBe(false);
      expect(item?.reason).toBe("document_not_available_for_verification");
    }
    expect(
      structured.controlReport.evidence.find((candidate) => candidate.evidence_id === "E3")
        ?.existence_status,
    ).toBe("existence_not_confirmed");
    expect(
      structured.controlReport.evidence.find((candidate) => candidate.evidence_id === "E6")
        ?.filing_status,
    ).toBe("proposed_new_evidence");
    expect(structured.cleanDocument).not.toContain("E1, E2");
    expect(structured.cleanDocument).toContain("[NICHT ALS AKTUELLER BELEG VERWENDET]");
  });

  it("formats Swiss currency and exposes direct case-law classification helper", () => {
    expect(formatSwissAmount(2650)).toBe("CHF 2’650.00");
    expect(classifyCaseLawReference("4A_97/2026", baseDraft())).toBe("limited_analogy");
  });
});
