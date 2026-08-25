import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NotFoundError,
  NonTextualDocumentError,
  ProviderUnavailableError,
} from "@swiss-legal-mcp/core";
import { CantonalSzProvider } from "./cantonalSzProvider.js";
import type { CantonalSzConfig } from "./config.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/cantonal/sz",
);

const BASE_URL = "https://www.sz.ch";
const COLLECTION_PATH = "/kanton/gesetze/systematische-gesetzsammlung.html/8756-8757-10021-11689";
const COLLECTION_URL = `${BASE_URL}${COLLECTION_PATH}`;
const COLLECTION_HTML = readFileSync(path.join(fixturesDir, "collection_sample.html"), "utf8");
const PDF_URL = "https://www.sz.ch/public/upload/assets/7256/100_100.pdf?fp=8";
const PDF_BYTES = readFileSync(path.join(fixturesDir, "100_100.pdf"));

/**
 * PDF válido de una página, sin capa de texto real (16 caracteres de
 * metadatos, por debajo del umbral de 20/página) -- verificado
 * manualmente con `pdf-parse` para asegurar que dispara
 * `NonTextualDocumentError` real, no un `InvalidPDFException` por
 * estructura inválida (un PDF con bytes aleatorios no simula un
 * documento escaneado real, solo un archivo corrupto).
 */
const BLANK_PDF = new TextEncoder().encode(
  `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000052 00000 n
0000000101 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
164
%%EOF`,
);

function baseConfig(overrides: Partial<CantonalSzConfig> = {}): CantonalSzConfig {
  return {
    baseUrl: BASE_URL,
    collectionPath: COLLECTION_PATH,
    allowedOfficialDomains: ["sz.ch"],
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

function installMockFetch(options: { scannedPdf?: boolean } = {}): { calls: string[] } {
  const state = { calls: [] as string[] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = input.toString();
      state.calls.push(url);
      if (url === COLLECTION_URL) {
        return new Response(new TextEncoder().encode(COLLECTION_HTML), {
          status: 200,
          headers: { "content-type": "text/html; charset=UTF-8" },
        });
      }
      if (url === PDF_URL) {
        if (options.scannedPdf) {
          return new Response(new Uint8Array(BLANK_PDF), {
            status: 200,
            headers: { "content-type": "application/pdf" },
          });
        }
        return new Response(new Uint8Array(PDF_BYTES), {
          status: 200,
          headers: { "content-type": "application/pdf" },
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

describe("CantonalSzProvider", () => {
  it("searchDocuments filtra el catálogo real por número SRSZ", async () => {
    installMockFetch();
    const provider = new CantonalSzProvider(baseConfig());
    const outcome = await provider.searchDocuments({ systematicNumber: "100.100" });

    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0]?.title).toContain("Verfassung");
    expect(outcome.results[0]?.rawMetadata["srszNumber"]).toBe("100.100");
    expect(outcome.sourceAttribution.officialCharacter).toBe("official");
  });

  it("searchDocuments filtra por texto en el título", async () => {
    installMockFetch();
    const provider = new CantonalSzProvider(baseConfig());
    const outcome = await provider.searchDocuments({ query: "Steuergesetz" });
    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results[0]?.rawMetadata["srszNumber"]).toBe("172.200");
  });

  it("searchDocuments pagina sobre el catálogo real (5 entradas en el fixture)", async () => {
    installMockFetch();
    const provider = new CantonalSzProvider(baseConfig());
    const page1 = await provider.searchDocuments({ page: 1, pageSize: 2 });
    expect(page1.results).toHaveLength(2);
    expect(page1.pagination).toEqual({ page: 1, pageSize: 2, total: 5 });

    const page3 = await provider.searchDocuments({ page: 3, pageSize: 2 });
    expect(page3.results).toHaveLength(1);
    expect(page3.pagination).toEqual({ page: 3, pageSize: 2, total: 5 });
    expect(page3.results[0]?.rawMetadata["srszNumber"]).not.toBe(
      page1.results[0]?.rawMetadata["srszNumber"],
    );
  });

  it("un catálogo HTML malformado (sin filas reales) lanza ProviderUnavailableError, no un catálogo vacío silencioso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        if (input.toString() === COLLECTION_URL) {
          return new Response(
            new TextEncoder().encode("<html><body><p>estructura cambiada</p></body></html>"),
            { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } },
          );
        }
        return new Response("no encontrado", { status: 404 });
      }),
    );
    const provider = new CantonalSzProvider(baseConfig());
    await expect(provider.searchDocuments({})).rejects.toThrow(ProviderUnavailableError);
  });

  it("getDocument descarga el PDF real y extrae texto", async () => {
    installMockFetch();
    const provider = new CantonalSzProvider(baseConfig());
    const doc = await provider.getDocument("cantonal-sz:100.100");

    expect(doc.title).toContain("Verfassung");
    expect(doc.fullText).toBeDefined();
    expect(doc.fullText!.length).toBeGreaterThan(50);
    expect(doc.contentNature).toBe("literal");
    expect(doc.provenance.contentHash).toMatch(/^[0-9a-f]{64}$/);
  }, 20_000);

  it("getDocument rechaza un PDF sin capa de texto (escaneado) sin usar OCR", async () => {
    installMockFetch({ scannedPdf: true });
    const provider = new CantonalSzProvider(baseConfig());
    await expect(provider.getDocument("cantonal-sz:100.100")).rejects.toThrow(
      NonTextualDocumentError,
    );
  });

  it("getDocument lanza NotFoundError para un número SRSZ inexistente", async () => {
    installMockFetch();
    const provider = new CantonalSzProvider(baseConfig());
    await expect(provider.getDocument("cantonal-sz:999.999")).rejects.toThrow(NotFoundError);
  });

  it("getArticle no está soportado: lanza explícitamente sin aproximar", async () => {
    installMockFetch();
    const provider = new CantonalSzProvider(baseConfig());
    await expect(provider.getArticle("100.100", "1")).rejects.toThrow(ProviderUnavailableError);
  });

  it("healthCheck es exitoso cuando el catálogo real responde", async () => {
    installMockFetch();
    const provider = new CantonalSzProvider(baseConfig());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("reutiliza el catálogo cacheado en llamadas sucesivas (una sola petición HTTP)", async () => {
    const calls = installMockFetch();
    const provider = new CantonalSzProvider(baseConfig());
    await provider.searchDocuments({ query: "a" });
    await provider.searchDocuments({ query: "b" });
    expect(calls.calls.filter((url) => url === COLLECTION_URL)).toHaveLength(1);
  });

  it("getSourceAttribution funciona tras getDocument", async () => {
    installMockFetch();
    const provider = new CantonalSzProvider(baseConfig());
    const doc = await provider.getDocument("cantonal-sz:100.100");
    const attribution = provider.getSourceAttribution(doc.id);
    expect(attribution.officialCharacter).toBe("official");
  }, 20_000);
});
