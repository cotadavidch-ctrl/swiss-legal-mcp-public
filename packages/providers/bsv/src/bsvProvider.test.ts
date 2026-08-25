import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ProviderUnavailableError } from "@swiss-legal-mcp/core";
import { BsvProvider } from "./bsvProvider.js";
import type { BsvConfig } from "./config.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/bsv",
);

const BASE_URL = "https://sozialversicherungen.admin.ch";
const FOLDER_URL = `${BASE_URL}/de/f/5661`;
const DOC_URL = `${BASE_URL}/de/d/18452`;
const CURRENT_PDF_URL = `${BASE_URL}/de/d/18452/download`;

const FOLDER_HTML = readFileSync(
  path.join(fixturesDir, "folder_5661_iv_kreisschreiben_listing_de.html"),
  "utf8",
);
const DOC_HTML = readFileSync(
  path.join(fixturesDir, "document_18452_ksir_version_history_de.html"),
  "utf8",
);
const PDF_BYTES = readFileSync(path.join(fixturesDir, "ksir_de_v6_current.pdf"));
const PDF_EXTRACTION_TEST_TIMEOUT_MS = 45_000;

function baseConfig(overrides: Partial<BsvConfig> = {}): BsvConfig {
  return {
    baseUrl: BASE_URL,
    folderIds: ["5661"],
    timeoutMs: 2_000,
    maxRetries: 1,
    retryBaseDelayMs: 1,
    retryMaxDelayMs: 5,
    circuitBreakerFailureThreshold: 3,
    circuitBreakerResetMs: 200,
    cacheTtlListingMs: 60_000,
    cacheTtlDocumentMs: 60_000,
    cacheMaxEntries: 100,
    maxResponseBytes: 50_000_000,
    allowedOfficialDomains: ["sozialversicherungen.admin.ch"],
    dnsLookup: async () => ["93.184.216.34"],
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
      if (url === FOLDER_URL) {
        return new Response(new TextEncoder().encode(FOLDER_HTML), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (url === DOC_URL) {
        return new Response(new TextEncoder().encode(DOC_HTML), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (url === CURRENT_PDF_URL) {
        return new Response(PDF_BYTES, {
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

describe("BsvProvider", () => {
  it("searchDocuments normaliza el listado de la carpeta configurada", async () => {
    installMockFetch();
    const provider = new BsvProvider(baseConfig());
    const outcome = await provider.searchDocuments({ query: "Invalidität" });

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results[0]?.id).toBe("bsv:18452");
    expect(outcome.sourceAttribution.officialCharacter).toBe("official");
    expect(outcome.coverageWarnings[0]).toContain("rama IV");
  });

  it(
    "fetchDocument sin sufijo de version descarga la version vigente y extrae texto real",
    async () => {
      installMockFetch();
      const provider = new BsvProvider(baseConfig());
      const doc = await provider.fetchDocument("bsv:18452");

      expect(doc.contentNature).toBe("literal");
      expect(doc.fullText!.length).toBeGreaterThan(500);
      expect(doc.administrativeCircular?.status).toBe("current");
      expect(doc.administrativeCircular?.referenceNumber).toBe("318.507.31");
      expect(doc.provenance.downloadUrl).toBe(CURRENT_PDF_URL);
    },
    PDF_EXTRACTION_TEST_TIMEOUT_MS,
  );

  it("fetchDocument con sufijo :v5 pide la version historica correspondiente", async () => {
    const calls = installMockFetch();
    const provider = new BsvProvider(baseConfig());
    // La version 5 en el fixture no tiene PDF real mockeado por separado;
    // se verifica que se solicito la URL de descarga versionada correcta
    // antes de que la ausencia de mock provoque el 404 esperado.
    await expect(provider.fetchDocument("bsv:18452:v5")).rejects.toThrow();
    expect(calls.calls).toContain(`${BASE_URL}/de/d/18452/download?version=5`);
  });

  it("lanza NotFoundError para una version inexistente", async () => {
    installMockFetch();
    const provider = new BsvProvider(baseConfig());
    await expect(provider.fetchDocument("bsv:18452:v999")).rejects.toThrow(NotFoundError);
  });

  it("getSourceAttribution exige haber llamado antes a getDocument", async () => {
    installMockFetch();
    const provider = new BsvProvider(baseConfig());
    expect(() => provider.getSourceAttribution("bsv:18452")).toThrow(ProviderUnavailableError);
  });

  it("healthCheck es exitoso cuando la primera carpeta configurada responde", async () => {
    installMockFetch();
    const provider = new BsvProvider(baseConfig());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("healthCheck sigue siendo exitoso cuando fetch ya descomprimio la carpeta (Content-Encoding: br conservado)", async () => {
    // Reproduce el bug real observado contra sozialversicherungen.admin.ch
    // (2026-08-04): el servidor responde con Content-Encoding: br pero el
    // body que entrega el fetch nativo de Node ya es HTML plano.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();
        if (url === FOLDER_URL) {
          return new Response(new TextEncoder().encode(FOLDER_HTML), {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8", "content-encoding": "br" },
          });
        }
        return new Response("no encontrado", { status: 404 });
      }),
    );
    const provider = new BsvProvider(baseConfig());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });
});
