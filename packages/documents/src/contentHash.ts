import { createHash } from "node:crypto";

/**
 * Hash determinista del contenido crudo de un documento, usado para
 * invalidacion de cache y para que verify_case_quote / verify_legal_citation
 * detecten citas alteradas o desactualizadas (ver docs/data-model.md).
 */
export function computeContentHash(rawContent: string): string {
  return `sha256:${createHash("sha256").update(rawContent, "utf8").digest("hex")}`;
}
