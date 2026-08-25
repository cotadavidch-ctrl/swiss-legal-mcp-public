import { describe, expect, it } from "vitest";
import { extractEstvReference, parseGermanHumanDate } from "./referenceExtractor.js";

describe("extractEstvReference", () => {
  it("extrae el numero de circular real y la fecha de emision (Nr. 50a)", () => {
    const result = extractEstvReference(
      "Download Kreisschreiben Nr. 50a: Unzulässigkeit des steuerlichen Abzugs von Bestechungsgeldern",
      "Unzulässigkeit des steuerlichen Abzugs von Bestechungsgeldern vom 05.12.2023 (Direkte Bundessteuer)",
    );
    expect(result.circularNumber).toBe("50a");
    expect(result.issuedDate).toBe("2023-12-05");
  });

  it("deja los campos ausentes cuando el texto no sigue el patron esperado", () => {
    expect(extractEstvReference("Titulo generico sin numero")).toEqual({});
  });
});

describe("parseGermanHumanDate", () => {
  it("convierte una fecha humana alemana real a ISO", () => {
    expect(parseGermanHumanDate("5. Dezember 2023")).toBe("2023-12-05");
    expect(parseGermanHumanDate("10. Oktober 2023")).toBe("2023-10-10");
  });

  it("devuelve undefined para un texto que no es una fecha alemana reconocida", () => {
    expect(parseGermanHumanDate("PDF")).toBeUndefined();
  });
});
