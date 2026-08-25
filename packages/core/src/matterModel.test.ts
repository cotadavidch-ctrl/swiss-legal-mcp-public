import { describe, expect, it } from "vitest";
import {
  canUsePropositionAsFinalEvidence,
  evaluateHumanLockConflict,
  findTraceLinks,
  isCourtFinding,
  isSystemFinding,
  parseMatterModel,
  traceBackwardPath,
  traceForwardPath,
  type MatterModel,
  type ProceduralContext,
  type ProvenanceRef,
} from "./matterModel.js";

const retrievedAt = "2026-08-15T00:00:00.000Z";

const documentProvenance: ProvenanceRef = {
  type: "DOCUMENT_PASSAGE",
  document_id: "doc-1",
  passage_id: "passage-1",
  system_derivation_input_ids: [],
};

const systemProvenance: ProvenanceRef = {
  type: "SYSTEM_DERIVATION",
  system_derivation_input_ids: ["assertion-a", "evidence-1"],
};

const contextFirst: ProceduralContext = {
  stage: "FIRST_INSTANCE",
  local_stage_label: "initial authority procedure",
  date: "2026-01-10",
};

const contextAppeal: ProceduralContext = {
  stage: "ADMINISTRATIVE_APPEAL",
  local_stage_label: "appeal response",
  date: "2026-02-10",
};

function baseModel(): MatterModel {
  return parseMatterModel({
    matter: { id: "matter-1", title: "Synthetic administrative matter" },
    actors: [
      {
        id: "actor-a",
        matter_id: "matter-1",
        kind: "Actor",
        name: "Applicant",
        actor_type: "PERSON",
      },
      {
        id: "actor-b",
        matter_id: "matter-1",
        kind: "Actor",
        name: "Authority",
        actor_type: "AUTHORITY",
      },
    ],
    documents: [
      {
        id: "doc-1",
        matter_id: "matter-1",
        kind: "Document",
        title: "Official record",
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
        source_uri: "https://example.test/official-record",
        content_hash: "sha256:test",
        provenance: [
          {
            type: "OFFICIAL_SOURCE",
            official_source_id: "official-source-1",
          },
        ],
        created_at: retrievedAt,
      },
    ],
    passages: [
      {
        id: "passage-1",
        matter_id: "matter-1",
        kind: "Passage",
        document_id: "doc-1",
        locator: "p. 1",
        text: "The authority performed action Y.",
        provenance: [
          {
            type: "DOCUMENT_PASSAGE",
            document_id: "doc-1",
            passage_id: "passage-1",
          },
        ],
      },
    ],
    propositions: [
      {
        id: "p-action-y",
        matter_id: "matter-1",
        kind: "Proposition",
        text: "The authority performed action Y.",
        scope: "synthetic record",
        legal_or_factual_domain: "FACTUAL",
        granularity: "ATOMIC",
        source_passage_ids: ["passage-1"],
        provenance: [documentProvenance],
      },
      {
        id: "p-summary",
        matter_id: "matter-1",
        kind: "Proposition",
        text: "The case is generally favorable.",
        scope: "summary only",
        legal_or_factual_domain: "MIXED",
        granularity: "SUMMARY",
        provenance: [systemProvenance],
      },
    ],
  });
}

