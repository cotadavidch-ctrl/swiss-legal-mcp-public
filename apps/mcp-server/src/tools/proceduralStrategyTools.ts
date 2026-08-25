import { z } from "zod";
import type { ToolContext, ToolRegistry } from "@swiss-legal-mcp/core";
import { parseCitations } from "@swiss-legal-mcp/citations";
import {
  analyzeLegalAidClarificationDuty,
  evaluateCaseComparability,
  verifyOfficialCaseReference,
} from "./jurisprudenceGuardrails.js";

const MAX_FACTS = 80;
const MAX_DOCUMENTS = 30;
const MAX_EVIDENCE = 80;
const MAX_TEXT = 4_000;

const cantonSchema = z
  .string()
  .length(2)
  .regex(/^[A-Za-z]{2}$/)
  .transform((value) => value.toUpperCase())
  .optional();

const boundedText = z.string().min(1).max(MAX_TEXT);
const optionalDate = z.iso.date().optional();
const sourceDocumentIdsSchema = z.array(z.string().min(1).max(200)).max(20).optional();

const partySchema = z
  .object({
    role: z.enum([
      "claimant",
      "defendant",
      "appellant",
      "respondent",
      "authority",
      "employer",
      "employee",
      "insurer",
      "insured",
      "creditor",
      "debtor",
      "other",
    ]),
    type: z.enum(["natural_person", "company", "public_authority", "court", "insurer", "other"]),
    description: boundedText,
  })
  .strict();

const factSchema = z
  .object({
    id: z.string().min(1).max(80),
    date: optionalDate,
    description: boundedText,
    status: z.enum(["accepted", "disputed", "uncertain", "alleged"]),
    sourceDocumentIds: sourceDocumentIdsSchema,
  })
  .strict();

const proceduralHistorySchema = z
  .object({
    date: z.iso.date(),
    authority: boundedText,
    action: boundedText,
    result: boundedText.optional(),
    documentId: z.string().min(1).max(200).optional(),
  })
  .strict();

const evidenceSchema = z
  .object({
    id: z.string().min(1).max(80),
    type: z.enum([
      "document",
      "email",
      "bank-record",
      "witness",
      "expert",
      "contract",
      "official-record",
      "photo",
      "audio",
      "other",
    ]),
    description: boundedText,
    date: optionalDate,
    documentId: z.string().min(1).max(200).optional(),
    authenticity: z.enum(["confirmed", "disputed", "unknown"]),
  })
  .strict();

const deadlineSchema = z
  .object({
    description: boundedText,
    date: optionalDate,
    basis: boundedText.optional(),
    confirmed: z.boolean(),
  })
  .strict();

const documentRefSchema = z
  .object({
    documentId: z.string().min(1).max(200),
    documentType: z.enum([
      "decision",
      "appeal",
      "contract",
      "correspondence",
      "evidence",
      "judgment",
      "other",
    ]),
  })
  .strict();

export const proceduralStrategyInputSchema = {
  jurisdiction: z
    .object({
      country: z.literal("CH"),
      canton: cantonSchema,
      municipality: z.string().min(1).max(120).optional(),
    })
    .strict(),
  matter: z
    .object({
      area: z.enum([
        "civil",
        "criminal",
        "administrative",
        "social-insurance",
        "tax",
        "employment",
        "tenancy",
        "debt-enforcement",
        "constitutional",
        "other",
      ]),
      subarea: z.string().min(1).max(200).optional(),
      description: boundedText,
    })
    .strict(),
  parties: z.array(partySchema).min(1).max(30),
  facts: z.array(factSchema).max(MAX_FACTS).default([]),
  proceduralHistory: z.array(proceduralHistorySchema).max(60).default([]),
  challengedDecision: z
    .object({
      authority: boundedText.optional(),
      decisionDate: optionalDate,
      notificationDate: optionalDate,
      reference: z.string().min(1).max(200).optional(),
      summary: boundedText.optional(),
      documentId: z.string().min(1).max(200).optional(),
    })
    .strict()
    .optional(),
  claims: z
    .array(
      z
        .object({
          description: boundedText,
          priority: z.enum(["primary", "alternative", "subsidiary"]),
        })
        .strict(),
    )
    .max(30)
    .default([]),
  availableEvidence: z.array(evidenceSchema).max(MAX_EVIDENCE).default([]),
  deadlines: z.array(deadlineSchema).max(30).default([]),
  objectives: z
    .array(
      z.enum([
        "annulment",
        "payment",
        "declaratory-relief",
        "suspensive-effect",
        "interim-measure",
        "settlement",
        "avoid-costs",
        "preserve-rights",
        "other",
      ]),
    )
    .max(20)
    .default([]),
  constraints: z
    .object({
      budget: z.string().min(1).max(200).optional(),
      urgency: z.enum(["low", "medium", "high", "critical"]),
      representation: z.enum(["self-represented", "lawyer", "unknown"]),
      riskTolerance: z.enum(["low", "medium", "high"]),
      language: z.enum(["de", "fr", "it", "rm", "en", "es"]),
    })
    .strict()
    .default({
      urgency: "medium",
      representation: "unknown",
      riskTolerance: "medium",
      language: "de",
    }),
  documents: z.array(documentRefSchema).max(MAX_DOCUMENTS).default([]),
  analysisDate: z.iso.date(),
};

