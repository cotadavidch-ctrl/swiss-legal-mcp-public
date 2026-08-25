import {
  ProviderUnavailableError,
  type DocumentId,
  type HealthStatus,
  type LegalSourceProvider,
  type SearchQuery,
  type SearchResult,
  type SourceAttribution,
} from "@swiss-legal-mcp/core";
import type { NormalizedDocument } from "@swiss-legal-mcp/documents";
import { loadShabConfig, type ShabConfig } from "./config.js";
import { mapShabPublicationToNormalizedDocument } from "./mapper.js";
import { shabRemotePublicationSchema, type ShabRemotePublication } from "./remoteTypes.js";

const PROVIDER_ID = "shab";

export interface ShabSearchParams {
  readonly query?: string;
  readonly uid?: string;
  readonly chId?: string;
  readonly publicationType?: string;
  readonly canton?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly language?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * Proveedor de SHAB/FOSC/FUSC (Fase 5) -- ver docs/providers/shab.md y
 * docs/provider-contracts/shab.md para la auditoria completa. Bloqueado por
 * politica de la fuente: `shab.ch` y `amtsblattportal.ch` declaran
 * `robots.txt: Disallow: /` para todo user-agent, y la API real que
 * alimenta su propio frontend no tiene documentacion publica ni terminos de
 * reutilizacion para terceros (a diferencia de Zefix, que si publica un
 * Swagger pensado para consumo externo).
 *
 * Este proveedor NUNCA realiza una peticion HTTP real: `healthCheck()`
 * siempre reporta `unhealthy` con el motivo explicito, y `search`/
 * `getDocument` lanzan inmediatamente `ProviderUnavailableError` sin llegar
 * a construir una peticion de red. `normalize()` si esta completamente
 * implementado y probado (ver mapper.ts) contra datos reales capturados en
 * la auditoria -- listo para el dia en que exista un canal de acceso
 * autorizado, sin necesitar cambios de esquema.
 */
export class ShabProvider implements LegalSourceProvider {
  readonly id = PROVIDER_ID;

  private readonly config: ShabConfig;

  constructor(config: ShabConfig = loadShabConfig()) {
    this.config = config;
  }

  private blockedError(): ProviderUnavailableError {
    return new ProviderUnavailableError(PROVIDER_ID, this.config.blockReason);
  }

  async searchDocuments(_params: ShabSearchParams): Promise<never> {
    throw this.blockedError();
  }

  async fetchDocument(_id: string): Promise<never> {
    throw this.blockedError();
  }

  // ---- LegalSourceProvider ----

  async search(_query: SearchQuery): Promise<SearchResult[]> {
    throw this.blockedError();
  }

  async getDocument(_id: DocumentId): Promise<NormalizedDocument> {
    throw this.blockedError();
  }

  async getMetadata(_id: DocumentId): Promise<Record<string, unknown>> {
    throw this.blockedError();
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: false,
      checkedAt: new Date().toISOString(),
      message: this.config.blockReason,
      unavailableByPolicy: { reason: "robots_txt_disallow" },
    };
  }

  /**
   * Unica operacion real de este proveedor: normaliza un objeto ya obtenido
   * (p.ej. de un fixture de prueba o de un futuro canal autorizado) sin
   * realizar ninguna peticion de red. Valida `raw` contra el esquema real
   * observado en la auditoria (remoteTypes.ts) antes de normalizar.
   */
  normalize(raw: unknown): NormalizedDocument {
    const publication: ShabRemotePublication = shabRemotePublicationSchema.parse(raw);
    return mapShabPublicationToNormalizedDocument(publication, {
      sourceUrl: "https://www.shab.ch/api/v1/publications",
      retrievedAt: new Date().toISOString(),
      contentHash: "0".repeat(64),
    });
  }

  getSourceAttribution(_id: DocumentId): SourceAttribution {
    throw this.blockedError();
  }
}
