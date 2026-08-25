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
import { parseNormalizedDocument, type NormalizedDocument } from "@swiss-legal-mcp/documents";
import { TtlCache } from "@swiss-legal-mcp/shared";
import {
  SecureHttpClient,
  buildOfficialSourceAttribution,
  extractPdfText,
  parseHtml,
  DEFAULT_ADMINISTRATIVE_USER_AGENT,
} from "@swiss-legal-mcp/shared-web";
import type { CantonalSzConfig } from "./config.js";

const PROVIDER_ID = "cantonal-sz";

interface SzCatalogEntry {
  readonly srszNumber: string;
  readonly title: string;
  readonly pdfUrl: string;
}

interface LoadedSzCatalog {
  readonly entries: readonly SzCatalogEntry[];
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
}

export interface CantonalSzSearchParams {
  readonly query?: string;
  readonly systematicNumber?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface CantonalSzSearchOutcome {
  readonly results: NormalizedDocument[];
  readonly pagination: { readonly page: number; readonly pageSize: number; readonly total: number };
  readonly sourceAttribution: SourceAttribution;
  readonly coverageWarnings: readonly string[];
}

/**
 * Adaptador para el Cantón de Schwyz (SZ), Fase de cierre cantonal -- ver
 * docs/provider-contracts/cantonal-sz.md. La colección sistemática real
 * vive en UNA sola página HTML (`{baseUrl}{collectionPath}`) con una tabla
 * real de 425 entradas verificadas (`<tr><td><a href="...pdf">SRSZ</a></td>
 * <td>Título, vom Fecha</td></tr>`), sin API ni buscador propio de la
 * colección. `search`/`getDocument` filtran/leen ese catálogo parseado una
 * sola vez (cacheado). Los PDF son reales y basados en texto (verificado
 * con 3 ejemplos reales en la auditoría); un PDF escaneado sin capa de
 * texto se rechaza explícitamente vía `NonTextualDocumentError`
 * (`extractPdfText`), nunca con OCR. No hay estructura de artículo
 * verificable dentro del PDF -- `getArticle` no está soportado.
 */
export class CantonalSzProvider implements LegalSourceProvider {
  readonly id = PROVIDER_ID;

  private readonly config: CantonalSzConfig;
  private readonly httpClient: SecureHttpClient;
  private readonly catalogCache: TtlCache<LoadedSzCatalog>;
  private readonly documentCache: TtlCache<NormalizedDocument>;

  constructor(config: CantonalSzConfig, httpClient?: SecureHttpClient) {
    this.config = config;
    this.httpClient =
      httpClient ??
      new SecureHttpClient({
        providerId: PROVIDER_ID,
        allowedDomains: config.allowedOfficialDomains,
        timeoutMs: config.timeoutMs,
        maxResponseBytes: config.maxResponseBytes,
        maxRetries: config.maxRetries,
        retryBaseDelayMs: config.retryBaseDelayMs,
        retryMaxDelayMs: config.retryMaxDelayMs,
        circuitBreakerFailureThreshold: config.circuitBreakerFailureThreshold,
        circuitBreakerResetMs: config.circuitBreakerResetMs,
        userAgent: DEFAULT_ADMINISTRATIVE_USER_AGENT,
      });
    this.catalogCache = new TtlCache(config.cacheTtlMs, config.cacheMaxEntries);
    this.documentCache = new TtlCache(config.cacheTtlMs, config.cacheMaxEntries);
  }

  private async loadCatalog(): Promise<LoadedSzCatalog> {
    const cached = this.catalogCache.get("catalog");
    if (cached) return cached;

    const url = `${this.config.baseUrl}${this.config.collectionPath}`;
    const response = await this.httpClient.get(url, {
      expectedContentTypeIncludes: ["text/html"],
    });
    const html = new TextDecoder().decode(response.bytes);
    const $ = parseHtml(html);

    const entries: SzCatalogEntry[] = [];
    $("tr").each((_, row) => {
      const link = $(row).find("td").first().find("a").first();
      const href = link.attr("href");
      if (!href || !/\.pdf(\?|$)/i.test(href)) return;
      const srszNumber = link.text().trim();
      const title = $(row).find("td").eq(1).text().trim();
      if (!srszNumber || !title) return;
      entries.push({ srszNumber, title, pdfUrl: href });
    });

    if (entries.length === 0) {
      throw new ProviderUnavailableError(
        PROVIDER_ID,
        `No se encontró ninguna entrada real en la colección sistemática de Schwyz ('${url}') -- posible cambio de estructura HTML.`,
      );
    }

    const loaded: LoadedSzCatalog = {
      entries,
      sourceUrl: response.finalUrl,
      retrievedAt: response.retrievedAt,
      contentHash: response.contentHash,
    };
    this.catalogCache.set("catalog", loaded);
    return loaded;
  }

  private mapEntry(entry: SzCatalogEntry, loaded: LoadedSzCatalog): NormalizedDocument {
    return parseNormalizedDocument({
      id: `${PROVIDER_ID}:${entry.srszNumber}`,
      provider: PROVIDER_ID,
      documentType: "official_publication",
      jurisdiction: { level: "cantonal", canton: "SZ" },
      authority: "Kanton Schwyz",
      sourceOriginalId: entry.srszNumber,
      date: {},
      language: "de",
      title: entry.title,
      provenance: {
        sourceUrl: loaded.sourceUrl,
        downloadUrl: entry.pdfUrl,
        retrievedAt: loaded.retrievedAt,
        contentHash: loaded.contentHash,
        officialCharacter: "official",
      },
      rawMetadata: {
        srszNumber: entry.srszNumber,
        pdfUrl: entry.pdfUrl,
        platform: "sz-collection-html",
      },
      contentNature: "summary",
    });
  }