type ProceduralStrategyInput = {
  [K in keyof typeof proceduralStrategyInputSchema]: z.infer<
    (typeof proceduralStrategyInputSchema)[K]
  >;
};

type IssueStatus =
  "applicable" | "potentially_applicable" | "not_applicable" | "insufficient_information";
type RiskProbability = "low" | "medium" | "high" | "unknown";
type RiskImpact = "low" | "medium" | "high";

interface StrategyRisk {
  readonly risk: string;
  readonly probability: RiskProbability;
  readonly impact: RiskImpact;
  readonly mitigation: string;
}

interface TraceSource {
  readonly sourceId: string;
  readonly providerId: string;
  readonly documentIdentifier: string;
  readonly courtOrAuthority: string | null;
  readonly date: string | null;
  readonly provisionOrParagraph: string | null;
  readonly passage: string;
  readonly officialUrl: string;
  readonly retrievedAt: string;
  readonly confidence: number;
  readonly extractionMethod:
    | "explicit_rule"
    | "explicit_holding"
    | "extracted_reasoning"
    | "inferred_pattern"
    | "strategic_inference";
}

export function registerProceduralStrategyTools(tools: ToolRegistry): void {
  tools.register({
    name: "analyze_procedural_strategy",
    description:
      "Analiza de forma determinista y trazable un expediente procesal suizo: hechos, cuestiones procesales, plazos, prueba, jurisprudencia comparable disponible y opciones estrategicas. No sustituye asesoramiento profesional, no garantiza resultados, no inventa fuentes, plazos ni competencia; cuando la informacion o fuentes son insuficientes devuelve estados de incertidumbre y advertencias explicitas.",
    inputSchema: proceduralStrategyInputSchema,
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input, context) => analyzeProceduralStrategy(input, context),
  });
}

async function analyzeProceduralStrategy(input: ProceduralStrategyInput, context: ToolContext) {
  const loadedDocuments = await loadDocuments(input, context);
  const sources = buildTraceSources(loadedDocuments);
  const timeline = buildTimeline(input, loadedDocuments);
  const keyFacts = input.facts.filter((fact) => fact.status === "accepted");
  const disputedFacts = input.facts.filter((fact) => fact.status === "disputed");
  const allegedFacts = input.facts.filter((fact) => fact.status === "alleged");
  const uncertainFacts = input.facts.filter((fact) => fact.status === "uncertain");
  const missingFacts = identifyMissingFacts(input, loadedDocuments);
  const issues = identifyIssues(input);
  const deadlines = analyzeDeadlines(input, issues);
  const route = determineProceduralRoute(input, issues, sources);
  const evidence = assessEvidence(input);
  const caseLaw = await analyzeCaseLaw(input, context);
  const legalAidClarification = analyzeLegalAidClarificationDuty({
    matterDescription: input.matter.description,
    facts: input.facts.map((fact) => fact.description),
    representation: input.constraints.representation,
    ...(input.jurisdiction.canton ? { canton: input.jurisdiction.canton } : {}),
  });
  const options = generateProceduralOptions(input, issues, deadlines, evidence, caseLaw, sources);
  const recommendedStrategy = buildStrategy(input, options, evidence, deadlines, sources);
  const scenarios = buildScenarios(input, deadlines, evidence);
  const risks = buildRisks(input, issues, deadlines, evidence, caseLaw);
  const confidence = buildConfidence(input, sources, caseLaw);
  const warnings = buildWarnings(input, deadlines, caseLaw, loadedDocuments);

  return {
    caseSummary: {
      legalCharacterization: characterizeMatter(input),
      proceduralPosture: proceduralPosture(input),
      keyFacts: keyFacts.map(toFactSummary),
      disputedFacts: disputedFacts.map(toFactSummary),
      allegedFacts: allegedFacts.map(toFactSummary),
      uncertainFacts: uncertainFacts.map(toFactSummary),
      missingFacts,
    },
    jurisdictionAndCompetence: route.jurisdictionAndCompetence,
    admissibility: {
      standing: issueResult(issues, "standing"),
      appealableAct: issueResult(issues, "appealable_act"),
      exhaustion: issueResult(issues, "exhaustion"),
      formalRequirements: issueResult(issues, "formal_requirements"),
      languageRequirements: issueResult(issues, "language"),
      representationRequirements: issueResult(issues, "representation"),
      risks: risks.filter((risk) => risk.risk.includes("admisibilidad")).map((risk) => risk.risk),
    },
    deadlines,
    applicableLaw: inferApplicableLaw(input, sources),
    burdenOfProof: inferBurdenOfProof(input, sources),
    evidenceAssessment: evidence,
    legalAidClarification,
    caseLawAnalysis: caseLaw,
    proceduralOptions: options,
    recommendedStrategy,
    scenarioAnalysis: scenarios,
    risks,
    missingInformation: missingFacts,
    warnings,
    sources,
    trace: {
      timeline,
      issues,
      loadedDocuments: loadedDocuments.map(({ ref, status, document }) => ({
        documentId: ref.documentId,
        documentType: ref.documentType,
        status,
        provider: document?.provider ?? null,
      })),
      guardrails: [
        "no_success_guarantee",
        "no_invented_case_law",
        "no_invented_deadlines",
        "no_document_body_logging",
        "professional_review_recommended_for_high_risk_matters",
        "no_direct_comparability_from_lexical_overlap_only",
        "separate_ratio_obiter_party_allegations_and_lower_court_reasoning",
        "no_automatic_unbeholfen_from_self_representation",
        "no_automatic_nachfrist_from_first_deficiency",
      ],
    },
    confidence,
  };
}

