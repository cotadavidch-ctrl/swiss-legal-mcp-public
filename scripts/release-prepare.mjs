#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const outDir = path.join(root, "docs", "release", "generated");
fs.mkdirSync(outDir, { recursive: true });

// Se borra cualquier manifiesto previo ANTES de intentar nada: si este script
// falla en cualquier punto posterior (en particular, si pnpm pack --dry-run
// falla mas abajo), no debe quedar en disco un release-manifest.json de una
// corrida anterior que un lector desprevenido podria confundir con el
// resultado de ESTA ejecucion. Ausencia de manifiesto == release:prepare no
// completo -- release-check.mjs ya lo exige via requireFile().
const manifestPath = path.join(outDir, "release-manifest.json");
if (fs.existsSync(manifestPath)) fs.rmSync(manifestPath);

const reviewArtifacts = [
  "docs/procedural-strategy/adjudication.md",
  "docs/procedural-strategy/calibration.md",
  "docs/procedural-strategy/human-review/README.md",
  "docs/procedural-strategy/human-review/review-form-template.json",
  "docs/procedural-strategy/human-review/cases/cantonal-admin-controlled.json",
  "docs/procedural-strategy/human-review/cases/employment-controlled.json",
  "docs/procedural-strategy/human-review/cases/legal-aid-ar.json",
  "docs/procedural-strategy/human-review/cases/social-insurance-controlled.json",
  "docs/procedural-strategy/human-review/cases/uncertain-deadline-controlled.json",
  "docs/procedural-strategy/human-validation-report.md",
  "docs/procedural-strategy/live-evaluation.md",
  "docs/procedural-strategy/live-evaluation-report.md",
  "docs/procedural-strategy/reviewer-guide.md",
  "docs/procedural-strategy/reviewer-schema.md",
  "artifacts/procedural-strategy-human-review/README.md",
  "artifacts/procedural-strategy-human-review/cantonal-admin-controlled/case-input.json",
  "artifacts/procedural-strategy-human-review/cantonal-admin-controlled/confidence.json",
  "artifacts/procedural-strategy-human-review/cantonal-admin-controlled/instructions.md",
  "artifacts/procedural-strategy-human-review/cantonal-admin-controlled/reviewer-form.json",
  "artifacts/procedural-strategy-human-review/cantonal-admin-controlled/reviewer-form.md",
  "artifacts/procedural-strategy-human-review/cantonal-admin-controlled/source-list.json",
  "artifacts/procedural-strategy-human-review/cantonal-admin-controlled/system-output.json",
  "artifacts/procedural-strategy-human-review/cantonal-admin-controlled/traceability.json",
  "artifacts/procedural-strategy-human-review/employment-controlled/case-input.json",
  "artifacts/procedural-strategy-human-review/employment-controlled/confidence.json",
  "artifacts/procedural-strategy-human-review/employment-controlled/instructions.md",
  "artifacts/procedural-strategy-human-review/employment-controlled/reviewer-form.json",
  "artifacts/procedural-strategy-human-review/employment-controlled/reviewer-form.md",
  "artifacts/procedural-strategy-human-review/employment-controlled/source-list.json",
  "artifacts/procedural-strategy-human-review/employment-controlled/system-output.json",
  "artifacts/procedural-strategy-human-review/employment-controlled/traceability.json",
  "artifacts/procedural-strategy-human-review/legal-aid-ar/case-input.json",
  "artifacts/procedural-strategy-human-review/legal-aid-ar/confidence.json",
  "artifacts/procedural-strategy-human-review/legal-aid-ar/instructions.md",
  "artifacts/procedural-strategy-human-review/legal-aid-ar/reviewer-form.json",
  "artifacts/procedural-strategy-human-review/legal-aid-ar/reviewer-form.md",
  "artifacts/procedural-strategy-human-review/legal-aid-ar/source-list.json",
  "artifacts/procedural-strategy-human-review/legal-aid-ar/system-output.json",
  "artifacts/procedural-strategy-human-review/legal-aid-ar/traceability.json",
  "artifacts/procedural-strategy-human-review/social-insurance-controlled/case-input.json",
  "artifacts/procedural-strategy-human-review/social-insurance-controlled/confidence.json",
  "artifacts/procedural-strategy-human-review/social-insurance-controlled/instructions.md",
  "artifacts/procedural-strategy-human-review/social-insurance-controlled/reviewer-form.json",
  "artifacts/procedural-strategy-human-review/social-insurance-controlled/reviewer-form.md",
  "artifacts/procedural-strategy-human-review/social-insurance-controlled/source-list.json",
  "artifacts/procedural-strategy-human-review/social-insurance-controlled/system-output.json",
  "artifacts/procedural-strategy-human-review/social-insurance-controlled/traceability.json",
  "artifacts/procedural-strategy-human-review/uncertain-deadline-controlled/case-input.json",
  "artifacts/procedural-strategy-human-review/uncertain-deadline-controlled/confidence.json",
  "artifacts/procedural-strategy-human-review/uncertain-deadline-controlled/instructions.md",
  "artifacts/procedural-strategy-human-review/uncertain-deadline-controlled/reviewer-form.json",
  "artifacts/procedural-strategy-human-review/uncertain-deadline-controlled/reviewer-form.md",
  "artifacts/procedural-strategy-human-review/uncertain-deadline-controlled/source-list.json",
  "artifacts/procedural-strategy-human-review/uncertain-deadline-controlled/system-output.json",
  "artifacts/procedural-strategy-human-review/uncertain-deadline-controlled/traceability.json",
  "docs/release/generated/procedural-strategy-human-validation.json",
  "docs/release/generated/procedural-strategy-live-evaluation-plan.json",
  "docs/release/generated/procedural-strategy-live-evaluation.json",
].filter((file) => fs.existsSync(path.join(root, file)));

