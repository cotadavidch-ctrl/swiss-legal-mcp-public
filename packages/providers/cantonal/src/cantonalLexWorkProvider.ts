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
  DEFAULT_ADMINISTRATIVE_USER_AGENT,
} from "@swiss-legal-mcp/shared-web";
import type { CantonalLexWorkConfig } from "./config.js";
import {
  lexWorkLightweightIndexSchema,
  lexWorkShowAsJsonSchema,
  type LexWorkShowAsJson,
  type LexWorkTextOfLawEntry,
} from "./lexWorkRemoteTypes.js";
import { extractFullText, findArticleNode } from "./lexWorkContentTree.js";

export interface CantonalLexWorkSearchParams {
  readonly query?: string;
  readonly systematicNumber?: string;
  readonly includeAbrogated?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface CantonalLexWorkSearchOutcome {
  readonly results: NormalizedDocument[];
  readonly pagination: { readonly page: number; readonly pageSize: number; readonly total: number };
  readonly appliedFilters: CantonalLexWorkSearchParams;
  readonly sourceAttribution: SourceAttribution;
  readonly coverageWarnings: readonly string[];
}

interface LoadedIndex {
  readonly entries: readonly LexWorkTextOfLawEntry[];
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
}

/**
 * Adaptador reutilizable para cantones sobre la plataforma comercial
 * LexWork (Fase 5, ver docs/provider-contracts/cantonal-lexwork.md).
 * Parametrizado por `config.cantonCode`/`config.baseUrl`; verificado en
 * vivo (Fase 5B) para 19 cantones -- ver docs/providers/cantonal-legislation.md.
 * Cubre: catalogo/listado (`texts_of_law/lightweight_index`), texto
 * completo de la version vigente y articulos individuales de la version
 * vigente (`texts_of_law/{numero}/show_as_json`). NO cubre texto completo
 * de versiones antiguas/futuras (solo su resumen) ni busqueda de texto
 * libre (excluida explicitamente por robots.txt en todos los cantones
 * verificados) -- la busqueda se implementa filtrando en memoria sobre el
 * indice ya obtenido de un endpoint permitido.
 */
export class CantonalLexWorkProvider implements LegalSourceProvider {
  readonly id: string;

  private readonly config: CantonalLexWorkConfig;
  private readonly httpClient: SecureHttpClient;
  private readonly indexCache: TtlCache<LoadedIndex>;
  private readonly showAsJsonCache: TtlCache<{
    readonly parsed: LexWorkShowAsJson;
    readonly sourceUrl: string;
    readonly retrievedAt: string;
    readonly contentHash: string;
  }>;
  private readonly lastDocumentCache: TtlCache<NormalizedDocument>;

  constructor(config: CantonalLexWorkConfig, httpClient?: SecureHttpClient) {
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
    this.indexCache = new TtlCache(config.cacheTtlMs, config.cacheMaxEntries);
    this.showAsJsonCache = new TtlCache(config.cacheTtlMs, config.cacheMaxEntries);
    this.lastDocumentCache = new TtlCache(config.cacheTtlMs, config.cacheMaxEntries);
  }

  private async loadIndex(): Promise<LoadedIndex> {
    const cached = this.indexCache.get("index");
    if (cached) return cached;

    const url = `${this.config.baseUrl}/api/${this.config.language}/texts_of_law/lightweight_index?show_abrogated=false`;
    const response = await this.httpClient.get(url, {
      expectedContentTypeIncludes: ["application/json"],
    });
    const json: unknown = JSON.parse(new TextDecoder().decode(response.bytes));
    const parsed = lexWorkLightweightIndexSchema.parse(json);
    const entries = Object.values(parsed).flat();

    const loaded: LoadedIndex = {
      entries,
      sourceUrl: response.finalUrl,
      retrievedAt: response.retrievedAt,
      contentHash: response.contentHash,
    };
    this.indexCache.set("index", loaded);
    return loaded;
  }

