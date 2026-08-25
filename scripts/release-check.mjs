#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { checkBundleFreshness } from "./lib/bundle-freshness.mjs";

const root = process.cwd();
const outDir = path.join(root, "docs", "release", "generated");
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const blockers = [];
const warnings = [];
const validation = {
  automated_evaluation_complete: false,
  live_evaluation_prepared: false,
  live_evaluation_completed: false,
  human_review_prepared: false,
  human_review_completed: false,
  critical_findings_open: 0,
  privacy_findings_open: 0,
  calibration_completed: false,
};

function warn(message) {
  if (!warnings.includes(message)) warnings.push(message);
}

function requireFile(file, blocker = true) {
  if (!fs.existsSync(path.join(root, file))) {
    (blocker ? blockers : warnings).push(`Missing ${file}`);
  }
}

for (const file of [
  "dist/stdio.js",
  "docs/release/generated/api-inventory.json",
  "docs/release/generated/sbom.cdx.json",
  "docs/release/generated/license-inventory.json",
  "docs/release/generated/third-party-licenses.json",
  "docs/release/generated/build-hashes.json",
  "docs/release/generated/procedural-strategy-evaluation.json",
  "docs/release/generated/procedural-strategy-human-validation.json",
  "docs/release/generated/procedural-strategy-live-evaluation-plan.json",
  "docs/release/generated/claude-desktop-acceptance.json",
  "docs/release/generated/update-security-acceptance.json",
  "docs/release/generated/release-manifest.json",
  "docs/release/licensing.md",
  "LICENSE",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
  "CHANGELOG.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "SUPPORT.md",
]) {
  requireFile(file);
}

// Frescura del bundle distribuible: dist/stdio.js debe reflejar el estado
// ACTUAL de las fuentes, no un build antiguo dejado de una corrida anterior.
// Solo se ejecuta si dist/stdio.js existe (si falta, ya quedo registrado
// arriba como blocker por requireFile).
if (fs.existsSync(path.join(root, "dist", "stdio.js"))) {
  const freshness = checkBundleFreshness(root);
  if (!freshness.fresh) {
    blockers.push(freshness.reason);
  }
}

const claudeDesktopAcceptanceFile = path.join(outDir, "claude-desktop-acceptance.json");
if (fs.existsSync(claudeDesktopAcceptanceFile)) {
  const acceptance = JSON.parse(fs.readFileSync(claudeDesktopAcceptanceFile, "utf8"));
  if (acceptance.finalStatus !== "PASS") {
    blockers.push("Claude Desktop stdio acceptance did not pass.");
  }
  if (acceptance.command !== "/usr/local/bin/node") {
    blockers.push("Claude Desktop stdio acceptance did not use /usr/local/bin/node.");
  }
  if (acceptance.environment?.NODE_ENV !== "production") {
    blockers.push("Claude Desktop stdio acceptance did not run with NODE_ENV=production.");
  }
  if (Object.hasOwn(acceptance.environment ?? {}, "MCP_HTTP_BEARER_TOKEN")) {
    blockers.push("Claude Desktop stdio acceptance used an HTTP bearer token.");
  }
  if (acceptance.stdoutClean !== true) {
    blockers.push("Claude Desktop stdio stdout was not clean.");
  }
  if ((acceptance.fixtureToolsExposed ?? []).length > 0) {
    blockers.push("Claude Desktop stdio exposed fixture tools.");
  }
  if ((acceptance.toolsMissing ?? []).length > 0) {
    blockers.push(
      `Claude Desktop stdio is missing ${acceptance.toolsMissing.length} expected tool(s).`,
    );
  }
  const failedExecutions = (acceptance.executionTests ?? []).filter((item) => item.passed !== true);
  if (failedExecutions.length > 0) {
    blockers.push(`Claude Desktop stdio has ${failedExecutions.length} failed tool execution(s).`);
  }
}

if (rootPkg.license === "UNLICENSED") {
  blockers.push("Project license is UNLICENSED; external Release 1.0 cannot be declared.");
} else if (rootPkg.license !== "Apache-2.0") {
  blockers.push(`Project license is ${rootPkg.license}; expected Apache-2.0.`);
}

