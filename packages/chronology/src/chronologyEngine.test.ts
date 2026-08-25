import { describe, expect, it } from "vitest";
import {
  analyzeAction,
  analyzeChronologyContradiction,
  analyzeContemporaneousLaterRecord,
  analyzeDecision,
  analyzeReasoningOperativeMismatch,
  analyzeRequest,
  analyzeRequestClarification,
  analyzeResponse,
  buildChronologyMap,
  buildKnowledgeTimeline,
  buildRequestDispositionMap,
  createChronologyEvent,
  createChronologyRelationship,
  detectDecidedWithoutRequest,
  detectDelaySignals,
  detectRequestedButNotDecided,
  protectHumanLockedChronologyValue,
  type ChronologyEvent,
} from "./chronologyEngine.js";
import {
  parseMatterModel,
  type Action,
  type Decision,
  type MatterModel,
  type ProvenanceRef,
  type Request,
  type Response,
} from "@swiss-legal-mcp/core";

const provenance: ProvenanceRef[] = [
  {
    type: "DOCUMENT_PASSAGE",
    document_id: "doc-1",
    passage_id: "passage-1",
    system_derivation_input_ids: [],
  },
];

function matter(): MatterModel {
  return parseMatterModel({
    matter: { id: "matter-1", title: "Synthetic chronology matter" },
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
        title: "Record",
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
        provenance: [{ type: "OFFICIAL_SOURCE", official_source_id: "official-record" }],
      },
    ],
    passages: [
      {
        id: "passage-1",
        matter_id: "matter-1",
        kind: "Passage",
        document_id: "doc-1",
        text: "Request and later procedural acts.",
        provenance,
      },
    ],
    evidence: [evidence("evidence-t1", "2026-01-01"), evidence("evidence-t2", "2026-02-01")],
  });
}

function request(id = "request-x", date = "2026-01-01", object = "X"): Request {
  return {
    id,
    matter_id: "matter-1",
    kind: "Request",
    actor_id: "actor-a",
    proposition_ids: [],
    request_type: "synthetic_request",
    requested_object: object,
    procedural_context: { stage: "FIRST_INSTANCE", date },
    provenance,
  };
}

function response(id = "response-1", date = "2026-01-02"): Response {
  return {
    id,
    matter_id: "matter-1",
    kind: "Response",
    actor_id: "actor-b",
    proposition_ids: [],
    response_type: "ANSWER",
    responds_to_request_id: "request-x",
    procedural_context: { stage: "FIRST_INSTANCE", date },
    provenance,
  };
}

function action(id = "action-y", date = "2026-01-03"): Action {
  return {
    id,
    matter_id: "matter-1",
    kind: "Action",
    actor_id: "actor-b",
    proposition_ids: [],
    action_type: "performed_y",
    material_satisfaction: "PARTIAL",
    procedural_context: { stage: "FIRST_INSTANCE", date },
    provenance,
  };
}

function decision(id = "decision-z", date = "2026-01-10", scope = "Z only"): Decision {
  return {
    id,
    matter_id: "matter-1",
    kind: "Decision",
    actor_id: "actor-b",
    proposition_ids: [],
    decision_type: "synthetic_decision",
    decides_request_ids: [],
    operative_scope: scope,
    procedural_context: { stage: "FIRST_INSTANCE", date },
    provenance,
  };
}

function evidence(id: string, date: string) {
  return {
    id,
    matter_id: "matter-1",
    kind: "Evidence" as const,
    evidence_type: "DOCUMENT" as const,
    document_id: "doc-1",
    source_status: "FULL_TEXT_VERIFIED_OFFICIAL" as const,
    supported_proposition_ids: [],
    evidence_use: "CONTEXT" as const,
    procedural_context: { stage: "FIRST_INSTANCE" as const, date },
    provenance,
  };
}

