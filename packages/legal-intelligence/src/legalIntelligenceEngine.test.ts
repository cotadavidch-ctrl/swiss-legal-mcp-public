import { describe, expect, it } from "vitest";
import type {
  Claim,
  Evidence,
  LegalAuthority,
  LegalCharacterization,
  MatterModel,
  PrecedentApplication,
  Proposition,
  ProvenanceRef,
} from "@swiss-legal-mcp/core";
import type { RequestedButNotDecidedAnalysis } from "@swiss-legal-mcp/chronology";
import {
  adversePrecedentMapSchema,
  analyzeCherryPickingRisk,
  analyzePrecedentApplication,
  assessResearchSufficiency,
  buildClaimSupportMap,
  buildIssueLawMap,
  calibrateLegalLanguage,
  compareFactualSimilarity,
  compareProceduralSimilarity,
  createEnhancedClaimElements,
  detectLegalCategoryMismatch,
  enhancedLegalPropositionSchema,
  generateHumanReviewFlags,
  identifyIssueDependencies,
  precedentIntelligenceSchema,
  spotLegalIssues,
  statutoryInterpretationContextSchema,
  temporalApplicabilitySchema,
  verifyLegalPropositionAuthority,
} from "./legalIntelligenceEngine.js";

const provenance: ProvenanceRef[] = [
  { type: "SYSTEM_DERIVATION", system_derivation_input_ids: ["input-1"] },
];

const authority: LegalAuthority = {
  id: "auth-1",
  matter_id: "matter-1",
  kind: "LegalAuthority",
  authority_type: "CASE_LAW",
  citation: "BGE synthetic",
  source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
  provenance,
};

const matter: MatterModel = {
  matter: { id: "matter-1", title: "Synthetic matter", jurisdiction: "CH" },
  actors: [],
  documents: [],
  passages: [],
  propositions: [],
  assertions: [],
  evidence: [],
  factual_findings: [],
  requests: [],
  responses: [],
  actions: [],
  decisions: [],
  party_positions: [],
  issues: [],
  claims: [],
  legal_authorities: [],
  legal_propositions: [],
  arguments: [],
  human_review_records: [],
  evidentiary_assessments: [],
  burden_assessments: [],
  evidence_control_assessments: [],
  legal_characterizations: [],
  precedent_applications: [],
  significant_documentary_absences: [],
  contradiction_assessments: [],
  position_change_assessments: [],
  trace_links: [],
};

const temporalCurrent = temporalApplicabilitySchema.parse({
  status: "CURRENTLY_VALID",
  explanation: "Current version applies to current facts.",
});

const basePrecedent = precedentIntelligenceSchema.parse({
  authority_id: "auth-1",
  identity: "Synthetic Supreme Court Case",
  court: "Bundesgericht",
  date: "2025-01-01",
  procedural_posture: "administrative appeal",
  facts: ["authority decided a narrower request"],
  issue: "residual omission",
  holding: "Authorities must address the requested object.",
  ratio: "The operative part controls the decided object.",
  result: "ALLOW",
  relevant_consideranda: ["E. 3.2"],
  favorable_aspects: ["request/decision mismatch matters"],
  adverse_aspects: [],
  distinguishing_factors: [],
  source_quality: "FULL_TEXT_VERIFIED_OFFICIAL",
  material_verification: "MATERIAL_PROPOSITION_VERIFIED",
  temporal_relevance: temporalCurrent,
  recommended_use: "PRIMARY",
  provenance,
});

