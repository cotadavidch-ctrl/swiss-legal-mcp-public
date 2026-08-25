import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ProviderUnavailableError } from "@swiss-legal-mcp/core";
import { CantonalSilProvider } from "./cantonalSilProvider.js";
import type { CantonalSilConfig } from "./config.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/cantonal",
);

const GE_BASE_URL = "https://silgeneve.ch";
const GE_BOOK_PATH = "legis/program/books/RSG";
const GE_CONTENT_URL = `${GE_BASE_URL}/${GE_BOOK_PATH}/content.htm`;
const GE_DOC_URL = `${GE_BASE_URL}/${GE_BOOK_PATH}/htm/rsg_a1_01.htm`;
const GE_CONTENT_HTML = readFileSync(path.join(fixturesDir, "sil-ge", "content_sample.htm"));
const GE_DOC_HTML = readFileSync(path.join(fixturesDir, "sil-ge", "rsg_a1_01.htm"));

const NE_BASE_URL = "https://rsn.ne.ch";
const NE_BOOK_PATH = "DATA/program/books/rsne";
const NE_CONTENT_URL = `${NE_BASE_URL}/${NE_BOOK_PATH}/content.htm`;
const NE_DOC_URL = `${NE_BASE_URL}/${NE_BOOK_PATH}/htm/101.htm`;
const NE_CONTENT_HTML = readFileSync(path.join(fixturesDir, "sil-ne", "content_sample.htm"));
const NE_DOC_HTML = readFileSync(path.join(fixturesDir, "sil-ne", "101.htm"));

function geConfig(overrides: Partial<CantonalSilConfig> = {}): CantonalSilConfig {
  return {
    cantonCode: "GE",
    cantonName: "Genève",
    baseUrl: GE_BASE_URL,
    bookPath: GE_BOOK_PATH,
    language: "fr",
    allowedOfficialDomains: ["silgeneve.ch"],
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

function neConfig(overrides: Partial<CantonalSilConfig> = {}): CantonalSilConfig {
  return {
    ...geConfig(overrides),
    cantonCode: "NE",
    cantonName: "Neuchâtel",
    baseUrl: NE_BASE_URL,
    bookPath: NE_BOOK_PATH,
    allowedOfficialDomains: ["rsn.ne.ch"],
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
      const html = { "content-type": "text/html" };
      if (url === GE_CONTENT_URL) {
        return new Response(new Uint8Array(GE_CONTENT_HTML), { status: 200, headers: html });
      }
      if (url === GE_DOC_URL) {
        return new Response(new Uint8Array(GE_DOC_HTML), { status: 200, headers: html });
      }
      if (url === NE_CONTENT_URL) {
        return new Response(new Uint8Array(NE_CONTENT_HTML), { status: 200, headers: html });
      }
      if (url === NE_DOC_URL) {
        return new Response(new Uint8Array(NE_DOC_HTML), { status: 200, headers: html });
      }
      return new Response("no encontrado", { status: 404 });
    }),
  );
  return state;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CantonalSilProvider (Genève)", () => {
  it("searchDocuments filtra por número real ('A 1 01')", async () => {
    installMockFetch();
    const provider = new CantonalSilProvider(geConfig());
    const outcome = await provider.searchDocuments({ systematicNumber: "A 1 01" });
    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0]?.title).toContain("Acte d'union");
    expect(outcome.sourceAttribution.officialCharacter).toBe("official");
  });

  it("searchDocuments pagina sobre el catálogo real (3 entradas en el fixture)", async () => {
    installMockFetch();
    const provider = new CantonalSilProvider(geConfig());
    const page1 = await provider.searchDocuments({ page: 1, pageSize: 2 });
    expect(page1.results).toHaveLength(2);
    expect(page1.pagination).toEqual({ page: 1, pageSize: 2, total: 3 });

    const page2 = await provider.searchDocuments({ page: 2, pageSize: 2 });
    expect(page2.results).toHaveLength(1);
    expect(page2.pagination).toEqual({ page: 2, pageSize: 2, total: 3 });
  });

  it("un catálogo HTML malformado (sin h3/h4 reales) lanza ProviderUnavailableError, no un catálogo vacío silencioso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        if (input.toString() === GE_CONTENT_URL) {
          return new Response(
            new TextEncoder().encode("<html><body><p>estructura cambiada</p></body></html>"),
            { status: 200, headers: { "content-type": "text/html" } },
          );
        }
        return new Response("no encontrado", { status: 404 });
      }),
    );
    const provider = new CantonalSilProvider(geConfig());
    await expect(provider.searchDocuments({})).rejects.toThrow(ProviderUnavailableError);
  });

  it("getDocument descarga el HTML real y decodifica los acentos franceses correctamente", async () => {
    installMockFetch();
    const provider = new CantonalSilProvider(geConfig());
    const doc = await provider.getDocument("cantonal-ge:rsg_a1_01");

    expect(doc.title).toContain("République de Genève");
    expect(doc.fullText).toContain("République");
    expect(doc.contentNature).toBe("literal");
    expect(doc.language).toBe("fr");
  });

  it("getDocument lanza NotFoundError para un identificador inexistente", async () => {
    installMockFetch();
    const provider = new CantonalSilProvider(geConfig());
    await expect(provider.getDocument("cantonal-ge:no_existe")).rejects.toThrow(NotFoundError);
  });

  it("getArticle no está soportado: lanza explícitamente sin aproximar", async () => {
    installMockFetch();
    const provider = new CantonalSilProvider(geConfig());
    await expect(provider.getArticle("rsg_a1_01", "1")).rejects.toThrow(ProviderUnavailableError);
  });

  it("healthCheck es exitoso cuando el catálogo real responde", async () => {
    installMockFetch();
    const provider = new CantonalSilProvider(geConfig());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });
});

describe("CantonalSilProvider (Neuchâtel, mismo adaptador reutilizado)", () => {
  it("searchDocuments filtra por número real ('101')", async () => {
    installMockFetch();
    const provider = new CantonalSilProvider(neConfig());
    const outcome = await provider.searchDocuments({ systematicNumber: "101" });
    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0]?.title).toContain("Constitution");
  });

  it("getDocument descarga el HTML real y decodifica los acentos franceses correctamente", async () => {
    installMockFetch();
    const provider = new CantonalSilProvider(neConfig());
    const doc = await provider.getDocument("cantonal-ne:101");

    expect(doc.title).toContain("Neuchâtel");
    expect(doc.contentNature).toBe("literal");
    expect(doc.jurisdiction).toEqual({ level: "cantonal", canton: "NE" });
  });

  it("el id del proveedor refleja el canton configurado", () => {
    const provider = new CantonalSilProvider(neConfig());
    expect(provider.id).toBe("cantonal-ne");
  });
});
