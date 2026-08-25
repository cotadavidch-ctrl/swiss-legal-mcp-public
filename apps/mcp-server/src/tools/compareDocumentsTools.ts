import { z } from "zod";
import type { ToolRegistry } from "@swiss-legal-mcp/core";
import { documentRefShape, resolveLegalDocument } from "./documentResolver.js";

const MAX_PARAGRAPHS = 2000;

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

interface ParagraphChange {
  readonly kind: "added" | "removed" | "unchanged";
  readonly text: string;
}

/** Diff de parrafos real basado en subsecuencia comun mas larga (LCS), deterministico. */
function diffParagraphs(before: readonly string[], after: readonly string[]): ParagraphChange[] {
  const n = before.length;
  const m = after.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        before[i] === after[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const changes: ParagraphChange[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      changes.push({ kind: "unchanged", text: before[i]! });
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      changes.push({ kind: "removed", text: before[i]! });
      i += 1;
    } else {
      changes.push({ kind: "added", text: after[j]! });
      j += 1;
    }
  }
  while (i < n) {
    changes.push({ kind: "removed", text: before[i]! });
    i += 1;
  }
  while (j < m) {
    changes.push({ kind: "added", text: after[j]! });
    j += 1;
  }
  return changes;
}

/**
 * Fase 6: compara el texto completo real de dos documentos ya identificados
 * (misma forma de referencia que extract_legal_passages). Diff real de
 * parrafos (LCS), nunca un resumen generado o una comparacion semantica --
 * `comparisonNature` siempre es 'paragraph_diff' aqui (distinto del
 * `compare_article_versions` de Fedlex, que usa comparacion estructural real
 * Akoma Ntoso eId por eId cuando ambas versiones tienen XML real). Si a
 * alguno de los dos documentos le falta texto completo real, devuelve
 * 'insufficient_source_text' en vez de una comparacion vacia.
 */
export function registerCompareDocumentsTools(tools: ToolRegistry): void {
  tools.register({
    name: "compare_legal_documents",
    description:
      "Compara el texto completo real de dos documentos (o dos articulos) ya identificados por documentId (misma referencia que extract_legal_passages: get_law, get_cantonal_law, get_case, get_official_document, o resultados de verify_legal_citation/search_across_sources). Calcula un diff real de parrafos (anadido/eliminado/sin cambios), nunca una comparacion semantica ni un resumen generado. Para comparar dos versiones fechadas del MISMO articulo federal con comparacion estructural Akoma Ntoso real, use compare_article_versions en su lugar (mas precisa cuando aplica).",
    inputSchema: {
      documentA: z.object(documentRefShape),
      documentB: z.object(documentRefShape),
    },
    requiredProviderIds: [],
    requireAnyProviderIds: ["fedlex", "entscheidsuche", "seco", "bsv", "estv"],
    handler: async (input, context) => {
      const [outcomeA, outcomeB] = await Promise.all([
        resolveLegalDocument(input.documentA, context),
        resolveLegalDocument(input.documentB, context),
      ]);

      const warnings: string[] = [];
      if (!outcomeA.ok || !outcomeB.ok) {
        return {
          status: "unsupported" as const,
          documentA: null,
          documentB: null,
          changes: [],
          warnings: [
            ...(!outcomeA.ok ? [`documentA: ${outcomeA.message}`] : []),
            ...(!outcomeB.ok ? [`documentB: ${outcomeB.message}`] : []),
          ],
        };
      }

      const docA = outcomeA.document;
      const docB = outcomeB.document;
      if (!docA.fullText || docA.contentNature !== "literal") {
        return {
          status: "insufficient_source_text" as const,
          documentA: { id: docA.id, title: docA.title },
          documentB: { id: docB.id, title: docB.title },
          changes: [],
          warnings: [`documentA ('${docA.id}') no tiene texto completo real disponible.`],
        };
      }
      if (!docB.fullText || docB.contentNature !== "literal") {
        return {
          status: "insufficient_source_text" as const,
          documentA: { id: docA.id, title: docA.title },
          documentB: { id: docB.id, title: docB.title },
          changes: [],
          warnings: [`documentB ('${docB.id}') no tiene texto completo real disponible.`],
        };
      }

      const paragraphsA = splitParagraphs(docA.fullText);
      const paragraphsB = splitParagraphs(docB.fullText);
      if (paragraphsA.length > MAX_PARAGRAPHS || paragraphsB.length > MAX_PARAGRAPHS) {
        return {
          status: "unsupported" as const,
          documentA: { id: docA.id, title: docA.title },
          documentB: { id: docB.id, title: docB.title },
          changes: [],
          warnings: [
            `Uno de los documentos supera ${MAX_PARAGRAPHS} parrafos reales -- comparacion omitida para evitar un calculo desproporcionado.`,
          ],
        };
      }

      const changes = diffParagraphs(paragraphsA, paragraphsB);
      const added = changes.filter((c) => c.kind === "added").length;
      const removed = changes.filter((c) => c.kind === "removed").length;
      const unchanged = changes.filter((c) => c.kind === "unchanged").length;

      return {
        status: "compared" as const,
        documentA: {
          id: docA.id,
          title: docA.title,
          officialSource: docA.provenance.officialSourceUrl ?? docA.provenance.sourceUrl,
          retrievedAt: docA.provenance.retrievedAt,
        },
        documentB: {
          id: docB.id,
          title: docB.title,
          officialSource: docB.provenance.officialSourceUrl ?? docB.provenance.sourceUrl,
          retrievedAt: docB.provenance.retrievedAt,
        },
        comparisonNature: "paragraph_diff" as const,
        summary: { added, removed, unchanged },
        changes,
        warnings,
      };
    },
  });
}
