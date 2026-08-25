import { describe, expect, it } from "vitest";
import { parseCitations } from "./parser.js";
import { normalizeCitation } from "./normalizer.js";

describe("normalizeCitation", () => {
  it("normaliza RS y SR al mismo numero (son el mismo acto en idiomas distintos)", () => {
    const [rs] = parseCitations("RS 220");
    const [sr] = parseCitations("SR 220");
    expect(normalizeCitation(rs!)).toBe("220");
    expect(normalizeCitation(sr!)).toBe(normalizeCitation(rs!));
  });

  it("normaliza BGE/ATF/DTF al prefijo canonico 'BGE' (coincide con entscheidsuche.ch)", () => {
    const [atf] = parseCitations("ATF 142 III 1");
    const [dtf] = parseCitations("DTF 142 III 1");
    const [bge] = parseCitations("BGE 142 III 1");
    expect(normalizeCitation(atf!)).toBe("BGE 142 III 1");
    expect(normalizeCitation(dtf!)).toBe(normalizeCitation(bge!));
  });

  it("normaliza un ECLI a mayusculas", () => {
    const [ecli] = parseCitations("ecli:ch:bger:2020:6b_1234_2019".toUpperCase());
    expect(normalizeCitation(ecli!)).toBe("ECLI:CH:BGER:2020:6B_1234_2019");
  });

  it("conserva el numero de expediente tal cual (ya canonico)", () => {
    const [caseNumber] = parseCitations("6B_1234/2025");
    expect(normalizeCitation(caseNumber!)).toBe("6B_1234/2025");
  });
});