async function loadDocuments(input: ProceduralStrategyInput, context: ToolContext) {
  return Promise.all(
    input.documents.map(async (ref) => {
      const [providerId] = ref.documentId.split(":");
      const provider = providerId ? context.providers.get(providerId) : undefined;
      if (!provider) return { ref, status: "provider_unavailable" as const };
      try {
        const document = await provider.getDocument(ref.documentId);
        return { ref, status: "loaded" as const, document };
      } catch {
        return { ref, status: "not_found" as const };
      }
    }),
  );
}

function buildTraceSources(loaded: Awaited<ReturnType<typeof loadDocuments>>): TraceSource[] {
  return loaded.flatMap((entry) => {
    if (!entry.document) return [];
    const doc = entry.document;
    return [
      {
        sourceId: doc.id,
        providerId: doc.provider,
        documentIdentifier: doc.sourceOriginalId,
        courtOrAuthority: doc.rawMetadata["court"]?.toString() ?? null,
        date: doc.date.decisionOrEnactment ?? null,
        provisionOrParagraph: null,
        passage: (doc.fullText ?? doc.title).slice(0, 500),
        officialUrl: doc.provenance.officialSourceUrl ?? doc.provenance.sourceUrl,
        retrievedAt: doc.provenance.retrievedAt,
        confidence: doc.provenance.officialCharacter === "official" ? 0.8 : 0.45,
        extractionMethod: doc.documentType === "case" ? "explicit_holding" : "explicit_rule",
      },
    ];
  });
}

