import { z } from "zod";

const DEFAULT_ALLOWED_OFFICIAL_DOMAINS = "www.arbeit.swiss,backend.arbeit.swiss";

/**
 * URLs reales verificadas en vivo (Fase 4, ver docs/provider-contracts/seco.md):
 * el slug de la pagina de publicaciones NO es un simple prefijo /fr/ sobre la
 * ruta alemana -- cada idioma tiene su propio slug real.
 */
const DEFAULT_LISTING_URL_DE = "https://www.arbeit.swiss/de/informationszentrum/publikationen";
const DEFAULT_LISTING_URL_FR = "https://www.arbeit.swiss/fr/centre-dinformation/publications-fr";

const configSchema = z.object({
  SECO_LISTING_URL_DE: z.string().url().default(DEFAULT_LISTING_URL_DE),
  SECO_LISTING_URL_FR: z.string().url().default(DEFAULT_LISTING_URL_FR),
  SECO_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  SECO_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  SECO_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(200),
  SECO_RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(5_000),
  SECO_CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  SECO_CIRCUIT_BREAKER_RESET_MS: z.coerce.number().int().positive().default(30_000),
  SECO_CACHE_TTL_LISTING_MS: z.coerce.number().int().nonnegative().default(900_000),
  SECO_CACHE_TTL_DOCUMENT_MS: z.coerce.number().int().nonnegative().default(3_600_000),
  SECO_CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(500),
  // Un unico limite compartido por el cliente HTTP seguro (listado HTML y
  // descarga de PDF): el mayor de los dos casos reales observados (PDF de
  // hasta ~1.2MB en la auditoria, ver tests/fixtures/seco/README.md), con
  // margen amplio.
  SECO_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(20_000_000),
  // Verificado en vivo: los PDF alemanes se sirven desde www.arbeit.swiss,
  // los franceses desde backend.arbeit.swiss (ver docs/provider-contracts/seco.md).
  SECO_ALLOWED_OFFICIAL_DOMAINS: z.string().default(DEFAULT_ALLOWED_OFFICIAL_DOMAINS),
});

export interface SecoConfig {
  readonly listingUrls: { readonly de: string; readonly fr: string };
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

export function loadSecoConfig(source: NodeJS.ProcessEnv = process.env): SecoConfig {
  const parsed = configSchema.parse(source);
  return {
    listingUrls: { de: parsed.SECO_LISTING_URL_DE, fr: parsed.SECO_LISTING_URL_FR },
    timeoutMs: parsed.SECO_TIMEOUT_MS,
    maxRetries: parsed.SECO_MAX_RETRIES,
    retryBaseDelayMs: parsed.SECO_RETRY_BASE_DELAY_MS,
    retryMaxDelayMs: parsed.SECO_RETRY_MAX_DELAY_MS,
    circuitBreakerFailureThreshold: parsed.SECO_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    circuitBreakerResetMs: parsed.SECO_CIRCUIT_BREAKER_RESET_MS,
    cacheTtlListingMs: parsed.SECO_CACHE_TTL_LISTING_MS,
    cacheTtlDocumentMs: parsed.SECO_CACHE_TTL_DOCUMENT_MS,
    cacheMaxEntries: parsed.SECO_CACHE_MAX_ENTRIES,
    maxResponseBytes: parsed.SECO_MAX_RESPONSE_BYTES,
    allowedOfficialDomains: parsed.SECO_ALLOWED_OFFICIAL_DOMAINS.split(",")
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0),
  };
}
