import { describe, expect, it } from "vitest";
import type { ProvenanceRef } from "@swiss-legal-mcp/core";
import type {
  ArgumentRemovalTest,
  MinimumWinningCase,
} from "@swiss-legal-mcp/litigation-intelligence";
import type { ProceduralRequest } from "@swiss-legal-mcp/procedural-intelligence";
import {
  buildConclusionPlan,
  buildDraftVersion,
  buildEvidentiaryRequestDraft,
  buildOpeningSummary,
  buildParagraph,
  buildRequestDraft,
  buildSectionPlan,
  calibrateCitationUse,
  calibrateContradictionLanguage,
  calibrateEvidenceLanguage,
  checkAdversarialCoverage,
  checkClaimRequestMismatch,
  checkConflictingArguments,
  checkFactTraceability,
  checkJudgePathCoverage,
  checkLegalTraceability,
  checkMinimumWinningCaseCoverage,
  checkPrecedentDrafting,
  checkProceduralAlignment,
  checkQuoteControl,
  createBeforeAfterRewrite,
  detectSentenceIssues,
  detectToneIssues,
  detectUnusedStrength,
  draftAssertionSchema,
  evaluateArgumentEconomy,
  evaluateCredibility,
  evaluateDraftingQuality,
  evaluateLength,
  evaluateRepetition,
  runFinalKillerQa,
  validateAutoRevisionBoundary,
  validateMultilingualText,
  type DraftAssertion,
  type DraftingInput,
  type QaFinding,
} from "./legalDraftingEngine.js";

const provenance: ProvenanceRef[] = [
  { type: "SYSTEM_DERIVATION", system_derivation_input_ids: ["phase-8-synthetic-input"] },
];

function assertion(overrides: Partial<DraftAssertion> = {}): DraftAssertion {
  return draftAssertionSchema.parse({
    draft_sentence_id: "s-1",
    text: "The record establishes the decisive fact.",
    assertion_type: "FACT",
    source_ids: ["source-1"],
    evidence_ids: ["evidence-1"],
    legal_proposition_ids: [],
    precedent_ids: [],
    qualification: "verified record statement",
    confidence: 0.8,
    provenance,
    human_review_state: "UNREVIEWED",
    ...overrides,
  });
}

const mwc: MinimumWinningCase = {
  view_type: "MINIMUM_WINNING_CASE",
  source_of_truth: false,
  claim_id: "claim-1",
  essential_facts: [
    {
      element_id: "fact-essential",
      element_type: "ESSENTIAL_FACT",
      status: "SATISFIED",
      explanation: "Essential fact.",
      provenance,
    },
  ],
  essential_evidence: [
    {
      element_id: "evidence-essential",
      element_type: "ESSENTIAL_EVIDENCE",
      status: "SATISFIED",
      explanation: "Essential evidence.",
      provenance,
    },
  ],
  essential_legal_propositions: [
    {
      element_id: "law-essential",
      element_type: "ESSENTIAL_LEGAL_PROPOSITION",
      status: "SATISFIED",
      explanation: "Essential legal proposition.",
      provenance,
    },
  ],
  essential_procedural_prerequisites: [
    {
      element_id: "procedure-essential",
      element_type: "ESSENTIAL_PROCEDURAL_PREREQUISITE",
      status: "SATISFIED",
      explanation: "Essential procedure.",
      provenance,
    },
  ],
  essential_remedy_elements: [
    {
      element_id: "request-essential",
      element_type: "ESSENTIAL_REMEDY_ELEMENT",
      status: "SATISFIED",
      explanation: "Essential request.",
      provenance,
    },
  ],
  nonessential_supporting_arguments: ["supporting-only"],
  satisfied: true,
  unresolved_essential_ids: [],
  provenance,
};

function proceduralRequest(overrides: Partial<ProceduralRequest> = {}): ProceduralRequest {
  return {
    request_id: "request-essential",
    matter_id: "matter-1",
    request_type: "MATERIAL_RELIEF",
    text_or_structured_relief: "The decision should be remanded for a lawful decision.",
    claim_ids: ["claim-1"],
    issue_ids: ["issue-1"],
    level: "PRIMARY",
    dependencies: ["fact-essential"],
    conditions: [],
    legal_basis: ["law-essential"],
    evidentiary_basis: ["evidence-essential"],
    procedural_basis: ["procedure-essential"],
    scope: "minimum necessary remedy",
    provenance,
    ...overrides,
  };
}

