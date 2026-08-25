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
import {
  parseNormalizedDocument,
  type NormalizedDocument,
  type Language,
} from "@swiss-legal-mcp/documents";
import { TtlCache } from "@swiss-legal-mcp/shared";
import {
  SecureHttpClient,
  buildOfficialSourceAttribution,
  extractSanitizedText,
  parseHtml,
  DEFAULT_ADMINISTRATIVE_USER_AGENT,
} from "@swiss-legal-mcp/shared-web";
import type { CantonalSilConfig } from "./config.js";

interface SilCatalogEntry {
  readonly headingText: string;
  readonly relativeUrl: string;
  readonly docKey: string;
}

interface LoadedSilCatalog {
  readonly entries: readonly SilCatalogEntry[];
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
}

export interface CantonalSilSearchParams {
  readonly query?: string;
  readonly systematicNumber?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface CantonalSilSearchOutcome {
  readonly results: NormalizedDocument[];
  readonly pagination: { readonly page: number; readonly pageSize: number; readonly total: number };
  readonly sourceAttribution: SourceAttribution;
  readonly coverageWarnings: readonly string[];
}

/** Excluye enlaces reales de navegación/anexos que no son leyes individuales (toc, tabla de abreviaturas, etc.). */
const NON_DOCUMENT_HREF = /^(toc|abtoc|home|silwebext:)/i;

/**
 * Adaptador reutilizable para la plataforma real "SIL" (ARCHILEXMP sa),
 * confirmada en vivo compartida por Ginebra (GE) y Neuchâtel (NE) durante
 * el cierre de cobertura cantonal: mismo esquema de URL real
 * `{baseUrl}/{bookPath}/content.htm` (árbol `<h1>/<h2>/<h3>` con enlaces
 * `htm/{id}.htm` a leyes individuales reales, texto exportado desde Word)
 * y mismo script `LVMP.js`. NO se comparte con Jura (producto/vendor
 * distinto, verificado explícitamente en la auditoría) -- ver
 * docs/provider-contracts/cantonal-sil.md.
 *
 * Cubre únicamente el "libro" de ley vigente (`bookPath`), no los libros
 * secundarios reales que también existen (modificaciones futuras,
 * concordatos, legislación comunal, etc. -- ver limitación documentada).
 * No implementa extracción de artículo individual: el HTML exportado desde
 * Word no tiene una estructura de artículo verificada de forma fiable
 * dentro del tiempo de auditoría disponible -- `getArticle` lanza
 * explícitamente en vez de aproximar.
 */
export class CantonalSilProvider implements LegalSourceProvider {
  readonly id: string;

  private readonly config: CantonalSilConfig;
  private readonly httpClient: SecureHttpClient;
  private readonly catalogCache: TtlCache<LoadedSilCatalog>;
  private readonly documentCache: TtlCache<NormalizedDocument>;