function buildTimeline(
  input: ProceduralStrategyInput,
  loaded: Awaited<ReturnType<typeof loadDocuments>>,
) {
  const entries = [
    ...input.facts.flatMap((fact) =>
      fact.date
        ? [
            {
              date: fact.date,
              kind: "fact",
              id: fact.id,
              description: fact.description,
              confidence: fact.status === "accepted" ? 0.75 : 0.45,
            },
          ]
        : [],
    ),
    ...input.proceduralHistory.map((event) => ({
      date: event.date,
      kind: "procedural_event",
      id: event.documentId ?? event.action.slice(0, 40),
      description: `${event.authority}: ${event.action}`,
      confidence: 0.7,
    })),
    ...(input.challengedDecision?.decisionDate
      ? [
          {
            date: input.challengedDecision.decisionDate,
            kind: "challenged_decision",
            id: input.challengedDecision.documentId ?? "challenged_decision",
            description: input.challengedDecision.summary ?? "Decision impugnada",
            confidence: input.challengedDecision.documentId ? 0.7 : 0.45,
          },
        ]
      : []),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return {
    entries,
    contradictions: findDateContradictions(input),
    missingDocuments: loaded
      .filter((entry) => entry.status !== "loaded")
      .map((entry) => entry.ref.documentId),
  };
}

function identifyMissingFacts(
  input: ProceduralStrategyInput,
  loaded: Awaited<ReturnType<typeof loadDocuments>>,
): string[] {
  const missing: string[] = [];
  if (!input.jurisdiction.canton) missing.push("canton_or_territorial_link");
  if (input.parties.length < 2) missing.push("opposing_party");
  if (input.claims.length === 0) missing.push("specific_claims");
  if (
    !input.challengedDecision &&
    ["administrative", "social-insurance", "tax"].includes(input.matter.area)
  ) {
    missing.push("challenged_decision");
  }
  if (input.challengedDecision && !input.challengedDecision.notificationDate) {
    missing.push("proof_of_notification_date");
  }
  if (input.availableEvidence.length === 0) missing.push("evidence_inventory");
  if (loaded.some((entry) => entry.status !== "loaded"))
    missing.push("missing_or_unavailable_documents");
  return missing;
}

function identifyIssues(input: ProceduralStrategyInput) {
  const hasDecision = Boolean(input.challengedDecision);
  const hasNotification = Boolean(input.challengedDecision?.notificationDate);
  const hasCanton = Boolean(input.jurisdiction.canton);
  const disputed = input.facts.some((fact) => fact.status === "disputed");
  const selfRepresented = input.constraints.representation === "self-represented";
  return [
    issue(
      "competence",
      hasCanton || input.matter.area === "social-insurance"
        ? "potentially_applicable"
        : "insufficient_information",
      "Competence depends on matter, authority and territorial link.",
    ),
    issue(
      "standing",
      input.parties.some((p) =>
        ["claimant", "appellant", "insured", "employee", "creditor"].includes(p.role),
      )
        ? "potentially_applicable"
        : "insufficient_information",
      "Standing cannot be confirmed from roles alone.",
    ),
    issue(
      "appealable_act",
      hasDecision ? "potentially_applicable" : "insufficient_information",
      "A challengeable decision or procedural act must be verified from documents.",
    ),
    issue(
      "exhaustion",
      input.proceduralHistory.length > 0 ? "potentially_applicable" : "insufficient_information",
      "Prior administrative/procedural steps affect admissibility.",
    ),
    issue(
      "deadline",
      hasNotification || input.deadlines.length > 0
        ? "potentially_applicable"
        : "insufficient_information",
      "Deadline calculation requires start event and legal basis.",
    ),
    issue(
      "formal_requirements",
      "potentially_applicable",
      "Written form, signature, requests and reasoning commonly require checking.",
    ),
    issue(
      "language",
      hasCanton ? "potentially_applicable" : "insufficient_information",
      "Language requirements depend on authority/canton.",
    ),
    issue(
      "representation",
      selfRepresented ? "potentially_applicable" : "not_applicable",
      "Self-represented parties face form and evidence risks.",
    ),
    issue(
      "burden_of_proof",
      disputed ? "applicable" : "potentially_applicable",
      "Disputed or alleged facts require proof planning.",
    ),
    issue(
      "suspensive_effect",
      input.objectives.includes("suspensive-effect") ? "applicable" : "not_applicable",
      "Requested only if the objective includes suspensive effect.",
    ),
    issue(
      "interim_measures",
      input.objectives.includes("interim-measure") ? "applicable" : "not_applicable",
      "Requested only if interim relief is an objective.",
    ),
  ];
}

function issue(id: string, status: IssueStatus, rationale: string) {
  return { id, status, rationale };
}

function issueResult(issues: ReturnType<typeof identifyIssues>, id: string) {
  return (
    issues.find((candidate) => candidate.id === id) ??
    issue(id, "insufficient_information", "No analysis available.")
  );
}

function analyzeDeadlines(
  input: ProceduralStrategyInput,
  issues: ReturnType<typeof identifyIssues>,
) {
  const explicit = input.deadlines.map((deadline) => ({
    deadlineType: deadline.description,
    startEvent: deadline.basis ?? "user_supplied",
    calculatedDate: deadline.date ?? null,
    calculationStatus: deadline.confirmed && deadline.date ? "confirmed" : "uncertain",
    suspensionRules: [],
    restorationPossibility: null,
    sources: [],
    warnings: deadline.confirmed ? [] : ["deadline_basis_not_confirmed"],
  }));

  if (
    input.challengedDecision?.notificationDate &&
    !input.deadlines.some((deadline) => deadline.confirmed)
  ) {
    explicit.push({
      deadlineType: "appeal_or_objection_deadline",
      startEvent: "notification_date",
      calculatedDate: null,
      calculationStatus: "cannot_calculate",
      suspensionRules: [],
      restorationPossibility: null,
      sources: [],
      warnings: [
        "notification_date_present_but_legal_basis_missing",
        "do_not_calculate_final_deadline_without_applicable_rule",
      ],
    });
  }

  if (
    issues.find((candidate) => candidate.id === "deadline")?.status === "insufficient_information"
  ) {
    explicit.push({
      deadlineType: "unknown_procedural_deadline",
      startEvent: "unknown",
      calculatedDate: null,
      calculationStatus: "cannot_calculate",
      suspensionRules: [],
      restorationPossibility: null,
      sources: [],
      warnings: ["uncertain_deadline", "proof_of_notification_and_legal_basis_required"],
    });
  }
  return explicit;
}

function determineProceduralRoute(
  input: ProceduralStrategyInput,
  issues: ReturnType<typeof identifyIssues>,
  sources: TraceSource[],
) {
  const area = input.matter.area;
  const canton = input.jurisdiction.canton ?? "unknown";
  const authority = input.challengedDecision?.authority ?? null;
  const remedy = input.challengedDecision?.summary ?? input.objectives.join(" ");
  const routeByArea: Record<string, string> = {
    civil: "Schlichtungsverfahren/Klage or appeal route depending on instance and claim type",
    criminal:
      "Beschwerde in Strafsachen or cantonal criminal procedure route depending on decision and instance",
    administrative:
      "cantonal administrative objection/appeal route or federal administrative route depending on authority",
    "social-insurance":
      "Einsprache/Beschwerde route must be verified against the issuing insurer/authority and applicable federal act",
    tax: "Einsprache/Rekurs/Beschwerde route must be verified by tax type and canton",
    employment: "civil employment claim route, often with conciliation unless an exception applies",
    tenancy: "tenancy conciliation authority route before court unless statutory exception applies",
    "debt-enforcement":
      "Rechtsvorschlag/Rechtsoeffnung or debt-enforcement complaint depending on act challenged",
    constitutional:
      "constitutional complaint route only after ordinary remedies are verified/exhausted",
    other: "cannot determine without more precise matter",
  };
  const uncertain = issues.some((candidate) => candidate.status === "insufficient_information");
  return {
    jurisdictionAndCompetence: {
      likelyJurisdiction: `CH${canton !== "unknown" ? `-${canton}` : ""}`,
      likelyAuthorityOrCourt: routeByArea[area] ?? routeByArea["other"],
      dimensions: {
        country_legal_system: {
          status: "confirmed",
          value: "CH",
        },
        territorial_jurisdiction: {
          status: canton === "unknown" ? "not_verified" : "requires_legal_review",
          value: canton === "unknown" ? null : canton,
        },
        subject_matter_jurisdiction: {
          status: area === "other" ? "not_verified" : "requires_legal_review",
          value: area,
        },
        functional_jurisdiction: {
          status: authority ? "requires_legal_review" : "not_verified",
          value: authority,
        },
        issuing_authority: {
          status: authority ? "confirmed" : "not_verified",
          value: authority,
        },
        appellate_authority: {
          status: "not_verified",
          value: null,
        },
        procedural_remedy: {
          status: remedy.length > 0 ? "requires_legal_review" : "not_verified",
          value: remedy || null,
        },
        venue_or_filing_destination: {
          status: "not_verified",
          value: null,
        },
      },
      territorialCompetence:
        canton === "unknown"
          ? "uncertain_jurisdiction"
          : `territorial link to canton ${canton} requires verification`,
      subjectMatterCompetence: routeByArea[area] ?? "uncertain",
      confidence: uncertain ? 0.35 : sources.length > 0 ? 0.55 : 0.45,
      sources,
    },
  };
}

function assessEvidence(input: ProceduralStrategyInput) {
  return input.availableEvidence.map((evidence) => {
    const linkedFacts = input.facts.filter((fact) =>
      fact.description.toLowerCase().includes(firstKeyword(evidence.description)),
    );
    const contradicted = linkedFacts.some((fact) => fact.status === "disputed");
    return {
      evidenceId: evidence.id,
      proves: linkedFacts.map((fact) => fact.id),
      strength:
        evidence.authenticity === "confirmed" && evidence.type === "official-record"
          ? "strong"
          : evidence.authenticity === "confirmed"
            ? "moderate"
            : evidence.authenticity === "disputed" || contradicted
              ? "weak"
              : "unknown",
      admissibilityRisk:
        evidence.type === "audio" ? "recording_lawfulness_must_be_verified" : "not_assessed",
      authenticityRisk: evidence.authenticity,
      gaps: linkedFacts.length === 0 ? ["no_mapped_relevant_fact"] : [],
    };
  });
}

async function analyzeCaseLaw(input: ProceduralStrategyInput, context: ToolContext) {
  const query = `${input.matter.description} ${input.matter.subarea ?? ""}`.trim();
  const providers = context.providers.list().filter((info) => info.status === "healthy");
  const cases: Array<{ providerId: string; id: string; title: string; snippet?: string }> = [];
  for (const info of providers.slice(0, 5)) {
    const provider = context.providers.get(info.id);
    if (!provider) continue;
    try {
      const results = await provider.search({
        text: query,
        language:
          input.constraints.language === "en" || input.constraints.language === "es"
            ? undefined
            : input.constraints.language,
        limit: 5,
      });
      cases.push(...results.slice(0, 5).map((result) => ({ providerId: info.id, ...result })));
    } catch {
      // Provider failures are reported as limitations, not hidden conclusions.
    }
  }

  const classified = cases.map((item) => classifyCase(item, input));
  const citedReferences = extractCaseReferencesFromInput(input);
  const structuredComparability = citedReferences.map((reference) => {
    const verification = verifyOfficialCaseReference(reference);
    return {
      verification,
      comparability: evaluateCaseComparability({
        reference,
        targetMatterDescription: input.matter.description,
        targetProcedure: input.matter.area,
        targetFacts: input.facts.map((fact) => fact.description),
        referenceVerified: verification.status === "officially_verified",
      }),
    };
  });
  return {
    favorableCases: classified.filter(
      (item) => item.classification === "favorable" || item.classification === "strongly_favorable",
    ),
    unfavorableCases: classified.filter(
      (item) =>
        item.classification === "unfavorable" || item.classification === "strongly_unfavorable",
    ),
    mixedCases: classified.filter((item) => item.classification === "mixed"),
    distinguishableCases: classified.filter(
      (item) =>
        item.classification === "distinguishable" ||
        item.classification === "procedurally_irrelevant",
    ),
    patterns: classified.length >= 3 ? ["pattern_observed_in_retrieved_sample_only"] : [],
    structuredComparability,
    courtBehavior:
      classified.length >= 3 ? ["evidence_limited_cannot_generalize_beyond_retrieved_sample"] : [],
    limitations: [
      classified.length === 0
        ? "insufficient_case_law"
        : "case_law_comparison_is_limited_to_retrieved_sample",
      "no_percentages_reported_without_complete_corpus",
      "no_judge_profiling",
      "no_decisive_precedent_from_unverified_or_fragmentary_case",
      "terminological_overlap_never_sufficient_for_direct_comparability",
    ],
  };
}

function classifyCase(
  item: { providerId: string; id: string; title: string; snippet?: string },
  input: ProceduralStrategyInput,
) {
  const haystack = `${item.title} ${item.snippet ?? ""}`.toLowerCase();
  const matterTerms = input.matter.description
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 4);
  const overlap = matterTerms.filter((term) => haystack.includes(term)).length;
  const reference = extractCaseReference(`${item.id} ${item.title} ${item.snippet ?? ""}`);
  const structured = reference
    ? evaluateCaseComparability({
        reference,
        targetMatterDescription: input.matter.description,
        targetProcedure: input.matter.area,
        targetFacts: input.facts.map((fact) => fact.description),
        referenceVerified: verifyOfficialCaseReference(reference).status === "officially_verified",
      })
    : null;
  const classification =
    structured?.classification === "candidate_only" ||
    structured?.classification === "unverified_reference"
      ? "candidate_only"
      : structured?.classification === "comparable_direct"
        ? "strongly_favorable"
        : structured?.classification === "limited_analogy" ||
            structured?.classification === "general_analogy"
          ? "mixed"
          : overlap >= 2 && structured?.judicialContent.fullTextRead === true
            ? "mixed"
            : "distinguishable";
  return {
    providerId: item.providerId,
    documentId: item.id,
    title: item.title,
    classification,
    comparabilityClassification: structured?.classification ?? "unverified_reference",
    similarities:
      overlap > 0
        ? ["lexical_overlap_with_case_description_not_sufficient"]
        : structured?.dimensions.sameLegalQuestion
          ? ["structured_legal_question_overlap"]
          : [],
    differences: structured?.dimensions.limitsAndDifferences ?? [
      "full_ratio_decidendi_not_structurally_available",
    ],
    determinativeFacts: [],
    legalRule: structured?.judicialContent.ratioDecidendi[0] ?? null,
    outcome: null,
    relevance:
      structured?.classification === "comparable_direct"
        ? "directly_comparable_after_structured_checks"
        : structured?.classification === "candidate_only"
          ? "candidate_only_full_text_required_before_use"
          : classification === "mixed"
            ? "analogy_only_or_potentially_comparable"
            : "weak_or_distinguishable",
    judicialContent: structured?.judicialContent ?? null,
    comparabilityDimensions: structured?.dimensions ?? null,
    multidimensionalConfidence: structured?.confidence ?? null,
    limitations: [
      "classification_is_deterministic_and_conservative",
      "no_semantic_or_statistical_inference",
      "direct_comparability_requires_same_determinative_facts_and_same_central_legal_question",
      "search_results_snippets_are_candidate_only_until_full_text_read",
      ...(structured?.warnings.includes("full_text_not_read") ? ["full_text_not_read"] : []),
    ],
  };
}

