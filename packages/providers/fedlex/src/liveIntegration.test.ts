import { describe, expect, it } from "vitest";
import { AmbiguousCitationError } from "@swiss-legal-mcp/core";
import { FedlexProvider } from "./fedlexProvider.js";
import { loadFedlexConfig } from "./config.js";

/**
 * Pruebas de integracion REALES contra
 * https://fedlex.data.admin.ch/sparqlendpoint. Nunca se ejecutan por
 * defecto (dependerian de Internet). Solo corren con:
 *
 *   RUN_LIVE_INTEGRATION_TESTS=true pnpm test -- fedlex
 */
const liveEnabled = process.env["RUN_LIVE_INTEGRATION_TESTS"] === "true";

// RS "101" es realmente AMBIGUO en vivo (hallazgo confirmado durante esta
// integracion, ver tests/fixtures/fedlex/jolux_rs_101_constitution_ambiguous.json):
// identifica tanto la Constitucion de 1999 vigente como su predecesora, la
// Constitucion de 1874 (derogada 2000-01-01). Por eso las pruebas que
// necesitan la norma vigente usan el ELI explicito en vez del RS.
const CONSTITUTION_1999_ELI = "https://fedlex.data.admin.ch/eli/cc/1999/404";

describe.skipIf(!liveEnabled)(
  "FedlexProvider (integracion real, RUN_LIVE_INTEGRATION_TESTS=true)",
  () => {
    const provider = new FedlexProvider(loadFedlexConfig({}));

    it("healthCheck() contra el endpoint SPARQL real", async () => {
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
    }, 20_000);

    it("getLaw() real recupera la Constitucion federal vigente por ELI", async () => {
      const doc = await provider.getLaw({ eli: CONSTITUTION_1999_ELI, language: "de" });
      expect(doc.legislation?.systematicNumber).toBe("101");
      expect(doc.legislation?.inForceStatus).toBe("in_force");
      expect(doc.legislation?.manifestation?.format).toBe("xml");
    }, 30_000);

    it("getArticle() real extrae el Art. 1 de la Constitucion via Akoma Ntoso", async () => {
      const doc = await provider.getArticle({
        lawRef: { eli: CONSTITUTION_1999_ELI, language: "de" },
        articleNumber: "1",
      });
      expect(doc.fullText).toContain("Schweizerische Eidgenossenschaft");
    }, 30_000);

    it("getArticleAtDate() real resuelve una version historica dentro de la cobertura XML (>= 2021-01-01)", async () => {
      const result = await provider.getArticleAtDate(
        { lawRef: { eli: CONSTITUTION_1999_ELI, language: "de" }, articleNumber: "1" },
        "2021-06-01",
      );
      expect(result.evidence.chosenEli).toContain("/eli/cc/1999/404/");
    }, 30_000);

    it("getArticle() real lanza NotFoundError para una fecha dentro del hueco historico real (2005, sin XML)", async () => {
      await expect(
        provider.getArticle({
          lawRef: { eli: CONSTITUTION_1999_ELI, language: "de", date: "2005-01-01" },
          articleNumber: "1",
        }),
      ).rejects.toThrow();
    }, 30_000);

    it("getAmendmentHistory() real devuelve al menos 30 versiones fechadas de la Constitucion", async () => {
      const history = await provider.getAmendmentHistory({
        eli: CONSTITUTION_1999_ELI,
        language: "de",
      });
      expect(history.length).toBeGreaterThan(30);
      expect(history[0]?.amendingActs).toEqual([]);
    }, 30_000);

    it("searchLegislation() real por RS ambiguo (832.10, KVG) devuelve 2 actos con advertencia", async () => {
      const result = await provider.searchLegislation({ systematicNumber: "832.10" });
      expect(result.items.length).toBe(2);
      expect(result.warnings.length).toBeGreaterThan(0);
    }, 30_000);

    it("getLaw() real lanza AmbiguousCitationError para RS 101 (Constitucion 1999 vs. 1874, hallazgo real)", async () => {
      await expect(provider.getLaw({ systematicNumber: "101", language: "de" })).rejects.toThrow(
        AmbiguousCitationError,
      );
    }, 20_000);

    it("getLaw() real lanza NotFoundError para un RS inexistente", async () => {
      await expect(
        provider.getLaw({ systematicNumber: "999999.99", language: "de" }),
      ).rejects.toThrow();
    }, 20_000);

    it("getArticle() real extrae FZA Anexo I Art. 9 (Gleichbehandlung) via annexContext", async () => {
      // SR 0.142.112.681 (FZA) — Annex I Art. 9 eId: annex_I/lvl_u1/lvl_II/art_9
      // Confirmed live during hardening sprint: the main body also has an Art. 9
      // (different subject matter). Without annexContext, getArticle() returns the
      // main body Art. 9; with annexContext='annex_I', it returns the Annex I Art. 9.
      const doc = await provider.getArticle({
        lawRef: { systematicNumber: "0.142.112.681", language: "de" },
        articleNumber: "9",
        annexContext: "annex_I",
      });
      expect(doc.fullText).toBeDefined();
      expect(doc.fullText!.length).toBeGreaterThan(0);
      // Annex I Art. 9 is about Gleichbehandlung (equal treatment).
      expect(doc.fullText).toMatch(/Gleichbehandlung|gleiche.*Behandlung/i);
    }, 45_000);
  },
);
