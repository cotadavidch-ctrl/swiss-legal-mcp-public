import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  importHumanReview,
  prepareHumanReviewPackage,
} from "../scripts/procedural-strategy-review.js";

async function writeReview(payload: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "swiss-legal-review-"));
  const file = join(dir, "review.json");
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

async function baseReviewPayload() {
  const cases = await Promise.all(
    [
      "legal-aid-ar",
      "cantonal-admin-controlled",
      "social-insurance-controlled",
      "employment-controlled",
      "uncertain-deadline-controlled",
    ].map(async (caseId) => {
      const prepared = JSON.parse(
        await readFile(`docs/procedural-strategy/human-review/cases/${caseId}.json`, "utf8"),
      ) as { caseId: string; caseHash: string; outputHash: string };
      return prepared;
    }),
  );
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
  return {
    schemaVersion: 1,
    systemVersion: "1.0.0",
    reviewers: [
      {
        reviewerId: "reviewer-alpha",
        qualification: "Swiss qualified legal reviewer",
        jurisdictions: ["CH"],
        experience: "Civil and administrative litigation review",
        conflictOfInterest: "none_declared",
      },
    ],
    caseReviews: cases.map((item) => ({
      caseId: item.caseId,
      reviewerId: "reviewer-alpha",
      reviewDate: "2026-08-03",
      caseHash: item.caseHash,
      outputHash: item.outputHash,
      scores: Object.fromEntries(dimensions.map((dimension) => [dimension, 3])),
      comments: Object.fromEntries(dimensions.map((dimension) => [dimension, ""])),
      findings: [],
      overallAssessment: "accepted",
    })),
    adjudications: [],
  };
}

describe("procedural-strategy human review package", () => {
  beforeAll(async () => {
    await prepareHumanReviewPackage();
  }, 30000);

  afterAll(async () => {
    await prepareHumanReviewPackage();
  }, 30000);

  it("prepares five review cases without importing fake reviews", async () => {
    const report = JSON.parse(
      await readFile("docs/release/generated/procedural-strategy-human-validation.json", "utf8"),
    ) as {
      humanReviewPrepared: boolean;
      humanReviewCompleted: boolean;
      preparedCases: unknown[];
    };

    expect(report.humanReviewPrepared).toBe(true);
    expect(report.humanReviewCompleted).toBe(false);
    expect(report.preparedCases).toHaveLength(5);
  });

  it("prepares an exportable per-case package without golden labels", async () => {
    const caseDir = "artifacts/procedural-strategy-human-review/legal-aid-ar";
    await expect(stat(`${caseDir}/case-input.json`)).resolves.toBeDefined();
    await expect(stat(`${caseDir}/system-output.json`)).resolves.toBeDefined();
    await expect(stat(`${caseDir}/source-list.json`)).resolves.toBeDefined();
    await expect(stat(`${caseDir}/traceability.json`)).resolves.toBeDefined();
    await expect(stat(`${caseDir}/confidence.json`)).resolves.toBeDefined();
    await expect(stat(`${caseDir}/reviewer-form.json`)).resolves.toBeDefined();
    await expect(stat(`${caseDir}/reviewer-form.md`)).resolves.toBeDefined();
    await expect(stat(`${caseDir}/instructions.md`)).resolves.toBeDefined();

    const serialized = await readFile(`${caseDir}/reviewer-form.json`, "utf8");
    expect(serialized).not.toContain("golden");
    expect(serialized).not.toContain("expectedRouteIncludes");
  });

  it("prepares anonymized live-evaluation queries without executing live search", async () => {
    const planText = await readFile(
      "docs/release/generated/procedural-strategy-live-evaluation-plan.json",
      "utf8",
    );
    const plan = JSON.parse(planText) as { status: string; liveEvaluationCompleted: boolean };

    expect(plan.status).toBe("planned_not_executed");
    expect(plan.liveEvaluationCompleted).toBe(false);
    expect(planText).not.toMatch(/\bCH\d{2}[A-Z0-9]{12,}\b/i);
    expect(planText).not.toMatch(/\b\d{2}-\d{3,}-\d\b/);
    expect(planText).not.toContain("named bank");
    expect(planText).not.toContain("private financial");
  });

  it("imports a valid human review file", async () => {
    const file = await writeReview(await baseReviewPayload());

    await expect(importHumanReview(file)).resolves.toBeUndefined();
  });

  it("rejects a hash mismatch", async () => {
    const payload = await baseReviewPayload();
    payload.caseReviews[0]!.caseHash = "a".repeat(64);
    const file = await writeReview(payload);

    await expect(importHumanReview(file)).rejects.toThrow("caseHash mismatch");
  });

  it("rejects duplicate reviewers", async () => {
    const payload = await baseReviewPayload();
    payload.reviewers.push({ ...payload.reviewers[0]! });
    const file = await writeReview(payload);

    await expect(importHumanReview(file)).rejects.toThrow("Duplicate reviewerId");
  });

  it("rejects an unknown case", async () => {
    const payload = await baseReviewPayload();
    payload.caseReviews[0]!.caseId = "unknown-case";
    const file = await writeReview(payload);

    await expect(importHumanReview(file)).rejects.toThrow("Unknown or unprepared case");
  });

  it("rejects a version conflict", async () => {
    const payload = await baseReviewPayload();
    payload.systemVersion = "0.9.0";
    const file = await writeReview(payload);

    await expect(importHumanReview(file)).rejects.toThrow();
  });

  it("rejects a score outside the allowed range", async () => {
    const payload = await baseReviewPayload();
    payload.caseReviews[0]!.scores.confidence = 5;
    const file = await writeReview(payload);

    await expect(importHumanReview(file)).rejects.toThrow();
  });

  it("rejects an incomplete review", async () => {
    const payload = await baseReviewPayload();
    delete payload.caseReviews[0]!.scores.traceability;
    const file = await writeReview(payload);

    await expect(importHumanReview(file)).rejects.toThrow(/Invalid input|Missing score/);
  });

  it("requires comments for scores below three", async () => {
    const payload = await baseReviewPayload();
    payload.caseReviews[0]!.scores.competence = 2;
    payload.caseReviews[0]!.comments.competence = "";
    const file = await writeReview(payload);

    await expect(importHumanReview(file)).rejects.toThrow("Score below 3 requires comment");
  });

  it("imports critical findings but keeps them open in the generated report", async () => {
    const payload = await baseReviewPayload();
    payload.caseReviews[0]!.findings.push({
      dimension: "adverse_case_law",
      severity: "critical",
      description: "Missed adverse authority.",
      recommendedCorrection: "Add a general adverse-authority check.",
    });
    const file = await writeReview(payload);

    await expect(importHumanReview(file)).resolves.toBeUndefined();
    const report = JSON.parse(
      await readFile("docs/release/generated/procedural-strategy-human-validation.json", "utf8"),
    ) as { criticalFindingsOpen: number; status: string };
    expect(report.criticalFindingsOpen).toBe(1);
    expect(report.status).toBe("human_review_incomplete");
  });
});