describe("Phase 5 legal intelligence", () => {
  it("A detects an issue candidate from chronology mismatch without making it dispositive automatically", () => {
    const mismatch: RequestedButNotDecidedAnalysis = {
      request_id: "req-1",
      status: "POSSIBLY_UNDECIDED",
      explanation: "Decision may not cover the requested object.",
      provenance,
    };
    const result = spotLegalIssues({ matter, requestDecisionMismatches: [mismatch] });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.category).toBe("DENIAL_OF_JUSTICE");
    expect(result.issues[0]?.status).toBe("ISSUE_CANDIDATE");
  });

  it("B marks a claim-dependent legal gap as material when claim elements need law", () => {
    const claim: Claim = {
      id: "claim-1",
      matter_id: "matter-1",
      kind: "Claim",
      claimant_actor_id: "actor-1",
      elements: [{ id: "el-1", proposition_id: "prop-1", status: "UNKNOWN", provenance }],
      remedies: [],
      issue_ids: [],
      provenance,
    };
    const result = spotLegalIssues({ matter: { ...matter, claims: [claim] } });
    expect(result.issues[0]?.category).toBe("APPLICABLE_LAW");
    expect(result.issues[0]?.status).toBe("ISSUE_MATERIAL");
  });

  it("C detects a legal authority that supports only a narrower proposition", () => {
    const verification = verifyLegalPropositionAuthority({
      authority,
      propositionText:
        "The authority must always grant relief automatically when a request is incomplete.",
      sourceText: "The authority must clarify material uncertainty before deciding relief.",
      surroundingText: "The duty depends on the concrete procedural posture.",
      result: "ALLOW",
      locatorMatched: true,
      provenance,
    });
    expect(verification.classification).toBe("OVERSTATED");
    expect(verification.verification_level).toBe("PROPOSITION_PARTIALLY_VERIFIED");
  });

  it("D treats a favorable passage in an adverse-result case as mixed", () => {
    const precedent = precedentIntelligenceSchema.parse({
      ...basePrecedent,
      result: "DISMISS",
      favorable_aspects: ["general duty to clarify"],
      adverse_aspects: ["claimant failed a prerequisite"],
    });
    const app = analyzePrecedentApplication({
      precedent,
      issueId: "issue-1",
      factualSimilarity: compareFactualSimilarity({
        precedent: {
          actor_type: "authority",
          legal_regime: "administrative",
          requested_remedy: "decision",
        },
        matter: {
          actor_type: "authority",
          legal_regime: "administrative",
          requested_remedy: "decision",
        },
      }),
      proceduralSimilarity: compareProceduralSimilarity({
        precedent: { procedural_posture: "appeal", requested_remedy: "remand", stage: "appeal" },
        matter: { procedural_posture: "appeal", requested_remedy: "remand", stage: "appeal" },
      }),
      provenance,
    });
    expect(app.application).toBe("MIXED");
    expect(app.cherry_picking_risk).toBe("MIXED_APPLICATION");
  });

  it("E classifies actually applicable adverse precedent as strongly adverse", () => {
    const precedent = precedentIntelligenceSchema.parse({
      ...basePrecedent,
      result: "DISMISS",
      favorable_aspects: [],
      adverse_aspects: ["same prerequisite was missing"],
    });
    const app = analyzePrecedentApplication({
      precedent,
      issueId: "issue-1",
      factualSimilarity: compareFactualSimilarity({
        precedent: {
          actor_type: "private",
          legal_regime: "social insurance",
          requested_remedy: "arrears",
          factual_trigger: "partial award",
          chronology: "same period",
          evidence_posture: "documented",
          jurisdiction: "CH",
          temporal_law: "same",
        },
        matter: {
          actor_type: "private",
          legal_regime: "social insurance",
          requested_remedy: "arrears",
          factual_trigger: "partial award",
          chronology: "same period",
          evidence_posture: "documented",
          jurisdiction: "CH",
          temporal_law: "same",
        },
      }),
      proceduralSimilarity: compareProceduralSimilarity({
        precedent: { procedural_posture: "appeal", requested_remedy: "dismissal", stage: "merits" },
        matter: { procedural_posture: "appeal", requested_remedy: "dismissal", stage: "merits" },
      }),
      provenance,
    });
    expect(app.application).toBe("STRONGLY_ADVERSE");
  });

  it("F marks same-principle but materially different facts as distinguishable", () => {
    const app = analyzePrecedentApplication({
      precedent: basePrecedent,
      issueId: "issue-1",
      factualSimilarity: compareFactualSimilarity({
        precedent: { actor_type: "authority", legal_regime: "tax", requested_remedy: "documents" },
        matter: { actor_type: "private", legal_regime: "migration", requested_remedy: "permit" },
      }),
      proceduralSimilarity: compareProceduralSimilarity({
        precedent: {
          procedural_posture: "first instance",
          requested_remedy: "documents",
          stage: "investigation",
        },
        matter: { procedural_posture: "appeal", requested_remedy: "remand", stage: "appeal" },
      }),
      provenance,
    });
    expect(app.application).toBe("DISTINGUISHABLE");
    expect(app.procedural_similarity.similarity).toBe("DISTINCT");
  });

  it("G flags temporal law when the relevant date predates the current version", () => {
    const temporal = temporalApplicabilitySchema.parse({
      status: "REQUIRES_HISTORICAL_VERIFICATION",
      relevant_date: "2022-01-01",
      version_date: "2026-01-01",
      explanation: "The supplied text is current, but the facts occurred before amendment.",
    });
    const flags = generateHumanReviewFlags({
      issueId: "issue-1",
      temporalApplicability: temporal,
      provenance,
    });
    expect(flags[0]?.reason).toBe("STATUTE_VERSION_UNCERTAIN");
  });

  it("H treats aggregator-only cases as discovery value requiring official verification", () => {
    const aggregator = precedentIntelligenceSchema.parse({
      ...basePrecedent,
      source_quality: "SECONDARY_SOURCE",
      material_verification: "IDENTITY_ONLY",
      recommended_use: "DISCOVERY_ONLY",
    });
    const app = analyzePrecedentApplication({
      precedent: aggregator,
      issueId: "issue-1",
      factualSimilarity: compareFactualSimilarity({ precedent: {}, matter: {} }),
      proceduralSimilarity: compareProceduralSimilarity({ precedent: {}, matter: {} }),
      provenance,
    });
    expect(app.application).toBe("INSUFFICIENTLY_VERIFIED");
  });

  it("I creates a claim element legal gap when facts are proven but governing legal element is missing", () => {
    const elements = createEnhancedClaimElements({
      claimElements: [{ id: "el-1", proposition_id: "prop-1", status: "SATISFIED", provenance }],
      legalPropositionIds: ["lp-1"],
      evidenceIdsByPropositionId: new Map([["prop-1", ["ev-1"]]]),
      provenance,
    });
    expect(elements.some((element) => element.status === "LEGAL_GAP")).toBe(true);
  });

  it("J preserves issue dependencies", () => {
    const dependencies = identifyIssueDependencies({
      issues: [
        { issue_id: "admissibility", category: "ADMISSIBILITY" },
        { issue_id: "remedy", category: "REMEDY" },
      ],
      provenance,
    });
    expect(dependencies[0]?.dependency_type).toBe("PREREQUISITE");
  });

  it("K identifies cherry-picking risk when favorable quote has limiting context", () => {
    const risk = analyzeCherryPickingRisk(
      precedentIntelligenceSchema.parse({
        ...basePrecedent,
        result: "DISMISS",
        adverse_aspects: ["exception not met"],
        distinguishing_factors: ["different procedural posture"],
      }),
    );
    expect(risk.risk).toBe("MIXED_APPLICATION");
    expect(risk.required_disclosures.length).toBeGreaterThan(0);
  });

  it("L records that no adverse precedent was located without asserting none exists", () => {
    const map = adversePrecedentMapSchema.parse({
      view_type: "ADVERSE_PRECEDENT_MAP",
      source_of_truth: false,
      issue_id: "issue-1",
      adverse_precedent_ids: [],
      none_located: true,
      none_exists_asserted: false,
      search_scope: "offline synthetic adapter returned no adverse cases",
      limitations: ["No external search performed."],
      provenance,
    });
    expect(map.none_located).toBe(true);
    expect(map.none_exists_asserted).toBe(false);
  });

  it("M detects legal category mismatch without automatic recharacterization", () => {
    const mismatch = detectLegalCategoryMismatch({
      factualEventId: "event-1",
      currentCategory: "residence document",
      alternativeCategories: ["material residence right", "procedural status"],
      supportingFacts: ["valid document but contested substantive right"],
      provenance,
    });
    expect(mismatch.status).toBe("ALTERNATIVE_CHARACTERIZATION");
    expect(mismatch.no_automatic_switch).toBe(true);
  });

  it("N marks research weak when there is only favorable secondary material", () => {
    const sufficiency = assessResearchSufficiency({
      issueId: "issue-1",
      governingLawFound: false,
      applicableVersionChecked: false,
      favorableCaseChecked: true,
      adverseCaseChecked: false,
      citationMateriallyVerified: false,
      officialSourcePresent: false,
    });
    expect(sufficiency.status).toBe("RESEARCH_WEAK");
  });

  it("O serializes and roundtrips derived legal intelligence structures", () => {
    const proposition: Proposition = {
      id: "prop-1",
      matter_id: "matter-1",
      kind: "Proposition",
      text: "A request was made.",
      scope: "synthetic fact",
      legal_or_factual_domain: "FACTUAL",
      granularity: "ATOMIC",
      source_passage_ids: [],
      provenance,
    };
    const evidence: Evidence = {
      id: "ev-1",
      matter_id: "matter-1",
      kind: "Evidence",
      evidence_type: "DOCUMENT",
      source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
      supported_proposition_ids: ["prop-1"],
      document_id: "doc-1",
      evidence_use: "FULL_TEXT_EVIDENCE",
      provenance,
    };
    const claim: Claim = {
      id: "claim-1",
      matter_id: "matter-1",
      kind: "Claim",
      claimant_actor_id: "actor-1",
      elements: [{ id: "el-1", proposition_id: "prop-1", status: "SATISFIED", provenance }],
      remedies: [{ remedy_type: "remand", requested_text: "Remand", status: "MAIN", provenance }],
      issue_ids: ["issue-1"],
      provenance,
    };
    const precedentApplication: PrecedentApplication = {
      id: "pa-1",
      matter_id: "matter-1",
      kind: "PrecedentApplication",
      legal_authority_id: "auth-1",
      issue_id: "issue-1",
      application: "SUPPORTIVE",
      favorable_aspects: ["same issue"],
      adverse_aspects: [],
      ratio_respected: true,
      provenance,
    };
    const legalProposition = {
      id: "lp-1",
      matter_id: "matter-1",
      kind: "LegalProposition" as const,
      legal_authority_id: "auth-1",
      text: "Authorities must decide requests.",
      provenance,
    };
    const map = buildClaimSupportMap({
      claim,
      propositions: [proposition],
      evidence: [evidence],
      legalPropositions: [legalProposition],
      legalAuthorities: [authority],
      precedentApplications: [precedentApplication],
      provenance,
    });
    const issueLawMap = buildIssueLawMap({
      issueId: "issue-1",
      authorities: [authority],
      legalPropositions: [legalProposition],
      favorablePrecedents: [basePrecedent],
      adversePrecedents: [],
      temporalApplicability: [temporalCurrent],
      materiality: "HIGH",
      provenance,
    });
    const enhanced = enhancedLegalPropositionSchema.parse({
      id: "elp-1",
      authority_id: "auth-1",
      original_text: "Authorities must decide requests.",
      normalized_proposition: "Authorities must decide requests.",
      proposition_type: "GENERAL_LEGAL_PRINCIPLE",
      verification_status: "MATERIAL_PROPOSITION_VERIFIED",
      temporal_applicability: temporalCurrent,
      jurisdiction: "CH",
      hierarchy: {
        source_type: "FEDERAL_SUPREME_COURT_PRECEDENT",
        official_status: "OFFICIAL",
        binding_effect_if_known: "UNKNOWN",
        persuasive_weight: "HIGH",
        jurisdiction_scope: "Swiss federal",
        temporal_scope: "current",
      },
      scope: "procedural decision duty",
      provenance,
    });
    const statutory = statutoryInterpretationContextSchema.parse({
      authority_id: "auth-statute",
      text: "Synthetic statutory text",
      version: "current",
      transitional_provisions_known: false,
      external_history_not_inferred: true,
      provenance,
    });
    const language = calibrateLegalLanguage({
      application: analyzePrecedentApplication({
        precedent: basePrecedent,
        issueId: "issue-1",
        factualSimilarity: compareFactualSimilarity({
          precedent: {
            actor_type: "authority",
            legal_regime: "administrative",
            requested_remedy: "decision",
          },
          matter: {
            actor_type: "authority",
            legal_regime: "administrative",
            requested_remedy: "decision",
          },
        }),
        proceduralSimilarity: compareProceduralSimilarity({
          precedent: { procedural_posture: "appeal", requested_remedy: "remand", stage: "appeal" },
          matter: { procedural_posture: "appeal", requested_remedy: "remand", stage: "appeal" },
        }),
        provenance,
      }),
    });
    expect(
      JSON.parse(JSON.stringify({ map, issueLawMap, enhanced, statutory, language })),
    ).toMatchObject({
      map: { source_of_truth: false },
      issueLawMap: { source_of_truth: false },
      enhanced: { verification_status: "MATERIAL_PROPOSITION_VERIFIED" },
      statutory: { external_history_not_inferred: true },
    });
  });

  it("does not equate case identity with proposition verification", () => {
    const metadataOnly = verifyLegalPropositionAuthority({
      authority: { ...authority, source_status: "METADATA_ONLY" },
      propositionText: "Synthetic proposition",
      provenance,
    });
    expect(metadataOnly.verification_level).toBe("IDENTITY_ONLY");
    expect(metadataOnly.classification).not.toBe("SUPPORTED");
  });

  it("keeps legal characterizations from switching categories without review", () => {
    const characterization: LegalCharacterization = {
      id: "lc-1",
      matter_id: "matter-1",
      kind: "LegalCharacterization",
      author_type: "SYSTEM",
      target_proposition_ids: ["prop-1"],
      target_finding_ids: [],
      relied_legal_proposition_ids: [],
      conclusion: "event may be both evidence and procedural omission",
      characterization_type: "ambiguous",
      status: "SYSTEM_ASSESSED",
      confidence: 0.55,
      provenance,
    };
    const result = spotLegalIssues({ matter, legalCharacterizations: [characterization] });
    expect(result.issues[0]?.status).toBe("ISSUE_CANDIDATE");
  });
});