function extractCaseReferencesFromInput(input: ProceduralStrategyInput): string[] {
  const text = [
    input.matter.description,
    input.matter.subarea ?? "",
    ...input.facts.map((fact) => fact.description),
    ...input.proceduralHistory.map((entry) => `${entry.action} ${entry.result ?? ""}`),
    input.challengedDecision?.summary ?? "",
  ].join(" ");
  const refs = parseCitations(text)
    .filter((citation) => citation.type === "case_number")
    .map((citation) => citation.caseNumber!)
    .filter(Boolean);
  return [...new Set(refs)];
}

function extractCaseReference(text: string): string | null {
  return (
    parseCitations(text).find((citation) => citation.type === "case_number")?.caseNumber ?? null
  );
}

function generateProceduralOptions(
  input: ProceduralStrategyInput,
  issues: ReturnType<typeof identifyIssues>,
  deadlines: ReturnType<typeof analyzeDeadlines>,
  evidence: ReturnType<typeof assessEvidence>,
  caseLaw: Awaited<ReturnType<typeof analyzeCaseLaw>>,
  sources: TraceSource[],
) {
  const deadlineRisk = deadlines.some((deadline) => deadline.calculationStatus !== "confirmed");
  const weakEvidence = evidence.some(
    (item) => item.strength === "weak" || item.strength === "unknown",
  );
  const routeTitle = input.objectives.includes("settlement")
    ? "Preserve rights while exploring settlement"
    : "Verify admissible procedural route before merits filing";
  return [
    {
      optionId: "option-1",
      title: routeTitle,
      description:
        "Protect procedural rights first, then present merits arguments supported by documents.",
      legalBasis: sources,
      preconditions: [
        "verify_competent_authority",
        "verify_deadline",
        "confirm_notification_evidence",
      ],
      advantages: ["reduces_admissibility_risk", "keeps_arguments_ordered"],
      disadvantages: deadlineRisk ? ["deadline_uncertain"] : [],
      risks: [
        ...issues
          .filter((issueItem) => issueItem.status === "insufficient_information")
          .map((issueItem) => issueItem.id),
        ...(weakEvidence ? ["evidence_gaps"] : []),
      ],
      costConsiderations: input.constraints.budget
        ? [`budget_constraint: ${input.constraints.budget}`]
        : [],
      timingConsiderations: deadlineRisk ? ["urgent_deadline_review_required"] : [],
      evidenceNeeds: evidence.filter((item) => item.gaps.length > 0).map((item) => item.evidenceId),
      estimatedViability:
        deadlineRisk || caseLaw.limitations.includes("insufficient_case_law")
          ? "indeterminate"
          : "medium",
      confidence: sources.length > 0 ? 0.55 : 0.35,
    },
    {
      optionId: "option-2",
      title: "Alternative protective filing or clarification request",
      description:
        "Where legally available, consider a protective filing or request for clarification while avoiding categorical admissibility claims.",
      legalBasis: [],
      preconditions: ["professional_review_of_route", "do_not_miss_deadline"],
      advantages: ["preserve_rights"],
      disadvantages: ["may_be_inadmissible_if_wrong_route"],
      risks: ["authority_incompetent", "costs_risk"],
      costConsiderations: ["court_or_administrative_costs_must_be_checked"],
      timingConsiderations: ["act_before_possible_deadline_expiry"],
      evidenceNeeds: ["proof_of_notification", "copy_of_challenged_decision"],
      estimatedViability: "indeterminate",
      confidence: 0.3,
    },
  ];
}

