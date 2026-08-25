import type { NormalizedDocument } from "@swiss-legal-mcp/documents";
import type { OfficialCaseVerification } from "./jurisprudenceGuardrails.js";

export type SourceQuality =
  | "OFFICIAL_PRIMARY"
  | "OFFICIAL_SECONDARY"
  | "NON_OFFICIAL_FULL_TEXT"
  | "SECONDARY_REFERENCE"
  | "UNVERIFIED";

export type VerificationStageStatus =
  "verified" | "located" | "not_requested" | "not_available" | "unable_to_verify" | "failed";

export type CitationQuality =
  "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_SUPPORTED" | "UNABLE_TO_VERIFY";

export type PrecedentTreatment = "SUPPORTIVE" | "DISTINGUISHABLE" | "MIXED" | "ADVERSE";

export type AbsenceStatus =
  | "NOT_FOUND"
  | "NOT_IN_AVAILABLE_RECORD"
  | "NO_EVIDENCE_IDENTIFIED"
  | "CONTRADICTED_BY_EVIDENCE"
  | "PROVEN_ABSENT";

export type EvidenceStrength =
  | "PRIMARY_DIRECT_EVIDENCE"
  | "CORROBORATIVE_EVIDENCE"
  | "INFERENCE"
  | "PARTIALLY_SUPPORTED"
  | "AUTHORITY_CONTROLLED_DOCUMENT"
  | "NOT_SUPPORTED"
  | "CONFLICTING_EVIDENCE";

export type RiskCalibration =
  | "FATAL"
  | "MATERIAL_RISK"
  | "MANAGEABLE_LIMITATION"
  | "DRAFTING_ISSUE"
  | "EVIDENTIARY_REQUEST"
  | "NO_MATERIAL_PROBLEM";

export interface LegalLanguageChoice {
  readonly de: string;
  readonly es: string;
  readonly use_when: string;
}

export interface VerificationStage {
  readonly stage:
    | "reference_located"
    | "identity_verified"
    | "full_text_or_consideration_located"
    | "material_proposition_verified"
    | "applicability_assessed";
  readonly status: VerificationStageStatus;
  readonly note: string;
}

export interface LegalCalibration {
  readonly source_quality: SourceQuality;
  readonly citation_quality: CitationQuality;
  readonly precedent_treatment: PrecedentTreatment | "UNASSESSED";
  readonly adverse_aspects: readonly string[];
  readonly verification_stages: readonly VerificationStage[];
  readonly evidence_strength: EvidenceStrength;
  readonly absence_status: AbsenceStatus | null;
  readonly risk_calibration: RiskCalibration;
  readonly language_choice: LegalLanguageChoice;
  readonly procedural_formulation: string;
  readonly separation: {
    readonly FACT: readonly string[];
    readonly EVIDENCE: readonly string[];
    readonly LEGAL_RULE: readonly string[];
    readonly APPLICATION: readonly string[];
    readonly CONCLUSION: readonly string[];
  };
  readonly guardrails: readonly string[];
}

export interface CitationCalibrationResult {
  readonly source_quality: SourceQuality;
  readonly citation_identity: {
    readonly status:
      | "not_recognized"
      | "reference_located"
      | "identity_verified"
      | "identity_not_verified"
      | "identity_conflict";
    readonly court: string | null;
    readonly case_number: string | null;
    readonly decision_date: string | null;
    readonly source_quality: SourceQuality;
    readonly metadata_validation: {
      readonly case_number: VerificationStageStatus;
      readonly court: VerificationStageStatus;
      readonly decision_date: VerificationStageStatus;
      readonly publication_or_dispatch_date: VerificationStageStatus;
      readonly consideration: VerificationStageStatus;
      readonly warnings: readonly string[];
    };
  };
  readonly material_verification: {
    readonly status:
      "not_requested" | "not_verified" | "partially_supported" | "verified" | "unable_to_verify";
    readonly consideration: string | null;
    readonly proposition: string | null;
    readonly relevant_passage: string | null;
    readonly citation_quality: CitationQuality;
  };
  readonly case_context: {
    readonly subject: string | null;
    readonly outcome: string | null;
    readonly adverse_aspects: readonly string[];
  };
  readonly applicability: {
    readonly status: "not_assessed" | "limited" | "assessed";
    readonly similarities: readonly string[];
    readonly differences: readonly string[];
    readonly limitations: readonly string[];
  };
  readonly recommended_use: {
    readonly use: "official_citation" | "discovery_only" | "do_not_use_as_authority";
    readonly role: string;
    readonly procedural_formulation: string;
  };
  readonly verification_stages: readonly VerificationStage[];
  readonly legal_calibration: LegalCalibration;
}

