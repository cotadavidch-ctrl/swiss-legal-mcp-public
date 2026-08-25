import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ProviderUnavailableError } from "@swiss-legal-mcp/core";
import { EstvProvider } from "./estvProvider.js";
import type { EstvConfig } from "./config.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/estv",
);

const LISTING_URL_DBST = "https://www.estv.admin.ch/de/kreisschreiben-direkten-bundessteuer";
const LISTING_URL_STEMPEL = "https://www.estv.admin.ch/de/kreisschreiben-stempelabgaben";
const LISTING_URL_VST = "https://www.estv.admin.ch/de/kreisschreiben-verrechnungssteuer";
const LISTING_HTML = readFileSync(
  path.join(fixturesDir, "kreisschreiben_direkte_bundessteuer_listing_de.html"),
  "utf8",
);
const KS50A_PDF_URL =
  "https://www.estv.admin.ch/dam/de/sd-web/ueIUB1Kh5VCK/dbst-ks-2020-1-050a-d-de.pdf";
const KS50A_PDF_BYTES = readFileSync(
  path.join(fixturesDir, "kreisschreiben_50a_bestechungsgelder_de.pdf"),
);

function baseConfig(overrides: Partial<EstvConfig> = {}): EstvConfig {
  return {
    listingUrls: {
      direkteBundessteuer: LISTING_URL_DBST,
      stempelabgaben: LISTING_URL_STEMPEL,
      verrechnungssteuer: LISTING_URL_VST,
    },
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
    allowedOfficialDomains: ["www.estv.admin.ch"],
    dnsLookup: async () => ["93.184.216.34"],
    ...overrides,
  };
}

function emptyListingResponse(): Response {
  return new Response(new TextEncoder().encode("<html><body>vacio</body></html>"), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function installMockFetch(): { calls: string[] } {
  const state = { calls: [] as string[] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = input.toString();
      state.calls.push(url);
      if (url === LISTING_URL_DBST) {
        return new Response(new TextEncoder().encode(LISTING_HTML), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (url === LISTING_URL_STEMPEL || url === LISTING_URL_VST) {
        return emptyListingResponse();
      }
      if (url === KS50A_PDF_URL) {
        return new Response(KS50A_PDF_BYTES, {
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

describe("EstvProvider", () => {
  it("searchDocuments agrega las tres paginas de listado configuradas", async () => {
    const calls = installMockFetch();
    const provider = new EstvProvider(baseConfig());
    const outcome = await provider.searchDocuments({ query: "Bestechungsgeldern" });

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.sourceAttribution.officialCharacter).toBe("official");
    expect(outcome.coverageWarnings[0]).toContain("MWST-Infos");
    expect(calls.calls).toContain(LISTING_URL_DBST);
    expect(calls.calls).toContain(LISTING_URL_STEMPEL);
    expect(calls.calls).toContain(LISTING_URL_VST);
  });

  it("fetchDocument descarga el PDF real del Kreisschreiben Nr. 50a y extrae texto", async () => {
    installMockFetch();
    const provider = new EstvProvider(baseConfig());
    const id = "estv:dbst-ks-2020-1-050a-d-de";
    const doc = await provider.fetchDocument(id);

    expect(doc.contentNature).toBe("literal");
    expect(doc.fullText!.length).toBeGreaterThan(200);
    expect(doc.administrativeCircular?.referenceNumber).toBe("Nr. 50a");
    expect(doc.provenance.downloadUrl).toBe(KS50A_PDF_URL);
  }, 15_000);

  it("lanza NotFoundError para un id que no existe en ningun listado", async () => {
    installMockFetch();
    const provider = new EstvProvider(baseConfig());
    await expect(provider.fetchDocument("estv:no-existe")).rejects.toThrow(NotFoundError);
  });

  it("getSourceAttribution exige haber llamado antes a getDocument", async () => {
    installMockFetch();
    const provider = new EstvProvider(baseConfig());
    expect(() => provider.getSourceAttribution("estv:dbst-ks-2020-1-050a-d-de")).toThrow(
      ProviderUnavailableError,
    );
  });

  it("healthCheck es exitoso cuando el listado de Direkte Bundessteuer responde", async () => {
    installMockFetch();
    const provider = new EstvProvider(baseConfig());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("healthCheck sigue siendo exitoso cuando fetch ya descomprimio el listado (Content-Encoding: gzip conservado)", async () => {
    // Reproduce el bug real observado contra estv.admin.ch (2026-08-04): el
    // servidor responde con Content-Encoding: gzip pero el body que entrega
    // el fetch nativo de Node ya es HTML plano.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();
        if (url === LISTING_URL_DBST) {
          return new Response(new TextEncoder().encode(LISTING_HTML), {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8", "content-encoding": "gzip" },
          });
        }
        return new Response("no encontrado", { status: 404 });
      }),
    );
    const provider = new EstvProvider(baseConfig());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });
});
