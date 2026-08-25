import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderResponseError,
  ProviderUnavailableError,
  RateLimitedError,
} from "@swiss-legal-mcp/core";
import {
  FedlexSparqlClient,
  assertSafeIri,
  assertSafeIsoDate,
  assertSafeSystematicNumber,
  buildDescribeQuery,
  buildFindWorksBySystematicNumberQuery,
  buildListConsolidationsQuery,
  buildSearchByTitleQuery,
  sparqlEscapeString,
} from "./sparqlClient.js";
import type { FedlexConfig } from "./config.js";

const ENDPOINT = "https://mock.fedlex.test/sparqlendpoint";

function baseConfig(overrides: Partial<FedlexConfig> = {}): FedlexConfig {
  return {
    sparqlEndpoint: ENDPOINT,
    timeoutMs: 200,
    maxRetries: 2,
    retryBaseDelayMs: 5,
    retryMaxDelayMs: 20,
    circuitBreakerFailureThreshold: 2,
    circuitBreakerResetMs: 200,
    cacheTtlSparqlMs: 0,
    cacheTtlManifestationMs: 0,
    maxResponseBytes: 5_000_000,
    maxXmlBytes: 5_000_000,
    allowedOfficialDomains: ["fedlex.admin.ch", "fedlex.data.admin.ch"],
    ...overrides,
  };
}