export function classifySourceQuality(params: {
  readonly document?: NormalizedDocument | null;
  readonly officialSourceUrl?: string | null;
  readonly officialCaseVerification?: OfficialCaseVerification | null;
  readonly liveOfficialStatus?: string | null;
  readonly providerId?: string | null;
}): SourceQuality {
  if (params.liveOfficialStatus === "full_text_verified_official") return "OFFICIAL_PRIMARY";
  if (params.officialCaseVerification?.status === "officially_verified") return "OFFICIAL_PRIMARY";
  if (params.document?.provenance.officialCharacter === "official") return "OFFICIAL_PRIMARY";
  if (params.document?.documentType === "official_publication") return "OFFICIAL_SECONDARY";
  if (params.document?.provenance.officialCharacter === "unofficial_aggregator") {
    return params.document.fullText && params.document.fullText.trim().length > 0
      ? "NON_OFFICIAL_FULL_TEXT"
      : "SECONDARY_REFERENCE";
  }
  if (params.providerId === "entscheidsuche") return "SECONDARY_REFERENCE";
  return "UNVERIFIED";
}

export function buildCitationCalibration(params: {
  readonly normalized: string | null;
  readonly type: string;
  readonly match: string | null;
  readonly document?: NormalizedDocument | null;
  readonly officialCaseVerification?: OfficialCaseVerification | null;
  readonly liveOfficialCaseResolution?: unknown;
  readonly warnings?: readonly string[];
}): CitationCalibrationResult {
  const liveStatus = readString(params.liveOfficialCaseResolution, [
    "legal_use",
    "official_verification_status",
  ]);
  const sourceQuality = classifySourceQuality({
    document: params.document,
    officialCaseVerification: params.officialCaseVerification,
    liveOfficialStatus: liveStatus,
    providerId: params.document?.provider,
  });
  const isCase = params.type === "case_number" || params.type === "bge_atf_dtf";
  const identityVerified =
    sourceQuality === "OFFICIAL_PRIMARY" &&
    (liveStatus === "full_text_verified_official" ||
      params.officialCaseVerification?.status === "officially_verified" ||
      params.document?.provenance.officialCharacter === "official");
  const referenceLocated =
    params.match === "exact" || params.match === "probable" || Boolean(params.document);
  const fullTextVerified = liveStatus === "full_text_verified_official";
  const fullTextLocated =
    fullTextVerified ||
    params.officialCaseVerification?.fullTextReading.full_text_verified_official === true ||
    Boolean(params.document?.fullText?.trim());
  const materialStatus: CitationCalibrationResult["material_verification"]["status"] =
    isCase && fullTextVerified ? "not_requested" : isCase ? "unable_to_verify" : "not_requested";
  const citationQuality: CitationQuality = "UNABLE_TO_VERIFY";
  const outcome = readString(params.liveOfficialCaseResolution, [
    "legal_use",
    "case_context",
    "outcome",
  ]);
  const adverseAspects = buildAdverseAspects({
    outcome,
    fullTextVerified,
    materialStatus,
    warnings: params.warnings ?? [],
  });
  const court = params.officialCaseVerification?.metadata.chamber ?? null;
  const decisionDate =
    params.officialCaseVerification?.metadata.date ??
    params.document?.date.decisionOrEnactment ??
    null;
  const subject =
    params.officialCaseVerification?.metadata.matter ?? params.document?.title ?? null;
  const verificationStages = buildVerificationStages({
    referenceLocated,
    identityVerified,
    fullTextLocated,
    materialVerified: false,
    applicabilityAssessed: false,
  });
  const legalCalibration = buildLegalCalibration({
    sourceQuality,
    citationQuality,
    adverseAspects,
    verificationStages,
    evidenceStrength: identityVerified ? "PRIMARY_DIRECT_EVIDENCE" : "PARTIALLY_SUPPORTED",
    absenceStatus: referenceLocated ? null : "NOT_FOUND",
    riskCalibration: "MANAGEABLE_LIMITATION",
  });
  return {
    source_quality: sourceQuality,
    citation_identity: {
      status: params.normalized
        ? identityVerified
          ? "identity_verified"
          : referenceLocated
            ? "reference_located"
            : "identity_not_verified"
        : "not_recognized",
      court,
      case_number: isCase ? params.normalized : null,
      decision_date: decisionDate,
      source_quality: sourceQuality,
      metadata_validation: {
        case_number: isCase && params.normalized ? "located" : "not_available",
        court: court ? "verified" : isCase ? "unable_to_verify" : "not_available",
        decision_date: decisionDate ? "verified" : isCase ? "unable_to_verify" : "not_available",
        publication_or_dispatch_date: "not_requested",
        consideration: "not_requested",
        warnings: [
          ...(params.document?.rawMetadata["filenameDate"]
            ? ["filename_date_not_used_as_decision_date"]
            : []),
          ...(identityVerified ? [] : ["case_existence_is_not_material_proposition_verification"]),
        ],
      },
    },
    material_verification: {
      status: materialStatus,
      consideration: null,
      proposition: null,
      relevant_passage: null,
      citation_quality: citationQuality,
    },
    case_context: {
      subject,
      outcome,
      adverse_aspects: adverseAspects,
    },
    applicability: {
      status: "not_assessed",
      similarities: [],
      differences: [],
      limitations: [
        "Applicability to the user's facts is not inferred from citation identity.",
        "Material proposition support requires a concrete proposition and verified passage.",
      ],
    },
    recommended_use: {
      use:
        identityVerified && sourceQuality === "OFFICIAL_PRIMARY"
          ? "official_citation"
          : "discovery_only",
      role:
        identityVerified && sourceQuality === "OFFICIAL_PRIMARY"
          ? "Use as an identified official source; verify the intended legal proposition separately."
          : "Use only as a located reference or discovery lead until an official source and material proposition are verified.",
      procedural_formulation: buildProceduralFormulation("material_proposition_not_verified"),
    },
    verification_stages: verificationStages,
    legal_calibration: legalCalibration,
  };
}

