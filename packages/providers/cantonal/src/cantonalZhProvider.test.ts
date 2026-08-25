import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ProviderUnavailableError } from "@swiss-legal-mcp/core";
import { CantonalZhProvider, buildZhDocumentId, buildZhLexUrl } from "./cantonalZhProvider.js";
import type { CantonalZhConfig } from "./config.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/cantonal/zh-lex",
);

const BASE_URL = "https://www.zh.ch";
const REF = {
  systematicNumber: "131.1",
  effectiveFrom: "2015-04-20",
  effectiveTo: "2018-01-01",
  internalId: "105",
};
const LAW_URL = buildZhLexUrl(BASE_URL, REF);
const LAW_HTML = readFileSync(
  path.join(fixturesDir, "erlass_131_1_gemeindegesetz_main.html"),
  "utf8",
);
const SEARCH_URL_PREFIX = `${BASE_URL}/de/politik-staat/gesetze-beschluesse/gesetzessammlung/_jcr_content/main/lawcollectionsearch_312548694.zhweb-zhlex-ls.zhweb-cache.json`;
const SEARCH_JSON = readFileSync(
  path.join(fixturesDir, "search_reference_number_131_1.json"),
  "utf8",
);

function baseConfig(overrides: Partial<CantonalZhConfig> = {}): CantonalZhConfig {
  return {
    baseUrl: BASE_URL,
    allowedOfficialDomains: ["zh.ch"],
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
      if (url === LAW_URL) {
        return new Response(new TextEncoder().encode(LAW_HTML), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (url === `${BASE_URL}/de/politik-staat/gesetze-beschluesse/gesetzessammlung.html`) {
        return new Response(new TextEncoder().encode("<html><body>ok</body></html>"), {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      if (url.startsWith(SEARCH_URL_PREFIX) && url.includes("referenceNumber=131.1")) {
        return new Response(new TextEncoder().encode(SEARCH_JSON), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("no encontrado", { status: 404 });
    }),
  );
  return state;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildZhLexUrl / buildZhDocumentId", () => {
  it("construye la URL real verificada (Gemeindegesetz, 131.1)", () => {
    expect(LAW_URL).toBe(
      "https://www.zh.ch/de/politik-staat/gesetze-beschluesse/gesetzessammlung/zhlex-ls/erlass-131_1-2015_04_20-2018_01_01-105.html",
    );
  });

  it("id y URL son round-trip consistentes", () => {
    const id = buildZhDocumentId(REF);
    expect(id).toBe("cantonal-zh:131.1:2015-04-20:2018-01-01:105");
  });
});

describe("CantonalZhProvider", () => {
  it("fetchDocument descarga el HTML real y extrae titulo/texto", async () => {
    installMockFetch();
    const provider = new CantonalZhProvider(baseConfig());
    const doc = await provider.fetchDocument(buildZhDocumentId(REF));

    expect(doc.title).toContain("Gemeindegesetz");
    expect(doc.contentNature).toBe("literal");
    expect(doc.fullText!.length).toBeGreaterThan(50);
    expect(doc.jurisdiction).toEqual({ level: "cantonal", canton: "ZH" });
    expect(doc.rawMetadata["systematicNumber"]).toBe("131.1");
    expect(doc.provenance.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("lanza NotFoundError para un id con formato invalido", async () => {
    installMockFetch();
    const provider = new CantonalZhProvider(baseConfig());
    await expect(provider.fetchDocument("cantonal-zh:formato-invalido")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("searchDocuments filtra por numero sistematico real (referenceNumber)", async () => {
    installMockFetch();
    const provider = new CantonalZhProvider(baseConfig());
    const outcome = await provider.searchDocuments({ referenceNumber: "131.1" });

    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0]?.title).toContain("Gemeindegesetz");
    // El id interno real ("132") difiere del capturado en otra fecha para el
    // fixture de `fetchDocument` ("105") -- ZH-Lex reindexa el id interno,
    // el numero sistematico y las fechas de vigencia son lo estable.
    expect(outcome.results[0]?.id).toBe("cantonal-zh:131.1:2015-04-20:2018-01-01:132");
    expect(outcome.pagination.numberOfResults).toBe(1);
    expect(outcome.sourceAttribution.officialCharacter).toBe("official");
  });

  it("search() delega en searchDocuments usando el texto como titulo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();
        if (url.includes("enactmentTitle=Gemeindegesetz")) {
          return new Response(new TextEncoder().encode(SEARCH_JSON), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response("no encontrado", { status: 404 });
      }),
    );
    const provider = new CantonalZhProvider(baseConfig());
    const results = await provider.search({ text: "Gemeindegesetz" });
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toContain("Gemeindegesetz");
  });

  it("healthCheck es exitoso cuando la pagina real de la coleccion responde", async () => {
    installMockFetch();
    const provider = new CantonalZhProvider(baseConfig());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("healthCheck sigue siendo exitoso cuando fetch ya descomprimio la pagina (Content-Encoding: br conservado)", async () => {
    // Mismo bug de doble descompresion que afecto a SECO/BSV/ESTV: los
    // proveedores cantonales comparten SecureHttpClient, asi que get_cantonal_article
    // tambien quedaba bloqueado por este defecto cuando el proveedor real
    // respondia con Content-Encoding pero el body ya llegaba descomprimido.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();
        if (url === `${BASE_URL}/de/politik-staat/gesetze-beschluesse/gesetzessammlung.html`) {
          return new Response(new TextEncoder().encode("<html><body>ok</body></html>"), {
            status: 200,
            headers: { "content-type": "text/html", "content-encoding": "br" },
          });
        }
        return new Response("no encontrado", { status: 404 });
      }),
    );
    const provider = new CantonalZhProvider(baseConfig());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("getSourceAttribution exige haber llamado antes a getDocument", async () => {
    installMockFetch();
    const provider = new CantonalZhProvider(baseConfig());
    expect(() => provider.getSourceAttribution(buildZhDocumentId(REF))).toThrow(
      ProviderUnavailableError,
    );
  });
});
