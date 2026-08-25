import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NonTextualDocumentError,
  NotFoundError,
  ProviderUnavailableError,
} from "@swiss-legal-mcp/core";
import { CantonalJuProvider, buildJuDocumentId, parseJuDocumentId } from "./cantonalJuProvider.js";
import type { CantonalJuConfig } from "./config.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/cantonal/ju",
);

const BASE_URL = "https://rsju.jura.ch";
const DOC_URL = `${BASE_URL}/fr/viewdocument.html?idn=20002&id=36641&download=1`;
const PDF_BYTES = readFileSync(path.join(fixturesDir, "document_20002_36641.pdf"));

/**
 * PDF válido de una página, sin capa de texto real -- mismo fixture
 * verificado que en cantonalSzProvider.test.ts (16 caracteres de metadatos,
 * por debajo del umbral de 20/página de `extractPdfText`).
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

function baseConfig(overrides: Partial<CantonalJuConfig> = {}): CantonalJuConfig {
  return {
    baseUrl: BASE_URL,
    allowedOfficialDomains: ["rsju.jura.ch"],
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
      if (url === DOC_URL) {
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
      if (url === `${BASE_URL}/Default.aspx`) {
        return new Response("<html><body>ok</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
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

describe("buildJuDocumentId / parseJuDocumentId", () => {
  it("round-trip real con id/idn reales de la auditoría", () => {
    const ref = { idn: "20002", id: "36641" };
    const id = buildJuDocumentId(ref);
    expect(id).toBe("cantonal-ju:20002:36641");
    expect(parseJuDocumentId(id)).toEqual(ref);
  });

  it("devuelve undefined para un id con formato inválido", () => {
    expect(parseJuDocumentId("cantonal-ju:solo-una-parte")).toBeUndefined();
  });
});

/**
 * Items del checklist de pruebas del cierre cantonal deliberadamente NO
 * cubiertos aquí, con la razón real:
 * - "estado ASP.NET invalido" / "cookies": el mecanismo real verificado en
 *   la auditoría en vivo (viewdocument.html?idn=X&id=Y&download=1) es un
 *   GET directo sin formulario, sin __VIEWSTATE/__EVENTVALIDATION ni
 *   sesión por cookie -- CantonalJuProvider nunca realiza un postback, así
 *   que no existe ese camino de código para probar. Ver el docstring de la
 *   clase para la evidencia completa.
 * - SSRF/timeout/429/502/503/504/circuit breaker/cache/redirección externa:
 *   cubiertos una sola vez en packages/shared-web/src/secureHttpClient.test.ts
 *   (reutilizado sin cambios por este proveedor vía SecureHttpClient), no
 *   se duplican por cantón.
 */
describe("CantonalJuProvider", () => {
  it("getDocument rechaza un PDF sin capa de texto (escaneado) sin usar OCR", async () => {
    installMockFetch({ scannedPdf: true });
    const provider = new CantonalJuProvider(baseConfig());
    await expect(provider.getDocument("cantonal-ju:20002:36641")).rejects.toThrow(
      NonTextualDocumentError,
    );
  });

  it("getDocument descarga el PDF real (idn+id conocidos) y extrae texto", async () => {
    installMockFetch();
    const provider = new CantonalJuProvider(baseConfig());
    const doc = await provider.getDocument("cantonal-ju:20002:36641");

    expect(doc.fullText).toBeDefined();
    expect(doc.fullText!.length).toBeGreaterThan(50);
    expect(doc.contentNature).toBe("literal");
    expect(doc.jurisdiction).toEqual({ level: "cantonal", canton: "JU" });
    expect(doc.rawMetadata["idn"]).toBe("20002");
    expect(doc.rawMetadata["id"]).toBe("36641");
  }, 20_000);

  it("getDocument lanza NotFoundError para un id con formato inválido", async () => {
    installMockFetch();
    const provider = new CantonalJuProvider(baseConfig());
    await expect(provider.getDocument("cantonal-ju:formato-invalido")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("search() no está soportado: lanza explícitamente sin inventar resultados", async () => {
    installMockFetch();
    const provider = new CantonalJuProvider(baseConfig());
    await expect(provider.search({ text: "constitution" })).rejects.toThrow(
      ProviderUnavailableError,
    );
  });

  it("healthCheck es exitoso cuando el portal real responde", async () => {
    installMockFetch();
    const provider = new CantonalJuProvider(baseConfig());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("getSourceAttribution funciona tras getDocument", async () => {
    installMockFetch();
    const provider = new CantonalJuProvider(baseConfig());
    const doc = await provider.getDocument("cantonal-ju:20002:36641");
    const attribution = provider.getSourceAttribution(doc.id);
    expect(attribution.officialCharacter).toBe("official");
  }, 20_000);
});
