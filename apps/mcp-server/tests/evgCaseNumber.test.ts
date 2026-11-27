import { describe, expect, it } from "vitest";
import { canonicalizeSwissCaseNumber } from "@swiss-legal-mcp/shared";
import { normalizeSwissCaseReference } from "../src/tools/officialSwissCaseResolver.js";

describe("expedientes del antiguo Tribunal Federal de Seguros (EVG)", () => {
  it.each([
    ["I 122/06", "I_122/06", 2006],
    ["U 122/06", "U_122/06", 2006],
    ["K 45/04", "K_45/04", 2004],
    ["C 12/98", "C_12/98", 1998],
    ["I_7/01", "I_7/01", 2001],
  ])("normaliza %s", (raw, normalized, year) => {
    const n = normalizeSwissCaseReference(raw);
    expect(n.normalized_reference).toBe(normalized);
    expect(n.citation_family).toBe("federal_case_number");
    expect(n.court_family).toBe("swiss_federal_supreme_court");
    expect(n.decision_year).toBe(year);
  });

  it("canoniza igual las dos grafias y no confunde con expedientes modernos", () => {
    expect(canonicalizeSwissCaseNumber("I 122/06")).toBe("I_122/06");
    expect(canonicalizeSwissCaseNumber("I_122/06")).toBe("I_122/06");
    expect(canonicalizeSwissCaseNumber("8C_62/2025")).toBe("8C_62/2025");
    expect(canonicalizeSwissCaseNumber("X 12/06")).toBeNull();
  });

  it("un expediente moderno sigue normalizandose como antes", () => {
    const n = normalizeSwissCaseReference("8C_62/2025");
    expect(n.normalized_reference).toBe("8C_62/2025");
    expect(n.decision_year).toBe(2025);
  });
});
