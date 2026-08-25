import { z } from "zod";
import type { ToolContext, ToolRegistry } from "@swiss-legal-mcp/core";
import type { NormalizedDocument } from "@swiss-legal-mcp/documents";
import {
  normalizeCitation,
  parseCitations,
  resolveCitation,
  type ParsedCitation,
} from "@swiss-legal-mcp/citations";
import type { EntscheidsucheMcpProvider } from "@swiss-legal-mcp/provider-entscheidsuche";
import { resolveCantonalProvider } from "./cantonalTools.js";
import { makeCantonalCitationLookup, makeCaseLawCitationLookup } from "./citationSupport.js";

const languageSchema = z.enum(["de", "fr", "it"]);
const providerFamilySchema = z.enum([
  "fedlex",
  "cantonal",
  "entscheidsuche",
  "seco",
  "bsv",
  "estv",
]);

const documentRefShape = {
  provider: providerFamilySchema,
  documentId: z.string().min(1),
  canton: z.string().length(2).optional(),
  articleNumber: z.string().min(1).optional(),
  language: languageSchema.optional(),
};

const MAX_CITATIONS_RESOLVED = 20;

/**
 * Origen real de una relacion de cita, exigido explicitamente: nunca se
 * afirma que se aplico/siguio/rechazo juridicamente una cita, solo que se
 * detecto. `explicit_metadata` solo se usa si el propio documento trae
 * `articlesCited`/`decisionsCited` reales poblados (ningun proveedor
 * integrado los rellena hoy -- ver docs/provider-contracts/citation-resolution.md);
 * en la practica todo resultado actual es `text_extraction`.
 */
type CitationOrigin = "explicit_metadata" | "text_extraction";

interface DetectedCitation {
  readonly raw: string;
  readonly normalized: string;
  readonly type: string;
  readonly origin: CitationOrigin;
  readonly match: "exact" | "probable" | "ambiguous" | "not_found";
  readonly resolvedDocumentId?: string;
  readonly resolvedTitle?: string;
  readonly officialSource?: string;
  readonly warnings: readonly string[];
}

