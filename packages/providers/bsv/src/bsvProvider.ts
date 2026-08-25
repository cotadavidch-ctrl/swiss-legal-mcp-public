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
import { loadBsvConfig, type BsvConfig } from "./config.js";
import { parseBsvFolderListing, type BsvFolderListingItem } from "./folderListingParser.js";
import { parseBsvDocumentPage, type BsvVersionDetail } from "./documentPageParser.js";
import { extractBsvDates } from "./referenceExtractor.js";
import { mapBsvVersionToNormalizedDocument } from "./mapper.js";

const PROVIDER_ID = "bsv";

export interface BsvSearchParams {
  readonly query?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface BsvSearchOutcome {
  readonly results: NormalizedDocument[];
  readonly pagination: { readonly page: number; readonly pageSize: number; readonly total: number };
  readonly appliedFilters: BsvSearchParams;
  readonly sourceAttribution: SourceAttribution;
  readonly coverageWarnings: readonly string[];
}

const COVERAGE_WARNING =
  "Solo la rama IV (Individuelle Leistungen) de sozialversicherungen.admin.ch fue auditada en vivo en Fase 4; el resto de ramas (AHV, EL, BV, KV, UV, EO, FamZ, International) se asume estructuralmente identica pero no se verifico individualmente. Las relaciones de sustitucion entre documentos distintos (p.ej. KSIR reemplazando al KSIH) solo se declaran en prosa libre y no se extraen automaticamente.";

interface LoadedFolder {
  readonly items: BsvFolderListingItem[];
  readonly folderUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
}

/**
 * Proveedor real de documentacion administrativa de BSV/OFAS
 * (sozialversicherungen.admin.ch), Fase 4 -- ver docs/providers/bsv.md y
 * docs/provider-contracts/bsv.md. Parsea el HTML real del portal DNN/2sxc
 * (folderListingParser.ts, documentPageParser.ts); nunca inventa una API
 * JSON (no existe ninguna publica documentada).
 */
export class BsvProvider implements LegalSourceProvider {
  readonly id = PROVIDER_ID;

  private readonly config: BsvConfig;
  private readonly httpClient: SecureHttpClient;
  private readonly folderCache: TtlCache<LoadedFolder>;
  private readonly documentCache: TtlCache<NormalizedDocument>;

  constructor(config: BsvConfig = loadBsvConfig(), httpClient?: SecureHttpClient) {
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
    this.folderCache = new TtlCache(config.cacheTtlListingMs, config.cacheMaxEntries);
    this.documentCache = new TtlCache(config.cacheTtlDocumentMs, config.cacheMaxEntries);
  }

  private async loadFolder(folderId: string): Promise<LoadedFolder> {
    const cacheKey = `folder:${folderId}`;
    const cached = this.folderCache.get(cacheKey);
    if (cached) return cached;

    const folderUrl = `${this.config.baseUrl}/de/f/${folderId}`;
    const response = await this.httpClient.get(folderUrl, {
      expectedContentTypeIncludes: ["text/html"],
    });
    const html = new TextDecoder().decode(response.bytes);
    const items = parseBsvFolderListing(html);
    const loaded: LoadedFolder = {
      items,
      folderUrl: response.finalUrl,
      retrievedAt: response.retrievedAt,
      contentHash: response.contentHash,
    };
    this.folderCache.set(cacheKey, loaded);
    return loaded;
  }

  private async loadAllFolders(): Promise<LoadedFolder[]> {
    return Promise.all(this.config.folderIds.map((folderId) => this.loadFolder(folderId)));
  }