const licenseInventoryFile = path.join(outDir, "license-inventory.json");
if (fs.existsSync(licenseInventoryFile)) {
  const licenseInventory = JSON.parse(fs.readFileSync(licenseInventoryFile, "utf8"));
  const unknownBlockers = licenseInventory.summary?.thirdPartyUnknownBlockers ?? 0;
  const manualReviews = licenseInventory.summary?.manualReviewCount ?? 0;
  const internalNonApache = (licenseInventory.packages ?? []).filter(
    (item) =>
      ["project", "internal", "workspace_link"].includes(item.scope) &&
      item.license !== "Apache-2.0",
  );
  if (unknownBlockers > 0) {
    blockers.push(`${unknownBlockers} third-party packages have unknown license metadata.`);
  }
  if (internalNonApache.length > 0) {
    blockers.push(`${internalNonApache.length} internal package(s) are not licensed Apache-2.0.`);
  }
  if (manualReviews > 0) {
    warnings.push(`${manualReviews} dependency fixture package(s) require manual license review.`);
  }
}

for (const file of [
  "packages/shared/src/domainAllowlistResolver.test.ts",
  "packages/shared-web/src/secureHttpClient.test.ts",
  "packages/shared-web/src/pdfSecurity.test.ts",
  "packages/shared-web/src/rdfSecurity.test.ts",
  "packages/core/src/errors.test.ts",
  "packages/shared/src/metrics.test.ts",
  "packages/shared/src/logger.test.ts",
  "apps/mcp-server/tests/proceduralStrategyTools.test.ts",
  "apps/mcp-server/tests/procedural-strategy-eval.test.ts",
  "apps/mcp-server/tests/procedural-strategy-review.test.ts",
  "tests/fixtures/procedural-strategy/cases.json",
  "docs/procedural-strategy/evaluation-report.md",
  "docs/procedural-strategy/human-validation-report.md",
  "docs/procedural-strategy/human-review/README.md",
  "docs/procedural-strategy/reviewer-guide.md",
  "docs/procedural-strategy/reviewer-schema.md",
  "docs/procedural-strategy/live-evaluation.md",
  "docs/procedural-strategy/live-evaluation-report.md",
  "docs/procedural-strategy/adjudication.md",
  "docs/procedural-strategy/calibration.md",
  "docs/procedural-strategy/architecture.md",
  "docs/procedural-strategy/limitations.md",
  "artifacts/procedural-strategy-human-review/README.md",
  "packages/updater/src/updater.test.ts",
  "packages/updater/src/security.test.ts",
  "docs/updater/architecture.md",
  "docs/updater/manifest-format.md",
  "docs/updater/signing.md",
  "docs/updater/installation.md",
  "docs/updater/rollback.md",
  "docs/updater/channels.md",
  "docs/security/threat-model.md",
  "docs/security/data-classification.md",
  "docs/security/encryption-at-rest.md",
  "docs/security/encryption-in-transit.md",
  "docs/security/key-management.md",
  "docs/security/breach-detection.md",
  "docs/security/incident-response.md",
  "docs/security/prompt-injection.md",
  "docs/security/integrity.md",
  "docs/security/claude-desktop.md",
]) {
  requireFile(file);
}

const proceduralEvalFile = path.join(outDir, "procedural-strategy-evaluation.json");
if (fs.existsSync(proceduralEvalFile)) {
  const proceduralEval = JSON.parse(fs.readFileSync(proceduralEvalFile, "utf8"));
  if (proceduralEval.summary?.result !== "pass") {
    blockers.push("Procedural strategy evaluation did not pass.");
  } else {
    validation.automated_evaluation_complete = true;
  }
  if ((proceduralEval.summary?.criticalErrors ?? 0) > 0) {
    blockers.push(
      `${proceduralEval.summary.criticalErrors} critical procedural evaluation error(s).`,
    );
  }
  if ((proceduralEval.summary?.materialFabricatedFacts ?? 0) > 0) {
    blockers.push("Procedural evaluation detected material fabricated facts.");
  }
  if ((proceduralEval.summary?.inventedDeadlines ?? 0) > 0) {
    blockers.push("Procedural evaluation detected invented deadlines.");
  }
  if ((proceduralEval.summary?.inventedCaseLaw ?? 0) > 0) {
    blockers.push("Procedural evaluation detected invented case law.");
  }
  if ((proceduralEval.summary?.privacyLeaks ?? 0) > 0) {
    blockers.push("Procedural evaluation detected privacy leaks.");
  }
}

