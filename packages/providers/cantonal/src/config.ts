import { z } from "zod";

const commonHttpSchema = {
  TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(200),
  RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(5_000),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  CIRCUIT_BREAKER_RESET_MS: z.coerce.number().int().positive().default(30_000),
  CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(900_000),
  CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(500),
  MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(20_000_000),
};

export interface CantonalHttpConfig {
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  readonly retryMaxDelayMs: number;
  readonly circuitBreakerFailureThreshold: number;
  readonly circuitBreakerResetMs: number;
  readonly cacheTtlMs: number;
  readonly cacheMaxEntries: number;
  readonly maxResponseBytes: number;
}

const lexWorkHttpConfigSchema = z.object(commonHttpSchema);

export interface CantonalLexWorkConfig extends CantonalHttpConfig {
  readonly cantonCode: string;
  readonly baseUrl: string;
  readonly allowedOfficialDomains: readonly string[];
  /** Idioma real de la instancia LexWork del canton (`/api/{language}/...`). */
  readonly language: "de" | "fr";
}

/**
 * `CantonalLexWorkProvider` (ver cantonalLexWorkProvider.ts) es una clase
 * reutilizable parametrizada por canton. Construye la config para UN
 * canton LexWork ya verificado en vivo (ver LEXWORK_CANTONS en
 * lexWorkCantons.ts) -- anadir un canton nuevo aqui requiere haberlo
 * verificado antes, nunca por analogia sin comprobar. `baseUrl`/
 * `allowedOfficialDomains`/`language` son sobreescribibles por entorno con
 * `CANTONAL_{CODIGO}_BASE_URL`/`CANTONAL_{CODIGO}_ALLOWED_OFFICIAL_DOMAINS`
 * para permitir apuntar a un espejo o corregir un dominio sin recompilar.
 */
export function loadCantonalLexWorkConfig(
  descriptor: {
    readonly cantonCode: string;
    readonly baseUrl: string;
    readonly domains: readonly string[];
    readonly language: "de" | "fr";
  },
  source: NodeJS.ProcessEnv = process.env,
): CantonalLexWorkConfig {
  const parsedHttp = lexWorkHttpConfigSchema.parse(source);
  const code = descriptor.cantonCode.toUpperCase();
  const baseUrlOverride = source[`CANTONAL_${code}_BASE_URL`];
  const domainsOverride = source[`CANTONAL_${code}_ALLOWED_OFFICIAL_DOMAINS`];
  return {
    cantonCode: code,
    baseUrl: baseUrlOverride ? z.string().url().parse(baseUrlOverride) : descriptor.baseUrl,
    allowedOfficialDomains: domainsOverride
      ? domainsOverride
          .split(",")
          .map((d) => d.trim())
          .filter((d) => d.length > 0)
      : descriptor.domains,
    language: descriptor.language,
    timeoutMs: parsedHttp.TIMEOUT_MS,
    maxRetries: parsedHttp.MAX_RETRIES,
    retryBaseDelayMs: parsedHttp.RETRY_BASE_DELAY_MS,
    retryMaxDelayMs: parsedHttp.RETRY_MAX_DELAY_MS,
    circuitBreakerFailureThreshold: parsedHttp.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    circuitBreakerResetMs: parsedHttp.CIRCUIT_BREAKER_RESET_MS,
    cacheTtlMs: parsedHttp.CACHE_TTL_MS,
    cacheMaxEntries: parsedHttp.CACHE_MAX_ENTRIES,
    maxResponseBytes: parsedHttp.MAX_RESPONSE_BYTES,
  };
}

/** Retrocompatibilidad: Berna con sus valores por defecto verificados en Fase 5. */
export function loadCantonalBeLexWorkConfig(
  source: NodeJS.ProcessEnv = process.env,
): CantonalLexWorkConfig {
  return loadCantonalLexWorkConfig(
    {
      cantonCode: "BE",
      baseUrl: "https://www.belex.sites.be.ch",
      domains: ["belex.sites.be.ch"],
      language: "de",
    },
    source,
  );
}

const zhConfigSchema = z.object({
  CANTONAL_ZH_BASE_URL: z.string().url().default("https://www.zh.ch"),
  CANTONAL_ZH_ALLOWED_OFFICIAL_DOMAINS: z.string().default("zh.ch"),
  ...commonHttpSchema,
});

export interface CantonalZhConfig extends CantonalHttpConfig {
  readonly baseUrl: string;
  readonly allowedOfficialDomains: readonly string[];
}

export function loadCantonalZhConfig(source: NodeJS.ProcessEnv = process.env): CantonalZhConfig {
  const parsed = zhConfigSchema.parse(source);
  return {
    baseUrl: parsed.CANTONAL_ZH_BASE_URL,
    allowedOfficialDomains: parsed.CANTONAL_ZH_ALLOWED_OFFICIAL_DOMAINS.split(",")
      .map((d) => d.trim())
      .filter((d) => d.length > 0),
    timeoutMs: parsed.TIMEOUT_MS,
    maxRetries: parsed.MAX_RETRIES,
    retryBaseDelayMs: parsed.RETRY_BASE_DELAY_MS,
    retryMaxDelayMs: parsed.RETRY_MAX_DELAY_MS,
    circuitBreakerFailureThreshold: parsed.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    circuitBreakerResetMs: parsed.CIRCUIT_BREAKER_RESET_MS,
    cacheTtlMs: parsed.CACHE_TTL_MS,
    cacheMaxEntries: parsed.CACHE_MAX_ENTRIES,
    maxResponseBytes: parsed.MAX_RESPONSE_BYTES,
  };
}

