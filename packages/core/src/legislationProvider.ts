import type {
  ArticleVersionComparison,
  Language,
  NormalizedDocument,
  OfficialCharacter,
} from "@swiss-legal-mcp/documents";
import type { HealthStatus } from "./provider.js";

/**
 * Matriz de capacidades reales de un proveedor de legislacion (ver
 * docs/architecture.md y docs/provider-contracts/fedlex.md). Ningun
 * proveedor puede marcar un campo `true` sin haberlo verificado en vivo:
 * ver el comentario de cada campo para la evidencia exigida.
 */
export interface ProviderCapabilities {
  /** Busqueda de texto libre real (no solo filtrado por identificador). */
  readonly fullTextSearch: boolean;
  readonly searchByTitle: boolean;
  readonly searchByAbbreviation: boolean;
  readonly searchBySystematicNumber: boolean;
  readonly searchByEli: boolean;
  readonly getCurrentVersion: boolean;
  readonly getHistoricalVersion: boolean;
  readonly compareVersions: boolean;
  readonly getArticle: boolean;
  readonly getArticleAtDate: boolean;
  readonly amendmentHistory: boolean;
  readonly transitionalProvisions: boolean;
  readonly entryIntoForce: boolean;
  readonly repealInformation: boolean;
  readonly multilingual: boolean;
  readonly rdf: boolean;
  readonly xml: boolean;
  readonly akomaNtoso: boolean;
  readonly html: boolean;
  readonly pdf: boolean;
}

export interface LegislationSearchQuery {
  readonly text?: string;
  readonly language?: Language;
  readonly systematicNumber?: string;
  readonly abbreviation?: string;
  readonly eli?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly status?: "in_force" | "no_longer_in_force" | "any";
  readonly page?: number;
  readonly pageSize?: number;
}

export interface LegislationSearchResultItem {
  readonly id: string;
  readonly eli: string;
  readonly title: string;
  readonly systematicNumber?: string;
  readonly language: Language;
  readonly inForceStatus: string;
}

export interface LegislationSearchResult {
  readonly items: readonly LegislationSearchResultItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalCount?: number;
  };
  readonly appliedFilters: Readonly<Record<string, unknown>>;
  readonly officialAttribution: {
    readonly sourceUrl: string;
    readonly officialCharacter: OfficialCharacter;
  };
  readonly capabilities: ProviderCapabilities;
  readonly warnings: readonly string[];
}

export interface GetLawRef {
  readonly eli?: string;
  readonly systematicNumber?: string;
  readonly documentId?: string;
  readonly language: Language;
  readonly date?: string;
}

export interface GetArticleRef {
  readonly lawRef: GetLawRef;
  readonly articleNumber: string;
  /** Identificador del anexo tal como aparece en los eId de Fedlex (e.g. "annex_I"). Si se omite, la busqueda se limita al cuerpo principal. */
  readonly annexContext?: string;
}

export interface ArticleAtDateResult {
  readonly document: NormalizedDocument;
  readonly evidence: { readonly chosenEli: string; readonly reason: string };
  readonly warnings: readonly string[];
}

export interface AmendmentHistoryEntry {
  readonly eli: string;
  readonly date: string;
  readonly amendingActs: ReadonlyArray<{
    readonly eli?: string;
    readonly systematicNumber?: string;
    readonly title?: string;
    readonly date?: string;
  }>;
}

/**
 * Interfaz comun para proveedores de legislacion (Fedlex en Fase 3; futuros
 * proveedores cantonales reutilizaran la misma interfaz, ver
 * LegislationProviderRegistry mas abajo). Deliberadamente distinta de
 * LegalSourceProvider (packages/core/src/provider.ts, pensada para
 * jurisprudencia): legislacion necesita resolucion temporal, comparacion de
 * versiones e historial de enmiendas, que no encajan en "getDocument(id)".
 */
export interface LegislationProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  searchLegislation(
    query: LegislationSearchQuery,
    signal?: AbortSignal,
  ): Promise<LegislationSearchResult>;
  getLaw(ref: GetLawRef, signal?: AbortSignal): Promise<NormalizedDocument>;
  getArticle(ref: GetArticleRef, signal?: AbortSignal): Promise<NormalizedDocument>;
  getArticleAtDate(
    ref: GetArticleRef,
    date: string,
    signal?: AbortSignal,
  ): Promise<ArticleAtDateResult>;
  compareArticleVersions(
    ref: GetArticleRef,
    dateBefore: string,
    dateAfter: string,
    signal?: AbortSignal,
  ): Promise<ArticleVersionComparison>;
  getAmendmentHistory(
    ref: GetLawRef,
    signal?: AbortSignal,
  ): Promise<readonly AmendmentHistoryEntry[]>;
  healthCheck(signal?: AbortSignal): Promise<HealthStatus>;
}

