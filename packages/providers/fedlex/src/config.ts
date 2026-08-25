import { z } from "zod";

const DEFAULT_ALLOWED_OFFICIAL_DOMAINS = "fedlex.admin.ch,fedlex.data.admin.ch";

const configSchema = z.object({
  FEDLEX_SPARQL_ENDPOINT: z.string().url().default("https://fedlex.data.admin.ch/sparqlendpoint"),
  FEDLEX_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  FEDLEX_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  FEDLEX_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(200),
  FEDLEX_RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(5_000),
  FEDLEX_CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  FEDLEX_CIRCUIT_BREAKER_RESET_MS: z.coerce.number().int().positive().default(30_000),
  FEDLEX_CACHE_TTL_SPARQL_MS: z.coerce.number().int().nonnegative().default(900_000),
  FEDLEX_CACHE_TTL_MANIFESTATION_MS: z.coerce.number().int().nonnegative().default(3_600_000),
  FEDLEX_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(10_000_000),
  FEDLEX_MAX_XML_BYTES: z.coerce.number().int().positive().default(20_000_000),
  // Domain allowlist restricted to Fedlex's own official domains, verified
  // live in Fase 3 (docs/provider-contracts/fedlex.md). NUNCA incluir
  // "admin.ch" a secas: eso permitiria por sufijo el dominio interno real
  // "intranet.fedlex.admin.ch" encontrado en jolux:isExemplifiedByPrivate.
  FEDLEX_ALLOWED_OFFICIAL_DOMAINS: z.string().default(DEFAULT_ALLOWED_OFFICIAL_DOMAINS),
});

export interface FedlexConfig {
  readonly sparqlEndpoint: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  readonly retryMaxDelayMs: number;
  readonly circuitBreakerFailureThreshold: number;
  readonly circuitBreakerResetMs: number;
  readonly cacheTtlSparqlMs: number;
  readonly cacheTtlManifestationMs: number;
  readonly maxResponseBytes: number;
  readonly maxXmlBytes: number;
  readonly allowedOfficialDomains: readonly string[];
}

/**
 * Config del proveedor Fedlex, validada con Zod. El endpoint SPARQL real es
 * publico y sin autenticacion (verificado en vivo, Fase 3); ningun default
 * inventa una credencial.
 */
export function loadFedlexConfig(source: NodeJS.ProcessEnv = process.env): FedlexConfig {
  const parsed = configSchema.parse(source);
  return {
    sparqlEndpoint: parsed.FEDLEX_SPARQL_ENDPOINT,
    timeoutMs: parsed.FEDLEX_TIMEOUT_MS,
    maxRetries: parsed.FEDLEX_MAX_RETRIES,
    retryBaseDelayMs: parsed.FEDLEX_RETRY_BASE_DELAY_MS,
    retryMaxDelayMs: parsed.FEDLEX_RETRY_MAX_DELAY_MS,
    circuitBreakerFailureThreshold: parsed.FEDLEX_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    circuitBreakerResetMs: parsed.FEDLEX_CIRCUIT_BREAKER_RESET_MS,
    cacheTtlSparqlMs: parsed.FEDLEX_CACHE_TTL_SPARQL_MS,
    cacheTtlManifestationMs: parsed.FEDLEX_CACHE_TTL_MANIFESTATION_MS,
    maxResponseBytes: parsed.FEDLEX_MAX_RESPONSE_BYTES,
    maxXmlBytes: parsed.FEDLEX_MAX_XML_BYTES,
    allowedOfficialDomains: parsed.FEDLEX_ALLOWED_OFFICIAL_DOMAINS.split(",")
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0),
  };
}