  /**
   * `GET /api/de/texts_of_law/{numeroSistematico}/show_as_json` -- endpoint
   * real de detalle, descubierto por inspeccion de red sobre la SPA de
   * Berna (Fase 5). No esta en robots.txt.Disallow (solo las rutas de
   * busqueda de texto libre lo estan). Devuelve la version ACTUAL con su
   * arbol de contenido completo (titulo/articulo/parrafo); las versiones
   * antiguas/futuras solo llegan como resumen (id/fecha/titulo) -- no se
   * verifico en la auditoria un mecanismo real para recuperar su texto
   * completo, asi que `getDocument`/`getArticle` solo cubren la version
   * vigente (ver limitacion documentada en docs/provider-contracts/cantonal-lexwork.md).
   */
  private async loadShowAsJson(systematicNumber: string): Promise<{
    parsed: LexWorkShowAsJson;
    sourceUrl: string;
    retrievedAt: string;
    contentHash: string;
  }> {
    const cacheKey = systematicNumber;
    const cached = this.showAsJsonCache.get(cacheKey);
    if (cached) return cached;

    const url = `${this.config.baseUrl}/api/${this.config.language}/texts_of_law/${encodeURIComponent(systematicNumber)}/show_as_json`;
    const response = await this.httpClient.get(url, {
      expectedContentTypeIncludes: ["application/json"],
    });
    const json: unknown = JSON.parse(new TextDecoder().decode(response.bytes));
    const parsed = lexWorkShowAsJsonSchema.parse(json);
    const loaded = {
      parsed,
      sourceUrl: response.finalUrl,
      retrievedAt: response.retrievedAt,
      contentHash: response.contentHash,
    };
    this.showAsJsonCache.set(cacheKey, loaded);
    return loaded;
  }

  private mapEntry(entry: LexWorkTextOfLawEntry, loaded: LoadedIndex): NormalizedDocument {
    return parseNormalizedDocument({
      id: `${this.id}:${entry.id}`,
      provider: this.id,
      documentType: "official_publication",
      jurisdiction: { level: "cantonal", canton: this.config.cantonCode },
      authority: `Kanton ${this.config.cantonCode}`,
      sourceOriginalId: String(entry.id),
      date: {},
      language: this.config.language,
      title: entry.title,
      provenance: {
        sourceUrl: loaded.sourceUrl,
        retrievedAt: loaded.retrievedAt,
        contentHash: loaded.contentHash,
        officialCharacter: "official",
      },
      rawMetadata: {
        systematicNumber: entry.systematic_number,
        systematicCategoryId: entry.systematic_category_id,
        abrogated: entry.abrogated,
        structuredDocumentId: entry.structured_document_id,
        platform: "lexwork",
      },
      contentNature: "summary",
    });
  }

  async searchDocuments(
    params: CantonalLexWorkSearchParams,
  ): Promise<CantonalLexWorkSearchOutcome> {
    const pageSize = params.pageSize ?? 20;
    const page = params.page ?? 1;
    const loaded = await this.loadIndex();

    const queryLower = params.query?.toLowerCase();
    const filtered = loaded.entries.filter((entry) => {
      if (!params.includeAbrogated && entry.abrogated) return false;
      if (params.systematicNumber && entry.systematic_number !== params.systematicNumber)
        return false;
      if (queryLower && !entry.title.toLowerCase().includes(queryLower)) return false;
      return true;
    });

    const documents = filtered.map((entry) => this.mapEntry(entry, loaded));
    const start = (page - 1) * pageSize;
    const pageItems = documents.slice(start, start + pageSize);

    return {
      results: pageItems,
      pagination: { page, pageSize, total: documents.length },
      appliedFilters: params,
      sourceAttribution: buildOfficialSourceAttribution(loaded.sourceUrl, loaded.retrievedAt),
      coverageWarnings: [
        `Este listado filtra en memoria sobre el catalogo real de ${this.config.cantonCode} (plataforma LexWork); la busqueda de texto libre del sitio esta excluida por robots.txt. Use get_cantonal_law/get_cantonal_article para el texto completo de una ley o articulo concreto (solo version vigente).`,
      ],
    };
  }

  // ---- LegalSourceProvider ----

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const outcome = await this.searchDocuments({
      ...(query.text ? { query: query.text } : {}),
      ...(query.limit ? { pageSize: query.limit } : {}),
    });
    return outcome.results.map((doc) => ({ id: doc.id, title: doc.title }));
  }

  /** Extrae el numero sistematico de un id `${providerId}:{numeroSistematico}`. */
  private parseSystematicNumberFromId(id: DocumentId): string {
    const rawId = id.startsWith(`${this.id}:`) ? id.slice(this.id.length + 1) : id;
    if (!rawId) {
      throw new NotFoundError(id, `Id de ley LexWork invalido: '${id}'.`);
    }
    return rawId;
  }

