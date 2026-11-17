import { describe, expect, it } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/registry.js";
import { computeDeadline, easterSunday, isInStillstand } from "../src/tools/deadlineEngine.js";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("easterSunday / isInStillstand", () => {
  it("calcula la Pascua gregoriana", () => {
    expect(easterSunday(2024).toISOString().slice(0, 10)).toBe("2024-03-31");
    expect(easterSunday(2025).toISOString().slice(0, 10)).toBe("2025-04-20");
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
    expect(easterSunday(2027).toISOString().slice(0, 10)).toBe("2027-03-28");
  });

  it.each([
    ["2026-03-28", false],
    ["2026-03-29", true],
    ["2026-04-12", true],
    ["2026-04-13", false],
    ["2026-07-14", false],
    ["2026-07-15", true],
    ["2026-08-15", true],
    ["2026-08-16", false],
    ["2026-12-17", false],
    ["2026-12-18", true],
    ["2027-01-02", true],
    ["2027-01-03", false],
  ])("suspension %s -> %s", (date, expected) => {
    expect(isInStillstand(d(date))).toBe(expected);
  });
});

describe("computeDeadline: reglas de computo", () => {
  it("Einsprache ATSG: el dia de la notificacion no cuenta; 30 dias", () => {
    const r = computeDeadline({
      ruleSet: "ATSG_EINSPRACHE",
      notificationDate: "2026-10-12",
      notificationProof: "proven",
    });
    expect(r.firstDay).toBe("2026-10-13");
    expect(r.deadlineDate).toBe("2026-11-11");
    expect(r.safeDate).toBe("2026-11-11");
    expect(r.status).toBe("computed");
    expect(r.legalBasis.join(" ")).toContain("Art. 52");
  });

  it("ultimo dia en domingo pasa al lunes", () => {
    const r = computeDeadline({
      ruleSet: "ATSG_EINSPRACHE",
      notificationDate: "2026-10-09",
      notificationProof: "proven",
    });
    expect(r.deadlineDate).toBe("2026-11-09");
    expect(r.steps.some((s) => s.step === "Vencimiento en dia inhabil")).toBe(true);
  });

  it("suspension de Pascua: los dias suspendidos no cuentan; fecha prudente = sin suspension", () => {
    const r = computeDeadline({
      ruleSet: "ATSG_EINSPRACHE",
      notificationDate: "2026-03-20",
      notificationProof: "proven",
    });
    expect(r.stillstandDaysSkipped).toBe(15);
    expect(r.deadlineDate).toBe("2026-05-04");
    expect(r.safeDate).toBe("2026-04-20");
    expect(r.status).toBe("conditional");
    expect(r.alternativeDates.map((a) => a.date)).toContain("2026-05-04");
  });

  it("suspension de verano en BGG y aviso de la excepcion de 10 dias", () => {
    const r = computeDeadline({
      ruleSet: "BGG_BESCHWERDE",
      notificationDate: "2026-07-01",
      notificationProof: "proven",
    });
    expect(r.stillstandDaysSkipped).toBe(32);
    expect(r.deadlineDate).toBe("2026-09-01");
    expect(r.safeDate).toBe("2026-07-31");
    expect(r.warnings.join(" ")).toContain("Art. 100 Abs. 2 BGG");
  });

  it("BGG con excepcion de 10 dias declarada", () => {
    const r = computeDeadline({
      ruleSet: "BGG_BESCHWERDE",
      notificationDate: "2026-10-12",
      notificationProof: "proven",
      bggTenDayException: true,
    });
    expect(r.durationDays).toBe(10);
    expect(r.deadlineDate).toBe("2026-10-22");
  });

  it("1 de agosto (Bundesfeiertag) se salta; sin suspension declarada", () => {
    const r = computeDeadline({
      ruleSet: "BGG_BESCHWERDE",
      notificationDate: "2025-07-02",
      notificationProof: "proven",
      bggTenDayException: false,
      stillstandExempt: true,
    });
    expect(r.deadlineDate).toBe("2025-08-04");
  });

  it("festivo aportado por el llamador se respeta", () => {
    const r = computeDeadline({
      ruleSet: "ATSG_EINSPRACHE",
      notificationDate: "2026-10-12",
      notificationProof: "proven",
      holidays: ["2026-11-11"],
    });
    expect(r.deadlineDate).toBe("2026-11-12");
  });

  it("ultimo dia en festivo cantonal comun: devuelve ambas fechas y pide confirmacion", () => {
    const r = computeDeadline({
      ruleSet: "ATSG_EINSPRACHE",
      notificationDate: "2026-04-14",
      notificationProof: "proven",
    });
    expect(r.deadlineDate).toBe("2026-05-14");
    expect(r.needsHolidayConfirmation).toBe(true);
    expect(r.alternativeDates.map((a) => a.date)).toContain("2026-05-15");
    expect(r.status).toBe("conditional");
    expect(r.safeDate).toBe("2026-05-14");
  });

  it("Rechtsvorschlag: sin suspension (fecha prudente) y alternativa solo si rigiera", () => {
    const r = computeDeadline({
      ruleSet: "SCHKG_RECHTSVORSCHLAG",
      notificationDate: "2026-07-10",
      notificationProof: "proven",
    });
    expect(r.durationDays).toBe(10);
    expect(r.deadlineDate).toBe("2026-07-20");
    expect(r.safeDate).toBe("2026-07-20");
    expect(r.alternativeDates.map((a) => a.date)).toContain("2026-08-21");
  });
});

