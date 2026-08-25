import { describe, expect, it } from "vitest";
import { analyzeSwissLegalPositions } from "../src/tools/multiroleLegalAnalysisTools.js";

type MultiroleInput = Parameters<typeof analyzeSwissLegalPositions>[0];

interface StrategicEngineForTest {
  readonly issue_map: readonly {
    readonly proposition_type: string;
    readonly recommended_treatment: string;
  }[];
  readonly evidence_map: readonly {
    readonly status: string;
    readonly recommended_request: string;
    readonly caution: string;
  }[];
  readonly contradiction_map: readonly {
    readonly formulation: string;
    readonly accusation_guardrail: string;
  }[];
  readonly best_client_argument: {
    readonly best_counterargument: string;
    readonly best_reply: string;
    readonly residual_risk: string;
  } | null;
  readonly argument_strategy_matrix: readonly {
    readonly importance: string;
    readonly recommended_action: string;
    readonly best_counterargument: string;
    readonly best_reply: string;
    readonly residual_risk: string;
  }[];
  readonly core_strengths: readonly { readonly strength_type: string }[];
  readonly strategic_concessions: readonly {
    readonly concession_type: string;
    readonly recommended_formulation: string;
  }[];
  readonly evidence_requests: readonly {
    readonly status: string;
    readonly recommended_request: string;
    readonly caution: string;
  }[];
  readonly case_law_use: readonly {
    readonly treatment: string;
    readonly recommended_action: string;
    readonly usable_for_decisive_argument: boolean;
    readonly guardrail: string;
  }[];
  readonly weak_points: readonly {
    readonly importance: string;
    readonly recommended_action: string;
    readonly guardrail: string;
  }[];
  readonly recommended_drafting_tone: string;
  readonly phrases_to_avoid: readonly string[];
  readonly model_procedural_formulation: string;
  readonly likely_decision_paths: readonly {
    readonly path: string;
    readonly strategic_action: string;
  }[];
  readonly drafting_strategy: {
    readonly reserve_or_drop: readonly unknown[];
    readonly economy_guardrail: string;
  };
}

interface AnalysisForTest {
  readonly strategic_legal_engine: StrategicEngineForTest;
}

interface SyntheticScenario {
  readonly id: string;
  readonly input: MultiroleInput;
  readonly expectsMixedCaseLaw?: boolean;
}

function verifiedEvidence(evidenceId: string, name: string, provesFactIds: readonly string[]) {
  return {
    evidenceId,
    name,
    provesFactIds,
    assertionSource: "source_document" as const,
    existenceStatus: "source_confirmed" as const,
    availabilityStatus: "available_to_tool" as const,
    contentVerificationStatus: "verified_against_document" as const,
    authenticityStatus: "confirmed" as const,
    inRecordStatus: "in_record_confirmed" as const,
    filingStatus: "already_filed" as const,
    admissibilityStatus: "admissible_confirmed" as const,
    novenStatus: "no_known_noven_issue" as const,
  };
}

function authorityGap(evidenceId: string, name: string, provesFactIds: readonly string[]) {
  return {
    evidenceId,
    name,
    provesFactIds,
    assertionSource: "authority" as const,
    existenceStatus: "source_confirmed" as const,
    availabilityStatus: "referenced_but_not_available" as const,
    contentVerificationStatus: "not_verified" as const,
    authenticityStatus: "unconfirmed" as const,
    inRecordStatus: "not_verified" as const,
    filingStatus: "not_verified" as const,
    admissibilityStatus: "admissibility_not_verified" as const,
    novenStatus: "not_verified" as const,
  };
}

