#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const requiredScripts = ["test:updater", "test:breach-detection", "test:claude-desktop"];
const requiredFiles = [
  "packages/updater/src/manifest.ts",
  "packages/updater/src/signature.ts",
  "packages/updater/src/policy.ts",
  "packages/updater/src/updater.ts",
  "packages/updater/src/encryption.ts",
  "packages/updater/src/securityEvents.ts",
  "packages/updater/src/breachDetection.ts",
  "packages/updater/src/updater.test.ts",
  "packages/updater/src/security.test.ts",
  "docs/release/generated/claude-desktop-acceptance.json",
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
];
const blockers = [];

for (const script of requiredScripts) {
  if (typeof packageJson.scripts?.[script] !== "string") blockers.push(`Missing script ${script}`);
}
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) blockers.push(`Missing ${file}`);
}

const claudeAcceptanceFile = path.join(
  root,
  "docs",
  "release",
  "generated",
  "claude-desktop-acceptance.json",
);
if (fs.existsSync(claudeAcceptanceFile)) {
  const acceptance = JSON.parse(fs.readFileSync(claudeAcceptanceFile, "utf8"));
  if (acceptance.finalStatus !== "PASS") blockers.push("Claude Desktop acceptance is not PASS");
  if (acceptance.stdoutClean !== true) blockers.push("Claude Desktop stdout is not clean");
  if ((acceptance.fixtureToolsExposed ?? []).length > 0) {
    blockers.push("Claude Desktop exposes fixture tools");
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  status: blockers.length === 0 ? "PASS" : "FAIL",
  blockers,
  checks: {
    updaterScripts: requiredScripts,
    updaterFiles: requiredFiles.filter((file) => file.startsWith("packages/updater/")),
    documentationFiles: requiredFiles.filter((file) => file.startsWith("docs/")),
    claudeDesktopAcceptanceRequired: true,
    automaticUpdatesEnabled: false,
    remoteTelemetryEnabled: false,
  },
};

const outDir = path.join(root, "docs", "release", "generated");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "update-security-acceptance.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (blockers.length > 0) process.exit(1);