function buildStrategy(
  input: ProceduralStrategyInput,
  options: ReturnType<typeof generateProceduralOptions>,
  evidence: ReturnType<typeof assessEvidence>,
  deadlines: ReturnType<typeof analyzeDeadlines>,
  sources: TraceSource[],
) {
  return {
    primaryRoute: options[0]?.title ?? "insufficient_information",
    alternativeRoute: options[1]?.title ?? "professional_review_recommended",
    recommendedSequence: [
      "verify_deadline_and_notification",
      "confirm_competent_authority",
      "organize_facts_chronologically",
      "attach_key_evidence",
      "address_admissibility_before_merits",
    ],
    immediateActions: deadlines.some((deadline) => deadline.calculationStatus !== "confirmed")
      ? ["urgent_deadline_verification", "preserve_rights_if_legally_available"]
      : ["prepare_filing_package"],
    documentsToPrepare: [
      "challenged_decision",
      "proof_of_notification",
      "chronology",
      "evidence_index",
    ],
    evidenceToObtain: evidence.flatMap((item) => item.gaps),
    argumentsToPrioritize: ["admissibility", "competence", "timely_filing", "documented_facts"],
    argumentsToAvoid: [
      "unsupported_factual_assertions",
      "emotional_arguments_without_legal_relevance",
      "claims_not_tied_to_requested_relief",
    ],
    settlementPosition: input.objectives.includes("settlement")
      ? "explore_without_missing_deadlines"
      : null,
    protectiveFilings: deadlines.some((deadline) => deadline.calculationStatus !== "confirmed")
      ? ["consider_only_after_verifying_legal_basis_and_authority"]
      : [],
    confidence: sources.length > 0 ? 0.5 : 0.35,
  };
}