function scenario(overrides: Partial<MultiroleInput>): MultiroleInput {
  return {
    caseType: "administrative",
    proceduralStage: "appeal",
    matterDescription:
      "Synthetic Swiss legal strategy validation with a bounded procedural dispute.",
    userObjective: "Obtain a traceable procedural formulation without overclaiming.",
    jurisdiction: {
      country: "CH",
      canton: "ZH",
      territorialJurisdiction: "ZH",
      subjectMatterJurisdiction: "administrative procedure",
      functionalJurisdiction: "appeal authority",
      issuingAuthority: "municipal authority",
      appellateAuthority: "cantonal appeal authority",
      proceduralRemedy: "appeal",
      venueOrFilingDestination: "cantonal appeal authority",
    },
    parties: [
      { role: "appellant", description: "Applicant A" },
      { role: "authority", description: "Administrative authority" },
    ],
    facts: [
      {
        id: "F-core",
        description: "A written request was filed before the challenged decision.",
        status: "confirmed",
        evidenceIds: ["E-core"],
      },
      {
        id: "F-adverse",
        description: "The applicant received at least a partial decision.",
        status: "confirmed",
        evidenceIds: ["E-decision"],
      },
      {
        id: "F-gap",
        description: "The authority file may contain further material on the same complex.",
        status: "uncertain",
        evidenceIds: ["E-authority-gap"],
      },
    ],
    evidence: [
      verifiedEvidence("E-core", "Filed request", ["F-core"]),
      verifiedEvidence("E-decision", "Partial decision", ["F-adverse"]),
      authorityGap("E-authority-gap", "Referenced authority file material", ["F-gap"]),
    ],
    norms: [{ id: "N-procedure", citation: "General procedural duty", status: "not_verified" }],
    caseLaw: [
      {
        id: "C-procedure",
        citation: "Synthetic official case reference",
        textStatus: "full_text_verified",
        relevance: "supports procedural clarification within a limited ratio",
      },
    ],
    challengedPassages: [
      {
        id: "P-inference",
        exactText: "The authority infers that the remaining request no longer matters.",
        author: "decision_authority",
        function: "evidence_assessment",
        autonomousGround: false,
        challenged: true,
        preserved: true,
      },
      {
        id: "P-weak",
        exactText: "A low-value secondary point is not decisive.",
        author: "opposing_party",
        function: "subsidiary_argument",
        autonomousGround: false,
      },
      {
        id: "P-law",
        exactText: "The legal consequence follows automatically.",
        author: "decision_authority",
        function: "legal_interpretation",
        autonomousGround: true,
        challenged: true,
      },
    ],
    burdenModel: {
      proceduralMaxim: "Untersuchungsgrundsatz",
      burdenHolder: "authority",
      legalBasisStatus: "requires_legal_review",
    },
    requestedOutcome: "remand",
    ...overrides,
  };
}

function run(input: MultiroleInput): StrategicEngineForTest {
  return (analyzeSwissLegalPositions(input) as AnalysisForTest).strategic_legal_engine;
}

