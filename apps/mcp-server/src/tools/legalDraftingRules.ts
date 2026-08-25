import { createHash } from "node:crypto";
import { parseCitations } from "@swiss-legal-mcp/citations";
import {
  evaluateCaseComparability,
  verifyOfficialCaseReference,
  type CaseComparabilityClassification,
} from "./jurisprudenceGuardrails.js";

export type SwissLegalLanguageProfile = "de-CH-legal" | "fr-CH-legal" | "it-CH-legal";
export type ToneProfile =
  | "neutral_formal"
  | "firm_respectful"
  | "conciliatory"
  | "urgent_procedural"
  | "defensive"
  | "settlement_oriented"
  | "judicial_technical";
export type DetailLevel = "kurz" | "standard" | "detailliert" | "gerichtlich";
export type SwissLegalDocumentType =
  | "Einsprache"
  | "Beschwerde"
  | "Rekurs"
  | "Wiedererwaegungsgesuch"
  | "Revisionsgesuch"
  | "Stellungnahme"
  | "Replik"
  | "Duplik"
  | "Gesuch"
  | "Ergaenzung"
  | "Akteneinsichtsgesuch"
  | "Fristerstreckungsgesuch"
  | "Rechtsvorschlag"
  | "Zahlungsaufschubsgesuch"
  | "VorsorglicheMassnahmen"
  | "AufschiebendeWirkung"
  | "UnentgeltlicheRechtspflege"
  | "AussergerichtlicheAufforderung"
  | "Vergleichsvorschlag"
  | "Kuendigung"
  | "RechtlichesMemorandum"
  | "unknown";

export type DraftingCheckStatus =
  "passed" | "warning" | "failed" | "not_verified" | "not_applicable";
export type DraftingSeverity = "blocker" | "major" | "warning" | "informational";
export type JurisdictionDimensionStatus =
  | "confirmed"
  | "not_verified"
  | "not_applicable"
  | "contradicted"
  | "failed"
  | "requires_legal_review";
export type DraftingFactStatus =
  | "confirmed"
  | "accepted_for_drafting"
  | "disputed"
  | "uncertain"
  | "inferred"
  | "user_asserted"
  | "source_asserted"
  | "contradicted"
  | "not_verified"
  | "unavailable"
  | "unbestritten"
  | "bestritten"
  | "aktenkundig"
  | "parteibehauptung"
  | "inference";
export type EvidenceProceduralStatus =
  | "in_record_confirmed"
  | "available_not_yet_filed"
  | "proposed_new_evidence"
  | "missing"
  | "existence_not_confirmed"
  | "inadmissible"
  | "noven_risk"
  | "authenticity_unconfirmed"
  | "reference_only";
export type EvidenceAssertionSource =
  "user" | "source_document" | "authority" | "opposing_party" | "inferred" | "unknown";
export type EvidenceExistenceStatus =
  "user_asserted" | "source_confirmed" | "existence_not_confirmed" | "contradicted" | "unavailable";
export type EvidenceAvailabilityStatus =
  "available_to_tool" | "referenced_but_not_available" | "missing" | "inaccessible";
export type EvidenceContentVerificationStatus =
  "verified_against_document" | "partially_verified" | "user_described_only" | "not_verified";
export type EvidenceAuthenticityStatus = "confirmed" | "presumed" | "unconfirmed" | "disputed";
export type EvidenceInRecordStatus =
  "in_record_confirmed" | "claimed_to_be_in_record" | "not_in_record" | "not_verified";
export type EvidenceFilingStatus =
  | "already_filed"
  | "available_not_yet_filed"
  | "proposed_new_evidence"
  | "missing"
  | "not_verified";
export type EvidenceAdmissibilityStatus =
  "admissible_confirmed" | "admissibility_not_verified" | "inadmissible" | "noven_risk";
export type EvidenceNovenStatus =
  "no_known_noven_issue" | "possible_noven" | "likely_noven" | "not_applicable" | "not_verified";
export type QuoteVerificationStatus =
  | "quote_matches_user_input"
  | "quote_extracted_from_source"
  | "quote_verified_against_source"
  | "context_checked"
  | "source_location_verified"
  | "source_document_full_text_read"
  | "quote_translation"
  | "quote_paraphrase"
  | "quote_not_verified";

export interface DraftingFact {
  readonly id: string;
  readonly description: string;
  readonly status: DraftingFactStatus;
  readonly date?: string;
  readonly amountChf?: number;
  readonly account?: string;
  readonly holder?: string;
  readonly evidenceIds?: readonly string[];
}

export interface DraftingEvidence {
  readonly evidenceId: string;
  readonly name: string;
  readonly type:
    | "decision"
    | "bank_statement"
    | "letter"
    | "email"
    | "court_record"
    | "contract"
    | "expert_report"
    | "other";
  readonly date?: string;
  readonly issuer?: string;
  readonly page?: string;
  readonly attachment?: string;
  readonly provesFactIds?: readonly string[];
  readonly linkedClaimIds?: readonly string[];
  readonly authenticity?: "confirmed" | "disputed" | "unknown";
  readonly source?: "filed_record" | "new" | "opposing_party" | "authority" | "user_supplied";
  readonly admissibility?: "likely" | "uncertain" | "risky" | "not_assessed";
  readonly proceduralStatus?: EvidenceProceduralStatus;
  readonly assertionSource?: EvidenceAssertionSource;
  readonly existenceStatus?: EvidenceExistenceStatus;
  readonly availabilityStatus?: EvidenceAvailabilityStatus;
  readonly contentVerificationStatus?: EvidenceContentVerificationStatus;
  readonly authenticityStatus?: EvidenceAuthenticityStatus;
  readonly inRecordStatus?: EvidenceInRecordStatus;
  readonly filingStatus?: EvidenceFilingStatus;
  readonly admissibilityStatus?: EvidenceAdmissibilityStatus;
  readonly novenStatus?: EvidenceNovenStatus;
  readonly amountChf?: number;
  readonly account?: string;
  readonly holder?: string;
  readonly finalBalanceChf?: number;
}

export interface DraftingAttachment {
  readonly id: string;
  readonly label: string;
  readonly evidenceId?: string;
}

export interface ChallengedPassageInput {
  readonly id: string;
  readonly exactText: string;
  readonly sourceDocumentId: string;
  readonly page?: string;
  readonly paragraph?: string;
  readonly section?: string;
  readonly consideration?: string;
  readonly language?: "de" | "fr" | "it";
  readonly author:
    | "decision_authority"
    | "lower_instance"
    | "opposing_party"
    | "applicant"
    | "appellant"
    | "expert"
    | "third_party"
    | "reviewing_court";
  readonly function:
    | "fact"
    | "allegation"
    | "evidence_assessment"
    | "legal_interpretation"
    | "subsumption"
    | "conclusion"
    | "subsidiary_argument"
    | "alternative_ground"
    | "obiter_dictum";
  readonly importance: "low" | "medium" | "high" | "decisive";
  readonly autonomousGround?: boolean;
  readonly contextBefore?: string;
  readonly contextAfter?: string;
  readonly quoteVerified?: boolean;
  readonly quoteVerification?: {
    readonly quote_matches_user_input?: boolean;
    readonly quote_extracted_from_source?: boolean;
    readonly quote_verified_against_source?: boolean;
    readonly context_checked?: boolean;
    readonly source_location_verified?: boolean;
    readonly source_document_full_text_read?: boolean;
    readonly quote_translation?: boolean;
    readonly quote_paraphrase?: boolean;
  };
}

export interface ExtractedChallengedPassage extends ChallengedPassageInput {
  readonly language: "de" | "fr" | "it";
  readonly contextChecked: boolean;
  readonly quoteStatus: QuoteVerificationStatus;
  readonly caller_asserted_function: ChallengedPassageInput["function"];
  readonly caller_asserted_importance: ChallengedPassageInput["importance"];
  readonly caller_asserted_autonomous_ground: boolean;
  readonly system_inferred_function: ChallengedPassageInput["function"];
  readonly verified_function: ChallengedPassageInput["function"];
  readonly classification_status:
    | "verified"
    | "rejected"
    | "conflict_detected"
    | "insufficient_context"
    | "requires_human_review";
  readonly semantic_conflicts: readonly string[];
  readonly classification_blockers: readonly string[];
  readonly classification_evidence: readonly {
    readonly source: "exact_text" | "context_before" | "context_after";
    readonly excerpt_hash: string;
    readonly matched_markers: readonly string[];
  }[];
  readonly classification_confidence: number;
  readonly reviewed: boolean;
  readonly necessary_for_dispositive: boolean;
  readonly sufficient_for_dispositive: boolean;
  readonly quoteVerification: {
    readonly quote_matches_user_input: boolean;
    readonly quote_extracted_from_source: boolean;
    readonly quote_verified_against_source: boolean;
    readonly context_checked: boolean;
    readonly source_location_verified: boolean;
    readonly source_document_full_text_read: boolean;
    readonly quote_translation: boolean;
    readonly quote_paraphrase: boolean;
  };
}