async function fetchSourceDocument(
  ref: {
    provider: string;
    documentId: string;
    canton?: string;
    articleNumber?: string;
    language?: string;
  },
  context: ToolContext,
): Promise<{ ok: true; document: NormalizedDocument } | { ok: false; message: string }> {
  try {
    if (ref.provider === "fedlex") {
      const fedlex = context.legislationProviders?.get("fedlex");
      if (!fedlex) return { ok: false, message: "Proveedor 'fedlex' no disponible." };
      const language = (ref.language as "de" | "fr" | "it" | undefined) ?? "de";
      const document = ref.articleNumber
        ? await fedlex.getArticle({
            lawRef: { eli: ref.documentId, language },
            articleNumber: ref.articleNumber,
          })
        : await fedlex.getLaw({ eli: ref.documentId, language });
      return { ok: true, document };
    }
    if (ref.provider === "cantonal") {
      if (!ref.canton)
        return { ok: false, message: "Se requiere 'canton' para un documento cantonal." };
      const resolved = resolveCantonalProvider(context.providers, ref.canton);
      if (ref.articleNumber && resolved.family === "lexwork") {
        const rawId = ref.documentId.includes(":")
          ? ref.documentId.split(":").slice(1).join(":")
          : ref.documentId;
        const document = await resolved.provider.getArticle(rawId, ref.articleNumber);
        return { ok: true, document };
      }
      const document = await resolved.provider.getDocument(ref.documentId);
      return { ok: true, document };
    }
    const provider = context.providers.get(ref.provider);
    if (!provider) return { ok: false, message: `Proveedor '${ref.provider}' no disponible.` };
    const document = await provider.getDocument(ref.documentId);
    return { ok: true, document };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

async function resolveDetectedCitations(
  citations: readonly ParsedCitation[],
  sourceDocument: NormalizedDocument,
  context: ToolContext,
): Promise<{ detected: DetectedCitation[]; truncated: boolean }> {
  const entscheidsuche = context.providers.get("entscheidsuche") as
    EntscheidsucheMcpProvider | undefined;
  const cantonHint =
    sourceDocument.jurisdiction.level === "cantonal"
      ? sourceDocument.jurisdiction.canton
      : undefined;

  const toResolve = citations.slice(0, MAX_CITATIONS_RESOLVED);
  const detected: DetectedCitation[] = [];
  for (const citation of toResolve) {
    const resolution = await resolveCitation(citation, {
      ...(context.legislationProviders
        ? { legislationProviders: context.legislationProviders }
        : {}),
      cantonalLookup: makeCantonalCitationLookup(context.providers),
      ...(entscheidsuche ? { caseLawLookup: makeCaseLawCitationLookup(entscheidsuche) } : {}),
      ...(cantonHint ? { cantonHint } : {}),
    });
    detected.push({
      raw: citation.raw,
      normalized: normalizeCitation(citation),
      type: citation.type,
      origin: "text_extraction",
      match: resolution.match,
      ...(resolution.document ? { resolvedDocumentId: resolution.document.id } : {}),
      ...(resolution.document ? { resolvedTitle: resolution.document.title } : {}),
      ...(resolution.document
        ? {
            officialSource:
              resolution.document.provenance.officialSourceUrl ??
              resolution.document.provenance.sourceUrl,
          }
        : {}),
      warnings: resolution.warnings,
    });
  }
  return { detected, truncated: citations.length > toResolve.length };
}

/**
 * Fase 6: detecta y resuelve las citas legales reales presentes en el texto
 * completo de un documento ya identificado. Nunca afirma que una cita fue
 * aplicada, seguida o rechazada juridicamente por el documento -- solo que
 * aparece literalmente en su texto (`origin: "text_extraction"`) y, cuando
 * es posible, a que documento real corresponde. Ver
 * docs/provider-contracts/citation-resolution.md para las limitaciones
 * (ningun proveedor integrado expone `articlesCited`/`decisionsCited`
 * estructurados hoy).
 */
export function registerCitationNetworkTools(tools: ToolRegistry): void {
  tools.register({
    name: "find_cited_sources",
    description:
      "Detecta las citas legales reales (RS/SR, BGE/ATF/DTF, numero de expediente, ECLI) presentes en el texto completo de un documento ya identificado (misma referencia que extract_legal_passages/compare_legal_documents), y las resuelve contra las fuentes reales integradas cuando es posible. Nunca afirma que una cita fue aplicada, seguida o rechazada juridicamente -- solo que se detecto en el texto (origin='text_extraction'; 'explicit_metadata' solo si el propio proveedor ya trae articlesCited/decisionsCited poblados, lo cual hoy no ocurre en ningun proveedor integrado). Si el documento no tiene texto completo real, devuelve 'insufficient_source_text' en vez de una lista vacia que parezca concluyente.",
    inputSchema: documentRefShape,
    requiredProviderIds: [],
    requireAnyProviderIds: ["fedlex", "entscheidsuche", "seco", "bsv", "estv"],
    handler: async (input, context) => {
      const outcome = await fetchSourceDocument(input, context);
      if (!outcome.ok) {
        return {
          status: "unsupported" as const,
          document: null,
          citations: [],
          warnings: [outcome.message],
        };
      }
      const doc = outcome.document;
      if (!doc.fullText || doc.contentNature !== "literal") {
        return {
          status: "insufficient_source_text" as const,
          document: { id: doc.id, title: doc.title },
          citations: [],
          warnings: [`El documento '${doc.id}' no tiene texto completo real disponible.`],
        };
      }

      const explicitFromMetadata: DetectedCitation[] = [
        ...(doc.articlesCited ?? []).map((raw) => ({
          raw,
          normalized: raw,
          type: "unresolvable" as const,
          origin: "explicit_metadata" as const,
          match: "not_found" as const,
          warnings: [
            "El proveedor declara este articulo citado en metadatos reales, pero no se resolvio contra ninguna fuente (fuera del alcance de esta fase).",
          ],
        })),
        ...(doc.decisionsCited ?? []).map((raw) => ({
          raw,
          normalized: raw,
          type: "unresolvable" as const,
          origin: "explicit_metadata" as const,
          match: "not_found" as const,
          warnings: [
            "El proveedor declara esta decision citada en metadatos reales, pero no se resolvio contra ninguna fuente (fuera del alcance de esta fase).",
          ],
        })),
      ];

      const parsed = parseCitations(doc.fullText);
      const warnings: string[] = [];
      if (parsed.length === 0 && explicitFromMetadata.length === 0) {
        return {
          status: "extracted" as const,
          document: { id: doc.id, title: doc.title },
          citations: [],
          warnings: ["No se reconocio ninguna cita legal real en el texto completo del documento."],
        };
      }

      const { detected, truncated } = await resolveDetectedCitations(parsed, doc, context);
      if (truncated) {
        warnings.push(
          `Se detectaron ${parsed.length} citas reales en el texto; solo se resolvieron las primeras ${MAX_CITATIONS_RESOLVED} para acotar el numero de consultas reales por llamada.`,
        );
      }

      return {
        status: "extracted" as const,
        document: { id: doc.id, title: doc.title },
        citations: [...explicitFromMetadata, ...detected],
        warnings,
      };
    },
  });

  const MAX_SEED_DOCUMENTS = 10;

  tools.register({
    name: "build_case_citation_network",
    description:
      "Construye una red de citas de un solo salto (nunca recursiva/multi-salto) a partir de un conjunto de documentos ya identificados (hasta 10 por llamada): para cada uno, detecta sus citas reales en el texto completo (misma logica que find_cited_sources) y las resuelve cuando es posible. Cada arista declara su origen ('text_extraction'; 'explicit_metadata' solo si el proveedor ya trae articlesCited/decisionsCited poblados) y nunca afirma que una cita fue aplicada, seguida o rechazada juridicamente -- solo que aparece en el texto. Si ningun documento semilla tiene texto completo real, devuelve 'insufficient_source_text' en vez de una red vacia que parezca concluyente.",
    inputSchema: {
      documents: z.array(z.object(documentRefShape)).min(1).max(MAX_SEED_DOCUMENTS),
    },
    requiredProviderIds: [],
    requireAnyProviderIds: ["fedlex", "entscheidsuche", "seco", "bsv", "estv"],
    handler: async (input, context) => {
      interface NetworkNode {
        readonly id: string;
        readonly title: string;
        readonly kind: "seed" | "cited";
        readonly officialSource?: string;
      }
      interface NetworkEdge {
        readonly from: string;
        readonly to: string;
        readonly citationRaw: string;
        readonly citationType: string;
        readonly origin: CitationOrigin;
        readonly match: "exact" | "probable" | "ambiguous" | "not_found";
        readonly warnings: readonly string[];
      }

      const nodes = new Map<string, NetworkNode>();
      const edges: NetworkEdge[] = [];
      const unresolvedSeeds: Array<{ documentId: string; reason: string }> = [];
      const warnings: string[] = [];

      for (const ref of input.documents) {
        const outcome = await fetchSourceDocument(ref, context);
        if (!outcome.ok) {
          unresolvedSeeds.push({ documentId: ref.documentId, reason: outcome.message });
          continue;
        }
        const doc = outcome.document;
        if (!doc.fullText || doc.contentNature !== "literal") {
          unresolvedSeeds.push({
            documentId: doc.id,
            reason: "El documento no tiene texto completo real disponible.",
          });
          continue;
        }

        nodes.set(doc.id, {
          id: doc.id,
          title: doc.title,
          kind: "seed",
          officialSource: doc.provenance.officialSourceUrl ?? doc.provenance.sourceUrl,
        });

        const parsed = parseCitations(doc.fullText);
        if (parsed.length === 0) continue;

        const { detected, truncated } = await resolveDetectedCitations(parsed, doc, context);
        if (truncated) {
          warnings.push(
            `'${doc.id}': se detectaron mas de ${MAX_CITATIONS_RESOLVED} citas reales; solo se resolvieron las primeras ${MAX_CITATIONS_RESOLVED}.`,
          );
        }
        for (const citation of detected) {
          const targetId = citation.resolvedDocumentId ?? `unresolved:${citation.normalized}`;
          if (!nodes.has(targetId)) {
            nodes.set(targetId, {
              id: targetId,
              title: citation.resolvedTitle ?? citation.raw,
              kind: "cited",
              ...(citation.officialSource ? { officialSource: citation.officialSource } : {}),
            });
          }
          edges.push({
            from: doc.id,
            to: targetId,
            citationRaw: citation.raw,
            citationType: citation.type,
            origin: citation.origin,
            match: citation.match,
            warnings: citation.warnings,
          });
        }
      }

      if (nodes.size === 0) {
        const allInsufficientText = unresolvedSeeds.every((s) =>
          s.reason.includes("texto completo real"),
        );
        return {
          status: allInsufficientText
            ? ("insufficient_source_text" as const)
            : ("unsupported" as const),
          nodes: [],
          edges: [],
          unresolvedSeeds,
          warnings,
        };
      }

      return {
        status: "built" as const,
        nodes: [...nodes.values()],
        edges,
        unresolvedSeeds,
        warnings,
      };
    },
  });
}
