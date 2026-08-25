import type { NormalizedDocument } from "@swiss-legal-mcp/documents";

export type OfficialCaseVerificationStatus =
  | "officially_verified"
  | "aggregator_only"
  | "cantonal_aggregator_only"
  | "official_not_found"
  | "official_mismatch"
  | "unverified_reference";

export type CaseComparabilityClassification =
  | "candidate_only"
  | "comparable_direct"
  | "limited_analogy"
  | "general_analogy"
  | "distinguishable"
  | "irrelevant"
  | "unverified_reference";

export type FullTextReadingStatus =
  | "full_text_verified"
  | "full_text_read"
  | "partial_text_only"
  | "headnote_only"
  | "snippet_only"
  | "inaccessible_full_text"
  | "extraction_incomplete"
  | "full_text_read_unofficial"
  | "full_text_verified_official";

export type RatioStatus =
  "ratio_confirmed" | "ratio_probable" | "ratio_not_confirmed" | "ratio_unavailable";

export interface FullTextReadingCoverage {
  readonly total_pages: number | null;
  readonly pages_read: readonly number[];
  readonly total_sections: number;
  readonly sections_read: readonly string[];
  readonly coverage_percentage: number;
  readonly last_section_read: string | null;
  readonly unread_ranges: readonly string[];
  readonly extraction_complete: boolean;
  readonly dispositive_present: boolean;
  readonly factual_section_present: boolean;
  readonly reasoning_section_complete: boolean;
  readonly independent_grounds_reviewed: boolean;
  readonly separate_opinions_reviewed: boolean;
}

export interface FullTextReadingReport {
  readonly status: FullTextReadingStatus;
  readonly full_text_read_unofficial: boolean;
  readonly full_text_verified_official: boolean;
  readonly full_text_source_official: boolean;
  readonly full_text_source_unofficial: boolean;
  readonly full_text_coverage_percentage: number;
  readonly unread_sections: readonly string[];
  readonly missing_sections: readonly string[];
  readonly extraction_errors: readonly string[];
  readonly reading_completed_at: string | null;
  readonly document_hash: string | null;
  readonly source_url: string | null;
  readonly retrieved_at: string | null;
  readonly extractor_version: string;
  readonly coverage: FullTextReadingCoverage;
  readonly ratio_status: RatioStatus;
  readonly warnings: readonly string[];
}

export interface FullTextReadingInput {
  readonly reference: string;
  readonly sourceKind?: "official" | "unofficial_aggregator" | "snippet" | "headnote";
  readonly sourceUrl?: string;
  readonly retrievedAt?: string;
  readonly readingCompletedAt?: string;
  readonly documentHash?: string;
  readonly fullText?: string;
  readonly totalPages?: number;
  readonly pagesRead?: readonly number[];
  readonly sectionsRead?: readonly string[];
  readonly expectedSections?: readonly string[];
  readonly extractionErrors?: readonly string[];
  readonly hashChanged?: boolean;
  readonly sourceMismatch?: boolean;
  readonly includesSeparateOpinion?: boolean;
}

export interface MultidimensionalLegalConfidence {
  readonly source_identity_confidence: number;
  readonly passage_content_confidence: number;
  readonly temporal_applicability_confidence: number;
  readonly legal_applicability_confidence: number;
  readonly comparability_confidence: number;
  readonly strategic_usefulness_confidence: number;
}

export interface OfficialCaseVerification {
  readonly status: OfficialCaseVerificationStatus;
  readonly reference: string;
  readonly officialSourceUrl: string | null;
  readonly aggregatorSourceUrl: string | null;
  readonly metadata: {
    readonly date: string | null;
    readonly chamber: string | null;
    readonly matter: string | null;
    readonly subjectArea: string | null;
  };
  readonly verifiedElements: readonly string[];
  readonly fullTextReading: FullTextReadingReport;
  readonly warnings: readonly string[];
  readonly evidence: readonly {
    readonly source: "official_bger" | "entscheidsuche" | "cantonal_aggregator";
    readonly sourceUrl: string;
    readonly sourceCharacter: "official" | "unofficial_aggregator";
    readonly note: string;
  }[];
}

export interface JudicialContentSeparation {
  readonly reference: string;
  readonly fullTextRead: boolean;
  readonly fullTextStatus: FullTextReadingStatus;
  readonly reading: FullTextReadingReport;
  readonly ratioStatus: RatioStatus;
  readonly factsEstablished: readonly string[];
  readonly partyAllegations: readonly string[];
  readonly lowerAuthorityReasoning: readonly string[];
  readonly decidingCourtReasoning: readonly string[];
  readonly ratioDecidendi: readonly string[];
  readonly obiter: readonly string[];
  readonly outcome: string | null;
  readonly supportPassages: readonly {
    readonly passage: string;
    readonly source: "official_bger" | "aggregator" | "user_supplied";
    readonly status: "verified" | "inference" | "not_verified";
  }[];
  readonly warnings: readonly string[];
}