function buildScenarios(
  input: ProceduralStrategyInput,
  deadlines: ReturnType<typeof analyzeDeadlines>,
  evidence: ReturnType<typeof assessEvidence>,
) {
  const deadlineUncertain = deadlines.some(
    (deadline) => deadline.calculationStatus !== "confirmed",
  );
  const evidenceWeak = evidence.some(
    (item) => item.strength === "weak" || item.strength === "unknown",
  );
  return [
    {
      scenario: "best_case",
      description:
        "The authority accepts admissibility and the decisive facts are supported by reliable documents.",
      triggeringFactors: ["timely_filing", "competent_authority", "documented_key_facts"],
      proceduralConsequences: ["merits_review"],
    },
    {
      scenario: "likely_case",
      description:
        "Outcome remains uncertain because procedural route, deadlines or evidentiary record require verification.",
      triggeringFactors: [deadlineUncertain ? "uncertain_deadline" : "ordinary_procedural_review"],
      proceduralConsequences: ["requests_for_clarification_or_evidence_possible"],
    },
    {
      scenario: "adverse_case",
      description:
        "The matter may fail procedurally or on proof if missing documents, deadlines or facts are not cured.",
      triggeringFactors: [
        ...(deadlineUncertain ? ["deadline_not_proven"] : []),
        ...(evidenceWeak ? ["insufficient_evidence"] : []),
        ...(input.challengedDecision ? [] : ["no_challenged_decision"]),
      ],
      proceduralConsequences: ["inadmissibility_or_dismissal_risk"],
    },
  ];
}

function buildRisks(
  input: ProceduralStrategyInput,
  issues: ReturnType<typeof identifyIssues>,
  deadlines: ReturnType<typeof analyzeDeadlines>,
  evidence: ReturnType<typeof assessEvidence>,
  caseLaw: Awaited<ReturnType<typeof analyzeCaseLaw>>,
) {
  const risks: StrategyRisk[] = issues
    .filter((issueItem) => issueItem.status === "insufficient_information")
    .map((issueItem) => ({
      risk: `admisibilidad incierta: ${issueItem.id}`,
      probability: "unknown" as const,
      impact: "high" as const,
      mitigation: "obtain missing document or source before filing",
    }));
  if (deadlines.some((deadline) => deadline.calculationStatus !== "confirmed")) {
    risks.push({
      risk: "plazo incierto o no calculable",
      probability: input.constraints.urgency === "critical" ? "high" : "unknown",
      impact: "high",
      mitigation: "verify legal basis, notification date and suspension rules immediately",
    });
  }
  if (evidence.some((item) => item.strength === "weak" || item.strength === "unknown")) {
    risks.push({
      risk: "hecho relevante sin soporte probatorio suficiente",
      probability: "medium",
      impact: "medium",
      mitigation: "collect direct documents, official records or witness/expert evidence",
    });
  }
  if (caseLaw.limitations.includes("insufficient_case_law")) {
    risks.push({
      risk: "jurisprudencia comparable insuficiente en la muestra recuperada",
      probability: "unknown",
      impact: "medium",
      mitigation: "run targeted case-law searches with narrower issues and court filters",
    });
  }
  return risks;
}

