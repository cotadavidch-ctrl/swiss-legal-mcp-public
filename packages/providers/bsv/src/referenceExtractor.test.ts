import { describe, expect, it } from "vitest";
import { extractBsvDates } from "./referenceExtractor.js";

describe("extractBsvDates", () => {
  it("extrae gultig ab y Stand del texto real del KSIR", () => {
    const result = extractBsvDates(
      "Kreisschreiben über Invalidität und Rente in der Invalidenversicherung (KSIR) (gültig ab 1.1.2022; Stand 1.1.2026)",
    );
    expect(result.effectiveDate).toBe("2022-01-01");
    expect(result.standDate).toBe("2026-01-01");
  });

  it("deja los campos ausentes si el texto no declara ninguna fecha", () => {
    expect(extractBsvDates("Texto sin fechas declaradas")).toEqual({});
  });

  it("extrae solo el campo presente cuando falta el otro", () => {
    expect(extractBsvDates("Documento gültig ab 1.3.2020")).toEqual({
      effectiveDate: "2020-03-01",
    });
    expect(extractBsvDates("Documento Stand 5.6.2021")).toEqual({ standDate: "2021-06-05" });
  });
});