function sparqlJsonResponse(
  vars: string[],
  bindings: Record<string, unknown>[],
  status = 200,
): Response {
  return new Response(JSON.stringify({ head: { vars }, results: { bindings } }), {
    status,
    headers: { "content-type": "application/sparql-results+json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("query builders (prevencion de inyeccion SPARQL)", () => {
  it("escapa comillas y backslashes en literales", () => {
    expect(sparqlEscapeString('a"b\\c')).toBe('a\\"b\\\\c');
  });

  it("acepta un IRI https valido", () => {
    expect(() => assertSafeIri("https://fedlex.data.admin.ch/eli/cc/1999/404")).not.toThrow();
  });

  it("rechaza un IRI que intenta romper fuera de los angle-brackets de la consulta", () => {
    expect(() =>
      assertSafeIri("https://fedlex.data.admin.ch/eli/cc/1999/404> . ?x ?y ?z #"),
    ).toThrow();
    expect(() => assertSafeIri("https://fedlex.data.admin.ch/eli/cc/1999/404 evil")).toThrow();
  });

  it("rechaza protocolo no https", () => {
    expect(() => assertSafeIri("http://fedlex.data.admin.ch/eli/cc/1999/404")).toThrow();
  });

  it("rechaza un numero sistematico con formato no reconocido (posible inyeccion)", () => {
    expect(() => assertSafeSystematicNumber('220" . ?x ?y ?z #')).toThrow();
    expect(() => assertSafeSystematicNumber("832.10")).not.toThrow();
  });

  it("rechaza una fecha con formato no reconocido", () => {
    expect(() => assertSafeIsoDate("2024-99-99")).not.toThrow(); // formato sintactico ok, no valida calendario real
    expect(() => assertSafeIsoDate('2024" . ?x ?y ?z #')).toThrow();
  });

  it("buildFindWorksBySystematicNumberQuery incrusta el valor escapado, no crudo", () => {
    const query = buildFindWorksBySystematicNumberQuery("832.10");
    expect(query).toContain('"832.10"');
    expect(query).toContain("jolux:historicalLegalId");
  });

  it("buildDescribeQuery rechaza un IRI no https antes de construir la consulta", () => {
    expect(() => buildDescribeQuery("ftp://fedlex.data.admin.ch/eli/cc/1999/404")).toThrow();
  });

  it("buildListConsolidationsQuery incluye jolux:isMemberOf y ORDER BY", () => {
    const query = buildListConsolidationsQuery("https://fedlex.data.admin.ch/eli/cc/1999/404");
    expect(query).toContain("jolux:isMemberOf");
    expect(query).toContain("ORDER BY");
  });

  it("buildSearchByTitleQuery escapa el texto de busqueda y limita el LIMIT a un maximo razonable", () => {
    const query = buildSearchByTitleQuery('Obligationenrecht" evil', "DEU", 99999);
    expect(query).toContain('Obligationenrecht\\" evil');
    expect(query).toMatch(/LIMIT 200$/);
  });
});

describe("FedlexSparqlClient (transporte mockeado, sin red real)", () => {
  it("ejecuta una consulta y devuelve el resultado validado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sparqlJsonResponse(
          ["work"],
          [{ work: { type: "uri", value: "https://fedlex.data.admin.ch/eli/cc/27/317_321_377" } }],
        ),
      ),
    );
    const client = new FedlexSparqlClient(baseConfig());
    const result = await client.query(buildFindWorksBySystematicNumberQuery("220"));
    expect(result.results.bindings).toHaveLength(1);
    expect(result.results.bindings[0]?.["work"]?.value).toBe(
      "https://fedlex.data.admin.ch/eli/cc/27/317_321_377",
    );
  });

  it("reintenta tras un 504 transitorio y termina en exito", async () => {
    let attempt = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) return new Response("gateway timeout", { status: 504 });
        return sparqlJsonResponse(["work"], []);
      }),
    );
    const client = new FedlexSparqlClient(baseConfig());
    await client.query("SELECT ?work WHERE { ?work a <x> }");
    expect(attempt).toBe(2);
  });

  it("agota reintentos por timeout real (AbortController) y termina en ProviderUnavailableError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise<Response>((resolve, reject) => {
            const timer = setTimeout(() => resolve(sparqlJsonResponse(["x"], [])), 500);
            init?.signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      ),
    );
    const client = new FedlexSparqlClient(
      baseConfig({ timeoutMs: 30, maxRetries: 1, retryBaseDelayMs: 5, retryMaxDelayMs: 10 }),
    );
    await expect(client.query("SELECT ?x WHERE { ?x ?y ?z }")).rejects.toThrow(
      ProviderUnavailableError,
    );
  }, 10_000);

  it("reintenta tras un 503 transitorio y termina en exito", async () => {
    let attempt = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) return new Response("service unavailable", { status: 503 });
        return sparqlJsonResponse(["work"], []);
      }),
    );
    const client = new FedlexSparqlClient(baseConfig());
    const result = await client.query("SELECT ?work WHERE { ?work a <x> }");
    expect(result.results.bindings).toEqual([]);
    expect(attempt).toBe(2);
  });

  it("clasifica 429 agotado como RateLimitedError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("too many requests", { status: 429 })),
    );
    const client = new FedlexSparqlClient(baseConfig({ maxRetries: 0 }));
    await expect(client.query("SELECT ?x WHERE { ?x ?y ?z }")).rejects.toThrow(RateLimitedError);
  });

  it("abre el circuit breaker tras fallos consecutivos", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return new Response("bad gateway", { status: 502 });
      }),
    );
    const client = new FedlexSparqlClient(
      baseConfig({ maxRetries: 0, circuitBreakerFailureThreshold: 1 }),
    );
    await expect(client.query("SELECT ?x WHERE { ?x ?y ?z }")).rejects.toThrow(
      ProviderUnavailableError,
    );
    const callsAfterFirstFailure = calls;
    await expect(client.query("SELECT ?x WHERE { ?x ?y ?z }")).rejects.toThrow(
      ProviderUnavailableError,
    );
    expect(calls).toBe(callsAfterFirstFailure);
  });

  it("rechaza un Content-Type inesperado como ProviderResponseError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html>no</html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      ),
    );
    const client = new FedlexSparqlClient(baseConfig({ maxRetries: 0 }));
    await expect(client.query("SELECT ?x WHERE { ?x ?y ?z }")).rejects.toThrow(
      ProviderResponseError,
    );
  });

  it("rechaza una respuesta con forma SPARQL invalida como ProviderResponseError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ nope: true }), {
            status: 200,
            headers: { "content-type": "application/sparql-results+json" },
          }),
      ),
    );
    const client = new FedlexSparqlClient(baseConfig({ maxRetries: 0 }));
    await expect(client.query("SELECT ?x WHERE { ?x ?y ?z }")).rejects.toThrow(
      ProviderResponseError,
    );
  });

  it("respeta el limite de tamano de respuesta (Content-Length)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ head: { vars: [] }, results: { bindings: [] } }), {
            status: 200,
            headers: {
              "content-type": "application/sparql-results+json",
              "content-length": "999999999",
            },
          }),
      ),
    );
    const client = new FedlexSparqlClient(baseConfig({ maxResponseBytes: 1000, maxRetries: 0 }));
    await expect(client.query("SELECT ?x WHERE { ?x ?y ?z }")).rejects.toThrow(
      ProviderUnavailableError,
    );
  });

  it("cachea resultados exitosos y no vuelve a llamar a fetch", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return sparqlJsonResponse(["x"], []);
      }),
    );
    const client = new FedlexSparqlClient(baseConfig({ cacheTtlSparqlMs: 60_000 }));
    await client.query("SELECT ?x WHERE { ?x ?y ?z }", "cache-key-1");
    await client.query("SELECT ?x WHERE { ?x ?y ?z }", "cache-key-1");
    expect(calls).toBe(1);
  });

  it("fetchManifestation rechaza una URL fuera de la allowlist de Fedlex", async () => {
    const client = new FedlexSparqlClient(baseConfig());
    await expect(
      client.fetchManifestation("https://intranet.fedlex.admin.ch/secret.xml"),
    ).rejects.toThrow();
  });

  it("ask() valida la forma real de una respuesta ASK (distinta de SELECT)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ head: { link: [] }, boolean: true }), {
            status: 200,
            headers: { "content-type": "application/sparql-results+json" },
          }),
      ),
    );
    const client = new FedlexSparqlClient(baseConfig());
    await expect(client.ask("ASK { ?s ?p ?o }")).resolves.toBe(true);
  });

  it("ask() rechaza una respuesta con forma SELECT en vez de ASK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sparqlJsonResponse(["x"], [])),
    );
    const client = new FedlexSparqlClient(baseConfig({ maxRetries: 0 }));
    await expect(client.ask("ASK { ?s ?p ?o }")).rejects.toThrow(ProviderResponseError);
  });

  it("fetchManifestation descarga una manifestacion real de un dominio permitido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<akomaNtoso/>", {
            status: 200,
            headers: { "content-type": "application/xml" },
          }),
      ),
    );
    const client = new FedlexSparqlClient(baseConfig());
    const body = await client.fetchManifestation(
      "https://fedlex.data.admin.ch/filestore/some-real-file.xml",
    );
    expect(body).toBe("<akomaNtoso/>");
  });
});