  async searchDocuments(params: BsvSearchParams): Promise<BsvSearchOutcome> {
    const pageSize = params.pageSize ?? 20;
    const page = params.page ?? 1;

    const folders = await this.loadAllFolders();
    const primaryFolder = folders[0];
    if (!primaryFolder) {
      throw new ProviderUnavailableError(PROVIDER_ID, "No hay ninguna carpeta BSV configurada.");
    }

    const queryLower = params.query?.toLowerCase();
    const documents: NormalizedDocument[] = [];
    for (const folder of folders) {
      for (const item of folder.items) {
        if (queryLower && !item.description.toLowerCase().includes(queryLower)) continue;
        if (params.dateFrom && item.changedDate && item.changedDate < params.dateFrom) continue;
        if (params.dateTo && item.changedDate && item.changedDate > params.dateTo) continue;

        const dates = extractBsvDates(item.description);
        const syntheticVersion: BsvVersionDetail = {
          version: item.versionCount ?? 1,
          downloadUrl: `${this.config.baseUrl}/de/d/${item.docId}/download`,
          isCurrent: true,
          freeText: item.description,
          ...(item.changedDate ? { changedDate: item.changedDate } : {}),
          ...(dates.effectiveDate ? { effectiveDate: dates.effectiveDate } : {}),
          ...(dates.standDate ? { standDate: dates.standDate } : {}),
        };
        documents.push(
          mapBsvVersionToNormalizedDocument(syntheticVersion, {
            docId: item.docId,
            ...(item.abbreviation ? { abbreviation: item.abbreviation } : {}),
            description: item.description,
            folderUrl: folder.folderUrl,
            retrievedAt: folder.retrievedAt,
            contentHash: folder.contentHash,
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
        primaryFolder.folderUrl,
        primaryFolder.retrievedAt,
      ),
      coverageWarnings: [COVERAGE_WARNING],
    };
  }

  private parseId(id: string): { docId: string; version?: number } | undefined {
    const rawId = id.startsWith(`${PROVIDER_ID}:`) ? id.slice(PROVIDER_ID.length + 1) : id;
    const [docId, versionPart] = rawId.split(":");
    if (!docId) return undefined;
    if (versionPart?.startsWith("v")) {
      const version = Number(versionPart.slice(1));
      return Number.isNaN(version) ? undefined : { docId, version };
    }
    return { docId };
  }

  async fetchDocument(id: string): Promise<NormalizedDocument> {
    const cached = this.documentCache.get(id);
    if (cached) return cached;

    const parsed = this.parseId(id);
    if (!parsed) {
      throw new NotFoundError(id, `Id de documento BSV con formato invalido: '${id}'.`);
    }

    const documentPageUrl = `${this.config.baseUrl}/de/d/${parsed.docId}`;
    const pageResponse = await this.httpClient.get(documentPageUrl, {
      expectedContentTypeIncludes: ["text/html"],
    });
    const html = new TextDecoder().decode(pageResponse.bytes);
    const versions = parseBsvDocumentPage(html, documentPageUrl);

    const version = parsed.version
      ? versions.find((v) => v.version === parsed.version)
      : versions.find((v) => v.isCurrent);
    if (!version) {
      throw new NotFoundError(
        id,
        `No existe la version solicitada para el documento BSV '${parsed.docId}'.`,
      );
    }

    const pdfResponse = await this.httpClient.get(version.downloadUrl, {
      expectedContentTypeIncludes: ["application/pdf"],
    });
    const { text } = await extractPdfText(pdfResponse.bytes);

    const doc = mapBsvVersionToNormalizedDocument(version, {
      docId: parsed.docId,
      description: version.freeText,
      folderUrl: documentPageUrl,
      retrievedAt: pdfResponse.retrievedAt,
      contentHash: pdfResponse.contentHash,
      fullText: text,
    });
    this.documentCache.set(id, doc);
    return doc;
  }

  /** Ver SecoProvider.fetchDocumentByUrl: mismo patron para una URL oficial validada fuera del listado/historial de versiones. */
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
      authority: "BSV/OFAS",
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
      const [firstFolderId] = this.config.folderIds;
      if (!firstFolderId) throw new Error("No hay ninguna carpeta BSV configurada.");
      await this.loadFolder(firstFolderId);
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
    const item = raw as BsvFolderListingItem & { folderUrl: string };
    const dates = extractBsvDates(item.description);
    const version: BsvVersionDetail = {
      version: item.versionCount ?? 1,
      downloadUrl: `${this.config.baseUrl}/de/d/${item.docId}/download`,
      isCurrent: true,
      freeText: item.description,
      ...(item.changedDate ? { changedDate: item.changedDate } : {}),
      ...(dates.effectiveDate ? { effectiveDate: dates.effectiveDate } : {}),
    };
    const doc = mapBsvVersionToNormalizedDocument(version, {
      docId: item.docId,
      ...(item.abbreviation ? { abbreviation: item.abbreviation } : {}),
      description: item.description,
      folderUrl: item.folderUrl,
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
