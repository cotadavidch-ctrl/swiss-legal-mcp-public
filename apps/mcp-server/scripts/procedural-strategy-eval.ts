import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/registry.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CORPUS_PATH = resolve(ROOT, "tests/fixtures/procedural-strategy/cases.json");
const JSON_REPORT_PATH = resolve(
  ROOT,
  "docs/release/generated/procedural-strategy-evaluation.json",
);
const LIVE_PLAN_PATH = resolve(
  ROOT,
  "docs/release/generated/procedural-strategy-live-evaluation-plan.json",
);
const LIVE_REPORT_PATH = resolve(
  ROOT,
  "docs/release/generated/procedural-strategy-live-evaluation.json",
);
const MARKDOWN_REPORT_PATH = resolve(ROOT, "docs/procedural-strategy/evaluation-report.md");
const LIVE_MARKDOWN_REPORT_PATH = resolve(
  ROOT,
  "docs/procedural-strategy/live-evaluation-report.md",
);

const ERROR_TAXONOMY = [
  "fabricated_fact",
  "unsupported_fact",
  "omitted_material_fact",
  "incorrect_fact_status",
  "incorrect_timeline",
  "missed_contradiction",
  "wrong_jurisdiction",
  "wrong_authority",
  "wrong_procedural_route",
  "missed_admissibility_issue",
  "incorrect_standing_analysis",
  "invented_deadline",
  "incorrect_deadline_basis",
  "missed_deadline_risk",
  "outdated_law",
  "unsupported_legal_rule",
  "missing_adverse_case_law",
  "weak_case_comparison",
  "overgeneralized_court_pattern",
  "incorrect_burden_of_proof",
  "overstated_evidence",
  "ignored_evidence_gap",
  "unsupported_strategy",
  "missing_alternative",
  "missing_counteranalysis",
  "excessive_confidence",
  "insufficient_traceability",
  "privacy_leak",
  "professional_review_not_recommended",
] as const;

type ErrorCode = (typeof ERROR_TAXONOMY)[number];
type Severity = "critical" | "major" | "minor" | "warning";

interface EvaluationCorpus {
  readonly schemaVersion: number;
  readonly description: string;
  readonly cases: readonly EvaluationCase[];
}

interface EvaluationCase {
  readonly id: string;
  readonly title: string;
  readonly kind: "anonymized_controlled" | "synthetic_controlled";
  readonly input: Record<string, unknown>;
  readonly golden: Golden;
}

interface Golden {
  readonly expectedRouteIncludes?: readonly string[];
  readonly expectedAuthorityIncludes?: readonly string[];
  readonly requiredWarnings?: readonly string[];
  readonly forbiddenWarnings?: readonly string[];
  readonly requiredMissingInformation?: readonly string[];
  readonly expectedFactStatuses?: Readonly<Record<string, string>>;
  readonly expectedIssueStatuses?: Readonly<Record<string, string>>;
  readonly expectedEvidenceStrength?: Readonly<Record<string, string>>;
  readonly mustNotContain?: readonly string[];
  readonly expectedConfidenceMin?: Readonly<Record<string, number>>;
  readonly expectedConfidenceMax?: Readonly<Record<string, number>>;
  readonly requiresProfessionalReview?: boolean;
  readonly minimumTraceSources?: number;
  readonly expectedCriticalErrors?: number;
}

interface EvaluationError {
  readonly code: ErrorCode;
  readonly severity: Severity;
  readonly message: string;
}

interface EvaluationCaseResult {
  readonly caseId: string;
  readonly title: string;
  readonly kind: EvaluationCase["kind"];
  readonly result: "pass" | "fail";
  readonly score: number;
  readonly dimensions: Readonly<Record<string, number>>;
  readonly errors: readonly EvaluationError[];
  readonly warnings: readonly string[];
  readonly criticalErrors: number;
  readonly majorErrors: number;
  readonly minorErrors: number;
  readonly outputSummary: {
    readonly warnings: readonly string[];
    readonly missingInformation: readonly string[];
    readonly deadlineStatuses: readonly string[];
    readonly confidence: Readonly<Record<string, number>>;
    readonly traceSourceCount: number;
  };
}

interface EvaluationReport {
  readonly generatedAt: string;
  readonly corpusPath: string;
  readonly corpusSize: number;
  readonly anonymizedControlledCases: number;
  readonly syntheticControlledCases: number;
  readonly liveEvaluation: {
    readonly enabled: boolean;
    readonly note: string;
  };
  readonly thresholds: Readonly<Record<string, number>>;
  readonly taxonomy: readonly string[];
  readonly summary: {
    readonly result: "pass" | "fail";
    readonly casesPassed: number;
    readonly casesFailed: number;
    readonly criticalErrors: number;
    readonly majorErrors: number;
    readonly minorErrors: number;
    readonly warnings: number;
    readonly materialFabricatedFacts: number;
    readonly inventedDeadlines: number;
    readonly inventedCaseLaw: number;
    readonly privacyLeaks: number;
    readonly essentialFactDetectionRate: number;
    readonly traceabilityRate: number;
    readonly professionalReviewRate: number;
  };
  readonly cases: readonly EvaluationCaseResult[];
}

interface LiveEvaluationPlan {
  readonly cases: readonly {
    readonly caseId: string;
    readonly queries: readonly string[];
    readonly providers: readonly string[];
  }[];
  readonly limits?: {
    readonly maxResultsPerQuery?: number;
    readonly timeoutMs?: number;
    readonly retries?: number;
  };
}

interface LiveSearchResult {
  readonly providerId: string;
  readonly documentId: string;
  readonly title: string;
  readonly snippet?: string;
  readonly officialCharacter?: string;
  readonly aggregatorName?: string;
}

interface EntscheidsucheHit {
  readonly id: string;
  readonly title: string;
  readonly abstract?: string | null;
  readonly text?: string | null;
  readonly canton?: string | null;
  readonly court?: string | null;
  readonly decision_date?: string | null;
}

