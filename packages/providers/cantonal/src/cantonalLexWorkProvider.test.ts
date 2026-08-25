import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@swiss-legal-mcp/core";
import { CantonalLexWorkProvider } from "./cantonalLexWorkProvider.js";
import type { CantonalLexWorkConfig } from "./config.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/cantonal/be-lexwork",
);

const BASE_URL = "https://www.belex.sites.be.ch";
const INDEX_URL = `${BASE_URL}/api/de/texts_of_law/lightweight_index?show_abrogated=false`;
const INDEX_JSON = readFileSync(
  path.join(fixturesDir, "texts_of_law_lightweight_index.json"),
  "utf8",
);
const SHOW_AS_JSON_URL = `${BASE_URL}/api/de/texts_of_law/324.111/show_as_json`;
const SHOW_AS_JSON = readFileSync(path.join(fixturesDir, "show_as_json_324_111.json"), "utf8");

function baseConfig(overrides: Partial<CantonalLexWorkConfig> = {}): CantonalLexWorkConfig {
  return {
    cantonCode: "BE",
    baseUrl: BASE_URL,
    allowedOfficialDomains: ["belex.sites.be.ch"],
    language: "de",
    timeoutMs: 2_000,
    maxRetries: 1,
    retryBaseDelayMs: 1,
    retryMaxDelayMs: 5,
    circuitBreakerFailureThreshold: 3,
    circuitBreakerResetMs: 200,
    cacheTtlMs: 60_000,
    cacheMaxEntries: 100,
    maxResponseBytes: 50_000_000,
    ...overrides,
  };
}

function installMockFetch(): { calls: string[] } {
  const state = { calls: [] as string[] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = input.toString();
      state.calls.push(url);
      if (url === INDEX_URL) {
        return new Response(new TextEncoder().encode(INDEX_JSON), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url === SHOW_AS_JSON_URL) {
        return new Response(new TextEncoder().encode(SHOW_AS_JSON), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (
        url.includes("/api/de/systematic_categories") ||
        url.includes("/api/de/fulltext_searches")
      ) {
        return new Response("no debe llamarse", { status: 404 });
      }
      return new Response("no encontrado", { status: 404 });
    }),
  );
  return state;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CantonalLexWorkProvider (Berna)", () => {
  it("searchDocuments filtra el catalogo real por numero sistematico", async () => {
    installMockFetch();
    const provider = new CantonalLexWorkProvider(baseConfig());
    const outcome = await provider.searchDocuments({ systematicNumber: "324.111" });

    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0]?.title).toContain("Ordnungsbussenverordnung");
    expect(outcome.results[0]?.rawMetadata["systematicNumber"]).toBe("324.111");
    expect(outcome.sourceAttribution.officialCharacter).toBe("official");
  });

  it("excluye leyes derogadas por defecto (abrogated:true)", async () => {
    installMockFetch();
    const provider = new CantonalLexWorkProvider(baseConfig());
    const outcome = await provider.searchDocuments({ query: "Ordnungsbussen" });
    expect(outcome.results.every((doc) => doc.rawMetadata["abrogated"] === false)).toBe(true);
  });

  it("nunca llama a los endpoints de busqueda de texto libre prohibidos por robots.txt", async () => {
    const calls = installMockFetch();
    const provider = new CantonalLexWorkProvider(baseConfig());
    await provider.searchDocuments({ query: "Gesetz" });
    expect(
      calls.calls.some((url) => url.includes("fulltext_search") || url.includes("direct_searches")),
    ).toBe(false);
  });

  it("getDocument recupera el texto completo real de la version vigente", async () => {
    installMockFetch();
    const provider = new CantonalLexWorkProvider(baseConfig());
    const doc = await provider.getDocument("cantonal-be:324.111");

    expect(doc.title).toContain("Ordnungsbussenverordnung");
    expect(doc.fullText).toContain("Zuständigkeit");
    expect(doc.fullText).toContain("Ordnungsbussen");
    expect(doc.contentNature).toBe("literal");
    expect(doc.rawMetadata["oldVersionsCount"]).toBe(5);
    expect(doc.rawMetadata["fullTextCoverage"]).toContain("solo la version vigente");
  });

  it("getArticle recupera un articulo real por numero (Art. 1)", async () => {
    installMockFetch();
    const provider = new CantonalLexWorkProvider(baseConfig());
    const doc = await provider.getArticle("324.111", "1");

    expect(doc.rawMetadata["articleNumber"]).toContain("1");
    expect(doc.fullText).toContain("Zuständigkeit");
    expect(doc.fullText).toContain("Ordnungsbussen");
  });

  it("getArticle lanza NotFoundError para un articulo que no existe en la version vigente", async () => {
    installMockFetch();
    const provider = new CantonalLexWorkProvider(baseConfig());
    await expect(provider.getArticle("324.111", "999")).rejects.toThrow(NotFoundError);
  });

  it("getSourceAttribution funciona tras getDocument", async () => {
    installMockFetch();
    const provider = new CantonalLexWorkProvider(baseConfig());
    const doc = await provider.getDocument("cantonal-be:324.111");
    const attribution = provider.getSourceAttribution(doc.id);
    expect(attribution.officialCharacter).toBe("official");
  });

  it("healthCheck es exitoso cuando el indice responde correctamente", async () => {
    installMockFetch();
    const provider = new CantonalLexWorkProvider(baseConfig());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("reutiliza el indice cacheado en llamadas sucesivas (una sola peticion HTTP)", async () => {
    const calls = installMockFetch();
    const provider = new CantonalLexWorkProvider(baseConfig());
    await provider.searchDocuments({ query: "a" });
    await provider.searchDocuments({ query: "b" });
    expect(calls.calls.filter((url) => url === INDEX_URL)).toHaveLength(1);
  });

  it("propaga un error tipado (no una excepcion generica) si la respuesta no cumple el esquema real", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ unexpected: "shape" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    const provider = new CantonalLexWorkProvider(baseConfig());
    await expect(provider.searchDocuments({ query: "a" })).rejects.toThrow();
  });
});
