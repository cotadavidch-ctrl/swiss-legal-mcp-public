import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/registry.js";

const logger = createLogger({ level: "silent" });
const originalCacheDir = process.env["SWISS_LEGAL_CACHE_DIR"];
let testCacheDir: string | null = null;

interface RoleReference {
  readonly role: string;
}

interface Finding {
  readonly code: string;
  readonly severity: string;
  readonly category: string;
  readonly message: string;
}

interface JurisdictionDimension {
  readonly status: string;
}

interface CourtAnalysis {
  readonly findings_of_fact: readonly string[];
  readonly independent_grounds: readonly { readonly treatment: string }[];
}

interface RoleAnalysis {
  readonly role: string;
  readonly strongest_arguments: Array<{
    argument_id?: string;
    argument_kind?: string;
    proposition?: string;
    supporting_facts?: readonly string[];
    alleged_facts?: readonly string[];
    proposed_evidence?: readonly string[];
    supporting_evidence?: readonly string[];
    supporting_norms?: readonly string[];
    supporting_case_law?: readonly string[];
    argument_type?: string;
  }>;
  readonly usable_evidence: readonly unknown[];
  readonly usable_case_law: readonly { readonly id: string }[];
  readonly evidentiary_requests: readonly { readonly evidence_id: string }[];
  readonly court_analysis?: CourtAnalysis;
}

interface MultiroleAnalysis {
  readonly analysis_id: string;
  readonly analysis_hash: string;
  readonly schema_version: number;
  readonly evidence_snapshot_hash: string;
  readonly role_count: number;
  readonly role_ids: readonly string[];
  readonly role_hashes: Record<string, string>;
  readonly narrative_hash: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly applicable_roles: readonly string[];
  readonly non_applicable_roles: readonly RoleReference[];
  readonly role_analyses: RoleAnalysis[];
  readonly exclusions: readonly {
    readonly excluded_item: string;
    readonly exclusion_reason: string;
  }[];
  readonly jurisdiction_dimensions: Record<string, JurisdictionDimension>;
  readonly standards_of_review: readonly { readonly standard_status: string }[];
  readonly burden_analysis: {
    readonly burden_uncertain: boolean;
    readonly procedural_maxim: string;
    readonly consequence_if_unsatisfied: string;
  };
  readonly contradiction_matrix: readonly {
    readonly unresolved_conflict: boolean;
    readonly counterargument: string;
    readonly rebuttal: string;
    readonly reply: string;
    readonly evidence_currently_usable: readonly string[];
    readonly evidence_needed: readonly string[];
    readonly evidence_gap: boolean;
    readonly legal_authority_needed: readonly string[];
    readonly likely_treatment: string;
    readonly treatment_conditions: readonly string[];
    readonly treatment_is_conditional: boolean;
    readonly confidence: number;
  }[];
  readonly neutral_risk_assessment: {
    readonly strongest_issue_for_user: string;
    readonly strongest_issue_against_user: string;
    readonly best_case: string;
    readonly best_case_conditions: readonly string[];
    readonly expected_case: string;
    readonly expected_case_conditions: readonly string[];
    readonly worst_case: string;
    readonly worst_case_conditions: readonly string[];
    readonly outcome_range: string;
    readonly outcome_range_basis: string;
    readonly confidence: number;
    readonly missing_essential_elements: readonly string[];
  };
  readonly deliberation_panel: {
    readonly preferred_outcome: string;
    readonly preferred_outcome_status: string;
    readonly conditions_for_preferred_outcome: readonly string[];
    readonly missing_elements_preventing_final_outcome: readonly string[];
    readonly alternative_outcomes: readonly string[];
    readonly outcome_is_conditional: boolean;
    readonly dispositive_options: readonly string[];
  };
  readonly jurisdiction_summary: {
    readonly confirmed_dimensions: readonly string[];
    readonly unverified_dimensions: readonly string[];
    readonly contradicted_dimensions: readonly string[];
    readonly failed_dimensions: readonly string[];
    readonly counts: {
      readonly confirmed: number;
      readonly not_verified: number;
      readonly contradicted: number;
      readonly failed: number;
    };
    readonly narrative: string;
  };
  readonly narrative: {
    readonly jurisdiction: string;
    readonly outcome: string;
  };
  readonly drafting_integration: {
    readonly include_in_drafting_control_report: boolean;
    readonly clean_draft_mutation: string;
    readonly prohibited_clean_document_insertions: readonly string[];
  };
  readonly strategic_legal_engine: {
    readonly argument_strategy_matrix: readonly {
      readonly argument: string;
      readonly evidence_strength: string;
      readonly legal_strength: string;
      readonly importance: string;
      readonly recommended_role: string;
      readonly recommended_action: string;
      readonly best_counterargument: string;
      readonly best_reply: string;
      readonly residual_risk: string;
    }[];
    readonly evidence_control_map: readonly {
      readonly evidence_id: string;
      readonly control: string;
      readonly status: string;
      readonly recommended_request: string;
      readonly caution: string;
    }[];
    readonly contradiction_analysis: readonly {
      readonly contradiction_type: string;
      readonly formulation: string;
      readonly legal_utility: string;
      readonly recommended_action: string;
      readonly accusation_guardrail: string;
    }[];
    readonly core_strengths: readonly {
      readonly strength_type: string;
      readonly evidence_id: string;
      readonly recommended_use: string;
      readonly overstatement_guardrail: string;
    }[];
    readonly strategic_concessions: readonly {
      readonly fact_id: string;
      readonly concession_type: string;
      readonly recommended_formulation: string;
    }[];
    readonly tone_calibration: {
      readonly findings: readonly {
        readonly classification: string;
        readonly recommended_formulation: string;
      }[];
      readonly litigation_strong_guardrail: string;
    };
    readonly drafting_strategy: {
      readonly main_arguments: readonly unknown[];
      readonly secondary_arguments: readonly unknown[];
      readonly evidentiary_requests: readonly unknown[];
      readonly contradiction_formulations: readonly string[];
      readonly tone_rewrites_required: number;
      readonly economy_guardrail: string;
    };
    readonly likely_decision_paths: readonly {
      readonly path: string;
      readonly probability: string;
      readonly condition: string;
      readonly strategic_action: string;
    }[];
    readonly guardrails: readonly string[];
  };
}

