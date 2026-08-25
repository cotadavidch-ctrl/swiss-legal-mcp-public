import type { Language, NormalizedDocument, OfficialCharacter } from "@swiss-legal-mcp/documents";

export type DocumentId = string;

export interface SearchQuery {
  readonly text: string;
  readonly language?: Language;
  readonly limit?: number;
}

export interface SearchResult {
  readonly id: DocumentId;
  readonly title: string;
  readonly snippet?: string | undefined;
  readonly score?: number | undefined;
}

export interface HealthStatus {
  readonly healthy: boolean;
  readonly checkedAt: string;
  readonly message?: string;
  /**
   * Presente solo cuando el proveedor esta permanentemente bloqueado por una
   * decision de cumplimiento (p.ej. robots.txt Disallow), no por una caida
   * transitoria de red. Permite que ToolRegistry distinga "temporalmente
   * caido" de "no disponible por politica" sin acoplarse al nombre de un
   * proveedor concreto -- ver ShabProvider.healthCheck() para el unico uso
   * actual.
   */
  readonly unavailableByPolicy?: { readonly reason: string };
}

export interface SourceAttribution {
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly officialCharacter: OfficialCharacter;
  readonly aggregatorName?: string;
}

/**
 * Interfaz comun que implementa cada proveedor en packages/providers/*.
 * Ver docs/architecture.md#interfaz-comun-de-proveedor.
 */
export interface LegalSourceProvider {
  readonly id: string;
  search(query: SearchQuery): Promise<SearchResult[]>;
  getDocument(id: DocumentId): Promise<NormalizedDocument>;
  getMetadata(id: DocumentId): Promise<Record<string, unknown>>;
  healthCheck(): Promise<HealthStatus>;
  normalize(raw: unknown): NormalizedDocument;
  getSourceAttribution(id: DocumentId): SourceAttribution;
}

export type ProviderRuntimeStatus = "unknown" | "healthy" | "unhealthy" | "disabled";

export interface ProviderRegistration {
  readonly id: string;
  readonly provider: LegalSourceProvider;
  readonly officialCharacter: OfficialCharacter;
  readonly aggregatorName?: string;
  readonly capabilities: readonly string[];
  readonly languages: readonly Language[];
  readonly jurisdictions: readonly string[];
  readonly enabledInEnv: readonly string[];
}

export interface ProviderInfo {
  readonly id: string;
  readonly status: ProviderRuntimeStatus;
  readonly officialCharacter: OfficialCharacter;
  readonly aggregatorName?: string;
  readonly capabilities: readonly string[];
  readonly languages: readonly Language[];
  readonly jurisdictions: readonly string[];
  readonly lastCheckedAt?: string;
  readonly lastCheckMessage?: string;
  readonly unavailableByPolicy?: { readonly reason: string };
}

interface ProviderEntry extends ProviderRegistration {
  status: ProviderRuntimeStatus;
  lastCheckedAt?: string | undefined;
  lastCheckMessage?: string | undefined;
  unavailableByPolicy?: { readonly reason: string } | undefined;
}

/**
 * Registro central de proveedores. No decide activacion de herramientas por
 * si mismo (eso es responsabilidad de ToolRegistry); solo conoce el estado
 * real de cada proveedor tras su ultimo healthCheck().
 */
export class ProviderRegistry {
  private readonly entries = new Map<string, ProviderEntry>();

  register(registration: ProviderRegistration, currentEnv: string): void {
    if (this.entries.has(registration.id)) {
      throw new Error(`El proveedor '${registration.id}' ya esta registrado.`);
    }
    const enabled = registration.enabledInEnv.includes(currentEnv);
    this.entries.set(registration.id, {
      ...registration,
      status: enabled ? "unknown" : "disabled",
    });
  }

  get(id: string): LegalSourceProvider | undefined {
    const entry = this.entries.get(id);
    if (!entry || entry.status === "disabled") return undefined;
    return entry.provider;
  }

  info(id: string): ProviderInfo | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    return toInfo(entry);
  }

  list(): ProviderInfo[] {
    return [...this.entries.values()].map(toInfo);
  }

  isAvailable(id: string): boolean {
    return this.entries.get(id)?.status === "healthy";
  }

  async checkHealth(id: string): Promise<ProviderInfo> {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`El proveedor '${id}' no esta registrado.`);
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

  async checkAllHealth(): Promise<ProviderInfo[]> {
    return Promise.all([...this.entries.keys()].map((id) => this.checkHealth(id)));
  }
}

function toInfo(entry: ProviderEntry): ProviderInfo {
  return {
    id: entry.id,
    status: entry.status,
    officialCharacter: entry.officialCharacter,
    capabilities: entry.capabilities,
    languages: entry.languages,
    jurisdictions: entry.jurisdictions,
    ...(entry.aggregatorName !== undefined ? { aggregatorName: entry.aggregatorName } : {}),
    ...(entry.lastCheckedAt !== undefined ? { lastCheckedAt: entry.lastCheckedAt } : {}),
    ...(entry.lastCheckMessage !== undefined ? { lastCheckMessage: entry.lastCheckMessage } : {}),
    ...(entry.unavailableByPolicy !== undefined
      ? { unavailableByPolicy: entry.unavailableByPolicy }
      : {}),
  };
}
