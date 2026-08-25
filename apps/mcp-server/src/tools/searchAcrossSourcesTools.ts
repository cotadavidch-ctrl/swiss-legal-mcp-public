import { z } from "zod";
import type { ProviderInfo, ToolRegistry } from "@swiss-legal-mcp/core";
import { classifyCitation } from "@swiss-legal-mcp/citations";
import { resolveCantonalProvider } from "./cantonalTools.js";

const languageSchema = z.enum(["de", "fr", "it"]);
const sourceSchema = z.enum(["fedlex", "entscheidsuche", "seco", "bsv", "estv", "cantonal"]);

interface CrossSourceResultItem {
  readonly providerId: string;
  readonly documentId: string;
  readonly title: string;
  readonly snippet?: string;
  readonly officialCharacter: string;
  readonly aggregatorName?: string;
  readonly jurisdictions: readonly string[];
}

interface ProviderConsultation {
  readonly providerId: string;
  readonly queried: boolean;
  readonly resultCount: number;
  readonly warning?: string;
}

/**
 * Fase 6: busqueda lexica/estructurada cruzada sobre los proveedores ya
 * integrados, sin embeddings ni infraestructura externa (ver ADR de
 * search_across_sources). Cada resultado solo incluye lo que `search()`
 * (metodo real de `LegalSourceProvider`) y el registro de proveedores
 * devuelven -- nunca se descarga el documento completo por resultado (eso
 * requeriria N+1 peticiones reales por busqueda); para provenance/URL
 * oficial completa el llamador debe usar la herramienta especifica de la
 * fuente (get_case, get_law, get_cantonal_law, get_official_document) sobre
 * el id devuelto.
 */
