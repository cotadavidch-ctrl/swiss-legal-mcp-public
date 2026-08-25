import { describe, expect, it } from "vitest";
import { BsvProvider } from "./bsvProvider.js";
import { loadBsvConfig } from "./config.js";

/**
 * Pruebas de integracion REALES contra
 * https://sozialversicherungen.admin.ch. Nunca se ejecutan por defecto.
 * Corren con:
 *
 *   RUN_LIVE_INTEGRATION_TESTS=true pnpm test -- bsv
 *   RUN_LIVE_BSV_TESTS=true pnpm test -- bsv
 */
const liveEnabled =
  process.env["RUN_LIVE_INTEGRATION_TESTS"] === "true" ||
  process.env["RUN_LIVE_BSV_TESTS"] === "true";

describe.skipIf(!liveEnabled)("BsvProvider (integracion real, RUN_LIVE_BSV_TESTS=true)", () => {
  const provider = new BsvProvider(loadBsvConfig({}));

  it("healthCheck() contra la carpeta real de Kreisschreiben de IV (5661)", async () => {
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  }, 20_000);

  it("searchDocuments() real encuentra el KSIR (Invaliditat und Rente)", async () => {
    const outcome = await provider.searchDocuments({ query: "Invalidit" });
    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.sourceAttribution.officialCharacter).toBe("official");
  }, 30_000);

  it("fetchDocument() real descarga la version vigente del KSIR (docId 18452) y extrae texto", async () => {
    const doc = await provider.fetchDocument("bsv:18452");
    expect(doc.fullText).toBeDefined();
    expect(doc.fullText!.length).toBeGreaterThan(1000);
    expect(doc.administrativeCircular?.status).toBe("current");
    expect(doc.provenance.contentHash).toMatch(/^[0-9a-f]{64}$/);
  }, 30_000);
});
