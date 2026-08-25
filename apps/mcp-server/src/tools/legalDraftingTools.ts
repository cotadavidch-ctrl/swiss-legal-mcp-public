import { z } from "zod";
import type { ToolRegistry } from "@swiss-legal-mcp/core";
import {
  buildEvidenceIndex,
  buildRebuttalMatrix,
  buildRechtsbegehren,
  buildSwissLegalDraft,
  determineProceduralRequirements,
  extractChallengedPassages,
  reviewSwissLegalDocument,
  validateDraft,
} from "./legalDraftingRules.js";

const documentTypeSchema = z.enum([
  "Einsprache",
  "Beschwerde",
  "Rekurs",
  "Wiedererwaegungsgesuch",
  "Revisionsgesuch",
  "Stellungnahme",
  "Replik",
  "Duplik",
  "Gesuch",
  "Ergaenzung",
  "Akteneinsichtsgesuch",
  "Fristerstreckungsgesuch",
  "Rechtsvorschlag",
  "Zahlungsaufschubsgesuch",
  "VorsorglicheMassnahmen",
  "AufschiebendeWirkung",
  "UnentgeltlicheRechtspflege",
  "AussergerichtlicheAufforderung",
  "Vergleichsvorschlag",
  "Kuendigung",
  "RechtlichesMemorandum",
  "unknown",
]);

const toneSchema = z
  .enum([
    "neutral_formal",
    "firm_respectful",
    "conciliatory",
    "urgent_procedural",
    "defensive",
    "settlement_oriented",
    "judicial_technical",
  ])
  .optional();

const detailLevelSchema = z.enum(["kurz", "standard", "detailliert", "gerichtlich"]).optional();
const languageProfileSchema = z.enum(["de-CH-legal", "fr-CH-legal", "it-CH-legal"]).optional();

const factSchema = z
  .object({
    id: z.string().min(1).max(120),
    description: z.string().min(1).max(4000),
    status: z.enum([
      "confirmed",
      "accepted_for_drafting",
      "disputed",
      "uncertain",
      "inferred",
      "user_asserted",
      "source_asserted",
      "contradicted",
      "not_verified",
      "unavailable",
      "unbestritten",
      "bestritten",
      "aktenkundig",
      "parteibehauptung",
      "inference",
    ]),
    date: z.string().max(120).optional(),
    amountChf: z.number().optional(),
    account: z.string().max(200).optional(),
    holder: z.string().max(200).optional(),
    evidenceIds: z.array(z.string().min(1).max(120)).max(40).optional(),
  })
  .strict();

const evidenceSchema = z
  .object({
    evidenceId: z.string().min(1).max(120),
    name: z.string().min(1).max(500),
    type: z.enum([
      "decision",
      "bank_statement",
      "letter",
      "email",
      "court_record",
      "contract",
      "expert_report",
      "other",
    ]),
    date: z.string().max(120).optional(),
    issuer: z.string().max(300).optional(),
    page: z.string().max(80).optional(),
    attachment: z.string().max(80).optional(),
    provesFactIds: z.array(z.string().min(1).max(120)).max(80).optional(),
    linkedClaimIds: z.array(z.string().min(1).max(120)).max(80).optional(),
    authenticity: z.enum(["confirmed", "disputed", "unknown"]).optional(),
    source: z
      .enum(["filed_record", "new", "opposing_party", "authority", "user_supplied"])
      .optional(),
    admissibility: z.enum(["likely", "uncertain", "risky", "not_assessed"]).optional(),
    proceduralStatus: z
      .enum([
        "in_record_confirmed",
        "available_not_yet_filed",
        "proposed_new_evidence",
        "missing",
        "existence_not_confirmed",
        "inadmissible",
        "noven_risk",
        "authenticity_unconfirmed",
        "reference_only",
      ])
      .optional(),
    assertionSource: z
      .enum(["user", "source_document", "authority", "opposing_party", "inferred", "unknown"])
      .optional(),
    existenceStatus: z
      .enum([
        "user_asserted",
        "source_confirmed",
        "existence_not_confirmed",
        "contradicted",
        "unavailable",
      ])
      .optional(),
    availabilityStatus: z
      .enum(["available_to_tool", "referenced_but_not_available", "missing", "inaccessible"])
      .optional(),
    contentVerificationStatus: z
      .enum([
        "verified_against_document",
        "partially_verified",
        "user_described_only",
        "not_verified",
      ])
      .optional(),
    authenticityStatus: z.enum(["confirmed", "presumed", "unconfirmed", "disputed"]).optional(),
    inRecordStatus: z
      .enum(["in_record_confirmed", "claimed_to_be_in_record", "not_in_record", "not_verified"])
      .optional(),
    filingStatus: z
      .enum([
        "already_filed",
        "available_not_yet_filed",
        "proposed_new_evidence",
        "missing",
        "not_verified",
      ])
      .optional(),
    admissibilityStatus: z
      .enum(["admissible_confirmed", "admissibility_not_verified", "inadmissible", "noven_risk"])
      .optional(),
    novenStatus: z
      .enum([
        "no_known_noven_issue",
        "possible_noven",
        "likely_noven",
        "not_applicable",
        "not_verified",
      ])
      .optional(),
    amountChf: z.number().optional(),
    account: z.string().max(200).optional(),
    holder: z.string().max(200).optional(),
    finalBalanceChf: z.number().optional(),
  })
  .strict();

const attachmentSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(80),
    evidenceId: z.string().max(120).optional(),
  })
  .strict();

const challengedPassageSchema = z
  .object({
    id: z.string().min(1).max(120),
    exactText: z.string().min(1).max(4000),
    sourceDocumentId: z.string().min(1).max(200),
    page: z.string().max(80).optional(),
    paragraph: z.string().max(80).optional(),
    section: z.string().max(120).optional(),
    consideration: z.string().max(120).optional(),
    language: z.enum(["de", "fr", "it"]).optional(),
    author: z.enum([
      "decision_authority",
      "lower_instance",
      "opposing_party",
      "applicant",
      "appellant",
      "expert",
      "third_party",
      "reviewing_court",
    ]),
    function: z.enum([
      "fact",
      "allegation",
      "evidence_assessment",
      "legal_interpretation",
      "subsumption",
      "conclusion",
      "subsidiary_argument",
      "alternative_ground",
      "obiter_dictum",
    ]),
    importance: z.enum(["low", "medium", "high", "decisive"]),
    autonomousGround: z.boolean().optional(),
    contextBefore: z.string().max(2000).optional(),
    contextAfter: z.string().max(2000).optional(),
    quoteVerified: z.boolean().optional(),
    quoteVerification: z
      .object({
        quote_matches_user_input: z.boolean().optional(),
        quote_extracted_from_source: z.boolean().optional(),
        quote_verified_against_source: z.boolean().optional(),
        context_checked: z.boolean().optional(),
        source_location_verified: z.boolean().optional(),
        source_document_full_text_read: z.boolean().optional(),
        quote_translation: z.boolean().optional(),
        quote_paraphrase: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const baseDraftingInputSchema = {
  jurisdiction: z
    .object({
      country: z.literal("CH").optional(),
      canton: z.string().length(2).optional(),
      territorialJurisdiction: z.string().max(300).optional(),
      subjectMatterJurisdiction: z.string().max(300).optional(),
      functionalJurisdiction: z.string().max(300).optional(),
      venueOrFilingDestination: z.string().max(300).optional(),
    })
    .strict()
    .optional(),
  authority: z
    .object({
      issuingAuthority: z.string().max(300).optional(),
      competentAuthority: z.string().max(300).optional(),
      appellateAuthority: z.string().max(300).optional(),
      addressee: z.string().max(300).optional(),
    })
    .strict()
    .optional(),
  challengedAct: z
    .object({
      type: z.enum(["decision", "act", "omission", "payment_order", "private_letter"]).optional(),
      decisionDate: z.string().max(120).optional(),
      notificationDate: z.string().max(120).optional(),
      reference: z.string().max(200).optional(),
      summary: z.string().max(4000).optional(),
      legalRemedyInstructionAvailable: z.boolean().optional(),
      legalRemedyInstruction: z.string().max(2000).optional(),
    })
    .strict()
    .optional(),
  procedure: z
    .object({
      requestedDocumentType: documentTypeSchema.optional(),
      remedy: z.string().max(300).optional(),
      deadlineDate: z.string().max(120).optional(),
      suspensiveEffectRequested: z.boolean().optional(),
      language: z.enum(["de", "fr", "it"]).optional(),
      signatureRequired: z.boolean().optional(),
      filingRequirements: z.array(z.string().min(1).max(300)).max(30).optional(),
      copiesRequired: z.number().int().min(1).max(20).optional(),
    })
    .strict()
    .optional(),
  parties: z
    .array(
      z
        .object({
          role: z.string().min(1).max(120),
          name: z.string().max(300).optional(),
          address: z.string().max(500).optional(),
        })
        .strict(),
    )
    .max(40)
    .optional(),
  objectives: z.array(z.string().min(1).max(1000)).max(40).optional(),
  claims: z
    .array(
      z
        .object({
          id: z.string().min(1).max(120),
          description: z.string().min(1).max(2000),
          priority: z.enum(["main", "eventual", "subeventual", "procedural"]).optional(),
        })
        .strict(),
    )
    .max(80)
    .optional(),
  facts: z.array(factSchema).max(120).optional(),
  evidence: z.array(evidenceSchema).max(160).optional(),
  attachments: z.array(attachmentSchema).max(120).optional(),
  challengedPassages: z.array(challengedPassageSchema).max(80).optional(),
  citations: z.array(z.string().min(1).max(300)).max(80).optional(),
  caseLawReferences: z.array(z.string().min(1).max(200)).max(40).optional(),
  tone: toneSchema,
  detailLevel: detailLevelSchema,
  languageProfile: languageProfileSchema,
  place: z.string().max(120).optional(),
  draftingDate: z.string().max(120).optional(),
  signatureDate: z.string().max(120).optional(),
  filingDate: z.string().max(120).optional(),
  costsRequest: z
    .object({
      requested: z.boolean().optional(),
      procedureTypeConfirmed: z.boolean().optional(),
      opposingPartyConfirmed: z.boolean().optional(),
      authorityPowerConfirmed: z.boolean().optional(),
      compensationBasisConfirmed: z.boolean().optional(),
      legalBasis: z.string().max(300).optional(),
    })
    .strict()
    .optional(),
  fullTextDecisionAvailable: z.boolean().optional(),
};

export function registerLegalDraftingTools(tools: ToolRegistry): void {
  tools.register({
    name: "validate_procedural_requirements",
    description:
      "Determines the Swiss procedural document profile and checks essential requirements without inventing remedy, authority, deadline, standing or language.",
    inputSchema: baseDraftingInputSchema,
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => determineProceduralRequirements(input),
  });

  tools.register({
    name: "generate_rechtsbegehren",
    description:
      "Generates numbered Swiss Rechtsbegehren/Antraege from structured objectives and claims, with warnings for unsupported, contradictory or authority-dependent requests.",
    inputSchema: baseDraftingInputSchema,
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => buildRechtsbegehren(input),
  });

  tools.register({
    name: "build_evidence_index",
    description:
      "Builds a structured evidence and attachment index, including Swiss legal aid bank-transfer checks, attachment consistency and Noven risk.",
    inputSchema: baseDraftingInputSchema,
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => buildEvidenceIndex(input),
  });

  tools.register({
    name: "extract_challenged_passages",
    description:
      "Extracts or validates exact challenged passages with author, function, context, importance and autonomous-ground markers. Unverified quotes stay marked.",
    inputSchema: {
      ...baseDraftingInputSchema,
      sourceText: z.string().max(30_000).optional(),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => extractChallengedPassages(input),
  });

  tools.register({
    name: "build_rebuttal_matrix",
    description:
      "Builds a quote-and-rebuttal matrix tying each challenged passage to record evidence, legal premises, error type, counteranalysis and requested consequence.",
    inputSchema: baseDraftingInputSchema,
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => buildRebuttalMatrix(input),
  });

  tools.register({
    name: "validate_swiss_legal_draft",
    description:
      "Runs the final legal_drafting_check over a clean Swiss legal draft and its structured case data. A failed or unverified essential field prevents filing-ready status.",
    inputSchema: {
      ...baseDraftingInputSchema,
      cleanDocument: z.string().min(1).max(80_000),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => validateDraft({ cleanDocument: input.cleanDocument, input }),
  });

  tools.register({
    name: "review_swiss_legal_document",
    description:
      "Reviews an existing Swiss legal draft for procedural fit, Swiss legal terminology, tone, citations, attachments, quote fidelity and filing readiness.",
    inputSchema: {
      ...baseDraftingInputSchema,
      cleanDocument: z.string().min(1).max(80_000),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => reviewSwissLegalDocument(input),
  });

  tools.register({
    name: "draft_swiss_legal_document",
    description:
      "Drafts a Swiss legal document in a clean document layer plus a separate control report, using structured facts, evidence, passages, requests and guardrails.",
    inputSchema: baseDraftingInputSchema,
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => buildSwissLegalDraft(input),
  });
}
