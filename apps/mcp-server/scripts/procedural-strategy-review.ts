import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { z } from "zod";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/registry.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CORPUS_PATH = resolve(ROOT, "tests/fixtures/procedural-strategy/cases.json");
const PACKAGE_DIR = resolve(ROOT, "docs/procedural-strategy/human-review");
const ARTIFACT_PACKAGE_DIR = resolve(ROOT, "artifacts/procedural-strategy-human-review");
const GENERATED_DIR = resolve(ROOT, "docs/release/generated");
const HUMAN_VALIDATION_JSON = resolve(GENERATED_DIR, "procedural-strategy-human-validation.json");
const LIVE_PLAN_JSON = resolve(GENERATED_DIR, "procedural-strategy-live-evaluation-plan.json");
const LIVE_EVALUATION_JSON = resolve(GENERATED_DIR, "procedural-strategy-live-evaluation.json");
const HUMAN_VALIDATION_MD = resolve(ROOT, "docs/procedural-strategy/human-validation-report.md");
const SELECTED_CASE_IDS = [
  "legal-aid-ar",
  "cantonal-admin-controlled",
  "social-insurance-controlled",
  "employment-controlled",
  "uncertain-deadline-controlled",
] as const;

const dimensions = [
  "fact_reconstruction",
  "chronology",
  "fact_classification",
  "competence",
  "authority",
  "procedural_route",
  "admissibility",
  "standing",
  "deadlines",
  "applicable_law",
  "burden_of_proof",
  "evidence_assessment",
  "comparable_case_law",
  "adverse_case_law",
  "primary_strategy",
  "alternatives",
  "counteranalysis",
  "risks",
  "confidence",
  "traceability",
  "clarity",
  "practical_utility",
] as const;

const findingSeverities = [
  "critical",
  "major",
  "minor",
  "stylistic",
  "missing_context",
  "unsupported_inference",
  "excessive_confidence",
  "insufficient_confidence",
  "missed_adverse_authority",
  "wrong_procedural_route",
  "deadline_issue",
  "evidence_overstatement",
  "strategy_weakness",
  "privacy_issue",
  "traceability_issue",
] as const;

const scoreSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal("N/A"),
]);

