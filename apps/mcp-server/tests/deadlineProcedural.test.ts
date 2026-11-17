import { describe, expect, it } from "vitest";
import { computeDeadline } from "../src/tools/deadlineEngine.js";

// Fechas calculadas a mano con los textos de Fedlex leidos el 2026-11-12:
// ZPO 142/145/311/314/321, StPO 89/90/396/399.
describe("plazos ZPO y StPO", () => {
  it("StPO Beschwerde: 10 dias, sin suspension aunque sea julio (Art. 89 Abs. 2 StPO)", () => {
    const r = computeDeadline({
      ruleSet: "STPO_BESCHWERDE",
      notificationDate: "2026-07-10",
      notificationProof: "proven",
    });
    expect(r.durationDays).toBe(10);
    expect(r.firstDay).toBe("2026-07-11");
    expect(r.deadlineDate).toBe("2026-07-20");
    expect(r.safeDate).toBe("2026-07-20");
    expect(r.stillstandApplied).toBe(false);
    expect(r.status).toBe("computed");
  });

  it("StPO Berufungserklaerung: 20 dias desde la sentencia fundamentada, sin suspension de diciembre", () => {
    const r = computeDeadline({
      ruleSet: "STPO_BERUFUNG_ERKLAERUNG",
      notificationDate: "2026-12-10",
      notificationProof: "proven",
    });
    expect(r.deadlineDate).toBe("2026-12-30");
    expect(r.stillstandApplied).toBe(false);
  });

  it("StPO Anmeldung: sabado pasa al lunes y cita Art. 90 Abs. 2 StPO", () => {
    const r = computeDeadline({
      ruleSet: "STPO_BERUFUNG_ANMELDUNG",
      notificationDate: "2026-07-01",
      notificationProof: "proven",
    });
    expect(r.deadlineDate).toBe("2026-07-13");
    expect(r.legalBasis.join(" ")).toContain("Art. 399 Abs. 1 StPO");
  });

  it("ZPO Berufung: la suspension de verano aplica y la fecha prudente es anterior", () => {
    const r = computeDeadline({
      ruleSet: "ZPO_BERUFUNG",
      notificationDate: "2026-07-01",
      notificationProof: "proven",
    });
    expect(r.deadlineDate).toBe("2026-09-01");
    expect(r.safeDate).toBe("2026-07-31");
    expect(r.stillstandApplied).toBe(true);
    expect(r.status).toBe("conditional");
    expect(r.warnings.join(" ")).toContain("Art. 314");
  });

  it("ZPO Berufung sumaria: 10 dias sin suspension (Art. 145 Abs. 2 lit. b ZPO)", () => {
    const r = computeDeadline({
      ruleSet: "ZPO_BERUFUNG_SUMMARISCH",
      notificationDate: "2026-07-01",
      notificationProof: "proven",
    });
    expect(r.durationDays).toBe(10);
    expect(r.deadlineDate).toBe("2026-07-13");
    expect(r.stillstandApplied).toBe(false);
  });

  it("ZPO Beschwerde 10 dias con stillstandExempt: sin suspension", () => {
    const r = computeDeadline({
      ruleSet: "ZPO_BESCHWERDE_10TAGE",
      notificationDate: "2026-07-10",
      notificationProof: "proven",
      stillstandExempt: true,
    });
    expect(r.deadlineDate).toBe("2026-07-20");
    expect(r.stillstandApplied).toBe(false);
  });

  it("ZPO Beschwerde 10 dias sin declarar sumario: aplica suspension y avisa con fecha prudente", () => {
    const r = computeDeadline({
      ruleSet: "ZPO_BESCHWERDE_10TAGE",
      notificationDate: "2026-07-10",
      notificationProof: "proven",
    });
    expect(r.safeDate).toBe("2026-07-20");
    expect(r.deadlineDate).not.toBe("2026-07-20");
    expect(r.stillstandApplied).toBe(true);
  });

  it("StPO Einsprache contra Strafbefehl: 10 dias desde el dia siguiente, sin suspension", () => {
    const r = computeDeadline({
      ruleSet: "STPO_EINSPRACHE_STRAFBEFEHL",
      notificationDate: "2026-11-03",
      notificationProof: "proven",
    });
    expect(r.firstDay).toBe("2026-11-04");
    expect(r.deadlineDate).toBe("2026-11-13");
    expect(r.stillstandApplied).toBe(false);
    expect(r.legalBasis.join(" ")).toContain("Art. 354");
  });

  it("StPO Einsprache en julio no se suspende y el sabado pasa al lunes", () => {
    const r = computeDeadline({
      ruleSet: "STPO_EINSPRACHE_STRAFBEFEHL",
      notificationDate: "2026-07-01",
      notificationProof: "proven",
    });
    expect(r.deadlineDate).toBe("2026-07-13");
  });

  it("sin notificacion probada no hay plazo en ninguna regla nueva", () => {
    for (const ruleSet of [
      "ZPO_BERUFUNG",
      "ZPO_BESCHWERDE",
      "STPO_BESCHWERDE",
      "STPO_BERUFUNG_ERKLAERUNG",
    ] as const) {
      const r = computeDeadline({ ruleSet, notificationProof: "unknown" });
      expect(r.status).toBe("not_verified");
      expect(r.deadlineDate).toBeNull();
    }
  });
});