export interface DraftingCaseInput {
  readonly jurisdiction?: {
    readonly country?: "CH";
    readonly canton?: string;
    readonly territorialJurisdiction?: string;
    readonly subjectMatterJurisdiction?: string;
    readonly functionalJurisdiction?: string;
    readonly venueOrFilingDestination?: string;
  };
  readonly authority?: {
    readonly issuingAuthority?: string;
    readonly competentAuthority?: string;
    readonly appellateAuthority?: string;
    readonly addressee?: string;
  };
  readonly challengedAct?: {
    readonly type?: "decision" | "act" | "omission" | "payment_order" | "private_letter";
    readonly decisionDate?: string;
    readonly notificationDate?: string;
    readonly reference?: string;
    readonly summary?: string;
    readonly legalRemedyInstructionAvailable?: boolean;
    readonly legalRemedyInstruction?: string;
  };
  readonly procedure?: {
    readonly requestedDocumentType?: SwissLegalDocumentType;
    readonly remedy?: string;
    readonly deadlineDate?: string;
    readonly suspensiveEffectRequested?: boolean;
    readonly language?: "de" | "fr" | "it";
    readonly signatureRequired?: boolean;
    readonly filingRequirements?: readonly string[];
    readonly copiesRequired?: number;
  };
  readonly parties?: readonly {
    readonly role: string;
    readonly name?: string;
    readonly address?: string;
  }[];
  readonly objectives?: readonly string[];
  readonly claims?: readonly {
    readonly id: string;
    readonly description: string;
    readonly priority?: "main" | "eventual" | "subeventual" | "procedural";
  }[];
  readonly facts?: readonly DraftingFact[];
  readonly evidence?: readonly DraftingEvidence[];
  readonly attachments?: readonly DraftingAttachment[];
  readonly challengedPassages?: readonly ChallengedPassageInput[];
  readonly citations?: readonly string[];
  readonly caseLawReferences?: readonly string[];
  readonly tone?: ToneProfile;
  readonly detailLevel?: DetailLevel;
  readonly languageProfile?: SwissLegalLanguageProfile;
  readonly place?: string;
  readonly draftingDate?: string;
  readonly signatureDate?: string;
  readonly filingDate?: string;
  readonly costsRequest?: {
    readonly requested?: boolean;
    readonly procedureTypeConfirmed?: boolean;
    readonly opposingPartyConfirmed?: boolean;
    readonly authorityPowerConfirmed?: boolean;
    readonly compensationBasisConfirmed?: boolean;
    readonly legalBasis?: string;
  };
  readonly fullTextDecisionAvailable?: boolean;
}

export interface ProceduralRequirementsResult {
  readonly documentType: SwissLegalDocumentType;
  readonly confidence: number;
  readonly requirements: Record<
    string,
    { readonly status: DraftingCheckStatus | JurisdictionDimensionStatus; readonly value: unknown }
  >;
  readonly jurisdictionDimensions: Record<
    | "country_legal_system"
    | "territorial_jurisdiction"
    | "subject_matter_jurisdiction"
    | "functional_jurisdiction"
    | "issuing_authority"
    | "appellate_authority"
    | "procedural_remedy"
    | "venue_or_filing_destination",
    { readonly status: JurisdictionDimensionStatus; readonly value: unknown }
  >;
  readonly warnings: readonly string[];
}

export function determineProceduralRequirements(
  input: DraftingCaseInput,
): ProceduralRequirementsResult {
  const documentType = inferDocumentType(input);
  const warnings = new Set<string>();
  const canton = input.jurisdiction?.canton ?? null;
  const remedy = input.procedure?.remedy ?? input.challengedAct?.legalRemedyInstruction ?? null;
  const language = input.procedure?.language ?? languageForCanton(canton);
  const jurisdictionDimensions = assessJurisdictionDimensions(input, documentType, remedy);

  if (isPlaceholderValue(remedy) && requiresRemedy(documentType))
    warnings.add("procedural_remedy_not_confirmed");
  if (isPlaceholderValue(input.procedure?.deadlineDate) && requiresDeadline(documentType))
    warnings.add("deadline_not_confirmed");
  if (isPlaceholderValue(input.authority?.competentAuthority))
    warnings.add("competent_authority_not_confirmed");
  if (isPlaceholderValue(canton) && documentType !== "AussergerichtlicheAufforderung")
    warnings.add("jurisdiction_not_confirmed");
  if (isPlaceholderValue(language)) warnings.add("procedural_language_not_confirmed");
  if (
    !input.parties?.some((party) =>
      ["appellant", "applicant", "debtor", "claimant"].includes(party.role),
    )
  ) {
    warnings.add("standing_not_confirmed");
  }
  if (isPlaceholderValue(input.challengedAct?.notificationDate) && requiresDeadline(documentType)) {
    warnings.add("notification_date_missing");
  }
  const profileWarningCount = warnings.size;
  for (const [key, dimension] of Object.entries(jurisdictionDimensions)) {
    if (dimension.status === "not_verified") warnings.add(`${key}_not_confirmed`);
    if (dimension.status === "contradicted" || dimension.status === "failed")
      warnings.add(`${key}_${dimension.status}`);
  }
  const jurisdictionLegacyStatus = jurisdictionDimensionsConfirmed(jurisdictionDimensions)
    ? "passed"
    : "not_verified";

  return {
    documentType,
    confidence: profileWarningCount === 0 ? 0.82 : profileWarningCount <= 2 ? 0.58 : 0.32,
    requirements: {
      ...jurisdictionDimensions,
      challenged_act: statusValue(input.challengedAct?.type),
      decision_date: statusValue(input.challengedAct?.decisionDate),
      notification_date: statusValue(input.challengedAct?.notificationDate),
      issuing_authority: statusValue(input.authority?.issuingAuthority),
      competent_authority: statusValue(input.authority?.competentAuthority),
      appellate_authority: jurisdictionDimensions.appellate_authority,
      venue_or_filing_destination: jurisdictionDimensions.venue_or_filing_destination,
      jurisdiction: {
        status: jurisdictionLegacyStatus,
        value: {
          deprecated: true,
          reason: "use decomposed jurisdiction dimensions",
          country: input.jurisdiction?.country ?? null,
          canton,
        },
      },
      procedural_remedy: statusValue(remedy),
      deadline: statusValue(input.procedure?.deadlineDate),
      suspensive_effect: {
        status: input.procedure?.suspensiveEffectRequested ? "passed" : "not_applicable",
        value: input.procedure?.suspensiveEffectRequested ?? false,
      },
      standing: statusValue(input.parties?.length ? "requires legal review" : null),
      procedural_language: statusValue(language),
      signature: statusValue(input.procedure?.signatureRequired),
      filing_requirements: statusValue(input.procedure?.filingRequirements ?? null),
      copies: statusValue(input.procedure?.copiesRequired ?? null),
      attachments: statusValue(input.attachments?.length ? input.attachments.length : null),
      legal_remedy_instruction: statusValue(input.challengedAct?.legalRemedyInstruction ?? null),
    },
    jurisdictionDimensions,
    warnings: [...warnings],
  };
}

function assessJurisdictionDimensions(
  input: DraftingCaseInput,
  documentType: SwissLegalDocumentType,
  remedy: string | null,
): ProceduralRequirementsResult["jurisdictionDimensions"] {
  const country = input.jurisdiction?.country;
  const canton = input.jurisdiction?.canton;
  const issuingAuthority = input.authority?.issuingAuthority;
  const appellateAuthority =
    input.authority?.competentAuthority ?? input.authority?.appellateAuthority;
  const subjectMatter = input.jurisdiction?.subjectMatterJurisdiction;
  const functional = input.jurisdiction?.functionalJurisdiction ?? appellateAuthority;
  const venue = input.jurisdiction?.venueOrFilingDestination ?? input.authority?.addressee;
  const remedyContradiction =
    !isPlaceholderValue(remedy) &&
    !isPlaceholderValue(appellateAuthority) &&
    /rechtsvorschlag/i.test(remedy ?? "") &&
    /gericht|court|bezirksrat|verwaltungsgericht/i.test(appellateAuthority ?? "");
  return {
    country_legal_system: {
      status: country === "CH" ? "confirmed" : "not_verified",
      value: country ?? null,
    },
    territorial_jurisdiction: {
      status: isPlaceholderValue(canton) ? "not_verified" : "confirmed",
      value: canton ?? null,
    },
    subject_matter_jurisdiction: {
      status: isPlaceholderValue(subjectMatter) ? "not_verified" : "confirmed",
      value: subjectMatter ?? null,
    },
    functional_jurisdiction: {
      status: remedyContradiction
        ? "contradicted"
        : isPlaceholderValue(functional)
          ? "not_verified"
          : input.jurisdiction?.functionalJurisdiction
            ? "confirmed"
            : "requires_legal_review",
      value: functional ?? null,
    },
    issuing_authority: {
      status: isPlaceholderValue(issuingAuthority) ? "not_verified" : "confirmed",
      value: issuingAuthority ?? null,
    },
    appellate_authority: {
      status: remedyContradiction
        ? "contradicted"
        : isPlaceholderValue(appellateAuthority)
          ? "not_verified"
          : "confirmed",
      value: appellateAuthority ?? null,
    },
    procedural_remedy: {
      status:
        isPlaceholderValue(remedy) && requiresRemedy(documentType) ? "not_verified" : "confirmed",
      value: remedy ?? null,
    },
    venue_or_filing_destination: {
      status: isPlaceholderValue(venue) ? "not_verified" : "confirmed",
      value: venue ?? null,
    },
  };
}

function jurisdictionDimensionsConfirmed(
  dimensions: ProceduralRequirementsResult["jurisdictionDimensions"],
): boolean {
  return [
    dimensions.country_legal_system,
    dimensions.territorial_jurisdiction,
    dimensions.subject_matter_jurisdiction,
    dimensions.functional_jurisdiction,
    dimensions.issuing_authority,
    dimensions.appellate_authority,
    dimensions.procedural_remedy,
    dimensions.venue_or_filing_destination,
  ].every((dimension) => dimension.status === "confirmed");
}

function inferDocumentType(input: DraftingCaseInput): SwissLegalDocumentType {
  if (input.procedure?.requestedDocumentType) return input.procedure.requestedDocumentType;
  const text =
    `${input.procedure?.remedy ?? ""} ${input.challengedAct?.type ?? ""} ${input.challengedAct?.summary ?? ""} ${input.objectives?.join(" ") ?? ""}`.toLowerCase();
  if (/rechtsvorschlag|payment order|zahlungsbefehl/.test(text)) return "Rechtsvorschlag";
  if (/fristerstreck|extend.*deadline|frist/.test(text)) return "Fristerstreckungsgesuch";
  if (/akteneinsicht|inspect.*file|access.*file/.test(text)) return "Akteneinsichtsgesuch";
  if (/unentgelt|legal aid|assistance juridique/.test(text)) return "UnentgeltlicheRechtspflege";
  if (/replik/.test(text)) return "Replik";
  if (/rekurs/.test(text)) return "Rekurs";
  if (/einsprache/.test(text)) return "Einsprache";
  if (/beschwerde|appeal/.test(text)) return "Beschwerde";
  if (/vergleich|settlement/.test(text)) return "Vergleichsvorschlag";
  if (/aussergericht|mahnung|aufforderung/.test(text)) return "AussergerichtlicheAufforderung";
  if (/memo|memorandum/.test(text)) return "RechtlichesMemorandum";
  if (input.challengedAct?.type === "decision") return "Beschwerde";
  return "Gesuch";
}

