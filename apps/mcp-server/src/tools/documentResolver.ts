import { z } from "zod";
import { NotFoundError, type ToolContext } from "@swiss-legal-mcp/core";
import type { NormalizedDocument } from "@swiss-legal-mcp/documents";
import { resolveCantonalProvider } from "./cantonalTools.js";

export const legalDocumentLanguageSchema = z.enum(["de", "fr", "it"]);
export const legalDocumentProviderSchema = z.enum([
  "fedlex",
  "cantonal",
  "entscheidsuche",
  "seco",
  "bsv",
  "estv",
]);

export const documentRefShape = {
  provider: legalDocumentProviderSchema,
  documentId: z.string().min(1),
  canton: z.string().length(2).optional(),
  articleNumber: z.string().min(1).optional(),
  language: legalDocumentLanguageSchema.optional(),
};

export type DocumentRef = z.infer<z.ZodObject<typeof documentRefShape>>;

export type ResolveDocumentOutcome =
  | {
      readonly ok: true;
      readonly document: NormalizedDocument;
      readonly method: "structured_article" | "whole_document";
    }
  | { readonly ok: false; readonly message: string; readonly reason: "not_found" | "unsupported" };

/**
 * Internal resolver for Fase 6 document references. It is intentionally scoped
 * to MCP tool routing, not exported as a public package API.
 */
export async function resolveLegalDocument(
  ref: DocumentRef,
  context: ToolContext,
): Promise<ResolveDocumentOutcome> {
  try {
    if (ref.provider === "fedlex") {
      const fedlex = context.legislationProviders?.get("fedlex");
      if (!fedlex) {
        return {
          ok: false,
          message: "Proveedor 'fedlex' no disponible.",
          reason: "unsupported",
        };
      }
      const language = ref.language ?? "de";
      if (ref.articleNumber) {
        const document = await fedlex.getArticle({
          lawRef: { eli: ref.documentId, language },
          articleNumber: ref.articleNumber,
        });
        return { ok: true, document, method: "structured_article" };
      }
      const document = await fedlex.getLaw({ eli: ref.documentId, language });
      return { ok: true, document, method: "whole_document" };
    }

    if (ref.provider === "cantonal") {
      if (!ref.canton) {
        return {
          ok: false,
          message: "Se requiere 'canton' para un documento cantonal.",
          reason: "unsupported",
        };
      }
      const resolved = resolveCantonalProvider(context.providers, ref.canton);
      if (ref.articleNumber) {
        if (resolved.family !== "lexwork") {
          return {
            ok: false,
            message: `El canton '${ref.canton.toUpperCase()}' no soporta extraccion estructurada de articulo.`,
            reason: "unsupported",
          };
        }
        const rawId = ref.documentId.includes(":")
          ? ref.documentId.split(":").slice(1).join(":")
          : ref.documentId;
        const document = await resolved.provider.getArticle(rawId, ref.articleNumber);
        return { ok: true, document, method: "structured_article" };
      }
      const document = await resolved.provider.getDocument(ref.documentId);
      return { ok: true, document, method: "whole_document" };
    }

    const provider = context.providers.get(ref.provider);
    if (!provider) {
      return {
        ok: false,
        message: `Proveedor '${ref.provider}' no disponible.`,
        reason: "unsupported",
      };
    }
    if (ref.articleNumber) {
      return {
        ok: false,
        message: `'${ref.provider}' no expone estructura de articulo real.`,
        reason: "unsupported",
      };
    }
    const document = await provider.getDocument(ref.documentId);
    return { ok: true, document, method: "whole_document" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      reason: error instanceof NotFoundError ? "not_found" : "unsupported",
    };
  }
}