function draftingInput(overrides: Partial<DraftingInput> = {}): DraftingInput {
  return {
    matter_id: "matter-1",
    mode: "PROCEDURAL_NEUTRAL",
    audience: "ADMINISTRATIVE_AUTHORITY",
    language: "DE",
    structured_matter_available: true,
    issue_law_maps: [],
    legal_propositions: [],
    precedent_applications: [],
    contradictions: [],
    opponent_arguments: [],
    replies: [],
    removal_tests: [],
    judicial_paths: [],
    procedural_requests: [],
    request_optimizations: [],
    human_locked_ids: [],
    provenance,
    ...overrides,
  };
}

function expectFlag(findings: QaFinding[], flag: string): void {
  expect(findings.map((finding) => finding.flag)).toContain(flag);
}

describe("Phase 8 legal drafting engine", () => {
  it("A flags a material factual sentence without source as unsupported", () => {
    const findings = checkFactTraceability(
      assertion({ draft_sentence_id: "fact-no-source", source_ids: [], evidence_ids: [] }),
    );
    expectFlag(findings, "UNSUPPORTED_FACT");
    expect(findings[0]?.severity).toBe("BLOCKING");
  });

  it("B flags a legal proposition without verified authority trace", () => {
    const findings = checkLegalTraceability(
      assertion({
        draft_sentence_id: "law-no-authority",
        assertion_type: "LEGAL_CHARACTERIZATION",
        legal_proposition_ids: [],
      }),
    );
    expectFlag(findings, "UNSUPPORTED_LEGAL_PROPOSITION");
  });

  it("C detects accusatory language and proposes calibrated wording", () => {
    const findings = detectToneIssues("tone-1", "The authority lied about the decisive document.");
    expectFlag(findings, "ACCUSATORY_LANGUAGE");
    expect(findings[0]?.proposed_fix).toMatch(/available record/);
  });

  it("D accepts record-based calibrated contradiction wording", () => {
    const findings = detectToneIssues(
      "tone-2",
      "The available record does not support that account.",
    );
    expect(findings.some((finding) => finding.flag === "ACCUSATORY_LANGUAGE")).toBe(false);
    expectFlag(findings, "PROCEDURALLY_CALIBRATED");
  });

  it("E prevents mixed precedent from being drafted as purely favorable", () => {
    const findings = checkPrecedentDrafting({
      precedent_id: "precedent-mixed",
      application: "MIXED",
      drafted_as: "PURELY_FAVORABLE",
    });
    expectFlag(findings, "OVERSTATED_PRECEDENT");
    expectFlag(findings, "ADVERSE_CONTEXT_OMITTED");
  });

  it("F flags a winning argument without corresponding remedy", () => {
    expectFlag(checkProceduralAlignment({ remedy_gap: true }), "REMEDY_GAP");
  });

  it("G flags an evidence gap without evidentiary request", () => {
    expectFlag(
      checkProceduralAlignment({ evidentiary_request_gap: true }),
      "EVIDENTIARY_REQUEST_GAP",
    );
  });

  it("H flags omitted MinimumWinningCase essentials", () => {
    const findings = checkMinimumWinningCaseCoverage({
      minimum_winning_case: mwc,
      included_fact_ids: [],
      included_law_ids: [],
      included_evidence_ids: [],
      included_request_ids: [],
    });
    expectFlag(findings, "MWC_FACT_MISSING");
    expectFlag(findings, "MWC_LAW_MISSING");
    expectFlag(findings, "MWC_EVIDENCE_MISSING");
    expectFlag(findings, "MWC_REQUEST_MISSING");
  });

  it("I does not block a nonessential supporting argument omission", () => {
    const findings = checkMinimumWinningCaseCoverage({
      minimum_winning_case: mwc,
      included_fact_ids: ["fact-essential"],
      included_law_ids: ["law-essential"],
      included_evidence_ids: ["evidence-essential"],
      included_request_ids: ["request-essential"],
    });
    expect(findings).toHaveLength(0);
  });

  it("J flags missing answer to the strongest counterargument", () => {
    const findings = checkAdversarialCoverage({
      material_opponent_argument_ids: ["opp-strong"],
      addressed_opponent_argument_ids: [],
    });
    expectFlag(findings, "COUNTERARGUMENT_UNANSWERED");
  });

  it("K flags a strawman response when only weak opposition is answered", () => {
    const findings = checkAdversarialCoverage({
      material_opponent_argument_ids: ["opp-strong"],
      addressed_opponent_argument_ids: ["opp-strong"],
      answered_weak_only: true,
    });
    expectFlag(findings, "STRAWMAN_RESPONSE");
  });

  it("L flags distracting repetition", () => {
    const repeated = evaluateRepetition(
      Array.from({ length: 6 }, () => "The same core procedural point"),
    );
    expect(repeated.status).toBe("DISTRACTING_REPETITION");
  });

  it("M recommends DROP for irrelevant attractive arguments", () => {
    const removal: ArgumentRemovalTest = {
      view_type: "ARGUMENT_REMOVAL_TEST",
      source_of_truth: false,
      argument_id: "decorative-argument",
      effect: "DISTRACTING",
      case_still_reaches_requested_outcome: true,
      explanation: "Distracts from the minimum winning path.",
      matter_mutated: false,
      provenance,
    };
    const economy = evaluateArgumentEconomy([removal]);
    expect(economy.drop).toContain("decorative-argument");
    expectFlag(economy.warnings, "UNNECESSARY_ARGUMENT");
  });

  it("N flags direct contradiction rewritten as accusation", () => {
    const findings = detectToneIssues(
      "contradiction-accusatory",
      "The opponent concealed the direct contradiction.",
    );
    expectFlag(findings, "ACCUSATORY_LANGUAGE");
  });

  it("O produces calibrated contradiction language without accusation", () => {
    const text = calibrateContradictionLanguage({
      contradiction_status: "DIRECT",
      subject: "the date of the administrative response",
    });
    expect(text).toMatch(/direct inconsistency/);
    expect(
      detectToneIssues("contradiction-calibrated", text).some(
        (finding) => finding.flag === "ACCUSATORY_LANGUAGE",
      ),
    ).toBe(false);
  });

  it("P treats denial of proven adverse fact as credibility risk", () => {
    const result = evaluateCredibility({ denied_proven_adverse_fact: true });
    expect(result.status).toBe("CREDIBILITY_AT_RISK");
    expect(result.findings[0]?.severity).toBe("BLOCKING");
  });

  it("Q treats safe concession as positive or neutral credibility", () => {
    const result = evaluateCredibility({ safe_concession_used: true });
    expect(["CREDIBILITY_POSITIVE", "CREDIBILITY_NEUTRAL"]).toContain(result.status);
  });

  it("R flags strong evidence that exists but is unused", () => {
    const findings = detectUnusedStrength({
      strong_evidence_ids: ["evidence-strong"],
      used_evidence_ids: [],
    });
    expectFlag(findings, "UNUSED_STRONG_EVIDENCE");
  });

  it("S blocks mutually exclusive primary factual theories", () => {
    const findings = checkConflictingArguments({
      primary_theories: [
        { theory_id: "theory-a", compatible_with: [] },
        { theory_id: "theory-b", compatible_with: [] },
      ],
    });
    expectFlag(findings, "MUTUALLY_EXCLUSIVE");
    expect(findings[0]?.severity).toBe("BLOCKING");
  });

  it("T serializes DraftAssertion, DraftVersion, and QA structures", () => {
    const draftAssertion = assertion({ draft_sentence_id: "serializable" });
    const version = buildDraftVersion({
      draft_version_id: "draft-v1",
      created_at: "2026-08-15T00:00:00+02:00",
      mode: "PROCEDURAL_NEUTRAL",
      audience: "COURT",
      sections: buildSectionPlan(draftingInput()),
      assertions: [draftAssertion],
      paragraphs: [],
      requests: [],
      qa_summary: "Synthetic QA.",
      provenance,
    });
    const qa = runFinalKillerQa({ assertions: [draftAssertion], provenance });
    expect(JSON.parse(JSON.stringify(version)).draft_version_id).toBe("draft-v1");
    expect(JSON.parse(JSON.stringify(qa)).source_of_truth).toBe(false);
  });

  it("U requires human approval before dropping human-locked main theory", () => {
    const boundary = validateAutoRevisionBoundary({ change_type: "HUMAN_LOCKED_STRATEGY" });
    expect(boundary.allowed).toBe(false);
    expect(boundary.human_review).toBe("HUMAN_APPROVAL_REQUIRED");
  });

  it("V returns minor review or human approval when only manageable or drafting issues exist", () => {
    const qa = runFinalKillerQa({
      assertions: [assertion()],
      drafting_findings: detectToneIssues(
        "tone-simple",
        "The available record supports this procedural request.",
      ),
      provenance,
    });
    expect(["READY_WITH_MINOR_REVIEW", "READY_FOR_HUMAN_APPROVAL"]).toContain(qa.readiness);
    expect(qa.readiness).not.toBe("NOT_READY");
  });

  it("W returns NOT_READY for an essential unsupported fact", () => {
    const qa = runFinalKillerQa({
      assertions: [
        assertion({ draft_sentence_id: "unsupported", source_ids: [], evidence_ids: [] }),
      ],
      provenance,
    });
    expect(qa.readiness).toBe("NOT_READY");
    expect(qa.result).toBe("BLOCKING_ISSUES");
  });

  it("builds section, paragraph, opening, conclusion, request, evidence request, citation, and quote controls", () => {
    const sections = buildSectionPlan(
      draftingInput({
        minimum_winning_case: mwc,
        opponent_arguments: [{ argument_id: "opp-1" } as never],
        procedural_requests: [proceduralRequest()],
      }),
    );
    expect(sections.find((section) => section.section_type === "OPENING")?.priority).toBe(
      "DECISIVE",
    );
    expect(
      buildOpeningSummary({
        decisive_issue: "the request was not decided",
        requested_relief: "remand",
        minimum_winning_path: "the unresolved request remains procedurally material",
        mode: "LITIGATION_STRONG",
      }),
    ).toMatch(/decisive point/);
    expect(
      buildConclusionPlan({ decisive_path: "the minimum path", request_ids: ["request-essential"] })
        .status,
    ).toBe("CALIBRATED");
    expect(
      buildParagraph({
        paragraph_id: "p-1",
        proposition_or_issue: "issue",
        fact: "fact",
        evidence: "evidence",
        legal_rule: "rule",
        application: "application",
        consequence: "consequence",
        assertion_ids: ["s-1"],
        provenance,
      }).paragraph_id,
    ).toBe("p-1");
    expect(buildRequestDraft(proceduralRequest()).basis_ids).toContain("law-essential");
    expect(
      buildEvidentiaryRequestDraft({
        request_id: "evreq-1",
        requested_item: "internal file",
        requested_from: "authority",
        reason: "it bears on the disputed proposition",
        proposition_supported: "fact-essential",
        procedural_basis: ["procedure-essential"],
        limiting_language: "to the extent held by the authority",
        provenance,
      }).limiting_language,
    ).toMatch(/extent/);
    expect(
      calibrateCitationUse({
        citation_id: "citation-1",
        use_type: "PROCEDURAL_PRINCIPLE",
        status: "SUPPORTED",
        provenance,
      }).status,
    ).toBe("SUPPORTED");
    expect(
      checkQuoteControl(
        validateMultilingualText({
          text_id: "quote-1",
          language: "DE",
          original_text: "Original authority text.",
          translation_status: "ORIGINAL_QUOTE",
          source_id: "source-1",
          locator: "E. 1",
          verification_status: "VERIFIED",
        }),
      ),
    ).toHaveLength(0);
  });

  it("controls sentence length, evidence language, length, quality, legal gaps, judge paths, and before/after rewrites", () => {
    expect(
      detectSentenceIssues(
        "long",
        Array.from({ length: 40 }, (_, index) => `word${index}`).join(" "),
      ),
    ).not.toHaveLength(0);
    expect(
      calibrateEvidenceLanguage({
        evidence_status: "MISSING",
        proposition: "the asserted fact occurred",
      }),
    ).toMatch(/does not yet establish/);
    expect(evaluateLength({ page_count: 30, material_issue_count: 1 })).toBe("OVERLONG");
    expectFlag(
      checkProceduralAlignment({
        unsupported_request_ids: ["request-x"],
        eventual_relief_gap: true,
      }),
      "UNSUPPORTED_REQUEST",
    );
    expectFlag(
      checkJudgePathCoverage({
        skeptical_path_ids_unaddressed: ["path-1"],
        favorable_no_usable_remedy: true,
      }),
      "NO_USABLE_GRANTED_REMEDY",
    );
    expectFlag(
      checkClaimRequestMismatch({
        decisive_argument_ids: ["arg-1"],
        request_supporting_argument_ids: [],
      }),
      "REMEDY_GAP",
    );
    expect(evaluateDraftingQuality({ findings: [] }).STRUCTURE).toBe("GOOD");
    expect(
      createBeforeAfterRewrite({
        original: "The authority lied.",
        issue: "Accusatory tone.",
        revised: "The available record does not support the authority's account.",
        rationale: "Record-based wording is firmer and safer.",
      }).revised,
    ).toMatch(/available record/);
  });

  it("runs 10 synthetic drafting validation matters through drafting plus killer QA", () => {
    const syntheticMatters = [
      { name: "strong concise", assertions: [assertion()], extra: [] },
      {
        name: "strong bloated",
        assertions: [assertion()],
        extra: evaluateArgumentEconomy([
          {
            view_type: "ARGUMENT_REMOVAL_TEST",
            source_of_truth: false,
            argument_id: "repeat",
            effect: "REDUNDANT",
            case_still_reaches_requested_outcome: true,
            explanation: "redundant",
            matter_mutated: false,
            provenance,
          },
        ]).warnings,
      },
      {
        name: "mixed precedent",
        assertions: [assertion()],
        extra: checkPrecedentDrafting({
          precedent_id: "p",
          application: "MIXED",
          drafted_as: "PURELY_FAVORABLE",
        }),
      },
      {
        name: "unsupported decisive fact",
        assertions: [assertion({ source_ids: [], evidence_ids: [] })],
        extra: [],
      },
      {
        name: "safe concession",
        assertions: [assertion()],
        extra: evaluateCredibility({ safe_concession_used: true }).findings,
      },
      {
        name: "dangerous concession",
        assertions: [assertion()],
        extra: checkAdversarialCoverage({
          material_opponent_argument_ids: [],
          addressed_opponent_argument_ids: [],
          dangerous_concession: true,
        }),
      },
      {
        name: "strong evidence unused",
        assertions: [assertion()],
        extra: detectUnusedStrength({ strong_evidence_ids: ["strong"], used_evidence_ids: [] }),
      },
      {
        name: "remedy gap",
        assertions: [assertion()],
        extra: checkProceduralAlignment({ remedy_gap: true }),
      },
      {
        name: "aggressive contradiction",
        assertions: [assertion()],
        extra: detectToneIssues("aggr", "The authority manipulated the contradiction."),
      },
      {
        name: "mutually exclusive theories",
        assertions: [assertion()],
        extra: checkConflictingArguments({
          primary_theories: [
            { theory_id: "a", compatible_with: [] },
            { theory_id: "b", compatible_with: [] },
          ],
        }),
      },
    ];

    const results = syntheticMatters.map((matter) => ({
      name: matter.name,
      sections: buildSectionPlan(draftingInput()),
      qa: runFinalKillerQa({
        assertions: matter.assertions,
        procedural_findings: matter.extra,
        provenance,
      }),
    }));

    expect(results).toHaveLength(10);
    expect(results.every((result) => result.sections.length >= 13)).toBe(true);
    expect(results.find((result) => result.name === "strong concise")?.qa.readiness).toBe(
      "READY_FOR_HUMAN_APPROVAL",
    );
    expect(
      results.find((result) => result.name === "unsupported decisive fact")?.qa.readiness,
    ).toBe("NOT_READY");
    expect(
      results.find((result) => result.name === "mutually exclusive theories")?.qa.readiness,
    ).toBe("NOT_READY");
  });
});