function event(
  id: string,
  type: ChronologyEvent["event_type"],
  date: string,
  objectIds: string[],
): ChronologyEvent {
  return createChronologyEvent({
    event_id: id,
    matter_id: "matter-1",
    event_type: type,
    actor_ids: ["actor-a"],
    object_ids: objectIds,
    date,
    temporal_precision: "EXACT_DATE",
    procedural_context: { stage: "FIRST_INSTANCE", date },
    source_documents: ["doc-1"],
    source_passages: ["passage-1"],
    provenance,
    confidence: 0.9,
    related_request_ids: type === "REQUEST_EVENT" ? objectIds : [],
    related_response_ids: type === "RESPONSE_EVENT" ? objectIds : [],
    related_action_ids: type === "ACTION_EVENT" ? objectIds : [],
    related_decision_ids: type === "DECISION_EVENT" ? objectIds : [],
  });
}

describe("Chronology Engine Phase 3", () => {
  it("A - response promise is linked but does not decide request", () => {
    const req = analyzeRequest({ request: request() });
    const res = analyzeResponse({
      response: response(),
      responseType: "PROMISE_TO_DECIDE",
      linkedRequestIds: [req.request_id],
    });
    const map = buildRequestDispositionMap({ request: req, responses: [res] });

    expect(res.linked_request_ids).toEqual(["request-x"]);
    expect(res.decides_request).toBe(false);
    expect(map.procedural_decision_status).toBe("NOT_DECIDED");
  });

  it("B - action can partially satisfy request while decision status remains independent", () => {
    const req = analyzeRequest({ request: request() });
    const act = analyzeAction({
      action: action(),
      actionType: "SERVICE_PROVIDED",
      relatedRequestIds: [req.request_id],
      materialSatisfaction: "PARTIALLY_SATISFIED",
      scope: "Y covers part of X",
      unresolvedRemainder: ["remaining component of X"],
    });
    const map = buildRequestDispositionMap({ request: req, actions: [act] });

    expect(map.material_satisfaction).toBe("PARTIALLY_SATISFIED");
    expect(map.procedural_decision_status).toBe("NOT_DECIDED");
    expect(act.legal_effect_inferred).toBe(false);
  });

  it("C - decision on Z does not automatically close request X", () => {
    const req = analyzeRequest({ request: request() });
    const dec = analyzeDecision({
      decision: decision(),
      requestsBeforeAuthority: [req.request_id],
      requestRelations: [
        {
          request_id: req.request_id,
          relation: "DOES_NOT_DECIDE",
          explanation: "Decision concerns Z.",
        },
      ],
    });
    const undecided = detectRequestedButNotDecided({
      request: req,
      decision: dec,
      requestScopeClear: true,
      decisionScopeClear: true,
      provenance,
    });

    expect(undecided.status).toBe("REQUESTED_BUT_NOT_DECIDED");
  });

  it("D - narrowing clarification remains in same request lineage", () => {
    const original = analyzeRequest({ request: request("request-x", "2026-01-01", "X broad") });
    const narrowed = analyzeRequestClarification({
      original,
      later: request("request-x-clarification", "2026-01-05", "X narrowed"),
      amendmentType: "NARROWING",
    });

    expect(narrowed.lineage_root_request_id).toBe(original.request_id);
    expect(narrowed.amendment_type).toBe("NARROWING");
  });

  it("E - decision that resolves X1 but leaves X2 is partial", () => {
    const req = analyzeRequest({ request: request() });
    const dec = analyzeDecision({
      decision: decision(),
      requestsBeforeAuthority: [req.request_id],
      mattersLeftOpen: ["X2"],
      requestRelations: [
        {
          request_id: req.request_id,
          relation: "PARTIALLY_DECIDES",
          explanation: "X1 resolved, X2 open.",
        },
      ],
    });
    const map = buildRequestDispositionMap({ request: req, decisions: [dec] });

    expect(map.procedural_decision_status).toBe("PARTIALLY_DECIDED");
    expect(map.unresolved_components).toContain("At least one request component remains open.");
  });

  it("F - reasoning broader than operative part is detected", () => {
    expect(
      analyzeReasoningOperativeMismatch({
        reasoningIssues: ["X", "Y"],
        operativeIssues: ["Y"],
      }),
    ).toBe("REASONING_BROADER_THAN_OPERATIVE");
  });

  it("G - response before request is temporal inconsistency", () => {
    const res = event("event-response", "RESPONSE_EVENT", "2026-01-01", ["response-1"]);
    const req = event("event-request", "REQUEST_EVENT", "2026-01-02", ["request-x"]);

    expect(analyzeChronologyContradiction({ earlier: res, later: req })).toBe(
      "TEMPORAL_INCONSISTENCY",
    );
  });

  it("H - later assertion versus contemporaneous record requires reconciliation, not lie inference", () => {
    const result = analyzeContemporaneousLaterRecord({
      contemporaneousEvidence: matter().evidence[0]!,
      laterAssertionId: "assertion-later",
      conflict: true,
      corroborated: true,
      provenance,
    });

    expect(result).toBe("REQUIRES_RECONCILIATION");
  });

  it("I - knowledge timeline does not treat T2 evidence as known at T1", () => {
    const m = matter();
    const timeline = buildKnowledgeTimeline({
      events: [
        event("event-e1", "EVIDENCE_EVENT", "2026-01-01", ["evidence-t1"]),
        event("event-e2", "EVIDENCE_EVENT", "2026-02-01", ["evidence-t2"]),
      ],
      evidence: m.evidence,
      assertions: ["assertion-1"],
      atDate: "2026-01-15",
    });

    expect(timeline.known_evidence_ids).toEqual(["evidence-t1"]);
    expect(timeline.unknown_evidence_ids).toEqual(["evidence-t2"]);
    expect(timeline.no_hindsight).toBe(true);
  });

  it("J - human locked request scope receives conflicting extraction as review required", () => {
    expect(
      protectHumanLockedChronologyValue({
        objectId: "request-x",
        reviewedState: {
          status: "HUMAN_LOCKED",
          locked_by: "reviewer-1",
          locked_at: "2026-08-15T00:00:00.000Z",
        },
        contradictoryExtraction: true,
      }),
    ).toEqual({ status: "REVIEW_REQUIRED", overwriteAllowed: false });
  });

  it("K - chronology survives serialization", () => {
    const rel = createChronologyRelationship({
      id: "rel-1",
      matter_id: "matter-1",
      from_event_id: "event-request",
      to_event_id: "event-response",
      temporal_relationship: "BEFORE",
      procedural_relationship: "RESPONDS_TO",
      confidence: 0.9,
      provenance,
    });
    const map = buildChronologyMap({
      events: [
        event("event-response", "RESPONSE_EVENT", "2026-01-02", ["response-1"]),
        event("event-request", "REQUEST_EVENT", "2026-01-01", ["request-x"]),
      ],
    });
    const roundtripped = JSON.parse(JSON.stringify({ map, rel })) as {
      map: typeof map;
      rel: typeof rel;
    };

    expect(roundtripped.map.ordered_events.map((item) => item.event_id)).toEqual([
      "event-request",
      "event-response",
    ]);
    expect(roundtripped.map.source_of_truth).toBe(false);
    expect(roundtripped.rel.procedural_relationship).toBe("RESPONDS_TO");
  });

  it("L - chronology event without provenance fails", () => {
    expect(() =>
      createChronologyEvent({
        ...event("event-bad", "REQUEST_EVENT", "2026-01-01", ["request-x"]),
        provenance: [],
      }),
    ).toThrow();
  });

  it("detects decided without identified request without assuming invalidity", () => {
    const dec = analyzeDecision({
      decision: decision(),
      requestsBeforeAuthority: [],
      requestRelations: [],
    });

    const result = detectDecidedWithoutRequest({
      decision: dec,
      knownRequestIds: ["request-x"],
      provenance,
    });

    expect(result.status).toBe("DECIDED_WITHOUT_IDENTIFIED_REQUEST");
    expect(result.permissibility_not_assessed).toBe(true);
  });

  it("models delay and silence signals without legal conclusion", () => {
    const req = analyzeRequest({ request: request() });
    const signals = detectDelaySignals({
      request: req,
      responses: [],
      decisions: [],
      asOfDate: "2026-02-01",
    });

    expect(signals).toEqual(
      expect.arrayContaining([
        "REQUEST_PENDING",
        "NO_RESPONSE_IDENTIFIED",
        "DECISION_PENDING",
        "DELAY_DURATION",
      ]),
    );
  });
});