function requiresRemedy(documentType: SwissLegalDocumentType): boolean {
  return ["Einsprache", "Beschwerde", "Rekurs", "Revisionsgesuch"].includes(documentType);
}

function requiresDeadline(documentType: SwissLegalDocumentType): boolean {
  return ![
    "AussergerichtlicheAufforderung",
    "Vergleichsvorschlag",
    "RechtlichesMemorandum",
  ].includes(documentType);
}

function statusValue(value: unknown): { status: DraftingCheckStatus; value: unknown } {
  return {
    status: isPlaceholderValue(value) ? "not_verified" : "passed",
    value: value ?? null,
  };
}

const PLACEHOLDER_PATTERNS = [
  /^\s*$/,
  /^\[[^\]]+\]$/,
  /zu prüfen/i,
  /zu pruefen/i,
  /bitte ergänzen/i,
  /bitte ergaenzen/i,
  /nicht bestätigt/i,
  /nicht bestaetigt/i,
  /nicht verifiziert/i,
  /not verified/i,
  /to be confirmed/i,
  /to be verified/i,
];

export function isPlaceholderValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
  if (Array.isArray(value))
    return value.length === 0 || value.some((item) => isPlaceholderValue(item));
  return false;
}

export function languageForCanton(canton?: string | null): "de" | "fr" | "it" | null {
  if (!canton) return null;
  const upper = canton.toUpperCase();
  if (["GE", "VD", "NE", "JU"].includes(upper)) return "fr";
  if (upper === "TI") return "it";
  return "de";
}

export function formatSwissAmount(amount: number): string {
  const [francs, cents] = amount.toFixed(2).split(".");
  return `CHF ${francs!.replace(/\B(?=(\d{3})+(?!\d))/g, "’")}.${cents}`;
}

export function buildRechtsbegehren(input: DraftingCaseInput) {
  const warnings = new Set<string>();
  const objectives = input.objectives ?? [];
  const claims = input.claims ?? [];
  const requests: DraftingRequestTrace[] = [];
  const tracedObjectives = new Set<number>();
  const authorityStatus = statusValue(input.authority?.competentAuthority).status;
  const legalBasisStatus = (input.citations ?? []).length > 0 ? "passed" : "not_verified";
  const matchingObjectiveIndexes = (pattern: RegExp) =>
    objectives
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => pattern.test(item.toLowerCase()))
      .map(({ index }) => index);
  const pushRequest = (params: {
    objectiveIndexes: number[];
    kind: string;
    text: string;
    classification: string;
    supportedBy: string[];
    status?: DraftingRequestTrace["status"];
    reason?: string;
  }) => {
    for (const index of params.objectiveIndexes) tracedObjectives.add(index);
    const status = params.status ?? (params.supportedBy.length > 0 ? "accepted" : "unsupported");
    requests.push({
      kind: params.kind,
      number: String(requests.length + 1),
      text: params.text,
      supportedBy: params.supportedBy,
      original_request: params.objectiveIndexes.map((index) => objectives[index]).join(" | "),
      normalized_request: params.text,
      classification: params.classification,
      status,
      reason:
        params.reason ??
        (params.supportedBy.length > 0
          ? "request_supported_by_claim"
          : "request_kept_but_requires_reasoning_or_legal_review"),
      legal_basis_status: legalBasisStatus,
      authority_power_status: authorityStatus,
      procedural_fit: params.objectiveIndexes.length > 0 ? "passed" : "not_verified",
      retained_in_final_draft: !["rejected", "duplicate", "contradictory"].includes(status),
    });
  };

  const annulment = matchingObjectiveIndexes(/annul|aufheb|cancel|aufhebung/);
  const remand = matchingObjectiveIndexes(/remand|rückweisung|rueckweisung|neubeurteilung/);
  const legalAid = matchingObjectiveIndexes(/unentgelt|legal aid|assistance juridique/);
  const suspensive = matchingObjectiveIndexes(/aufschieb|suspensive/);
  const extension = matchingObjectiveIndexes(/frist|extension|erstreck|nachfrist/);
  const fileAccess = matchingObjectiveIndexes(/akteneinsicht|file access|edition|kontoauszug/);
  const costs = matchingObjectiveIndexes(/kosten|entschädigung|entschaedigung/);

  if (annulment.length > 0 && remand.length > 0) {
    warnings.add("requests_require_hierarchy_review");
    warnings.add("contradictory_requests");
  }
  if (annulment.length > 0) {
    pushRequest({
      objectiveIndexes: annulment,
      kind: "Hauptantrag",
      text: "Die angefochtene Verfügung sei aufzuheben.",
      classification: "annulment",
      supportedBy: linkedClaimIds(claims, "aufheb"),
    });
  }
  if (remand.length > 0 || (requests.length === 0 && input.challengedAct?.type === "decision")) {
    pushRequest({
      objectiveIndexes: remand,
      kind: annulment.length > 0 ? "Eventualantrag" : "Hauptantrag",
      text: "Die Sache sei zur neuen Beurteilung an die Vorinstanz zurückzuweisen.",
      classification: "remand",
      supportedBy: linkedClaimIds(claims, "rückweisung|rueckweisung|neubeurteilung|new decision"),
    });
  }
  if (suspensive.length > 0) {
    pushRequest({
      objectiveIndexes: suspensive,
      kind: "Verfahrensantrag",
      text: "Der Beschwerde sei die aufschiebende Wirkung zu erteilen.",
      classification: "suspensive_effect",
      supportedBy: linkedClaimIds(claims, "aufschieb|suspensive"),
    });
  }
  if (legalAid.length > 0) {
    pushRequest({
      objectiveIndexes: legalAid,
      kind: "Verfahrensantrag",
      text: "Es sei die unentgeltliche Rechtspflege zu gewähren.",
      classification: "legal_aid",
      supportedBy: linkedClaimIds(claims, "unentgelt|legal aid"),
    });
  }
  if (extension.length > 0) {
    pushRequest({
      objectiveIndexes: extension,
      kind: "Verfahrensantrag",
      text: "Es sei eine angemessene Nachfrist zur Ergänzung der Unterlagen anzusetzen.",
      classification: "extension_or_nachfrist",
      supportedBy: linkedClaimIds(claims, "frist|extension|erstreck|nachfrist"),
    });
  }
  if (fileAccess.length > 0) {
    pushRequest({
      objectiveIndexes: fileAccess,
      kind: "Verfahrensantrag",
      text: "Die Vorinstanz sei anzuweisen, den bezeichneten Kontoauszug beizuziehen beziehungsweise zur Edition aufzufordern.",
      classification: "evidence_taking",
      supportedBy: linkedClaimIds(claims, "akteneinsicht|file access|kontoauszug|edition"),
    });
  }
  if (costs.length > 0) {
    const costStatus = assessCostsRequest(input).status;
    pushRequest({
      objectiveIndexes: costs,
      kind: "Verfahrensantrag",
      text: "Über Kosten- und Entschädigungsfolgen sei nach verifizierter prozessualer Grundlage zu entscheiden.",
      classification: "costs_and_compensation",
      supportedBy: linkedClaimIds(claims, "kosten|entschädigung|entschaedigung"),
      status: costStatus === "passed" ? "accepted" : "deferred_pending_verification",
      reason: costStatus === "passed" ? "costs_basis_confirmed" : "costs_request_not_verified",
    });
  }
  objectives.forEach((objective, index) => {
    if (tracedObjectives.has(index)) return;
    pushRequest({
      objectiveIndexes: [index],
      kind: "Verfahrensantrag",
      text: `[ANTRAG ZU PRÜFEN] ${objective}`,
      classification: "unclassified",
      supportedBy: [],
      status: "deferred_pending_verification",
      reason: "request_not_classified_by_deterministic_rules",
    });
    warnings.add("request_pending_verification");
  });
  if (requests.length === 0) {
    pushRequest({
      objectiveIndexes: [],
      kind: "Hauptantrag",
      text: "[RECHTSBEGEHREN ZU PRÜFEN]",
      classification: "missing_request",
      supportedBy: [],
      status: "deferred_pending_verification",
      reason: "no_request_objective_supplied",
    });
    warnings.add("request_not_supported_by_reasoning");
  }
  for (const request of requests) {
    if (request.supportedBy.length === 0 && !request.text.includes("[RECHTSBEGEHREN")) {
      warnings.add("request_not_supported_by_reasoning");
    }
  }
  if (authorityStatus !== "passed") warnings.add("authority_lacks_requested_power");
  return { requests, warnings: [...warnings] };
}

export interface DraftingRequestTrace {
  readonly kind: string;
  readonly number: string;
  readonly text: string;
  readonly supportedBy: readonly string[];
  readonly original_request: string;
  readonly normalized_request: string;
  readonly classification: string;
  readonly status:
    | "accepted"
    | "reformulated"
    | "rejected"
    | "deferred_pending_verification"
    | "duplicate"
    | "contradictory"
    | "unsupported"
    | "authority_not_competent";
  readonly reason: string;
  readonly legal_basis_status: DraftingCheckStatus;
  readonly authority_power_status: DraftingCheckStatus;
  readonly procedural_fit: DraftingCheckStatus;
  readonly retained_in_final_draft: boolean;
}

function linkedClaimIds(
  claims: readonly { id: string; description: string }[],
  pattern: string,
): string[] {
  const regex = new RegExp(pattern, "i");
  return claims.filter((claim) => regex.test(claim.description)).map((claim) => claim.id);
}

