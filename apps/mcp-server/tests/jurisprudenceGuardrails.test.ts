import { describe, expect, it } from "vitest";
import {
  analyzeLegalAidClarificationDuty,
  assessCaseFullTextReading,
  eligibleForPrecedentialUse,
  evaluateCaseComparability,
  separateJudicialContent,
  verifyOfficialCaseReference,
} from "../src/tools/jurisprudenceGuardrails.js";

const legalAidOwnTransferFacts = [
  "The applicant seeks unentgeltliche Rechtspflege / AJG.",
  "A transfer between own accounts has the same holder, the same amount is traceable and the intermediate account had zero final balance.",
  "The authority detected an apparent third account and there is a risk of double-counting assets.",
];

describe("official federal and cantonal case verification", () => {
  it.each(["1B_352/2019", "4A_97/2026", "9C_785/2018"])(
    "verifies %s against official Bundesgericht metadata",
    (reference) => {
      const verification = verifyOfficialCaseReference(reference);

      expect(verification.status).toBe("officially_verified");
      expect(verification.officialSourceUrl).toContain("bger.ch");
      expect(verification.verifiedElements).toEqual([
        "reference",
        "date",
        "chamber",
        "matter",
        "support_passage",
      ]);
      expect(verification.evidence.some((item) => item.source === "official_bger")).toBe(true);
    },
  );

  it("keeps cantonal decisions as aggregator-only when no official cantonal source is integrated", () => {
    const verification = verifyOfficialCaseReference("AC/1124/2023");

    expect(verification.status).toBe("cantonal_aggregator_only");
    expect(verification.warnings).toContain("unofficial_source");
    expect(verification.warnings).toContain("official_source_not_found");
  });

  it("does not mark a nonexistent federal case as officially verified", () => {
    const verification = verifyOfficialCaseReference("4A_9999/2099");

    expect(verification.status).toBe("official_not_found");
    expect(verification.officialSourceUrl).toBeNull();
  });
});

describe("case comparability guardrails", () => {
  it("classifies 1B_352/2019 only as general analogy for AJG own-account transfers", () => {
    const evaluation = evaluateCaseComparability({
      reference: "1B_352/2019",
      targetMatterDescription: "legal aid AJG own account transfer and asset double-counting",
      targetProcedure: "administrative",
      targetFacts: legalAidOwnTransferFacts,
      referenceVerified: true,
    });

    expect(evaluation.classification).toBe("general_analogy");
    expect(evaluation.dimensions.sameMatter).toBe(false);
    expect(evaluation.warnings).toContain("analogy_only");
  });

  it("classifies 4A_97/2026 as limited analogy and never direct for asset double-counting", () => {
    const evaluation = evaluateCaseComparability({
      reference: "4A_97/2026",
      targetMatterDescription: "AJG legal aid own account transfer double-counting Kontoauszüge",
      targetProcedure: "administrative",
      targetFacts: legalAidOwnTransferFacts,
      referenceVerified: true,
    });

    expect(evaluation.classification).toBe("limited_analogy");
    expect(evaluation.classification).not.toBe("comparable_direct");
    expect(evaluation.dimensions.limitsAndDifferences).toContain(
      "formal_authenticity_not_asset_double_counting",
    );
  });

  it("classifies 9C_785/2018 as distinguishable", () => {
    const evaluation = evaluateCaseComparability({
      reference: "9C_785/2018",
      targetMatterDescription: "AJG legal aid own account transfer double-counting",
      targetProcedure: "administrative",
      targetFacts: legalAidOwnTransferFacts,
      referenceVerified: true,
    });

    expect(evaluation.classification).toBe("distinguishable");
    expect(evaluation.dimensions.sameLegalQuestion).toBe(false);
  });

  it("does not promote lexical overlap to direct comparability", () => {
    const evaluation = evaluateCaseComparability({
      reference: "4A_114/2013",
      targetMatterDescription:
        "Kontoauszüge rechtliches Gehör antizipierte Beweiswürdigung, but different legal question",
      targetProcedure: "civil",
      targetFacts: ["terminological overlap only"],
      referenceVerified: true,
    });

    expect(evaluation.classification).toBe("candidate_only");
    expect(evaluation.dimensions.limitsAndDifferences).toContain("lexical_overlap_only");
    expect(evaluation.warnings).toContain("full_text_not_read");
  });

  it("blocks direct comparability when all structural dimensions match but full text was not read", () => {
    const evaluation = evaluateCaseComparability({
      reference: "4A_114/2013",
      targetMatterDescription: "legal aid AJG own account transfer same amount double-counting",
      targetProcedure: "administrative legal aid",
      targetFacts: [
        "same holder",
        "same amount",
        "traceable transfer",
        "zero final balance",
        "clarifiable ambiguity",
      ],
      referenceVerified: true,
    });

    expect(evaluation.classification).toBe("candidate_only");
    expect(evaluation.dimensions.sameDeterminativeFacts).toBe(true);
    expect(evaluation.dimensions.sameLegalQuestion).toBe(true);
    expect(evaluation.confidence.comparability_confidence).toBeLessThan(0.1);
  });
});

