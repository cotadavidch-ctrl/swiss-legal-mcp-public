#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const outDir = path.join(root, "docs", "release", "generated");
const artifactPath = path.join(outDir, "final-legal-capability-gate.json");
const blockers = [];
const warnings = [];
const live_failures = [];
const contradictions = [];
const untested_required_checks = [];

function readJson(file) {
  const full = path.join(outDir, file);
  if (!fs.existsSync(full)) {
    untested_required_checks.push(file);
    return null;
  }
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function requireCheck(condition, message) {
  if (!condition) blockers.push(message);
}

const legal = readJson("legal-capability-live-check.json");
const persistence = readJson("multirole-persistence-check.json");
const claude = readJson("claude-desktop-acceptance.json");
const release = readJson("release-gate-result.json");
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const autonomousPositivePass =
  legal?.checks?.autonomous_positive_live_case_pass === true &&
  legal?.checks?.omitted_ground_blocker_pass === true;

if (legal) {
  for (const [key, passed] of Object.entries(legal.checks ?? {})) {
    if (passed !== true) live_failures.push(key);
  }
  const officialCases = legal.officialCases ?? {};
  for (const [key, value] of Object.entries(officialCases)) {
    if (value?.network_transport !== "live_http" || value?.mock_or_fixture !== false) {
      live_failures.push(`${key}_not_live_official`);
    }
  }
  const adversarial = legal.adversarial?.passages?.[0];
  if (
    adversarial?.caller_asserted_importance === "decisive" &&
    adversarial?.verified_function === "obiter_dictum" &&
    adversarial?.autonomousGround === true
  ) {
    contradictions.push("obiter accepted as autonomous decisive ground");
  }
  const doctrineAccepted = (legal.officialCases?.case4a664?.independent_ground_details ?? []).some(
    (ground) => ground.doctrine_only === true && ground.autonomous === true,
  );
  if (doctrineAccepted) contradictions.push("doctrine_only accepted as autonomous");
  if ((legal.officialCases?.case4a664?.independent_grounds_count ?? 0) >= 3) {
    contradictions.push("4A_664/2024 still exposes three false autonomous grounds");
  }
}

if (persistence) {
  if (persistence.final_status !== "PASS") live_failures.push("multirole_restart_persistence");
  if (persistence.transport !== "stdio") blockers.push("multirole persistence did not use stdio");
  if (persistence.networkAllowedByScenario !== false) {
    blockers.push("multirole persistence scenario allowed network access");
  }
}

if (claude) {
  if (claude.finalStatus !== "PASS") blockers.push("Claude Desktop acceptance did not pass");
  if (claude.stdoutClean !== true) blockers.push("stdio stdout is not clean");
  if ((claude.fixtureToolsExposed ?? []).length > 0) blockers.push("fixture tools exposed");
}

if (release) {
  if (!["READY", "READY WITH WARNINGS"].includes(release.status)) {
    blockers.push(`release gate is ${release.status}`);
  }
  for (const warning of release.warnings ?? []) warnings.push(warning);
}

requireCheck(rootPkg.version === "1.0.0", `version is ${rootPkg.version}, expected 1.0.0`);
requireCheck(
  rootPkg.license === "Apache-2.0",
  `license is ${rootPkg.license}, expected Apache-2.0`,
);
requireCheck(rootPkg.private === true, "root package is not private");
requireCheck(!fs.existsSync(path.join(root, ".git")), "Git repository was initialized");

const capability_matrix = [
  {
    capability: "BGE published citation resolution",
    offline_tested: true,
    live_tested: legal?.checks?.bge_regression_pass === true,
    official_positive_case: "BGE 142 III 91; BGE 134 III 59",
    negative_case_validated: true,
    adversarial_test_passed: true,
    restart_validated: false,
    final_status: legal?.checks?.bge_regression_pass === true ? "VALIDATED" : "FAILED",
  },
  {
    capability: "ATF/DTF normalization",
    offline_tested: true,
    live_tested: legal?.checks?.bge_regression_pass === true,
    official_positive_case: "ATF 142 III 91; DTF 142 III 91",
    negative_case_validated: true,
    adversarial_test_passed: true,
    restart_validated: false,
    final_status: legal?.checks?.bge_regression_pass === true ? "VALIDATED" : "FAILED",
  },
  {
    capability: "obiter adversarial protection",
    offline_tested: true,
    live_tested: legal?.checks?.obiter_adversarial_pass === true,
    official_positive_case: "4C.4/2004",
    negative_case_validated: true,
    adversarial_test_passed: legal?.checks?.obiter_adversarial_pass === true,
    restart_validated: false,
    final_status: legal?.checks?.obiter_adversarial_pass === true ? "VALIDATED" : "FAILED",
  },
  {
    capability: "autonomous grounds detection",
    offline_tested: true,
    live_tested: autonomousPositivePass,
    official_positive_case: autonomousPositivePass
      ? (legal?.autonomousGrounds?.positive_case_reference ?? "2A.348/2004")
      : "REAL_AUTONOMOUS_GROUNDS_CASE_NOT_FOUND",
    negative_case_validated: legal?.checks?.doctrine_4a664_pass === true,
    adversarial_test_passed:
      legal?.checks?.doctrine_4a664_pass === true &&
      legal?.checks?.omitted_ground_blocker_pass === true,
    restart_validated: false,
    final_status:
      autonomousPositivePass && legal?.checks?.doctrine_4a664_pass === true
        ? "VALIDATED"
        : legal?.checks?.doctrine_4a664_pass === true
          ? "PARTIALLY_VALIDATED"
          : "FAILED",
  },
  {
    capability: "multirole restart persistence",
    offline_tested: true,
    live_tested: false,
    official_positive_case: "not_applicable",
    negative_case_validated: true,
    adversarial_test_passed: true,
    restart_validated: persistence?.final_status === "PASS",
    final_status: persistence?.final_status === "PASS" ? "VALIDATED" : "FAILED",
  },
  {
    capability: "narrative state consistency",
    offline_tested: true,
    live_tested: false,
    official_positive_case: "not_applicable",
    negative_case_validated: true,
    adversarial_test_passed: true,
    restart_validated: persistence?.final_status === "PASS",
    final_status:
      legal?.checks?.multirole_direct_pass === true && legal?.checks?.multirole_by_id_pass === true
        ? "VALIDATED"
        : "FAILED",
  },
];

for (const item of capability_matrix) {
  if (item.final_status === "FAILED" || item.final_status === "NOT_TESTED") {
    live_failures.push(`${item.capability}:${item.final_status}`);
  }
}

const final_status =
  blockers.length === 0 &&
  live_failures.length === 0 &&
  contradictions.length === 0 &&
  untested_required_checks.length === 0
    ? "PASS"
    : "FAIL";

const allLegalCapabilitiesFullyValidated = capability_matrix.every(
  (item) => item.final_status === "VALIDATED",
);

const report = {
  generatedAt: new Date().toISOString(),
  autonomous_grounds_positive_live_case: autonomousPositivePass ? "PASS" : "NOT_FOUND",
  omitted_ground_live_validation:
    legal?.checks?.omitted_ground_blocker_pass === true ? "PASS" : "NOT_TESTED",
  independent_ground_internal_consistency:
    legal?.checks?.autonomous_ground_internal_consistency_pass === true ? "PASS" : "FAIL",
  case_1B_62_2021_regression:
    legal?.checks?.case1b62_false_positive_rejected_pass === true ? "PASS" : "FAIL",
  autonomous_grounds_capability: autonomousPositivePass ? "VALIDATED" : "PARTIALLY_VALIDATED",
  all_legal_capabilities_fully_validated: allLegalCapabilitiesFullyValidated,
  blockers,
  warnings: [...new Set(warnings)],
  live_failures: [...new Set(live_failures)],
  contradictions,
  untested_required_checks,
  capability_matrix,
  final_status,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
// Hash is computed here, immediately after this script's own write, so the
// checksum always matches the content this run actually produced -- never
// a snapshot from a prior run captured earlier in the pipeline (see
// release-prepare.mjs, which deliberately excludes this file for the same
// reason).
fs.writeFileSync(
  `${artifactPath}.sha256`,
  `${crypto.createHash("sha256").update(fs.readFileSync(artifactPath)).digest("hex")}  ${path.basename(artifactPath)}\n`,
);
console.log(JSON.stringify(report, null, 2));
process.exit(final_status === "PASS" ? 0 : 1);