export function registerSearchAcrossSourcesTools(tools: ToolRegistry): void {
  tools.register({
    name: "search_across_sources",
    description:
      "Busca un termino en varias fuentes reales ya integradas a la vez (Fedlex, entscheidsuche.ch, SECO, BSV, ESTV y, si se indica 'canton', el proveedor cantonal correspondiente). Busqueda lexica/estructurada, sin embeddings ni base de datos vectorial. Fedlex no tiene busqueda de texto libre real (capabilities.fullTextSearch=false): solo se consulta cuando 'query' tiene forma de numero RS/SR real. Deduplica resultados con el mismo titulo real y ordena de forma deterministica (fuentes oficiales antes que agregadores, despues alfabetico) -- nunca usa relevancia semantica inventada.",
    inputSchema: {
      query: z.string().min(1),
      sources: z.array(sourceSchema).optional(),
      canton: z.string().length(2).optional(),
      language: languageSchema.optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    },
    requiredProviderIds: [],
    requireAnyProviderIds: ["fedlex", "entscheidsuche", "seco", "bsv", "estv"],
    handler: async (input, context) => {
      const wanted = new Set(
        input.sources ?? ["fedlex", "entscheidsuche", "seco", "bsv", "estv", "cantonal"],
      );
      const limit = input.limit ?? 20;
      const consultations: ProviderConsultation[] = [];
      const results: CrossSourceResultItem[] = [];
      const warnings: string[] = [];

      function providerInfoOrFallback(
        providerId: string,
      ): Pick<ProviderInfo, "officialCharacter" | "aggregatorName" | "jurisdictions"> {
        const info = context.providers.info(providerId);
        return info ?? { officialCharacter: "unofficial_aggregator", jurisdictions: [] };
      }

      // Fedlex: solo si 'query' tiene forma real de numero sistematico -- no tiene busqueda de texto libre real.
      if (wanted.has("fedlex")) {
        const fedlex = context.legislationProviders?.get("fedlex");
        if (!fedlex) {
          consultations.push({
            providerId: "fedlex",
            queried: false,
            resultCount: 0,
            warning: "no disponible",
          });
        } else if (classifyCitation(input.query) !== "systematic_number") {
          consultations.push({
            providerId: "fedlex",
            queried: false,
            resultCount: 0,
            warning:
              "Fedlex no tiene busqueda de texto libre real (capabilities.fullTextSearch=false); 'query' no tiene forma de numero RS/SR, se omite.",
          });
        } else {
          try {
            const outcome = await fedlex.searchLegislation({
              systematicNumber: input.query.replace(/^(RS|SR)\s*/i, ""),
              language: input.language ?? "de",
            });
            for (const item of outcome.items) {
              results.push({
                providerId: "fedlex",
                documentId: item.id,
                title: item.title,
                officialCharacter: "official",
                jurisdictions: ["federal"],
              });
            }
            consultations.push({
              providerId: "fedlex",
              queried: true,
              resultCount: outcome.items.length,
            });
          } catch (error) {
            consultations.push({
              providerId: "fedlex",
              queried: true,
              resultCount: 0,
              warning: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // entscheidsuche / seco / bsv / estv: LegalSourceProvider.search() real.
      for (const providerId of ["entscheidsuche", "seco", "bsv", "estv"] as const) {
        if (!wanted.has(providerId)) continue;
        const provider = context.providers.get(providerId);
        if (!provider) {
          consultations.push({
            providerId,
            queried: false,
            resultCount: 0,
            warning: "no disponible",
          });
          continue;
        }
        try {
          const searchResults = await provider.search({
            text: input.query,
            ...(input.language ? { language: input.language } : {}),
            limit,
          });
          const info = providerInfoOrFallback(providerId);
          for (const item of searchResults) {
            results.push({
              providerId,
              documentId: item.id,
              title: item.title,
              ...(item.snippet ? { snippet: item.snippet } : {}),
              officialCharacter: info.officialCharacter,
              ...(info.aggregatorName ? { aggregatorName: info.aggregatorName } : {}),
              jurisdictions: info.jurisdictions,
            });
          }
          consultations.push({ providerId, queried: true, resultCount: searchResults.length });
        } catch (error) {
          consultations.push({
            providerId,
            queried: true,
            resultCount: 0,
            warning: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Cantonal: solo si se indica 'canton' explicito -- nunca se consultan los 26 proveedores a la fuerza.
      if (wanted.has("cantonal")) {
        if (!input.canton) {
          consultations.push({
            providerId: "cantonal",
            queried: false,
            resultCount: 0,
            warning:
              "Se pidio la fuente 'cantonal' sin indicar 'canton': se omite (consultar los 26 proveedores cantonales sin pista de canton no es viable en una sola busqueda).",
          });
        } else {
          try {
            const resolved = resolveCantonalProvider(context.providers, input.canton);
            const providerId = resolved.provider.id;
            let items: Array<{ id: string; title: string }> = [];
            if (resolved.family === "lexwork") {
              const outcome = await resolved.provider.searchDocuments({ query: input.query });
              items = outcome.results.map((d) => ({ id: d.id, title: d.title }));
            } else if (resolved.family === "zh-own") {
              const outcome = await resolved.provider.searchDocuments({ title: input.query });
              items = outcome.results.map((d) => ({ id: d.id, title: d.title }));
            } else if (resolved.family === "sz" || resolved.family === "sil") {
              const outcome = await resolved.provider.searchDocuments({ query: input.query });
              items = outcome.results.map((d) => ({ id: d.id, title: d.title }));
            } else {
              consultations.push({
                providerId,
                queried: false,
                resultCount: 0,
                warning:
                  "Jura (JU) no tiene busqueda real (ver docs/provider-contracts/cantonal-ju.md).",
              });
            }
            for (const item of items) {
              results.push({
                providerId,
                documentId: item.id,
                title: item.title,
                officialCharacter: "official",
                jurisdictions: ["cantonal"],
              });
            }
            if (items.length > 0 || resolved.family !== "ju") {
              consultations.push({ providerId, queried: true, resultCount: items.length });
            }
          } catch (error) {
            consultations.push({
              providerId: `cantonal-${input.canton.toLowerCase()}`,
              queried: false,
              resultCount: 0,
              warning: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Deduplicacion deterministica: mismo titulo normalizado (independiente de jurisdiccion
      // declarada por el proveedor, ya que un agregador como entscheidsuche.ch declara varias
      // jurisdicciones a la vez) -> se conserva el primero.
      const seen = new Set<string>();
      const deduplicated: CrossSourceResultItem[] = [];
      let duplicatesRemoved = 0;
      for (const item of results) {
        const key = item.title.trim().toLowerCase();
        if (seen.has(key)) {
          duplicatesRemoved += 1;
          continue;
        }
        seen.add(key);
        deduplicated.push(item);
      }

      // Ranking deterministico: oficial antes que agregador, despues alfabetico por titulo.
      deduplicated.sort((a, b) => {
        if (a.officialCharacter !== b.officialCharacter) {
          return a.officialCharacter === "official" ? -1 : 1;
        }
        return a.title.localeCompare(b.title);
      });

      return {
        query: input.query,
        results: deduplicated.slice(0, limit),
        totalBeforeLimit: deduplicated.length,
        duplicatesRemoved,
        providersConsulted: consultations,
        warnings,
      };
    },
  });
}
