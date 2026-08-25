import {
  NotFoundError,
  ProviderUnavailableError,
  type DocumentId,
  type HealthStatus,
  type LegalSourceProvider,
  type SearchQuery,
  type SearchResult,
  type SourceAttribution,
} from "@swiss-legal-mcp/core";
import type {
  AdministrativeDocumentType,
  Language,
  NormalizedDocument,
} from "@swiss-legal-mcp/documents";
import { TtlCache } from "@swiss-legal-mcp/shared";
import {
  extractPdfText,
  SecureHttpClient,
  buildOfficialSourceAttribution,
  buildAdministrativeCircularDocument,
  DEFAULT_ADMINISTRATIVE_USER_AGENT,
} from "@swiss-legal-mcp/shared-web";
import { loadSecoConfig, type SecoConfig } from "./config.js";
import { parseSecoListing, SECO_LANGUAGES, type SecoListingItem } from "./listingParser.js";
import { buildSecoDocumentId, mapSecoItemToNormalizedDocument } from "./mapper.js";

const PROVIDER_ID = "seco";

export interface SecoSearchParams {
  readonly query?: string;
  readonly language?: Language;
  readonly documentType?: AdministrativeDocumentType;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface SecoSearchOutcome {
  readonly results: NormalizedDocument[];
  readonly pagination: { readonly page: number; readonly pageSize: number; readonly total: number };
  readonly appliedFilters: SecoSearchParams;
  readonly sourceAttribution: SourceAttribution;
  readonly coverageWarnings: readonly string[];
}

interface LoadedListing {
  readonly items: SecoListingItem[];
  readonly listingUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
}

const COVERAGE_WARNING =
  "SECO no publica un archivo historico para las Weisungen 'nucleo' (KAE, SWE, RVEI, ALE, AMM, IE, oAV, ALE 883): solo se lista la version vigente de cada una. Las Fachweisungen numeradas se acumulan y no se sustituyen entre si.";

/**
 * Proveedor real de documentacion administrativa de SECO (arbeit.swiss),
 * Fase 4 -- ver docs/providers/seco.md y docs/provider-contracts/seco.md.
 * Nunca hace scraping mas alla de la pagina HTML publica de publicaciones ni
 * inventa una API: parsea el HTML real (listingParser.ts) y descarga los PDF
 * reales via el cliente HTTP seguro compartido (packages/shared-web).
 */
export class SecoProvider implements LegalSourceProvider {
  readonly id = PROVIDER_ID;

  private readonly config: SecoConfig;
  private readonly httpClient: SecureHttpClient;
  private readonly listingCache: TtlCache<LoadedListing>;
  private readonly documentCache: TtlCache<NormalizedDocument>;

  constructor(config: SecoConfig = loadSecoConfig(), httpClient?: SecureHttpClient) {
    this.config = config;
    this.httpClient =
      httpClient ??
      new SecureHttpClient({
        providerId: PROVIDER_ID,
        allowedDomains: config.allowedOfficialDomains,
        dnsLookup: config.dnsLookup,
        timeoutMs: config.timeoutMs,
        maxResponseBytes: config.maxResponseBytes,
        maxRetries: config.maxRetries,
        retryBaseDelayMs: config.retryBaseDelayMs,
        retryMaxDelayMs: config.retryMaxDelayMs,
        circuitBreakerFailureThreshold: config.circuitBreakerFailureThreshold,
        circuitBreakerResetMs: config.circuitBreakerResetMs,
        userAgent: DEFAULT_ADMINISTRATIVE_USER_AGENT,
      });
    this.listingCache = new TtlCache(config.cacheTtlListingMs, config.cacheMaxEntries);
    this.documentCache = new TtlCache(config.cacheTtlDocumentMs, config.cacheMaxEntries);
  }

  private listingUrlFor(language: Language): string {
    return language === "fr" ? this.config.listingUrls.fr : this.config.listingUrls.de;
  }

  private async loadListing(language: Language): Promise<LoadedListing> {
    const cacheKey = `listing:${language}`;
    const cached = this.listingCache.get(cacheKey);
    if (cached) return cached;

    const listingUrl = this.listingUrlFor(language);
    const response = await this.httpClient.get(listingUrl, {
      expectedContentTypeIncludes: ["text/html"],
    });
    const html = new TextDecoder().decode(response.bytes);
    const items = parseSecoListing(html, listingUrl);
    const loaded: LoadedListing = {
      items,
      listingUrl: response.finalUrl,
      retrievedAt: response.retrievedAt,
      contentHash: response.contentHash,
    };
    this.listingCache.set(cacheKey, loaded);
    return loaded;
  }

  private async findItemById(
    id: string,
  ): Promise<{ item: SecoListingItem; language: Language; listingUrl: string } | undefined> {
    const rawId = id.startsWith(`${PROVIDER_ID}:`) ? id.slice(PROVIDER_ID.length + 1) : id;
    const [language] = rawId.split(":") as [Language];
    if (!SECO_LANGUAGES.includes(language)) return undefined;

    const { items, listingUrl } = await this.loadListing(language);
    const item = items.find(
      (candidate) => buildSecoDocumentId(language, candidate.downloadUrl) === id,
    );
    return item ? { item, language, listingUrl } : undefined;
  }

