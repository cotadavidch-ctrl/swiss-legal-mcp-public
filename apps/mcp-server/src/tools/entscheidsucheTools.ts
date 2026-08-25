import { z } from "zod";
import {
  ProviderUnavailableError,
  type ProviderRegistry,
  type ToolRegistry,
} from "@swiss-legal-mcp/core";
import type { EntscheidsucheMcpProvider } from "@swiss-legal-mcp/provider-entscheidsuche";
import { buildSearchCaseCalibration } from "./legalCalibration.js";

const PROVIDER_ID = "entscheidsuche";
const ID_PREFIX = `${PROVIDER_ID}:`;

function stripProviderPrefix(id: string): string {
  return id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : id;
}

/** Castea el LegalSourceProvider generico a la clase concreta que registramos bajo este id. */
function getEntscheidsucheProvider(providers: ProviderRegistry): EntscheidsucheMcpProvider {
  const provider = providers.get(PROVIDER_ID);
  if (!provider) {
    throw new ProviderUnavailableError(PROVIDER_ID);
  }
  return provider as EntscheidsucheMcpProvider;
}

const languageSchema = z.enum(["de", "fr", "it"]);

/**
 * Registra unicamente las 4 herramientas MCP activadas en Fase 2 para
 * jurisprudencia via entscheidsuche.ch (ver docs/tool-catalog.md). No activa
 * compare_cases, search_cases_by_article, extract_case_passages,
 * find_supporting_cases, find_adverse_cases, build_case_line ni
 * verify_case_quote -- esas dependen de packages/citations (Fase 7).
 */
export function registerEntscheidsucheTools(tools: ToolRegistry): void {
  tools.register({
    name: "search_cases",
    description:
      "Busca jurisprudencia suiza (federal y cantonal) via entscheidsuche.ch. Advertencia: entscheidsuche.ch es un agregador NO oficial; los resultados nunca sustituyen la fuente oficial del tribunal.",
    inputSchema: {
      query: z.string().min(1),
      language: languageSchema.optional(),
      court: z.string().min(1).optional(),
      canton: z.string().length(2).optional(),
      dateFrom: z.iso.date().optional(),
      dateTo: z.iso.date().optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).optional(),
    },
    requiredProviderIds: [PROVIDER_ID],
    handler: async (input, context) => {
      const provider = getEntscheidsucheProvider(context.providers);
      const outcome = await provider.searchCases({
        query: input.query,
        ...(input.language ? { language: input.language } : {}),
        ...(input.court ? { court: input.court } : {}),
        ...(input.canton ? { canton: input.canton } : {}),
        ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
        ...(input.dateTo ? { dateTo: input.dateTo } : {}),
        ...(input.page ? { page: input.page } : {}),
        ...(input.pageSize ? { pageSize: input.pageSize } : {}),
      });
      const legalCalibration = buildSearchCaseCalibration({
        query: input.query,
        resultCount: outcome.results.length,
        sourceName: "entscheidsuche.ch",
      });
      return {
        results: outcome.results.map((result, index) => ({
          ...result,
          legalCalibration: {
            source_quality: legalCalibration.source_quality,
            citation_quality: legalCalibration.citation_quality,
            official_verification_required: legalCalibration.official_verification_required,
            recommended_use: "discovery_only",
            ranking_position: index + 1,
            ranking_basis: legalCalibration.ranking_policy,
          },
        })),
        pagination: outcome.pagination,
        filtersApplied: outcome.filtersApplied,
        sourceAttribution: provider.getGeneralSourceAttribution(),
        warning: {
          code: outcome.warning.code,
          message: outcome.warning.message,
          aggregatorName: outcome.warning.aggregatorName,
        },
        legalCalibration,
      };
    },
  });

  tools.register({
    name: "get_case",
    description:
      "Recupera el texto completo y los metadatos de una sentencia via entscheidsuche.ch, distinguiendo URL oficial (si se detecto) de URL del agregador, con hash de contenido.",
    inputSchema: { id: z.string().min(1) },
    requiredProviderIds: [PROVIDER_ID],
    handler: async (input, context) => {
      const provider = getEntscheidsucheProvider(context.providers);
      return provider.fetchDocument(stripProviderPrefix(input.id));
    },
  });

  tools.register({
    name: "get_case_metadata",
    description:
      "Devuelve los metadatos de una sentencia (sin el texto completo) via entscheidsuche.ch. Internamente usa fetch_document porque el proveedor remoto no ofrece un 'get by id' mas ligero.",
    inputSchema: { id: z.string().min(1) },
    requiredProviderIds: [PROVIDER_ID],
    handler: async (input, context) => {
      const provider = getEntscheidsucheProvider(context.providers);
      return provider.getCaseMetadata(stripProviderPrefix(input.id));
    },
  });

  tools.register({
    name: "search_cases_by_reference",
    description:
      "Busca por numero de expediente o cita BGE/ATF/DTF via search_by_case_number de entscheidsuche.ch. No es un lookup exacto: puede devolver varias sentencias que citan la misma referencia.",
    inputSchema: {
      reference: z.string().min(1),
      language: languageSchema.optional(),
      pageSize: z.coerce.number().int().min(1).max(100).optional(),
    },
    requiredProviderIds: [PROVIDER_ID],
    handler: async (input, context) => {
      const provider = getEntscheidsucheProvider(context.providers);
      const outcome = await provider.searchByCaseNumber({
        caseNumber: input.reference,
        ...(input.language ? { language: input.language } : {}),
        ...(input.pageSize ? { pageSize: input.pageSize } : {}),
      });
      const legalCalibration = buildSearchCaseCalibration({
        query: input.reference,
        resultCount: outcome.results.length,
        sourceName: "entscheidsuche.ch",
      });
      return {
        results: outcome.results.map((result, index) => ({
          ...result,
          legalCalibration: {
            source_quality: legalCalibration.source_quality,
            citation_quality: legalCalibration.citation_quality,
            official_verification_required: legalCalibration.official_verification_required,
            recommended_use: "discovery_only",
            ranking_position: index + 1,
            ranking_basis: legalCalibration.ranking_policy,
          },
        })),
        pagination: outcome.pagination,
        filtersApplied: outcome.filtersApplied,
        sourceAttribution: provider.getGeneralSourceAttribution(),
        warning: {
          code: outcome.warning.code,
          message: outcome.warning.message,
          aggregatorName: outcome.warning.aggregatorName,
        },
        ambiguityNotice:
          outcome.pagination.total > 1
            ? `La referencia '${input.reference}' coincide con ${outcome.pagination.total} sentencias; se devuelve la mas relevante primero, no un resultado unico garantizado.`
            : undefined,
        legalCalibration,
      };
    },
  });
}
