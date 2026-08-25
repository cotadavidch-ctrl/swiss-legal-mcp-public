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
  extractSanitizedText,
  parseHtml,
  DEFAULT_ADMINISTRATIVE_USER_AGENT,
} from "@swiss-legal-mcp/shared-web";
import type { CantonalZhConfig } from "./config.js";
import { zhSearchResponseSchema, type ZhSearchResultEntry } from "./zhRemoteTypes.js";

const PROVIDER_ID = "cantonal-zh";
/**
 * Ruta real del servlet JSON de busqueda (Loseblattsammlung/ley vigente),
 * descubierta por inspeccion de red sobre el formulario real del portal
 * (Fase 5B). Parametros reales verificados: `referenceNumber` (numero
 * sistematico exacto), `enactmentTitle` (subcadena de titulo), `page`.
 */
const SEARCH_PATH =
  "/de/politik-staat/gesetze-beschluesse/gesetzessammlung/_jcr_content/main/lawcollectionsearch_312548694.zhweb-zhlex-ls.zhweb-cache.json";

/** Inversa de `buildZhLexUrl`: recupera el `ZhLawRef` codificado en un `link` real devuelto por el buscador. */
function parseZhLexLink(link: string): ZhLawRef | undefined {
  const match =
    /\/zhlex-ls\/erlass-(.+)-(\d{4}_\d{2}_\d{2})-(\d{4}_\d{2}_\d{2})?-([^/-]+)\.html$/.exec(link);
  if (!match) return undefined;
  const [, num, from, to, internalId] = match as unknown as [
    string,
    string,
    string,
    string | undefined,
    string,
  ];
  if (!num || !from || !internalId) return undefined;
  return {
    systematicNumber: num.replace(/_/g, "."),
    effectiveFrom: from.replace(/_/g, "-"),
    ...(to ? { effectiveTo: to.replace(/_/g, "-") } : {}),
    internalId,
  };
}

/** `cantonal-zh:{numeroSistematico}:{vigenteDesde}:{vigenteHasta|-}:{idInterno}`, p.ej. `cantonal-zh:131.1:2015-04-20:2018-01-01:105`. */
export interface ZhLawRef {
  readonly systematicNumber: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly internalId: string;
}

export function buildZhDocumentId(ref: ZhLawRef): string {
  return `${PROVIDER_ID}:${ref.systematicNumber}:${ref.effectiveFrom}:${ref.effectiveTo ?? "-"}:${ref.internalId}`;
}

export function parseZhDocumentId(id: string): ZhLawRef | undefined {
  const rawId = id.startsWith(`${PROVIDER_ID}:`) ? id.slice(PROVIDER_ID.length + 1) : id;
  const parts = rawId.split(":");
  if (parts.length !== 4) return undefined;
  const [systematicNumber, effectiveFrom, effectiveToRaw, internalId] = parts as [
    string,
    string,
    string,
    string,
  ];
  if (!systematicNumber || !effectiveFrom || !internalId) return undefined;
  return {
    systematicNumber,
    effectiveFrom,
    ...(effectiveToRaw && effectiveToRaw !== "-" ? { effectiveTo: effectiveToRaw } : {}),
    internalId,
  };
}

export function buildZhLexUrl(baseUrl: string, ref: ZhLawRef): string {
  const num = ref.systematicNumber.replace(/\./g, "_");
  const from = ref.effectiveFrom.replace(/-/g, "_");
  const to = (ref.effectiveTo ?? "").replace(/-/g, "_");
  return `${baseUrl}/de/politik-staat/gesetze-beschluesse/gesetzessammlung/zhlex-ls/erlass-${num}-${from}-${to}-${ref.internalId}.html`;
}

export interface CantonalZhSearchOutcome {
  readonly results: NormalizedDocument[];
  readonly pagination: {
    readonly page: number;
    readonly numberOfResults: number;
    readonly numberOfResultPages: number;
    readonly moreSearchResultsThanAllowed: boolean;
  };
  readonly sourceAttribution: SourceAttribution;
  readonly coverageWarnings: readonly string[];
}

/**
 * Adaptador para el Cantón de Zurich (ZH-Lex, Fase 5, ver
 * docs/provider-contracts/cantonal-zh.md). Sistema propio (no LexWork), sin
 * API de catalogo, pero con un servlet JSON real de busqueda (ver
 * SEARCH_PATH, descubierto en Fase 5B) sobre la Loseblattsammlung (ley
 * vigente); la recuperacion de texto completo de una ley YA CONOCIDA
 * (numero sistematico + fechas de vigencia + id interno, tal como aparecen
 * codificadas en la URL real) descarga y extrae su HTML. No implementa
 * extraccion de articulo individual (la estructura HTML interna no se
 * exploro a fondo en la auditoria) -- `get_cantonal_article` no cubre ZH.
 */
export class CantonalZhProvider implements LegalSourceProvider {
  readonly id = PROVIDER_ID;

  private readonly config: CantonalZhConfig;
  private readonly httpClient: SecureHttpClient;
  private readonly documentCache: TtlCache<NormalizedDocument>;

  constructor(config: CantonalZhConfig, httpClient?: SecureHttpClient) {
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
    this.documentCache = new TtlCache(config.cacheTtlMs, config.cacheMaxEntries);
  }