if (reviewArtifacts.length > 0) {
  execFileSync("pnpm", ["exec", "prettier", "--write", ...reviewArtifacts], {
    cwd: root,
    stdio: "pipe",
  });
}

const artifacts = [];
for (const file of [
  "api-inventory.json",
  "sbom.cdx.json",
  "pnpm-sbom.cdx.json",
  "license-inventory.json",
  "third-party-licenses.json",
  "build-hashes.json",
  "benchmark-baseline.json",
  "procedural-strategy-evaluation.json",
  "procedural-strategy-human-validation.json",
  "procedural-strategy-live-evaluation-plan.json",
  "procedural-strategy-live-evaluation.json",
  "legal-capability-live-check.json",
  "multirole-persistence-check.json",
  // final-legal-capability-gate.json is deliberately excluded here: it is
  // regenerated later by release:check (final-legal-capability-gate.mjs),
  // which writes its own .sha256 immediately after writing its own content
  // so the checksum always matches the file that actually shipped, instead
  // of being computed from the previous run's content before this script's
  // caller (release:prepare) is even done.
]) {
  const full = path.join(outDir, file);
  if (fs.existsSync(full)) artifacts.push(full);
}

for (const full of artifacts) {
  const bytes = fs.readFileSync(full);
  fs.writeFileSync(
    `${full}.sha256`,
    `${crypto.createHash("sha256").update(bytes).digest("hex")}  ${path.basename(full)}\n`,
  );
}

// Sin try/catch que silencie el fallo: si pnpm pack --dry-run falla, este
// script debe fallar tambien (exit code distinto de 0), con el error real
// visible en stderr -- nunca un manifiesto que afirme que todo salio bien.
// execFileSync captura stdout/stderr del hijo por defecto (stdio: "pipe",
// no hereda la terminal), asi que hay que volcarlos explicitamente antes de
// relanzar el error para que el fallo real de pnpm no quede invisible.
let packDryRun;
try {
  packDryRun = execFileSync("pnpm", ["pack", "--dry-run"], { cwd: root, encoding: "utf8" });
} catch (error) {
  console.error("release-prepare: pnpm pack --dry-run fallo.");
  if (error && typeof error === "object") {
    if ("stdout" in error && error.stdout) process.stderr.write(String(error.stdout));
    if ("stderr" in error && error.stderr) process.stderr.write(String(error.stderr));
  }
  console.error(
    "release-prepare: no se genera release-manifest.json -- release:prepare queda incompleto.",
  );
  throw error;
}

const manifest = {
  generatedAt: new Date().toISOString(),
  artifacts: artifacts.map((file) => path.relative(root, file)),
  checksums: artifacts.map((file) => `${path.relative(root, file)}.sha256`),
  packDryRun,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Release manifest written: ${path.relative(root, manifestPath)}`);