export function buildEvidenceIndex(input: DraftingCaseInput) {
  const warnings = new Set<string>();
  const attachments = input.attachments ?? [];
  const evidence = input.evidence ?? [];
  const attachmentIds = new Set(attachments.map((item) => item.id));
  const seenLabels = new Set<string>();
  for (const attachment of attachments) {
    if (seenLabels.has(attachment.label)) warnings.add("duplicate_attachment");
    seenLabels.add(attachment.label);
  }
  const index = evidence.map((item) => {
    const evidenceStatus = assessEvidenceStatus(item, attachmentIds);
    const proceduralStatus = evidenceStatus.procedural_status;
    if (item.attachment && !attachmentIds.has(item.attachment))
      warnings.add("cited_attachment_missing");
    if ((item.provesFactIds?.length ?? 0) === 0 && (item.linkedClaimIds?.length ?? 0) === 0) {
      warnings.add("evidence_without_argument_link");
    }
    if (proceduralStatus === "missing") warnings.add("evidence_missing");
    if (proceduralStatus === "existence_not_confirmed")
      warnings.add("evidence_existence_not_confirmed");
    if (proceduralStatus === "noven_risk" || proceduralStatus === "proposed_new_evidence")
      warnings.add("noven_risk");
    if (proceduralStatus === "authenticity_unconfirmed")
      warnings.add("evidence_authenticity_unconfirmed");
    if (!evidenceStatus.usable_as_current_support) warnings.add(evidenceStatus.reason);
    return {
      evidence_id: item.evidenceId,
      name: item.name,
      type: item.type,
      date: item.date ?? null,
      issuer: item.issuer ?? null,
      page: item.page ?? null,
      attachment: item.attachment ?? null,
      proves_fact_ids: item.provesFactIds ?? [],
      linked_claim_ids: item.linkedClaimIds ?? [],
      authenticity: item.authenticity ?? "unknown",
      source: item.source ?? "user_supplied",
      admissibility: item.admissibility ?? "not_assessed",
      procedural_status: proceduralStatus,
      assertion_source: evidenceStatus.assertion_source,
      existence_status: evidenceStatus.existence_status,
      availability_status: evidenceStatus.availability_status,
      content_verification_status: evidenceStatus.content_verification_status,
      authenticity_status: evidenceStatus.authenticity_status,
      in_record_status: evidenceStatus.in_record_status,
      filing_status: evidenceStatus.filing_status,
      admissibility_status: evidenceStatus.admissibility_status,
      noven_status: evidenceStatus.noven_status,
      reason: evidenceStatus.reason,
      risk: evidenceStatus.risk,
      confidence: evidenceStatus.confidence,
      usable_as_current_support: evidenceStatus.usable_as_current_support,
      clean_document_label: labelEvidenceStatus(proceduralStatus),
    };
  });
  const transfer = analyzeInternalTransfer(input);
  if (transfer.warnings.length > 0) for (const warning of transfer.warnings) warnings.add(warning);
  return { evidenceIndex: index, internalTransferAnalysis: transfer, warnings: [...warnings] };
}

function normalizeEvidenceStatus(item: DraftingEvidence): EvidenceProceduralStatus {
  if (item.proceduralStatus) return item.proceduralStatus;
  if (item.admissibility === "risky") return "noven_risk";
  if (item.source === "new") return "proposed_new_evidence";
  if (item.authenticity !== "confirmed") return "authenticity_unconfirmed";
  if (item.source === "filed_record") return "in_record_confirmed";
  if (item.source === "user_supplied") return "available_not_yet_filed";
  return "reference_only";
}

function assessEvidenceStatus(
  item: DraftingEvidence,
  attachmentIds: ReadonlySet<string>,
): {
  readonly procedural_status: EvidenceProceduralStatus;
  readonly assertion_source: EvidenceAssertionSource;
  readonly existence_status: EvidenceExistenceStatus;
  readonly availability_status: EvidenceAvailabilityStatus;
  readonly content_verification_status: EvidenceContentVerificationStatus;
  readonly authenticity_status: EvidenceAuthenticityStatus;
  readonly in_record_status: EvidenceInRecordStatus;
  readonly filing_status: EvidenceFilingStatus;
  readonly admissibility_status: EvidenceAdmissibilityStatus;
  readonly noven_status: EvidenceNovenStatus;
  readonly usable_as_current_support: boolean;
  readonly reason: string;
  readonly risk: string;
  readonly confidence: number;
} {
  const proceduralStatus = normalizeEvidenceStatus(item);
  const hasAvailableAttachment = Boolean(item.attachment && attachmentIds.has(item.attachment));
  const assertionSource =
    item.assertionSource ??
    (item.source === "authority"
      ? "authority"
      : item.source === "opposing_party"
        ? "opposing_party"
        : item.source === "filed_record" && hasAvailableAttachment
          ? "source_document"
          : item.source === "user_supplied" || item.source === "filed_record"
            ? "user"
            : "unknown");
  const availabilityStatus =
    item.availabilityStatus ??
    (proceduralStatus === "missing"
      ? "missing"
      : hasAvailableAttachment
        ? "available_to_tool"
        : "referenced_but_not_available");
  const existenceStatus =
    item.existenceStatus ??
    (proceduralStatus === "existence_not_confirmed"
      ? "existence_not_confirmed"
      : hasAvailableAttachment
        ? "source_confirmed"
        : "user_asserted");
  const authenticityStatus =
    item.authenticityStatus ??
    (item.authenticity === "confirmed" && hasAvailableAttachment
      ? "confirmed"
      : item.authenticity === "disputed"
        ? "disputed"
        : "unconfirmed");
  const contentVerificationStatus =
    item.contentVerificationStatus ??
    (hasAvailableAttachment && item.authenticity === "confirmed"
      ? "verified_against_document"
      : availabilityStatus === "referenced_but_not_available" && existenceStatus === "user_asserted"
        ? "user_described_only"
        : "not_verified");
  const inRecordStatus =
    item.inRecordStatus ??
    (item.source === "filed_record" && hasAvailableAttachment
      ? "in_record_confirmed"
      : item.source === "filed_record"
        ? "claimed_to_be_in_record"
        : item.source === "new"
          ? "not_in_record"
          : "not_verified");
  const filingStatus =
    item.filingStatus ??
    (proceduralStatus === "in_record_confirmed" && inRecordStatus === "in_record_confirmed"
      ? "already_filed"
      : proceduralStatus === "proposed_new_evidence" || proceduralStatus === "noven_risk"
        ? "proposed_new_evidence"
        : proceduralStatus === "available_not_yet_filed"
          ? "available_not_yet_filed"
          : proceduralStatus === "missing"
            ? "missing"
            : "not_verified");
  const admissibilityStatus =
    item.admissibilityStatus ??
    (proceduralStatus === "noven_risk" ||
    proceduralStatus === "proposed_new_evidence" ||
    item.admissibility === "risky"
      ? "noven_risk"
      : item.admissibility === "likely" && filingStatus === "already_filed"
        ? "admissible_confirmed"
        : "admissibility_not_verified");
  const novenStatus =
    item.novenStatus ??
    (admissibilityStatus === "noven_risk" || proceduralStatus === "proposed_new_evidence"
      ? "possible_noven"
      : filingStatus === "already_filed"
        ? "no_known_noven_issue"
        : "not_verified");
  const usableAsCurrentSupport =
    existenceStatus === "source_confirmed" &&
    availabilityStatus === "available_to_tool" &&
    contentVerificationStatus === "verified_against_document" &&
    (authenticityStatus === "confirmed" || authenticityStatus === "presumed") &&
    inRecordStatus === "in_record_confirmed" &&
    filingStatus === "already_filed" &&
    admissibilityStatus === "admissible_confirmed";
  const reason = usableAsCurrentSupport
    ? "verified_current_record_support"
    : reasonForEvidenceStatus({
        availabilityStatus,
        contentVerificationStatus,
        existenceStatus,
        filingStatus,
        admissibilityStatus,
        inRecordStatus,
      });
  return {
    procedural_status: proceduralStatus,
    assertion_source: assertionSource,
    existence_status: existenceStatus,
    availability_status: availabilityStatus,
    content_verification_status: contentVerificationStatus,
    authenticity_status: authenticityStatus,
    in_record_status: inRecordStatus,
    filing_status: filingStatus,
    admissibility_status: admissibilityStatus,
    noven_status: novenStatus,
    usable_as_current_support: usableAsCurrentSupport,
    reason,
    risk:
      admissibilityStatus === "noven_risk"
        ? "noven_risk"
        : usableAsCurrentSupport
          ? "ordinary"
          : reason,
    confidence: usableAsCurrentSupport
      ? 0.78
      : contentVerificationStatus === "user_described_only"
        ? 0.25
        : 0.1,
  };
}

function reasonForEvidenceStatus(params: {
  readonly availabilityStatus: EvidenceAvailabilityStatus;
  readonly contentVerificationStatus: EvidenceContentVerificationStatus;
  readonly existenceStatus: EvidenceExistenceStatus;
  readonly filingStatus: EvidenceFilingStatus;
  readonly admissibilityStatus: EvidenceAdmissibilityStatus;
  readonly inRecordStatus: EvidenceInRecordStatus;
}): string {
  if (params.existenceStatus === "existence_not_confirmed") return "existence_not_confirmed";
  if (params.availabilityStatus !== "available_to_tool")
    return "document_not_available_for_verification";
  if (params.contentVerificationStatus !== "verified_against_document")
    return "content_not_verified_against_document";
  if (params.filingStatus === "proposed_new_evidence")
    return "proposed_new_evidence_noven_review_required";
  if (params.admissibilityStatus === "noven_risk") return "noven_risk";
  if (params.inRecordStatus !== "in_record_confirmed") return "record_presence_not_verified";
  return "not_usable_as_current_support";
}

function labelEvidenceStatus(status: EvidenceProceduralStatus): string {
  switch (status) {
    case "in_record_confirmed":
      return "aktenkundig";
    case "available_not_yet_filed":
      return "neu einzureichen";
    case "proposed_new_evidence":
    case "noven_risk":
      return "neu einzureichen / Noven-Risiko";
    case "missing":
      return "derzeit nicht verfügbar";
    case "existence_not_confirmed":
      return "Existenz nicht bestätigt";
    case "inadmissible":
      return "nicht zulässig";
    case "authenticity_unconfirmed":
      return "Echtheit nicht bestätigt";
    case "reference_only":
      return "nur Referenz";
  }
}