describe("computeDeadline: seguridad (nunca una fecha segura sin base)", () => {
  it("sin notificacion -> not_verified y sin fecha", () => {
    const r = computeDeadline({ ruleSet: "ATSG_EINSPRACHE", notificationProof: "unknown" });
    expect(r.status).toBe("not_verified");
    expect(r.deadlineDate).toBeNull();
    expect(r.safeDate).toBeNull();
  });

  it("notificacion supuesta -> conditional con la suposicion explicitada", () => {
    const r = computeDeadline({
      ruleSet: "ATSG_BESCHWERDE",
      notificationDate: "2026-10-12",
      notificationProof: "assumed",
    });
    expect(r.status).toBe("conditional");
    expect(r.assumptions.join(" ")).toContain("SUPOSICION");
  });

  it("fechas invalidas -> not_verified", () => {
    expect(
      computeDeadline({
        ruleSet: "ATSG_EINSPRACHE",
        notificationDate: "2026-02-30",
        notificationProof: "proven",
      }).status,
    ).toBe("not_verified");
  });

  it("envio no retirado: usa la fecha mas temprana entre la aportada y la ficcion legal", () => {
    const r = computeDeadline({
      ruleSet: "ATSG_EINSPRACHE",
      notificationDate: "2026-10-20",
      firstDeliveryAttemptDate: "2026-10-01",
      notificationProof: "proven",
    });
    expect(r.notificationDateUsed).toBe("2026-10-08");
    const r2 = computeDeadline({
      ruleSet: "ATSG_EINSPRACHE",
      notificationDate: "2026-10-03",
      firstDeliveryAttemptDate: "2026-10-01",
      notificationProof: "proven",
    });
    expect(r2.notificationDateUsed).toBe("2026-10-03");
  });

  it("discrepancia con la Rechtsmittelbelehrung se avisa", () => {
    const r = computeDeadline({
      ruleSet: "ATSG_EINSPRACHE",
      notificationDate: "2026-10-12",
      notificationProof: "proven",
      statedDeadlineDays: 20,
    });
    expect(r.warnings.join(" ")).toContain("Rechtsmittelbelehrung indica 20");
  });

  it("siempre requiere revision humana", () => {
    expect(
      computeDeadline({
        ruleSet: "VWVG_BESCHWERDE",
        notificationDate: "2026-10-12",
        notificationProof: "proven",
      }).requiresHumanReview,
    ).toBe(true);
  });
});

describe("compute_legal_deadline via MCP", () => {
  it("esta registrada y devuelve el calculo estructurado", async () => {
    const { providers, legislationProviders, tools } = buildRegistries(
      loadEnv({ NODE_ENV: "test" }),
    );
    const server = createMcpServer({
      name: "t",
      version: "0.0.0",
      tools,
      providers,
      legislationProviders,
      logger: createLogger({ level: "silent" }),
    });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "c", version: "0.0.0" });
    await Promise.all([client.connect(ct), server.connect(st)]);
    expect((await client.listTools()).tools.map((t) => t.name)).toContain("compute_legal_deadline");
    const result = await client.callTool({
      name: "compute_legal_deadline",
      arguments: {
        ruleSet: "ATSG_EINSPRACHE",
        notificationDate: "2026-10-12",
        notificationProof: "proven",
      },
    });
    const out = result.structuredContent as { deadlineDate: string; status: string };
    expect(out.deadlineDate).toBe("2026-11-11");
    expect(out.status).toBe("computed");
  });
});