const genericHttpConfigSchema = z.object(commonHttpSchema);

/** Config generica reutilizada por SZ/SIL(GE,NE)/JU -- cada una define su propio baseUrl/domains reales. */
function loadGenericCantonalConfig(source: NodeJS.ProcessEnv): CantonalHttpConfig {
  const parsed = genericHttpConfigSchema.parse(source);
  return {
    timeoutMs: parsed.TIMEOUT_MS,
    maxRetries: parsed.MAX_RETRIES,
    retryBaseDelayMs: parsed.RETRY_BASE_DELAY_MS,
    retryMaxDelayMs: parsed.RETRY_MAX_DELAY_MS,
    circuitBreakerFailureThreshold: parsed.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    circuitBreakerResetMs: parsed.CIRCUIT_BREAKER_RESET_MS,
    cacheTtlMs: parsed.CACHE_TTL_MS,
    cacheMaxEntries: parsed.CACHE_MAX_ENTRIES,
    maxResponseBytes: parsed.MAX_RESPONSE_BYTES,
  };
}

/**
 * Schwyz (SZ): coleccion sistematica en una unica pagina HTML real
 * (`sz.ch/kanton/gesetze/systematische-gesetzsammlung.html/...`), 425
 * entradas reales verificadas con enlaces PDF directos
 * (`sz.ch/public/upload/assets/{id}/{srsz}.pdf`). Sin API, sin busqueda
 * propia de la coleccion (el buscador del sitio es generico); el catalogo
 * se parsea de la tabla HTML real -- ver docs/provider-contracts/cantonal-sz.md.
 */
export interface CantonalSzConfig extends CantonalHttpConfig {
  readonly baseUrl: string;
  readonly collectionPath: string;
  readonly allowedOfficialDomains: readonly string[];
}

export function loadCantonalSzConfig(source: NodeJS.ProcessEnv = process.env): CantonalSzConfig {
  return {
    baseUrl: source["CANTONAL_SZ_BASE_URL"] ?? "https://www.sz.ch",
    collectionPath:
      source["CANTONAL_SZ_COLLECTION_PATH"] ??
      "/kanton/gesetze/systematische-gesetzsammlung.html/8756-8757-10021-11689",
    allowedOfficialDomains: (source["CANTONAL_SZ_ALLOWED_OFFICIAL_DOMAINS"] ?? "sz.ch")
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d.length > 0),
    ...loadGenericCantonalConfig(source),
  };
}

/**
 * Plataforma "SIL" (ARCHILEXMP sa) confirmada en vivo compartida por Ginebra
 * y Neuchatel: mismo esquema real `{baseUrl}/{bookPath}/content.htm` (arbol
 * de categorias con enlaces `htm/{id}.htm`) y mismo script `LVMP.js`. NO
 * comparten esquema con Jura (producto/vendor distinto, ver auditoria) --
 * ver docs/provider-contracts/cantonal-sil.md.
 */
export interface CantonalSilConfig extends CantonalHttpConfig {
  readonly cantonCode: string;
  readonly cantonName: string;
  readonly baseUrl: string;
  /** Ruta real del "libro" de ley vigente, ej. `legis/program/books/RSG` (GE) o `DATA/program/books/rsne` (NE). */
  readonly bookPath: string;
  readonly language: "fr" | "de" | "it";
  readonly allowedOfficialDomains: readonly string[];
}

export function loadCantonalSilConfig(
  descriptor: {
    readonly cantonCode: string;
    readonly cantonName: string;
    readonly baseUrl: string;
    readonly bookPath: string;
    readonly language: "fr" | "de" | "it";
    readonly domains: readonly string[];
  },
  source: NodeJS.ProcessEnv = process.env,
): CantonalSilConfig {
  const code = descriptor.cantonCode.toUpperCase();
  const baseUrlOverride = source[`CANTONAL_${code}_BASE_URL`];
  return {
    cantonCode: code,
    cantonName: descriptor.cantonName,
    baseUrl: baseUrlOverride ? z.string().url().parse(baseUrlOverride) : descriptor.baseUrl,
    bookPath: source[`CANTONAL_${code}_BOOK_PATH`] ?? descriptor.bookPath,
    language: descriptor.language,
    allowedOfficialDomains: descriptor.domains,
    ...loadGenericCantonalConfig(source),
  };
}

/**
 * Jura (JU): producto ASP.NET WebForms propio ("icecube2.net" CMS + modulo
 * CustomView), distinto del stack SIL/LexWork. Solo se verifico en vivo un
 * mecanismo real de recuperacion de documento conocido
 * (`viewdocument.html?idn={categoria}&id={doc}&download=1` -> PDF real);
 * no se encontro un mecanismo de busqueda/enumeracion reproducible sin
 * adivinar parametros -- ver docs/provider-contracts/cantonal-ju.md.
 */
export interface CantonalJuConfig extends CantonalHttpConfig {
  readonly baseUrl: string;
  readonly allowedOfficialDomains: readonly string[];
}

export function loadCantonalJuConfig(source: NodeJS.ProcessEnv = process.env): CantonalJuConfig {
  return {
    baseUrl: source["CANTONAL_JU_BASE_URL"] ?? "https://rsju.jura.ch",
    allowedOfficialDomains: (source["CANTONAL_JU_ALLOWED_OFFICIAL_DOMAINS"] ?? "rsju.jura.ch")
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d.length > 0),
    ...loadGenericCantonalConfig(source),
  };
}
