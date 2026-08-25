type FactStatus =
  | "confirmed"
  | "accepted_for_drafting"
  | "disputed"
  | "uncertain"
  | "user_asserted"
  | "source_asserted"
  | "contradicted"
  | "not_verified"
  | "unavailable";

type EvidenceControl =
  | "CLIENT_CONTROLLED"
  | "OPPONENT_CONTROLLED"
  | "AUTHORITY_CONTROLLED"
  | "THIRD_PARTY_CONTROLLED"
  | "PUBLICLY_ACCESSIBLE"
  | "UNKNOWN";

type ArgumentImportance = "DECISIVE" | "HIGH" | "SUPPORTING" | "SUBSIDIARY" | "RESERVE" | "DROP";
type RecommendedRole =
  | "MAIN_ARGUMENT"
  | "SECONDARY_ARGUMENT"
  | "EVENTUAL_ARGUMENT"
  | "EVIDENTIARY_REQUEST"
  | "PROCEDURAL_POINT"
  | "DO_NOT_USE";
type RecommendedAction =
  "KEEP" | "STRENGTHEN" | "REFORMULATE" | "SUBORDINATE" | "VERIFY" | "REQUEST_EVIDENCE" | "DROP";
type PropositionType = "FACT" | "INFERENCE" | "LEGAL_CHARACTERIZATION" | "ARGUMENT";
type CaseLawTreatment = "SUPPORTIVE" | "MIXED" | "ADVERSE" | "UNVERIFIED";

interface StrategicFact {
  readonly id: string;
  readonly description: string;
  readonly status: FactStatus;
  readonly evidenceIds?: readonly string[];
}

interface StrategicEvidence {
  readonly evidenceId: string;
  readonly name: string;
  readonly provesFactIds?: readonly string[];
  readonly assertionSource?:
    "user" | "source_document" | "authority" | "opposing_party" | "inferred" | "unknown";
  readonly existenceStatus?: string;
  readonly availabilityStatus?: string;
  readonly contentVerificationStatus?: string;
  readonly inRecordStatus?: string;
  readonly filingStatus?: string;
  readonly usable_as_current_support?: boolean;
  readonly proposed_evidence_only?: boolean;
}

interface StrategicCaseLaw {
  readonly id: string;
  readonly citation: string;
  readonly textStatus: string;
  readonly relevance?: string;
  readonly usable?: boolean;
}

interface StrategicPassage {
  readonly id: string;
  readonly exactText: string;
  readonly author: string;
  readonly function: string;
  readonly autonomousGround?: boolean;
  readonly challenged?: boolean;
  readonly preserved?: boolean;
  readonly classification_status?: string;
}

interface StrategicArgument {
  readonly argument_id?: string;
  readonly role?: string;
  readonly proposition?: string;
  readonly argument_type?: string;
  readonly supporting_facts?: readonly string[];
  readonly alleged_facts?: readonly string[];
  readonly supporting_evidence?: readonly string[];
  readonly proposed_evidence?: readonly string[];
  readonly supporting_norms?: readonly string[];
  readonly supporting_case_law?: readonly string[];
  readonly vulnerabilities?: readonly string[];
  readonly counterarguments?: readonly string[];
  readonly rebuttal?: string;
}

interface StrategicRoleAnalysis {
  readonly role: string;
  readonly strongest_arguments?: readonly StrategicArgument[];
  readonly weakest_arguments?: readonly string[];
}

export interface StrategicLegalEngineInput {
  readonly matterDescription: string;
  readonly userObjective?: string;
  readonly facts: readonly StrategicFact[];
  readonly evidence: readonly StrategicEvidence[];
  readonly caseLaw: readonly StrategicCaseLaw[];
  readonly challengedPassages: readonly StrategicPassage[];
  readonly roleAnalyses: readonly StrategicRoleAnalysis[];
}