interface ValidationResult {
  readonly findings: readonly Finding[];
  readonly status: string;
  readonly summary: {
    readonly blocker: number;
    readonly major: number;
    readonly warning: number;
    readonly informational: number;
    readonly controls_applied: number;
    readonly true_violations: number;
  };
}

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

function baseCase(overrides: Record<string, unknown> = {}) {
  return {
    caseType: "administrative_legal_aid",
    proceduralStage: "appeal",
    matterDescription:
      "Beschwerde gegen die Verweigerung der unentgeltlichen Rechtspflege wegen Bankkonto und interner Übertragung.",
    userObjective: "Rückweisung zur neuen Beurteilung.",
    include_in_drafting_control_report: false,
    jurisdiction: {
      country: "CH",
      canton: "ZH",
      territorialJurisdiction: "ZH",
      subjectMatterJurisdiction: "unentgeltliche Rechtspflege",
      functionalJurisdiction: "Beschwerdeinstanz",
      issuingAuthority: "Sozialbehörde",
      appellateAuthority: "Bezirksrat",
      proceduralRemedy: "Beschwerde",
      venueOrFilingDestination: "Bezirksrat Zürich",
    },
    parties: [
      { role: "appellant", description: "A." },
      { role: "authority", description: "Sozialbehörde" },
    ],
    facts: [
      {
        id: "F1",
        description: "Interne Übertragung zwischen Konten desselben Inhabers.",
        status: "confirmed",
        evidenceIds: ["E1"],
      },
      {
        id: "F2",
        description: "Saldo des Zwischenkontos null.",
        status: "accepted_for_drafting",
        evidenceIds: ["E2"],
      },
    ],
    evidence: [
      {
        evidenceId: "E1",
        name: "Kontoauszug Ursprungskonto",
        provesFactIds: ["F1"],
        assertionSource: "source_document",
        existenceStatus: "source_confirmed",
        availabilityStatus: "available_to_tool",
        contentVerificationStatus: "verified_against_document",
        authenticityStatus: "confirmed",
        inRecordStatus: "in_record_confirmed",
        filingStatus: "already_filed",
        admissibilityStatus: "admissible_confirmed",
        novenStatus: "no_known_noven_issue",
      },
      {
        evidenceId: "E2",
        name: "Kontoauszug Zwischenkonto",
        provesFactIds: ["F2"],
        assertionSource: "source_document",
        existenceStatus: "source_confirmed",
        availabilityStatus: "available_to_tool",
        contentVerificationStatus: "verified_against_document",
        authenticityStatus: "confirmed",
        inRecordStatus: "in_record_confirmed",
        filingStatus: "already_filed",
        admissibilityStatus: "admissible_confirmed",
        novenStatus: "no_known_noven_issue",
      },
    ],
    norms: [{ id: "N1", citation: "Art. 29 Abs. 3 BV", status: "temporal_validity_confirmed" }],
    caseLaw: [{ id: "C1", citation: "BGE 142 III 1", textStatus: "full_text_verified" }],
    challengedPassages: [
      {
        id: "P1",
        exactText: "Die Mittel reichen aus.",
        author: "decision_authority",
        function: "evidence_assessment",
        autonomousGround: false,
        challenged: true,
        preserved: true,
      },
    ],
    burdenModel: {
      proceduralMaxim: "Mitwirkungspflicht",
      burdenHolder: "appellant",
      legalBasisStatus: "confirmed",
    },
    ...overrides,
  };
}

async function analyze(argumentsObject: Record<string, unknown>) {
  const client = await buildClient();
  const result = await client.callTool({
    name: "analyze_swiss_legal_positions",
    arguments: argumentsObject,
  });
  expect(result.isError).toBeFalsy();
  return result.structuredContent as MultiroleAnalysis;
}

async function validate(analysis: MultiroleAnalysis) {
  const client = await buildClient();
  const result = await client.callTool({
    name: "validate_multirole_legal_analysis",
    arguments: { analysis },
  });
  expect(result.isError).toBeFalsy();
  return result.structuredContent as ValidationResult;
}

async function validateById(analysisId: string) {
  const client = await buildClient();
  const result = await client.callTool({
    name: "validate_multirole_legal_analysis",
    arguments: { analysis_id: analysisId },
  });
  expect(result.isError).toBeFalsy();
  return result.structuredContent as ValidationResult & {
    analysis_integrity: {
      analysis_id: string;
      analysis_hash: string;
      evidence_snapshot_hash: string;
      role_count: number;
      role_ids: readonly string[];
      role_hashes: Record<string, string>;
      narrative_hash: string;
      persistence_verified: boolean;
      network_request_performed: boolean;
      validation_status: string;
      narrative_state_mismatch: boolean;
      role_integrity: string;
      evidence_consistency: string;
      unresolved_conflicts: readonly string[];
    };
  };
}

