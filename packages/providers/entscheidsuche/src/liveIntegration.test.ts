import { afterAll, describe, expect, it } from "vitest";
import { EntscheidsucheMcpProvider } from "./entscheidsucheProvider.js";
import { loadEntscheidsucheConfig } from "./config.js";

/**
 * Pruebas de integracion REALES contra https://mcp.entscheidsuche.ch/mcp.
 * Nunca se ejecutan por defecto (dependerian de Internet y de un servicio de
 * terceros). Solo corren con:
 *
 *   RUN_LIVE_INTEGRATION_TESTS=true pnpm test -- entscheidsuche
 */
const liveEnabled = process.env["RUN_LIVE_INTEGRATION_TESTS"] === "true";

describe.skipIf(!liveEnabled)(
  "EntscheidsucheMcpProvider (integracion real, RUN_LIVE_INTEGRATION_TESTS=true)",
  () => {
    const provider = new EntscheidsucheMcpProvider(loadEntscheidsucheConfig({ NODE_ENV: "test" }));

    afterAll(async () => {
      await provider.close();
    });

    it("healthCheck() contra el servidor real", async () => {
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
    }, 15_000);

    it("getServerInfo() real trae name/version", async () => {
      const info = await provider.getServerInfo();
      expect(info["name"]).toBeDefined();
    }, 15_000);

    it("listHierarchy() real trae entradas con count", async () => {
      const hierarchy = await provider.listHierarchy({ size: 10 });
      expect(hierarchy.entries.length).toBeGreaterThan(0);
      expect(hierarchy.entries[0]?.count).toBeGreaterThan(0);
    }, 15_000);

    it("searchCases() real en aleman devuelve resultados", async () => {
      const outcome = await provider.searchCases({
        query: "Mietrecht",
        language: "de",
        pageSize: 3,
      });
      expect(outcome.results.length).toBeGreaterThan(0);
      expect(outcome.warning.aggregatorName).toBe("entscheidsuche.ch");
    }, 15_000);

    it("searchCases() real en frances devuelve resultados distintos", async () => {
      const outcome = await provider.searchCases({
        query: "droit du bail",
        language: "fr",
        pageSize: 3,
      });
      expect(outcome.results.length).toBeGreaterThan(0);
    }, 15_000);

    it("searchCases() real en italiano devuelve resultados", async () => {
      const outcome = await provider.searchCases({
        query: "locazione",
        language: "it",
        pageSize: 3,
      });
      expect(outcome.results.length).toBeGreaterThan(0);
    }, 15_000);

    it("get_case real recupera un documento federal con texto completo", async () => {
      const doc = await provider.fetchDocument("CH_BGE_005_BGE-142-III-1_2016");
      expect(doc.fullText).toBeDefined();
      expect(doc.fullText!.length).toBeGreaterThan(1000);
    }, 15_000);

    it("get_case real lanza NotFoundError para un id inexistente", async () => {
      await expect(provider.fetchDocument("ID_QUE_NO_EXISTE_DEFINITIVAMENTE")).rejects.toThrow();
    }, 15_000);
  },
);