export function buildStrategicLegalEngine(input: StrategicLegalEngineInput) {
  const evidenceControl = input.evidence.map((item) => buildEvidenceControl(item));
  const issueMap = buildIssueMap(input);
  const evidenceMap = buildEvidenceMap(input, evidenceControl);
  const argumentStrategyMatrix = input.roleAnalyses.flatMap((role) =>
    (role.strongest_arguments ?? []).map((argument, index) =>
      buildArgumentStrategy(role.role, argument, index, input, evidenceControl),
    ),
  );
  const contradictionAnalysis = buildContradictionAnalysis(input);
  const contradictionMap = contradictionAnalysis;
  const toneCalibration = calibrateTone([
    input.matterDescription,
    input.userObjective ?? "",
    ...input.challengedPassages.map((passage) => passage.exactText),
  ]);
  const strengths = buildCoreStrengths(input);
  const concessions = buildStrategicConcessions(input);
  const caseLawUse = buildCaseLawUse(input);
  const weakPoints = buildWeakPoints(input);
  const decisionPaths = buildDecisionPaths(input, argumentStrategyMatrix);
  const draftingStrategy = buildDraftingStrategy(
    argumentStrategyMatrix,
    contradictionAnalysis,
    strengths,
    toneCalibration,
    weakPoints,
  );
  const evidenceRequests = evidenceControl.filter(
    (item) => item.recommended_request !== "use_as_documentary_support",
  );
  const bestClientArgument =
    argumentStrategyMatrix.find((item) => item.recommended_role === "MAIN_ARGUMENT") ??
    argumentStrategyMatrix.find((item) => item.recommended_action !== "DROP") ??
    null;

  return {
    schema_version: 1,
    purpose: "general_swiss_legal_strategy_layer",
    issue_map: issueMap,
    evidence_map: evidenceMap,
    contradiction_map: contradictionMap,
    best_client_argument: bestClientArgument,
    argument_strategy_matrix: argumentStrategyMatrix,
    evidence_control_map: evidenceControl,
    contradiction_analysis: contradictionAnalysis,
    core_strengths: strengths,
    strategic_concessions: concessions,
    safe_concessions: concessions,
    evidence_requests: evidenceRequests,
    case_law_use: caseLawUse,
    weak_points: weakPoints,
    tone_calibration: toneCalibration,
    recommended_drafting_tone: "firm, procedural, evidence-calibrated and non-accusatory",
    phrases_to_avoid: buildPhrasesToAvoid(toneCalibration),
    model_procedural_formulation: buildModelProceduralFormulation(
      contradictionAnalysis,
      evidenceRequests,
    ),
    drafting_strategy: draftingStrategy,
    likely_decision_paths: decisionPaths,
    guardrails: [
      "no_case_specific_hardcoding",
      "absence_of_document_is_not_proof_of_nonexistence",
      "contradiction_is_not_personal_accusation",
      "correct_opposing_fact_may_be_accepted_arguendo",
      "secondary_weak_arguments_may_be_subordinated_or_dropped",
      "full_text_case_law_required_before_decisive_use",
    ],
  };
}

function buildIssueMap(input: StrategicLegalEngineInput) {
  const factIssues = input.facts.map((fact) => ({
    issue_id: fact.id,
    proposition_type: "FACT",
    description: fact.description,
    verification_status: fact.status,
    evidence_ids: fact.evidenceIds ?? [],
    recommended_treatment:
      fact.status === "confirmed" || fact.status === "accepted_for_drafting"
        ? "use_with_exact_evidentiary_scope"
        : fact.status === "contradicted"
          ? "present_as_contradiction_requiring_clarification"
          : "do_not_treat_as_established_fact",
  }));
  const passageIssues = input.challengedPassages.map((passage) => ({
    issue_id: passage.id,
    proposition_type: classifyPassageProposition(passage),
    description: passage.exactText,
    verification_status: passage.classification_status ?? "requires_human_review",
    evidence_ids: [] as string[],
    recommended_treatment:
      passage.function === "subsidiary_argument" || passage.autonomousGround === false
        ? "subordinate_or_drop_if_not_dispositive"
        : "connect_to_verified_facts_before_use",
  }));
  return [
    {
      issue_id: "I-core",
      proposition_type: "ARGUMENT" as PropositionType,
      description: input.matterDescription,
      verification_status: "strategy_frame",
      evidence_ids: [] as string[],
      recommended_treatment: "keep_core_issue_visible_before_secondary_points",
    },
    ...factIssues,
    ...passageIssues,
  ];
}

