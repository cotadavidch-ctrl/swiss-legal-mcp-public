import { describe, expect, it } from "vitest";
import { classifySecoDocumentType, extractSecoReference } from "./referenceExtractor.js";

describe("extractSecoReference", () => {
  it("extrae codigo de practica y fecha de vigencia alemana real (AVIG-Praxis KAE)", () => {
    const result = extractSecoReference(
      "Weisung AVIG KAE (Kurzarbeitsentschädigung) (AVIG-Praxis KAE) gültig ab 1.7.2026",
    );
    expect(result.referenceNumber).toBe("AVIG-Praxis KAE");
    expect(result.effectiveDate).toBe("2026-07-01");
  });

  it("extrae codigo de practica y fecha francesa real (Bulletin LACI RHT)", () => {
    const result = extractSecoReference(
      "Directive LACI RHT (Indemnité en cas de réduction de l'horaire de travail) (Bulletin LACI RHT) valable dès 1.7.2026",
    );
    expect(result.referenceNumber).toBe("Bulletin LACI RHT");
    expect(result.effectiveDate).toBe("2026-07-01");
  });

  it("no ignora el primer parentesis no relacionado con la practica", () => {
    const result = extractSecoReference("Weisung AVG öAV (AVG-Praxis öAV) gültig ab 1.7.2025");
    expect(result.referenceNumber).toBe("AVG-Praxis öAV");
  });

  it("usa el fallback numerado para Fachweisungen sin codigo de practica", () => {
    const result = extractSecoReference("Weisung 2024/02: Lohnträgerschaft und AHV-Status");
    expect(result.referenceNumber).toBe("2024/02");
    expect(result.effectiveDate).toBeUndefined();
  });

  it("deja los campos ausentes cuando el titulo no sigue ningun patron reconocido", () => {
    const result = extractSecoReference("Weisung über die Vergütung von AMM gültig ab 1.6.2026");
    expect(result.referenceNumber).toBeUndefined();
    expect(result.effectiveDate).toBe("2026-06-01");
  });

  it("usa el fallback 'Stand:' para guias sin 'gultig ab'", () => {
    const result = extractSecoReference(
      "Leitfaden zur Bearbeitung von Personendaten (Datenschutzleitfaden AVIG und AVG) 3. Auflage, Stand: 1.1.2026",
    );
    expect(result.referenceNumber).toBeUndefined();
    expect(result.effectiveDate).toBe("2026-01-01");
  });

  it("no inventa ningun campo cuando el titulo no contiene fecha ni codigo", () => {
    const result = extractSecoReference("Titulo generico sin patrones reconocidos");
    expect(result).toEqual({});
  });
});

describe("classifySecoDocumentType", () => {
  it("clasifica como 'practice' cuando hay codigo de practica real", () => {
    const reference = extractSecoReference("Weisung AVIG KAE (AVIG-Praxis KAE) gültig ab 1.7.2026");
    expect(
      classifySecoDocumentType("Weisung AVIG KAE (AVIG-Praxis KAE) gültig ab 1.7.2026", reference),
    ).toBe("practice");
  });

  it("clasifica como 'guidance' cuando el titulo es un Leitfaden/Guide", () => {
    const reference = extractSecoReference("Leitfaden zur Bearbeitung, Stand: 1.1.2026");
    expect(classifySecoDocumentType("Leitfaden zur Bearbeitung, Stand: 1.1.2026", reference)).toBe(
      "guidance",
    );
  });

  it("clasifica como 'directive' por defecto (traduccion honesta de Weisung)", () => {
    const reference = extractSecoReference("Weisung über die Vergütung von AMM gültig ab 1.6.2026");
    expect(
      classifySecoDocumentType("Weisung über die Vergütung von AMM gültig ab 1.6.2026", reference),
    ).toBe("directive");
  });
});
