import type { SourceAttribution } from "@swiss-legal-mcp/core";

/**
 * Atribucion de fuente compartida para proveedores administrativos
 * (SECO/BSV/ESTV): siempre "official", nunca un agregador -- a diferencia de
 * `EntscheidsucheMcpProvider.getGeneralSourceAttribution()`
 * (packages/providers/entscheidsuche), que marca "unofficial_aggregator".
 */
export function buildOfficialSourceAttribution(
  sourceUrl: string,
  retrievedAt: string = new Date().toISOString(),
): SourceAttribution {
  return {
    sourceUrl,
    retrievedAt,
    officialCharacter: "official",
  };
}