function classifyPassageProposition(passage: StrategicPassage): PropositionType {
  if (passage.function === "fact") return "FACT";
  if (passage.function === "allegation" || passage.function === "evidence_assessment") {
    return "INFERENCE";
  }
  if (
    passage.function === "legal_interpretation" ||
    passage.function === "subsumption" ||
    passage.function === "conclusion"
  ) {
    return "LEGAL_CHARACTERIZATION";
  }
  return "ARGUMENT";
}

function buildEvidenceMap(
  input: StrategicLegalEngineInput,
  evidenceControl: ReturnType<typeof buildEvidenceControl>[],
) {
  return evidenceControl.map((item) => {
    const source = input.evidence.find((evidence) => evidence.evidenceId === item.evidence_id);
    return {
      evidence_id: item.evidence_id,
      evidence_name: item.evidence_name,
      proves_fact_ids: source?.provesFactIds ?? [],
      control: item.control,
      status: item.status,
      recommended_request: item.recommended_request,
      caution: item.caution,
    };
  });
}

function buildEvidenceControl(item: StrategicEvidence) {
  const control: EvidenceControl =
    item.assertionSource === "authority"
      ? "AUTHORITY_CONTROLLED"
      : item.assertionSource === "opposing_party"
        ? "OPPONENT_CONTROLLED"
        : item.assertionSource === "user"
          ? "CLIENT_CONTROLLED"
          : item.availabilityStatus === "available_to_tool"
            ? "CLIENT_CONTROLLED"
            : "UNKNOWN";
  const missingButAuthorityControlled =
    control === "AUTHORITY_CONTROLLED" &&
    (item.availabilityStatus === "missing" ||
      item.availabilityStatus === "referenced_but_not_available" ||
      item.inRecordStatus === "not_verified");
  return {
    evidence_id: item.evidenceId,
    evidence_name: item.name,
    control,
    status:
      item.usable_as_current_support === true
        ? "STRENGTH"
        : missingButAuthorityControlled
          ? "AUTHORITY_CONTROLLED_EVIDENCE"
          : item.proposed_evidence_only === true
            ? "MANAGEABLE_RISK"
            : "EVIDENTIARY_GAP",
    recommended_request: missingButAuthorityControlled
      ? "request_aktenedition_or_akteneinsicht"
      : item.usable_as_current_support === true
        ? "use_as_documentary_support"
        : "verify_before_substantive_use",
    caution: missingButAuthorityControlled
      ? "do_not_treat_absence_from_current_record_as_nonexistence"
      : "keep factual proposition matched to verified evidentiary scope",
  };
}

