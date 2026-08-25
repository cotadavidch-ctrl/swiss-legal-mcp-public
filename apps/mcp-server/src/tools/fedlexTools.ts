import { z } from "zod";
import {
  ProviderUnavailableError,
  ToolDisabledError,
  type LegislationProviderRegistry,
  type ToolRegistry,
  type ToolContext,
} from "@swiss-legal-mcp/core";
import { buildLegislationSearchCalibration } from "./legalCalibration.js";

const PROVIDER_ID = "fedlex";

const languageSchema = z.enum(["de", "fr", "it", "rm", "en"]);

/** Identificador comun de una norma: eli/systematicNumber/documentId + idioma, sin fecha. */
const lawIdentifierSchema = {
  eli: z.string().url().optional(),
  systematicNumber: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  language: languageSchema,
};

/** Igual que lawIdentifierSchema, mas una fecha opcional para fijar la version (get_law/get_article). */
const lawRefSchema = {
  ...lawIdentifierSchema,
  date: z.iso.date().optional(),
};

function getFedlexProvider(legislationProviders: LegislationProviderRegistry | undefined) {
  if (!legislationProviders) {
    throw new ProviderUnavailableError(PROVIDER_ID);
  }
  const provider = legislationProviders.get(PROVIDER_ID);
  if (!provider) {
    throw new ProviderUnavailableError(PROVIDER_ID);
  }
  return provider;
}

/**
 * Registra unicamente las 6 herramientas MCP de legislacion activadas en
 * Fase 3 para Fedlex (ver docs/tool-catalog.md). No activa
 * get_transitional_provisions, verify_legal_citation,
 * search_cantonal_legislation, identify_applicable_version ni
 * identify_related_regulations -- no hay soporte real, probado y
 * documentado para ellas en esta fase.
 */