  async getDocument(id: DocumentId): Promise<NormalizedDocument> {
    const systematicNumber = this.parseSystematicNumberFromId(id);
    const { parsed, sourceUrl, retrievedAt, contentHash } =
      await this.loadShowAsJson(systematicNumber);
    const tol = parsed.text_of_law;
    const fullText = extractFullText(
      tol.selected_version.json_content.document.content,
      this.config.language,
    );

    const doc = parseNormalizedDocument({
      id: `${this.id}:${tol.systematic_number}`,
      provider: this.id,
      documentType: "official_publication",
      jurisdiction: { level: "cantonal", canton: this.config.cantonCode },
      authority: `Kanton ${this.config.cantonCode}`,
      sourceOriginalId: String(tol.selected_version.structured_document_id),
      date: {},
      language: this.config.language,
      title: tol.title,
      fullText,
      provenance: {
        sourceUrl,
        ...(tol.pdf_link ? { downloadUrl: tol.pdf_link } : {}),
        retrievedAt,
        contentHash,
        officialCharacter: "official",
      },
      rawMetadata: {
        systematicNumber: tol.systematic_number,
        abbreviation: tol.abbreviation ?? null,
        abrogated: tol.abrogated,
        platform: "lexwork",
        currentVersion: {
          id: tol.current_version.id,
          structuredDocumentId: tol.current_version.structured_document_id,
          dates: tol.current_version.version_dates_str,
        },
        oldVersionsCount: tol.old_versions.length,
        oldVersionsSummary: tol.old_versions.map((v) => ({
          id: v.id,
          dates: v.version_dates_str,
          title: v.title,
        })),
        futureVersionsCount: tol.future_versions.length,
        fullTextCoverage:
          "solo la version vigente (current_version); las versiones antiguas/futuras solo se exponen como resumen (ver oldVersionsSummary), su texto completo no esta verificado en esta fase",
      },
      contentNature: "literal",
    });
    this.lastDocumentCache.set(doc.id, doc);
    return doc;
  }

  /**
   * Recuperacion real de un articulo concreto de la version vigente, sobre
   * el arbol `content` de `show_as_json` (ver lexWorkContentTree.ts).
   * Lanza NotFoundError si el articulo no existe en la version vigente --
   * nunca aproxima ni inventa contenido.
   */
  async getArticle(systematicNumber: string, articleNumber: string): Promise<NormalizedDocument> {
    const { parsed, sourceUrl, retrievedAt, contentHash } =
      await this.loadShowAsJson(systematicNumber);
    const tol = parsed.text_of_law;
    const lang = this.config.language;
    const articleNode = findArticleNode(
      tol.selected_version.json_content.document.content,
      articleNumber,
      lang,
    );
    if (!articleNode) {
      throw new NotFoundError(
        `${this.id}:${systematicNumber}#${articleNumber}`,
        `No se encontro el articulo '${articleNumber}' en la version vigente de ${systematicNumber} (${this.config.cantonCode}).`,
      );
    }
    const fullText = extractFullText(articleNode, lang);

    const doc = parseNormalizedDocument({
      id: `${this.id}:${tol.systematic_number}#${articleNode.number?.[lang] ?? articleNumber}`,
      provider: this.id,
      documentType: "official_publication",
      jurisdiction: { level: "cantonal", canton: this.config.cantonCode },
      authority: `Kanton ${this.config.cantonCode}`,
      sourceOriginalId: articleNode.uid,
      date: {},
      language: lang,
      title: `${tol.title} -- ${articleNode.number?.[lang] ?? articleNumber}`,
      fullText,
      provenance: {
        sourceUrl,
        retrievedAt,
        contentHash,
        officialCharacter: "official",
      },
      rawMetadata: {
        systematicNumber: tol.systematic_number,
        articleUid: articleNode.uid,
        articleNumber: articleNode.number?.[lang] ?? articleNumber,
        platform: "lexwork",
        versionCoverage: "solo la version vigente (current_version)",
      },
      contentNature: "literal",
    });
    this.lastDocumentCache.set(doc.id, doc);
    return doc;
  }

  async getMetadata(id: DocumentId): Promise<Record<string, unknown>> {
    const loaded = await this.loadIndex();
    const rawId = id.startsWith(`${this.id}:`) ? id.slice(this.id.length + 1) : id;
    const entry = loaded.entries.find((candidate) => String(candidate.id) === rawId);
    if (!entry) {
      throw new NotFoundError(id, `No existe ninguna ley con id '${id}' en el catalogo cargado.`);
    }
    return this.mapEntry(entry, loaded).rawMetadata;
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      await this.loadIndex();
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
    const entry = raw as LexWorkTextOfLawEntry & { sourceUrl: string; retrievedAt: string };
    return this.mapEntry(entry, {
      entries: [],
      sourceUrl: entry.sourceUrl,
      retrievedAt: entry.retrievedAt,
      contentHash: "0".repeat(64),
    });
  }

  getSourceAttribution(id: DocumentId): SourceAttribution {
    const cached = this.lastDocumentCache.get(id);
    if (!cached) {
      throw new ProviderUnavailableError(
        this.id,
        `getSourceAttribution('${id}') requiere haber llamado antes a getDocument/getArticle.`,
      );
    }
    return {
      sourceUrl: cached.provenance.sourceUrl,
      retrievedAt: cached.provenance.retrievedAt,
      officialCharacter: cached.provenance.officialCharacter,
    };
  }
}