function buildArgumentStrategy(
  role: string,
  argument: StrategicArgument,
  index: number,
  input: StrategicLegalEngineInput,
  evidenceControl: ReturnType<typeof buildEvidenceControl>[],
) {
  const supportingEvidence = argument.supporting_evidence ?? [];
  const proposedEvidence = argument.proposed_evidence ?? [];
  const gaps = [
    ...(argument.vulnerabilities ?? []),
    ...proposedEvidence.map((id) => `evidence:${id}`),
  ];
  const hasAuthorityControlledGap = evidenceControl.some(
    (item) =>
      item.status === "AUTHORITY_CONTROLLED_EVIDENCE" &&
      gaps.includes(`evidence:${item.evidence_id}`),
  );
  const supportingCaseLaw = argument.supporting_case_law ?? [];
  const unverifiedCaseLaw = input.caseLaw.some(
    (item) => supportingCaseLaw.includes(item.id) && item.usable !== true,
  );
  const importance: ArgumentImportance =
    argument.argument_type === "do_not_use"
      ? "DROP"
      : role === "claimant_or_appellant" && index === 0 && supportingEvidence.length > 0
        ? "DECISIVE"
        : unverifiedCaseLaw
          ? "RESERVE"
          : proposedEvidence.length > 0 || hasAuthorityControlledGap
            ? "SUPPORTING"
            : index > 1
              ? "SUBSIDIARY"
              : "HIGH";
  const recommendedAction: RecommendedAction =
    importance === "DROP"
      ? "DROP"
      : importance === "DECISIVE"
        ? "STRENGTHEN"
        : unverifiedCaseLaw
          ? "VERIFY"
          : hasAuthorityControlledGap
            ? "REQUEST_EVIDENCE"
            : importance === "SUBSIDIARY"
              ? "SUBORDINATE"
              : "KEEP";
  const recommendedRole: RecommendedRole =
    importance === "DECISIVE"
      ? "MAIN_ARGUMENT"
      : recommendedAction === "REQUEST_EVIDENCE"
        ? "EVIDENTIARY_REQUEST"
        : importance === "SUBSIDIARY"
          ? "EVENTUAL_ARGUMENT"
          : "SECONDARY_ARGUMENT";
  return {
    argument: argument.argument_id ?? `${role}-argument-${index + 1}`,
    legal_basis: argument.supporting_norms ?? [],
    factual_basis: [...(argument.supporting_facts ?? []), ...(argument.alleged_facts ?? [])],
    evidence_strength:
      supportingEvidence.length > 0
        ? "PRIMARY_OR_CORROBORATIVE_SUPPORT"
        : hasAuthorityControlledGap
          ? "AUTHORITY_CONTROLLED_EVIDENCE"
          : "NOT_YET_DOCUMENT_SUPPORTED",
    legal_strength: unverifiedCaseLaw ? "REQUIRES_FULL_TEXT_VERIFICATION" : "PROVISIONAL",
    procedural_value: recommendedRole,
    adverse_risk: gaps.length > 0 ? "MANAGEABLE_RISK" : "LOW",
    counterargument_strength: (argument.counterarguments?.length ?? 0) > 0 ? "MEDIUM" : "LOW",
    importance,
    recommended_role: recommendedRole,
    recommended_action: recommendedAction,
    best_counterargument:
      argument.counterarguments?.[0] ??
      "opposing side may dispute sufficiency or legal consequence",
    best_reply:
      argument.rebuttal ??
      "limit the proposition to verified facts and request completion for authority-controlled gaps",
    residual_risk:
      gaps.length > 0
        ? "the deciding body may require further record completion before accepting the argument"
        : "legal characterization remains subject to human legal review",
  };
}

function buildContradictionAnalysis(input: StrategicLegalEngineInput) {
  const contradictedFacts = input.facts.filter((fact) => fact.status === "contradicted");
  const tensions = input.challengedPassages.filter(
    (passage) =>
      passage.author === "opposing_party" &&
      /nicht|kein|no |ohne|widerspruch|contradict|unvereinbar/i.test(passage.exactText),
  );
  return [
    ...contradictedFacts.map((fact) => ({
      contradiction_type: "REQUIRES_EXPLANATION",
      documents_or_facts: [fact.id, ...(fact.evidenceIds ?? [])],
      formulation:
        "Die verfügbaren Angaben lassen sich ohne weitere Erklärung nicht abschliessend miteinander in Einklang bringen.",
      possible_opposing_explanation:
        "the opposing side may argue different scope, timing or evidentiary context",
      legal_utility: "supports clarification or evidentiary request, not a personal reproach",
      recommended_action: "REQUEST_EVIDENCE",
      accusation_guardrail: "do_not_label_as_lie_or_bad_faith",
    })),
    ...tensions.map((passage) => ({
      contradiction_type: "TENSION",
      documents_or_facts: [passage.id],
      formulation:
        "Die spätere Darstellung findet in den verfügbaren Unterlagen keine eindeutige Bestätigung.",
      possible_opposing_explanation:
        "the passage may address a narrower legal category or a later procedural moment",
      legal_utility: "use only if it matters for the dispositive issue",
      recommended_action: "SUBORDINATE",
      accusation_guardrail: "formulate as clarification need",
    })),
  ];
}

function buildCoreStrengths(input: StrategicLegalEngineInput) {
  return input.evidence
    .filter((item) => item.usable_as_current_support === true)
    .map((item) => ({
      strength_type: "CORE_STRENGTH",
      evidence_id: item.evidenceId,
      proposition_ids: item.provesFactIds ?? [],
      recommended_use: "state firmly within the exact scope proved by the document",
      overstatement_guardrail:
        "do_not_convert_payment_contact_or_document_existence_into_broader_legal_conclusion",
    }));
}

