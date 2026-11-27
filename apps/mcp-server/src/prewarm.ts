import type { LegislationProviderRegistry } from "@swiss-legal-mcp/core";
import { lawSourceForAbbreviation } from "./tools/quoteVerifier.js";

/**
 * Leyes federales que mas se verifican. La primera consulta de cada ley obliga a
 * Fedlex a resolver la version vigente y a descargar su texto (varios MB para el
 * OR): ~7-12 s en frio frente a ~1 s con la ley ya cargada. Precargarlas en
 * segundo plano al arrancar evita que ese coste lo pague la primera verificacion.
 */
export const PREWARM_ABBREVIATIONS: readonly string[] = [
  "OR",
  "ZPO",
  "ZGB",
  "BV",
  "ATSG",
  "BGG",
  "VwVG",
  "AVIG",
  "AIG",
  "IVG",
];

export interface PrewarmLogger {
  info(fields: Record<string, unknown>, message: string): void;
  debug(fields: Record<string, unknown>, message: string): void;
}

export interface PrewarmResult {
  readonly attempted: number;
  readonly loaded: number;
  readonly failed: readonly string[];
}

/**
 * Pide el articulo 1 de cada ley, de una en una (sin saturar Fedlex), para llenar las
 * caches del proveedor. Nunca lanza: un fallo de una ley no impide precargar las demas,
 * y la precarga se detiene si la señal se cancela.
 */
export async function prewarmFedlexLaws(
  legislationProviders: LegislationProviderRegistry,
  logger: PrewarmLogger,
  signal?: AbortSignal,
  abbreviations: readonly string[] = PREWARM_ABBREVIATIONS,
): Promise<PrewarmResult> {
  const fedlex = legislationProviders.get("fedlex");
  if (!fedlex) return { attempted: 0, loaded: 0, failed: [] };

  const failed: string[] = [];
  let attempted = 0;
  let loaded = 0;
  for (const abbreviation of abbreviations) {
    if (signal?.aborted) break;
    const law = lawSourceForAbbreviation(abbreviation);
    if (!law) continue;
    attempted += 1;
    try {
      await fedlex.getArticle(
        {
          lawRef: {
            ...(law.eli ? { eli: law.eli } : {}),
            ...(law.systematicNumber ? { systematicNumber: law.systematicNumber } : {}),
            language: law.language,
          },
          articleNumber: "1",
        },
        signal,
      );
      loaded += 1;
    } catch (error) {
      failed.push(abbreviation);
      logger.debug({ abbreviation, error: String(error) }, "precarga Fedlex: ley no cargada");
    }
  }
  logger.info({ attempted, loaded, failed }, "precarga Fedlex terminada");
  return { attempted, loaded, failed };
}
