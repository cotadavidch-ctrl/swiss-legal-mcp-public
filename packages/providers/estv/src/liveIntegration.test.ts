import { describe, expect, it } from "vitest";
import { EstvProvider } from "./estvProvider.js";
import { loadEstvConfig } from "./config.js";

/**
 * Pruebas de integracion REALES contra https://www.estv.admin.ch (portal
 * clasico de Kreisschreiben). Nunca se ejecutan por defecto. Corren con:
 *
 *   RUN_LIVE_INTEGRATION_TESTS=true pnpm test -- estv
 *   RUN_LIVE_ESTV_TESTS=true pnpm test -- estv
 */
const liveEnabled =
  process.env["RUN_LIVE_INTEGRATION_TESTS"] === "true" ||
  process.env["RUN_LIVE_ESTV_TESTS"] === "true";

describe.skipIf(!liveEnabled)("EstvProvider (integracion real, RUN_LIVE_ESTV_TESTS=true)", () => {
  const provider = new EstvProvider(loadEstvConfig({}));

  it("healthCheck() contra el listado real de Direkte Bundessteuer", async () => {
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  }, 20_000);

  it("searchDocuments() real encuentra el Kreisschreiben Nr. 50a (Bestechungsgelder)", async () => {
    const outcome = await provider.searchDocuments({ query: "Bestechungsgeldern" });
    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.sourceAttribution.officialCharacter).toBe("official");
  }, 30_000);

  it("fetchDocument() real descarga el PDF del Kreisschreiben Nr. 50a y extrae texto", async () => {
    const outcome = await provider.searchDocuments({ query: "Bestechungsgeldern" });
    const ks50a = outcome.results.find((doc) =>
      doc.administrativeCircular?.referenceNumber?.includes("50a"),
    );
    expect(ks50a).toBeDefined();
    const doc = await provider.fetchDocument(ks50a!.id);
    expect(doc.fullText).toBeDefined();
    expect(doc.fullText!.length).toBeGreaterThan(200);
    expect(doc.provenance.contentHash).toMatch(/^[0-9a-f]{64}$/);
  }, 30_000);
});
