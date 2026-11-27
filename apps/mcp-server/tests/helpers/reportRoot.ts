import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Los informes de la evaluacion procesal se escriben en una carpeta temporal, no en el repositorio.
 * Debe importarse ANTES que los scripts, que leen la variable al cargarse.
 */
export const REPORT_ROOT = mkdtempSync(join(tmpdir(), "swiss-legal-reports-"));

for (const sub of [
  "docs/release/generated",
  "docs/procedural-strategy/human-review/cases",
  "artifacts/procedural-strategy-human-review",
]) {
  mkdirSync(join(REPORT_ROOT, sub), { recursive: true });
}
process.env["SWISS_LEGAL_REPORT_ROOT"] = REPORT_ROOT;
