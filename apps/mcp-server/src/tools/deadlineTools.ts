import { z } from "zod";
import type { ToolRegistry } from "@swiss-legal-mcp/core";
import { computeDeadline } from "./deadlineEngine.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD");

export function registerDeadlineTools(tools: ToolRegistry): void {
  tools.register({
    name: "compute_legal_deadline",
    description:
      "Calcula un plazo procesal federal suizo (Einsprache/Beschwerde ATSG, Beschwerde VwVG, Beschwerde BGG, Rechtsvorschlag SchKG, Berufung y Beschwerde ZPO incluido el sumario, Beschwerde, Berufung y Einsprache contra Strafbefehl StPO; la StPO no tiene suspension de plazos) a partir de la fecha de notificacion, con cada paso del computo y su base legal (Fedlex): el dia de la notificacion no cuenta, sabado/domingo/festivo pasa al siguiente dia habil, suspension de plazos (Pascua, 15.7-15.8, 18.12-2.1). Sin notificacion probada devuelve 'conditional' o 'not_verified', nunca una fecha segura. No inventa festivos cantonales: usa solo los aportados y avisa si el ultimo dia puede ser festivo en algun canton. Devuelve 'safeDate' (la fecha mas temprana plausible). Orientativo: la Rechtsmittelbelehrung del acto prevalece y requiere revision juridica humana.",
    inputSchema: {
      ruleSet: z.enum([
        "ATSG_EINSPRACHE",
        "ATSG_BESCHWERDE",
        "VWVG_BESCHWERDE",
        "BGG_BESCHWERDE",
        "SCHKG_RECHTSVORSCHLAG",
        "ZPO_BERUFUNG",
        "ZPO_BERUFUNG_SUMMARISCH",
        "ZPO_BERUFUNG_ANTWORT",
        "ZPO_BERUFUNG_ANTWORT_SUMMARISCH",
        "OR_MIETE_KUENDIGUNG_ANFECHTUNG",
        "ZPO_BESCHWERDE",
        "ZPO_BESCHWERDE_10TAGE",
        "STPO_BESCHWERDE",
        "STPO_BERUFUNG_ANMELDUNG",
        "STPO_BERUFUNG_ERKLAERUNG",
        "STPO_EINSPRACHE_STRAFBEFEHL",
      ]),
      notificationDate: isoDate.optional(),
      notificationProof: z.enum(["proven", "assumed", "unknown"]).default("unknown"),
      firstDeliveryAttemptDate: isoDate.optional(),
      holidays: z.array(isoDate).max(60).optional(),
      bggTenDayException: z.boolean().optional(),
      stillstandExempt: z.boolean().optional(),
      statedDeadlineDays: z.number().int().min(1).max(365).optional(),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) =>
      computeDeadline({
        ruleSet: input.ruleSet,
        notificationProof: input.notificationProof,
        ...(input.notificationDate ? { notificationDate: input.notificationDate } : {}),
        ...(input.firstDeliveryAttemptDate
          ? { firstDeliveryAttemptDate: input.firstDeliveryAttemptDate }
          : {}),
        ...(input.holidays ? { holidays: input.holidays } : {}),
        ...(input.bggTenDayException !== undefined
          ? { bggTenDayException: input.bggTenDayException }
          : {}),
        ...(input.stillstandExempt !== undefined
          ? { stillstandExempt: input.stillstandExempt }
          : {}),
        ...(input.statedDeadlineDays !== undefined
          ? { statedDeadlineDays: input.statedDeadlineDays }
          : {}),
      }),
  });
}