export function registerFedlexTools(tools: ToolRegistry): void {
  tools.register({
    name: "search_legislation",
    description:
      "Busca legislacion federal suiza via Fedlex por texto, numero sistematico (RS/SR) o ELI. La busqueda de texto libre es CONTAINS sobre titulos reales (no un indice de relevancia; Virtuoso bif:contains no esta disponible en el endpoint publico). El numero sistematico puede identificar mas de un acto (reutilizacion tras derogacion, ver docs/provider-contracts/fedlex.md) -- en ese caso se devuelven todos con una advertencia explicita.",
    inputSchema: {
      query: z.string().min(1).optional(),
      language: languageSchema.optional(),
      systematicNumber: z.string().min(1).optional(),
      abbreviation: z.string().min(1).optional(),
      dateFrom: z.iso.date().optional(),
      dateTo: z.iso.date().optional(),
      relevantDate: z.iso.date().optional(),
      status: z.enum(["in_force", "no_longer_in_force", "any"]).optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).optional(),
    },
    requiredProviderIds: [PROVIDER_ID],
    handler: async (input, context: ToolContext & { signal?: AbortSignal }) => {
      if (input.abbreviation) {
        // searchByAbbreviation no esta verificado/implementado en esta fase
        // (ver ProviderCapabilities.searchByAbbreviation = false).
        throw new ToolDisabledError(
          "search_legislation",
          "La busqueda por abreviatura no esta implementada ni verificada en Fase 3.",
        );
      }
      const provider = getFedlexProvider(context.legislationProviders);
      const result = await provider.searchLegislation(
        {
          ...(input.query ? { text: input.query } : {}),
          ...(input.language ? { language: input.language } : {}),
          ...(input.systematicNumber ? { systematicNumber: input.systematicNumber } : {}),
          ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
          ...(input.dateTo ? { dateTo: input.dateTo } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.page ? { page: input.page } : {}),
          ...(input.pageSize ? { pageSize: input.pageSize } : {}),
        },
        context.signal,
      );
      return {
        ...result,
        legalCalibration: buildLegislationSearchCalibration({
          ...(input.relevantDate ? { relevantDate: input.relevantDate } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
          ...(input.dateTo ? { dateTo: input.dateTo } : {}),
        }),
      };
    },
  });

  tools.register({
    name: "get_law",
    description:
      "Recupera una norma federal completa via Fedlex (metadatos, version vigente o en una fecha dada, y la manifestacion oficial mas apropiada). Requiere al menos uno de: eli, systematicNumber, documentId.",
    inputSchema: { ...lawRefSchema },
    requiredProviderIds: [PROVIDER_ID],
    handler: async (input, context: ToolContext & { signal?: AbortSignal }) => {
      const provider = getFedlexProvider(context.legislationProviders);
      return provider.getLaw(
        {
          ...(input.eli ? { eli: input.eli } : {}),
          ...(input.systematicNumber ? { systematicNumber: input.systematicNumber } : {}),
          ...(input.documentId ? { documentId: input.documentId } : {}),
          language: input.language,
          ...(input.date ? { date: input.date } : {}),
        },
        context.signal,
      );
    },
  });

  tools.register({
    name: "get_article",
    description:
      "Recupera un articulo concreto de una norma federal via Fedlex, extraido de la manifestacion Akoma Ntoso real (nunca con regex sobre texto). Para articulos en un anexo (e.g. Art. 9 Anexo I del FZA SR 0.142.112.681), especificar annexContext con el identificador del anexo tal como aparece en Fedlex (e.g. 'annex_I'). Sin annexContext, la busqueda se limita al cuerpo principal. No hay fallback silencioso entre ambas zonas. Si la version aplicable carece de manifestacion XML (hueco historico real, ver docs/provider-contracts/fedlex.md), la herramienta falla explicitamente en vez de aproximar.",
    inputSchema: {
      ...lawRefSchema,
      articleNumber: z.string().min(1),
      annexContext: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Identificador del anexo en notacion Fedlex (e.g. 'annex_I' para Anexo I, 'annex_II' para Anexo II). Omitir para articulos del cuerpo principal.",
        ),
    },
    requiredProviderIds: [PROVIDER_ID],
    handler: async (input, context: ToolContext & { signal?: AbortSignal }) => {
      const provider = getFedlexProvider(context.legislationProviders);
      return provider.getArticle(
        {
          lawRef: {
            ...(input.eli ? { eli: input.eli } : {}),
            ...(input.systematicNumber ? { systematicNumber: input.systematicNumber } : {}),
            ...(input.documentId ? { documentId: input.documentId } : {}),
            language: input.language,
            ...(input.date ? { date: input.date } : {}),
          },
          articleNumber: input.articleNumber,
          ...(input.annexContext ? { annexContext: input.annexContext } : {}),
        },
        context.signal,
      );
    },
  });

  tools.register({
    name: "get_article_at_date",
    description:
      "Resuelve la version legalmente aplicable de un articulo en una fecha concreta (algoritmo determinista sobre jolux:dateApplicability/dateEndApplicability), devolviendo evidencia de la version elegida y advertencias si la fecha cae fuera de la cobertura historica real.",
    inputSchema: {
      ...lawIdentifierSchema,
      articleNumber: z.string().min(1),
      atDate: z.iso.date(),
      annexContext: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Identificador del anexo en notacion Fedlex (e.g. 'annex_I'). Omitir para articulos del cuerpo principal.",
        ),
    },
    requiredProviderIds: [PROVIDER_ID],
    handler: async (input, context: ToolContext & { signal?: AbortSignal }) => {
      const provider = getFedlexProvider(context.legislationProviders);
      return provider.getArticleAtDate(
        {
          lawRef: {
            ...(input.eli ? { eli: input.eli } : {}),
            ...(input.systematicNumber ? { systematicNumber: input.systematicNumber } : {}),
            ...(input.documentId ? { documentId: input.documentId } : {}),
            language: input.language,
          },
          articleNumber: input.articleNumber,
          ...(input.annexContext ? { annexContext: input.annexContext } : {}),
        },
        input.atDate,
        context.signal,
      );
    },
  });

  tools.register({
    name: "compare_article_versions",
    description:
      "Compara dos versiones reales de un mismo articulo entre dos fechas, preservando el texto literal anterior y posterior y distinguiendo un cambio literal (extraccion estructural Akoma Ntoso) de una aproximacion generada. Nunca presenta una comparacion sobre HTML/PDF sin estructura como si fuera exacta.",
    inputSchema: {
      ...lawIdentifierSchema,
      articleNumber: z.string().min(1),
      dateBefore: z.iso.date(),
      dateAfter: z.iso.date(),
      annexContext: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Identificador del anexo en notacion Fedlex (e.g. 'annex_I'). Omitir para articulos del cuerpo principal.",
        ),
    },
    requiredProviderIds: [PROVIDER_ID],
    handler: async (input, context: ToolContext & { signal?: AbortSignal }) => {
      const provider = getFedlexProvider(context.legislationProviders);
      return provider.compareArticleVersions(
        {
          lawRef: {
            ...(input.eli ? { eli: input.eli } : {}),
            ...(input.systematicNumber ? { systematicNumber: input.systematicNumber } : {}),
            ...(input.documentId ? { documentId: input.documentId } : {}),
            language: input.language,
          },
          articleNumber: input.articleNumber,
          ...(input.annexContext ? { annexContext: input.annexContext } : {}),
        },
        input.dateBefore,
        input.dateAfter,
        context.signal,
      );
    },
  });

  tools.register({
    name: "get_amendment_history",
    description:
      "Devuelve las modificaciones observables en Fedlex para una norma (secuencia de versiones fechadas reales). No infiere que acto concreto producido cada modificacion: Fedlex no expone un predicado que vincule una version con el acto que la modifico, asi que amendingActs queda vacio (ver docs/provider-contracts/fedlex.md).",
    inputSchema: { ...lawIdentifierSchema },
    requiredProviderIds: [PROVIDER_ID],
    handler: async (input, context: ToolContext & { signal?: AbortSignal }) => {
      const provider = getFedlexProvider(context.legislationProviders);
      return provider.getAmendmentHistory(
        {
          ...(input.eli ? { eli: input.eli } : {}),
          ...(input.systematicNumber ? { systematicNumber: input.systematicNumber } : {}),
          ...(input.documentId ? { documentId: input.documentId } : {}),
          language: input.language,
        },
        context.signal,
      );
    },
  });
}