export function analyzeInternalTransfer(input: DraftingCaseInput) {
  const bankEvidence = (input.evidence ?? []).filter((item) => item.type === "bank_statement");
  const amounts = new Map<number, DraftingEvidence[]>();
  for (const item of bankEvidence) {
    if (item.amountChf !== undefined)
      amounts.set(item.amountChf, [...(amounts.get(item.amountChf) ?? []), item]);
  }
  const repeatedAmount = [...amounts.entries()].find(([, items]) => items.length >= 2);
  const sameHolder =
    bankEvidence.length >= 2 &&
    new Set(bankEvidence.map((item) => item.holder).filter(Boolean)).size === 1;
  const zeroFinalBalance = bankEvidence.some((item) => item.finalBalanceChf === 0);
  const commissionDifference = bankEvidence.length >= 2 && hasCommissionDifference(bankEvidence);
  const possibleDoubleCounting = Boolean(repeatedAmount && sameHolder);
  return {
    same_holder: sameHolder,
    same_amount_traceable: Boolean(repeatedAmount),
    commission_difference_explainable: commissionDifference,
    zero_final_balance_intermediate_account: zeroFinalBalance,
    possible_double_counting: possibleDoubleCounting,
    no_asset_increase_conclusion:
      possibleDoubleCounting && zeroFinalBalance
        ? "Eine Übertragung zwischen Konten desselben Inhabers begründet für sich allein keinen Vermögenszuwachs."
        : "[NICHT VERIFIZIERT]",
    authority_alternative_interpretation:
      "Die Behörde kann einwenden, die Konten seien nicht vollständig offengelegt oder die Verfügbarkeit sei zeitlich anders zu beurteilen.",
    warnings: [
      ...(possibleDoubleCounting ? ["possible_double_counting"] : []),
      ...(commissionDifference ? ["bank_fee_difference_detected"] : []),
    ],
  };
}

function hasCommissionDifference(evidence: readonly DraftingEvidence[]): boolean {
  const amounts = evidence
    .map((item) => item.amountChf)
    .filter((amount): amount is number => amount !== undefined);
  return amounts.some((left) =>
    amounts.some((right) => left !== right && Math.abs(left - right) <= 50),
  );
}

export function extractChallengedPassages(
  input: DraftingCaseInput & { readonly sourceText?: string },
): {
  readonly passages: readonly ExtractedChallengedPassage[];
  readonly warnings: readonly string[];
} {
  const warnings = new Set<string>();
  const passages: ExtractedChallengedPassage[] = (input.challengedPassages ?? []).map((passage) => {
    const quoteVerification = normalizeQuoteVerification(passage);
    const classification = verifyPassageClassification(passage, quoteVerification);
    if (!quoteVerification.quote_verified_against_source) warnings.add("quote_not_verified");
    if (!quoteVerification.context_checked) warnings.add("quote_context_not_checked");
    if (!quoteVerification.source_location_verified)
      warnings.add("quote_source_location_not_verified");
    if (!quoteVerification.source_document_full_text_read)
      warnings.add("source_document_full_text_not_read");
    if (passage.function === "allegation" && passage.author !== "decision_authority") {
      warnings.add("passage_is_party_allegation_not_authority_finding");
    }
    for (const blocker of classification.classification_blockers) warnings.add(blocker);
    return {
      ...passage,
      language: passage.language ?? input.procedure?.language ?? "de",
      function: classification.verified_function,
      importance: classification.verified_importance,
      autonomousGround: classification.verified_autonomous_ground,
      contextChecked: quoteVerification.context_checked,
      quoteStatus: quoteVerification.quote_verified_against_source
        ? "quote_verified_against_source"
        : quoteVerification.quote_extracted_from_source
          ? "quote_extracted_from_source"
          : quoteVerification.quote_matches_user_input
            ? "quote_matches_user_input"
            : "quote_not_verified",
      caller_asserted_function: passage.function,
      caller_asserted_importance: passage.importance,
      caller_asserted_autonomous_ground: passage.autonomousGround === true,
      system_inferred_function: classification.system_inferred_function,
      verified_function: classification.verified_function,
      classification_status: classification.classification_status,
      semantic_conflicts: classification.semantic_conflicts,
      classification_blockers: classification.classification_blockers,
      classification_evidence: classification.classification_evidence,
      classification_confidence: classification.classification_confidence,
      reviewed: classification.reviewed,
      necessary_for_dispositive: classification.necessary_for_dispositive,
      sufficient_for_dispositive: classification.sufficient_for_dispositive,
      quoteVerification,
    };
  });
  if (input.sourceText && passages.length === 0) {
    const sentences = input.sourceText
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => sentence.length > 20)
      .slice(0, 5);
    return {
      passages: sentences.map((sentence, index): ExtractedChallengedPassage => ({
        id: `passage-${index + 1}`,
        exactText: sentence,
        sourceDocumentId: "user_supplied_text",
        author: "decision_authority",
        function: inferPassageFunction(sentence),
        importance: index === 0 ? "high" : "medium",
        autonomousGround: false,
        language: input.procedure?.language ?? "de",
        contextChecked: false,
        quoteStatus: "quote_not_verified",
        caller_asserted_function: inferPassageFunction(sentence),
        caller_asserted_importance: index === 0 ? "high" : "medium",
        caller_asserted_autonomous_ground: false,
        system_inferred_function: inferPassageFunction(sentence),
        verified_function: inferPassageFunction(sentence),
        classification_status: "insufficient_context",
        semantic_conflicts: ["insufficient_context_for_ratio"],
        classification_blockers: ["classification_insufficient_context"],
        classification_evidence: [
          {
            source: "exact_text",
            excerpt_hash: stableSha256(sentence),
            matched_markers: [],
          },
        ],
        classification_confidence: 0.2,
        reviewed: false,
        necessary_for_dispositive: false,
        sufficient_for_dispositive: false,
        quoteVerification: {
          quote_matches_user_input: true,
          quote_extracted_from_source: false,
          quote_verified_against_source: false,
          context_checked: false,
          source_location_verified: false,
          source_document_full_text_read: false,
          quote_translation: false,
          quote_paraphrase: false,
        },
      })),
      warnings: ["quote_not_verified"],
    };
  }
  return { passages, warnings: [...warnings] };
}

function normalizeQuoteVerification(
  passage: ChallengedPassageInput,
): ExtractedChallengedPassage["quoteVerification"] {
  const explicit = passage.quoteVerification;
  const legacyVerified = passage.quoteVerified === true;
  const contextChecked =
    explicit?.context_checked ?? Boolean(passage.contextBefore && passage.contextAfter);
  const sourceLocationVerified =
    explicit?.source_location_verified ??
    Boolean(passage.page || passage.paragraph || passage.consideration);
  const fullTextRead = explicit?.source_document_full_text_read ?? legacyVerified;
  const verified =
    explicit?.quote_verified_against_source ??
    (legacyVerified && contextChecked && sourceLocationVerified && fullTextRead);
  return {
    quote_matches_user_input: explicit?.quote_matches_user_input ?? !verified,
    quote_extracted_from_source: explicit?.quote_extracted_from_source ?? verified,
    quote_verified_against_source: verified,
    context_checked: contextChecked,
    source_location_verified: sourceLocationVerified,
    source_document_full_text_read: fullTextRead,
    quote_translation: explicit?.quote_translation ?? false,
    quote_paraphrase: explicit?.quote_paraphrase ?? !verified,
  };
}

function stableSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function verifyPassageClassification(
  passage: ChallengedPassageInput,
  quoteVerification: ExtractedChallengedPassage["quoteVerification"],
): {
  readonly system_inferred_function: ChallengedPassageInput["function"];
  readonly verified_function: ChallengedPassageInput["function"];
  readonly verified_importance: ChallengedPassageInput["importance"];
  readonly verified_autonomous_ground: boolean;
  readonly classification_status: ExtractedChallengedPassage["classification_status"];
  readonly semantic_conflicts: readonly string[];
  readonly classification_blockers: readonly string[];
  readonly classification_evidence: ExtractedChallengedPassage["classification_evidence"];
  readonly classification_confidence: number;
  readonly reviewed: boolean;
  readonly necessary_for_dispositive: boolean;
  readonly sufficient_for_dispositive: boolean;
} {
  const context = `${passage.contextBefore ?? ""} ${passage.exactText} ${
    passage.contextAfter ?? ""
  }`
    .replace(/\s+/g, " ")
    .trim();
  const lower = context.toLowerCase();
  const markerPatterns = [
    ["kann offen gelassen werden", /kann\s+offen\s+gelassen\s+werden/i],
    ["kann dahingestellt bleiben", /kann\s+dahingestellt\s+bleiben/i],
    ["braucht nicht entschieden zu werden", /braucht\s+nicht\s+entschieden\s+zu\s+werden/i],
    ["selbst wenn", /selbst\s+wenn/i],
    ["ohnehin", /\bohnehin\b/i],
    ["im übrigen", /im\s+übrigen|im\s+uebrigen/i],
    ["überdies", /überdies|ueberdies/i],
    ["peut rester ouverte", /peut\s+(?:rester|demeurer)\s+ouverte/i],
    ["peut être laissée indécise", /peut\s+être\s+laissée\s+indécise/i],
    ["à titre surabondant", /à\s+titre\s+surabondant|a\s+titre\s+surabondant/i],
    ["può rimanere aperta", /può\s+rimanere\s+aperta|puo\s+rimanere\s+aperta/i],
  ] as const;
  const matchedMarkers = markerPatterns
    .filter(([, pattern]) => pattern.test(context))
    .map(([marker]) => marker);
  const openQuestion = matchedMarkers.some((marker) =>
    /offen|dahingestellt|nicht entschieden|ouverte|indécise|aperta/i.test(marker),
  );
  const hypothetical = matchedMarkers.some((marker) =>
    /selbst wenn|ohnehin|übrigen|überdies/i.test(marker),
  );
  const decisiveClaim = passage.importance === "decisive" || passage.function === "conclusion";
  const autonomousClaim =
    passage.autonomousGround === true || passage.function === "alternative_ground";
  const sourceReviewed =
    quoteVerification.quote_verified_against_source &&
    quoteVerification.context_checked &&
    quoteVerification.source_document_full_text_read;
  const inferred = inferPassageFunction(context || passage.exactText);
  const semanticConflicts = [
    ...(openQuestion && decisiveClaim ? ["open_question_vs_decisive"] : []),
    ...(hypothetical && decisiveClaim ? ["hypothetical_reasoning_vs_main_ground"] : []),
    ...((openQuestion || hypothetical) && decisiveClaim
      ? ["unnecessary_reasoning_vs_dispositive"]
      : []),
    ...((openQuestion || hypothetical) && (decisiveClaim || autonomousClaim)
      ? ["caller_assertion_vs_source_text"]
      : []),
    ...((openQuestion || hypothetical) && autonomousClaim ? ["obiter_vs_autonomous_ground"] : []),
    ...(!sourceReviewed && decisiveClaim ? ["insufficient_context_for_ratio"] : []),
  ];
  const obiterDetected = openQuestion || /obiter|surabondant|surabondance/.test(lower);
  const verifiedFunction: ChallengedPassageInput["function"] = obiterDetected
    ? "obiter_dictum"
    : passage.function === "alternative_ground" && !sourceReviewed
      ? "subsidiary_argument"
      : passage.function;
  const sufficientForDispositive =
    !obiterDetected &&
    sourceReviewed &&
    passage.autonomousGround === true &&
    /dispositiv|gutheiss|abweisen|abweisung|outcome|issue|entscheid/i.test(context);
  const verifiedAutonomous =
    sufficientForDispositive &&
    /selbständig\s+tragend|independent ground|autonomous ground/i.test(context);
  const classificationStatus: ExtractedChallengedPassage["classification_status"] =
    semanticConflicts.length > 0
      ? "conflict_detected"
      : !sourceReviewed && decisiveClaim
        ? "insufficient_context"
        : sourceReviewed
          ? "verified"
          : "requires_human_review";
  return {
    system_inferred_function: obiterDetected ? "obiter_dictum" : inferred,
    verified_function: verifiedFunction,
    verified_importance: obiterDetected
      ? "low"
      : !sourceReviewed && passage.importance === "decisive"
        ? "high"
        : passage.importance,
    verified_autonomous_ground: verifiedAutonomous,
    classification_status: classificationStatus,
    semantic_conflicts: semanticConflicts,
    classification_blockers: [
      ...(semanticConflicts.length > 0 ? ["classification_conflict_detected"] : []),
      ...(!sourceReviewed && decisiveClaim ? ["classification_insufficient_context"] : []),
    ],
    classification_evidence: [
      {
        source: "exact_text",
        excerpt_hash: stableSha256(passage.exactText),
        matched_markers: matchedMarkers,
      },
    ],
    classification_confidence: sourceReviewed ? (obiterDetected ? 0.9 : 0.72) : 0.35,
    reviewed: sourceReviewed,
    necessary_for_dispositive:
      !obiterDetected && sourceReviewed && passage.importance === "decisive",
    sufficient_for_dispositive: verifiedAutonomous,
  };
}