function findingCodes(validation: ValidationResult): string[] {
  return validation.findings.map((finding) => finding.code);
}

function roleByName(analysis: MultiroleAnalysis, roleName: string): RoleAnalysis {
  const role = analysis.role_analyses.find((item) => item.role === roleName);
  expect(role).toBeTruthy();
  return role!;
}

describe("multirole Swiss legal analysis MCP tools", () => {
  beforeEach(() => {
    testCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "swiss-legal-mcp-multirole-"));
    process.env["SWISS_LEGAL_CACHE_DIR"] = testCacheDir;
  });

  afterEach(() => {
    if (testCacheDir) fs.rmSync(testCacheDir, { recursive: true, force: true });
    testCacheDir = null;
    if (originalCacheDir === undefined) delete process.env["SWISS_LEGAL_CACHE_DIR"];
    else process.env["SWISS_LEGAL_CACHE_DIR"] = originalCacheDir;
  });

  it("registers the two multirole tools", async () => {
    const client = await buildClient();
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("analyze_swiss_legal_positions");
    expect(names).toContain("validate_multirole_legal_analysis");
  });

  it("handles administrative legal aid roles", async () => {
    const structured = await analyze(baseCase());
    expect(structured.applicable_roles).toEqual([
      "claimant_or_appellant",
      "respondent_or_authority",
      "first_instance_court",
      "appellate_court",
      "neutral_risk_assessment",
      "deliberation_panel",
    ]);
  });

  it("validates a stored multirole analysis directly by analysis_id", async () => {
    const structured = await analyze(baseCase());
    expect(structured.analysis_id).toMatch(/^analysis_/);
    const first = await validateById(structured.analysis_id);
    const second = await validateById(structured.analysis_id);

    expect(first.analysis_integrity).toMatchObject({
      analysis_id: structured.analysis_id,
      analysis_hash: structured.analysis_hash,
      evidence_snapshot_hash: structured.evidence_snapshot_hash,
      role_count: structured.role_count,
      role_ids: structured.role_ids,
      narrative_hash: structured.narrative_hash,
      persistence_verified: true,
      network_request_performed: false,
      narrative_state_mismatch: false,
      role_integrity: "verified",
      evidence_consistency: "verified",
    });
    expect(second.analysis_integrity).toMatchObject(first.analysis_integrity);
    expect(Object.keys(first.analysis_integrity.role_hashes)).toEqual(structured.role_ids);
  });

  it("handles civil bilateral roles", async () => {
    const structured = await analyze(
      baseCase({
        caseType: "civil",
        matterDescription: "Zivilrechtliche Klage aus Vertrag.",
        parties: [
          { role: "claimant", description: "Klägerin" },
          { role: "defendant", description: "Beklagter" },
        ],
      }),
    );
    expect(structured.applicable_roles).toContain("claimant_or_appellant");
    expect(structured.applicable_roles).toContain("opposing_party");
    expect(structured.applicable_roles).not.toContain("respondent_or_authority");
  });

  it("handles criminal roles with prosecution and defence", async () => {
    const structured = await analyze(
      baseCase({ caseType: "criminal", matterDescription: "Strafverfahren mit Anklage." }),
    );
    expect(structured.applicable_roles).toContain("prosecution");
    expect(structured.applicable_roles).toContain("defence");
  });

  it("excludes prosecution in non-criminal cases", async () => {
    const structured = await analyze(baseCase({ caseType: "civil" }));
    expect(structured.applicable_roles).not.toContain("prosecution");
    expect(structured.non_applicable_roles.map((role) => role.role)).toContain("prosecution");
  });

  it("does not let a court role adopt a party argument as neutral conclusion", async () => {
    const structured = await analyze(baseCase());
    const court = roleByName(structured, "first_instance_court");
    const claimant = roleByName(structured, "claimant_or_appellant");
    expect(court.strongest_arguments[0]?.argument_kind).toBe("court_finding");
    expect(court.strongest_arguments[0]?.proposition).not.toBe(
      claimant.strongest_arguments[0]?.proposition,
    );
  });

  it("does not use a user asserted fact as judicial finding", async () => {
    const structured = await analyze(
      baseCase({
        facts: [
          { id: "F-user", description: "Nur vom Nutzer behauptet.", status: "user_asserted" },
        ],
      }),
    );
    const court = roleByName(structured, "first_instance_court");
    expect(court.court_analysis?.findings_of_fact).toEqual([]);
    expect(court.strongest_arguments[0]?.supporting_facts ?? []).not.toContain("F-user");
    expect(court.strongest_arguments[0]?.alleged_facts ?? []).toContain("F-user");
    expect(structured.exclusions.map((item) => item.excluded_item)).toContain("F-user");
  });

  it("excludes user described only evidence", async () => {
    const structured = await analyze(
      baseCase({
        evidence: [
          {
            evidenceId: "E-user",
            name: "Vom Nutzer beschriebener Kontoauszug",
            existenceStatus: "user_asserted",
            availabilityStatus: "referenced_but_not_available",
            contentVerificationStatus: "user_described_only",
            authenticityStatus: "unconfirmed",
            inRecordStatus: "claimed_to_be_in_record",
            filingStatus: "not_verified",
            admissibilityStatus: "admissibility_not_verified",
          },
        ],
      }),
    );
    expect(structured.role_analyses[0].usable_evidence).toEqual([]);
    expect(structured.exclusions.map((item) => item.exclusion_reason)).toContain(
      "user_described_only_not_documentary_support",
    );
  });

  it("treats new evidence only as procedural proposal", async () => {
    const structured = await analyze(
      baseCase({
        evidence: [
          {
            evidenceId: "E-new",
            name: "Neuer Auszug",
            existenceStatus: "source_confirmed",
            availabilityStatus: "available_to_tool",
            contentVerificationStatus: "verified_against_document",
            authenticityStatus: "confirmed",
            inRecordStatus: "not_in_record",
            filingStatus: "proposed_new_evidence",
            admissibilityStatus: "noven_risk",
            novenStatus: "possible_noven",
          },
        ],
      }),
    );
    const appellant = roleByName(structured, "claimant_or_appellant");
    expect(appellant.evidentiary_requests[0].evidence_id).toBe("E-new");
    expect(appellant.usable_evidence).toEqual([]);
  });

  it("excludes snippet only case law", async () => {
    const structured = await analyze(
      baseCase({
        caseLaw: [{ id: "C-snippet", citation: "4A_1/2026", textStatus: "snippet_only" }],
      }),
    );
    expect(structured.exclusions.map((item) => item.excluded_item)).toContain("C-snippet");
    expect(structured.role_analyses[0].usable_case_law).toEqual([]);
  });

  it("permits full text verified case law", async () => {
    const structured = await analyze(baseCase());
    expect(structured.role_analyses[0].usable_case_law[0].id).toBe("C1");
  });

  it("marks unknown burden as requiring legal review", async () => {
    const structured = await analyze(
      baseCase({
        burdenModel: { proceduralMaxim: "not_verified", legalBasisStatus: "not_verified" },
      }),
    );
    expect(structured.burden_analysis.burden_uncertain).toBe(true);
    expect(structured.burden_analysis.consequence_if_unsatisfied).toBe("requires_legal_review");
  });

  it("keeps an unknown procedural maxim unverified", async () => {
    const structured = await analyze(
      baseCase({ burdenModel: { proceduralMaxim: "not_verified", legalBasisStatus: "confirmed" } }),
    );
    expect(structured.burden_analysis.procedural_maxim).toBe("not_verified");
  });

  it("keeps review standard unverified when competence is incomplete", async () => {
    const structured = await analyze(baseCase({ jurisdiction: { country: "CH" } }));
    expect(structured.standards_of_review[0].standard_status).toBe("not_verified");
  });

  it("flags an appeal grievance not preserved", async () => {
    const structured = await analyze(
      baseCase({
        challengedPassages: [
          {
            id: "P-unpreserved",
            exactText: "Eventualbegründung.",
            author: "decision_authority",
            function: "alternative_ground",
            autonomousGround: true,
            verified_function: "alternative_ground",
            classification_status: "verified",
            reviewed: true,
            challenged: true,
            preserved: false,
          },
        ],
      }),
    );
    const appellate = roleByName(structured, "appellate_court");
    expect(appellate.court_analysis?.independent_grounds[0]?.treatment).toBe("not_preserved");
  });

  it("flags unchallenged independent grounds", async () => {
    const structured = await analyze(
      baseCase({
        challengedPassages: [
          {
            id: "P-auto",
            exactText: "Selbständige Begründung.",
            author: "decision_authority",
            function: "alternative_ground",
            autonomousGround: true,
            verified_function: "alternative_ground",
            classification_status: "verified",
            reviewed: true,
            challenged: false,
          },
        ],
      }),
    );
    const validation = await validate(structured);
    expect(findingCodes(validation)).toContain("independent_ground_correctly_left_unreviewed");
  });

  it("does not promote caller-only autonomous ground assertions into independent grounds", async () => {
    const structured = await analyze(
      baseCase({
        challengedPassages: [
          {
            id: "P-asserted-only",
            exactText: "Selbständige Begründung.",
            author: "decision_authority",
            function: "alternative_ground",
            autonomousGround: true,
            challenged: false,
          },
        ],
      }),
    );
    const appellate = roleByName(structured, "appellate_court");
    const validation = await validate(structured);
    expect(appellate.court_analysis?.independent_grounds).toEqual([]);
    expect(findingCodes(validation)).not.toContain("independent_ground_correctly_left_unreviewed");
  });

  it("keeps a non-decisive error from becoming categorical disposition", async () => {
    const structured = await analyze(baseCase({ requestedOutcome: "grant" }));
    expect(structured.deliberation_panel.preferred_outcome).not.toBe("grant");
  });

  it("builds argument counterargument reply matrix", async () => {
    const structured = await analyze(baseCase());
    expect(structured.contradiction_matrix[0]).toMatchObject({
      unresolved_conflict: true,
      evidence_gap: false,
      treatment_is_conditional: true,
    });
    expect(structured.contradiction_matrix[0].evidence_currently_usable).toEqual(["E1", "E2"]);
    expect(structured.contradiction_matrix[0].evidence_needed).toEqual([]);
    expect(structured.contradiction_matrix[0].likely_treatment).toContain("cannot_assess");
    expect(structured.contradiction_matrix[0].treatment_conditions.join(" ")).toContain("solo si");
    expect(structured.contradiction_matrix[0].counterargument).toBeTruthy();
    expect(structured.contradiction_matrix[0].rebuttal).toBeTruthy();
    expect(structured.contradiction_matrix[0].reply).toBeTruthy();
  });

  it("builds balanced neutral risk assessment", async () => {
    const structured = await analyze(baseCase());
    expect(structured.neutral_risk_assessment.strongest_issue_for_user).toContain("same amount");
    expect(structured.neutral_risk_assessment.strongest_issue_against_user).toBeTruthy();
    expect(structured.neutral_risk_assessment.outcome_range).toBe("broad_range");
    expect(structured.neutral_risk_assessment.best_case).toMatch(/^conditional_/);
  });

  it("deliberates cannot assess when facts and route are missing", async () => {
    const structured = await analyze(
      baseCase({ facts: [], evidence: [], jurisdiction: { country: "CH" } }),
    );
    expect(["cannot_assess", "request_additional_evidence"]).toContain(
      structured.deliberation_panel.preferred_outcome,
    );
  });

  it("deliberates remand when support and route are complete", async () => {
    const structured = await analyze(baseCase({ requestedOutcome: "remand" }));
    expect(structured.deliberation_panel.dispositive_options).toContain("remand");
  });

  it("detects role leakage", async () => {
    const structured = await analyze(baseCase({ caseType: "civil" }));
    structured.role_analyses.push({ role: "prosecution", strongest_arguments: [] });
    const validation = await validate(structured);
    expect(findingCodes(validation)).toContain("role_leakage");
    expect(validation.status).toBe("blocked");
  });

  it("detects judicial conclusion without support", async () => {
    const structured = await analyze(baseCase({ facts: [], evidence: [] }));
    structured.role_analyses.push({
      role: "first_instance_court",
      usable_evidence: [],
      strongest_arguments: [],
      court_analysis: { findings_of_fact: ["F-impossible"], independent_grounds: [] },
    });
    const validation = await validate(structured);
    expect(findingCodes(validation)).toContain("court_finding_without_basis");
    expect(validation.status).toBe("blocked");
  });

  it("detects predicted outcome presented as fact", async () => {
    const structured = await analyze(baseCase());
    structured.role_analyses[0].strongest_arguments.push({
      argument_id: "bad",
      argument_kind: "predicted_outcome",
      supporting_facts: ["F1"],
    });
    const validation = await validate(structured);
    expect(findingCodes(validation)).toContain("predicted_outcome_presented_as_fact");
  });

  it("detects an excluded fact used as party support", async () => {
    const structured = await analyze(
      baseCase({
        facts: [{ id: "F-user", description: "Nur behauptet.", status: "user_asserted" }],
      }),
    );
    roleByName(structured, "claimant_or_appellant").strongest_arguments.push({
      argument_id: "bad-fact",
      argument_kind: "party_argument",
      supporting_facts: ["F-user"],
      supporting_evidence: [],
      supporting_norms: [],
      supporting_case_law: [],
    });
    const validation = await validate(structured);
    expect(validation.status).toBe("failed");
    expect(validation.findings).toContainEqual(
      expect.objectContaining({
        code: "unverified_fact_used_as_fact",
        severity: "major",
        category: "true_violation",
      }),
    );
  });

  it("detects excluded evidence used as court support", async () => {
    const structured = await analyze(
      baseCase({
        evidence: [
          {
            evidenceId: "E-user",
            name: "Vom Nutzer beschriebener Auszug",
            existenceStatus: "user_asserted",
            availabilityStatus: "referenced_but_not_available",
            contentVerificationStatus: "user_described_only",
            authenticityStatus: "unconfirmed",
            inRecordStatus: "claimed_to_be_in_record",
            filingStatus: "not_verified",
            admissibilityStatus: "admissibility_not_verified",
          },
        ],
      }),
    );
    roleByName(structured, "first_instance_court").strongest_arguments.push({
      argument_id: "bad-evidence",
      argument_kind: "court_finding",
      supporting_facts: [],
      supporting_evidence: ["E-user"],
      supporting_norms: [],
      supporting_case_law: [],
    });
    const validation = await validate(structured);
    expect(validation.status).toBe("blocked");
    expect(validation.findings).toContainEqual(
      expect.objectContaining({
        code: "unusable_evidence_used",
        severity: "blocker",
        category: "true_violation",
      }),
    );
  });

  it("passes validation when only informational controls are present", async () => {
    const structured = await analyze(baseCase());
    const validation = await validate(structured);
    expect(validation.status).toBe("passed");
    expect(validation.summary).toMatchObject({
      blocker: 0,
      major: 0,
      warning: 0,
      true_violations: 0,
    });
    expect(validation.summary.controls_applied).toBeGreaterThan(0);
  });

  it("fails validation for a decisive unsupported argument without blocking", async () => {
    const structured = await analyze(baseCase());
    structured.role_analyses[0].strongest_arguments.push({
      argument_id: "unsupported",
      argument_type: "procedural",
      supporting_facts: [],
      supporting_evidence: [],
      supporting_norms: [],
      supporting_case_law: [],
    });
    const validation = await validate(structured);
    expect(validation.status).toBe("failed");
    expect(findingCodes(validation)).toContain("unsupported_argument");
    expect(validation.summary.major).toBeGreaterThan(0);
  });

  it("warns rather than fails for accessory unsupported costs arguments", async () => {
    const structured = await analyze(baseCase());
    structured.role_analyses[0].strongest_arguments.push({
      argument_id: "costs",
      argument_type: "costs",
      supporting_facts: [],
      supporting_evidence: [],
      supporting_norms: [],
      supporting_case_law: [],
    });
    const validation = await validate(structured);
    expect(validation.status).toBe("passed_with_warnings");
    expect(validation.findings).toContainEqual(
      expect.objectContaining({
        code: "unsupported_argument",
        severity: "warning",
        category: "warning",
      }),
    );
  });

  it("detects jurisdiction summary mismatches", async () => {
    const structured = await analyze(baseCase({ jurisdiction: { country: "CH" } }));
    (structured.jurisdiction_summary.counts as { confirmed: number }).confirmed = 0;
    const validation = await validate(structured);
    expect(validation.status).toBe("failed");
    expect(findingCodes(validation)).toContain("jurisdiction_summary_mismatch");
  });

  it("detects narrative state mismatches", async () => {
    const structured = await analyze(baseCase({ jurisdiction: { country: "CH" } }));
    (structured.narrative as { jurisdiction: string }).jurisdiction =
      "Las ocho dimensiones están no verificadas.";
    const validation = await validate(structured);
    expect(validation.status).toBe("failed");
    expect(findingCodes(validation)).toContain("narrative_state_mismatch");
  });

  it("detects unconditional outcomes when essentials are missing", async () => {
    const structured = await analyze(baseCase({ jurisdiction: { country: "CH" } }));
    (
      structured.deliberation_panel as {
        preferred_outcome: string;
        outcome_is_conditional: boolean;
      }
    ).preferred_outcome = "grant";
    (
      structured.deliberation_panel as {
        preferred_outcome: string;
        outcome_is_conditional: boolean;
      }
    ).outcome_is_conditional = false;
    const validation = await validate(structured);
    expect(validation.status).toBe("blocked");
    expect(findingCodes(validation)).toContain("unconditional_outcome_with_missing_essentials");
  });

  it("detects validator code and message mismatches", async () => {
    const structured = (await analyze(baseCase())) as MultiroleAnalysis & {
      validation_findings?: unknown[];
    };
    structured.validation_findings = [
      {
        code: "unusable_evidence_used",
        category: "true_violation",
        message: "unusable evidence correctly excluded",
      },
    ];
    const validation = await validate(structured);
    expect(validation.status).toBe("failed");
    expect(findingCodes(validation)).toContain("validator_code_message_mismatch");
  });

  it("detects evidence status narrative mismatches", async () => {
    const structured = await analyze(
      baseCase({
        evidence: [
          {
            evidenceId: "E-user",
            name: "Vom Nutzer beschriebener Auszug",
            existenceStatus: "user_asserted",
            availabilityStatus: "referenced_but_not_available",
            contentVerificationStatus: "user_described_only",
            authenticityStatus: "unconfirmed",
            inRecordStatus: "claimed_to_be_in_record",
            filingStatus: "not_verified",
            admissibilityStatus: "admissibility_not_verified",
          },
        ],
      }),
    );
    (
      structured.neutral_risk_assessment as {
        strongest_issue_for_user: string;
      }
    ).strongest_issue_for_user = "document-supported transfer theory";
    const validation = await validate(structured);
    expect(validation.status).toBe("failed");
    expect(findingCodes(validation)).toContain("evidence_status_narrative_mismatch");
  });

  it("detects incomplete jurisdiction", async () => {
    const structured = await analyze(baseCase({ jurisdiction: { country: "CH" } }));
    expect(structured.jurisdiction_dimensions.country_legal_system.status).toBe("confirmed");
    expect(structured.jurisdiction_dimensions.territorial_jurisdiction.status).toBe("not_verified");
    expect(structured.jurisdiction_summary.counts).toMatchObject({
      confirmed: 1,
      not_verified: 7,
    });
    expect(structured.jurisdiction_summary.narrative).toContain(
      "El ordenamiento suizo está confirmado.",
    );
    expect(structured.jurisdiction_summary.narrative).toContain(
      "Las otras siete dimensiones procesales no están verificadas.",
    );
    expect(structured.jurisdiction_summary.narrative).not.toContain(
      "Las ocho dimensiones están no verificadas",
    );
    expect(structured.exclusions.map((item) => item.excluded_item)).toContain(
      "territorial_jurisdiction",
    );
  });

  it("integrates with drafting control without contaminating clean drafting", async () => {
    const structured = await analyze(baseCase({ include_in_drafting_control_report: true }));
    expect(structured.drafting_integration.include_in_drafting_control_report).toBe(true);
    expect(structured.drafting_integration.clean_draft_mutation).toBe("not_performed");
    expect(structured.drafting_integration.prohibited_clean_document_insertions).toContain(
      "deliberation_panel",
    );
  });

  it("A: treats missing authority-held evidence as an evidentiary request, not proof of nonexistence", async () => {
    const structured = await analyze(
      baseCase({
        evidence: [
          {
            evidenceId: "E-authority-file",
            name: "Internal administrative record",
            assertionSource: "authority",
            existenceStatus: "source_confirmed",
            availabilityStatus: "referenced_but_not_available",
            contentVerificationStatus: "not_verified",
            inRecordStatus: "not_verified",
            filingStatus: "not_verified",
          },
        ],
      }),
    );
    expect(structured.strategic_legal_engine.evidence_control_map[0]).toMatchObject({
      control: "AUTHORITY_CONTROLLED",
      status: "AUTHORITY_CONTROLLED_EVIDENCE",
      recommended_request: "request_aktenedition_or_akteneinsicht",
    });
    expect(structured.strategic_legal_engine.evidence_control_map[0]?.caution).toContain(
      "do_not_treat_absence",
    );
  });

  it("B: formulates document contradictions as clarification needs, not accusations", async () => {
    const structured = await analyze(
      baseCase({
        facts: [
          {
            id: "F-contradicted",
            description: "Two filed records describe the same procedural event differently.",
            status: "contradicted",
            evidenceIds: ["E1", "E2"],
          },
        ],
      }),
    );
    const contradiction = structured.strategic_legal_engine.contradiction_analysis[0];
    expect(contradiction).toMatchObject({
      contradiction_type: "REQUIRES_EXPLANATION",
      accusation_guardrail: "do_not_label_as_lie_or_bad_faith",
    });
    expect(contradiction?.formulation).toContain("ohne weitere Erklärung");
  });

  it("C: recommends controlled concessions for confirmed opposing facts", async () => {
    const structured = await analyze(
      baseCase({
        facts: [
          {
            id: "F-opponent-favorable",
            description: "The opposing party has one confirmed factual point.",
            status: "confirmed",
            evidenceIds: ["E1"],
          },
        ],
      }),
    );
    expect(structured.strategic_legal_engine.strategic_concessions[0]).toMatchObject({
      fact_id: "F-opponent-favorable",
      concession_type: "SAFE_CONCESSION",
    });
    expect(
      structured.strategic_legal_engine.strategic_concessions[0]?.recommended_formulation,
    ).toContain("Selbst wenn");
  });

  it("D: does not use case law as decisive when full text is unavailable or adverse aspects are unresolved", async () => {
    const structured = await analyze(
      baseCase({
        caseLaw: [
          {
            id: "C-mixed",
            citation: "4A_1/2026",
            textStatus: "snippet_only",
            relevance: "Contains a favorable phrase but the outcome was adverse.",
          },
        ],
      }),
    );
    expect(structured.exclusions.map((item) => item.excluded_item)).toContain("C-mixed");
    expect(
      structured.strategic_legal_engine.argument_strategy_matrix.some(
        (item) => item.legal_strength === "REQUIRES_FULL_TEXT_VERIFICATION",
      ),
    ).toBe(false);
    expect(structured.strategic_legal_engine.guardrails).toContain(
      "full_text_case_law_required_before_decisive_use",
    );
  });

  it("E: subordinates weak secondary points instead of converting them into fatal problems", async () => {
    const structured = await analyze(
      baseCase({
        facts: [],
        evidence: [],
        challengedPassages: [
          {
            id: "P-secondary",
            exactText: "A low-value procedural point is mentioned.",
            author: "opposing_party",
            function: "subsidiary_argument",
            autonomousGround: false,
          },
        ],
      }),
    );
    expect(structured.strategic_legal_engine.drafting_strategy.economy_guardrail).toContain(
      "drop or subordinate",
    );
    expect(structured.neutral_risk_assessment.non_dispositive_issues).toEqual([]);
  });

  it("F: marks strong verified evidence as CORE_STRENGTH without excessive doubt", async () => {
    const structured = await analyze(baseCase());
    expect(structured.strategic_legal_engine.core_strengths).toContainEqual(
      expect.objectContaining({
        strength_type: "CORE_STRENGTH",
        evidence_id: "E1",
      }),
    );
    expect(structured.strategic_legal_engine.core_strengths[0]?.recommended_use).toContain(
      "state firmly",
    );
  });

  it("G: neutralizes legally correct but non-dispositive opposing points by accepting arguendo", async () => {
    const structured = await analyze(
      baseCase({
        challengedPassages: [
          {
            id: "P-correct-but-irrelevant",
            exactText: "A legally correct but narrow point does not decide the requested outcome.",
            author: "opposing_party",
            function: "legal_interpretation",
            autonomousGround: false,
          },
        ],
      }),
    );
    expect(
      structured.strategic_legal_engine.strategic_concessions.some((item) =>
        item.recommended_formulation.includes("folgt daraus nicht"),
      ),
    ).toBe(true);
  });

  it("runs the blind bank legal aid case end to end", async () => {
    const structured = await analyze(
      baseCase({
        jurisdiction: { country: "CH" },
        facts: [
          {
            id: "F-transfer",
            description: "Kontoübertrag gleicher Betrag zwischen eigenen Konten.",
            status: "user_asserted",
            evidenceIds: ["E1", "E2"],
          },
          {
            id: "F-zero",
            description: "Saldo final null.",
            status: "user_asserted",
            evidenceIds: ["E2"],
          },
          {
            id: "F-e3",
            description: "Weiterer Kontoauszug nicht bestätigt.",
            status: "not_verified",
          },
        ],
        evidence: [
          {
            evidenceId: "E1",
            name: "beschriebener Auszug Ursprungskonto",
            existenceStatus: "user_asserted",
            availabilityStatus: "referenced_but_not_available",
            contentVerificationStatus: "user_described_only",
            authenticityStatus: "unconfirmed",
            inRecordStatus: "claimed_to_be_in_record",
            filingStatus: "not_verified",
            admissibilityStatus: "admissibility_not_verified",
          },
          {
            evidenceId: "E2",
            name: "beschriebener Auszug Zwischenkonto",
            existenceStatus: "user_asserted",
            availabilityStatus: "referenced_but_not_available",
            contentVerificationStatus: "user_described_only",
            authenticityStatus: "unconfirmed",
            inRecordStatus: "claimed_to_be_in_record",
            filingStatus: "not_verified",
            admissibilityStatus: "admissibility_not_verified",
          },
          {
            evidenceId: "E3",
            name: "nicht bestätigter Auszug",
            existenceStatus: "existence_not_confirmed",
            availabilityStatus: "missing",
            contentVerificationStatus: "not_verified",
            authenticityStatus: "unconfirmed",
            filingStatus: "missing",
            admissibilityStatus: "admissibility_not_verified",
          },
          {
            evidenceId: "E6",
            name: "neuer vollständiger Auszug",
            existenceStatus: "source_confirmed",
            availabilityStatus: "available_to_tool",
            contentVerificationStatus: "verified_against_document",
            authenticityStatus: "confirmed",
            inRecordStatus: "not_in_record",
            filingStatus: "proposed_new_evidence",
            admissibilityStatus: "noven_risk",
            novenStatus: "possible_noven",
          },
        ],
        caseLaw: [],
        challengedPassages: [],
        burdenModel: {
          proceduralMaxim: "not_verified",
          legalBasisStatus: "not_verified",
        },
      }),
    );

    expect(structured.applicable_roles).toEqual([
      "claimant_or_appellant",
      "respondent_or_authority",
      "first_instance_court",
      "appellate_court",
      "neutral_risk_assessment",
      "deliberation_panel",
    ]);
    expect(structured.non_applicable_roles.map((role) => role.role)).toEqual(
      expect.arrayContaining(["prosecution", "defence"]),
    );
    expect(structured.jurisdiction_dimensions.country_legal_system.status).toBe("confirmed");
    expect(structured.jurisdiction_dimensions.territorial_jurisdiction.status).toBe("not_verified");
    expect(structured.jurisdiction_summary.counts).toMatchObject({
      confirmed: 1,
      not_verified: 7,
    });
    expect(structured.narrative.jurisdiction).toContain("El ordenamiento suizo está confirmado.");
    expect(structured.narrative.jurisdiction).toContain(
      "Las otras siete dimensiones procesales no están verificadas.",
    );
    expect(structured.narrative.jurisdiction).not.toContain(
      "Las ocho dimensiones están no verificadas",
    );
    const appellant = roleByName(structured, "claimant_or_appellant");
    const authority = roleByName(structured, "respondent_or_authority");
    expect(appellant.strongest_arguments[0]?.proposition).toContain("internal transfer");
    expect(authority.strongest_arguments[0]?.proposition).toContain("cooperation duties");
    expect(roleByName(structured, "first_instance_court").court_analysis?.findings_of_fact).toEqual(
      [],
    );
    expect(structured.neutral_risk_assessment.strongest_issue_for_user).toContain("same amount");
    expect(structured.neutral_risk_assessment.strongest_issue_against_user).toContain(
      "key evidence is unavailable",
    );
    expect(structured.neutral_risk_assessment.best_case).toBe("conditional_remand");
    expect(structured.neutral_risk_assessment.best_case_conditions.join(" ")).toContain("solo si");
    expect(structured.neutral_risk_assessment.expected_case).toBe("cannot_assess");
    expect(structured.neutral_risk_assessment.expected_case_conditions.join(" ")).toContain(
      "solo si",
    );
    expect(["inadmissibility_risk", "dismissal_risk"]).toContain(
      structured.neutral_risk_assessment.worst_case,
    );
    expect(structured.neutral_risk_assessment.outcome_range).toBe("cannot_assess");
    expect(structured.deliberation_panel.preferred_outcome).toBe("request_additional_evidence");
    expect(structured.deliberation_panel.preferred_outcome_status).toBe("provisional");
    expect(structured.deliberation_panel.outcome_is_conditional).toBe(true);
    expect(structured.deliberation_panel.missing_elements_preventing_final_outcome).toEqual([
      "authority",
      "remedy",
      "full_decision",
      "standard_of_review",
      "verified_evidence",
      "deadline",
      "notification_date",
    ]);
    expect(structured.deliberation_panel.preferred_outcome).not.toBe("grant");
    expect(structured.deliberation_panel.preferred_outcome).not.toBe("dismiss");
    expect(structured.contradiction_matrix[0].evidence_currently_usable).toEqual([]);
    expect(structured.contradiction_matrix[0].evidence_needed).toEqual(["E1", "E2", "E3", "E6"]);
    expect(structured.contradiction_matrix[0].evidence_gap).toBe(true);
    expect(structured.contradiction_matrix[0].treatment_is_conditional).toBe(true);

    const validation = await validate(structured);
    const codes = findingCodes(validation);
    expect(validation.status).toBe("passed_with_warnings");
    expect(validation.summary).toMatchObject({
      blocker: 0,
      major: 0,
      warning: 2,
      true_violations: 0,
    });
    expect(codes).toContain("unverified_fact_correctly_limited_to_allegation");
    expect(codes).toContain("unusable_evidence_correctly_excluded");
    expect(codes).toContain("new_evidence_correctly_flagged_as_noven_risk");
    expect(codes).toContain("burden_holder_not_verified");
    expect(codes).toContain("standard_of_review_not_verified");
    expect(codes).toContain("predicted_outcome_correctly_conditioned");
    expect(codes).not.toContain("unverified_fact_used_as_fact");
    expect(codes).not.toContain("unusable_evidence_used");
    expect(codes).not.toContain("partial_case_used");
  });
});