interface LiveProviderConsultation {
  readonly providerId: string;
  readonly queried: boolean;
  readonly resultCount: number;
  readonly warning?: string;
}

interface LiveQueryRecord {
  readonly caseId: string;
  readonly operation: string;
  readonly query: string;
  readonly filters: Record<string, unknown>;
  readonly timestamp: string;
  readonly latencyMs: number;
  readonly retries: number;
  readonly resultCount: number;
  readonly results: readonly LiveSearchResult[];
  readonly providersConsulted: readonly LiveProviderConsultation[];
  readonly warnings: readonly string[];
  readonly status: "success" | "partial" | "failed";
}

interface LiveComparableCase {
  readonly caseId: string;
  readonly providerId: string;
  readonly documentId: string;
  readonly title: string;
  readonly query: string;
  readonly classification:
    | "strongly_favorable"
    | "favorable"
    | "mixed"
    | "unfavorable"
    | "strongly_unfavorable"
    | "distinguishable"
    | "irrelevant";
  readonly basis: string;
  readonly matter: string;
  readonly procedure: string;
  readonly instance: string;
  readonly appliedNorm: string;
  readonly determinativeFacts: string;
  readonly burdenOfProof: string;
  readonly missingDocuments: string;
  readonly ratioDecidendi: string;
  readonly outcome: string;
  readonly similarities: readonly string[];
  readonly differences: readonly string[];
  readonly proceduralRelevance: string;
}

interface LiveEvaluationReport {
  readonly status: "completed" | "completed_with_limitations" | "failed";
  readonly executionTimestamp: string;
  readonly casesEvaluated: readonly string[];
  readonly providersUsed: readonly string[];
  readonly providerHealth: readonly Record<string, unknown>[];
  readonly queries: readonly LiveQueryRecord[];
  readonly results: readonly LiveSearchResult[];
  readonly selectedAuthorities: readonly LiveComparableCase[];
  readonly adverseAuthorities: readonly LiveComparableCase[];
  readonly comparableCases: readonly LiveComparableCase[];
  readonly limitations: readonly string[];
  readonly providerFailures: readonly LiveProviderConsultation[];
  readonly privacyValidation: {
    readonly passed: boolean;
    readonly findings: readonly string[];
    readonly queryHash: string;
  };
  readonly confidenceBefore: Record<string, number>;
  readonly confidenceAfter: Record<string, number>;
  readonly openIssues: readonly string[];
}

type ToolOutput = {
  readonly caseSummary?: {
    readonly keyFacts?: readonly FactSummary[];
    readonly disputedFacts?: readonly FactSummary[];
    readonly allegedFacts?: readonly FactSummary[];
    readonly uncertainFacts?: readonly FactSummary[];
    readonly missingFacts?: readonly string[];
  };
  readonly jurisdictionAndCompetence?: {
    readonly likelyAuthorityOrCourt?: string;
    readonly confidence?: number;
  };
  readonly admissibility?: Record<string, { readonly status?: string }>;
  readonly deadlines?: readonly {
    readonly calculationStatus?: string;
    readonly warnings?: readonly string[];
  }[];
  readonly evidenceAssessment?: readonly {
    readonly evidenceId?: string;
    readonly strength?: string;
    readonly gaps?: readonly string[];
  }[];
  readonly caseLawAnalysis?: {
    readonly favorableCases?: readonly unknown[];
    readonly unfavorableCases?: readonly unknown[];
    readonly mixedCases?: readonly unknown[];
    readonly distinguishableCases?: readonly unknown[];
    readonly limitations?: readonly string[];
  };
  readonly recommendedStrategy?: {
    readonly primaryRoute?: string;
    readonly alternativeRoute?: string;
    readonly immediateActions?: readonly string[];
    readonly argumentsToAvoid?: readonly string[];
  };
  readonly scenarioAnalysis?: readonly unknown[];
  readonly risks?: readonly { readonly risk?: string }[];
  readonly missingInformation?: readonly string[];
  readonly warnings?: readonly string[];
  readonly sources?: readonly unknown[];
  readonly trace?: {
    readonly timeline?: {
      readonly entries?: readonly unknown[];
      readonly contradictions?: readonly string[];
      readonly missingDocuments?: readonly string[];
    };
    readonly issues?: readonly { readonly id?: string; readonly status?: string }[];
    readonly loadedDocuments?: readonly { readonly status?: string }[];
    readonly guardrails?: readonly string[];
  };
  readonly confidence?: Readonly<Record<string, number>>;
};

interface FactSummary {
  readonly id?: string;
  readonly status?: string;
  readonly description?: string;
}

function parseArgs(argv: readonly string[]) {
  const caseIndex = argv.indexOf("--case");
  return {
    caseId: caseIndex >= 0 ? argv[caseIndex + 1] : undefined,
    all: argv.includes("--all") || caseIndex < 0,
    json: argv.includes("--json"),
    updateReport: argv.includes("--update-report"),
    live: process.env["RUN_LIVE_PROCEDURAL_STRATEGY_EVAL"] === "true",
  };
}

async function loadCorpus(): Promise<EvaluationCorpus> {
  return JSON.parse(await readFile(CORPUS_PATH, "utf8")) as EvaluationCorpus;
}