function inferPassageFunction(sentence: string): ChallengedPassageInput["function"] {
  const lower = sentence.toLowerCase();
  if (/behauptet|macht geltend|bringt vor/.test(lower)) return "allegation";
  if (/deshalb|folglich|somit|daher/.test(lower)) return "conclusion";
  if (/art\.|gesetz|recht/.test(lower)) return "legal_interpretation";
  return "fact";
}

export function buildRebuttalMatrix(input: DraftingCaseInput) {
  const extraction = extractChallengedPassages(input);
  const evidence = buildEvidenceIndex(input);
  const warnings = new Set<string>([...extraction.warnings, ...evidence.warnings]);
  const attackedGroundIds = new Set(
    input.claims?.flatMap((claim) => claim.description.match(/[A-Za-z0-9_-]+/g) ?? []) ?? [],
  );
  const matrix = extraction.passages.map((passage) => {
    const supporting = evidence.evidenceIndex.filter(
      (item) =>
        item.usable_as_current_support &&
        (passage.exactText.toLowerCase().includes("konto")
          ? item.type === "bank_statement"
          : item.linked_claim_ids.length > 0),
    );
    const errorAssessment = assessErrorType(
      passage,
      supporting.length > 0,
      evidence.internalTransferAnalysis.possible_double_counting,
    );
    if (
      passage.caller_asserted_autonomous_ground &&
      !passage.quoteVerification.source_document_full_text_read
    ) {
      warnings.add("independent_grounds_not_reviewed");
      warnings.add("possible_independent_ground");
    } else if (passage.autonomousGround && !attackedGroundIds.has(passage.id)) {
      warnings.add("independent_ground_not_challenged");
    }
    return {
      challenged_passage: passage.exactText,
      source_location: {
        documentId: passage.sourceDocumentId,
        page: passage.page ?? null,
        paragraph: passage.paragraph ?? null,
        consideration: passage.consideration ?? null,
      },
      passage_author: passage.author,
      passage_function: passage.function,
      authority_claim:
        passage.author === "decision_authority" ? passage.exactText : "[NICHT VERIFIZIERT]",
      factual_premise: inferFactualPremise(passage.exactText),
      legal_premise: inferLegalPremise(passage.exactText),
      factual_basis_used_by_authority: passage.contextBefore ?? "[NICHT VERIFIZIERT]",
      error_type: errorAssessment.selected_error_type,
      error_assessment: errorAssessment,
      quoteVerification: passage.quoteVerification,
      contradiction_with_record:
        supporting.length > 0 ? supporting.map((item) => item.evidence_id) : [],
      supporting_documents: supporting.map((item) => item.evidence_id),
      applicable_rule: inferApplicableRule(input),
      applicable_case_law: buildCaseLawUse(input),
      counteranalysis: buildCounteranalysis(
        errorAssessment.selected_error_type,
        evidence.internalTransferAnalysis.possible_double_counting,
      ),
      counterargument: buildCounterargument(
        errorAssessment.selected_error_type,
        evidence.internalTransferAnalysis.possible_double_counting,
      ),
      requested_legal_consequence:
        "Aufhebung oder Rückweisung zur neuen Beurteilung, soweit der Fehler entscheidwesentlich ist.",
      residual_risk: supporting.length > 0 ? "medium" : "high",
      confidence:
        supporting.length > 0 && passage.quoteVerification.quote_verified_against_source
          ? 0.72
          : 0.28,
    };
  });
  return {
    rebuttalMatrix: matrix,
    independentGroundWarnings: [...warnings],
    warnings: [...warnings],
  };
}

function assessErrorType(
  passage: ChallengedPassageInput,
  hasSupport: boolean,
  doubleCounting: boolean,
) {
  const candidate_error_types = [
    ...(doubleCounting ? ["unzulässige doppelte Berücksichtigung"] : []),
    ...(hasSupport ? ["aktenwidrige Feststellung"] : []),
    ...(passage.function === "legal_interpretation" ? ["unzutreffende rechtliche Würdigung"] : []),
    ...(passage.function === "allegation"
      ? ["fehlende Trennung von Parteibehauptung und Feststellung"]
      : []),
    "unvollständige Sachverhaltsfeststellung",
  ];
  const selected_error_type =
    doubleCounting && hasSupport
      ? "unzulässige doppelte Berücksichtigung"
      : hasSupport
        ? "aktenwidrige Feststellung"
        : passage.function === "legal_interpretation"
          ? "unzutreffende rechtliche Würdigung"
          : passage.function === "allegation"
            ? "fehlende Trennung von Parteibehauptung und Feststellung"
            : "not_determined";
  return {
    candidate_error_types,
    selected_error_type,
    alternative_error_types: candidate_error_types.filter((item) => item !== selected_error_type),
    required_evidence:
      selected_error_type === "unzulässige doppelte Berücksichtigung"
        ? ["same_value_counted_twice", "same_holder_or_same_asset", "record_contradiction"]
        : selected_error_type === "aktenwidrige Feststellung"
          ? ["identified_record_document", "concrete_contradiction"]
          : ["full_context", "identified_legal_threshold"],
    legal_threshold:
      selected_error_type === "not_determined"
        ? "insufficient_evidence_to_select_error_type"
        : "deterministic_threshold_applied",
    selection_reason:
      selected_error_type === "not_determined"
        ? "evidence_does_not_allow_stable_selection"
        : "selected_from_explicit_passage_function_and_current_record_support",
    confidence: selected_error_type === "not_determined" ? 0.18 : hasSupport ? 0.68 : 0.42,
  };
}

function inferFactualPremise(text: string): string {
  return /konto|betrag|saldo|vermögen|vermoegen/i.test(text)
    ? "Vermögens- oder Kontofeststellung"
    : "[NICHT VERIFIZIERT]";
}

function inferLegalPremise(text: string): string {
  return /mitwirkung|unterlagen|beleg/i.test(text)
    ? "Mitwirkungspflicht / Substantiierung"
    : "[NICHT VERIFIZIERT]";
}

function inferApplicableRule(input: DraftingCaseInput): string {
  const citations = input.citations ?? [];
  const verifiedCaseReference = (input.caseLawReferences ?? []).find((reference) => {
    const verification = verifyOfficialCaseReference(reference);
    const comparability = evaluateCaseComparability({
      reference,
      targetMatterDescription: input.challengedAct?.summary ?? input.objectives?.join(" ") ?? "",
      targetProcedure: input.procedure?.remedy,
      targetFacts: input.facts?.map((fact) => fact.description),
      referenceVerified: verification.status === "officially_verified",
    });
    return (
      comparability.judicialContent.fullTextRead &&
      comparability.classification !== "candidate_only"
    );
  });
  return (
    citations.find((citation) =>
      parseCitations(citation).some(
        (parsed) => parsed.type !== "case_number" && parsed.type !== "bge_atf_dtf",
      ),
    ) ??
    verifiedCaseReference ??
    "[RECHTSMITTEL ZU PRÜFEN]"
  );
}

function buildCaseLawUse(input: DraftingCaseInput) {
  return (input.caseLawReferences ?? []).map((reference) => {
    const verification = verifyOfficialCaseReference(reference);
    const comparability = evaluateCaseComparability({
      reference,
      targetMatterDescription:
        input.challengedAct?.summary ??
        input.claims?.map((claim) => claim.description).join(" ") ??
        "",
      targetProcedure: input.procedure?.remedy,
      targetFacts: input.facts?.map((fact) => fact.description),
      referenceVerified: verification.status === "officially_verified",
    });
    return {
      reference,
      sourceStatus: verification.status,
      officialSource: verification.officialSourceUrl,
      fullTextStatus: comparability.judicialContent.fullTextStatus,
      ratioStatus: comparability.judicialContent.ratioStatus,
      decisiveUseAllowed: comparability.classification !== "candidate_only",
      comparability: comparability.classification,
      warnings: [...verification.warnings, ...comparability.warnings],
    };
  });
}