  async fetchDocument(id: string): Promise<NormalizedDocument> {
    const cached = this.documentCache.get(id);
    if (cached) return cached;

    const ref = parseZhDocumentId(id);
    if (!ref) {
      throw new NotFoundError(
        id,
        `Id de ley ZH-Lex con formato invalido: '${id}' (se espera 'cantonal-zh:{numeroSistematico}:{vigenteDesde}:{vigenteHasta|-}:{idInterno}').`,
      );
    }

    const url = buildZhLexUrl(this.config.baseUrl, ref);
    const response = await this.httpClient.get(url, {
      expectedContentTypeIncludes: ["text/html"],
    });
    const html = new TextDecoder().decode(response.bytes);
    const $ = parseHtml(html);
    const title = $("h1").first().text().trim() || $("title").first().text().trim();
    if (!title) {
      throw new NotFoundError(id, `No se encontro contenido real en '${url}'.`);
    }
    const mainText = extractSanitizedText($("main").first().html() ?? html);

    const doc = parseNormalizedDocument({
      id,
      provider: PROVIDER_ID,
      documentType: "official_publication",
      jurisdiction: { level: "cantonal", canton: "ZH" },
      authority: "Kanton Zürich",
      sourceOriginalId: ref.internalId,
      date: {
        inForceFrom: ref.effectiveFrom,
        ...(ref.effectiveTo ? { publicationDate: ref.effectiveTo } : {}),
      },
      language: "de",
      title,
      fullText: mainText,
      provenance: {
        sourceUrl: response.finalUrl,
        downloadUrl: response.finalUrl,
        retrievedAt: response.retrievedAt,
        contentHash: response.contentHash,
        officialCharacter: "official",
      },
      rawMetadata: {
        systematicNumber: ref.systematicNumber,
        effectiveFrom: ref.effectiveFrom,
        ...(ref.effectiveTo ? { effectiveTo: ref.effectiveTo } : {}),
        platform: "zh-lex",
      },
      contentNature: "literal",
    });
    this.documentCache.set(id, doc);
    return doc;
  }

  /**
   * Busqueda real sobre la Loseblattsammlung (ley vigente) vía el servlet
   * JSON descubierto en Fase 5B (ver SEARCH_PATH). `referenceNumber`
   * (numero sistematico, coincidencia exacta) y `title` (subcadena real de
   * `enactmentTitle`) son los unicos filtros con soporte real verificado.
   */
  async searchDocuments(params: {
    readonly referenceNumber?: string;
    readonly title?: string;
    readonly page?: number;
  }): Promise<CantonalZhSearchOutcome> {
    const url = new URL(`${this.config.baseUrl}${SEARCH_PATH}`);
    if (params.referenceNumber) url.searchParams.set("referenceNumber", params.referenceNumber);
    if (params.title) url.searchParams.set("enactmentTitle", params.title);
    url.searchParams.set("page", String(params.page ?? 1));

    const response = await this.httpClient.get(url.toString(), {
      expectedContentTypeIncludes: ["application/json"],
    });
    const json: unknown = JSON.parse(new TextDecoder().decode(response.bytes));
    const parsed = zhSearchResponseSchema.parse(json);

    const results: NormalizedDocument[] = parsed.data.map((entry) =>
      this.mapSearchEntry(entry, response.finalUrl, response.retrievedAt, response.contentHash),
    );

    return {
      results,
      pagination: {
        page: params.page ?? 1,
        numberOfResults: parsed.numberOfResults,
        numberOfResultPages: parsed.numberOfResultPages,
        moreSearchResultsThanAllowed: parsed.moreSearchResultsThanAllowed,
      },
      sourceAttribution: buildOfficialSourceAttribution(response.finalUrl, response.retrievedAt),
      coverageWarnings: [
        "Solo cubre la Loseblattsammlung (ley vigente consolidada), no el historico cronologico (Offizielle Gesetzessammlung). Filtros con soporte real verificado: referenceNumber (numero sistematico exacto) y title (subcadena de titulo); no hay busqueda de texto completo.",
      ],
    };
  }

  private mapSearchEntry(
    entry: ZhSearchResultEntry,
    sourceUrl: string,
    retrievedAt: string,
    contentHash: string,
  ): NormalizedDocument {
    const ref = parseZhLexLink(entry.link);
    const id = ref
      ? buildZhDocumentId(ref)
      : `${PROVIDER_ID}:unparsed:${entry.referenceNumber}:${entry.link}`;
    return parseNormalizedDocument({
      id,
      provider: PROVIDER_ID,
      documentType: "official_publication",
      jurisdiction: { level: "cantonal", canton: "ZH" },
      authority: "Kanton Zürich",
      sourceOriginalId: entry.referenceNumber,
      date: {
        ...(ref?.effectiveFrom ? { inForceFrom: ref.effectiveFrom } : {}),
      },
      language: "de",
      title: entry.enactmentTitle,
      provenance: {
        sourceUrl,
        downloadUrl: `${this.config.baseUrl}${entry.link}`,
        retrievedAt,
        contentHash,
        officialCharacter: "official",
      },
      rawMetadata: {
        systematicNumber: entry.referenceNumber,
        enactmentDate: entry.enactmentDate,
        withdrawalDate: entry.withdrawalDate || null,
        platform: "zh-lex",
      },
      contentNature: "summary",
    });
  }

  // ---- LegalSourceProvider ----

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const outcome = await this.searchDocuments({
      ...(query.text ? { title: query.text } : {}),
    });
    return outcome.results.map((doc) => ({ id: doc.id, title: doc.title }));
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
      const response = await this.httpClient.get(
        `${this.config.baseUrl}/de/politik-staat/gesetze-beschluesse/gesetzessammlung.html`,
        { expectedContentTypeIncludes: ["text/html"] },
      );
      return { healthy: response.status === 200, checkedAt: new Date().toISOString() };
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