describe("Matter Model architecture invariants", () => {
  it("TEST A - preserves competing assertions without automatic finding", () => {
    const model = parseMatterModel({
      ...baseModel(),
      assertions: [
        {
          id: "assertion-a",
          matter_id: "matter-1",
          kind: "Assertion",
          actor_id: "actor-a",
          proposition_id: "p-action-y",
          stance: "AFFIRMS",
          procedural_context: contextFirst,
          provenance: [{ type: "PARTY_SUBMISSION", party_submission_id: "submission-a" }],
        },
        {
          id: "assertion-b",
          matter_id: "matter-1",
          kind: "Assertion",
          actor_id: "actor-b",
          proposition_id: "p-action-y",
          stance: "DENIES",
          procedural_context: contextFirst,
          provenance: [{ type: "PARTY_SUBMISSION", party_submission_id: "submission-b" }],
        },
      ],
      evidence: [
        {
          id: "evidence-1",
          matter_id: "matter-1",
          kind: "Evidence",
          evidence_type: "PASSAGE",
          document_id: "doc-1",
          passage_id: "passage-1",
          source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
          supported_proposition_ids: ["p-action-y"],
          evidence_use: "SUPPORT",
          provenance: [documentProvenance],
        },
      ],
      factual_findings: [],
    });

    expect(model.assertions).toHaveLength(2);
    expect(model.assertions.map((item) => item.stance).sort()).toEqual(["AFFIRMS", "DENIES"]);
    expect(model.factual_findings).toHaveLength(0);
  });

  it("TEST B - keeps legal burden separate from evidence control", () => {
    const model = parseMatterModel({
      ...baseModel(),
      issues: [
        {
          id: "issue-1",
          matter_id: "matter-1",
          kind: "Issue",
          text: "Who must substantiate proposition P?",
          issue_type: "EVIDENTIARY",
          proposition_ids: ["p-action-y"],
          provenance: [systemProvenance],
        },
      ],
      burden_assessments: [
        {
          id: "burden-1",
          matter_id: "matter-1",
          kind: "BurdenAssessment",
          issue_id: "issue-1",
          proposition_id: "p-action-y",
          burden_type: "BURDEN_OF_SUBSTANTIATION",
          bearer_actor_id: "actor-a",
          bearer_status: "KNOWN",
          legal_basis: "synthetic procedural rule",
          standard: "plausible substantiation",
          consequence_of_failure: "argument may remain unproven",
          status: "ASSESSED",
          procedural_context: contextFirst,
          provenance: [systemProvenance],
        },
      ],
      evidence_control_assessments: [
        {
          id: "control-1",
          matter_id: "matter-1",
          kind: "EvidenceControlAssessment",
          actor_id: "actor-b",
          document_id: "doc-1",
          proposition_id: "p-action-y",
          control_type: "ADMINISTRATIVE_FILE_CONTROL",
          basis: "document belongs to the authority file",
          requested_status: "REQUESTED",
          production_status: "NOT_PRODUCED",
          pending_status: "PENDING",
          confidence: 0.8,
          procedural_context: contextFirst,
          provenance: [documentProvenance],
        },
      ],
    });

    expect(model.burden_assessments[0]?.bearer_actor_id).toBe("actor-a");
    expect(model.evidence_control_assessments[0]?.actor_id).toBe("actor-b");
    expect(model.burden_assessments[0]?.kind).not.toBe(model.evidence_control_assessments[0]?.kind);
  });

  it("TEST C - separates legal characterization from factual finding and argument", () => {
    const model = parseMatterModel({
      ...baseModel(),
      legal_characterizations: [
        {
          id: "lc-1",
          matter_id: "matter-1",
          kind: "LegalCharacterization",
          author_type: "ACTOR",
          author_actor_id: "actor-a",
          target_proposition_ids: ["p-action-y"],
          relied_legal_proposition_ids: ["lp-1"],
          conclusion: "Action Y legally qualifies as decision Z.",
          characterization_type: "procedural_decision_characterization",
          status: "ASSERTED",
          provenance: [{ type: "PARTY_SUBMISSION", party_submission_id: "submission-a" }],
        },
      ],
      arguments: [
        {
          id: "arg-1",
          matter_id: "matter-1",
          kind: "Argument",
          relied_proposition_ids: ["p-action-y"],
          relied_legal_proposition_ids: ["lp-1"],
          text: "Therefore requirement Z is fulfilled.",
          provenance: [systemProvenance],
        },
      ],
    });

    expect(model.legal_characterizations[0]?.kind).toBe("LegalCharacterization");
    expect(model.arguments[0]?.kind).toBe("Argument");
    expect(model.factual_findings).toHaveLength(0);
    expect(() =>
      parseMatterModel({
        ...baseModel(),
        legal_characterizations: [
          {
            ...model.legal_characterizations[0],
            status: "SYSTEM_ASSESSED",
          },
        ],
      }),
    ).toThrow(/party legal characterization/i);
  });

  it("TEST D - source taxonomy prevents system findings from looking like court findings", () => {
    const model = parseMatterModel({
      ...baseModel(),
      factual_findings: [
        {
          id: "finding-system",
          matter_id: "matter-1",
          kind: "FactualFinding",
          proposition_id: "p-action-y",
          finding_source_type: "SYSTEM_ASSESSMENT",
          scope: "internal analysis",
          status: "ASSESSED_AS_PROVEN",
          provenance: [systemProvenance],
        },
        {
          id: "finding-court",
          matter_id: "matter-1",
          kind: "FactualFinding",
          proposition_id: "p-action-y",
          finding_source_type: "COURT",
          source_actor_id: "actor-b",
          scope: "final judgment",
          status: "FINAL",
          provenance: [{ type: "OFFICIAL_SOURCE", official_source_id: "judgment-1" }],
        },
      ],
    });

    expect(isSystemFinding(model.factual_findings[0]!)).toBe(true);
    expect(isCourtFinding(model.factual_findings[0]!)).toBe(false);
    expect(isCourtFinding(model.factual_findings[1]!)).toBe(true);
  });

  it("TEST E - keeps positions from different procedural stages", () => {
    const model = parseMatterModel({
      ...baseModel(),
      assertions: [
        {
          id: "assertion-first",
          matter_id: "matter-1",
          kind: "Assertion",
          actor_id: "actor-b",
          proposition_id: "p-action-y",
          stance: "DENIES",
          procedural_context: contextFirst,
          provenance: [{ type: "PARTY_SUBMISSION", party_submission_id: "first-response" }],
        },
        {
          id: "assertion-appeal",
          matter_id: "matter-1",
          kind: "Assertion",
          actor_id: "actor-b",
          proposition_id: "p-action-y",
          stance: "PARTIALLY_ACCEPTS",
          procedural_context: contextAppeal,
          provenance: [{ type: "PARTY_SUBMISSION", party_submission_id: "appeal-response" }],
        },
      ],
    });

    expect(model.assertions.map((item) => item.procedural_context?.stage)).toEqual([
      "FIRST_INSTANCE",
      "ADMINISTRATIVE_APPEAL",
    ]);
  });

  it("TEST F - preserves reverse trace from argument to evidence and legal authority", () => {
    const model = parseMatterModel({
      ...baseModel(),
      legal_authorities: [
        {
          id: "la-1",
          matter_id: "matter-1",
          kind: "LegalAuthority",
          authority_type: "CASE_LAW",
          citation: "Synthetic Case 1",
          official_source_uri: "https://example.test/case-1",
          source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
          provenance: [{ type: "OFFICIAL_SOURCE", official_source_id: "case-1" }],
        },
      ],
      legal_propositions: [
        {
          id: "lp-1",
          matter_id: "matter-1",
          kind: "LegalProposition",
          legal_authority_id: "la-1",
          locator: { considerandum: "E. 2.1" },
          text: "A favorable quotation must be applied through its ratio.",
          provenance: [{ type: "OFFICIAL_SOURCE", official_source_id: "case-1" }],
        },
      ],
      evidence: [
        {
          id: "evidence-1",
          matter_id: "matter-1",
          kind: "Evidence",
          evidence_type: "PASSAGE",
          document_id: "doc-1",
          passage_id: "passage-1",
          source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
          supported_proposition_ids: ["p-action-y"],
          evidence_use: "SUPPORT",
          provenance: [documentProvenance],
        },
      ],
      arguments: [
        {
          id: "arg-1",
          matter_id: "matter-1",
          kind: "Argument",
          relied_proposition_ids: ["p-action-y"],
          relied_legal_proposition_ids: ["lp-1"],
          text: "The argument relies on fact and law.",
          provenance: [
            {
              type: "SYSTEM_DERIVATION",
              system_derivation_input_ids: ["p-action-y", "lp-1"],
            },
          ],
        },
      ],
      trace_links: [
        {
          id: "trace-1",
          matter_id: "matter-1",
          from_id: "arg-1",
          to_id: "p-action-y",
          relation: "derives_from",
          provenance: [systemProvenance],
        },
        {
          id: "trace-2",
          matter_id: "matter-1",
          from_id: "p-action-y",
          to_id: "evidence-1",
          relation: "supports",
          provenance: [documentProvenance],
        },
        {
          id: "trace-3",
          matter_id: "matter-1",
          from_id: "evidence-1",
          to_id: "passage-1",
          relation: "derives_from",
          provenance: [documentProvenance],
        },
        {
          id: "trace-4",
          matter_id: "matter-1",
          from_id: "passage-1",
          to_id: "doc-1",
          relation: "derives_from",
          provenance: [documentProvenance],
        },
        {
          id: "trace-5",
          matter_id: "matter-1",
          from_id: "arg-1",
          to_id: "lp-1",
          relation: "relies_on",
          provenance: [systemProvenance],
        },
        {
          id: "trace-6",
          matter_id: "matter-1",
          from_id: "lp-1",
          to_id: "la-1",
          relation: "derives_from",
          provenance: [{ type: "OFFICIAL_SOURCE", official_source_id: "case-1" }],
        },
      ],
    });

    expect(traceForwardPath({ startId: "arg-1", traceLinks: model.trace_links })).toEqual(
      expect.arrayContaining([
        "arg-1",
        "p-action-y",
        "evidence-1",
        "passage-1",
        "doc-1",
        "lp-1",
        "la-1",
      ]),
    );
    expect(traceBackwardPath({ startId: "doc-1", traceLinks: model.trace_links })).toEqual(
      expect.arrayContaining(["doc-1", "passage-1", "evidence-1", "p-action-y", "arg-1"]),
    );
    expect(findTraceLinks({ traceLinks: model.trace_links, fromId: "arg-1" })).toHaveLength(2);
  });

  it("TEST G - requires explicit UNSOURCED when no traceable source exists", () => {
    const model = parseMatterModel({
      ...baseModel(),
      assertions: [
        {
          id: "assertion-unsourced",
          matter_id: "matter-1",
          kind: "Assertion",
          actor_id: "actor-a",
          proposition_id: "p-action-y",
          stance: "AFFIRMS",
          provenance: [{ type: "UNSOURCED", note: "reported without identifiable source" }],
        },
      ],
    });

    expect(model.assertions[0]?.provenance[0]?.type).toBe("UNSOURCED");
    expect(() =>
      parseMatterModel({
        ...baseModel(),
        assertions: [{ ...model.assertions[0], provenance: [] }],
      }),
    ).toThrow();
  });

  it("TEST H - supports composite parent plus atomic children and blocks SUMMARY evidence use", () => {
    const model = parseMatterModel({
      ...baseModel(),
      propositions: [
        ...baseModel().propositions,
        {
          id: "p-composite",
          matter_id: "matter-1",
          kind: "Proposition",
          text: "The document contains three independent statements.",
          scope: "document paragraph",
          legal_or_factual_domain: "FACTUAL",
          granularity: "COMPOSITE",
          source_passage_ids: ["passage-1"],
          provenance: [documentProvenance],
        },
        {
          id: "p-child-1",
          matter_id: "matter-1",
          kind: "Proposition",
          text: "First independent statement.",
          parent_proposition_id: "p-composite",
          scope: "document paragraph",
          legal_or_factual_domain: "FACTUAL",
          granularity: "ATOMIC",
          source_passage_ids: ["passage-1"],
          provenance: [documentProvenance],
        },
      ],
    });

    expect(model.propositions.find((item) => item.id === "p-child-1")?.parent_proposition_id).toBe(
      "p-composite",
    );
    expect(
      canUsePropositionAsFinalEvidence(model.propositions.find((item) => item.id === "p-summary")!),
    ).toBe(false);
    expect(() =>
      parseMatterModel({
        ...model,
        evidence: [
          {
            id: "evidence-summary",
            matter_id: "matter-1",
            kind: "Evidence",
            evidence_type: "DOCUMENT",
            document_id: "doc-1",
            source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
            supported_proposition_ids: ["p-summary"],
            evidence_use: "SUPPORT",
            provenance: [documentProvenance],
          },
        ],
      }),
    ).toThrow(/SUMMARY propositions/i);
  });

  it("TEST I - human lock conflict requires review and preserves existing state", () => {
    const result = evaluateHumanLockConflict({
      existing: {
        id: "p-action-y",
        reviewed_state: {
          status: "HUMAN_LOCKED",
          locked_by: "reviewer-1",
          locked_at: "2026-08-15T00:00:00.000Z",
        },
      },
      incomingContradictsExisting: true,
    });

    expect(result).toEqual({ status: "REVIEW_REQUIRED", overwriteAllowed: false });
  });

  it("TEST J - keeps material satisfaction separate from procedural decision", () => {
    const model = parseMatterModel({
      ...baseModel(),
      requests: [
        {
          id: "request-x",
          matter_id: "matter-1",
          kind: "Request",
          actor_id: "actor-a",
          request_type: "request_x",
          requested_object: "X",
          procedural_context: contextFirst,
          provenance: [{ type: "PARTY_SUBMISSION", party_submission_id: "request-x" }],
        },
      ],
      actions: [
        {
          id: "action-y",
          matter_id: "matter-1",
          kind: "Action",
          actor_id: "actor-b",
          action_type: "performed_y",
          material_satisfaction: "PARTIAL",
          procedural_context: contextFirst,
          provenance: [documentProvenance],
        },
      ],
      decisions: [
        {
          id: "decision-z",
          matter_id: "matter-1",
          kind: "Decision",
          actor_id: "actor-b",
          decision_type: "decision_z",
          decides_request_ids: [],
          operative_scope: "Z only",
          procedural_context: contextFirst,
          provenance: [documentProvenance],
        },
      ],
    });

    expect(model.actions[0]?.material_satisfaction).toBe("PARTIAL");
    expect(model.decisions[0]?.decides_request_ids).not.toContain("request-x");
    expect(model.requests[0]?.kind).not.toBe(model.actions[0]?.kind);
    expect(model.actions[0]?.kind).not.toBe(model.decisions[0]?.kind);
  });

  it("blocks metadata-only documents from full-text evidence use", () => {
    const metadataOnlyDocument = {
      id: "doc-metadata",
      matter_id: "matter-1",
      kind: "Document" as const,
      title: "Metadata record",
      source_status: "METADATA_ONLY" as const,
      provenance: [{ type: "OFFICIAL_SOURCE" as const, official_source_id: "metadata-record" }],
    };

    expect(() =>
      parseMatterModel({
        ...baseModel(),
        documents: [...baseModel().documents, metadataOnlyDocument],
        evidence: [
          {
            id: "evidence-metadata",
            matter_id: "matter-1",
            kind: "Evidence",
            evidence_type: "DOCUMENT",
            document_id: "doc-metadata",
            source_status: "METADATA_ONLY",
            supported_proposition_ids: ["p-action-y"],
            evidence_use: "FULL_TEXT_EVIDENCE",
            provenance: [{ type: "OFFICIAL_SOURCE", official_source_id: "metadata-record" }],
          },
        ],
      }),
    ).toThrow(/METADATA_ONLY documents/i);
  });

  it("requires SYSTEM_DERIVATION provenance to keep input ids", () => {
    expect(() =>
      parseMatterModel({
        ...baseModel(),
        arguments: [
          {
            id: "arg-bad",
            matter_id: "matter-1",
            kind: "Argument",
            text: "Unsupported system derivation.",
            provenance: [{ type: "SYSTEM_DERIVATION", system_derivation_input_ids: [] }],
          },
        ],
      }),
    ).toThrow(/SYSTEM_DERIVATION provenance requires input ids/i);
  });

  it("roundtrips a representative matter through JSON without losing trace state", () => {
    const original = parseMatterModel({
      ...baseModel(),
      assertions: [
        {
          id: "assertion-a",
          matter_id: "matter-1",
          kind: "Assertion",
          actor_id: "actor-a",
          proposition_id: "p-action-y",
          stance: "AFFIRMS",
          procedural_context: contextFirst,
          provenance: [{ type: "PARTY_SUBMISSION", party_submission_id: "submission-a" }],
        },
        {
          id: "assertion-b",
          matter_id: "matter-1",
          kind: "Assertion",
          actor_id: "actor-b",
          proposition_id: "p-action-y",
          stance: "DENIES",
          procedural_context: contextAppeal,
          provenance: [{ type: "PARTY_SUBMISSION", party_submission_id: "submission-b" }],
        },
      ],
      human_review_records: [
        {
          id: "review-1",
          matter_id: "matter-1",
          kind: "HumanReviewRecord",
          reviewer_actor_id: "actor-a",
          reviewed_object_id: "p-action-y",
          reviewed_object_kind: "Proposition",
          decision: "LOCKED",
          provenance: [{ type: "HUMAN_REVIEW", human_review_id: "review-1" }],
        },
      ],
      burden_assessments: [
        {
          id: "burden-t1",
          matter_id: "matter-1",
          kind: "BurdenAssessment",
          issue_id: "issue-1",
          proposition_id: "p-action-y",
          burden_type: "UNKNOWN",
          bearer_status: "TO_BE_DETERMINED",
          status: "TO_BE_DETERMINED",
          provenance: [systemProvenance],
        },
        {
          id: "burden-t2",
          matter_id: "matter-1",
          kind: "BurdenAssessment",
          issue_id: "issue-1",
          proposition_id: "p-action-y",
          burden_type: "BURDEN_OF_PROOF",
          bearer_actor_id: "actor-a",
          bearer_status: "KNOWN",
          status: "ASSESSED",
          supersedes_id: "burden-t1",
          provenance: [systemProvenance],
        },
      ],
      trace_links: [
        {
          id: "trace-1",
          matter_id: "matter-1",
          from_id: "assertion-a",
          to_id: "p-action-y",
          relation: "supports",
          provenance: [{ type: "PARTY_SUBMISSION", party_submission_id: "submission-a" }],
        },
      ],
    });

    const roundtripped = parseMatterModel(JSON.parse(JSON.stringify(original)));

    expect(roundtripped.assertions.map((item) => item.id)).toEqual(["assertion-a", "assertion-b"]);
    expect(roundtripped.assertions[1]?.procedural_context?.stage).toBe("ADMINISTRATIVE_APPEAL");
    expect(roundtripped.burden_assessments[1]?.supersedes_id).toBe("burden-t1");
    expect(roundtripped.human_review_records[0]?.decision).toBe("LOCKED");
    expect(roundtripped.trace_links[0]?.relation).toBe("supports");
  });

  it("supports mixed precedent application with favorable and adverse aspects", () => {
    const model = parseMatterModel({
      ...baseModel(),
      precedent_applications: [
        {
          id: "precedent-1",
          matter_id: "matter-1",
          kind: "PrecedentApplication",
          legal_authority_id: "la-1",
          issue_id: "issue-1",
          application: "MIXED",
          favorable_aspects: ["same procedural question"],
          adverse_aspects: ["different procedural posture"],
          ratio_respected: true,
          provenance: [{ type: "OFFICIAL_SOURCE", official_source_id: "case-1" }],
        },
      ],
    });

    expect(model.precedent_applications[0]?.application).toBe("MIXED");
    expect(() =>
      parseMatterModel({
        ...baseModel(),
        precedent_applications: [
          {
            id: "precedent-bad",
            matter_id: "matter-1",
            kind: "PrecedentApplication",
            legal_authority_id: "la-1",
            issue_id: "issue-1",
            application: "MIXED",
            favorable_aspects: ["same issue"],
            adverse_aspects: [],
            ratio_respected: true,
            provenance: [{ type: "OFFICIAL_SOURCE", official_source_id: "case-1" }],
          },
        ],
      }),
    ).toThrow(/MIXED precedent application/i);
  });

  it("rejects invalid version-history self references and cycles", () => {
    const burden = {
      id: "burden-a",
      matter_id: "matter-1",
      kind: "BurdenAssessment" as const,
      issue_id: "issue-1",
      proposition_id: "p-action-y",
      burden_type: "UNKNOWN" as const,
      bearer_status: "UNKNOWN" as const,
      status: "UNKNOWN" as const,
      provenance: [systemProvenance],
    };

    expect(() =>
      parseMatterModel({
        ...baseModel(),
        burden_assessments: [{ ...burden, supersedes_id: "burden-a" }],
      }),
    ).toThrow(/cannot supersede themselves/i);

    expect(() =>
      parseMatterModel({
        ...baseModel(),
        burden_assessments: [
          { ...burden, supersedes_id: "burden-b" },
          { ...burden, id: "burden-b", supersedes_id: "burden-a" },
        ],
      }),
    ).toThrow(/cannot contain cycles/i);
  });
});
