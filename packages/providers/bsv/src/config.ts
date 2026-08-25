import { z } from "zod";

const DEFAULT_ALLOWED_OFFICIAL_DOMAINS = "sozialversicherungen.admin.ch,www.bsv.admin.ch";
const DEFAULT_BASE_URL = "https://sozialversicherungen.admin.ch";

/**
 * Solo la rama IV (Individuelle Leistungen, carpeta 5661) fue auditada en
 * vivo en Fase 4 (ver docs/provider-contracts/bsv.md) -- se asume que el
 * resto de ramas (AHV, EL, BV, KV, UV, EO, FamZ, International) usan la
 * misma plataforma DNN/2sxc, pero no se verifico cada una individualmente.
 * `BSV_FOLDER_IDS` es una lista configurable para no cerrar la puerta a
 * anadir mas ramas sin cambiar codigo, con un unico default verificado.
 */
const DEFAULT_FOLDER_IDS = "5661";

const configSchema = z.object({
  BSV_BASE_URL: z.string().url().default(DEFAULT_BASE_URL),
  BSV_FOLDER_IDS: z.string().default(DEFAULT_FOLDER_IDS),
  BSV_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  BSV_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  BSV_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(200),
  BSV_RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(5_000),
  BSV_CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  BSV_CIRCUIT_BREAKER_RESET_MS: z.coerce.number().int().positive().default(30_000),
  BSV_CACHE_TTL_LISTING_MS: z.coerce.number().int().nonnegative().default(900_000),
  BSV_CACHE_TTL_DOCUMENT_MS: z.coerce.number().int().nonnegative().default(3_600_000),
  BSV_CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(500),
  BSV_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(20_000_000),
  BSV_ALLOWED_OFFICIAL_DOMAINS: z.string().default(DEFAULT_ALLOWED_OFFICIAL_DOMAINS),
});

export interface BsvConfig {
  readonly baseUrl: string;
  readonly folderIds: readonly string[];
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  readonly retryMaxDelayMs: number;
  readonly circuitBreakerFailureThreshold: number;
  readonly circuitBreakerResetMs: number;
  readonly cacheTtlListingMs: number;
  readonly cacheTtlDocumentMs: number;
  readonly cacheMaxEntries: number;
  readonly maxResponseBytes: number;
  readonly allowedOfficialDomains: readonly string[];
  readonly dnsLookup?: (hostname: string) => Promise<readonly string[]>;
}

export function loadBsvConfig(source: NodeJS.ProcessEnv = process.env): BsvConfig {
  const parsed = configSchema.parse(source);
  return {
    baseUrl: parsed.BSV_BASE_URL,
    folderIds: parsed.BSV_FOLDER_IDS.split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
    timeoutMs: parsed.BSV_TIMEOUT_MS,
    maxRetries: parsed.BSV_MAX_RETRIES,
    retryBaseDelayMs: parsed.BSV_RETRY_BASE_DELAY_MS,
    retryMaxDelayMs: parsed.BSV_RETRY_MAX_DELAY_MS,
    circuitBreakerFailureThreshold: parsed.BSV_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    circuitBreakerResetMs: parsed.BSV_CIRCUIT_BREAKER_RESET_MS,
    cacheTtlListingMs: parsed.BSV_CACHE_TTL_LISTING_MS,
    cacheTtlDocumentMs: parsed.BSV_CACHE_TTL_DOCUMENT_MS,
    cacheMaxEntries: parsed.BSV_CACHE_MAX_ENTRIES,
    maxResponseBytes: parsed.BSV_MAX_RESPONSE_BYTES,
    allowedOfficialDomains: parsed.BSV_ALLOWED_OFFICIAL_DOMAINS.split(",")
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0),
  };
}