export function buildSearchCaseCalibration(params: {
  readonly query: string;
  readonly resultCount: number;
  readonly sourceName?: string;
}) {
  return {
    source_quality: "NON_OFFICIAL_FULL_TEXT" as SourceQuality,
    citation_quality: "UNABLE_TO_VERIFY" as CitationQuality,
    ranking_policy: [
      "material_legal_match",
      "court_hierarchy",
      "official_source_available",
      "relevant_consideration_available",
      "temporal_relevance_when_legally_material",
    ],
    ranking_limits: [
      `${params.sourceName ?? "aggregator"} is not an official court source.`,
      "Lexical matches are discovery leads, not proof that a judgment supports a proposition.",
      "Official source verification is required before treating a result as authority.",
    ],
    official_verification_required: true,
    result_interpretation:
      params.resultCount > 0
        ? "Results are jurisprudence candidates for follow-up verification."
        : "No candidate was returned by this search; this is not proof that no relevant judgment exists.",
    absence_status: params.resultCount > 0 ? null : ("NOT_IN_AVAILABLE_RECORD" as AbsenceStatus),
    procedural_formulation: buildProceduralFormulation("not_in_available_record"),
  };
}

export function buildLegislationSearchCalibration(params: {
  readonly relevantDate?: string;
  readonly status?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
}) {
  const relevantDateCovered =
    params.relevantDate && params.dateFrom && params.dateTo
      ? params.dateFrom <= params.relevantDate && params.relevantDate <= params.dateTo
      : null;
  return {
    source_quality: "OFFICIAL_PRIMARY" as SourceQuality,
    jurisdiction_level: "federal",
    source_official: true,
    version_status_requested: params.status ?? "provider_default",
    relevant_date: params.relevantDate ?? null,
    relevant_date_assessment:
      params.relevantDate === undefined
        ? "not_requested"
        : relevantDateCovered === true
          ? "search_window_covers_relevant_date"
          : relevantDateCovered === false
            ? "search_window_does_not_cover_relevant_date"
            : "requires_get_law_or_get_article_at_date",
    warnings: [
      ...(params.relevantDate
        ? [
            "Search results identify candidate legislation; use get_law/get_article_at_date to verify the exact version in force on the legally relevant date.",
          ]
        : []),
      ...(relevantDateCovered === false ? ["relevant_date_outside_search_window"] : []),
    ],
  };
}

