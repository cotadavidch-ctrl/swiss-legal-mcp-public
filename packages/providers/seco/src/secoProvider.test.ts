import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ProviderUnavailableError } from "@swiss-legal-mcp/core";
import { SecoProvider } from "./secoProvider.js";
import type { SecoConfig } from "./config.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/seco",
);

const LISTING_URL_DE = "https://www.arbeit.swiss/de/informationszentrum/publikationen";
const LISTING_HTML = readFileSync(
  path.join(fixturesDir, "publikationen_weisungen_section_de.html"),
  "utf8",
);
const KAE_PDF_URL =
  "https://www.arbeit.swiss/api/media/fileservice/sdweb-docs-prod-arbeitswiss-files/files/2026/06/24/f134ea35-f4ff-4127-88de-1dca50b0267d.pdf";
const KAE_PDF_BYTES = readFileSync(path.join(fixturesDir, "weisung_avig_kae_de_2026-07-01.pdf"));
const PDF_EXTRACTION_TEST_TIMEOUT_MS = 45_000;

function baseConfig(overrides: Partial<SecoConfig> = {}): SecoConfig {
  return {
    listingUrls: { de: LISTING_URL_DE, fr: "https://www.arbeit.swiss/fr/x" },
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
    allowedOfficialDomains: ["www.arbeit.swiss", "backend.arbeit.swiss"],
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
      if (url === LISTING_URL_DE) {
        return new Response(new TextEncoder().encode(LISTING_HTML), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (url === KAE_PDF_URL) {
        return new Response(KAE_PDF_BYTES, {
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

describe("SecoProvider", () => {
  it("searchDocuments devuelve resultados normalizados con atribucion y avisos de cobertura", async () => {
    installMockFetch();
    const provider = new SecoProvider(baseConfig());
    const outcome = await provider.searchDocuments({ query: "KAE" });

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results[0]?.documentType).toBe("administrative_circular");
    expect(outcome.sourceAttribution.officialCharacter).toBe("official");
    expect(outcome.coverageWarnings[0]).toContain("archivo historico");
  });

  it("filtra por documentType tras normalizar", async () => {
    installMockFetch();
    const provider = new SecoProvider(baseConfig());
    const outcome = await provider.searchDocuments({ documentType: "guidance" });
    expect(
      outcome.results.every(
        (r) => r.administrativeCircular?.administrativeDocumentType === "guidance",
      ),
    ).toBe(true);
    expect(outcome.results.length).toBeGreaterThan(0);
  });

  it(
    "fetchDocument descarga el PDF real, extrae texto y calcula hash",
    async () => {
      installMockFetch();
      const provider = new SecoProvider(baseConfig());
      const id = "seco:de:f134ea35-f4ff-4127-88de-1dca50b0267d";
      const doc = await provider.fetchDocument(id);

      expect(doc.contentNature).toBe("literal");
      expect(doc.fullText).toBeDefined();
      expect(doc.fullText!.length).toBeGreaterThan(500);
      expect(doc.provenance.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(doc.provenance.downloadUrl).toBe(KAE_PDF_URL);
    },
    PDF_EXTRACTION_TEST_TIMEOUT_MS,
  );

  it("lanza NotFoundError para un id que no existe en el listado", async () => {
    installMockFetch();
    const provider = new SecoProvider(baseConfig());
    await expect(provider.fetchDocument("seco:de:no-existe")).rejects.toThrow(NotFoundError);
  });

  it("getSourceAttribution exige haber llamado antes a getDocument", async () => {
    installMockFetch();
    const provider = new SecoProvider(baseConfig());
    expect(() =>
      provider.getSourceAttribution("seco:de:f134ea35-f4ff-4127-88de-1dca50b0267d"),
    ).toThrow(ProviderUnavailableError);
  });

  it("healthCheck es exitoso cuando el listado responde correctamente", async () => {
    installMockFetch();
    const provider = new SecoProvider(baseConfig());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("healthCheck sigue siendo exitoso cuando fetch ya descomprimio el listado (Content-Encoding: br conservado)", async () => {
    // Reproduce el bug real observado contra arbeit.swiss (2026-08-04): el
    // servidor responde con Content-Encoding: br pero el body que entrega el
    // fetch nativo de Node ya es HTML plano. Antes de la correccion en
    // SecureHttpClient, esto rompia el healthCheck con "Respuesta comprimida
    // invalida" pese a que la fuente respondia con HTTP 200 y contenido valido.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();
        if (url === LISTING_URL_DE) {
          return new Response(new TextEncoder().encode(LISTING_HTML), {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8", "content-encoding": "br" },
          });
        }
        return new Response("no encontrado", { status: 404 });
      }),
    );
    const provider = new SecoProvider(baseConfig());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("reutiliza el listado cacheado en llamadas sucesivas (una sola peticion HTTP)", async () => {
    const calls = installMockFetch();
    const provider = new SecoProvider(baseConfig());
    await provider.searchDocuments({ query: "KAE" });
    await provider.searchDocuments({ query: "SWE" });
    const listingCalls = calls.calls.filter((url) => url === LISTING_URL_DE);
    expect(listingCalls).toHaveLength(1);
  });
});
