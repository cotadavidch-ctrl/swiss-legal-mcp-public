import { describe, expect, it } from "vitest";
import { computeDeadline, type DeadlineRuleSet } from "../src/tools/deadlineEngine.js";

/**
 * Casos con fechas calculadas a mano contra el calendario de 2026 (Pascua: 5 de abril),
 * independientes del motor. Cubren los conjuntos de reglas que usan las skills de los plugins.
 */
const cases: Array<{
  name: string;
  ruleSet: DeadlineRuleSet;
  notificationDate: string;
  expected: string;
  stillstandExempt?: boolean;
  stillstandApplied?: boolean;
}> = [
  {
    name: "Berufung civil notificada en verano (ordinario): suspension 15.7-15.8",
    ruleSet: "ZPO_BERUFUNG",
    notificationDate: "2026-07-20",
    expected: "2026-09-14",
    stillstandExempt: false,
    stillstandApplied: true,
  },
  {
    name: "Berufungsantwort notificada en verano (ordinario)",
    ruleSet: "ZPO_BERUFUNG_ANTWORT",
    notificationDate: "2026-07-20",
    expected: "2026-09-14",
    stillstandExempt: false,
    stillstandApplied: true,
  },
  {
    name: "Berufung en familia sumaria (Art. 314 Abs. 2 ZPO): 30 dias sin suspension de verano",
    ruleSet: "ZPO_BERUFUNG",
    notificationDate: "2026-07-20",
    expected: "2026-08-19",
    stillstandExempt: true,
    stillstandApplied: false,
  },
  {
    name: "Respuesta a la Berufung en familia sumaria: 30 dias sin suspension",
    ruleSet: "ZPO_BERUFUNG_ANTWORT",
    notificationDate: "2026-07-20",
    expected: "2026-08-19",
    stillstandExempt: true,
    stillstandApplied: false,
  },
  {
    name: "ATSG Einsprache con suspension de Pascua (29.3-12.4)",
    ruleSet: "ATSG_EINSPRACHE",
    notificationDate: "2026-03-02",
    expected: "2026-04-16",
    stillstandApplied: true,
  },
  {
    name: "SchKG Rechtsvorschlag: el decimo dia es domingo y pasa al lunes",
    ruleSet: "SCHKG_RECHTSVORSCHLAG",
    notificationDate: "2026-11-12",
    expected: "2026-11-23",
    stillstandApplied: false,
  },
  {
    name: "StPO Strafbefehl notificado en diciembre: sin suspension",
    ruleSet: "STPO_EINSPRACHE_STRAFBEFEHL",
    notificationDate: "2026-12-18",
    expected: "2026-12-28",
    stillstandApplied: false,
  },
  {
    name: "BGG notificado en junio: vence antes de la suspension de verano",
    ruleSet: "BGG_BESCHWERDE",
    notificationDate: "2026-06-10",
    expected: "2026-07-10",
    stillstandApplied: false,
  },
  {
    name: "BGG notificado el 1 de julio: la suspension de verano alarga el plazo",
    ruleSet: "BGG_BESCHWERDE",
    notificationDate: "2026-07-01",
    expected: "2026-09-01",
    stillstandApplied: true,
  },
  {
    name: "Impugnacion del despido de alquiler: 30 dias desde la recepcion",
    ruleSet: "OR_MIETE_KUENDIGUNG_ANFECHTUNG",
    notificationDate: "2026-11-02",
    expected: "2026-12-02",
    stillstandApplied: false,
  },
  {
    name: "VwVG notificado en diciembre: suspension 18.12-2.1",
    ruleSet: "VWVG_BESCHWERDE",
    notificationDate: "2026-12-10",
    expected: "2027-01-25",
    stillstandApplied: true,
  },
];

describe("plazos de las skills: escenarios calculados a mano", () => {
  it.each(cases)("$name", (c) => {
    const result = computeDeadline({
      ruleSet: c.ruleSet,
      notificationDate: c.notificationDate,
      notificationProof: "proven",
      ...(c.stillstandExempt !== undefined ? { stillstandExempt: c.stillstandExempt } : {}),
    });
    expect(result.deadlineDate).toBe(c.expected);
    if (c.stillstandApplied !== undefined) {
      expect(result.stillstandApplied).toBe(c.stillstandApplied);
    }
  });

  it("sin fecha de notificacion no se calcula ningun plazo", () => {
    const result = computeDeadline({ ruleSet: "ZPO_BERUFUNG", notificationProof: "unknown" });
    expect(result.status).toBe("not_verified");
    expect(result.deadlineDate).toBeNull();
  });

  it("notificacion solo supuesta: el resultado queda condicional", () => {
    const result = computeDeadline({
      ruleSet: "ZPO_BERUFUNG",
      notificationDate: "2026-07-20",
      notificationProof: "assumed",
      stillstandExempt: false,
    });
    expect(result.status).toBe("conditional");
  });
});