function buildStrategicConcessions(input: StrategicLegalEngineInput) {
  return input.facts
    .filter((fact) => fact.status === "source_asserted" || fact.status === "confirmed")
    .slice(0, 6)
    .map((fact) => ({
      fact_id: fact.id,
      concession_type: fact.status === "confirmed" ? "SAFE_CONCESSION" : "CONDITIONAL_CONCESSION",
      recommended_formulation:
        "Selbst wenn diese Angabe zugrunde gelegt wird, folgt daraus nicht ohne Weiteres die von der Gegenseite gezogene rechtliche Konsequenz.",
      strategic_value: "avoid fighting a non-dispositive point and preserve credibility",
    }));
}

function calibrateTone(texts: readonly string[]) {
  const extremePatterns: readonly [RegExp, string, string][] = [
    [
      /lügt|miente|lie\b|lied\b/i,
      "ACCUSATORY",
      "Die Angabe stimmt mit den verfügbaren Unterlagen nicht eindeutig überein.",
    ],
    [
      /ocult|verschwiegen|hidden|concealed/i,
      "UNSUPPORTED_INFERENCE",
      "Die hierfür relevanten Unterlagen befinden sich nicht unter den verfügbaren Akten.",
    ],
    [
      /illegal|rechtswidrig|nichtig|null und nichtig/i,
      "UNNECESSARILY_ABSOLUTE",
      "Diese Frage bedarf einer rechtlichen Prüfung anhand der vollständigen Akten.",
    ],
    [
      /falsch|false|fake|gefälscht/i,
      "ACCUSATORY",
      "Die Authentizität oder Tragweite dieser Angabe ist anhand der Akten zu klären.",
    ],
  ];
  const findings = texts.flatMap((text, index) =>
    extremePatterns
      .filter(([pattern]) => pattern.test(text))
      .map(([, classification, suggestion]) => ({
        text_index: index,
        classification,
        recommended_formulation: suggestion,
      })),
  );
  return {
    findings,
    default_language_modes: ["ANALYTICAL", "PROCEDURAL_NEUTRAL", "LITIGATION_STRONG"],
    litigation_strong_guardrail: "firm_but_non_accusatory_and_evidence_calibrated",
  };
}

function buildCaseLawUse(input: StrategicLegalEngineInput) {
  return input.caseLaw.map((item) => {
    const relevance = item.relevance ?? "";
    const hasAdverseRatio =
      /adverse|dismiss|rejected|limited|ratio|abgewiesen|nicht eingetreten|nur eingeschränkt|gegen/i.test(
        relevance,
      );
    const hasFavorablePhrase = /favorable|günstig|helpful|supports|zugunsten|favourable/i.test(
      relevance,
    );
    const treatment: CaseLawTreatment =
      item.usable !== true
        ? "UNVERIFIED"
        : hasAdverseRatio && hasFavorablePhrase
          ? "MIXED"
          : hasAdverseRatio
            ? "ADVERSE"
            : "SUPPORTIVE";
    return {
      case_law_id: item.id,
      citation: item.citation,
      treatment,
      text_status: item.textStatus,
      recommended_action:
        treatment === "SUPPORTIVE" ? "KEEP" : treatment === "UNVERIFIED" ? "VERIFY" : "SUBORDINATE",
      usable_for_decisive_argument: treatment === "SUPPORTIVE" && item.usable === true,
      adverse_or_limiting_aspects:
        treatment === "MIXED" || treatment === "ADVERSE"
          ? ["ratio_or_outcome_limits_favorable_phrase"]
          : [],
      guardrail:
        treatment === "MIXED" || treatment === "ADVERSE"
          ? "do_not_extract_favorable_sentence_without_ratio_and_outcome"
          : "use_only_for_the_verified_proposition",
    };
  });
}