export type LegislationProviderRuntimeStatus = "unknown" | "healthy" | "unhealthy" | "disabled";

export interface LegislationProviderRegistration {
  readonly id: string;
  readonly provider: LegislationProvider;
  readonly officialCharacter: OfficialCharacter;
  readonly jurisdictions: readonly string[];
  readonly enabledInEnv: readonly string[];
}

export interface LegislationProviderInfo {
  readonly id: string;
  readonly status: LegislationProviderRuntimeStatus;
  readonly officialCharacter: OfficialCharacter;
  readonly capabilities: ProviderCapabilities;
  readonly jurisdictions: readonly string[];
  readonly lastCheckedAt?: string;
  readonly lastCheckMessage?: string;
  readonly unavailableByPolicy?: { readonly reason: string };
}

interface LegislationProviderEntry extends LegislationProviderRegistration {
  status: LegislationProviderRuntimeStatus;
  lastCheckedAt?: string | undefined;
  lastCheckMessage?: string | undefined;
  unavailableByPolicy?: { readonly reason: string } | undefined;
}

/**
 * Registro central de proveedores de legislacion, hermano de
 * ProviderRegistry (jurisprudencia). Preparado para que futuras fases
 * registren proveedores cantonales sin tocar FedlexProvider ni esta clase;
 * en Fase 3 solo se registra "fedlex".
 */
export class LegislationProviderRegistry {
  private readonly entries = new Map<string, LegislationProviderEntry>();

  register(registration: LegislationProviderRegistration, currentEnv: string): void {
    if (this.entries.has(registration.id)) {
      throw new Error(`El proveedor de legislacion '${registration.id}' ya esta registrado.`);
    }
    const enabled = registration.enabledInEnv.includes(currentEnv);
    this.entries.set(registration.id, {
      ...registration,
      status: enabled ? "unknown" : "disabled",
    });
  }

  get(id: string): LegislationProvider | undefined {
    const entry = this.entries.get(id);
    if (!entry || entry.status === "disabled") return undefined;
    return entry.provider;
  }

  info(id: string): LegislationProviderInfo | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    return toInfo(entry);
  }

  list(): LegislationProviderInfo[] {
    return [...this.entries.values()].map(toInfo);
  }

  isAvailable(id: string): boolean {
    return this.entries.get(id)?.status === "healthy";
  }

  async checkHealth(id: string): Promise<LegislationProviderInfo> {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`El proveedor de legislacion '${id}' no esta registrado.`);
    }
    if (entry.status === "disabled") {
      return toInfo(entry);
    }
    const checkedAt = new Date().toISOString();
    try {
      const health = await entry.provider.healthCheck();
      entry.status = health.healthy ? "healthy" : "unhealthy";
      entry.lastCheckedAt = checkedAt;
      entry.lastCheckMessage = health.message;
      entry.unavailableByPolicy = health.unavailableByPolicy;
    } catch (error) {
      entry.status = "unhealthy";
      entry.lastCheckedAt = checkedAt;
      entry.lastCheckMessage = error instanceof Error ? error.message : String(error);
    }
    return toInfo(entry);
  }

  async checkAllHealth(): Promise<LegislationProviderInfo[]> {
    return Promise.all([...this.entries.keys()].map((id) => this.checkHealth(id)));
  }
}

function toInfo(entry: LegislationProviderEntry): LegislationProviderInfo {
  return {
    id: entry.id,
    status: entry.status,
    officialCharacter: entry.officialCharacter,
    capabilities: entry.provider.capabilities,
    jurisdictions: entry.jurisdictions,
    ...(entry.lastCheckedAt !== undefined ? { lastCheckedAt: entry.lastCheckedAt } : {}),
    ...(entry.lastCheckMessage !== undefined ? { lastCheckMessage: entry.lastCheckMessage } : {}),
    ...(entry.unavailableByPolicy !== undefined
      ? { unavailableByPolicy: entry.unavailableByPolicy }
      : {}),
  };
}
