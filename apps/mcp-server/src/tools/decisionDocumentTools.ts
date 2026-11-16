import { z } from "zod";
import type { ToolRegistry } from "@swiss-legal-mcp/core";
import { extractPdfText } from "@swiss-legal-mcp/shared-web";
import { analyzeDecisionText } from "./decisionDocumentAnalyzer.js";
import { computeDeadline, type DeadlineRuleSet } from "./deadlineEngine.js";

const MAX_TEXT_CHARS = 400_000;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD");

export function registerDecisionDocumentTools(tools: ToolRegistry): void {
  tools.register({
    name: "analyze_decision_document",
    description:
      "Analiza una resolucion o decision recibida (texto o PDF con capa de texto) en DE/FR/IT: tipo de acto, fechas con su cita literal y pagina, instruccion de recursos (Rechtsmittelbelehrung / voies de droit), plazo indicado y regla de plazo sugerida (ATSG, VwVG, BGG, SchKG). Si aporta la fecha de notificacion probada, calcula ademas el plazo con compute_legal_deadline. Extraccion heuristica y pasiva: nunca ejecuta contenido del documento, no deduce la fecha de notificacion (la fecha del documento no es la de notificacion) y marca cada dato con su evidencia. Requiere revision humana; no es asesoramiento juridico.",
    inputSchema: {
      text: z.string().min(20).max(MAX_TEXT_CHARS).optional(),
      pdfBase64: z
        .string()
        .min(100)
        .max(Math.ceil((MAX_PDF_BYTES * 4) / 3) + 8)
        .optional(),
      notificationDate: isoDate.optional(),
      notificationProof: z.enum(["proven", "assumed", "unknown"]).default("unknown"),
      ruleSetOverride: z
        .enum([
          "ATSG_EINSPRACHE",
          "ATSG_BESCHWERDE",
          "VWVG_BESCHWERDE",
          "BGG_BESCHWERDE",
          "SCHKG_RECHTSVORSCHLAG",
          "ZPO_BERUFUNG",
          "ZPO_BERUFUNG_SUMMARISCH",
          "ZPO_BESCHWERDE",
          "ZPO_BESCHWERDE_10TAGE",
          "STPO_BESCHWERDE",
          "STPO_BERUFUNG_ANMELDUNG",
          "STPO_BERUFUNG_ERKLAERUNG",
          "STPO_EINSPRACHE_STRAFBEFEHL",
        ])
        .optional(),
      holidays: z.array(isoDate).max(60).optional(),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => {
      if ((input.text === undefined) === (input.pdfBase64 === undefined)) {
        return {
          status: "invalid_input" as const,
          warnings: ["Indique exactamente uno de 'text' o 'pdfBase64'."],
        };
      }

      let text = input.text ?? "";
      let pageStarts: number[] = [];
      let pageCount: number | null = null;
      if (input.pdfBase64 !== undefined) {
        const bytes = Uint8Array.from(Buffer.from(input.pdfBase64, "base64"));
        if (bytes.byteLength === 0 || bytes.byteLength > MAX_PDF_BYTES) {
          return {
            status: "invalid_input" as const,
            warnings: [`El PDF debe pesar entre 1 byte y ${MAX_PDF_BYTES} bytes.`],
          };
        }
        const extracted = await extractPdfText(bytes);
        const parts: string[] = [];
        let offset = 0;
        for (const page of extracted.pages) {
          pageStarts.push(offset);
          parts.push(page.text);
          offset += page.text.length + 1;
        }
        text = parts.join("\n");
        pageCount = extracted.pageCount;
        if (text.trim().length < 20) pageStarts = [];
      }

      const analysis = analyzeDecisionText(text, pageStarts);

      const ruleSet: DeadlineRuleSet | null =
        input.ruleSetOverride ?? analysis.suggestedRuleSet.ruleSet;
      let deadline: ReturnType<typeof computeDeadline> | null = null;
      const notes: string[] = [];
      if (ruleSet && input.notificationDate && input.notificationProof !== "unknown") {
        deadline = computeDeadline({
          ruleSet,
          notificationDate: input.notificationDate,
          notificationProof: input.notificationProof,
          ...(input.holidays ? { holidays: input.holidays } : {}),
          ...(analysis.remedyInstruction.deadlineDays !== null
            ? { statedDeadlineDays: analysis.remedyInstruction.deadlineDays }
            : {}),
        });
        if (input.ruleSetOverride)
          notes.push("Regla de plazo fijada por el llamador (ruleSetOverride).");
      } else if (!ruleSet) {
        notes.push("Sin regla de plazo aplicable: no se calcula ningun plazo.");
      } else {
        notes.push(
          "Para calcular el plazo aporte notificationDate y notificationProof ('proven' o 'assumed').",
        );
      }

      return {
        status: "analyzed" as const,
        pageCount,
        textLength: text.length,
        analysis,
        deadline,
        notes,
      };
    },
  });
}
