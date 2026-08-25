import { z } from "zod";
import {
  ProviderUnavailableError,
  ToolValidationError,
  type ProviderRegistry,
  type ToolRegistry,
} from "@swiss-legal-mcp/core";
import {
  administrativeDocumentTypeSchema,
  administrativeCircularStatusSchema,
} from "@swiss-legal-mcp/documents";
import type { SecoProvider } from "@swiss-legal-mcp/provider-seco";
import type { BsvProvider } from "@swiss-legal-mcp/provider-bsv";
import type { EstvProvider } from "@swiss-legal-mcp/provider-estv";

const ADMINISTRATIVE_PROVIDER_IDS = ["seco", "bsv", "estv"] as const;
type AdministrativeProviderId = (typeof ADMINISTRATIVE_PROVIDER_IDS)[number];

const commonSearchFields = {
  query: z.string().min(1).optional(),
  language: z.enum(["de", "fr", "it"]).optional(),
  documentType: administrativeDocumentTypeSchema.optional(),
  subject: z.string().min(1).optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  status: administrativeCircularStatusSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
};

function getProvider<T>(providers: ProviderRegistry, id: AdministrativeProviderId): T {
  const provider = providers.get(id);
  if (!provider) {
    throw new ProviderUnavailableError(id);
  }
  return provider as T;
}

/**
 * Registra las 4 herramientas MCP activadas en Fase 4 para documentacion
 * administrativa federal (SECO, BSV/OFAS, ESTV/AFC) -- ver
 * docs/tool-catalog.md. `subject`/`status` se validan en el input pero no
 * todos los proveedores los usan como filtro real: ninguno de los tres
 * expone un filtro de materia/estado estructurado en su fuente (ver
 * docs/provider-contracts/{seco,bsv,estv}.md); se documentan como
 * "aceptados pero no aplicados" en cada resultado via `appliedFilters`, para
 * no fingir un filtrado que la fuente no soporta.
 */
export function registerAdministrativeTools(tools: ToolRegistry): void {
  tools.register({
    name: "search_seco_documents",
    description:
      "Busca documentacion administrativa de SECO (Weisungen, Fachweisungen, guias) via arbeit.swiss. 'subject' y 'status' se aceptan pero SECO no expone un filtro estructurado para ellos: se ignoran en la busqueda real, ver appliedFilters en la respuesta.",
    inputSchema: commonSearchFields,
    requiredProviderIds: ["seco"],
    handler: async (input, context) => {
      const provider = getProvider<SecoProvider>(context.providers, "seco");
      const outcome = await provider.searchDocuments({
        ...(input.query ? { query: input.query } : {}),
        ...(input.language && input.language !== "it" ? { language: input.language } : {}),
        ...(input.documentType ? { documentType: input.documentType } : {}),
        ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
        ...(input.dateTo ? { dateTo: input.dateTo } : {}),
        ...(input.page ? { page: input.page } : {}),
        ...(input.pageSize ? { pageSize: input.pageSize } : {}),
      });
      return {
        results: outcome.results,
        pagination: outcome.pagination,
        appliedFilters: outcome.appliedFilters,
        sourceAttribution: outcome.sourceAttribution,
        coverageWarnings: outcome.coverageWarnings,
      };
    },
  });

  tools.register({
    name: "search_bsv_documents",
    description:
      "Busca documentacion administrativa de BSV/OFAS (Kreisschreiben, Weisungen) via sozialversicherungen.admin.ch. Solo la rama IV (Individuelle Leistungen) esta configurada por defecto; 'language'/'subject'/'status' se aceptan pero no se aplican como filtro real (ver coverageWarnings).",
    inputSchema: commonSearchFields,
    requiredProviderIds: ["bsv"],
    handler: async (input, context) => {
      const provider = getProvider<BsvProvider>(context.providers, "bsv");
      const outcome = await provider.searchDocuments({
        ...(input.query ? { query: input.query } : {}),
        ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
        ...(input.dateTo ? { dateTo: input.dateTo } : {}),
        ...(input.page ? { page: input.page } : {}),
        ...(input.pageSize ? { pageSize: input.pageSize } : {}),
      });
      return {
        results: outcome.results,
        pagination: outcome.pagination,
        appliedFilters: outcome.appliedFilters,
        sourceAttribution: outcome.sourceAttribution,
        coverageWarnings: outcome.coverageWarnings,
      };
    },
  });

  tools.register({
    name: "search_estv_documents",
    description:
      "Busca circulares (Kreisschreiben) de ESTV/AFC via el portal clasico www.estv.admin.ch (Direkte Bundessteuer, Stempelabgaben, Verrechnungssteuer). El sistema JSF de MWST-Infos NO esta cubierto (ver coverageWarnings). 'language'/'subject'/'status' se aceptan pero no se aplican como filtro real.",
    inputSchema: commonSearchFields,
    requiredProviderIds: ["estv"],
    handler: async (input, context) => {
      const provider = getProvider<EstvProvider>(context.providers, "estv");
      const outcome = await provider.searchDocuments({
        ...(input.query ? { query: input.query } : {}),
        ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
        ...(input.dateTo ? { dateTo: input.dateTo } : {}),
        ...(input.page ? { page: input.page } : {}),
        ...(input.pageSize ? { pageSize: input.pageSize } : {}),
      });
      return {
        results: outcome.results,
        pagination: outcome.pagination,
        appliedFilters: outcome.appliedFilters,
        sourceAttribution: outcome.sourceAttribution,
        coverageWarnings: outcome.coverageWarnings,
      };
    },
  });

  tools.register({
    name: "get_official_document",
    description:
      "Recupera un documento administrativo oficial concreto de SECO, BSV o ESTV por documentId (obtenido via search_*_documents) o por una URL oficial directa (validada contra la allowlist de dominio del proveedor indicado). Distingue si el texto proviene de un PDF, incluye hash de contenido y metadatos completos.",
    inputSchema: {
      provider: z.enum(ADMINISTRATIVE_PROVIDER_IDS),
      documentId: z.string().min(1).optional(),
      officialUrl: z.string().url().optional(),
      language: z.enum(["de", "fr", "it"]).optional(),
      version: z.string().min(1).optional(),
      date: z.iso.date().optional(),
    },
    requiredProviderIds: [],
    handler: async (input, context) => {
      if (!input.documentId && !input.officialUrl) {
        throw new ToolValidationError("get_official_document", [
          "Debe indicarse 'documentId' o 'officialUrl'.",
        ]);
      }

      if (input.provider === "seco") {
        const provider = getProvider<SecoProvider>(context.providers, "seco");
        return input.documentId
          ? provider.fetchDocument(input.documentId)
          : provider.fetchDocumentByUrl(input.officialUrl!);
      }
      if (input.provider === "bsv") {
        const provider = getProvider<BsvProvider>(context.providers, "bsv");
        const id = input.documentId
          ? input.version && !input.documentId.includes(":v")
            ? `${input.documentId}:v${input.version}`
            : input.documentId
          : undefined;
        return id ? provider.fetchDocument(id) : provider.fetchDocumentByUrl(input.officialUrl!);
      }
      const provider = getProvider<EstvProvider>(context.providers, "estv");
      return input.documentId
        ? provider.fetchDocument(input.documentId)
        : provider.fetchDocumentByUrl(input.officialUrl!);
    },
  });
}