describe("judicial content separation", () => {
  it.each(["AC/1124/2023", "AC/3617/2022", "4A_114/2013", "9C_785/2018"])(
    "separates judicial content for %s without attributing unverified material to the court",
    (reference) => {
      const separated = separateJudicialContent(reference);

      expect(separated.reference).toBe(reference);
      expect(separated.partyAllegations).toBeDefined();
      expect(separated.lowerAuthorityReasoning).toBeDefined();
      expect(separated.decidingCourtReasoning).toBeDefined();
      expect(separated.ratioDecidendi).toBeDefined();
      if (!separated.fullTextRead) {
        expect(separated.warnings).toContain("full_text_not_read");
      }
    },
  );
});

describe("strict full-text reading policy for precedents", () => {
  const completeOfficial = {
    reference: "4A_97/2026",
    sourceKind: "official" as const,
    sourceUrl: "https://www.bger.ch/example",
    retrievedAt: "2026-08-03T00:00:00.000Z",
    readingCompletedAt: "2026-08-03T00:01:00.000Z",
    documentHash: "a".repeat(64),
    fullText:
      "Sachverhalt. Prozessgeschichte. Die Beschwerdeführerin macht geltend. Die Vorinstanz erwog. Erwägungen. Die Beschwerde ist zulässig. Das Bundesgericht überprüft. Selbständige Alternativbegründung. Dispositiv. Kosten.",
    totalPages: 5,
    pagesRead: [1, 2, 3, 4, 5],
    sectionsRead: [
      "facts",
      "procedural_history",
      "party_arguments",
      "lower_authority_reasoning",
      "reasoning",
      "admissibility",
      "review_standard",
      "independent_grounds",
      "dispositive",
      "costs",
    ],
  };

  it("accepts a complete official judgment as full_text_verified_official", () => {
    const reading = assessCaseFullTextReading(completeOfficial);

    expect(reading.status).toBe("full_text_verified_official");
    expect(reading.full_text_verified_official).toBe(true);
    expect(reading.full_text_coverage_percentage).toBe(100);
    expect(reading.ratio_status).toBe("ratio_confirmed");
  });

  it("accepts complete aggregator text only as unofficial full-text reading", () => {
    const reading = assessCaseFullTextReading({
      ...completeOfficial,
      sourceKind: "unofficial_aggregator",
      sourceUrl: "https://entscheidsuche.ch/example",
    });

    expect(reading.status).toBe("full_text_read_unofficial");
    expect(reading.full_text_read_unofficial).toBe(true);
    expect(reading.full_text_verified_official).toBe(false);
    expect(reading.warnings).toContain("source_unofficial");
  });

  it.each([
    ["headnote only", "headnote" as const, "headnote_only"],
    ["misleading snippet", "snippet" as const, "snippet_only"],
  ])("keeps %s as candidate-only locator material", (_label, sourceKind, status) => {
    const reading = assessCaseFullTextReading({
      reference: "AC/1124/2023",
      sourceKind,
      sourceUrl: "https://example.test/case",
      sectionsRead: [],
    });

    expect(reading.status).toBe(status);
    expect(reading.warnings).toContain("full_text_not_read");
    expect(reading.warnings).toContain("candidate_only");
  });

  it("detects a later consideration that must be read before using an early passage", () => {
    const reading = assessCaseFullTextReading({
      ...completeOfficial,
      sectionsRead: ["facts", "reasoning", "dispositive"],
      totalPages: 4,
      pagesRead: [1, 2],
    });

    expect(reading.status).toBe("extraction_incomplete");
    expect(reading.coverage.unread_ranges).toContain("3-4");
    expect(reading.warnings).toContain("possible_context_loss");
  });

  it("requires review of two autonomous grounds and subsidiary grounds", () => {
    const reading = assessCaseFullTextReading({
      ...completeOfficial,
      sectionsRead: ["facts", "reasoning", "dispositive"],
    });

    expect(reading.coverage.independent_grounds_reviewed).toBe(false);
    expect(reading.warnings).toContain("independent_ground_not_reviewed");
    expect(reading.warnings).toContain("missing_independent_ground_review");
  });

  it.each([
    ["extraction incomplete", { extractionErrors: ["parser_timeout"] }, "extraction_incomplete"],
    ["without dispositif", { sectionsRead: ["facts", "reasoning"] }, "missing_dispositif"],
    ["without facts", { sectionsRead: ["reasoning", "dispositive"] }, "missing_factual_section"],
    ["officially accessible but not downloaded", { sectionsRead: [] }, "full_text_not_read"],
    ["pages omitted", { totalPages: 5, pagesRead: [1, 2, 4, 5] }, "extraction_incomplete"],
    [
      "truncated consideration numbering",
      { extractionErrors: ["consideration_gap"] },
      "extraction_incomplete",
    ],
  ])("degrades %s", (_label, overrides, warning) => {
    const reading = assessCaseFullTextReading({ ...completeOfficial, ...overrides });

    expect(reading.status).not.toBe("full_text_verified_official");
    expect(reading.warnings).toContain(warning);
    expect(reading.ratio_status).toBe("ratio_not_confirmed");
  });

  it("detects a long document read by sections with full coverage", () => {
    const reading = assessCaseFullTextReading({
      ...completeOfficial,
      totalPages: 12,
      pagesRead: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    });

    expect(reading.coverage.total_pages).toBe(12);
    expect(reading.coverage.coverage_percentage).toBe(100);
    expect(reading.coverage.unread_ranges).toEqual([]);
  });

  it("does not confuse party allegations or arbitrary-review summaries with confirmed ratio", () => {
    const reading = assessCaseFullTextReading({
      reference: "snippet",
      sourceKind: "snippet",
      fullText:
        "Die Beschwerdeführerin macht geltend, die Vorinstanz habe willkürlich entschieden.",
      sectionsRead: ["party_arguments", "review_standard"],
    });

    expect(reading.ratio_status).toBe("ratio_not_confirmed");
    expect(reading.warnings).toContain("missing_reasoning_section");
  });

  it("keeps obiter separate unless the full judgment is read", () => {
    const reading = assessCaseFullTextReading({
      ...completeOfficial,
      sectionsRead: ["facts", "reasoning", "dispositive", "independent_grounds"],
      extractionErrors: ["obiter_boundary_unverified"],
    });

    expect(reading.status).toBe("extraction_incomplete");
    expect(reading.warnings).toContain("extraction_incomplete");
  });

  it("blocks partial cases in procedural-strategy comparability", () => {
    const evaluation = evaluateCaseComparability({
      reference: "4A_114/2013",
      targetMatterDescription: "legal aid AJG own account transfer same amount double-counting",
      targetProcedure: "administrative legal aid",
      targetFacts: ["same holder", "same amount", "zero final balance"],
      referenceVerified: true,
    });

    expect(evaluation.classification).toBe("candidate_only");
    expect(evaluation.warnings).toContain("no_decisive_precedent_from_partial_text");
  });

  it("blocks snippet classification as general analogy", () => {
    const evaluation = evaluateCaseComparability({
      reference: "AC/1124/2023",
      targetMatterDescription: "Kontoauszüge rechtliches Gehör",
      referenceVerified: false,
    });

    expect(["candidate_only", "unverified_reference"]).toContain(evaluation.classification);
    expect(evaluation.classification).not.toBe("general_analogy");
  });

  it("records source mismatch and changed hashes", () => {
    const mismatch = assessCaseFullTextReading({
      ...completeOfficial,
      sourceMismatch: true,
      hashChanged: true,
    });

    expect(mismatch.warnings).toContain("full_text_source_mismatch");
    expect(mismatch.warnings).toContain("document_hash_changed");
    expect(mismatch.status).toBe("extraction_incomplete");
  });

  it("requires separate-opinion review when one exists", () => {
    const reading = assessCaseFullTextReading({
      ...completeOfficial,
      includesSeparateOpinion: true,
    });

    expect(reading.coverage.separate_opinions_reviewed).toBe(false);
    expect(reading.status).toBe("extraction_incomplete");
    expect(reading.warnings).toContain("separate_opinion_not_reviewed");
  });

  it("detects when the last consideration was not read", () => {
    const reading = assessCaseFullTextReading({
      ...completeOfficial,
      totalPages: 6,
      pagesRead: [1, 2, 3, 4, 5],
    });

    expect(reading.status).toBe("extraction_incomplete");
    expect(reading.coverage.unread_ranges).toContain("6");
  });

  it("only permits precedential use after full text and ratio checks pass", () => {
    expect(eligibleForPrecedentialUse(separateJudicialContent("4A_97/2026"))).toBe(true);
    expect(eligibleForPrecedentialUse(separateJudicialContent("4A_114/2013"))).toBe(false);
  });
});

