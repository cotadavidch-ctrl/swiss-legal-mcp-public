import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  NotFoundError,
  ProviderUnavailableError,
  UnofficialSourceWarning,
  type DocumentId,
  type HealthStatus,
  type LegalSourceProvider,
  type SearchQuery,
  type SearchResult,
  type SourceAttribution,
} from "@swiss-legal-mcp/core";
import type { Language, NormalizedDocument } from "@swiss-legal-mcp/documents";
import { TtlCache } from "@swiss-legal-mcp/shared";
import { loadEntscheidsucheConfig, type EntscheidsucheConfig } from "./config.js";
import { EntscheidsucheRemoteClient } from "./remoteClient.js";
import { OfficialSourceResolver } from "./officialSourceResolver.js";
import { mapEntscheidsucheDocumentToNormalizedDocument } from "./mapper.js";
import {
  remoteFacetsResponseSchema,
  remoteFetchDocumentResponseSchema,
  remoteHierarchyResponseSchema,
  remoteSearchHitSchema,
  remoteSearchResponseSchema,
  remoteServerInfoSchema,
  type RemoteFacetNode,
  type RemoteHierarchyResponse,
  type RemoteServerInfo,
} from "./remoteTypes.js";

const PROVIDER_ID = "entscheidsuche";
const ID_PREFIX = `${PROVIDER_ID}:`;

export interface SearchCasesParams {
  readonly query: string;
  readonly language?: Language;
  readonly court?: string;
  readonly canton?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface SearchCasesPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasNextPage: boolean;
}

export interface SearchCasesOutcome {
  readonly results: NormalizedDocument[];
  readonly pagination: SearchCasesPagination;
  readonly filtersApplied: SearchCasesParams;
  readonly warning: UnofficialSourceWarning;
}

function extractStructuredResult(result: CallToolResult): unknown {
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }
  const textItem = result.content.find(
    (item): item is { type: "text"; text: string } => item.type === "text",
  );
  if (!textItem) {
    throw new Error("La respuesta remota no incluye structuredContent ni contenido de texto.");
  }
  return JSON.parse(textItem.text) as unknown;
}

function stripProviderPrefix(id: DocumentId): string {
  return id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : id;
}

/**
 * Cliente MCP real contra entscheidsuche.ch (ver docs/providers/entscheidsuche.md
 * para el detalle de cada decision de diseno y docs/provider-contracts/entscheidsuche.md
 * para el contrato remoto exacto). Nunca hace scraping ni inventa una API REST:
 * todo pasa por las seis herramientas del servidor MCP remoto.
 */
export class EntscheidsucheMcpProvider implements LegalSourceProvider {
  readonly id = PROVIDER_ID;

  private readonly remoteClient: EntscheidsucheRemoteClient;
  private readonly resolver: OfficialSourceResolver;
  private readonly serverInfoCache: TtlCache<RemoteServerInfo>;
  private readonly hierarchyCache: TtlCache<RemoteHierarchyResponse>;
  private readonly facetsCache: TtlCache<readonly RemoteFacetNode[]>;
  private readonly documentCache: TtlCache<NormalizedDocument>;

  constructor(
    private readonly config: EntscheidsucheConfig = loadEntscheidsucheConfig(),
    remoteClient?: EntscheidsucheRemoteClient,
  ) {
    this.remoteClient = remoteClient ?? new EntscheidsucheRemoteClient(config);
    this.resolver = new OfficialSourceResolver(config.allowedOfficialDomains);
    this.serverInfoCache = new TtlCache(config.cacheTtlServerInfoMs);
    this.hierarchyCache = new TtlCache(config.cacheTtlHierarchyMs);
    this.facetsCache = new TtlCache(config.cacheTtlFacetsMs);
    this.documentCache = new TtlCache(config.cacheTtlDocumentMs);
  }

  // ---- Capacidades especificas (ver docs/providers/entscheidsuche.md) ----