const reviewImportSchema = z
  .object({
    schemaVersion: z.literal(1),
    systemVersion: z.literal("1.0.0"),
    importedAt: z.iso.datetime().optional(),
    reviewers: z
      .array(
        z
          .object({
            reviewerId: z
              .string()
              .min(3)
              .max(80)
              .regex(/^reviewer-[a-z0-9-]+$/),
            qualification: z.string().min(3).max(500),
            jurisdictions: z.array(z.string().min(2).max(80)).min(1).max(20),
            experience: z.string().min(3).max(500),
            conflictOfInterest: z.enum(["none_declared", "declared"]),
            conflictOfInterestDescription: z.string().max(1000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    caseReviews: z
      .array(
        z
          .object({
            caseId: z.string().min(1).max(120),
            reviewerId: z.string().min(3).max(80),
            reviewDate: z.iso.date(),
            caseHash: z.string().regex(/^[a-f0-9]{64}$/),
            outputHash: z.string().regex(/^[a-f0-9]{64}$/),
            scores: z.record(z.enum(dimensions), scoreSchema),
            comments: z.record(z.enum(dimensions), z.string().max(2000).optional()),
            findings: z
              .array(
                z
                  .object({
                    dimension: z.enum(dimensions),
                    severity: z.enum(findingSeverities),
                    description: z.string().min(1).max(2000),
                    recommendedCorrection: z.string().min(1).max(2000),
                    accepted: z.boolean().optional(),
                    rejected: z.boolean().optional(),
                    rationale: z.string().max(2000).optional(),
                    regressionTestAdded: z.boolean().optional(),
                  })
                  .strict(),
              )
              .max(100),
            overallAssessment: z.enum([
              "accepted",
              "accepted_with_corrections",
              "rejected",
              "not_assessable",
            ]),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    adjudications: z
      .array(
        z
          .object({
            caseId: z.string().min(1).max(120),
            dimension: z.enum(dimensions),
            disagreement: z.string().min(1).max(2000),
            finalDecision: z.string().min(1).max(2000),
            regressionTestAdded: z.boolean(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

type ReviewImport = z.infer<typeof reviewImportSchema>;

interface Corpus {
  readonly cases: readonly {
    readonly id: string;
    readonly title: string;
    readonly input: Record<string, unknown>;
  }[];
}

interface ReviewCasePackage {
  readonly caseId: string;
  readonly title: string;
  readonly caseHash: string;
  readonly outputHash: string;
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown>;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function loadCorpus(): Promise<Corpus> {
  return JSON.parse(await readFile(CORPUS_PATH, "utf8")) as Corpus;
}

async function buildClient(): Promise<Client> {
  process.env["NODE_ENV"] = "test";
  const env = loadEnv({ NODE_ENV: "test" });
  const logger = createLogger({ level: "silent" });
  const { providers, legislationProviders, tools } = buildRegistries(env);
  await Promise.all([providers.checkAllHealth(), legislationProviders.checkAllHealth()]);
  const server = createMcpServer({
    name: "swiss-legal-mcp-human-review",
    version: "1.0.0",
    tools,
    providers,
    legislationProviders,
    logger,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "procedural-strategy-human-review", version: "1.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

export async function prepareHumanReviewPackage(): Promise<void> {
  const corpus = await loadCorpus();
  const client = await buildClient();
  await mkdir(resolve(PACKAGE_DIR, "cases"), { recursive: true });
  const preparedCases = [];

  for (const caseId of SELECTED_CASE_IDS) {
    const evaluationCase = corpus.cases.find((item) => item.id === caseId);
    if (!evaluationCase) throw new Error(`Missing selected case ${caseId}`);
    const result = await client.callTool({
      name: "analyze_procedural_strategy",
      arguments: evaluationCase.input,
    });
    if (result.isError) throw new Error(`Tool failed for ${caseId}`);
    const output = result.structuredContent;
    const reviewCase: ReviewCasePackage & {
      readonly schemaVersion: number;
      readonly systemVersion: string;
      readonly reviewerQuestions: readonly Record<string, string>[];
      readonly privacyNotice: string;
    } = {
      schemaVersion: 1,
      systemVersion: "1.0.0",
      caseId,
      title: evaluationCase.title,
      caseHash: sha256(evaluationCase.input),
      outputHash: sha256(output),
      input: evaluationCase.input,
      output,
      reviewerQuestions: dimensions.map((dimension) => ({
        dimension,
        question: `Assess ${dimension.replaceAll("_", " ")} on the 0-4/N/A scale. Explain every score below 3.`,
      })),
      privacyNotice:
        "This package is anonymized for review. Do not add names, account numbers, addresses, private docket numbers or medical identifiers.",
    };
    await writeFile(
      resolve(PACKAGE_DIR, "cases", `${caseId}.json`),
      `${JSON.stringify(reviewCase, null, 2)}\n`,
    );
    await writeExportableCasePackage(reviewCase);
    preparedCases.push({
      caseId,
      title: evaluationCase.title,
      caseHash: reviewCase.caseHash,
      outputHash: reviewCase.outputHash,
    });
  }

  await writeReviewDocs(preparedCases);
  await writeExportablePackageIndex(preparedCases);
  await writeLiveEvaluationPlan(preparedCases);
  await writeNoReviewReport(preparedCases);
  formatGeneratedReviewArtifacts();
}

async function writeExportableCasePackage(reviewCase: ReviewCasePackage): Promise<void> {
  const caseDir = resolve(ARTIFACT_PACKAGE_DIR, reviewCase.caseId);
  await mkdir(caseDir, { recursive: true });
  const common = {
    schemaVersion: 1,
    systemVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    caseId: reviewCase.caseId,
    title: reviewCase.title,
    caseHash: reviewCase.caseHash,
    outputHash: reviewCase.outputHash,
  };
  await writeFile(
    resolve(caseDir, "case-input.json"),
    `${JSON.stringify({ ...common, input: reviewCase.input }, null, 2)}\n`,
  );
  await writeFile(
    resolve(caseDir, "system-output.json"),
    `${JSON.stringify({ ...common, output: reviewCase.output }, null, 2)}\n`,
  );
  await writeFile(
    resolve(caseDir, "source-list.json"),
    `${JSON.stringify({ ...common, sources: reviewCase.output["sources"] ?? [] }, null, 2)}\n`,
  );
  await writeFile(
    resolve(caseDir, "traceability.json"),
    `${JSON.stringify({ ...common, trace: reviewCase.output["trace"] ?? null }, null, 2)}\n`,
  );
  await writeFile(
    resolve(caseDir, "confidence.json"),
    `${JSON.stringify({ ...common, confidence: reviewCase.output["confidence"] ?? {} }, null, 2)}\n`,
  );
  const reviewerForm = buildCaseReviewerForm(reviewCase);
  await writeFile(
    resolve(caseDir, "reviewer-form.json"),
    `${JSON.stringify(reviewerForm, null, 2)}\n`,
  );
  await writeFile(resolve(caseDir, "reviewer-form.md"), renderCaseReviewerFormMarkdown(reviewCase));
  await writeFile(
    resolve(caseDir, "instructions.md"),
    [
      `# Review instructions: ${reviewCase.caseId}`,
      "",
      "Review the system output against the case input and traceability files.",
      "",
      "Do not add names, account numbers, addresses, personal docket numbers, private documents or medical identifiers.",
      "",
      "The package intentionally excludes expected answers and golden labels.",
      "",
      `Case hash: ${reviewCase.caseHash}`,
      `Output hash: ${reviewCase.outputHash}`,
      "System version: 1.0.0",
      "",
    ].join("\n"),
  );
}

function buildCaseReviewerForm(reviewCase: ReviewCasePackage): unknown {
  return {
    schemaVersion: 1,
    systemVersion: "1.0.0",
    caseId: reviewCase.caseId,
    caseHash: reviewCase.caseHash,
    outputHash: reviewCase.outputHash,
    reviewerId: "",
    reviewDate: "",
    scores: Object.fromEntries(dimensions.map((dimension) => [dimension, "N/A"])),
    comments: Object.fromEntries(dimensions.map((dimension) => [dimension, ""])),
    findings: [],
    overallAssessment: "not_assessable",
  };
}

function renderCaseReviewerFormMarkdown(reviewCase: ReviewCasePackage): string {
  return [
    `# Reviewer form: ${reviewCase.caseId}`,
    "",
    `Case hash: ${reviewCase.caseHash}`,
    `Output hash: ${reviewCase.outputHash}`,
    "",
    "| Dimension | Score 0-4/N/A | Comment |",
    "| --- | --- | --- |",
    ...dimensions.map((dimension) => `| ${dimension} |  |  |`),
    "",
    "Overall assessment:",
    "",
    "Findings:",
    "",
  ].join("\n");
}

async function writeExportablePackageIndex(
  preparedCases: readonly Record<string, string>[],
): Promise<void> {
  await mkdir(ARTIFACT_PACKAGE_DIR, { recursive: true });
  await writeFile(
    resolve(ARTIFACT_PACKAGE_DIR, "README.md"),
    [
      "# Procedural strategy human review package",
      "",
      "This local package is ready for a qualified legal reviewer.",
      "",
      "It contains no golden labels or expected answers.",
      "",
      "Cases:",
      ...preparedCases.map((item) => `- ${item["caseId"]}`),
      "",
      "Each case directory contains:",
      "",
      "- case-input.json",
      "- system-output.json",
      "- source-list.json",
      "- traceability.json",
      "- confidence.json",
      "- reviewer-form.json",
      "- reviewer-form.md",
      "- instructions.md",
      "",
      "After review, consolidate completed forms into one import JSON and run:",
      "",
      "```sh",
      "pnpm review:procedural-strategy --import path/to/review.json",
      "```",
      "",
    ].join("\n"),
  );
}

async function writeReviewDocs(preparedCases: readonly Record<string, string>[]): Promise<void> {
  await writeFile(
    resolve(PACKAGE_DIR, "README.md"),
    [
      "# Human review package",
      "",
      "This package prepares qualified legal review of `analyze_procedural_strategy`.",
      "",
      "It contains five anonymized or synthetic controlled cases. Reviewers assess analysis quality; they do not assume responsibility for any underlying case.",
      "",
      "Prepared cases:",
      ...preparedCases.map(
        (item) =>
          `- ${item["caseId"]}: caseHash ${item["caseHash"]}, outputHash ${item["outputHash"]}`,
      ),
      "",
      "Import completed reviews with:",
      "",
      "```sh",
      "pnpm review:procedural-strategy --import path/to/review.json",
      "```",
    ].join("\n"),
  );
  await writeFile(
    resolve(PACKAGE_DIR, "review-form-template.json"),
    `${JSON.stringify(buildEmptyReviewTemplate(preparedCases), null, 2)}\n`,
  );
  await writeFile(
    resolve(ROOT, "docs/procedural-strategy/reviewer-guide.md"),
    [
      "# Reviewer guide",
      "",
      "Use the files in `docs/procedural-strategy/human-review/cases/`.",
      "",
      "Score every dimension using:",
      "",
      "- 4: correct and complete",
      "- 3: substantially correct with minor omissions",
      "- 2: partly correct with relevant deficiencies",
      "- 1: incorrect or insufficient",
      "- 0: dangerous, fabricated or procedurally unacceptable",
      "- N/A: not applicable",
      "",
      "Every score below 3 requires a comment. The review evaluates analysis quality only.",
    ].join("\n"),
  );
  await writeFile(
    resolve(ROOT, "docs/procedural-strategy/reviewer-schema.md"),
    [
      "# Reviewer schema",
      "",
      "The import schema is enforced by `pnpm review:procedural-strategy --import <path>`.",
      "",
      `Dimensions: ${dimensions.join(", ")}.`,
      "",
      `Finding severities: ${findingSeverities.join(", ")}.`,
      "",
      "Reviewer IDs must be pseudonymous and match `reviewer-[a-z0-9-]+`.",
    ].join("\n"),
  );
  await writeFile(
    resolve(ROOT, "docs/procedural-strategy/adjudication.md"),
    [
      "# Adjudication",
      "",
      "When reviewers disagree materially, both views remain recorded. No automatic tie-break is applied.",
      "",
      "An adjudication entry must explain the disagreement, final decision and whether a regression test was added.",
    ].join("\n"),
  );
  await writeFile(
    resolve(ROOT, "docs/procedural-strategy/calibration.md"),
    [
      "# Calibration",
      "",
      "Confidence calibration compares automatic confidence with human scores.",
      "",
      "Patterns to watch:",
      "",
      "- overconfidence with missing documents;",
      "- overconfidence with uncertain deadlines;",
      "- overconfidence with sparse or mixed case law;",
      "- underconfidence where several strong sources align.",
      "",
      "No case-specific calibration rule should be added unless it generalizes.",
    ].join("\n"),
  );
  await writeFile(
    resolve(ROOT, "docs/procedural-strategy/live-evaluation.md"),
    [
      "# Live evaluation",
      "",
      "Live evaluation is opt-in and is not run by the normal offline suite.",
      "",
      "Run only with anonymized abstract legal issues:",
      "",
      "```sh",
      "RUN_LIVE_PROCEDURAL_STRATEGY_EVAL=true pnpm eval:procedural-strategy --all",
      "```",
      "",
      "For `legal-aid-ar`, use abstract queries about legal aid, economic capacity, transfer between own accounts, Art. 56 ZPO, incomplete bank documentation, later-filed evidence, advance on costs, right to be heard and remittal.",
      "",
      "The latest controlled run writes:",
      "",
      "- `docs/release/generated/procedural-strategy-live-evaluation.json`",
      "- `docs/procedural-strategy/live-evaluation-report.md`",
      "",
      "Do not send names, account numbers, addresses, private documents, personal docket numbers or medical identifiers.",
      "",
      "The current live harness uses `entscheidsuche.ch` through its public MCP endpoint with hard per-request timeouts. It records selected, adverse and distinguishable candidates from provider-returned metadata/snippets, then leaves final legal comparability to human review.",
    ].join("\n"),
  );
}

function buildEmptyReviewTemplate(preparedCases: readonly Record<string, string>[]): unknown {
  return {
    schemaVersion: 1,
    systemVersion: "1.0.0",
    reviewers: [
      {
        reviewerId: "reviewer-example",
        qualification: "",
        jurisdictions: ["CH"],
        experience: "",
        conflictOfInterest: "none_declared",
      },
    ],
    caseReviews: preparedCases.map((item) => ({
      caseId: item["caseId"],
      reviewerId: "reviewer-example",
      reviewDate: "YYYY-MM-DD",
      caseHash: item["caseHash"],
      outputHash: item["outputHash"],
      scores: Object.fromEntries(dimensions.map((dimension) => [dimension, "N/A"])),
      comments: Object.fromEntries(dimensions.map((dimension) => [dimension, ""])),
      findings: [],
      overallAssessment: "not_assessable",
    })),
    adjudications: [],
  };
}

async function writeNoReviewReport(
  preparedCases: readonly Record<string, string>[],
): Promise<void> {
  const liveEvaluationCompleted = await readLiveEvaluationCompleted();
  const report = {
    generatedAt: new Date().toISOString(),
    status: "prepared_no_human_reviews",
    humanReviewPrepared: true,
    humanReviewCompleted: false,
    liveEvaluationCompleted,
    criticalFindingsOpen: 0,
    calibrationCompleted: false,
    preparedCases,
    reviewers: [],
    caseReviews: [],
    summary: {
      reviewedCases: 0,
      qualifiedReviewers: 0,
      averageCriticalDimensionScore: null,
      agreementByDimension: {},
      blockers: [
        "qualified_human_review_missing",
        ...(liveEvaluationCompleted ? [] : ["live_evaluation_missing"]),
      ],
    },
  };
  await mkdir(GENERATED_DIR, { recursive: true });
  await writeFile(HUMAN_VALIDATION_JSON, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(
    HUMAN_VALIDATION_MD,
    [
      "# Human validation report",
      "",
      "Status: PREPARED, HUMAN REVIEW NOT COMPLETED",
      "",
      `Prepared cases: ${preparedCases.map((item) => item["caseId"]).join(", ")}`,
      "",
      "No qualified human review has been imported. No professional validation is claimed.",
      "",
      liveEvaluationCompleted
        ? "Live evaluation has been completed separately; confidence calibration still requires human review."
        : "Live evaluation has not been completed.",
    ].join("\n"),
  );
}

async function readLiveEvaluationCompleted(): Promise<boolean> {
  try {
    const live = JSON.parse(await readFile(LIVE_EVALUATION_JSON, "utf8")) as { status?: string };
    return live.status === "completed" || live.status === "completed_with_limitations";
  } catch {
    return false;
  }
}

async function writeLiveEvaluationPlan(
  preparedCases: readonly Record<string, string>[],
): Promise<void> {
  const legalAidQueries = [
    "unentgeltliche Rechtspflege Bedürftigkeit Bankunterlagen",
    "Art. 56 ZPO gerichtliche Fragepflicht unvollständige Unterlagen",
    "unentgeltliche Rechtspflege Kostenvorschuss Vermögen Bankkonto",
    "rechtliches Gehör Noven Beschwerdeverfahren Bankauszüge",
    "Rückweisung wirtschaftliche Verhältnisse unentgeltliche Rechtspflege",
  ];
  const genericQueries: Record<string, readonly string[]> = {
    "cantonal-admin-controlled": [
      "kantonale Verwaltungsbeschwerde rechtliches Gehoer Art. 29 BV",
      "Verwaltungsverfahren fehlende Unterlagen Mitwirkungspflicht Beschwerde",
    ],
    "social-insurance-controlled": [
      "Sozialversicherung Einsprache Beschwerde Frist Mitwirkungspflicht",
      "Sozialversicherungsrecht unvollstaendige Akten Beweislast",
    ],
    "employment-controlled": [
      "Arbeitsrecht Lohnforderung Überstunden Beweislast",
      "Arbeitsvertrag Lohnklage Schlichtungsverfahren Beweise",
    ],
    "uncertain-deadline-controlled": [
      "Verwaltungsbeschwerde unklare Zustellung Frist Wiederherstellung",
      "mangelhafte Zustellung Verwaltungsentscheid Fristbeginn rechtliches Gehoer",
    ],
  };
  const plan = {
    generatedAt: new Date().toISOString(),
    status: "planned_not_executed",
    liveEvaluationCompleted: false,
    limits: {
      maxQueriesPerCase: 5,
      maxResultsPerQuery: 5,
      maxDocumentsPerCase: 10,
      timeoutMs: 15000,
      retries: 1,
      maxDownloadedBytesPerDocument: 1000000,
    },
    privacyRules: [
      "no names",
      "no account numbers",
      "no addresses",
      "no private docket numbers",
      "no medical identifiers",
      "no private documents",
    ],
    cases: preparedCases.map((item) => ({
      caseId: item["caseId"],
      queries:
        item["caseId"] === "legal-aid-ar"
          ? legalAidQueries
          : (genericQueries[item["caseId"] ?? ""] ?? []),
      providers: [
        "fedlex",
        "entscheidsuche",
        "cantonal providers already integrated when applicable",
      ],
      classificationDimensions: [
        "procedure type",
        "instance",
        "authority",
        "legal norm",
        "procedural issue",
        "determinative facts",
        "burden of proof",
        "missing document",
        "outcome",
        "ratio decidendi",
      ],
    })),
  };
  await mkdir(GENERATED_DIR, { recursive: true });
  await writeFile(LIVE_PLAN_JSON, `${JSON.stringify(plan, null, 2)}\n`);
}

export async function importHumanReview(filePath: string): Promise<void> {
  const review = reviewImportSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
  const prepared = await readPreparedCases();
  validateReview(review, prepared);
  const report = buildHumanValidationReport(review, prepared, await readLiveEvaluationCompleted());
  await mkdir(GENERATED_DIR, { recursive: true });
  await writeFile(HUMAN_VALIDATION_JSON, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(HUMAN_VALIDATION_MD, renderHumanValidationMarkdown(report));
}

async function readPreparedCases(): Promise<Map<string, { caseHash: string; outputHash: string }>> {
  const prepared = new Map<string, { caseHash: string; outputHash: string }>();
  for (const caseId of SELECTED_CASE_IDS) {
    const raw = JSON.parse(
      await readFile(resolve(PACKAGE_DIR, "cases", `${caseId}.json`), "utf8"),
    ) as { caseId: string; caseHash: string; outputHash: string };
    prepared.set(raw.caseId, { caseHash: raw.caseHash, outputHash: raw.outputHash });
  }
  return prepared;
}

function validateReview(
  review: ReviewImport,
  prepared: ReadonlyMap<string, { caseHash: string; outputHash: string }>,
): void {
  const reviewerIds = new Set(review.reviewers.map((item) => item.reviewerId));
  if (reviewerIds.size !== review.reviewers.length) throw new Error("Duplicate reviewerId.");
  const seenReviews = new Set<string>();
  for (const caseReview of review.caseReviews) {
    if (!reviewerIds.has(caseReview.reviewerId))
      throw new Error(`Unknown reviewer ${caseReview.reviewerId}.`);
    const expected = prepared.get(caseReview.caseId);
    if (!expected) throw new Error(`Unknown or unprepared case ${caseReview.caseId}.`);
    if (expected.caseHash !== caseReview.caseHash)
      throw new Error(`caseHash mismatch for ${caseReview.caseId}.`);
    if (expected.outputHash !== caseReview.outputHash)
      throw new Error(`outputHash mismatch for ${caseReview.caseId}.`);
    const key = `${caseReview.caseId}:${caseReview.reviewerId}`;
    if (seenReviews.has(key)) throw new Error(`Duplicate review for ${key}.`);
    seenReviews.add(key);
    for (const dimension of dimensions) {
      const score = caseReview.scores[dimension];
      if (score === undefined)
        throw new Error(`Missing score ${dimension} for ${caseReview.caseId}.`);
      const comment = caseReview.comments[dimension];
      if (typeof score === "number" && score < 3 && (!comment || comment.trim().length === 0)) {
        throw new Error(`Score below 3 requires comment: ${caseReview.caseId}/${dimension}.`);
      }
    }
    for (const finding of caseReview.findings) {
      if (finding.accepted === true && finding.rejected === true) {
        throw new Error(`Finding cannot be both accepted and rejected in ${caseReview.caseId}.`);
      }
    }
  }
}

function buildHumanValidationReport(
  review: ReviewImport,
  prepared: ReadonlyMap<string, { caseHash: string; outputHash: string }>,
  liveEvaluationCompleted: boolean,
): unknown {
  const criticalFindingsOpen = review.caseReviews.reduce(
    (count, item) =>
      count +
      item.findings.filter(
        (finding) => finding.severity === "critical" && finding.accepted !== false,
      ).length,
    0,
  );
  const reviewedCaseIds = new Set(review.caseReviews.map((item) => item.caseId));
  const qualifiedReviewers = review.reviewers.filter(
    (item) => item.qualification.trim().length > 0,
  ).length;
  const agreementByDimension = Object.fromEntries(
    dimensions.map((dimension) => [dimension, agreementForDimension(review, dimension)]),
  );
  return {
    generatedAt: new Date().toISOString(),
    status:
      reviewedCaseIds.size >= 5 && qualifiedReviewers >= 1 && criticalFindingsOpen === 0
        ? "human_review_imported"
        : "human_review_incomplete",
    humanReviewPrepared: true,
    humanReviewCompleted: reviewedCaseIds.size >= 5 && qualifiedReviewers >= 1,
    liveEvaluationCompleted,
    criticalFindingsOpen,
    calibrationCompleted: false,
    preparedCases: [...prepared.entries()].map(([caseId, hashes]) => ({ caseId, ...hashes })),
    reviewers: review.reviewers,
    caseReviews: review.caseReviews,
    adjudications: review.adjudications,
    summary: {
      reviewedCases: reviewedCaseIds.size,
      qualifiedReviewers,
      averageCriticalDimensionScore: averageScore(review, [
        "competence",
        "authority",
        "procedural_route",
        "deadlines",
        "adverse_case_law",
        "confidence",
        "traceability",
      ]),
      agreementByDimension,
      blockers: [
        ...(reviewedCaseIds.size < 5 ? ["minimum_five_cases_not_reviewed"] : []),
        ...(qualifiedReviewers < 1 ? ["qualified_reviewer_missing"] : []),
        ...(liveEvaluationCompleted ? [] : ["live_evaluation_missing"]),
        "calibration_not_completed",
        ...(criticalFindingsOpen > 0 ? ["critical_findings_open"] : []),
      ],
    },
  };
}

function agreementForDimension(
  review: ReviewImport,
  dimension: (typeof dimensions)[number],
): number | null {
  const byCase = new Map<string, unknown[]>();
  for (const caseReview of review.caseReviews) {
    const score = caseReview.scores[dimension];
    const values = byCase.get(caseReview.caseId) ?? [];
    values.push(score);
    byCase.set(caseReview.caseId, values);
  }
  const comparable = [...byCase.values()].filter((scores) => scores.length >= 2);
  if (comparable.length === 0) return null;
  const agreeing = comparable.filter((scores) => new Set(scores).size === 1).length;
  return Math.round((agreeing / comparable.length) * 100) / 100;
}

function averageScore(
  review: ReviewImport,
  selectedDimensions: readonly (typeof dimensions)[number][],
): number | null {
  const values = review.caseReviews.flatMap((caseReview) =>
    selectedDimensions.flatMap((dimension) => {
      const value = caseReview.scores[dimension];
      return typeof value === "number" ? [value] : [];
    }),
  );
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function renderHumanValidationMarkdown(report: unknown): string {
  const value = report as {
    status: string;
    summary: { reviewedCases: number; qualifiedReviewers: number; blockers: string[] };
    criticalFindingsOpen: number;
  };
  return [
    "# Human validation report",
    "",
    `Status: ${value.status}`,
    `Reviewed cases: ${value.summary.reviewedCases}`,
    `Qualified reviewers: ${value.summary.qualifiedReviewers}`,
    `Open critical findings: ${value.criticalFindingsOpen}`,
    `Blockers: ${value.summary.blockers.join(", ") || "none"}`,
    "",
  ].join("\n");
}

function parseArgs(argv: readonly string[]) {
  const importIndex = argv.indexOf("--import");
  return {
    prepare: argv.includes("--prepare") || argv.length === 0,
    importPath: importIndex >= 0 ? argv[importIndex + 1] : undefined,
  };
}

function formatGeneratedReviewArtifacts(): void {
  const files = [
    "artifacts/procedural-strategy-human-review",
    "docs/procedural-strategy/adjudication.md",
    "docs/procedural-strategy/calibration.md",
    "docs/procedural-strategy/human-review",
    "docs/procedural-strategy/human-validation-report.md",
    "docs/procedural-strategy/live-evaluation.md",
    "docs/procedural-strategy/reviewer-guide.md",
    "docs/procedural-strategy/reviewer-schema.md",
    "docs/release/generated/procedural-strategy-human-validation.json",
    "docs/release/generated/procedural-strategy-live-evaluation-plan.json",
  ];
  execFileSync(resolve(ROOT, "node_modules/.bin/prettier"), ["--write", ...files], {
    cwd: ROOT,
    stdio: "pipe",
  });
}

/* v8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const task = args.importPath
    ? importHumanReview(resolve(process.cwd(), args.importPath))
    : args.prepare
      ? prepareHumanReviewPackage()
      : Promise.reject(new Error("Use --prepare or --import <path>."));
  task
    .then(() =>
      console.log(args.importPath ? "Human review imported." : "Human review package prepared."),
    )
    .catch((caught: unknown) => {
      console.error(caught instanceof Error ? caught.message : String(caught));
      process.exitCode = 1;
    });
}
/* v8 ignore stop */