describe("legal aid and Art. 56 ZPO guardrails", () => {
  it("does not infer unbeholfen automatically from missing counsel", () => {
    const result = analyzeLegalAidClarificationDuty({
      matterDescription: "unentgeltliche Rechtspflege AJG Art. 29 Abs. 3 BV",
      representation: "self-represented",
      canton: "GE",
      facts: ["The authority sent clear concrete requests and prior warnings."],
    });

    expect(result.unbeholfenAssessment.status).toBe("not_automatic");
    expect(result.unbeholfenAssessment.warnings).toContain(
      "self_represented_not_automatically_unbeholfen",
    );
    expect(result.proceduralLawBasis.art56Zpo).toBe("not_confirmed_direct_or_supplementary");
    expect(result.mandatoryCounterargument).toContain("Mitwirkungspflicht");
  });

  it("detects own-account transfer double-counting as arguable clarification issue, not automatic win", () => {
    const result = analyzeLegalAidClarificationDuty({
      matterDescription: "AJG legal aid Art. 29 Abs. 3 BV own account transfer",
      representation: "self-represented",
      canton: "GE",
      facts: legalAidOwnTransferFacts,
    });

    expect(result.evidentiaryPosture.category).toBe(
      "clarifiable_ambiguity_with_double_counting_risk",
    );
    expect(result.evidentiaryPosture.doubleCountingRisk).toBe(true);
    expect(result.evidentiaryPosture.clarificationDuty).toBe("arguable");
    expect(result.proceduralLawBasis.mitwirkungspflicht).toBe("must_be_addressed");
  });
});