const scenarios: readonly SyntheticScenario[] = [
  {
    id: "administrative_residual_omission",
    input: scenario({
      matterDescription:
        "Administrative dispute: request X was filed, the authority decided only Y, and a residual omission remains possible.",
      userObjective: "Seek a decision on the unresolved part without alleging nonexistence.",
      facts: [
        {
          id: "F-request-x",
          description: "Request X was filed in writing.",
          status: "confirmed",
          evidenceIds: ["E-request-x"],
        },
        {
          id: "F-decision-y",
          description: "The formal decision expressly resolves only Y.",
          status: "confirmed",
          evidenceIds: ["E-decision-y"],
        },
        {
          id: "F-residual",
          description: "The file does not yet show a formal ruling on the residual part of X.",
          status: "uncertain",
          evidenceIds: ["E-authority-file"],
        },
      ],
      evidence: [
        verifiedEvidence("E-request-x", "Request X", ["F-request-x"]),
        verifiedEvidence("E-decision-y", "Decision Y", ["F-decision-y"]),
        authorityGap("E-authority-file", "Authority file index", ["F-residual"]),
      ],
    }),
  },
  {
    id: "migration_document_vs_material_stay",
    input: scenario({
      caseType: "administrative",
      matterDescription:
        "Migration dispute: a valid residence card exists, but the material right of stay is contested.",
      facts: [
        {
          id: "F-card",
          description: "A residence card was valid on the relevant date.",
          status: "confirmed",
          evidenceIds: ["E-card"],
        },
        {
          id: "F-employment-ended",
          description: "The employment basis for the permit had ended.",
          status: "confirmed",
          evidenceIds: ["E-employment"],
        },
        {
          id: "F-material-right",
          description: "The material right of stay requires separate assessment.",
          status: "uncertain",
          evidenceIds: ["E-migration-file"],
        },
      ],
      evidence: [
        verifiedEvidence("E-card", "Valid residence card", ["F-card"]),
        verifiedEvidence("E-employment", "Employment termination notice", ["F-employment-ended"]),
        authorityGap("E-migration-file", "Migration authority file", ["F-material-right"]),
      ],
    }),
  },
  {
    id: "social_security_temporal_scope",
    input: scenario({
      caseType: "social_insurance",
      matterDescription:
        "Social security dispute: a benefit is partially recognized, but the temporal scope remains disputed.",
      facts: [
        {
          id: "F-partial-benefit",
          description: "Benefits were granted from March.",
          status: "confirmed",
          evidenceIds: ["E-benefit-decision"],
        },
        {
          id: "F-earlier-claim",
          description: "The application requested coverage from January.",
          status: "confirmed",
          evidenceIds: ["E-application"],
        },
        {
          id: "F-medical-file",
          description: "Earlier incapacity evidence is referenced but not fully available.",
          status: "uncertain",
          evidenceIds: ["E-medical-file"],
        },
      ],
      evidence: [
        verifiedEvidence("E-benefit-decision", "Benefit decision from March", [
          "F-partial-benefit",
        ]),
        verifiedEvidence("E-application", "Application with January date", ["F-earlier-claim"]),
        authorityGap("E-medical-file", "Insurer medical assessment file", ["F-medical-file"]),
      ],
    }),
  },
  {
    id: "tax_partial_proof_same_complex",
    input: scenario({
      caseType: "tax",
      matterDescription:
        "Tax dispute: the administration relies on one ledger extract while omitting linked documents from the same factual complex.",
      facts: [
        {
          id: "F-ledger",
          description: "A ledger extract is in the record.",
          status: "confirmed",
          evidenceIds: ["E-ledger"],
        },
        {
          id: "F-linked-docs",
          description: "The extract refers to underlying linked documents not currently available.",
          status: "uncertain",
          evidenceIds: ["E-linked-docs"],
        },
      ],
      evidence: [
        verifiedEvidence("E-ledger", "Tax administration ledger extract", ["F-ledger"]),
        authorityGap("E-linked-docs", "Linked tax audit documents", ["F-linked-docs"]),
      ],
    }),
  },
  {
    id: "license_decision_vs_prior_communications",
    input: scenario({
      caseType: "administrative",
      matterDescription:
        "License dispute: the formal refusal conflicts with prior communications saying the file was complete.",
      facts: [
        {
          id: "F-complete-email",
          description: "A prior official email stated that the file was complete.",
          status: "confirmed",
          evidenceIds: ["E-complete-email"],
        },
        {
          id: "F-refusal",
          description: "The later formal decision refused the license for missing documents.",
          status: "confirmed",
          evidenceIds: ["E-refusal"],
        },
        {
          id: "F-contradiction",
          description: "The completeness statement and refusal reason are not fully reconciled.",
          status: "contradicted",
          evidenceIds: ["E-complete-email", "E-refusal"],
        },
      ],
      evidence: [
        verifiedEvidence("E-complete-email", "Prior completeness email", ["F-complete-email"]),
        verifiedEvidence("E-refusal", "Formal refusal decision", ["F-refusal"]),
        authorityGap("E-license-file", "Internal license file chronology", ["F-contradiction"]),
      ],
      challengedPassages: [
        {
          id: "P-tone-risk",
          exactText: "The applicant says the office lied about the missing documents.",
          author: "appellant",
          function: "allegation",
          autonomousGround: false,
        },
        {
          id: "P-license-law",
          exactText: "The refusal is legally conclusive despite the earlier completeness email.",
          author: "decision_authority",
          function: "legal_interpretation",
          autonomousGround: true,
          challenged: true,
        },
        {
          id: "P-license-drop",
          exactText: "A decorative side issue about email etiquette is not decisive.",
          author: "appellant",
          function: "subsidiary_argument",
          autonomousGround: false,
        },
      ],
    }),
  },
  {
    id: "procedure_favorable_phrase_adverse_ratio",
    expectsMixedCaseLaw: true,
    input: scenario({
      caseType: "administrative",
      proceduralStage: "supreme_court",
      matterDescription:
        "Procedural dispute: an adverse judgment contains one favorable phrase, but its ratio limits the possible use.",
      facts: [
        {
          id: "F-adverse-outcome",
          description: "The cited judgment dismissed the comparable appeal.",
          status: "confirmed",
          evidenceIds: ["E-judgment"],
        },
        {
          id: "F-favorable-phrase",
          description: "The same judgment contains a favorable procedural phrase.",
          status: "confirmed",
          evidenceIds: ["E-judgment"],
        },
      ],
      evidence: [
        verifiedEvidence("E-judgment", "Full official judgment", ["F-adverse-outcome"]),
        authorityGap("E-court-file", "Lower procedural file", ["F-favorable-phrase"]),
      ],
      caseLaw: [
        {
          id: "C-adverse-ratio",
          citation: "Synthetic official judgment A-1/2026",
          textStatus: "full_text_verified",
          relevance:
            "favorable phrase on procedural diligence, but adverse outcome and ratio rejected relief because the request was late",
        },
      ],
      challengedPassages: [
        {
          id: "P-procedural-inference",
          exactText: "The court infers that the favorable phrase resolves every later case.",
          author: "reviewing_court",
          function: "evidence_assessment",
          autonomousGround: false,
        },
        {
          id: "P-procedural-law",
          exactText: "The legal consequence follows from the phrase despite the adverse ratio.",
          author: "appellant",
          function: "legal_interpretation",
          autonomousGround: false,
        },
        {
          id: "P-case-law-overuse",
          exactText: "A decorative favorable sentence should not carry the argument alone.",
          author: "appellant",
          function: "subsidiary_argument",
          autonomousGround: false,
        },
      ],
    }),
  },
];