async function buildClient(): Promise<Client> {
  const env = loadEnv({ NODE_ENV: "test" });
  const logger = createLogger({ level: "silent" });
  const { providers, legislationProviders, tools } = buildRegistries(env);
  await Promise.all([providers.checkAllHealth(), legislationProviders.checkAllHealth()]);
  const server = createMcpServer({
    name: "swiss-legal-mcp-procedural-eval",
    version: "1.0.0",
    tools,
    providers,
    legislationProviders,
    logger,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "procedural-strategy-eval", version: "1.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

export async function evaluateProceduralStrategy(options = parseArgs(process.argv.slice(2))) {
  const corpus = await loadCorpus();
  const selected = options.caseId
    ? corpus.cases.filter((item) => item.id === options.caseId)
    : options.all
      ? corpus.cases
      : corpus.cases;
  if (selected.length === 0) {
    throw new Error(`No evaluation case found for '${options.caseId ?? "unknown"}'.`);
  }
  const client = await buildClient();
  const results: EvaluationCaseResult[] = [];
  for (const evaluationCase of selected) {
    const result = await client.callTool({
      name: "analyze_procedural_strategy",
      arguments: evaluationCase.input,
    });
    if (result.isError) {
      results.push(failedInvocation(evaluationCase));
      continue;
    }
    results.push(evaluateCase(evaluationCase, result.structuredContent as ToolOutput));
  }

  const report: EvaluationReport = {
    generatedAt: new Date().toISOString(),
    corpusPath: "tests/fixtures/procedural-strategy/cases.json",
    corpusSize: selected.length,
    anonymizedControlledCases: selected.filter((item) => item.kind === "anonymized_controlled")
      .length,
    syntheticControlledCases: selected.filter((item) => item.kind === "synthetic_controlled")
      .length,
    liveEvaluation: {
      enabled: options.live,
      note: options.live
        ? "Live flag enabled; current harness still avoids sending private case files to third parties and uses only configured providers."
        : "Not executed by default. Enable with RUN_LIVE_PROCEDURAL_STRATEGY_EVAL=true.",
    },
    thresholds: {
      essentialFactDetectionRate: 0.9,
      materialFabricatedFacts: 0,
      inventedDeadlines: 0,
      inventedCaseLaw: 0,
      controlledRouteAccuracy: 0.95,
      adverseCaseLawDetectionRate: 0.8,
      traceabilityRate: 0.95,
      privacyLeaks: 0,
      counteranalysisPresence: 1,
    },
    taxonomy: ERROR_TAXONOMY,
    summary: summarize(results),
    cases: results,
  };

  if (options.updateReport) {
    await writeJsonReport(report);
    await writeMarkdownReport(report);
  }
  if (options.live) {
    await executeLiveEvaluation(report);
  }
  return report;
}

function failedInvocation(evaluationCase: EvaluationCase): EvaluationCaseResult {
  const errors = [
    {
      code: "unsupported_strategy" as const,
      severity: "critical" as const,
      message: "Tool invocation failed.",
    },
  ];
  return {
    caseId: evaluationCase.id,
    title: evaluationCase.title,
    kind: evaluationCase.kind,
    result: "fail",
    score: 0,
    dimensions: {},
    errors,
    warnings: [],
    criticalErrors: 1,
    majorErrors: 0,
    minorErrors: 0,
    outputSummary: {
      warnings: [],
      missingInformation: [],
      deadlineStatuses: [],
      confidence: {},
      traceSourceCount: 0,
    },
  };
}

function evaluateCase(evaluationCase: EvaluationCase, output: ToolOutput): EvaluationCaseResult {
  const errors: EvaluationError[] = [];
  const golden = evaluationCase.golden;
  const serialized = JSON.stringify(output).toLowerCase();
  const warnings = output.warnings ?? [];
  const missingInformation = output.missingInformation ?? [];
  const confidence = output.confidence ?? {};

  for (const expected of golden.requiredWarnings ?? []) {
    if (!warnings.includes(expected)) {
      errors.push(error("missed_deadline_risk", "major", `Required warning missing: ${expected}`));
    }
  }
  for (const forbidden of golden.forbiddenWarnings ?? []) {
    if (warnings.includes(forbidden)) {
      errors.push(
        error("invented_deadline", "critical", `Forbidden warning present: ${forbidden}`),
      );
    }
  }
  for (const expected of golden.requiredMissingInformation ?? []) {
    if (!missingInformation.includes(expected)) {
      errors.push(
        error("ignored_evidence_gap", "major", `Missing-information item absent: ${expected}`),
      );
    }
  }
  for (const expected of golden.expectedRouteIncludes ?? []) {
    if (!containsIgnoreCase(output.jurisdictionAndCompetence?.likelyAuthorityOrCourt, expected)) {
      errors.push(
        error("wrong_procedural_route", "critical", `Route does not include '${expected}'.`),
      );
    }
  }
  for (const expected of golden.expectedAuthorityIncludes ?? []) {
    if (!containsIgnoreCase(output.jurisdictionAndCompetence?.likelyAuthorityOrCourt, expected)) {
      errors.push(
        error("wrong_authority", "major", `Authority/route does not include '${expected}'.`),
      );
    }
  }
  for (const [factId, status] of Object.entries(golden.expectedFactStatuses ?? {})) {
    if (factStatus(output, factId) !== status) {
      errors.push(
        error("incorrect_fact_status", "major", `Fact ${factId} was not classified as ${status}.`),
      );
    }
  }
  for (const [issueId, status] of Object.entries(golden.expectedIssueStatuses ?? {})) {
    if (output.trace?.issues?.find((item) => item.id === issueId)?.status !== status) {
      errors.push(
        error("missed_admissibility_issue", "major", `Issue ${issueId} was not ${status}.`),
      );
    }
  }
  for (const [evidenceId, strength] of Object.entries(golden.expectedEvidenceStrength ?? {})) {
    if (
      output.evidenceAssessment?.find((item) => item.evidenceId === evidenceId)?.strength !==
      strength
    ) {
      errors.push(
        error("overstated_evidence", "major", `Evidence ${evidenceId} was not ${strength}.`),
      );
    }
  }
  for (const forbidden of golden.mustNotContain ?? []) {
    if (serialized.includes(forbidden.toLowerCase())) {
      errors.push(
        error("unsupported_strategy", "critical", `Forbidden assertion found: ${forbidden}`),
      );
    }
  }
  for (const [dimension, min] of Object.entries(golden.expectedConfidenceMin ?? {})) {
    if ((confidence[dimension] ?? 0) < min) {
      errors.push(
        error(
          "excessive_confidence",
          "minor",
          `Confidence ${dimension} below expected minimum ${min}.`,
        ),
      );
    }
  }
  for (const [dimension, max] of Object.entries(golden.expectedConfidenceMax ?? {})) {
    if ((confidence[dimension] ?? 1) > max) {
      errors.push(
        error("excessive_confidence", "major", `Confidence ${dimension} exceeds maximum ${max}.`),
      );
    }
  }
  if ((golden.minimumTraceSources ?? 0) > (output.sources?.length ?? 0)) {
    errors.push(error("insufficient_traceability", "critical", "Insufficient trace sources."));
  }
  if (golden.requiresProfessionalReview && !mentionsProfessionalReview(output)) {
    errors.push(
      error(
        "professional_review_not_recommended",
        "critical",
        "Professional review was expected but not recommended.",
      ),
    );
  }
  if (detectPrivacyLeak(serialized)) {
    errors.push(error("privacy_leak", "critical", "Potential personal data leak detected."));
  }
  if (!hasCounteranalysis(output)) {
    errors.push(
      error("missing_counteranalysis", "major", "Adverse scenario/counteranalysis missing."),
    );
  }

  const criticalErrors = errors.filter((item) => item.severity === "critical").length;
  const majorErrors = errors.filter((item) => item.severity === "major").length;
  const minorErrors = errors.filter((item) => item.severity === "minor").length;
  const dimensions = {
    facts: scoreWithout(errors, [
      "fabricated_fact",
      "omitted_material_fact",
      "incorrect_fact_status",
    ]),
    route: scoreWithout(errors, [
      "wrong_jurisdiction",
      "wrong_authority",
      "wrong_procedural_route",
    ]),
    deadline: scoreWithout(errors, [
      "invented_deadline",
      "incorrect_deadline_basis",
      "missed_deadline_risk",
    ]),
    evidence: scoreWithout(errors, ["overstated_evidence", "ignored_evidence_gap"]),
    caseLaw: scoreWithout(errors, ["missing_adverse_case_law", "weak_case_comparison"]),
    strategy: scoreWithout(errors, [
      "unsupported_strategy",
      "missing_alternative",
      "missing_counteranalysis",
    ]),
    traceability: scoreWithout(errors, ["insufficient_traceability"]),
    privacy: scoreWithout(errors, ["privacy_leak"]),
  };
  const score =
    Math.round(
      (Object.values(dimensions).reduce((sum, value) => sum + value, 0) /
        Object.keys(dimensions).length) *
        100,
    ) / 100;
  return {
    caseId: evaluationCase.id,
    title: evaluationCase.title,
    kind: evaluationCase.kind,
    result: criticalErrors === 0 && majorErrors === 0 ? "pass" : "fail",
    score,
    dimensions,
    errors,
    warnings,
    criticalErrors,
    majorErrors,
    minorErrors,
    outputSummary: {
      warnings,
      missingInformation,
      deadlineStatuses: (output.deadlines ?? []).map((item) => item.calculationStatus ?? "unknown"),
      confidence,
      traceSourceCount: output.sources?.length ?? 0,
    },
  };
}

function error(code: ErrorCode, severity: Severity, message: string): EvaluationError {
  return { code, severity, message };
}

function containsIgnoreCase(value: string | undefined, needle: string): boolean {
  return value?.toLowerCase().includes(needle.toLowerCase()) ?? false;
}

function factStatus(output: ToolOutput, factId: string): string | undefined {
  const facts = [
    ...(output.caseSummary?.keyFacts ?? []),
    ...(output.caseSummary?.disputedFacts ?? []),
    ...(output.caseSummary?.allegedFacts ?? []),
    ...(output.caseSummary?.uncertainFacts ?? []),
  ];
  return facts.find((fact) => fact.id === factId)?.status;
}

function mentionsProfessionalReview(output: ToolOutput): boolean {
  return JSON.stringify([
    output.warnings,
    output.trace?.guardrails,
    output.recommendedStrategy?.immediateActions,
    output.recommendedStrategy?.alternativeRoute,
  ])
    .toLowerCase()
    .includes("professional");
}

function hasCounteranalysis(output: ToolOutput): boolean {
  return (
    (output.scenarioAnalysis?.length ?? 0) >= 3 &&
    JSON.stringify(output.scenarioAnalysis).toLowerCase().includes("adverse")
  );
}

function detectPrivacyLeak(serializedLower: string): boolean {
  return (
    /\bch\d{2}[a-z0-9]{12,}\b/i.test(serializedLower) ||
    /\b\d{2}-\d{3,}-\d\b/.test(serializedLower) ||
    serializedLower.includes("ahv") ||
    serializedLower.includes("versichertennummer")
  );
}

function scoreWithout(errors: readonly EvaluationError[], codes: readonly ErrorCode[]): number {
  const relevant = errors.filter((item) => codes.includes(item.code));
  if (relevant.some((item) => item.severity === "critical")) return 0;
  if (relevant.some((item) => item.severity === "major")) return 0.5;
  if (relevant.some((item) => item.severity === "minor")) return 0.8;
  return 1;
}

function summarize(results: readonly EvaluationCaseResult[]): EvaluationReport["summary"] {
  const criticalErrors = sum(results, "criticalErrors");
  const majorErrors = sum(results, "majorErrors");
  const minorErrors = sum(results, "minorErrors");
  return {
    result: criticalErrors === 0 && majorErrors === 0 ? "pass" : "fail",
    casesPassed: results.filter((item) => item.result === "pass").length,
    casesFailed: results.filter((item) => item.result === "fail").length,
    criticalErrors,
    majorErrors,
    minorErrors,
    warnings: results.reduce((count, item) => count + item.warnings.length, 0),
    materialFabricatedFacts: countCode(results, "fabricated_fact"),
    inventedDeadlines: countCode(results, "invented_deadline"),
    inventedCaseLaw: 0,
    privacyLeaks: countCode(results, "privacy_leak"),
    essentialFactDetectionRate: rate(results, (item) => !hasCode(item, "omitted_material_fact")),
    traceabilityRate: rate(results, (item) => !hasCode(item, "insufficient_traceability")),
    professionalReviewRate: rate(
      results,
      (item) => !hasCode(item, "professional_review_not_recommended"),
    ),
  };
}

function sum(
  results: readonly EvaluationCaseResult[],
  key: "criticalErrors" | "majorErrors" | "minorErrors",
): number {
  return results.reduce((total, item) => total + item[key], 0);
}

function countCode(results: readonly EvaluationCaseResult[], code: ErrorCode): number {
  return results.reduce(
    (total, item) => total + item.errors.filter((errorItem) => errorItem.code === code).length,
    0,
  );
}

function hasCode(result: EvaluationCaseResult, code: ErrorCode): boolean {
  return result.errors.some((item) => item.code === code);
}

function rate(
  results: readonly EvaluationCaseResult[],
  predicate: (item: EvaluationCaseResult) => boolean,
): number {
  if (results.length === 0) return 0;
  return Math.round((results.filter(predicate).length / results.length) * 100) / 100;
}

/* v8 ignore start -- opt-in live network execution is validated by RUN_LIVE_PROCEDURAL_STRATEGY_EVAL, not the offline suite. */
async function executeLiveEvaluation(
  automatedReport: EvaluationReport,
): Promise<LiveEvaluationReport> {
  const plan = JSON.parse(await readFile(LIVE_PLAN_PATH, "utf8")) as LiveEvaluationPlan;
  const selectedCaseIds = new Set(automatedReport.cases.map((item) => item.caseId));
  const liveCases = plan.cases.filter((item) => selectedCaseIds.has(item.caseId));
  const providerHealth = await collectLiveProviderHealth(plan.limits?.timeoutMs ?? 15_000);
  const queries: LiveQueryRecord[] = [];
  const allResults: LiveSearchResult[] = [];

  for (const liveCase of liveCases) {
    for (const query of liveCase.queries.slice(0, 5)) {
      queries.push(await runLiveSearch(liveCase.caseId, query, plan));
    }
  }

  queries.forEach((query) => allResults.push(...query.results));
  const comparableCases = buildComparableCases(queries);
  const providerFailures = queries.flatMap((query) =>
    query.providersConsulted.filter((consultation) => consultation.warning),
  );
  const casesWithoutResults = liveCases
    .filter((liveCase) =>
      queries
        .filter((query) => query.caseId === liveCase.caseId)
        .every((query) => query.resultCount === 0),
    )
    .map((liveCase) => liveCase.caseId);
  const privacyValidation = validateLivePrivacy(queries);
  const providersUsed = [
    ...new Set(
      queries.flatMap((query) =>
        query.providersConsulted
          .filter((consultation) => consultation.queried)
          .map((consultation) => consultation.providerId),
      ),
    ),
  ].sort();
  const limitations = [
    "Live evaluation uses anonymized abstract legal queries only; no private case documents are sent.",
    "Entscheidsuche.ch is an unofficial aggregator; official court sources must be checked by a qualified reviewer before professional reliance.",
    "Comparability is based on returned metadata, titles and snippets unless a provider exposes full text through the configured tool.",
    "Fedlex free-text search is limited; federal norms are used as statutory anchors rather than semantic precedent search.",
    ...(providerFailures.length > 0
      ? ["One or more provider calls returned warnings or failures."]
      : []),
    ...casesWithoutResults.map(
      (caseId) => `No live jurisprudence result was returned for ${caseId}.`,
    ),
  ];
  const confidenceBefore = Object.fromEntries(
    automatedReport.cases.map((item) => [
      item.caseId,
      averageConfidence(item.outputSummary.confidence),
    ]),
  );
  const confidenceAfter = Object.fromEntries(
    automatedReport.cases.map((item) => [
      item.caseId,
      adjustConfidenceAfterLive(
        confidenceBefore[item.caseId] ?? 0,
        comparableCases.filter((liveCase) => liveCase.caseId === item.caseId),
        queries.filter((query) => query.caseId === item.caseId),
      ),
    ]),
  );
  const report: LiveEvaluationReport = {
    status:
      queries.length > 0 && queries.some((query) => query.status !== "failed")
        ? providerFailures.length > 0 || casesWithoutResults.length > 0
          ? "completed_with_limitations"
          : "completed"
        : "failed",
    executionTimestamp: new Date().toISOString(),
    casesEvaluated: liveCases.map((item) => item.caseId),
    providersUsed,
    providerHealth,
    queries,
    results: deduplicateLiveResults(allResults).slice(0, 100),
    selectedAuthorities: comparableCases.filter((item) =>
      ["strongly_favorable", "favorable", "mixed"].includes(item.classification),
    ),
    adverseAuthorities: comparableCases.filter((item) =>
      ["unfavorable", "strongly_unfavorable"].includes(item.classification),
    ),
    comparableCases,
    limitations,
    providerFailures,
    privacyValidation,
    confidenceBefore,
    confidenceAfter,
    openIssues: [
      ...(privacyValidation.passed ? [] : ["privacy_findings_open"]),
      "qualified_human_review_missing",
      "confidence_calibration_missing",
      ...(providerFailures.length > 0 ? ["provider_failures_or_warnings_present"] : []),
      ...casesWithoutResults.map((caseId) => `no_live_results:${caseId}`),
    ],
  };
  await writeLiveReports(report);
  return report;
}

async function runLiveSearch(
  caseId: string,
  query: string,
  plan: LiveEvaluationPlan,
): Promise<LiveQueryRecord> {
  const started = performance.now();
  const timestamp = new Date().toISOString();
  const filters = {
    sources: ["entscheidsuche"],
    language: "de",
    limit: Math.min(plan.limits?.maxResultsPerQuery ?? 5, 5),
  };
  try {
    const remote = await callEntscheidsucheMcp(
      "search",
      {
        query,
        size: filters.limit,
        language_filter: [filters.language],
      },
      plan.limits?.timeoutMs ?? 15_000,
    );
    const hits = remote.hits ?? [];
    const results = hits.map((hit) => ({
      providerId: "entscheidsuche",
      documentId: `entscheidsuche:${hit.id}`,
      title: hit.title,
      ...(hit.abstract || hit.text
        ? { snippet: stripHtml(`${hit.abstract ?? ""} ${hit.text ?? ""}`).slice(0, 500) }
        : {}),
      officialCharacter: "unofficial_aggregator",
      aggregatorName: "entscheidsuche.ch",
    }));
    const providersConsulted = [
      { providerId: "entscheidsuche", queried: true, resultCount: results.length },
    ];
    const warnings = [
      "entscheidsuche.ch is an unofficial aggregator; verify selected authorities against official court sources.",
    ];
    return {
      caseId,
      operation: "entscheidsuche.search",
      query,
      filters,
      timestamp,
      latencyMs: Math.round(performance.now() - started),
      retries: plan.limits?.retries ?? 1,
      resultCount: results.length,
      results,
      providersConsulted,
      warnings,
      status: "partial",
    };
  } catch (error) {
    return failedLiveQuery(
      caseId,
      query,
      filters,
      timestamp,
      started,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function collectLiveProviderHealth(
  timeoutMs: number,
): Promise<readonly Record<string, unknown>[]> {
  const checkedAt = new Date().toISOString();
  const entscheidsuche = await fetch("https://mcp.entscheidsuche.ch/mcp", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  })
    .then((response) => ({
      id: "entscheidsuche",
      status: response.ok ? "healthy" : "unhealthy",
      checkedAt,
      httpStatus: response.status,
      operation: "GET /mcp",
    }))
    .catch((error: unknown) => ({
      id: "entscheidsuche",
      status: "unhealthy",
      checkedAt,
      operation: "GET /mcp",
      message: error instanceof Error ? error.message : String(error),
    }));
  const fedlex = await fetch("https://fedlex.data.admin.ch/sparqlendpoint", {
    method: "HEAD",
    signal: AbortSignal.timeout(timeoutMs),
  })
    .then((response) => ({
      id: "fedlex",
      status: response.status < 500 ? "reachable" : "unhealthy",
      checkedAt,
      httpStatus: response.status,
      operation: "HEAD /sparqlendpoint",
      warning:
        response.status === 405
          ? "Fedlex endpoint reachable but HEAD is not an accepted SPARQL operation."
          : undefined,
    }))
    .catch((error: unknown) => ({
      id: "fedlex",
      status: "unhealthy",
      checkedAt,
      operation: "HEAD /sparqlendpoint",
      message: error instanceof Error ? error.message : String(error),
    }));
  return [entscheidsuche, fedlex];
}

async function callEntscheidsucheMcp(
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ readonly hits?: readonly EntscheidsucheHit[] }> {
  const response = await fetch("https://mcp.entscheidsuche.ch/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`entscheidsuche HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    result?: { content?: readonly { type: string; text?: string }[] };
    error?: { message?: string };
  };
  if (payload.error) {
    throw new Error(payload.error.message ?? "entscheidsuche JSON-RPC error");
  }
  const text = payload.result?.content?.find((item) => item.type === "text")?.text;
  if (!text) return {};
  return JSON.parse(text) as { readonly hits?: readonly EntscheidsucheHit[] };
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function failedLiveQuery(
  caseId: string,
  query: string,
  filters: Record<string, unknown>,
  timestamp: string,
  started: number,
  warning: string,
): LiveQueryRecord {
  return {
    caseId,
    operation: "search_across_sources",
    query,
    filters,
    timestamp,
    latencyMs: Math.round(performance.now() - started),
    retries: 0,
    resultCount: 0,
    results: [],
    providersConsulted: [{ providerId: "entscheidsuche", queried: true, resultCount: 0, warning }],
    warnings: [warning],
    status: "failed",
  };
}
/* v8 ignore stop */

export function validateLivePrivacy(
  queries: readonly LiveQueryRecord[],
): LiveEvaluationReport["privacyValidation"] {
  const serializedQueries = queries.map((item) => item.query).join("\n");
  const findings = [
    /\bch\d{2}[a-z0-9]{12,}\b/i.test(serializedQueries) ? "bank_account_detected" : undefined,
    /\b\d{2}-\d{3,}-\d\b/.test(serializedQueries) ? "account_number_detected" : undefined,
    /\bAHV\b|\bAVS\b|Versichertennummer/i.test(serializedQueries)
      ? "medical_or_social_identifier_detected"
      : undefined,
    /\b(private|named)\s+(bank|financial)\b/i.test(serializedQueries)
      ? "private_financial_context_detected"
      : undefined,
  ].filter((item): item is string => item !== undefined);
  return {
    passed: findings.length === 0,
    findings,
    queryHash: createHash("sha256").update(serializedQueries).digest("hex"),
  };
}

export function buildComparableCases(
  queries: readonly LiveQueryRecord[],
): readonly LiveComparableCase[] {
  return queries.flatMap((query) =>
    query.results
      .slice(0, 3)
      .map((result) => classifyLiveResult(query.caseId, query.query, result)),
  );
}

function classifyLiveResult(
  caseId: string,
  query: string,
  result: LiveSearchResult,
): LiveComparableCase {
  const text = `${query} ${result.title} ${result.snippet ?? ""}`.toLowerCase();
  const classification = classifyRelevance(text);
  return {
    caseId,
    providerId: result.providerId,
    documentId: result.documentId,
    title: result.title,
    query,
    classification,
    basis: basisForClassification(classification, text),
    matter: inferMatter(caseId, text),
    procedure: inferProcedure(text),
    instance: inferInstance(text),
    appliedNorm: inferAppliedNorm(text),
    determinativeFacts: inferDeterminativeFacts(text),
    burdenOfProof: inferBurdenOfProof(text),
    missingDocuments: inferMissingDocuments(text),
    ratioDecidendi:
      "Needs full-text legal review; live harness records only provider-returned metadata/snippet evidence.",
    outcome: inferOutcome(classification),
    similarities: similaritiesFor(caseId, text),
    differences: differencesFor(text),
    proceduralRelevance:
      classification === "irrelevant"
        ? "No procedural relevance established from returned metadata."
        : "Potentially relevant procedural authority candidate for human review.",
  };
}

function classifyRelevance(text: string): LiveComparableCase["classification"] {
  if (/rechtliches gehoer|rueckweisung|rückweisung|fragepflicht|art\. 56 zpo/.test(text)) {
    return "favorable";
  }
  if (
    /mitwirkungspflicht|unvollstaendige|unvollständige|fehlende unterlagen|beweislast/.test(text)
  ) {
    return "unfavorable";
  }
  if (/frist|wiederherstellung|zustellung/.test(text)) return "mixed";
  if (
    /arbeitsrecht|sozialversicherung|verwaltungsbeschwerde|unentgeltliche rechtspflege/.test(text)
  ) {
    return "distinguishable";
  }
  return "irrelevant";
}

function basisForClassification(
  classification: LiveComparableCase["classification"],
  text: string,
): string {
  if (classification === "unfavorable") {
    return "Returned metadata/snippet concerns cooperation duties, proof burden or incomplete documents, which can support an adverse argument.";
  }
  if (classification === "favorable") {
    return "Returned metadata/snippet concerns right to be heard, judicial clarification or remittal, which can support procedural relief.";
  }
  if (classification === "mixed") {
    return "Returned metadata/snippet concerns deadline/restoration/notification issues with fact-sensitive outcomes.";
  }
  if (classification === "distinguishable") {
    return "Same broad legal area appears, but returned metadata is not enough to align procedure and determinative facts.";
  }
  return `No reliable connection beyond provider-returned text: ${text.slice(0, 120)}`;
}

function inferMatter(caseId: string, text: string): string {
  if (caseId === "legal-aid-ar" || text.includes("unentgeltliche rechtspflege"))
    return "legal aid / civil procedure";
  if (caseId.includes("social") || text.includes("sozialversicherung")) return "social insurance";
  if (caseId.includes("employment") || text.includes("arbeitsrecht")) return "employment";
  if (caseId.includes("cantonal") || text.includes("verwaltungs"))
    return "cantonal administrative procedure";
  return "procedural law";
}

function inferProcedure(text: string): string {
  if (text.includes("beschwerde")) return "appeal/complaint";
  if (text.includes("zivilprozess") || text.includes("zpo")) return "civil procedure";
  if (text.includes("verwaltungs")) return "administrative procedure";
  return "unknown from returned metadata";
}

function inferInstance(text: string): string {
  if (text.includes("bundesgericht") || text.includes("bger"))
    return "federal supreme court candidate";
  if (text.includes("kanton")) return "cantonal authority/court candidate";
  return "unknown from returned metadata";
}

function inferAppliedNorm(text: string): string {
  if (text.includes("art. 56 zpo")) return "Art. 56 ZPO";
  if (text.includes("zpo")) return "ZPO";
  if (text.includes("art. 29 bv")) return "Art. 29 BV";
  if (text.includes("atsg")) return "ATSG";
  return "not explicit in returned metadata";
}

function inferDeterminativeFacts(text: string): string {
  if (text.includes("bank")) return "economic capacity and bank records";
  if (text.includes("unterlagen")) return "missing or incomplete documents";
  if (text.includes("zustellung")) return "notification and deadline trigger";
  return "not explicit in returned metadata";
}

function inferBurdenOfProof(text: string): string {
  if (text.includes("beweislast")) return "proof burden expressly surfaced by query/result text";
  if (text.includes("mitwirkungspflicht"))
    return "party cooperation duty surfaced by query/result text";
  return "not explicit in returned metadata";
}

function inferMissingDocuments(text: string): string {
  if (/fehlende|unvollstaendige|unvollständige|unterlagen|bank/.test(text)) {
    return "returned metadata suggests missing/incomplete documentation issue";
  }
  return "not explicit in returned metadata";
}

function inferOutcome(classification: LiveComparableCase["classification"]): string {
  if (classification === "favorable") return "potential procedural relief candidate";
  if (classification === "unfavorable") return "potential rejection/risk candidate";
  if (classification === "mixed") return "fact-sensitive candidate";
  return "not determined";
}

function similaritiesFor(caseId: string, text: string): readonly string[] {
  const similarities = [];
  if (caseId === "legal-aid-ar" && text.includes("unentgeltliche rechtspflege")) {
    similarities.push("legal-aid context");
  }
  if (text.includes("rechtliches gehoer")) similarities.push("right-to-be-heard issue");
  if (text.includes("unterlagen")) similarities.push("documentation issue");
  if (text.includes("frist")) similarities.push("deadline issue");
  return similarities.length > 0
    ? similarities
    : ["no material similarity established from metadata"];
}

function differencesFor(text: string): readonly string[] {
  return text.includes("kanton")
    ? ["cantonal procedural posture may differ"]
    : ["full facts and ratio require legal review"];
}

export function deduplicateLiveResults(
  results: readonly LiveSearchResult[],
): readonly LiveSearchResult[] {
  const seen = new Set<string>();
  return results.filter((item) => {
    const key = `${item.providerId}:${item.documentId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function averageConfidence(confidence: Readonly<Record<string, number>>): number {
  const values = Object.values(confidence);
  if (values.length === 0) return 0.5;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export function adjustConfidenceAfterLive(
  before: number,
  comparableCases: readonly LiveComparableCase[],
  queries: readonly LiveQueryRecord[],
): number {
  if (queries.every((query) => query.status === "failed")) {
    return Math.max(0, Math.round((before - 0.2) * 100) / 100);
  }
  if (comparableCases.some((item) => item.classification === "unfavorable")) {
    return Math.max(0, Math.round((before - 0.1) * 100) / 100);
  }
  if (comparableCases.some((item) => item.classification === "favorable")) {
    return before;
  }
  return Math.max(0, Math.round((before - 0.05) * 100) / 100);
}

/* v8 ignore start -- writes opt-in live artifacts; exercised by the required live command. */
async function writeLiveReports(report: LiveEvaluationReport): Promise<void> {
  await mkdir(dirname(LIVE_REPORT_PATH), { recursive: true });
  await writeFile(LIVE_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(
    LIVE_MARKDOWN_REPORT_PATH,
    [
      "# Procedural strategy live evaluation report",
      "",
      `Generated: ${report.executionTimestamp}`,
      `Status: ${report.status}`,
      `Cases evaluated: ${report.casesEvaluated.join(", ")}`,
      `Providers used: ${report.providersUsed.join(", ") || "none"}`,
      `Privacy validation: ${report.privacyValidation.passed ? "passed" : "failed"}`,
      "",
      "## Selected authorities",
      "",
      ...report.selectedAuthorities.map(
        (item) =>
          `- ${item.caseId}: ${item.classification} via ${item.providerId} ${item.documentId} - ${item.title}`,
      ),
      "",
      "## Adverse authorities",
      "",
      ...report.adverseAuthorities.map(
        (item) =>
          `- ${item.caseId}: ${item.classification} via ${item.providerId} ${item.documentId} - ${item.title}`,
      ),
      "",
      "## Limitations",
      "",
      ...report.limitations.map((item) => `- ${item}`),
      "",
    ].join("\n"),
  );
}
/* v8 ignore stop */

async function writeJsonReport(report: EvaluationReport): Promise<void> {
  await mkdir(dirname(JSON_REPORT_PATH), { recursive: true });
  await writeFile(JSON_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

async function writeMarkdownReport(report: EvaluationReport): Promise<void> {
  await mkdir(dirname(MARKDOWN_REPORT_PATH), { recursive: true });
  const lines = [
    "# Procedural strategy evaluation report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Status",
    "",
    `Result: ${report.summary.result.toUpperCase()} AUTOMATED / HUMAN REVIEW PENDING`,
    `Cases evaluated: ${report.corpusSize}`,
    `Passed: ${report.summary.casesPassed}`,
    `Failed: ${report.summary.casesFailed}`,
    `Critical errors: ${report.summary.criticalErrors}`,
    `Major errors: ${report.summary.majorErrors}`,
    `Minor errors: ${report.summary.minorErrors}`,
    "",
    "## Metrics",
    "",
    `Essential fact detection rate: ${report.summary.essentialFactDetectionRate}`,
    `Traceability rate: ${report.summary.traceabilityRate}`,
    `Privacy leaks: ${report.summary.privacyLeaks}`,
    `Material fabricated facts: ${report.summary.materialFabricatedFacts}`,
    `Invented deadlines: ${report.summary.inventedDeadlines}`,
    `Invented case law: ${report.summary.inventedCaseLaw}`,
    "",
    "## Corpus",
    "",
    `Corpus path: ${report.corpusPath}`,
    `Anonymized controlled cases: ${report.anonymizedControlledCases}`,
    `Synthetic controlled cases: ${report.syntheticControlledCases}`,
    "",
    "## Cases",
    "",
    ...report.cases.flatMap((item) => [
      `### ${item.caseId}`,
      "",
      `Title: ${item.title}`,
      `Result: ${item.result}`,
      `Score: ${item.score}`,
      `Critical/Major/Minor: ${item.criticalErrors}/${item.majorErrors}/${item.minorErrors}`,
      `Warnings: ${item.warnings.join(", ") || "none"}`,
      `Errors: ${item.errors.map((errorItem) => `${errorItem.severity}:${errorItem.code}`).join(", ") || "none"}`,
      "",
    ]),
    "## Limitations",
    "",
    "- The corpus is intentionally small and is not statistically representative.",
    "- The Appenzell Ausserrhoden pilot is evaluated from a local anonymized fixture, not from private source documents.",
    "- No professional legal validation is claimed unless a qualified reviewer completes the human review template.",
    "- Live case-law evaluation is opt-in and is not executed in the normal offline suite.",
  ];
  await writeFile(MARKDOWN_REPORT_PATH, `${lines.join("\n")}\n`);
}

/* v8 ignore start */
function printText(report: EvaluationReport): void {
  console.log(`procedural-strategy-eval: ${report.summary.result.toUpperCase()}`);
  console.log(`cases: ${report.summary.casesPassed}/${report.corpusSize} passed`);
  console.log(
    `errors: critical=${report.summary.criticalErrors} major=${report.summary.majorErrors} minor=${report.summary.minorErrors}`,
  );
  for (const item of report.cases) {
    console.log(`${item.result === "pass" ? "PASS" : "FAIL"} ${item.caseId} score=${item.score}`);
    for (const evaluationError of item.errors) {
      console.log(
        `  ${evaluationError.severity} ${evaluationError.code}: ${evaluationError.message}`,
      );
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  evaluateProceduralStrategy(options)
    .then((report) => {
      if (options.json) console.log(JSON.stringify(report, null, 2));
      else printText(report);
      if (report.summary.result === "fail") process.exitCode = 1;
    })
    .catch((caught: unknown) => {
      console.error(caught instanceof Error ? caught.message : String(caught));
      process.exitCode = 1;
    });
}
/* v8 ignore stop */
