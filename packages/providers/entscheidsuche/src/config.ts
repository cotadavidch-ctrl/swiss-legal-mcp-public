import { z } from "zod";

const DEFAULT_ALLOWED_OFFICIAL_DOMAINS =
  "bger.ch,admin.ch,gerichte-zh.ch,justice.ge.ch,vd.ch,ti.ch,be.ch";

const configSchema = z.object({
  ENTSCHEIDSUCHE_MCP_URL: z.string().url().default("https://mcp.entscheidsuche.ch/mcp"),
  ENTSCHEIDSUCHE_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  ENTSCHEIDSUCHE_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  ENTSCHEIDSUCHE_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(200),
  ENTSCHEIDSUCHE_RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(5_000),
  ENTSCHEIDSUCHE_CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  ENTSCHEIDSUCHE_CIRCUIT_BREAKER_RESET_MS: z.coerce.number().int().positive().default(30_000),
  ENTSCHEIDSUCHE_CACHE_TTL_SERVER_INFO_MS: z.coerce.number().int().nonnegative().default(3_600_000),
  ENTSCHEIDSUCHE_CACHE_TTL_HIERARCHY_MS: z.coerce.number().int().nonnegative().default(3_600_000),
  ENTSCHEIDSUCHE_CACHE_TTL_FACETS_MS: z.coerce.number().int().nonnegative().default(3_600_000),
  ENTSCHEIDSUCHE_CACHE_TTL_DOCUMENT_MS: z.coerce.number().int().nonnegative().default(900_000),
  ENTSCHEIDSUCHE_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(5_000_000),
  ENTSCHEIDSUCHE_ALLOWED_OFFICIAL_DOMAINS: z.string().default(DEFAULT_ALLOWED_OFFICIAL_DOMAINS),
});

export interface EntscheidsucheConfig {
  readonly endpoint: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  readonly retryMaxDelayMs: number;
  readonly circuitBreakerFailureThreshold: number;
  readonly circuitBreakerResetMs: number;
  readonly cacheTtlServerInfoMs: number;
  readonly cacheTtlHierarchyMs: number;
  readonly cacheTtlFacetsMs: number;
  readonly cacheTtlDocumentMs: number;
  readonly maxResponseBytes: number;
  readonly allowedOfficialDomains: readonly string[];
}

/**
 * Config del proveedor entscheidsuche, validada con Zod. Todo es configurable
 * por entorno con defaults razonables (endpoint publico real, timeouts
 * conservadores); ningun default inventa una credencial porque este proveedor
 * no requiere ninguna (el servidor remoto es publico y sin autenticacion).
 */
export function loadEntscheidsucheConfig(
  source: NodeJS.ProcessEnv = process.env,
): EntscheidsucheConfig {
  const parsed = configSchema.parse(source);
  return {
    endpoint: parsed.ENTSCHEIDSUCHE_MCP_URL,
    timeoutMs: parsed.ENTSCHEIDSUCHE_TIMEOUT_MS,
    maxRetries: parsed.ENTSCHEIDSUCHE_MAX_RETRIES,
    retryBaseDelayMs: parsed.ENTSCHEIDSUCHE_RETRY_BASE_DELAY_MS,
    retryMaxDelayMs: parsed.ENTSCHEIDSUCHE_RETRY_MAX_DELAY_MS,
    circuitBreakerFailureThreshold: parsed.ENTSCHEIDSUCHE_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    circuitBreakerResetMs: parsed.ENTSCHEIDSUCHE_CIRCUIT_BREAKER_RESET_MS,
    cacheTtlServerInfoMs: parsed.ENTSCHEIDSUCHE_CACHE_TTL_SERVER_INFO_MS,
    cacheTtlHierarchyMs: parsed.ENTSCHEIDSUCHE_CACHE_TTL_HIERARCHY_MS,
    cacheTtlFacetsMs: parsed.ENTSCHEIDSUCHE_CACHE_TTL_FACETS_MS,
    cacheTtlDocumentMs: parsed.ENTSCHEIDSUCHE_CACHE_TTL_DOCUMENT_MS,
    maxResponseBytes: parsed.ENTSCHEIDSUCHE_MAX_RESPONSE_BYTES,
    allowedOfficialDomains: parsed.ENTSCHEIDSUCHE_ALLOWED_OFFICIAL_DOMAINS.split(",")
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0),
  };
}