export function buildLegalCalibration(
  params: {
    readonly sourceQuality?: SourceQuality;
    readonly citationQuality?: CitationQuality;
    readonly precedentTreatment?: PrecedentTreatment | "UNASSESSED";
    readonly adverseAspects?: readonly string[];
    readonly verificationStages?: readonly VerificationStage[];
    readonly evidenceStrength?: EvidenceStrength;
    readonly absenceStatus?: AbsenceStatus | null;
    readonly riskCalibration?: RiskCalibration;
    readonly separation?: Partial<LegalCalibration["separation"]>;
  } = {},
): LegalCalibration {
  const evidenceStrength = params.evidenceStrength ?? "PARTIALLY_SUPPORTED";
  return {
    source_quality: params.sourceQuality ?? "UNVERIFIED",
    citation_quality: params.citationQuality ?? "UNABLE_TO_VERIFY",
    precedent_treatment: params.precedentTreatment ?? "UNASSESSED",
    adverse_aspects: params.adverseAspects ?? [],
    verification_stages: params.verificationStages ?? [],
    evidence_strength: evidenceStrength,
    absence_status: params.absenceStatus ?? null,
    risk_calibration:
      params.riskCalibration ?? riskForEvidence(evidenceStrength, params.absenceStatus),
    language_choice: languageChoiceForEvidence(evidenceStrength, params.absenceStatus),
    procedural_formulation: buildProceduralFormulation(
      params.absenceStatus === "NO_EVIDENCE_IDENTIFIED"
        ? "no_evidence_identified"
        : params.absenceStatus === "NOT_IN_AVAILABLE_RECORD"
          ? "not_in_available_record"
          : "material_proposition_not_verified",
    ),
    separation: {
      FACT: params.separation?.FACT ?? [],
      EVIDENCE: params.separation?.EVIDENCE ?? [],
      LEGAL_RULE: params.separation?.LEGAL_RULE ?? [],
      APPLICATION: params.separation?.APPLICATION ?? [],
      CONCLUSION: params.separation?.CONCLUSION ?? [],
    },
    guardrails: [
      "material prestation is not a formal decision",
      "payment is not legal recognition",
      "territorial competence is not functional competence",
      "lack of proof of delegation is not proof of absence of delegation",
      "right of residence is not the same as residence permit document",
      "actual interest is not merely historical interest",
      "later facts do not automatically replace the legally relevant time",
    ],
  };
}

export function assessAbsenceOfEvidence(params: {
  readonly searchedAvailableRecord: boolean;
  readonly authorityControlledDocument?: boolean;
  readonly directContradictoryEvidence?: boolean;
  readonly formalNegativeProof?: boolean;
}): {
  readonly absence_status: AbsenceStatus;
  readonly evidence_strength: EvidenceStrength;
  readonly legal_calibration: LegalCalibration;
} {
  const absenceStatus: AbsenceStatus = params.formalNegativeProof
    ? "PROVEN_ABSENT"
    : params.directContradictoryEvidence
      ? "CONTRADICTED_BY_EVIDENCE"
      : params.searchedAvailableRecord
        ? "NO_EVIDENCE_IDENTIFIED"
        : "NOT_IN_AVAILABLE_RECORD";
  const evidenceStrength: EvidenceStrength = params.directContradictoryEvidence
    ? "CONFLICTING_EVIDENCE"
    : params.authorityControlledDocument
      ? "AUTHORITY_CONTROLLED_DOCUMENT"
      : "PARTIALLY_SUPPORTED";
  return {
    absence_status: absenceStatus,
    evidence_strength: evidenceStrength,
    legal_calibration: buildLegalCalibration({ absenceStatus, evidenceStrength }),
  };
}