  constructor(config: CantonalSilConfig, httpClient?: SecureHttpClient) {
    this.config = config;
    this.id = `cantonal-${config.cantonCode.toLowerCase()}`;
    this.httpClient =
      httpClient ??
      new SecureHttpClient({
        providerId: this.id,
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

  private bookUrl(): string {
    return `${this.config.baseUrl}/${this.config.bookPath}`;
  }

  private async loadCatalog(): Promise<LoadedSilCatalog> {
    const cached = this.catalogCache.get("catalog");
    if (cached) return cached;

    const url = `${this.bookUrl()}/content.htm`;
    const response = await this.httpClient.get(url, {
      expectedContentTypeIncludes: ["text/html"],
    });
    const html = decodeSilHtml(response.bytes);
    const $ = parseHtml(html);

    const entries: SilCatalogEntry[] = [];
    $("h3 a, h4 a").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim();
      if (!href || !text) return;
      if (NON_DOCUMENT_HREF.test(href)) return;
      if (!/^htm\//i.test(href)) return;
      const docKey = href.replace(/^htm\//i, "").replace(/\.htm.*$/i, "");
      entries.push({ headingText: text, relativeUrl: href, docKey });
    });

    if (entries.length === 0) {
      throw new ProviderUnavailableError(
        this.id,
        `No se encontró ninguna entrada real en el catálogo SIL de ${this.config.cantonName} ('${url}') -- posible cambio de estructura HTML.`,
      );
    }

    const loaded: LoadedSilCatalog = {
      entries,
      sourceUrl: response.finalUrl,
      retrievedAt: response.retrievedAt,
      contentHash: response.contentHash,
    };
    this.catalogCache.set("catalog", loaded);
    return loaded;
  }

  private mapEntry(entry: SilCatalogEntry, loaded: LoadedSilCatalog): NormalizedDocument {
    return parseNormalizedDocument({
      id: `${this.id}:${entry.docKey}`,
      provider: this.id,
      documentType: "official_publication",
      jurisdiction: { level: "cantonal", canton: this.config.cantonCode },
      authority: `Canton ${this.config.cantonName}`,
      sourceOriginalId: entry.docKey,
      date: {},
      language: this.config.language as Language,
      title: entry.headingText,
      provenance: {
        sourceUrl: loaded.sourceUrl,
        downloadUrl: `${this.bookUrl()}/${entry.relativeUrl}`,
        retrievedAt: loaded.retrievedAt,
        contentHash: loaded.contentHash,
        officialCharacter: "official",
      },
      rawMetadata: {
        docKey: entry.docKey,
        headingText: entry.headingText,
        platform: "sil-archilexmp",
        book: this.config.bookPath,
      },
      contentNature: "summary",
    });
  }

  async searchDocuments(params: CantonalSilSearchParams): Promise<CantonalSilSearchOutcome> {
    const pageSize = params.pageSize ?? 20;
    const page = params.page ?? 1;
    const loaded = await this.loadCatalog();

    const queryLower = params.query?.toLowerCase();
    const numberPrefix = params.systematicNumber
      ? new RegExp(`^${escapeRegExp(params.systematicNumber)}\\s`)
      : undefined;
    const filtered = loaded.entries.filter((entry) => {
      if (numberPrefix && !numberPrefix.test(entry.headingText)) return false;
      if (queryLower && !entry.headingText.toLowerCase().includes(queryLower)) return false;
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
        `Solo cubre el libro de ley vigente ('${this.config.bookPath}'); ${this.config.cantonName} publica libros adicionales reales (modificaciones futuras, concordatos, legislación comunal, etc.) no cubiertos en esta fase. Sin búsqueda de texto libre real: este resultado filtra en memoria sobre el catálogo del libro.`,
      ],
    };
  }

  private parseDocKeyFromId(id: DocumentId): string {
    const rawId = id.startsWith(`${this.id}:`) ? id.slice(this.id.length + 1) : id;
    if (!rawId) throw new NotFoundError(id, `Id de ley inválido para ${this.id}: '${id}'.`);
    return rawId;
  }

  async getDocument(id: DocumentId): Promise<NormalizedDocument> {
    const cached = this.documentCache.get(id);
    if (cached) return cached;

    const docKey = this.parseDocKeyFromId(id);
    const loaded = await this.loadCatalog();
    const entry = loaded.entries.find((candidate) => candidate.docKey === docKey);
    if (!entry) {
      throw new NotFoundError(
        id,
        `No existe ninguna ley con identificador '${docKey}' en el catálogo SIL de ${this.config.cantonName}.`,
      );
    }

    const docUrl = `${this.bookUrl()}/${entry.relativeUrl}`;
    const response = await this.httpClient.get(docUrl, {
      expectedContentTypeIncludes: ["text/html"],
    });
    const html = decodeSilHtml(response.bytes);
    const fullText = extractSanitizedText(html);

    const doc = parseNormalizedDocument({
      id: `${this.id}:${entry.docKey}`,
      provider: this.id,
      documentType: "official_publication",
      jurisdiction: { level: "cantonal", canton: this.config.cantonCode },
      authority: `Canton ${this.config.cantonName}`,
      sourceOriginalId: entry.docKey,
      date: {},
      language: this.config.language as Language,
      title: entry.headingText,
      fullText,
      provenance: {
        sourceUrl: docUrl,
        downloadUrl: docUrl,
        retrievedAt: response.retrievedAt,
        contentHash: response.contentHash,
        officialCharacter: "official",
      },
      rawMetadata: {
        docKey: entry.docKey,
        headingText: entry.headingText,
        platform: "sil-archilexmp",
        book: this.config.bookPath,
        contentFormat: "html",
      },
      contentNature: "literal",
    });
    this.documentCache.set(id, doc);
    return doc;
  }

  /** No soportado: el HTML exportado desde Word no tiene estructura de artículo verificada de forma fiable. */
  async getArticle(docKey: string, _articleNumber: string): Promise<never> {
    throw new ProviderUnavailableError(
      this.id,
      `${this.config.cantonName} no soporta recuperación de artículo individual: la ley '${docKey}' solo está disponible como documento completo (HTML exportado desde Word, sin estructura de artículo verificada de forma fiable en la auditoría). Use get_cantonal_law para el documento completo.`,
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
    const docKey = this.parseDocKeyFromId(id);
    const loaded = await this.loadCatalog();
    const entry = loaded.entries.find((candidate) => candidate.docKey === docKey);
    if (!entry) {
      throw new NotFoundError(id, `No existe ninguna ley con identificador '${docKey}'.`);
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
        this.id,
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Decodifica el HTML real de la plataforma SIL, que declara
 * `charset=windows-1252` en un `<meta>` interno pero cuya cabecera HTTP
 * real NO incluye charset (verificado en vivo en GE y NE: `Content-Type:
 * text/html`, sin `charset=`) -- decodificar con UTF-8 por defecto
 * corrompería los acentos franceses reales. Se sniffea primero un
 * prefijo corto en latin1 (suficiente para leer la declaración ASCII del
 * meta tag) y se decodifica el documento completo con el charset
 * realmente declarado.
 */
function decodeSilHtml(bytes: Uint8Array): string {
  const prefix = new TextDecoder("windows-1252").decode(bytes.slice(0, 512));
  const match = /charset=["']?([\w-]+)/i.exec(prefix);
  const charset = match?.[1]?.toLowerCase() ?? "windows-1252";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