const livePlanFile = path.join(outDir, "procedural-strategy-live-evaluation-plan.json");
if (fs.existsSync(livePlanFile)) {
  const livePlan = JSON.parse(fs.readFileSync(livePlanFile, "utf8"));
  validation.live_evaluation_prepared = Array.isArray(livePlan.cases) && livePlan.cases.length > 0;
}

const liveEvaluationFile = path.join(outDir, "procedural-strategy-live-evaluation.json");
if (fs.existsSync(liveEvaluationFile)) {
  const liveEvaluation = JSON.parse(fs.readFileSync(liveEvaluationFile, "utf8"));
  validation.live_evaluation_completed = ["completed", "completed_with_limitations"].includes(
    liveEvaluation.status,
  );
  validation.privacy_findings_open = liveEvaluation.privacyValidation?.passed === false ? 1 : 0;
  if (liveEvaluation.status === "failed") {
    blockers.push("Procedural strategy live evaluation failed.");
  }
  if (validation.privacy_findings_open > 0) {
    blockers.push("Procedural strategy live evaluation detected privacy findings.");
  }
  if (liveEvaluation.status === "completed_with_limitations") {
    warn("Procedural strategy live evaluation completed with provider limitations.");
  }
}

const humanValidationFile = path.join(outDir, "procedural-strategy-human-validation.json");
if (fs.existsSync(humanValidationFile)) {
  const humanValidation = JSON.parse(fs.readFileSync(humanValidationFile, "utf8"));
  validation.human_review_prepared = humanValidation.humanReviewPrepared === true;
  validation.human_review_completed = humanValidation.humanReviewCompleted === true;
  validation.critical_findings_open = humanValidation.criticalFindingsOpen ?? 0;
  validation.calibration_completed = humanValidation.calibrationCompleted === true;
  if (humanValidation.humanReviewPrepared !== true) {
    warn("Procedural strategy human-review package is not prepared.");
  }
  if (humanValidation.humanReviewCompleted !== true) {
    warn("Procedural strategy qualified human legal review is not completed.");
  }
  if (humanValidation.calibrationCompleted !== true) {
    warn("Procedural strategy confidence calibration against human review is not completed.");
  }
  if ((humanValidation.criticalFindingsOpen ?? 0) > 0) {
    blockers.push(
      `${humanValidation.criticalFindingsOpen} critical human-review finding(s) remain open.`,
    );
  }
}

if (validation.live_evaluation_completed !== true) {
  warn("Procedural strategy live evaluation is not completed.");
}

const updateSecurityAcceptanceFile = path.join(outDir, "update-security-acceptance.json");
if (fs.existsSync(updateSecurityAcceptanceFile)) {
  const updateSecurity = JSON.parse(fs.readFileSync(updateSecurityAcceptanceFile, "utf8"));
  if (updateSecurity.status !== "PASS") {
    blockers.push("Updater/security release acceptance did not pass.");
  }
  if (updateSecurity.checks?.automaticUpdatesEnabled !== false) {
    blockers.push("Updater/security acceptance did not confirm automatic updates are disabled.");
  }
  if (updateSecurity.checks?.remoteTelemetryEnabled !== false) {
    blockers.push("Updater/security acceptance did not confirm remote telemetry is disabled.");
  }
}

if (rootPkg.version !== "1.0.0") {
  warnings.push(`Package version is ${rootPkg.version}; 1.0.0 not declared.`);
}

const status =
  blockers.length > 0 ? "BLOCKED" : warnings.length > 0 ? "READY WITH WARNINGS" : "READY";
const report = { generatedAt: new Date().toISOString(), status, blockers, warnings, validation };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "release-gate-result.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (status === "BLOCKED") process.exit(1);