function buildConfidence(
  input: ProceduralStrategyInput,
  sources: TraceSource[],
  caseLaw: Awaited<ReturnType<typeof analyzeCaseLaw>>,
) {
  const factCompleteness = input.facts.length > 0 && input.availableEvidence.length > 0 ? 0.6 : 0.3;
  return {
    facts: factCompleteness,
    competence: input.jurisdiction.canton ? 0.45 : 0.25,
    proceduralRoute: input.challengedDecision ? 0.45 : 0.25,
    deadline: input.deadlines.some((deadline) => deadline.confirmed) ? 0.65 : 0.2,
    applicableLaw: sources.length > 0 ? 0.55 : 0.25,
    comparableCaseLaw:
      caseLaw.favorableCases.length + caseLaw.unfavorableCases.length + caseLaw.mixedCases.length >
      0
        ? 0.45
        : 0.15,
    evidence: factCompleteness,
    strategy: sources.length > 0 ? 0.45 : 0.3,
  };
}

function buildWarnings(
  input: ProceduralStrategyInput,
  deadlines: ReturnType<typeof analyzeDeadlines>,
  caseLaw: Awaited<ReturnType<typeof analyzeCaseLaw>>,
  loaded: Awaited<ReturnType<typeof loadDocuments>>,
) {
  return [
    "not_legal_advice_no_success_guarantee",
    "human_legal_review_required",
    ...(input.constraints.urgency === "critical"
      ? ["critical_urgency_professional_review_recommended"]
      : []),
    ...(deadlines.some((deadline) => deadline.calculationStatus !== "confirmed")
      ? ["uncertain_deadline"]
      : []),
    ...(caseLaw.limitations.includes("insufficient_case_law") ? ["insufficient_case_law"] : []),
    ...(caseLaw.structuredComparability.some(
      (item) => item.verification.status !== "officially_verified",
    )
      ? ["official_source_not_found"]
      : []),
    ...(caseLaw.structuredComparability.some(
      (item) => item.comparability.classification !== "comparable_direct",
    )
      ? ["analogy_only", "ratio_not_confirmed"]
      : []),
    ...(loaded.some((entry) => entry.status !== "loaded") ? ["missing_documents"] : []),
    "do_not_destroy_or_hide_evidence",
    "do_not_make_false_statements",
  ];
}

function inferApplicableLaw(input: ProceduralStrategyInput, sources: TraceSource[]) {
  const citations = parseCitations(
    `${input.matter.description} ${input.facts.map((fact) => fact.description).join(" ")}`,
  );
  return citations.slice(0, 10).map((citation) => ({
    source: sources.find((source) => source.passage.includes(citation.raw)) ?? null,
    provision: citation.raw,
    versionDate: input.analysisDate,
    relevance: "citation_detected_in_user_supplied_case_material",
    confidence: 0.35,
  }));
}

function inferBurdenOfProof(input: ProceduralStrategyInput, sources: TraceSource[]) {
  const disputed = input.facts.filter(
    (fact) => fact.status === "disputed" || fact.status === "alleged",
  );
  return disputed.map((fact) => ({
    issue: fact.description,
    burdenOn: "must_be_verified_by_substantive_and_procedural_law",
    standard: "not_determined",
    sources,
    uncertainty: "burden_of_proof_requires_specific_legal_basis_and_claim_mapping",
  }));
}

function characterizeMatter(input: ProceduralStrategyInput): string {
  return `${input.matter.area}${input.matter.subarea ? `/${input.matter.subarea}` : ""}: ${input.matter.description}`;
}

function proceduralPosture(input: ProceduralStrategyInput): string {
  if (input.challengedDecision) return "post-decision challenge or review";
  if (input.proceduralHistory.length > 0) return "ongoing procedure with prior procedural history";
  return "pre-filing or insufficient procedural posture information";
}

function toFactSummary(fact: z.infer<typeof factSchema>) {
  return {
    id: fact.id,
    date: fact.date ?? null,
    description: fact.description,
    status: fact.status,
    sourceDocumentIds: fact.sourceDocumentIds ?? [],
  };
}

function findDateContradictions(input: ProceduralStrategyInput): string[] {
  const contradictions: string[] = [];
  const decisionDate = input.challengedDecision?.decisionDate;
  const notificationDate = input.challengedDecision?.notificationDate;
  if (decisionDate && notificationDate && notificationDate < decisionDate) {
    contradictions.push("notification_before_decision");
  }
  return contradictions;
}

function firstKeyword(text: string): string {
  return (
    text
      .toLowerCase()
      .split(/\W+/)
      .find((word) => word.length > 4) ?? text.toLowerCase()
  );
}