export interface ComparabilityEvaluation {
  readonly reference: string;
  readonly classification: CaseComparabilityClassification;
  readonly dimensions: {
    readonly sameMatter: boolean;
    readonly sameProcedure: boolean;
    readonly sameDeterminativeFacts: boolean;
    readonly sameEvidentiaryProblem: boolean;
    readonly documentsAlreadySubmittedOrEvidencePending:
      "already_submitted" | "pending" | "mixed" | "unknown";
    readonly sameLegalQuestion: boolean;
    readonly sameRatioDecidendi: boolean;
    readonly sameRelevantOutcome: boolean;
    readonly strategicUsefulness: "high" | "medium" | "low" | "none";
    readonly limitsAndDifferences: readonly string[];
  };
  readonly judicialContent: JudicialContentSeparation;
  readonly confidence: MultidimensionalLegalConfidence;
  readonly warnings: readonly string[];
}

interface OfficialFederalCaseRecord {
  readonly reference: string;
  readonly date: string;
  readonly chamber: string;
  readonly matter: string;
  readonly subjectArea: string;
  readonly officialSourceUrl: string;
  readonly supportPassages: readonly string[];
  readonly fullTextRead: boolean;
  readonly readingSections: readonly string[];
  readonly totalSections: number;
  readonly ratioStatus: RatioStatus;
}

