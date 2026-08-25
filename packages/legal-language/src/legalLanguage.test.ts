import { describe, expect, it } from "vitest";
import type { ProvenanceRef } from "@swiss-legal-mcp/core";
import {
  expandLegalQuery,
  preserveOriginalQuote,
  renderLanguageAwareStyleInstruction,
  swissLegalTerminology,
} from "./legalLanguage.js";

const provenance: ProvenanceRef[] = [
  { type: "SYSTEM_DERIVATION", system_derivation_input_ids: ["phase-9-language-test"] },
];

describe("Phase 9 legal language", () => {
  it("G preserves German original and marks Spanish machine translation as non-official", () => {
    const translated = preserveOriginalQuote({
      passage_id: "passage-1",
      original_text: "Verfügung",
      original_language: "DE",
      translated_text: "decisión administrativa",
      target_language: "ES",
      translation_status: "MACHINE_TRANSLATED",
      translator_type: "MACHINE",
      provenance,
    });
    expect(translated.original_text).toBe("Verfügung");
    expect(translated.official_wording).toBe(false);
  });

  it("maps Swiss legal terminology without flattening distinct procedural concepts", () => {
    const appeal = swissLegalTerminology.find((item) => item.concept === "ADMINISTRATIVE_APPEAL");
    expect(appeal?.expressions.DE).toContain("Rekurs");
    expect(appeal?.distinction_note).toMatch(/distinct/);
  });

  it("supports cautious cross-language search expansion", () => {
    const expansion = expandLegalQuery({
      concept: "RIGHT_TO_BE_HEARD",
      source_language: "DE",
      target_languages: ["FR", "IT"],
      provenance,
    });
    expect(expansion.terms.map((term) => term.term)).toContain("droit d'être entendu");
    expect(expansion.warning).toMatch(/do not claim perfect semantic equivalence/);
  });

  it("renders language-aware drafting style separate from substantive logic", () => {
    expect(
      renderLanguageAwareStyleInstruction({ language: "FR", audience: "COURT" }).style,
    ).toMatch(/Swiss French/);
    expect(
      renderLanguageAwareStyleInstruction({ language: "ES", audience: "CLIENT" }).avoid,
    ).toContain("machine translation as official wording");
  });
});
