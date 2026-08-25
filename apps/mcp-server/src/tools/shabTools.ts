import { z } from "zod";
import {
  ProviderUnavailableError,
  type ProviderRegistry,
  type ToolRegistry,
} from "@swiss-legal-mcp/core";
import type { ShabProvider } from "@swiss-legal-mcp/provider-shab";

const PROVIDER_ID = "shab";

function getShabProvider(providers: ProviderRegistry): ShabProvider {
  const provider = providers.get(PROVIDER_ID);
  if (!provider) {
    throw new ProviderUnavailableError(PROVIDER_ID);
  }
  return provider as ShabProvider;
}

/**
 * Registra `search_shab_publications`/`get_shab_publication` en el
 * catalogo -- ver docs/providers/shab.md. `ShabProvider.healthCheck()`
 * siempre reporta `unhealthy` con `unavailableByPolicy: { reason:
 * "robots_txt_disallow" }` (bloqueado por `robots.txt`, no por
 * credenciales ni por una caida transitoria), asi que `ToolRegistry`
 * marca ambas herramientas como `blocked` con `blockedByPolicy` presente:
 * `apps/mcp-server/src/mcpServer.ts` las registra igualmente en
 * `tools/list` (a diferencia de un bloqueo transitorio normal), pero
 * `tools/call` siempre lanza `ProviderUnavailableByPolicyError` -- nunca
 * se activan de verdad, ni se realiza ninguna peticion de red, en esta
 * fase.
 */
export function registerShabTools(tools: ToolRegistry): void {
  tools.register({
    name: "search_shab_publications",
    description:
      "Busca publicaciones del Schweizerisches Handelsamtsblatt (SHAB/FOSC/FUSC). BLOQUEADA: shab.ch y amtsblattportal.ch declaran robots.txt Disallow:/ para todo user-agent; ver docs/providers/shab.md.",
    inputSchema: {
      query: z.string().min(1).optional(),
      uid: z.string().min(1).optional(),
      chId: z.string().min(1).optional(),
      publicationType: z.string().min(1).optional(),
      canton: z.string().length(2).optional(),
      dateFrom: z.iso.date().optional(),
      dateTo: z.iso.date().optional(),
      language: z.enum(["de", "fr", "it"]).optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).optional(),
    },
    requiredProviderIds: [PROVIDER_ID],
    handler: async (input, context) => {
      const provider = getShabProvider(context.providers);
      return provider.searchDocuments(input);
    },
  });

  tools.register({
    name: "get_shab_publication",
    description:
      "Recupera una publicacion SHAB concreta por su numero de publicacion. BLOQUEADA: ver docs/providers/shab.md.",
    inputSchema: { publicationNumber: z.string().min(1) },
    requiredProviderIds: [PROVIDER_ID],
    handler: async (input, context) => {
      const provider = getShabProvider(context.providers);
      return provider.fetchDocument(input.publicationNumber);
    },
  });
}