const OFFICIAL_FEDERAL_CASES: ReadonlyMap<string, OfficialFederalCaseRecord> = new Map(
  [
    {
      reference: "1B_352/2019",
      date: "2019-10-30",
      chamber: "I. öffentlich-rechtliche Abteilung",
      matter: "Strafverfahren; Kontosperre",
      subjectArea: "criminal_procedure_asset_freezing",
      officialSourceUrl:
        "https://www.bger.ch/ext/eurospider/live/fr/php/aza/http/index.php?highlight_docid=aza%3A%2F%2F30-10-2019-1B_352-2019%3Ade&type=show_document",
      supportPassages: [
        "Strafverfahren; Kontosperre",
        "Beschwerde gegen den Entscheid des Obergerichts des Kantons Aargau",
      ],
      fullTextRead: true,
      readingSections: [
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
      totalSections: 9,
      ratioStatus: "ratio_confirmed" as const,
    },
    {
      reference: "4A_97/2026",
      date: "2026-05-07",
      chamber: "I. zivilrechtliche Abteilung",
      matter: "Rechtsoeffnung",
      subjectArea: "civil_debt_enforcement_document_authenticity",
      officialSourceUrl:
        "https://www.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?highlight_docid=aza%3A%2F%2F07-05-2026-4A_97-2026&lang=de&type=show_document&zoom=",
      supportPassages: ["Rechtsoeffnung", "Art. 178 ZPO", "Kontoauszuege"],
      fullTextRead: true,
      readingSections: [
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
      totalSections: 9,
      ratioStatus: "ratio_confirmed" as const,
    },
    {
      reference: "9C_785/2018",
      date: "2019-05-10",
      chamber: "II. sozialrechtliche Abteilung",
      matter: "Invalidenversicherung",
      subjectArea: "social_insurance_invalidity_new_evidence",
      officialSourceUrl:
        "https://www.bger.ch/ext/eurospider/live/fr/php/aza/http/index.php?highlight_docid=aza%3A%2F%2F10-05-2019-9C_785-2018&lang=fr&print=yes&type=show_document",
      supportPassages: [
        "Invalidenversicherung",
        "Neue Tatsachen und Beweismittel",
        "Art. 99 Abs. 1 BGG",
      ],
      fullTextRead: true,
      readingSections: [
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
      totalSections: 9,
      ratioStatus: "ratio_confirmed" as const,
    },
    {
      reference: "4A_114/2013",
      date: "2013-06-20",
      chamber: "I. zivilrechtliche Abteilung",
      matter: "unentgeltliche Rechtspflege; Zivilverfahren",
      subjectArea: "civil_legal_aid_duty_to_clarify",
      officialSourceUrl:
        "https://www.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?highlight_docid=aza%3A%2F%2F20-06-2013-4A_114-2013&lang=de&type=show_document",
      supportPassages: ["unentgeltliche Rechtspflege", "Mitwirkungspflicht"],
      fullTextRead: false,
      readingSections: ["headnote"],
      totalSections: 9,
      ratioStatus: "ratio_not_confirmed" as const,
    },
  ].map((record) => [record.reference, record]),
);

const CANTONAL_AGGREGATOR_REFERENCES = new Set([
  "AC/1124/2023",
  "DAAJ/117/2023",
  "AC/3617/2022",
  "DAAJ/97/2023",
]);

export function normalizeCaseReference(value: string): string {
  return value.trim().replace(/-/g, "/").replace(/\s+/g, "");
}

export function verifyOfficialCaseReference(
  reference: string,
  document?: NormalizedDocument | null,
): OfficialCaseVerification {
  const normalized = normalizeCaseReference(reference);
  const aggregatorSourceUrl =
    document?.provenance.officialCharacter === "unofficial_aggregator"
      ? document.provenance.sourceUrl
      : null;

  const federal = OFFICIAL_FEDERAL_CASES.get(normalized);
  if (federal) {
    const mismatchWarnings = buildOfficialMismatchWarnings(federal, document);
    const reading = assessCaseFullTextReading({
      reference: federal.reference,
      sourceKind: "official",
      sourceUrl: federal.officialSourceUrl,
      retrievedAt: document?.provenance.retrievedAt,
      documentHash: document?.provenance.contentHash,
      totalPages: nullToUndefined(document?.rawMetadata["totalPages"]),
      pagesRead: numberArrayOrUndefined(document?.rawMetadata["pagesRead"]),
      sectionsRead: federal.readingSections,
      expectedSections: DEFAULT_REQUIRED_CASE_SECTIONS,
      extractionErrors: mismatchWarnings,
      sourceMismatch: mismatchWarnings.length > 0,
    });
    const status: OfficialCaseVerificationStatus =
      mismatchWarnings.length > 0 ? "official_mismatch" : "officially_verified";
    return {
      status,
      reference: federal.reference,
      officialSourceUrl: federal.officialSourceUrl,
      aggregatorSourceUrl,
      metadata: {
        date: federal.date,
        chamber: federal.chamber,
        matter: federal.matter,
        subjectArea: federal.subjectArea,
      },
      verifiedElements: ["reference", "date", "chamber", "matter", "support_passage"],
      fullTextReading: reading,
      warnings: [
        ...reading.warnings,
        ...(status === "official_mismatch" ? ["official_mismatch"] : []),
        ...(aggregatorSourceUrl ? ["aggregator_secondary_trace_preserved"] : []),
        ...mismatchWarnings,
      ],
      evidence: [
        {
          source: "official_bger",
          sourceUrl: federal.officialSourceUrl,
          sourceCharacter: "official",
          note: "official Bundesgericht record metadata and support passages verified from bger.ch/search.bger.ch",
        },
        ...(aggregatorSourceUrl
          ? [
              {
                source: "entscheidsuche" as const,
                sourceUrl: aggregatorSourceUrl,
                sourceCharacter: "unofficial_aggregator" as const,
                note: "aggregator trace retained but not treated as official verification",
              },
            ]
          : []),
      ],
    };
  }

  if (CANTONAL_AGGREGATOR_REFERENCES.has(normalized)) {
    const reading = assessCaseFullTextReading({
      reference: normalized,
      sourceKind: "snippet",
      sourceUrl: aggregatorSourceUrl ?? undefined,
      retrievedAt: document?.provenance.retrievedAt,
      documentHash: document?.provenance.contentHash,
      sectionsRead: [],
      expectedSections: DEFAULT_REQUIRED_CASE_SECTIONS,
    });
    return {
      status: "cantonal_aggregator_only",
      reference: normalized,
      officialSourceUrl: null,
      aggregatorSourceUrl,
      metadata: { date: null, chamber: null, matter: null, subjectArea: "cantonal_case" },
      verifiedElements: ["reference"],
      fullTextReading: reading,
      warnings: [
        "unofficial_source",
        "official_source_not_found",
        "cantonal_aggregator_only",
        ...reading.warnings,
      ],
      evidence: aggregatorSourceUrl
        ? [
            {
              source: "cantonal_aggregator",
              sourceUrl: aggregatorSourceUrl,
              sourceCharacter: "unofficial_aggregator",
              note: "no official cantonal court source is integrated for this decision",
            },
          ]
        : [],
    };
  }

  if (/^\d[A-Z]{1,3}_\d+\/\d{4}$/.test(normalized)) {
    const reading = assessCaseFullTextReading({
      reference: normalized,
      sourceKind: aggregatorSourceUrl ? "unofficial_aggregator" : "snippet",
      sourceUrl: aggregatorSourceUrl ?? undefined,
      retrievedAt: document?.provenance.retrievedAt,
      documentHash: document?.provenance.contentHash,
      fullText: document?.fullText,
      sectionsRead: arrayOrUndefined(document?.rawMetadata["sectionsRead"]),
      expectedSections: DEFAULT_REQUIRED_CASE_SECTIONS,
    });
    return {
      status: aggregatorSourceUrl ? "aggregator_only" : "official_not_found",
      reference: normalized,
      officialSourceUrl: null,
      aggregatorSourceUrl,
      metadata: { date: null, chamber: null, matter: null, subjectArea: null },
      verifiedElements: aggregatorSourceUrl ? ["reference"] : [],
      fullTextReading: reading,
      warnings: aggregatorSourceUrl
        ? ["unofficial_source", "official_source_not_found", ...reading.warnings]
        : ["official_source_not_found", ...reading.warnings],
      evidence: aggregatorSourceUrl
        ? [
            {
              source: "entscheidsuche",
              sourceUrl: aggregatorSourceUrl,
              sourceCharacter: "unofficial_aggregator",
              note: "reference observed only in aggregator data",
            },
          ]
        : [],
    };
  }

  const reading = assessCaseFullTextReading({
    reference: normalized,
    sourceKind: "snippet",
    sourceUrl: aggregatorSourceUrl ?? undefined,
    retrievedAt: document?.provenance.retrievedAt,
    documentHash: document?.provenance.contentHash,
  });
  return {
    status: "unverified_reference",
    reference: normalized,
    officialSourceUrl: null,
    aggregatorSourceUrl,
    metadata: { date: null, chamber: null, matter: null, subjectArea: null },
    verifiedElements: [],
    fullTextReading: reading,
    warnings: ["unverified_reference", ...reading.warnings],
    evidence: [],
  };
}

const EXTRACTOR_VERSION = "case-full-text-policy-v1";

const DEFAULT_REQUIRED_CASE_SECTIONS = [
  "facts",
  "procedural_history",
  "party_arguments",
  "lower_authority_reasoning",
  "reasoning",
  "admissibility",
  "review_standard",
  "dispositive",
  "costs",
] as const;

function nullToUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function arrayOrUndefined(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function numberArrayOrUndefined(value: unknown): number[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "number")
    ? value
    : undefined;
}

export function inferSectionsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const sections: string[] = [];

  // Facts section - expanded patterns to catch variations
  if (/sachverhalt|faits|fatti|statement of facts|background/.test(lower)) sections.push("facts");

  // Procedural history - expanded patterns
  if (/prozessgeschichte|procédure|procedura|procedural history|procedurelle/.test(lower))
    sections.push("procedural_history");

  // Party arguments - expanded patterns and more flexible matching
  if (
    /macht geltend|conclut|chiede|party arguments|parties plead|clients_arguments|requests conclusion/.test(
      lower,
    )
  )
    sections.push("party_arguments");

  // Lower authority reasoning - expanded patterns
  if (
    /vorinstanz|autorité précédente|autorità inferiore|lower authority|court below|previous instance/.test(
      lower,
    )
  )
    sections.push("lower_authority_reasoning");

  // Improved reasoning section detection - catch various formulations
  if (
    /erwägung|considérant|considerando|reasoning|motifs|grounds|considerations|decoder|considering/.test(
      lower,
    )
  )
    sections.push("reasoning");

  // Admissibility - expanded patterns
  if (/zulässig|recevable|ammissibile|admissibility|zulassigkeit|recevabilité/.test(lower))
    sections.push("admissibility");

  // Review standard - expanded patterns
  if (/willkür|arbitraire|arbitrio|überprüft|examine|review|standard|scrutiny|control/.test(lower))
    sections.push("review_standard");

  // Dispositive - expanded patterns
  if (/dispositiv|dispositif|dispositivo|disposition|operative part|decision|order/.test(lower))
    sections.push("dispositive");

  // Costs - expanded patterns
  if (/kosten|frais|spese|costs|expenses|fees/.test(lower)) sections.push("costs");

  // Independent grounds - expanded patterns
  if (
    /eventualbegründung|alternativbegründung|motif subsidiaire|motivo alternativo|independent ground|alternative grounds|separate grounds/.test(
      lower,
    )
  )
    sections.push("independent_grounds");

  // Separate opinions - expanded patterns
  if (
    /minderheitsmeinung|opinion séparée|opinione separata|dissenting opinion|separate opinion|concurring opinion/.test(
      lower,
    )
  )
    sections.push("separate_opinions");

  return [...new Set(sections)];
}

export function assessCaseFullTextReading(input: FullTextReadingInput): FullTextReadingReport {
  const expected = [...(input.expectedSections ?? DEFAULT_REQUIRED_CASE_SECTIONS)];
  const sectionsRead = [...(input.sectionsRead ?? inferSectionsFromText(input.fullText ?? ""))];
  const missingSections = expected.filter((section) => !sectionsRead.includes(section));
  const unreadSections = missingSections;
  const extractionErrors = [...(input.extractionErrors ?? [])];
  const hasFullText = Boolean(input.fullText && input.fullText.trim().length > 0);
  const sourceKind = input.sourceKind ?? "snippet";
  const pagesRead = [...(input.pagesRead ?? [])];
  const totalPages = input.totalPages ?? null;
  const pageCoverage =
    totalPages && totalPages > 0
      ? Math.min(100, Math.round((new Set(pagesRead).size / totalPages) * 100))
      : null;
  const sectionCoverage =
    expected.length === 0
      ? 100
      : Math.round(((expected.length - missingSections.length) / expected.length) * 100);
  const coveragePercentage = Math.min(pageCoverage ?? 100, sectionCoverage);
  const extractionComplete =
    extractionErrors.length === 0 &&
    missingSections.length === 0 &&
    coveragePercentage === 100 &&
    (!input.includesSeparateOpinion || sectionsRead.includes("separate_opinions"));
  const official = sourceKind === "official";
  const unofficial = sourceKind === "unofficial_aggregator";
  const status: FullTextReadingStatus = ((): FullTextReadingStatus => {
    if (input.hashChanged || input.sourceMismatch) return "extraction_incomplete";
    if (sourceKind === "headnote") return "headnote_only";
    if (sourceKind === "snippet") return "snippet_only";
    if (!hasFullText && !official) return "inaccessible_full_text";
    if (!extractionComplete) return "extraction_incomplete";
    if (official) return "full_text_verified_official";
    if (unofficial) return "full_text_read_unofficial";
    return "full_text_read";
  })();
  const fullTextRead =
    status === "full_text_read" ||
    status === "full_text_read_unofficial" ||
    status === "full_text_verified" ||
    status === "full_text_verified_official";
  const ratioStatus: RatioStatus = fullTextRead
    ? missingSections.includes("dispositive") ||
      missingSections.includes("reasoning") ||
      !extractionComplete
      ? "ratio_not_confirmed"
      : "ratio_confirmed"
    : "ratio_not_confirmed";
  const warnings = new Set<string>();
  if (!fullTextRead) warnings.add("full_text_not_read");
  if (!official || status !== "full_text_verified_official") warnings.add("full_text_not_verified");
  if (!extractionComplete) warnings.add("extraction_incomplete");
  if (missingSections.includes("dispositive")) warnings.add("missing_dispositif");
  if (missingSections.includes("facts")) warnings.add("missing_factual_section");
  if (missingSections.includes("reasoning")) warnings.add("missing_reasoning_section");
  if (missingSections.includes("lower_authority_reasoning")) warnings.add("possible_context_loss");
  if (!sectionsRead.includes("independent_grounds")) {
    warnings.add("missing_independent_ground_review");
    warnings.add("independent_ground_not_reviewed");
  }
  if (sourceKind === "snippet" || sourceKind === "headnote") warnings.add("candidate_only");
  if (unofficial) warnings.add("source_unofficial");
  if (input.sourceMismatch) warnings.add("full_text_source_mismatch");
  if (input.hashChanged) warnings.add("document_hash_changed");
  if (input.includesSeparateOpinion && !sectionsRead.includes("separate_opinions")) {
    warnings.add("separate_opinion_not_reviewed");
  }
  return {
    status,
    full_text_read_unofficial: status === "full_text_read_unofficial",
    full_text_verified_official: status === "full_text_verified_official",
    full_text_source_official: official,
    full_text_source_unofficial: unofficial,
    full_text_coverage_percentage: fullTextRead ? 100 : coveragePercentage,
    unread_sections: unreadSections,
    missing_sections: missingSections,
    extraction_errors: extractionErrors,
    reading_completed_at: fullTextRead
      ? (input.readingCompletedAt ?? new Date(0).toISOString())
      : null,
    document_hash: input.documentHash ?? null,
    source_url: input.sourceUrl ?? null,
    retrieved_at: input.retrievedAt ?? null,
    extractor_version: EXTRACTOR_VERSION,
    coverage: {
      total_pages: totalPages,
      pages_read: pagesRead,
      total_sections: expected.length,
      sections_read: sectionsRead,
      coverage_percentage: fullTextRead ? 100 : coveragePercentage,
      last_section_read: sectionsRead.at(-1) ?? null,
      unread_ranges: buildUnreadRanges(totalPages, pagesRead),
      extraction_complete: extractionComplete,
      dispositive_present: sectionsRead.includes("dispositive"),
      factual_section_present: sectionsRead.includes("facts"),
      reasoning_section_complete: sectionsRead.includes("reasoning") && extractionComplete,
      independent_grounds_reviewed: sectionsRead.includes("independent_grounds"),
      separate_opinions_reviewed: input.includesSeparateOpinion
        ? sectionsRead.includes("separate_opinions")
        : true,
    },
    ratio_status: ratioStatus,
    warnings: [...warnings],
  };
}

function buildUnreadRanges(totalPages: number | null, pagesRead: readonly number[]): string[] {
  if (!totalPages || totalPages <= 0) return [];
  const read = new Set(pagesRead);
  const missing: string[] = [];
  let start: number | null = null;
  for (let page = 1; page <= totalPages; page += 1) {
    if (!read.has(page) && start === null) start = page;
    if ((read.has(page) || page === totalPages) && start !== null) {
      const end = read.has(page) ? page - 1 : page;
      missing.push(start === end ? `${start}` : `${start}-${end}`);
      start = null;
    }
  }
  return missing;
}

function buildOfficialMismatchWarnings(
  record: OfficialFederalCaseRecord,
  document?: NormalizedDocument | null,
): string[] {
  if (!document) return [];
  const warnings: string[] = [];
  const docDate = document.date.decisionOrEnactment;
  if (docDate && docDate !== record.date) warnings.push(`date_mismatch:${docDate}:${record.date}`);
  const lowerTitle = document.title.toLowerCase();
  if (document.title && !lowerTitle.includes(record.reference.toLowerCase())) {
    warnings.push("reference_not_present_in_aggregator_title");
  }
  return warnings;
}

export function separateJudicialContent(reference: string): JudicialContentSeparation {
  const normalized = normalizeCaseReference(reference);
  const federal = OFFICIAL_FEDERAL_CASES.get(normalized);
  const reading = federal
    ? assessCaseFullTextReading({
        reference: federal.reference,
        sourceKind: "official",
        sourceUrl: federal.officialSourceUrl,
        sectionsRead: federal.readingSections,
        expectedSections: DEFAULT_REQUIRED_CASE_SECTIONS,
      })
    : assessCaseFullTextReading({
        reference: normalized,
        sourceKind: CANTONAL_AGGREGATOR_REFERENCES.has(normalized)
          ? "unofficial_aggregator"
          : "snippet",
        expectedSections: DEFAULT_REQUIRED_CASE_SECTIONS,
      });
  switch (normalized) {
    case "1B_352/2019":
      return {
        reference: normalized,
        fullTextRead: reading.status === "full_text_verified_official",
        fullTextStatus: reading.status,
        reading,
        ratioStatus: reading.ratio_status,
        factsEstablished: [
          "account freezing was ordered in a criminal investigation for fraud and embezzlement",
        ],
        partyAllegations: [
          "the appellant challenged the freezing orders and invoked hearing-right objections",
        ],
        lowerAuthorityReasoning: [
          "the cantonal appeal authority upheld the account freezing orders",
        ],
        decidingCourtReasoning: [
          "the Federal Supreme Court reviewed criminal-procedure coercive measures and the legal disadvantage required for an interim decision",
        ],
        ratioDecidendi: [
          "account-freezing proportionality and hearing-right analysis belong to criminal procedure and do not decide legal-aid asset double-counting",
        ],
        obiter: [],
        outcome: "complaint assessed in criminal-procedure framework",
        supportPassages: [
          {
            passage: "Strafverfahren; Kontosperre",
            source: "official_bger",
            status: "verified",
          },
        ],
        warnings: ["analogy_only", "factual_difference", ...reading.warnings],
      };
    case "4A_97/2026":
      return {
        reference: normalized,
        fullTextRead: reading.status === "full_text_verified_official",
        fullTextStatus: reading.status,
        reading,
        ratioStatus: reading.ratio_status,
        factsEstablished: [
          "the case concerned debt enforcement and submitted account statements in a Rechtsöffnung proceeding",
        ],
        partyAllegations: ["the debtor disputed integrity/authenticity of account statements"],
        lowerAuthorityReasoning: [
          "the lower instances granted Rechtsöffnung in part and treated the account statements as usable for the limited proceeding",
        ],
        decidingCourtReasoning: [
          "the Federal Supreme Court separated formal authenticity under Art. 178 ZPO from material correctness",
        ],
        ratioDecidendi: [
          "formal authenticity of a document is distinct from whether its contents are materially correct",
        ],
        obiter: [],
        outcome: "civil debt-enforcement complaint dismissed or rejected on the relevant points",
        supportPassages: [
          {
            passage:
              "Art. 178 ZPO concerns authenticity in the narrow sense, not material correctness.",
            source: "official_bger",
            status: "verified",
          },
        ],
        warnings: ["analogy_only", "factual_difference", ...reading.warnings],
      };
    case "9C_785/2018":
      return {
        reference: normalized,
        fullTextRead: reading.status === "full_text_verified_official",
        fullTextStatus: reading.status,
        reading,
        ratioStatus: reading.ratio_status,
        factsEstablished: [
          "invalidity-insurance dispute about entitlement after completed administrative clarifications",
        ],
        partyAllegations: [
          "the appellant sought at least a three-quarter pension or remittal for further evidence",
        ],
        lowerAuthorityReasoning: ["the cantonal social-insurance court dismissed the complaint"],
        decidingCourtReasoning: [
          "the Federal Supreme Court addressed social-insurance and new-evidence limits",
        ],
        ratioDecidendi: [
          "new facts and evidence before the Federal Supreme Court are limited by Art. 99 BGG",
        ],
        obiter: [],
        outcome: "social-insurance dispute resolved under IV/BGG framework",
        supportPassages: [
          {
            passage: "Neue Tatsachen und Beweismittel ... Art. 99 Abs. 1 BGG",
            source: "official_bger",
            status: "verified",
          },
        ],
        warnings: ["factual_difference", ...reading.warnings],
      };
    case "4A_114/2013":
      return {
        reference: normalized,
        fullTextRead: false,
        fullTextStatus: reading.status,
        reading,
        ratioStatus: "ratio_not_confirmed",
        factsEstablished: [],
        partyAllegations: [],
        lowerAuthorityReasoning: [],
        decidingCourtReasoning: [],
        ratioDecidendi: [],
        obiter: [],
        outcome: null,
        supportPassages: [],
        warnings: [
          ...new Set(["full_text_not_read", "human_legal_review_required", ...reading.warnings]),
        ],
      };
    case "AC/1124/2023":
    case "DAAJ/117/2023":
    case "AC/3617/2022":
    case "DAAJ/97/2023":
      return {
        reference: normalized,
        fullTextRead: false,
        fullTextStatus: reading.status,
        reading,
        ratioStatus: "ratio_not_confirmed",
        factsEstablished: [],
        partyAllegations: [],
        lowerAuthorityReasoning: [],
        decidingCourtReasoning: [],
        ratioDecidendi: [],
        obiter: [],
        outcome: null,
        supportPassages: [],
        warnings: [
          ...new Set([
            "unofficial_source",
            "full_text_not_read",
            "passage_not_verified",
            ...reading.warnings,
          ]),
        ],
      };
    default:
      return {
        reference: normalized,
        fullTextRead: false,
        fullTextStatus: reading.status,
        reading,
        ratioStatus: "ratio_not_confirmed",
        factsEstablished: [],
        partyAllegations: [],
        lowerAuthorityReasoning: [],
        decidingCourtReasoning: [],
        ratioDecidendi: [],
        obiter: [],
        outcome: null,
        supportPassages: [],
        warnings: [
          ...new Set([
            "unverified_reference",
            "full_text_not_read",
            "ratio_not_confirmed",
            ...reading.warnings,
          ]),
        ],
      };
  }
}

export function evaluateCaseComparability(params: {
  readonly reference: string;
  readonly targetMatterDescription: string;
  readonly targetProcedure?: string;
  readonly targetFacts?: readonly string[];
  readonly referenceVerified?: boolean;
}): ComparabilityEvaluation {
  const reference = normalizeCaseReference(params.reference);
  const target =
    `${params.targetMatterDescription} ${params.targetProcedure ?? ""} ${params.targetFacts?.join(" ") ?? ""}`.toLowerCase();
  const judicialContent = separateJudicialContent(reference);
  const hasLegalAid = /unentgelt|legal aid|assistance juridique|ajg|bedürftig|beduerftig/.test(
    target,
  );
  const hasOwnAccountTransfer =
    /transfer|übertrag|uebertrag|compte|konto|account|same titular|mismo titular|double-count|doppel/.test(
      target,
    );

  if (params.referenceVerified === false) {
    return buildComparability(reference, "unverified_reference", judicialContent, {
      sameMatter: false,
      sameProcedure: false,
      sameDeterminativeFacts: false,
      sameEvidentiaryProblem: false,
      documentsAlreadySubmittedOrEvidencePending: "unknown",
      sameLegalQuestion: false,
      sameRatioDecidendi: false,
      sameRelevantOutcome: false,
      strategicUsefulness: "none",
      limitsAndDifferences: ["reference_not_officially_verified"],
    });
  }

  if (reference === "1B_352/2019" && hasLegalAid && hasOwnAccountTransfer) {
    return buildComparability(reference, "general_analogy", judicialContent, {
      sameMatter: false,
      sameProcedure: false,
      sameDeterminativeFacts: false,
      sameEvidentiaryProblem: true,
      documentsAlreadySubmittedOrEvidencePending: "mixed",
      sameLegalQuestion: false,
      sameRatioDecidendi: false,
      sameRelevantOutcome: false,
      strategicUsefulness: "low",
      limitsAndDifferences: [
        "criminal_procedure_not_legal_aid",
        "account_freezing_not_asset_double_counting",
      ],
    });
  }

  if (reference === "4A_97/2026" && hasOwnAccountTransfer) {
    return buildComparability(reference, "limited_analogy", judicialContent, {
      sameMatter: false,
      sameProcedure: false,
      sameDeterminativeFacts: false,
      sameEvidentiaryProblem: true,
      documentsAlreadySubmittedOrEvidencePending: "already_submitted",
      sameLegalQuestion: false,
      sameRatioDecidendi: false,
      sameRelevantOutcome: false,
      strategicUsefulness: "medium",
      limitsAndDifferences: [
        "formal_authenticity_not_asset_double_counting",
        "rechtsöffnung_not_legal_aid",
      ],
    });
  }

  if (reference === "9C_785/2018") {
    return buildComparability(reference, "distinguishable", judicialContent, {
      sameMatter: false,
      sameProcedure: false,
      sameDeterminativeFacts: false,
      sameEvidentiaryProblem: false,
      documentsAlreadySubmittedOrEvidencePending: "pending",
      sameLegalQuestion: false,
      sameRatioDecidendi: false,
      sameRelevantOutcome: false,
      strategicUsefulness: "low",
      limitsAndDifferences: [
        "invalidity_insurance_not_legal_aid",
        "new_evidence_on_appeal_not_clarifiable_bank_transfer",
      ],
    });
  }

  if (
    hasLegalAid &&
    hasOwnAccountTransfer &&
    /same amount|trazable|saldo final cero|zero final balance|same holder|mismo titular/.test(
      target,
    )
  ) {
    return buildComparability(reference, "comparable_direct", judicialContent, {
      sameMatter: true,
      sameProcedure: true,
      sameDeterminativeFacts: true,
      sameEvidentiaryProblem: true,
      documentsAlreadySubmittedOrEvidencePending: "already_submitted",
      sameLegalQuestion: true,
      sameRatioDecidendi: true,
      sameRelevantOutcome: true,
      strategicUsefulness: "high",
      limitsAndDifferences: [],
    });
  }

  if (
    /kontoausz|rechtliches gehör|rechtliches gehoer|antizipierte beweiswürdigung|antizipierte beweiswuerdigung/.test(
      target,
    )
  ) {
    return buildComparability(reference, "general_analogy", judicialContent, {
      sameMatter: false,
      sameProcedure: false,
      sameDeterminativeFacts: false,
      sameEvidentiaryProblem: false,
      documentsAlreadySubmittedOrEvidencePending: "unknown",
      sameLegalQuestion: false,
      sameRatioDecidendi: false,
      sameRelevantOutcome: false,
      strategicUsefulness: "low",
      limitsAndDifferences: ["lexical_overlap_only", "central_legal_question_not_matched"],
    });
  }

  return buildComparability(reference, "distinguishable", judicialContent, {
    sameMatter: false,
    sameProcedure: false,
    sameDeterminativeFacts: false,
    sameEvidentiaryProblem: false,
    documentsAlreadySubmittedOrEvidencePending: "unknown",
    sameLegalQuestion: false,
    sameRatioDecidendi: false,
    sameRelevantOutcome: false,
    strategicUsefulness: "low",
    limitsAndDifferences: ["insufficient_structured_overlap"],
  });
}

function buildComparability(
  reference: string,
  classification: CaseComparabilityClassification,
  judicialContent: JudicialContentSeparation,
  dimensions: ComparabilityEvaluation["dimensions"],
): ComparabilityEvaluation {
  const safeClassification = eligibleForPrecedentialUse(judicialContent)
    ? classification
    : classification === "unverified_reference"
      ? "unverified_reference"
      : "candidate_only";
  const confidence = confidenceForClassification(safeClassification, judicialContent);
  const warnings = new Set<string>([
    ...judicialContent.warnings,
    "human_legal_review_required",
    ...(safeClassification === "comparable_direct" ? [] : ["analogy_only"]),
    ...(dimensions.limitsAndDifferences.length > 0 ? ["factual_difference"] : []),
    ...(dimensions.sameRatioDecidendi ? [] : ["ratio_not_confirmed"]),
    ...(safeClassification === "candidate_only"
      ? [
          "candidate_only",
          "full_text_not_read",
          "full_text_not_verified",
          "no_decisive_precedent_from_partial_text",
        ]
      : []),
  ]);
  return {
    reference,
    classification: safeClassification,
    dimensions,
    judicialContent,
    confidence,
    warnings: [...warnings],
  };
}

function confidenceForClassification(
  classification: CaseComparabilityClassification,
  judicialContent?: JudicialContentSeparation,
): MultidimensionalLegalConfidence {
  if (classification === "candidate_only") {
    return {
      source_identity_confidence: judicialContent?.fullTextStatus === "snippet_only" ? 0.25 : 0.35,
      passage_content_confidence: 0.1,
      temporal_applicability_confidence: 0.15,
      legal_applicability_confidence: 0.05,
      comparability_confidence: 0.05,
      strategic_usefulness_confidence: 0.05,
    };
  }
  if (classification === "comparable_direct") {
    return {
      source_identity_confidence: 0.85,
      passage_content_confidence: 0.75,
      temporal_applicability_confidence: 0.55,
      legal_applicability_confidence: 0.75,
      comparability_confidence: 0.8,
      strategic_usefulness_confidence: 0.75,
    };
  }
  if (classification === "limited_analogy" || classification === "general_analogy") {
    return {
      source_identity_confidence: 0.8,
      passage_content_confidence: 0.65,
      temporal_applicability_confidence: 0.45,
      legal_applicability_confidence: 0.45,
      comparability_confidence: 0.4,
      strategic_usefulness_confidence: 0.45,
    };
  }
  return {
    source_identity_confidence: classification === "unverified_reference" ? 0.1 : 0.7,
    passage_content_confidence: 0.35,
    temporal_applicability_confidence: 0.25,
    legal_applicability_confidence: 0.2,
    comparability_confidence: 0.15,
    strategic_usefulness_confidence: 0.2,
  };
}

export function eligibleForPrecedentialUse(judicialContent: JudicialContentSeparation): boolean {
  return (
    judicialContent.fullTextRead &&
    (judicialContent.ratioStatus === "ratio_confirmed" ||
      judicialContent.ratioStatus === "ratio_probable") &&
    judicialContent.reading.coverage.coverage_percentage === 100 &&
    judicialContent.reading.coverage.dispositive_present &&
    judicialContent.reading.coverage.factual_section_present &&
    judicialContent.reading.coverage.reasoning_section_complete &&
    judicialContent.reading.coverage.independent_grounds_reviewed
  );
}

export function analyzeLegalAidClarificationDuty(input: {
  readonly matterDescription: string;
  readonly facts: readonly string[];
  readonly representation: "self-represented" | "lawyer" | "unknown";
  readonly canton?: string;
}) {
  const text = `${input.matterDescription} ${input.facts.join(" ")}`.toLowerCase();
  const selfRepresented = input.representation === "self-represented";
  const represented = input.representation === "lawyer";
  const clearRequest = /clear|klar|concrete|konkret|specific|précis|precis/.test(text);
  const priorWarnings = /warning|warnung|averti|advertencia|nachfrist|frist/.test(text);
  const repeatedOpportunities =
    /\b(second|third|zweite|dritte|multiple|mehrere|varias)\s+(opportunit|chance|request|warning|nachfrist|frist|aufforderung|requerimiento)/.test(
      text,
    );
  const ownAccountTransfer =
    /same titular|mismo titular|own account|cuentas propias|eigen.*konto|transfer/.test(text);
  const zeroFinalBalance = /zero final|saldo final cero|0\.00|nullsaldo/.test(text);
  const visibleContradiction =
    /contradiction|widerspruch|contradicción|apparent third account|tercera cuenta/.test(text);
  const totalProofGap = /no documents|keine unterlagen|aucun document|vacío probatorio total/.test(
    text,
  );

  return {
    unbeholfenAssessment: {
      status:
        selfRepresented && !clearRequest && !priorWarnings
          ? "contextual_possible"
          : "not_automatic",
      factors: [
        `representation:${input.representation}`,
        clearRequest ? "clear_prior_request" : "request_clarity_not_confirmed",
        priorWarnings ? "prior_warning_or_deadline" : "no_prior_warning_confirmed",
        repeatedOpportunities ? "multiple_opportunities" : "opportunity_count_not_confirmed",
      ],
      warnings: [
        ...(selfRepresented ? ["self_represented_not_automatically_unbeholfen"] : []),
        ...(represented ? ["lawyer_representation_reduces_unbeholfen_inference"] : []),
      ],
    },
    proceduralLawBasis: {
      art29Abs3Bv: "potentially_relevant_for_legal_aid",
      art56Zpo: input.canton ? "not_confirmed_direct_or_supplementary" : "analogy_only",
      mitwirkungspflicht: "must_be_addressed",
      cantonalProceduralLaw: input.canton ? `must_verify_${input.canton}` : "not_confirmed",
      strategicInference:
        "request clarification only as contingent argument, not as automatic right",
      warnings: ["procedural_law_not_confirmed"],
    },
    evidentiaryPosture: {
      category: totalProofGap
        ? "total_proof_gap"
        : ownAccountTransfer && zeroFinalBalance
          ? "clarifiable_ambiguity_with_double_counting_risk"
          : visibleContradiction
            ? "visible_contradiction"
            : "documentation_incomplete_or_uncertain",
      doubleCountingRisk: ownAccountTransfer && zeroFinalBalance,
      clarificationDuty:
        ownAccountTransfer && zeroFinalBalance && !repeatedOpportunities
          ? "arguable"
          : "not_automatic",
      partyOmissionRisk: clearRequest || priorWarnings || repeatedOpportunities ? "high" : "medium",
    },
    mandatoryCounterargument:
      "Mitwirkungspflicht: the applicant must substantiate indigence and provide requested financial documents; the authority is not a party adviser or general investigator.",
  };
}