  async searchCases(params: SearchCasesParams): Promise<SearchCasesOutcome> {
    const pageSize = params.pageSize ?? 20;
    const page = params.page ?? 1;
    const hierarchy = params.court ? [params.court] : params.canton ? [params.canton] : undefined;

    const cursor = await this.advanceCursor("search", params, hierarchy, pageSize, page);

    const remoteArgs: Record<string, unknown> = {
      query: params.query,
      size: pageSize,
      ...(params.language ? { language_filter: [params.language] } : {}),
      ...(params.dateFrom ? { decision_date_from: params.dateFrom } : {}),
      ...(params.dateTo ? { decision_date_to: params.dateTo } : {}),
      ...(hierarchy ? { hierarchy } : {}),
      ...(cursor ? { search_after: cursor } : {}),
    };

    const result = await this.remoteClient.callTool("search", remoteArgs);
    const parsed = remoteSearchResponseSchema.parse(extractStructuredResult(result));

    const results = parsed.hits.map((hit) =>
      mapEntscheidsucheDocumentToNormalizedDocument(hit, {
        isFullText: false,
        resolver: this.resolver,
        ...(params.language ? { inferredLanguage: params.language } : {}),
      }),
    );

    return {
      results,
      pagination: {
        page,
        pageSize,
        total: parsed.total,
        hasNextPage: parsed.next_cursor !== null && parsed.next_cursor !== undefined,
      },
      filtersApplied: params,
      warning: new UnofficialSourceWarning("entscheidsuche.ch"),
    };
  }

  async searchByCaseNumber(params: {
    readonly caseNumber: string;
    readonly language?: Language;
    readonly pageSize?: number;
  }): Promise<SearchCasesOutcome> {
    const pageSize = params.pageSize ?? 20;
    const result = await this.remoteClient.callTool("search_by_case_number", {
      case_number: params.caseNumber,
      size: pageSize,
      ...(params.language ? { language_filter: [params.language] } : {}),
    });
    const parsed = remoteSearchResponseSchema.parse(extractStructuredResult(result));

    const results = parsed.hits.map((hit) =>
      mapEntscheidsucheDocumentToNormalizedDocument(hit, {
        isFullText: false,
        resolver: this.resolver,
        ...(params.language ? { inferredLanguage: params.language } : {}),
      }),
    );

    return {
      results,
      pagination: { page: 1, pageSize, total: parsed.total, hasNextPage: !!parsed.next_cursor },
      filtersApplied: { query: params.caseNumber, language: params.language, pageSize },
      warning: new UnofficialSourceWarning("entscheidsuche.ch"),
    };
  }

  async fetchDocument(rawId: string): Promise<NormalizedDocument> {
    const cached = this.documentCache.get(rawId);
    if (cached) return cached;

    const result = await this.remoteClient.callTool("fetch_document", { id: rawId });
    const parsed = remoteFetchDocumentResponseSchema.parse(extractStructuredResult(result));
    if (!parsed.result) {
      throw new NotFoundError(
        rawId,
        `No existe ningun documento con id '${rawId}' en entscheidsuche.ch.`,
      );
    }
    const hit = remoteSearchHitSchema.parse(parsed.result);
    const doc = mapEntscheidsucheDocumentToNormalizedDocument(hit, {
      isFullText: true,
      resolver: this.resolver,
    });
    this.documentCache.set(rawId, doc);
    return doc;
  }

  /**
   * Metadatos sin forzar la exposicion del texto completo. El servidor
   * remoto no permite obtener metadatos fiables de un id concreto sin
   * llamar internamente a fetch_document (no hay "get by id" en `search`) --
   * la diferencia es que el documento devuelto aqui nunca incluye fullText.
   */
  async getCaseMetadata(rawId: string): Promise<NormalizedDocument> {
    const full = await this.fetchDocument(rawId);
    const { fullText: _omitted, ...withoutFullText } = full;
    return { ...withoutFullText, excerptOnly: true };
  }

  async listHierarchy(params?: {
    query?: string;
    size?: number;
  }): Promise<RemoteHierarchyResponse> {
    const cacheKey = `${params?.query ?? "*"}::${params?.size ?? 1000}`;
    const cached = this.hierarchyCache.get(cacheKey);
    if (cached) return cached;

    const result = await this.remoteClient.callTool("list_hierarchy", {
      query: params?.query ?? "*",
      size: params?.size ?? 1000,
    });
    const parsed = remoteHierarchyResponseSchema.parse(extractStructuredResult(result));
    this.hierarchyCache.set(cacheKey, parsed);
    return parsed;
  }

  async listFacets(): Promise<readonly RemoteFacetNode[]> {
    const cached = this.facetsCache.get("facets");
    if (cached) return cached;

    const result = await this.remoteClient.callTool("list_facets", {});
    const parsed = remoteFacetsResponseSchema.parse(extractStructuredResult(result));
    this.facetsCache.set("facets", parsed.result);
    return parsed.result;
  }

  async getServerInfo(): Promise<RemoteServerInfo> {
    const cached = this.serverInfoCache.get("server_info");
    if (cached) return cached;

    const result = await this.remoteClient.callTool("server_info", {});
    const parsed = remoteServerInfoSchema.parse(extractStructuredResult(result));
    this.serverInfoCache.set("server_info", parsed);
    return parsed;
  }