function buildWeakPoints(input: StrategicLegalEngineInput) {
  return input.challengedPassages
    .filter(
      (passage) =>
        passage.function === "subsidiary_argument" ||
        passage.autonomousGround === false ||
        /low-value|not decisive|nicht entscheid|secondary|decorative|nebenpunkt/i.test(
          passage.exactText,
        ),
    )
    .map((passage) => ({
      point_id: passage.id,
      importance: "DROP",
      recommended_action: "DROP",
      reason: "does not provide an independent path, evidentiary request or credibility gain",
      guardrail: "do_not_expand_secondary_point_into_main_dispute",
    }));
}

function buildPhrasesToAvoid(tone: ReturnType<typeof calibrateTone>) {
  const defaults = [
    "lügt",
    "miente",
    "ocultó",
    "intentionally concealed",
    "obviously illegal",
    "nichtig ohne weitere Prüfung",
    "fake",
  ];
  return [...defaults, ...tone.findings.map((finding) => finding.classification)];
}

function buildModelProceduralFormulation(
  contradictions: ReturnType<typeof buildContradictionAnalysis>,
  evidenceRequests: ReturnType<typeof buildEvidenceControl>[],
) {
  if (contradictions.length > 0) {
    return contradictions[0]?.formulation;
  }
  if (evidenceRequests.length > 0) {
    return "Soweit entscheidrelevante Unterlagen noch nicht bei den verfügbaren Akten liegen, ist deren Edition bzw. Akteneinsicht zu beantragen; daraus folgt ohne weitere Abklärung keine Aussage über ihr Nichtbestehen.";
  }
  return "Die rechtliche Würdigung ist auf die nachweisbaren Tatsachen und den konkret belegten Aktenstand zu beschränken.";
}

function buildDraftingStrategy(
  matrix: ReturnType<typeof buildArgumentStrategy>[],
  contradictions: ReturnType<typeof buildContradictionAnalysis>,
  strengths: ReturnType<typeof buildCoreStrengths>,
  tone: ReturnType<typeof calibrateTone>,
  weakPoints: ReturnType<typeof buildWeakPoints>,
) {
  return {
    main_arguments: matrix.filter((item) => item.recommended_role === "MAIN_ARGUMENT"),
    secondary_arguments: matrix.filter((item) => item.recommended_role === "SECONDARY_ARGUMENT"),
    evidentiary_requests: matrix.filter((item) => item.recommended_role === "EVIDENTIARY_REQUEST"),
    reserve_or_drop: [
      ...matrix.filter((item) => item.recommended_action === "DROP"),
      ...weakPoints,
    ],
    contradiction_formulations: contradictions.map((item) => item.formulation),
    strength_formulations: strengths.map((item) => item.recommended_use),
    tone_rewrites_required: tone.findings.length,
    economy_guardrail:
      "drop or subordinate arguments that do not provide an independent path, evidentiary request or credibility gain",
  };
}

function buildDecisionPaths(
  input: StrategicLegalEngineInput,
  matrix: ReturnType<typeof buildArgumentStrategy>[],
) {
  const hasMain = matrix.some((item) => item.recommended_role === "MAIN_ARGUMENT");
  const hasRequests = matrix.some((item) => item.recommended_role === "EVIDENTIARY_REQUEST");
  return [
    {
      path: "PATH_A_MAIN_ACCEPTED",
      probability: hasMain ? "MEDIUM" : "UNCERTAIN",
      condition: "main argument remains supported by verified facts and admissible evidence",
      risk: "authority or court may narrow the legal consequence",
      strategic_action: "keep the main argument concise and traceable",
    },
    {
      path: "PATH_B_RECORD_COMPLETION",
      probability: hasRequests ? "MEDIUM" : "LOW",
      condition: "missing material evidence is controlled by authority or opposing side",
      risk: "new material may weaken or narrow the argument",
      strategic_action: "request production without asserting nonexistence",
    },
    {
      path: "PATH_C_DISMISS_OR_INADMISSIBLE",
      probability: input.facts.some((fact) => fact.status === "not_verified") ? "MEDIUM" : "LOW",
      condition: "procedural threshold or evidentiary support fails",
      risk: "secondary disputes distract from dispositive point",
      strategic_action: "subordinate weak points and preserve credibility",
    },
  ];
}
