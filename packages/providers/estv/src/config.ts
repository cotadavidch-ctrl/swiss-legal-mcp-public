import { z } from "zod";

const DEFAULT_ALLOWED_OFFICIAL_DOMAINS = "www.estv.admin.ch";

/**
 * Solo el portal clasico (`www.estv.admin.ch/de/kreisschreiben-*`) se
 * implementa en Fase 4 -- ver docs/provider-contracts/estv.md. El sistema
 * JSF de MWST-Infos (`gate.estv.admin.ch`) requiere JavaScript real
 * (verificado en vivo) y queda fuera de alcance, documentado como
 * limitacion conocida, no implementado.
 */
const DEFAULT_LISTING_URL_DIREKTE_BUNDESSTEUER =
  "https://www.estv.admin.ch/de/kreisschreiben-direkten-bundessteuer";
const DEFAULT_LISTING_URL_STEMPELABGABEN =
  "https://www.estv.admin.ch/de/kreisschreiben-stempelabgaben";
const DEFAULT_LISTING_URL_VERRECHNUNGSSTEUER =
  "https://www.estv.admin.ch/de/kreisschreiben-verrechnungssteuer";

const configSchema = z.object({
  ESTV_LISTING_URL_DIREKTE_BUNDESSTEUER: z
    .string()
    .url()
    .default(DEFAULT_LISTING_URL_DIREKTE_BUNDESSTEUER),
  ESTV_LISTING_URL_STEMPELABGABEN: z.string().url().default(DEFAULT_LISTING_URL_STEMPELABGABEN),
  ESTV_LISTING_URL_VERRECHNUNGSSTEUER: z
    .string()
    .url()
    .default(DEFAULT_LISTING_URL_VERRECHNUNGSSTEUER),
  ESTV_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  ESTV_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  ESTV_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(200),
  ESTV_RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(5_000),
  ESTV_CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  ESTV_CIRCUIT_BREAKER_RESET_MS: z.coerce.number().int().positive().default(30_000),
  ESTV_CACHE_TTL_LISTING_MS: z.coerce.number().int().nonnegative().default(900_000),
  ESTV_CACHE_TTL_DOCUMENT_MS: z.coerce.number().int().nonnegative().default(3_600_000),
  ESTV_CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(500),
  ESTV_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(20_000_000),
  ESTV_ALLOWED_OFFICIAL_DOMAINS: z.string().default(DEFAULT_ALLOWED_OFFICIAL_DOMAINS),
});

export interface EstvConfig {
  readonly listingUrls: {
    readonly direkteBundessteuer: string;
    readonly stempelabgaben: string;
    readonly verrechnungssteuer: string;
  };
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

export function loadEstvConfig(source: NodeJS.ProcessEnv = process.env): EstvConfig {
  const parsed = configSchema.parse(source);
  return {
    listingUrls: {
      direkteBundessteuer: parsed.ESTV_LISTING_URL_DIREKTE_BUNDESSTEUER,
      stempelabgaben: parsed.ESTV_LISTING_URL_STEMPELABGABEN,
      verrechnungssteuer: parsed.ESTV_LISTING_URL_VERRECHNUNGSSTEUER,
    },
    timeoutMs: parsed.ESTV_TIMEOUT_MS,
    maxRetries: parsed.ESTV_MAX_RETRIES,
    retryBaseDelayMs: parsed.ESTV_RETRY_BASE_DELAY_MS,
    retryMaxDelayMs: parsed.ESTV_RETRY_MAX_DELAY_MS,
    circuitBreakerFailureThreshold: parsed.ESTV_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    circuitBreakerResetMs: parsed.ESTV_CIRCUIT_BREAKER_RESET_MS,
    cacheTtlListingMs: parsed.ESTV_CACHE_TTL_LISTING_MS,
    cacheTtlDocumentMs: parsed.ESTV_CACHE_TTL_DOCUMENT_MS,
    cacheMaxEntries: parsed.ESTV_CACHE_MAX_ENTRIES,
    maxResponseBytes: parsed.ESTV_MAX_RESPONSE_BYTES,
    allowedOfficialDomains: parsed.ESTV_ALLOWED_OFFICIAL_DOMAINS.split(",")
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0),
  };
}