  async close(): Promise<void> {
    await this.remoteClient.close();
  }

  /**
   * Atribucion general para respuestas de busqueda (que cubren varios
   * documentos, no uno solo). Usada por search_cases/search_cases_by_reference
   * en apps/mcp-server para mostrar siempre de donde vienen los resultados.
   */
  getGeneralSourceAttribution(): SourceAttribution {
    return {
      sourceUrl: this.config.endpoint,
      retrievedAt: new Date().toISOString(),
      officialCharacter: "unofficial_aggregator",
      aggregatorName: "entscheidsuche.ch",
    };
  }

  // ---- Implementacion de LegalSourceProvider (interfaz generica compartida) ----

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const outcome = await this.searchCases({
      query: query.text,
      ...(query.language ? { language: query.language } : {}),
      ...(query.limit ? { pageSize: query.limit } : {}),
    });
    return outcome.results.map((doc) => ({
      id: doc.id,
      title: doc.title,
      snippet: doc.summary?.slice(0, 200),
    }));
  }

  async getDocument(id: DocumentId): Promise<NormalizedDocument> {
    return this.fetchDocument(stripProviderPrefix(id));
  }

  async getMetadata(id: DocumentId): Promise<Record<string, unknown>> {
    const doc = await this.getCaseMetadata(stripProviderPrefix(id));
    return doc.rawMetadata;
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      await this.getServerInfo();
      return { healthy: true, checkedAt: new Date().toISOString() };
    } catch (error) {
      return {
        healthy: false,
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  normalize(raw: unknown): NormalizedDocument {
    const hit = remoteSearchHitSchema.parse(raw);
    return mapEntscheidsucheDocumentToNormalizedDocument(hit, {
      isFullText: true,
      resolver: this.resolver,
    });
  }

  /**
   * Requiere haber llamado antes a getDocument/fetchDocument para ese id:
   * un proveedor remoto real no puede resolver la procedencia de un
   * documento sin haberlo recuperado (a diferencia de FixtureProvider, que
   * mantiene documentos estaticos en memoria). Ver ADR de Fase 2.
   */
  getSourceAttribution(id: DocumentId): SourceAttribution {
    const rawId = stripProviderPrefix(id);
    const cached = this.documentCache.get(rawId);
    if (!cached) {
      throw new ProviderUnavailableError(
        PROVIDER_ID,
        `getSourceAttribution('${id}') requiere haber llamado antes a getDocument/fetchDocument: ` +
          "este proveedor remoto no puede resolver la procedencia sin recuperar el documento primero.",
      );
    }
    return {
      sourceUrl: cached.provenance.sourceUrl,
      retrievedAt: cached.provenance.retrievedAt,
      officialCharacter: cached.provenance.officialCharacter,
      ...(cached.provenance.aggregatorName
        ? { aggregatorName: cached.provenance.aggregatorName }
        : {}),
    };
  }

  /**
   * Paginacion real basada en page/pageSize (requerido por el contrato de
   * search_cases) sobre un backend que solo soporta cursores opacos
   * (search_after/next_cursor, ver docs/provider-contracts/entscheidsuche.md).
   * Para `page > 1` se recorren las paginas anteriores secuencialmente
   * descartando resultados intermedios -- O(page) llamadas remotas, no
   * acceso aleatorio real. Aceptable para Fase 2; documentado como
   * limitacion conocida.
   */
  private async advanceCursor(
    toolName: "search",
    params: SearchCasesParams,
    hierarchy: string[] | undefined,
    pageSize: number,
    targetPage: number,
  ): Promise<unknown[] | undefined> {
    if (targetPage <= 1) return undefined;

    let cursor: unknown[] | undefined;
    for (let currentPage = 1; currentPage < targetPage; currentPage += 1) {
      const result = await this.remoteClient.callTool(toolName, {
        query: params.query,
        size: pageSize,
        ...(params.language ? { language_filter: [params.language] } : {}),
        ...(params.dateFrom ? { decision_date_from: params.dateFrom } : {}),
        ...(params.dateTo ? { decision_date_to: params.dateTo } : {}),
        ...(hierarchy ? { hierarchy } : {}),
        ...(cursor ? { search_after: cursor } : {}),
      });
      const parsed = remoteSearchResponseSchema.parse(extractStructuredResult(result));
      if (!parsed.next_cursor) return undefined;
      cursor = parsed.next_cursor;
    }
    return cursor;
  }
}