function buildCounteranalysis(errorType: string, doubleCounting: boolean): string {
  if (doubleCounting) {
    return "Die aktenkundigen Kontobewegungen sind daraufhin zu prüfen, ob derselbe Vermögenswert mehrfach berücksichtigt wurde.";
  }
  if (errorType === "aktenwidrige Feststellung")
    return "Die Feststellung findet in den bezeichneten Akten keine hinreichende Grundlage.";
  return "Die Begründung trägt die prozessuale Folge nur, wenn die rechtlichen und tatsächlichen Voraussetzungen nachgewiesen sind.";
}

function buildCounterargument(errorType: string, doubleCounting: boolean): string {
  if (doubleCounting) {
    return "Eine Übertragung zwischen Konten desselben Inhabers begründet für sich allein keinen zusätzlichen Vermögenszufluss; erforderlich wäre eine selbständige wirtschaftliche Zunahme oder eine nachvollziehbare Begründung abweichender Verfügbarkeit.";
  }
  if (errorType === "aktenwidrige Feststellung")
    return "Diese Feststellung steht im Widerspruch zu den bezeichneten Akten.";
  return "Die angefochtene Begründung ist in diesem Punkt nicht ohne Weiteres nachvollziehbar.";
}

export function buildSwissLegalDraft(input: DraftingCaseInput) {
  const requirements = determineProceduralRequirements(input);
  const requests = buildRechtsbegehren(input);
  const evidence = buildEvidenceIndex(input);
  const rebuttal = buildRebuttalMatrix(input);
  const tone = input.tone ?? defaultTone(requirements.documentType);
  const languageProfile = input.languageProfile ?? "de-CH-legal";
  const cleanDocument = renderCleanDocument(
    input,
    requirements,
    requests.requests,
    rebuttal.rebuttalMatrix,
  );
  const validation = validateDraft({
    cleanDocument,
    input,
    requirements,
    requests,
    evidence,
    rebuttal,
    tone,
    languageProfile,
  });
  return {
    cleanDocument,
    controlReport: {
      documentType: requirements.documentType,
      jurisdictionDimensions: requirements.jurisdictionDimensions,
      jurisdiction: requirements.requirements["jurisdiction"],
      authority: input.authority?.competentAuthority ?? "[ZUSTÄNDIGE BEHÖRDE ZU PRÜFEN]",
      proceduralRemedy: input.procedure?.remedy ?? "[RECHTSMITTEL ZU PRÜFEN]",
      deadline: input.procedure?.deadlineDate ?? "[FRIST ZU PRÜFEN]",
      language:
        input.procedure?.language ??
        languageForCanton(input.jurisdiction?.canton) ??
        "[NICHT VERIFIZIERT]",
      factsUsed:
        input.facts?.filter((fact) =>
          ["confirmed", "accepted_for_drafting"].includes(normalizeFactStatus(fact.status)),
        ) ?? [],
      unverifiedFacts:
        input.facts?.filter(
          (fact) =>
            !["confirmed", "accepted_for_drafting"].includes(normalizeFactStatus(fact.status)),
        ) ?? [],
      evidence: evidence.evidenceIndex,
      attachments: input.attachments ?? [],
      sources: buildCaseLawUse(input),
      citationsVerified: (input.citations ?? []).map((citation) => ({
        citation,
        parsed: parseCitations(citation).length > 0,
      })),
      risks: validation.warnings,
      rebuttals: rebuttal.rebuttalMatrix,
      independentGrounds: rebuttal.rebuttalMatrix.filter(
        (item) => item.passage_function === "alternative_ground",
      ),
      pendingData: requirements.warnings,
      confidence: validation.readyForFiling ? 0.72 : 0.38,
      human_legal_review_required: true,
    },
    legal_drafting_check: validation.checks,
    readyForFiling: validation.readyForFiling,
    warnings: validation.warnings,
  };
}

function defaultTone(documentType: SwissLegalDocumentType): ToneProfile {
  if (documentType === "Vergleichsvorschlag") return "conciliatory";
  if (documentType === "Fristerstreckungsgesuch") return "neutral_formal";
  if (["Beschwerde", "Rekurs", "Revisionsgesuch"].includes(documentType))
    return "judicial_technical";
  return "firm_respectful";
}

function renderCleanDocument(
  input: DraftingCaseInput,
  requirements: ProceduralRequirementsResult,
  requests: readonly { kind: string; number: string; text: string }[],
  rebuttals: readonly {
    challenged_passage: string;
    counterargument: string;
    supporting_documents: string[];
    quoteVerification: ExtractedChallengedPassage["quoteVerification"];
  }[],
): string {
  const authority = input.authority?.competentAuthority ?? "[ZUSTÄNDIGE BEHÖRDE ZU PRÜFEN]";
  const place = input.place ?? "[ORT]";
  const date = input.signatureDate ?? input.filingDate ?? "[DATUM DER UNTERZEICHNUNG]";
  const subject = input.challengedAct?.reference
    ? `${requirements.documentType} betreffend ${input.challengedAct.reference}`
    : `${requirements.documentType} [AKTENZEICHEN / GESCHÄFTSNUMMER]`;
  const deadline = input.procedure?.deadlineDate ?? "[FRIST ZU PRÜFEN]";
  const facts = (input.facts ?? [])
    .map((fact, index) => `${index + 1}. ${renderFact(fact)}`)
    .join("\n");
  const attachmentIds = new Set((input.attachments ?? []).map((item) => item.id));
  const evidenceLines = (input.evidence ?? [])
    .map((item) => renderEvidenceLine(item, attachmentIds))
    .join("\n");
  const attachmentLines = (input.attachments ?? [])
    .map((item) => `${item.label}${item.evidenceId ? ` (${item.evidenceId})` : ""}`)
    .join("\n");
  const rebuttalLines = rebuttals
    .map(
      (item) =>
        `${renderChallengedQuote(item)}\n${item.counterargument}\nBelege: ${item.supporting_documents.join(", ") || "[KEIN AKTENKUNDIGER BELEG]"}.`,
    )
    .join("\n\n");
  const costs = renderCostsRequest(input);
  return stripSharpS(`An ${authority}

${place}, ${date}

Betreff: ${subject}

Frist: ${deadline}

Rechtsbegehren
${requests.map((request) => `${request.number}. ${request.text}`).join("\n")}

Sachverhalt
${facts || "[BITTE ERGÄNZEN]"}

Rechtliche Würdigung und Subsumtion
Die rechtliche Würdigung stützt sich nur auf die bezeichneten Tatsachen, Belege und überprüfbaren Rechtsgrundlagen. Soweit Angaben fehlen, bleiben sie ausdrücklich vorbehalten.

Auseinandersetzung mit der angefochtenen Begründung
${rebuttalLines || "[NICHT VERIFIZIERT]"}

Beweismittel
${evidenceLines || "[BEILAGE FEHLT]"}

Beilagenverzeichnis
${attachmentLines || "[BEILAGE FEHLT]"}

${costs}

Unterschrift
[BITTE ERGÄNZEN]`);
}

function renderFact(fact: DraftingFact): string {
  const status = normalizeFactStatus(fact.status);
  if (status === "confirmed" || status === "accepted_for_drafting") return fact.description;
  if (status === "contradicted")
    return `Zum Punkt "${fact.description}" besteht eine Akten- oder Parteiwiderspruchslage [WIDERSPRUCH ZU KLÄREN].`;
  if (status === "unavailable") return `${fact.description} [DERZEIT NICHT VERFÜGBAR]`;
  return `Soweit ersichtlich: ${fact.description} [NICHT VERIFIZIERT]`;
}

function normalizeFactStatus(status: DraftingFactStatus): DraftingFactStatus {
  switch (status) {
    case "aktenkundig":
    case "unbestritten":
      return "confirmed";
    case "bestritten":
      return "disputed";
    case "parteibehauptung":
      return "user_asserted";
    case "inference":
      return "inferred";
    default:
      return status;
  }
}

function renderEvidenceLine(item: DraftingEvidence, attachmentIds: ReadonlySet<string>): string {
  const status = assessEvidenceStatus(item, attachmentIds);
  const prefix = labelEvidenceStatus(status.procedural_status);
  if (
    status.procedural_status === "missing" ||
    status.existence_status === "existence_not_confirmed" ||
    status.availability_status !== "available_to_tool"
  ) {
    return `${prefix}: ${item.name} [NICHT ALS AKTUELLER BELEG VERWENDET]`;
  }
  return `${item.attachment ?? "[BEILAGE FEHLT]"}: ${item.name}${item.page ? `, S. ${item.page}` : ""} (${prefix})`;
}

function renderChallengedQuote(item: {
  readonly challenged_passage: string;
  readonly quoteVerification: ExtractedChallengedPassage["quoteVerification"];
}): string {
  if (
    item.quoteVerification.quote_verified_against_source &&
    item.quoteVerification.context_checked &&
    item.quoteVerification.source_location_verified
  ) {
    return `Die Vorinstanz hält fest: «${item.challenged_passage}».`;
  }
  return `Die angefochtene Begründung wird sinngemäss angegriffen: ${item.challenged_passage} [WORTLAUT NICHT VERIFIZIERT].`;
}

function assessCostsRequest(input: DraftingCaseInput): {
  status: DraftingCheckStatus;
  warning?: string;
} {
  const request = input.costsRequest;
  if (!request?.requested) return { status: "not_applicable" };
  const complete =
    request.procedureTypeConfirmed &&
    request.authorityPowerConfirmed &&
    request.compensationBasisConfirmed &&
    !isPlaceholderValue(request.legalBasis);
  return complete
    ? { status: "passed" }
    : { status: "not_verified", warning: "costs_request_not_verified" };
}

