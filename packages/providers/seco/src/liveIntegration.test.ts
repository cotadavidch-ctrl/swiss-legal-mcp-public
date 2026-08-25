import { describe, expect, it } from "vitest";
import { SecoProvider } from "./secoProvider.js";
import { loadSecoConfig } from "./config.js";

/**
 * Pruebas de integracion REALES contra https://www.arbeit.swiss. Nunca se
 * ejecutan por defecto (dependerian de Internet). Corren con:
 *
 *   RUN_LIVE_INTEGRATION_TESTS=true pnpm test -- seco
 *   RUN_LIVE_SECO_TESTS=true pnpm test -- seco
 */
const liveEnabled =
  process.env["RUN_LIVE_INTEGRATION_TESTS"] === "true" ||
  process.env["RUN_LIVE_SECO_TESTS"] === "true";

describe.skipIf(!liveEnabled)("SecoProvider (integracion real, RUN_LIVE_SECO_TESTS=true)", () => {
  const provider = new SecoProvider(loadSecoConfig({}));

  it("healthCheck() contra la pagina real de publicaciones", async () => {
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  }, 20_000);

  it("searchDocuments() real encuentra la Weisung AVIG KAE vigente", async () => {
    const outcome = await provider.searchDocuments({ query: "KAE" });
    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.sourceAttribution.officialCharacter).toBe("official");
  }, 30_000);

  it("fetchDocument() real descarga el PDF de la Weisung AVIG KAE y extrae texto", async () => {
    const outcome = await provider.searchDocuments({ query: "AVIG-Praxis KAE" });
    const kae = outcome.results.find((doc) =>
      doc.administrativeCircular?.referenceNumber?.includes("KAE"),
    );
    expect(kae).toBeDefined();
    const doc = await provider.fetchDocument(kae!.id);
    expect(doc.fullText).toBeDefined();
    expect(doc.fullText!.length).toBeGreaterThan(1000);
    expect(doc.provenance.contentHash).toMatch(/^[0-9a-f]{64}$/);
  }, 30_000);
});
