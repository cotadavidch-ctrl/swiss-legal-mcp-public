import { describe, expect, it } from "vitest";
import { classifyCitation, parseCitations } from "./parser.js";

describe("parseCitations", () => {
  it("reconoce un numero RS federal real (Code des obligations)", () => {
    const result = parseCitations("Selon RS 220, ...");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "systematic_number", systematicNumber: "220" });
  });

  it("reconoce un numero SR (forma alemana) con puntos reales", () => {
    const result = parseCitations("Nach Art. 41 OR (SR 220) ...");
    const systematic = result.find((c) => c.type === "systematic_number");
    expect(systematic?.systematicNumber).toBe("220");
  });

  it("reconoce un numero RS cantonal real punteado (Schwyz)", () => {
    const result = parseCitations("Verfassung des Kantons Schwyz, RS 100.100");
    expect(result[0]).toMatchObject({ type: "systematic_number", systematicNumber: "100.100" });
  });

  it("reconoce un articulo con parrafo y letra reales (frances)", () => {
    const result = parseCitations("l'art. 41 al. 2 let. a CO");
    const article = result.find((c) => c.type === "unresolvable");
    expect(article).toMatchObject({
      lawAbbreviation: "CO",
      location: { articleNumber: "41", paragraph: "2", letter: "a" },
    });
  });

  it("reconoce un articulo aleman real (Abs./lit.)", () => {
    const result = parseCitations("Art. 41 Abs. 2 lit. a OR");
    const article = result.find((c) => c.type === "unresolvable");
    expect(article).toMatchObject({
      lawAbbreviation: "OR",
      location: { articleNumber: "41", paragraph: "2", letter: "a" },
    });
  });

  it("reconoce una referencia ATF/BGE/DTF real", () => {
    const result = parseCitations("Voir ATF 142 III 1 pour le principe.");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "bge_atf_dtf",
      bgeReference: { volume: "142", chamber: "III", page: "1" },
    });
  });

  it("reconoce un numero de expediente federal real", () => {
    const result = parseCitations("Arrêt 6B_1234/2025 du Tribunal fédéral");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "case_number", caseNumber: "6B_1234/2025" });
  });

  it("reconoce un ECLI con formato valido", () => {
    const result = parseCitations("ECLI:CH:BGer:2020:6B_1234_2019");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "ecli", ecli: "ECLI:CH:BGer:2020:6B_1234_2019" });
  });

  it("reconoce multiples citas reales en el mismo texto sin solaparse", () => {
    const result = parseCitations(
      "Conformément à l'art. 41 CO (RS 220) et à l'ATF 142 III 1, le Tribunal fédéral a jugé dans 6B_1234/2025 que...",
    );
    const types = result.map((c) => c.type);
    expect(types).toContain("unresolvable");
    expect(types).toContain("systematic_number");
    expect(types).toContain("bge_atf_dtf");
    expect(types).toContain("case_number");
  });

  it("no reconoce nada en texto sin citas legales reales", () => {
    expect(parseCitations("Il fait beau aujourd'hui à Genève.")).toHaveLength(0);
  });

  it("no confunde los digitos de un ECLI con un articulo o numero RS", () => {
    const result = parseCitations("ECLI:CH:BGer:2020:6B_1234_2019");
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("ecli");
  });
});

describe("classifyCitation", () => {
  it("clasifica un fragmento RS aislado", () => {
    expect(classifyCitation("RS 220")).toBe("systematic_number");
  });

  it("clasifica un fragmento BGE aislado", () => {
    expect(classifyCitation("ATF 142 III 1")).toBe("bge_atf_dtf");
  });

  it("clasifica un fragmento de numero de expediente aislado", () => {
    expect(classifyCitation("6B_1234/2025")).toBe("case_number");
  });

  it("clasifica un fragmento ECLI aislado", () => {
    expect(classifyCitation("ECLI:CH:BGer:2020:6B_1234_2019")).toBe("ecli");
  });

  it("clasifica texto sin patron reconocido como unresolvable", () => {
    expect(classifyCitation("hola mundo")).toBe("unresolvable");
  });
});