describe("strategic legal engine adversarial validation", () => {
  it.each(scenarios)(
    "$id produces calibrated strategy output",
    ({ input, expectsMixedCaseLaw }) => {
      const engine = run(input);
      const propositionTypes = new Set(engine.issue_map.map((item) => item.proposition_type));

      expect(engine.issue_map.length).toBeGreaterThan(0);
      expect(engine.evidence_map.length).toBeGreaterThan(0);
      expect(engine.contradiction_map).toBeDefined();
      expect(engine.best_client_argument).not.toBeNull();
      expect(engine.best_client_argument?.best_counterargument).toBeTruthy();
      expect(engine.best_client_argument?.best_reply).toBeTruthy();
      expect(engine.best_client_argument?.residual_risk).toBeTruthy();
      expect(engine.argument_strategy_matrix.length).toBeGreaterThan(0);
      expect(engine.core_strengths).toContainEqual(
        expect.objectContaining({ strength_type: "CORE_STRENGTH" }),
      );
      expect(engine.evidence_requests).toContainEqual(
        expect.objectContaining({
          status: "AUTHORITY_CONTROLLED_EVIDENCE",
          caution: expect.stringContaining("do_not_treat_absence"),
        }),
      );
      expect(engine.strategic_concessions).toContainEqual(
        expect.objectContaining({ concession_type: "SAFE_CONCESSION" }),
      );
      expect(engine.weak_points).toContainEqual(
        expect.objectContaining({ importance: "DROP", recommended_action: "DROP" }),
      );
      expect(engine.likely_decision_paths.map((item) => item.path)).toEqual([
        "PATH_A_MAIN_ACCEPTED",
        "PATH_B_RECORD_COMPLETION",
        "PATH_C_DISMISS_OR_INADMISSIBLE",
      ]);
      expect(engine.recommended_drafting_tone).toContain("non-accusatory");
      expect(engine.phrases_to_avoid).toContain("lügt");
      expect(engine.model_procedural_formulation).not.toMatch(/lügt|miente|ocultó|fake/i);
      expect(engine.drafting_strategy.economy_guardrail).toContain("drop or subordinate");
      expect(propositionTypes.has("FACT")).toBe(true);
      expect(propositionTypes.has("INFERENCE")).toBe(true);
      expect(propositionTypes.has("LEGAL_CHARACTERIZATION")).toBe(true);
      expect(propositionTypes.has("ARGUMENT")).toBe(true);

      if (expectsMixedCaseLaw === true) {
        expect(engine.case_law_use).toContainEqual(
          expect.objectContaining({
            treatment: "MIXED",
            recommended_action: "SUBORDINATE",
            usable_for_decisive_argument: false,
            guardrail: "do_not_extract_favorable_sentence_without_ratio_and_outcome",
          }),
        );
      }
    },
  );
});