  async searchDocuments(params: SecoSearchParams): Promise<SecoSearchOutcome> {
    const language = params.language ?? "de";
    const pageSize = params.pageSize ?? 20;
    const page = params.page ?? 1;

    const { items, listingUrl, retrievedAt, contentHash } = await this.loadListing(language);

    const queryLower = params.query?.toLowerCase();
    const filtered = items.filter((item) => {
      if (queryLower && !item.title.toLowerCase().includes(queryLower)) return false;
      if (params.dateFrom && item.publicationDate && item.publicationDate < params.dateFrom)
        return false;
      if (params.dateTo && item.publicationDate && item.publicationDate > params.dateTo)
        return false;
      return true;
    });

    const documents = filtered.map((item) =>
      mapSecoItemToNormalizedDocument(item, { language, listingUrl, retrievedAt, contentHash }),
    );

    const typeFiltered = params.documentType
      ? documents.filter(
          (doc) => doc.administrativeCircular?.administrativeDocumentType === params.documentType,
        )
      : documents;

    const start = (page - 1) * pageSize;
    const pageItems = typeFiltered.slice(start, start + pageSize);

    return {
      results: pageItems,
      pagination: { page, pageSize, total: typeFiltered.length },
      appliedFilters: params,
      sourceAttribution: buildOfficialSourceAttribution(listingUrl, retrievedAt),
      coverageWarnings: [COVERAGE_WARNING],
    };
  }

  async fetchDocument(id: string): Promise<NormalizedDocument> {
    const cached = this.documentCache.get(id);
    if (cached) return cached;

    const found = await this.findItemById(id);
    if (!found) {
      throw new NotFoundError(id, `No existe ningun documento SECO con id '${id}'.`);
    }
    const { item, language, listingUrl } = found;

    const pdfResponse = await this.httpClient.get(item.downloadUrl, {
      expectedContentTypeIncludes: ["application/pdf"],
    });
    const { text } = await extractPdfText(pdfResponse.bytes);

    const doc = mapSecoItemToNormalizedDocument(item, {
      language,
      listingUrl,
      retrievedAt: pdfResponse.retrievedAt,
      contentHash: pdfResponse.contentHash,
      fullText: text,
    });
    this.documentCache.set(id, doc);
    return doc;
  }

  /**
   * Recupera un documento a partir de una URL oficial ya validada por el
   * llamador (herramienta `get_official_document`), sin pasar por el listado
   * (p.ej. un enlace obtenido fuera de banda). El dominio se valida igualmente
   * dentro de `SecureHttpClient.get` contra la allowlist SSRF de SECO. Al no
   * provenir del listado no hay titulo/codigo de practica reales disponibles:
   * se construye un documento minimo, marcado explicitamente como resuelto
   * desde una URL cruda en `rawMetadata`, sin inventar metadatos ausentes.
   */
  async fetchDocumentByUrl(url: string): Promise<NormalizedDocument> {
    const cacheKey = `url:${url}`;
    const cached = this.documentCache.get(cacheKey);
    if (cached) return cached;

    const pdfResponse = await this.httpClient.get(url, {
      expectedContentTypeIncludes: ["application/pdf"],
    });
    const { text } = await extractPdfText(pdfResponse.bytes);
    const filename = new URL(url).pathname.split("/").pop() ?? url;

    const doc = buildAdministrativeCircularDocument({
      id: `${PROVIDER_ID}:url:${encodeURIComponent(url)}`,
      provider: PROVIDER_ID,
      authority: "SECO",
      sourceOriginalId: url,
      title: filename,
      jurisdiction: { level: "federal" },
      fullText: text,
      administrativeCircular: { administrativeDocumentType: "other", status: "unknown" },
      provenance: {
        sourceUrl: url,
        downloadUrl: url,
        retrievedAt: pdfResponse.retrievedAt,
        contentHash: pdfResponse.contentHash,
      },
      rawMetadata: { resolvedFromRawUrl: true },
    });
    this.documentCache.set(cacheKey, doc);
    return doc;
  }

  // ---- LegalSourceProvider ----

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const outcome = await this.searchDocuments({
      ...(query.text ? { query: query.text } : {}),
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
    return this.fetchDocument(id);
  }

  async getMetadata(id: DocumentId): Promise<Record<string, unknown>> {
    const doc = await this.fetchDocument(id);
    return doc.rawMetadata;
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      await this.loadListing("de");
      return { healthy: true, checkedAt: new Date().toISOString() };
    } catch (error) {
      return {
        healthy: false,
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Implementacion de la interfaz generica `LegalSourceProvider.normalize`
   * para un item ya parseado (sin volver a descargar nada): el contentHash
   * es un valor no verificable en este punto (no hay descarga real asociada
   * a esta llamada) y se marca explicitamente como tal en rawMetadata --
   * nunca se presenta como si fuese el hash real de un contenido descargado.
   */
  normalize(raw: unknown): NormalizedDocument {
    const item = raw as SecoListingItem & { language: Language; listingUrl: string };
    const doc = mapSecoItemToNormalizedDocument(item, {
      language: item.language,
      listingUrl: item.listingUrl,
      retrievedAt: new Date().toISOString(),
      contentHash: "0".repeat(64),
    });
    return { ...doc, rawMetadata: { ...doc.rawMetadata, contentHashUnverified: true } };
  }

  getSourceAttribution(id: DocumentId): SourceAttribution {
    const cached = this.documentCache.get(id);
    if (!cached) {
      throw new ProviderUnavailableError(
        PROVIDER_ID,
        `getSourceAttribution('${id}') requiere haber llamado antes a getDocument.`,
      );
    }
    return {
      sourceUrl: cached.provenance.sourceUrl,
      retrievedAt: cached.provenance.retrievedAt,
      officialCharacter: cached.provenance.officialCharacter,
    };
  }
}
