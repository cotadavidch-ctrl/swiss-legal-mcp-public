import { z } from "zod";
import type { ToolRegistry } from "@swiss-legal-mcp/core";
import type { NormalizedDocument } from "@swiss-legal-mcp/documents";
import {
  legalDocumentLanguageSchema,
  legalDocumentProviderSchema,
  resolveLegalDocument,
} from "./documentResolver.js";

const CONTEXT_WINDOW_CHARS = 400;

interface PassageResult {
  readonly status: "extracted" | "not_found_in_text" | "insufficient_source_text" | "unsupported";
  readonly extractionMethod?: "structured_article" | "text_search_heuristic";
  readonly confidence?: "exact" | "probable";
  readonly documentId?: string;
  readonly title?: string;
  readonly passage?: string;
  readonly officialSource?: string;
  readonly retrievedAt?: string;
  readonly warnings: readonly string[];
}

function textSearchExtract(doc: NormalizedDocument, searchTerm: string): PassageResult {
  if (!doc.fullText || doc.contentNature !== "literal") {
    return {
      status: "insufficient_source_text",
      warnings: [
        `El documento '${doc.id}' no tiene texto completo real disponible (contentNature='${doc.contentNature}') -- no se puede buscar un pasaje dentro de el.`,
      ],
    };
  }
  const haystack = doc.fullText;
  const idx = haystack.toLowerCase().indexOf(searchTerm.toLowerCase());
  if (idx === -1) {
    return {
      status: "not_found_in_text",
      documentId: doc.id,
      title: doc.title,
      warnings: [`'${searchTerm}' no aparece literalmente en el texto completo de '${doc.id}'.`],
    };
  }
  const start = Math.max(0, idx - CONTEXT_WINDOW_CHARS);
  const end = Math.min(haystack.length, idx + searchTerm.length + CONTEXT_WINDOW_CHARS);
  const passage = `${start > 0 ? "…" : ""}${haystack.slice(start, end).trim()}${end < haystack.length ? "…" : ""}`;
  return {
    status: "extracted",
    extractionMethod: "text_search_heuristic",
    confidence: "probable",
    documentId: doc.id,
    title: doc.title,
    passage,
    officialSource: doc.provenance.officialSourceUrl ?? doc.provenance.sourceUrl,
    retrievedAt: doc.provenance.retrievedAt,
    warnings: [
      "Extraccion heuristica por busqueda de texto (ventana de contexto alrededor de la primera coincidencia real), no una extraccion estructurada por articulo -- puede incluir texto de un articulo/parrafo distinto si el termino aparece en un limite.",
    ],
  };
}

/**
 * Fase 6: extrae el pasaje literal de un documento ya identificado (por
 * `documentId`, tal como lo devuelven las demas herramientas de este
 * servidor). Prefiere extraccion estructurada real (Fedlex/LexWork
 * `getArticle`, arbol de contenido real) cuando existe; si no, cae a una
 * busqueda de texto real dentro del `fullText` ya descargado (nunca
 * descarga contenido nuevo mas alla del documento pedido, nunca inventa un
 * pasaje). Si el documento no tiene texto completo real, devuelve
 * `insufficient_source_text` explicitamente en vez de un resultado vacio
 * que parezca concluyente.
 */
export function registerExtractPassagesTools(tools: ToolRegistry): void {
  tools.register({
    name: "extract_legal_passages",
    description:
      "Extrae el pasaje literal de un documento legal ya identificado (documentId real devuelto por otra herramienta de este servidor: get_law, get_cantonal_law, get_case, get_official_document, o los resultados de verify_legal_citation/search_across_sources). Requiere 'articleNumber' (extraccion estructurada real, solo Fedlex y los 19 cantones LexWork) o 'searchTerm' (busqueda de texto heuristica sobre el texto completo ya descargado, cualquier fuente). Nunca inventa un pasaje: si el documento no tiene texto completo real, devuelve 'insufficient_source_text'.",
    inputSchema: {
      provider: legalDocumentProviderSchema,
      documentId: z.string().min(1),
      canton: z.string().length(2).optional(),
      articleNumber: z.string().min(1).optional(),
      searchTerm: z.string().min(1).optional(),
      language: legalDocumentLanguageSchema.optional(),
    },
    requiredProviderIds: [],
    requireAnyProviderIds: ["fedlex", "entscheidsuche", "seco", "bsv", "estv"],
    handler: async (input, context): Promise<PassageResult> => {
      if (!input.articleNumber && !input.searchTerm) {
        return {
          status: "unsupported",
          warnings: ["Se requiere 'articleNumber' o 'searchTerm' para extraer un pasaje."],
        };
      }

      const resolved = await resolveLegalDocument(
        {
          provider: input.provider,
          documentId: input.documentId,
          ...(input.canton ? { canton: input.canton } : {}),
          ...(input.articleNumber ? { articleNumber: input.articleNumber } : {}),
          ...(input.language ? { language: input.language } : {}),
        },
        context,
      );
      if (!resolved.ok) {
        return {
          status: resolved.reason === "not_found" ? "not_found_in_text" : "unsupported",
          warnings: [resolved.message],
        };
      }
      if (input.articleNumber) {
        const doc = resolved.document;
        if (!doc.fullText) {
          return {
            status: "insufficient_source_text",
            warnings: [`El articulo '${input.articleNumber}' no tiene texto real disponible.`],
          };
        }
        return {
          status: "extracted",
          extractionMethod: "structured_article",
          confidence: "exact",
          documentId: doc.id,
          title: doc.title,
          passage: doc.fullText,
          officialSource: doc.provenance.officialSourceUrl ?? doc.provenance.sourceUrl,
          retrievedAt: doc.provenance.retrievedAt,
          warnings: [],
        };
      }
      return textSearchExtract(resolved.document, input.searchTerm!);
    },
  });
}