  async searchDocuments(params: CantonalSzSearchParams): Promise<CantonalSzSearchOutcome> {
    const pageSize = params.pageSize ?? 20;
    const page = params.page ?? 1;
    const loaded = await this.loadCatalog();

    const queryLower = params.query?.toLowerCase();
    const filtered = loaded.entries.filter((entry) => {
      if (params.systematicNumber && entry.srszNumber !== params.systematicNumber) return false;
      if (queryLower && !entry.title.toLowerCase().includes(queryLower)) return false;
      return true;
    });

    const documents = filtered.map((entry) => this.mapEntry(entry, loaded));
    const start = (page - 1) * pageSize;
    const pageItems = documents.slice(start, start + pageSize);

    return {
      results: pageItems,
      pagination: { page, pageSize, total: documents.length },
      sourceAttribution: buildOfficialSourceAttribution(loaded.sourceUrl, loaded.retrievedAt),
      coverageWarnings: [
        "Catálogo real de Schwyz (425 entradas verificadas en una única página HTML); no existe buscador propio de la colección (el buscador del sitio es genérico, no específico de legislación) -- este resultado filtra en memoria sobre el catálogo. Sin historial de versiones verificado: solo se expone la versión vigente.",
      ],
    };
  }

  private parseSrszFromId(id: DocumentId): string {
    const rawId = id.startsWith(`${PROVIDER_ID}:`) ? id.slice(PROVIDER_ID.length + 1) : id;
    if (!rawId) throw new NotFoundError(id, `Id de ley de Schwyz inválido: '${id}'.`);
    return rawId;
  }

  async getDocument(id: DocumentId): Promise<NormalizedDocument> {
    const cached = this.documentCache.get(id);
    if (cached) return cached;

    const srszNumber = this.parseSrszFromId(id);
    const loaded = await this.loadCatalog();
    const entry = loaded.entries.find((candidate) => candidate.srszNumber === srszNumber);
    if (!entry) {
      throw new NotFoundError(
        id,
        `No existe ninguna ley con número SRSZ '${srszNumber}' en el catálogo real de Schwyz.`,
      );
    }

    const pdfResponse = await this.httpClient.get(entry.pdfUrl, {
      expectedContentTypeIncludes: ["application/pdf"],
    });
    const { text } = await extractPdfText(pdfResponse.bytes);

    const doc = parseNormalizedDocument({
      id: `${PROVIDER_ID}:${entry.srszNumber}`,
      provider: PROVIDER_ID,
      documentType: "official_publication",
      jurisdiction: { level: "cantonal", canton: "SZ" },
      authority: "Kanton Schwyz",
      sourceOriginalId: entry.srszNumber,
      date: {},
      language: "de",
      title: entry.title,
      fullText: text,
      provenance: {
        sourceUrl: loaded.sourceUrl,
        downloadUrl: entry.pdfUrl,
        retrievedAt: pdfResponse.retrievedAt,
        contentHash: pdfResponse.contentHash,
        officialCharacter: "official",
      },
      rawMetadata: {
        srszNumber: entry.srszNumber,
        pdfUrl: entry.pdfUrl,
        platform: "sz-collection-html",
        contentFormat: "pdf",
      },
      contentNature: "literal",
    });
    this.documentCache.set(id, doc);
    return doc;
  }

  /** No soportado: los PDF de Schwyz no tienen estructura de artículo verificable. */
  async getArticle(systematicNumber: string, _articleNumber: string): Promise<never> {
    throw new ProviderUnavailableError(
      PROVIDER_ID,
      `Schwyz (SZ) no soporta recuperación de artículo individual: la ley '${systematicNumber}' solo está disponible como PDF completo, sin estructura de artículo verificable en la auditoría. Use get_cantonal_law para el documento completo.`,
    );
  }

  // ---- LegalSourceProvider ----

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const outcome = await this.searchDocuments({
      ...(query.text ? { query: query.text } : {}),
      ...(query.limit ? { pageSize: query.limit } : {}),
    });
    return outcome.results.map((doc) => ({ id: doc.id, title: doc.title }));
  }

  async getMetadata(id: DocumentId): Promise<Record<string, unknown>> {
    const srszNumber = this.parseSrszFromId(id);
    const loaded = await this.loadCatalog();
    const entry = loaded.entries.find((candidate) => candidate.srszNumber === srszNumber);
    if (!entry) {
      throw new NotFoundError(id, `No existe ninguna ley con número SRSZ '${srszNumber}'.`);
    }
    return this.mapEntry(entry, loaded).rawMetadata;
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const loaded = await this.loadCatalog();
      return { healthy: loaded.entries.length > 0, checkedAt: new Date().toISOString() };
    } catch (error) {
      return {
        healthy: false,
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  normalize(raw: unknown): NormalizedDocument {
    return parseNormalizedDocument(raw);
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
