import { describe, expect, it } from "vitest";
import { analyzeCorpusStyle } from "../src/tools/corpusStyleAnalysis.js";

function judgment(n: number, opts: { formula?: boolean; outcome?: string; dispositive?: string }) {
  const formula =
    opts.formula === false
      ? "Die Parteien streiten über eine andere Frage und die Vorinstanz hat sie verneint."
      : "Das Bundesgericht legt seinem Urteil den Sachverhalt zugrunde, den die Vorinstanz festgestellt hat (Art. 105 Abs. 1 BGG).";
  return {
    caseNumber: `4A_${n}/2024`,
    text: `Bundesgericht\nBesetzung\nBundesrichter A.________\nGegenstand\nKaufvertrag\nSachverhalt:\nA. Im Jahr ${2000 + n} schlossen die Parteien einen Kaufvertrag.\nErwägungen:\n1. ${formula} Weitere Ausführungen zu Fall ${n} folgen hier ausführlich.\n${opts.dispositive ?? "Demnach erkennt das Bundesgericht:"}\n1. ${opts.outcome ?? "Die Beschwerde wird abgewiesen."}\nIm Namen der I. zivilrechtlichen Abteilung`,
  };
}

describe("analyzeCorpusStyle", () => {
  const docs = [
    judgment(1, {}),
    judgment(2, {}),
    judgment(3, {}),
    judgment(4, { formula: false, outcome: "Die Beschwerde wird gutgeheissen." }),
    judgment(5, {
      formula: false,
      outcome: "Auf die Beschwerde wird nicht eingetreten.",
      dispositive: "Demnach verfügt der Präsident:",
    }),
  ];

  it("cuenta las frases repetidas por sentencia, con ejemplos y sustituyendo los numeros por #", () => {
    const report = analyzeCorpusStyle(docs, { minShare: 0.5 });
    expect(report.documentsAnalyzed).toBe(5);
    const formula = report.recurringFormulas.find((f) => f.phrase.includes("legt seinem Urteil"));
    expect(formula).toBeDefined();
    expect(formula!.documents).toBe(3);
    expect(formula!.share).toBeCloseTo(0.6, 2);
    expect(formula!.phrase).toContain("Art. # Abs. # BGG");
    expect(formula!.exampleCases).toEqual(["4A_1/2024", "4A_2/2024", "4A_3/2024"]);
  });

  it("no cuenta dos veces una frase que se repite dentro de la misma sentencia", () => {
    const repeated = {
      caseNumber: "4A_9/2024",
      text: `Sachverhalt:\nA. Eins. Das Bundesgericht legt seinem Urteil den Sachverhalt zugrunde, den die Vorinstanz festgestellt hat. Das Bundesgericht legt seinem Urteil den Sachverhalt zugrunde, den die Vorinstanz festgestellt hat.\nDemnach erkennt das Bundesgericht:\nIm Namen der`,
    };
    const report = analyzeCorpusStyle([repeated, judgment(1, {})], { minShare: 0.5 });
    const formula = report.recurringFormulas.find((f) => f.phrase.includes("legt seinem Urteil"));
    expect(formula!.documents).toBe(2);
  });

  it("cuenta las formulas del dispositivo y de resultado", () => {
    const report = analyzeCorpusStyle(docs);
    const dispositive = Object.fromEntries(
      report.dispositiveFormulas.map((d) => [d.marker, d.documents]),
    );
    expect(dispositive["Demnach erkennt das Bundesgericht:"]).toBe(4);
    expect(dispositive["Demnach verfügt der Präsident / die Präsidentin"]).toBe(1);
    const outcomes = Object.fromEntries(report.outcomeFormulas.map((o) => [o.marker, o.documents]));
    expect(outcomes["Die Beschwerde wird abgewiesen"]).toBe(3);
    expect(outcomes["Die Beschwerde wird gutgeheissen"]).toBe(1);
    expect(outcomes["Auf die Beschwerde wird nicht eingetreten"]).toBe(1);
  });

  it("avisa de las limitaciones y de las muestras pequeñas", () => {
    const report = analyzeCorpusStyle(docs);
    expect(report.limitations.join(" ")).toContain("quien redacta");
    expect(report.limitations.join(" ")).toContain("Menos de 10 sentencias");
  });

  it("con una sola sentencia no inventa formulas recurrentes", () => {
    const report = analyzeCorpusStyle([judgment(1, {})]);
    expect(report.recurringFormulas).toEqual([]);
  });
});