function renderCostsRequest(input: DraftingCaseInput): string {
  const costs = assessCostsRequest(input);
  if (costs.status !== "passed")
    return "Kosten- und Entschädigungsfolgen\n[KOSTENANTRAG ZU PRÜFEN]";
  return "Kosten- und Entschädigungsfolgen\nUnter Kosten- und Entschädigungsfolgen gemäss verifizierter prozessualer Grundlage.";
}

function stripSharpS(text: string): string {
  return text.replace(/ß/g, "ss");
}

export function validateDraft(params: {
  readonly cleanDocument: string;
  readonly input: DraftingCaseInput;
  readonly requirements?: ProceduralRequirementsResult;
  readonly requests?: ReturnType<typeof buildRechtsbegehren>;
  readonly evidence?: ReturnType<typeof buildEvidenceIndex>;
  readonly rebuttal?: ReturnType<typeof buildRebuttalMatrix>;
  readonly tone?: ToneProfile;
  readonly languageProfile?: SwissLegalLanguageProfile;
}) {
  const requirements = params.requirements ?? determineProceduralRequirements(params.input);
  const requests = params.requests ?? buildRechtsbegehren(params.input);
  const evidence = params.evidence ?? buildEvidenceIndex(params.input);
  const rebuttal = params.rebuttal ?? buildRebuttalMatrix(params.input);
  const warnings = new Set<string>([
    ...requirements.warnings,
    ...requests.warnings,
    ...evidence.warnings,
    ...rebuttal.warnings,
    "human_legal_review_required",
  ]);
  const costsStatus = assessCostsRequest(params.input);
  if (costsStatus.warning) warnings.add(costsStatus.warning);
  if (params.cleanDocument.includes("ß")) warnings.add("swiss_orthography_failed");
  if (/willkürlich|Willkür/.test(params.cleanDocument) && !hasWillkuerSupport(params)) {
    warnings.add("unjustified_willkuer");
  }
  if (params.cleanDocument.includes("[BEILAGE FEHLT]")) warnings.add("attachment_missing");
  if (/\[[A-ZÄÖÜ][^\]]+\]/.test(params.cleanDocument)) warnings.add("not_verified_data");

  const checks: Record<string, DraftingCheckStatus> = {
    jurisdiction: requirementStatus(requirements, "jurisdiction"),
    country_legal_system: requirementStatus(requirements, "country_legal_system"),
    territorial_jurisdiction: requirementStatus(requirements, "territorial_jurisdiction"),
    subject_matter_jurisdiction: requirementStatus(requirements, "subject_matter_jurisdiction"),
    functional_jurisdiction: requirementStatus(requirements, "functional_jurisdiction"),
    issuing_authority: requirementStatus(requirements, "issuing_authority"),
    appellate_authority: requirementStatus(requirements, "appellate_authority"),
    venue_or_filing_destination: requirementStatus(requirements, "venue_or_filing_destination"),
    competent_authority: requirementStatus(requirements, "competent_authority"),
    procedural_remedy: requirementStatus(requirements, "procedural_remedy"),
    deadline: requirementStatus(requirements, "deadline"),
    standing: requirementStatus(requirements, "standing"),
    procedural_language: requirementStatus(requirements, "procedural_language"),
    notification_date: requirementStatus(requirements, "notification_date"),
    signature: requirementStatus(requirements, "signature"),
    filing_requirements: requirementStatus(requirements, "filing_requirements"),
    requests: requests.warnings.includes("contradictory_requests")
      ? "failed"
      : requests.requests.length > 0
        ? requests.requests.some((request) => request.status === "deferred_pending_verification")
          ? "warning"
          : "passed"
        : "failed",
    facts:
      (params.input.facts?.filter((fact) =>
        ["confirmed", "accepted_for_drafting"].includes(normalizeFactStatus(fact.status)),
      ).length ?? 0) > 0
        ? "passed"
        : "not_verified",
    chronology: checkChronology(params.input),
    evidence: evidence.evidenceIndex.some((item) => item.usable_as_current_support)
      ? "passed"
      : "warning",
    burden_of_proof: "warning",
    legal_basis:
      (params.input.citations?.filter((citation) => !isPlaceholderValue(citation)).length ?? 0) > 0
        ? "passed"
        : "not_verified",
    temporal_applicability: "not_verified",
    case_law: checkCaseLaw(params.input),
    citations: (params.input.citations ?? []).every(
      (citation) => parseCitations(citation).length > 0,
    )
      ? "passed"
      : "warning",
    challenged_passages:
      (params.input.challengedPassages?.length ?? 0) > 0 ? "passed" : "not_applicable",
    independent_grounds: rebuttal.warnings.includes("independent_ground_not_challenged")
      ? "failed"
      : rebuttal.warnings.includes("independent_grounds_not_reviewed")
        ? "not_verified"
        : "passed",
    rebuttals: rebuttal.rebuttalMatrix.length > 0 ? "passed" : "not_applicable",
    attachments: evidence.warnings.includes("cited_attachment_missing") ? "failed" : "passed",
    tone: checkTone(params.cleanDocument),
    swiss_orthography: params.cleanDocument.includes("ß") ? "failed" : "passed",
    internal_consistency: requests.warnings.includes("contradictory_requests")
      ? "failed"
      : "passed",
    unsupported_claims: requests.warnings.includes("request_not_supported_by_reasoning")
      ? "warning"
      : "passed",
    invented_data: containsForbiddenInventedPattern(params.cleanDocument) ? "failed" : "passed",
    human_review_required: "warning",
    costs: costsStatus.status,
  };
  const readyForFiling = !Object.entries(checks).some(
    ([field, status]) =>
      field === "human_review_required" ||
      status === "failed" ||
      ([
        "jurisdiction",
        "territorial_jurisdiction",
        "subject_matter_jurisdiction",
        "functional_jurisdiction",
        "issuing_authority",
        "appellate_authority",
        "venue_or_filing_destination",
        "competent_authority",
        "procedural_remedy",
        "deadline",
        "notification_date",
        "standing",
        "procedural_language",
        "signature",
        "filing_requirements",
        "independent_grounds",
      ].includes(field) &&
        status === "not_verified"),
  );
  const severities = classifyDraftingWarnings([...warnings], checks);
  return { checks, readyForFiling, warnings: [...warnings], severities };
}

function classifyDraftingWarnings(
  warnings: readonly string[],
  checks: Record<string, DraftingCheckStatus>,
): Record<string, DraftingSeverity> {
  const severities: Record<string, DraftingSeverity> = {};
  for (const [field, status] of Object.entries(checks)) {
    if (status === "failed") severities[field] = "blocker";
    else if (status === "not_verified") severities[field] = "major";
    else if (status === "warning") severities[field] = "warning";
    else severities[field] = "informational";
  }
  for (const warning of warnings) {
    severities[warning] =
      /missing|not_confirmed|not_verified|independent_grounds_not_reviewed|human_legal_review_required/.test(
        warning,
      )
        ? "major"
        : "warning";
  }
  return severities;
}

function requirementStatus(
  requirements: ProceduralRequirementsResult,
  key: string,
): DraftingCheckStatus {
  const status = requirements.requirements[key]?.status;
  if (status === "confirmed") return "passed";
  if (status === "requires_legal_review") return "warning";
  if (status === "contradicted" || status === "failed") return "failed";
  return status ?? "not_verified";
}

function checkChronology(input: DraftingCaseInput): DraftingCheckStatus {
  const decision = input.challengedAct?.decisionDate;
  const notification = input.challengedAct?.notificationDate;
  if (!decision || !notification) return "not_verified";
  return notification < decision ? "failed" : "passed";
}

function checkCaseLaw(input: DraftingCaseInput): DraftingCheckStatus {
  if ((input.caseLawReferences?.length ?? 0) === 0) return "not_applicable";
  const hasUnusable = buildCaseLawUse(input).some(
    (item) => item.sourceStatus !== "officially_verified" || !item.decisiveUseAllowed,
  );
  return hasUnusable ? "warning" : "passed";
}

function checkTone(cleanDocument: string): DraftingCheckStatus {
  return /absichtlich|völlig unfair|ignoriert|böse|droh/i.test(cleanDocument) ? "failed" : "passed";
}

function hasWillkuerSupport(params: { readonly input: DraftingCaseInput }): boolean {
  return Boolean(
    params.input.citations?.some((citation) => /Art\. 9 BV|willkür|willkuer/i.test(citation)) &&
    params.input.evidence?.some((item) => item.authenticity === "confirmed"),
  );
}

function containsForbiddenInventedPattern(cleanDocument: string): boolean {
  return (
    /IBAN CH\d{2}|Herr Dr\.|Frau Dr\.|Aktenzeichen \d{4}\/\d{3}/.test(cleanDocument) &&
    !cleanDocument.includes("[")
  );
}

export function reviewSwissLegalDocument(
  input: DraftingCaseInput & { readonly cleanDocument: string },
) {
  const requirements = determineProceduralRequirements(input);
  const validation = validateDraft({ cleanDocument: input.cleanDocument, input, requirements });
  return {
    legal_drafting_check: validation.checks,
    readyForFiling: validation.readyForFiling,
    warnings: validation.warnings,
    suggestedCorrections: [
      ...(input.cleanDocument.includes("ß") ? ["replace_eszett_with_ss"] : []),
      ...(validation.warnings.includes("unjustified_willkuer")
        ? ["lower_intensity_or_add_willkuer_standard_and_record_support"]
        : []),
      ...(validation.warnings.includes("attachment_missing")
        ? ["add_missing_attachment_or_remove_reference"]
        : []),
      ...(requirements.warnings.length > 0 ? ["verify_procedural_requirements_before_filing"] : []),
    ],
    human_legal_review_required: true,
  };
}

export function classifyCaseLawReference(
  reference: string,
  input: DraftingCaseInput,
): CaseComparabilityClassification {
  const verification = verifyOfficialCaseReference(reference);
  return evaluateCaseComparability({
    reference,
    targetMatterDescription: input.challengedAct?.summary ?? input.objectives?.join(" ") ?? "",
    targetProcedure: input.procedure?.remedy,
    targetFacts: input.facts?.map((fact) => fact.description),
    referenceVerified: verification.status === "officially_verified",
  }).classification;
}
