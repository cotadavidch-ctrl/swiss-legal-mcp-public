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
  extractPdfText,
  DEFAULT_ADMINISTRATIVE_USER_AGENT,
} from "@swiss-legal-mcp/shared-web";
import type { CantonalJuConfig } from "./config.js";

const PROVIDER_ID = "cantonal-ju";

/** `cantonal-ju:{idn}:{id}`, p.ej. `cantonal-ju:20002:36641` (categoría + documento, tal como aparecen en la URL real). */
export interface JuDocumentRef {
  readonly idn: string;
  readonly id: string;
}

export function buildJuDocumentId(ref: JuDocumentRef): string {
  return `${PROVIDER_ID}:${ref.idn}:${ref.id}`;
}

export function parseJuDocumentId(id: string): JuDocumentRef | undefined {
  const rawId = id.startsWith(`${PROVIDER_ID}:`) ? id.slice(PROVIDER_ID.length + 1) : id;
  const parts = rawId.split(":");
  if (parts.length !== 2) return undefined;
  const [idn, docId] = parts as [string, string];
  if (!idn || !docId) return undefined;
  return { idn, id: docId };
}

/**
 * Adaptador para la República y Cantón del Jura (JU), Fase de cierre
 * cantonal -- ver docs/provider-contracts/cantonal-ju.md. Producto ASP.NET
 * WebForms propio (CMS "icecube2.net" + módulo CustomView), verificado
 * distinto de la plataforma SIL compartida por GE/NE. Solo se verificó en
 * vivo un mecanismo real de recuperación de un documento YA CONOCIDO
 * (`viewdocument.html?idn={categoría}&id={documento}&download=1` -> PDF
 * real, texto verificado con `pdftotext`). NO se encontró un mecanismo de
 * búsqueda o enumeración de categoría reproducible sin adivinar
 * parámetros (varios nombres de parámetro reales de la interfaz de
 * búsqueda fueron probados en vivo y descartados por no tener efecto) --
 * `search()`/`searchDocuments()` lanzan explícitamente en vez de
 * simular resultados. Sin estructura de artículo verificada --
 * `getArticle` no está soportado.
 */
export class CantonalJuProvider implements LegalSourceProvider {
  readonly id = PROVIDER_ID;

  private readonly config: CantonalJuConfig;
  private readonly httpClient: SecureHttpClient;
  private readonly documentCache: TtlCache<NormalizedDocument>;

  constructor(config: CantonalJuConfig, httpClient?: SecureHttpClient) {
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

    const ref = parseJuDocumentId(id);
    if (!ref) {
      throw new NotFoundError(
        id,
        `Id de ley de Jura con formato inválido: '${id}' (se espera 'cantonal-ju:{idn}:{id}').`,
      );
    }

    const url = `${this.config.baseUrl}/fr/viewdocument.html?idn=${encodeURIComponent(ref.idn)}&id=${encodeURIComponent(ref.id)}&download=1`;
    const response = await this.httpClient.get(url, {
      expectedContentTypeIncludes: ["application/pdf"],
    });
    const { text } = await extractPdfText(response.bytes);

    const doc = parseNormalizedDocument({
      id: buildJuDocumentId(ref),
      provider: PROVIDER_ID,
      documentType: "official_publication",
      jurisdiction: { level: "cantonal", canton: "JU" },
      authority: "République et Canton du Jura",
      sourceOriginalId: ref.id,
      date: {},
      language: "fr",
      title: `Document ${ref.idn}/${ref.id}`,
      fullText: text,
      provenance: {
        sourceUrl: response.finalUrl,
        downloadUrl: url,
        retrievedAt: response.retrievedAt,
        contentHash: response.contentHash,
        officialCharacter: "official",
      },
      rawMetadata: {
        idn: ref.idn,
        id: ref.id,
        platform: "ju-icecube2",
        contentFormat: "pdf",
        titleSource:
          "no verificado en vivo -- el nombre real del documento no se extrajo de una página de categoría (mecanismo de enumeración no encontrado); solo se conoce el par idn/id",
      },
      contentNature: "literal",
    });
    this.documentCache.set(id, doc);
    return doc;
  }

  // ---- LegalSourceProvider ----

  async search(_query: SearchQuery): Promise<SearchResult[]> {
    throw new ProviderUnavailableError(
      PROVIDER_ID,
      "La búsqueda no está implementada para Jura en esta fase: no se encontró en la auditoría un mecanismo de búsqueda o enumeración de categoría reproducible sin adivinar parámetros. Use get_cantonal_law con un par idn/id ya conocido.",
    );
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
      const response = await this.httpClient.get(`${this.config.baseUrl}/Default.aspx`, {
        expectedContentTypeIncludes: ["text/html"],
      });
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
