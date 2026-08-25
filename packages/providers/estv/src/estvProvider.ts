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
import type { NormalizedDocument } from "@swiss-legal-mcp/documents";
import { TtlCache } from "@swiss-legal-mcp/shared";
import {
  extractPdfText,
  SecureHttpClient,
  buildOfficialSourceAttribution,
  buildAdministrativeCircularDocument,
  DEFAULT_ADMINISTRATIVE_USER_AGENT,
} from "@swiss-legal-mcp/shared-web";
import { loadEstvConfig, type EstvConfig } from "./config.js";
import { parseEstvListing, type EstvListingItem } from "./listingParser.js";
import { buildEstvDocumentId, mapEstvItemToNormalizedDocument } from "./mapper.js";

const PROVIDER_ID = "estv";

export interface EstvSearchParams {
  readonly query?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface EstvSearchOutcome {
  readonly results: NormalizedDocument[];
  readonly pagination: { readonly page: number; readonly pageSize: number; readonly total: number };
  readonly appliedFilters: EstvSearchParams;
  readonly sourceAttribution: SourceAttribution;
  readonly coverageWarnings: readonly string[];
}

const COVERAGE_WARNING =
  "Solo el portal clasico de ESTV (www.estv.admin.ch/de/kreisschreiben-*) esta implementado. El sistema JSF de MWST-Infos (gate.estv.admin.ch) requiere JavaScript real para mostrar el texto de cada capitulo (verificado en vivo) y no se consulta en esta fase. Los numeros de referencia observados (nombre de archivo, aria-label, pie de pagina del PDF) no siempre coinciden entre si.";

interface LoadedListing {
  readonly items: EstvListingItem[];
  readonly listingUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
}

/**
 * Proveedor real de circulares de ESTV/AFC (www.estv.admin.ch), Fase 4 --
 * ver docs/providers/estv.md y docs/provider-contracts/estv.md. Solo
 * implementa el portal clasico (3 paginas de Kreisschreiben); nunca inventa
 * el sistema JSF de MWST-Infos, documentado pero fuera de alcance.
 */
export class EstvProvider implements LegalSourceProvider {
  readonly id = PROVIDER_ID;

  private readonly config: EstvConfig;
  private readonly httpClient: SecureHttpClient;
  private readonly listingCache: TtlCache<LoadedListing>;
  private readonly documentCache: TtlCache<NormalizedDocument>;

  constructor(config: EstvConfig = loadEstvConfig(), httpClient?: SecureHttpClient) {
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

  private listingUrls(): readonly string[] {
    return [
      this.config.listingUrls.direkteBundessteuer,
      this.config.listingUrls.stempelabgaben,
      this.config.listingUrls.verrechnungssteuer,
    ];
  }

  private async loadListing(listingUrl: string): Promise<LoadedListing> {
    const cacheKey = `listing:${listingUrl}`;
    const cached = this.listingCache.get(cacheKey);
    if (cached) return cached;

    const response = await this.httpClient.get(listingUrl, {
      expectedContentTypeIncludes: ["text/html"],
    });
    const html = new TextDecoder().decode(response.bytes);
    const items = parseEstvListing(html);
    const loaded: LoadedListing = {
      items,
      listingUrl: response.finalUrl,
      retrievedAt: response.retrievedAt,
      contentHash: response.contentHash,
    };
    this.listingCache.set(cacheKey, loaded);
    return loaded;
  }

  private async loadAllListings(): Promise<LoadedListing[]> {
    return Promise.all(this.listingUrls().map((url) => this.loadListing(url)));
  }

  async searchDocuments(params: EstvSearchParams): Promise<EstvSearchOutcome> {
    const pageSize = params.pageSize ?? 20;
    const page = params.page ?? 1;

    const listings = await this.loadAllListings();
    const primaryListing = listings[0];
    if (!primaryListing) {
      throw new ProviderUnavailableError(
        PROVIDER_ID,
        "No hay ninguna pagina de listado ESTV configurada.",
      );
    }

    const queryLower = params.query?.toLowerCase();
    const documents: NormalizedDocument[] = [];
    for (const listing of listings) {
      for (const item of listing.items) {
        if (queryLower) {
          const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
          if (!haystack.includes(queryLower)) continue;
        }
        if (params.dateFrom && item.issuedDate && item.issuedDate < params.dateFrom) continue;
        if (params.dateTo && item.issuedDate && item.issuedDate > params.dateTo) continue;

        documents.push(
          mapEstvItemToNormalizedDocument(item, {
            listingUrl: listing.listingUrl,
            retrievedAt: listing.retrievedAt,
            contentHash: listing.contentHash,
          }),
        );
      }
    }

    const start = (page - 1) * pageSize;
    const pageItems = documents.slice(start, start + pageSize);

    return {
      results: pageItems,
      pagination: { page, pageSize, total: documents.length },
      appliedFilters: params,
      sourceAttribution: buildOfficialSourceAttribution(
        primaryListing.listingUrl,
        primaryListing.retrievedAt,
      ),
      coverageWarnings: [COVERAGE_WARNING],
    };
  }

  private async findItemById(
    id: string,
  ): Promise<{ item: EstvListingItem; listingUrl: string } | undefined> {
    const listings = await this.loadAllListings();
    for (const listing of listings) {
      const item = listing.items.find((candidate) => buildEstvDocumentId(candidate) === id);
      if (item) return { item, listingUrl: listing.listingUrl };
    }
    return undefined;
  }

  async fetchDocument(id: string): Promise<NormalizedDocument> {
    const cached = this.documentCache.get(id);
    if (cached) return cached;

    const found = await this.findItemById(id);
    if (!found) {
      throw new NotFoundError(id, `No existe ningun documento ESTV con id '${id}'.`);
    }
    const { item, listingUrl } = found;

    const pdfResponse = await this.httpClient.get(item.downloadUrl, {
      expectedContentTypeIncludes: ["application/pdf"],
    });
    const { text } = await extractPdfText(pdfResponse.bytes);

    const doc = mapEstvItemToNormalizedDocument(item, {
      listingUrl,
      retrievedAt: pdfResponse.retrievedAt,
      contentHash: pdfResponse.contentHash,
      fullText: text,
    });
    this.documentCache.set(id, doc);
    return doc;
  }

  /** Ver SecoProvider.fetchDocumentByUrl: mismo patron para una URL oficial validada fuera del listado. */
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
      authority: "ESTV/AFC",
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
      await this.loadListing(this.config.listingUrls.direkteBundessteuer);
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
    const item = raw as EstvListingItem & { listingUrl: string };
    const doc = mapEstvItemToNormalizedDocument(item, {
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