export function classifyEvidenceStrength(params: {
  readonly primaryDirectEvidence?: boolean;
  readonly corroboratesExistingEvidence?: boolean;
  readonly inferentialOnly?: boolean;
  readonly authorityControlledDocument?: boolean;
  readonly contradictorySources?: boolean;
  readonly searchMissOnly?: boolean;
}): EvidenceStrength {
  if (params.contradictorySources) return "CONFLICTING_EVIDENCE";
  if (params.primaryDirectEvidence) return "PRIMARY_DIRECT_EVIDENCE";
  if (params.authorityControlledDocument) return "AUTHORITY_CONTROLLED_DOCUMENT";
  if (params.corroboratesExistingEvidence) return "CORROBORATIVE_EVIDENCE";
  if (params.inferentialOnly) return "INFERENCE";
  if (params.searchMissOnly) return "PARTIALLY_SUPPORTED";
  return "NOT_SUPPORTED";
}

export function classifyPrecedentUse(params: {
  readonly supportsRequestedProposition?: boolean;
  readonly appealRejected?: boolean;
  readonly exceptionFailed?: boolean;
  readonly additionalRequirements?: readonly string[];
  readonly substantiallyDifferentContext?: boolean;
}): {
  readonly treatment: PrecedentTreatment;
  readonly citation_quality: CitationQuality;
  readonly adverse_aspects: readonly string[];
} {
  const adverseAspects = [
    ...(params.appealRejected ? ["appeal_rejected_or_complaint_dismissed"] : []),
    ...(params.exceptionFailed ? ["invoked_exception_failed"] : []),
    ...[...(params.additionalRequirements ?? [])].map((item) => `additional_requirement:${item}`),
    ...(params.substantiallyDifferentContext ? ["substantially_different_context"] : []),
  ];
  if (!params.supportsRequestedProposition) {
    return {
      treatment: adverseAspects.length > 0 ? "ADVERSE" : "DISTINGUISHABLE",
      citation_quality: "NOT_SUPPORTED",
      adverse_aspects: adverseAspects,
    };
  }
  if (adverseAspects.length > 0) {
    return {
      treatment: "MIXED",
      citation_quality: "PARTIALLY_SUPPORTED",
      adverse_aspects: adverseAspects,
    };
  }
  return { treatment: "SUPPORTIVE", citation_quality: "SUPPORTED", adverse_aspects: [] };
}

export function buildProceduralFormulation(
  kind:
    | "no_evidence_identified"
    | "not_in_available_record"
    | "material_proposition_not_verified"
    | "authority_controlled_document",
): string {
  switch (kind) {
    case "no_evidence_identified":
      return "Aus den vorliegenden Unterlagen ist eine entsprechende Grundlage nicht ersichtlich; dies ersetzt jedoch keinen positiven Nachweis ihres Nichtbestehens.";
    case "not_in_available_record":
      return "Die verfügbare Suche hat keinen entsprechenden Nachweis ergeben; daraus folgt ohne vollständige Aktenlage noch kein Beweis des Gegenteils.";
    case "authority_controlled_document":
      return "Soweit sich die massgeblichen Unterlagen in der Sphäre der Behörde befinden, ist deren Edition beziehungsweise Akteneinsicht zu beantragen.";
    case "material_proposition_not_verified":
      return "Die Fundstelle ist als Referenz zu behandeln; die materielle Tragweite der zitierten Erwägung bedarf einer gesonderten Prüfung am amtlichen Text.";
  }
}

function buildVerificationStages(params: {
  readonly referenceLocated: boolean;
  readonly identityVerified: boolean;
  readonly fullTextLocated: boolean;
  readonly materialVerified: boolean;
  readonly applicabilityAssessed: boolean;
}): VerificationStage[] {
  return [
    {
      stage: "reference_located",
      status: params.referenceLocated ? "located" : "not_available",
      note: "Reference localization does not by itself verify the legal proposition.",
    },
    {
      stage: "identity_verified",
      status: params.identityVerified ? "verified" : "unable_to_verify",
      note: "Identity requires court/source metadata, not only textual similarity.",
    },
    {
      stage: "full_text_or_consideration_located",
      status: params.fullTextLocated ? "located" : "unable_to_verify",
      note: "A relevant consideration or full text must be located before ratio use.",
    },
    {
      stage: "material_proposition_verified",
      status: params.materialVerified ? "verified" : "not_requested",
      note: "No concrete legal proposition was verified unless explicitly assessed.",
    },
    {
      stage: "applicability_assessed",
      status: params.applicabilityAssessed ? "verified" : "not_requested",
      note: "Applicability requires comparison with the user's procedural and factual context.",
    },
  ];
}

function buildAdverseAspects(params: {
  readonly outcome: string | null;
  readonly fullTextVerified: boolean;
  readonly materialStatus: string;
  readonly warnings: readonly string[];
}): string[] {
  const lowerOutcome = params.outcome?.toLowerCase() ?? "";
  return [
    ...(/dismiss|reject|abweis|abgelehnt|rejet|irrecev/.test(lowerOutcome)
      ? ["case_outcome_may_limit_favorable_language"]
      : []),
    ...(params.fullTextVerified ? [] : ["outcome_or_dispositive_not_fully_verified"]),
    ...(params.materialStatus === "verified" ? [] : ["material_proposition_not_verified"]),
    ...(params.warnings.includes("ratio_not_confirmed") ? ["ratio_not_confirmed"] : []),
  ];
}

function languageChoiceForEvidence(
  evidenceStrength: EvidenceStrength,
  absenceStatus?: AbsenceStatus | null,
): LegalLanguageChoice {
  if (absenceStatus === "NO_EVIDENCE_IDENTIFIED" || absenceStatus === "NOT_IN_AVAILABLE_RECORD") {
    return {
      de: "aus den vorliegenden Unterlagen nicht ersichtlich",
      es: "no resulta de los documentos disponibles",
      use_when:
        "A search or file review did not identify proof, but absence is not formally proven.",
    };
  }
  switch (evidenceStrength) {
    case "PRIMARY_DIRECT_EVIDENCE":
      return {
        de: "belegt",
        es: "acredita",
        use_when: "Direct primary evidence proves the point.",
      };
    case "CORROBORATIVE_EVIDENCE":
      return {
        de: "bestätigt",
        es: "confirma",
        use_when: "Evidence confirms an already supported fact.",
      };
    case "INFERENCE":
      return {
        de: "indiziert",
        es: "constituye indicio",
        use_when: "Only an inference is available.",
      };
    case "PARTIALLY_SUPPORTED":
    case "AUTHORITY_CONTROLLED_DOCUMENT":
      return {
        de: "stützt",
        es: "respalda",
        use_when: "The evidence supports but does not fully prove the proposition.",
      };
    case "CONFLICTING_EVIDENCE":
      return {
        de: "lässt offen",
        es: "deja abierta la cuestión",
        use_when: "Sources point in different directions.",
      };
    case "NOT_SUPPORTED":
      return {
        de: "nicht belegt",
        es: "no acreditado",
        use_when: "No supporting evidence is available.",
      };
  }
}

function riskForEvidence(
  evidenceStrength: EvidenceStrength,
  absenceStatus?: AbsenceStatus | null,
): RiskCalibration {
  if (evidenceStrength === "CONFLICTING_EVIDENCE") return "MATERIAL_RISK";
  if (evidenceStrength === "AUTHORITY_CONTROLLED_DOCUMENT") return "EVIDENTIARY_REQUEST";
  if (absenceStatus === "NO_EVIDENCE_IDENTIFIED" || absenceStatus === "NOT_IN_AVAILABLE_RECORD") {
    return "MANAGEABLE_LIMITATION";
  }
  if (evidenceStrength === "INFERENCE" || evidenceStrength === "PARTIALLY_SUPPORTED") {
    return "DRAFTING_ISSUE";
  }
  if (
    evidenceStrength === "PRIMARY_DIRECT_EVIDENCE" ||
    evidenceStrength === "CORROBORATIVE_EVIDENCE"
  ) {
    return "NO_MATERIAL_PROBLEM";
  }
  return "MANAGEABLE_LIMITATION";
}

function readString(value: unknown, path: readonly string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : null;
}
