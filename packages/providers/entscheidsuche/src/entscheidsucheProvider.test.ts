import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { NotFoundError, ProviderUnavailableError } from "@swiss-legal-mcp/core";
import { EntscheidsucheMcpProvider } from "./entscheidsucheProvider.js";
import { loadEntscheidsucheConfig } from "./config.js";
import type { EntscheidsucheRemoteClient } from "./remoteClient.js";
import type { RemoteSearchHit } from "./remoteTypes.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/entscheidsuche",
);

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, `${name}.json`), "utf8")) as T;
}

function loadFetchDocumentHit(name: string): RemoteSearchHit {
  const raw = loadFixture<{
    parsed: { result: { structuredContent: { result: RemoteSearchHit } } };
  }>(name);
  return raw.parsed.result.structuredContent.result;
}

function loadSearchStructuredContent(name: string): unknown {
  const raw = loadFixture<{ parsed: { result: { content: [{ text: string }] } } }>(name);
  return JSON.parse(raw.parsed.result.content[0].text) as unknown;
}

function toolResult(structuredContent: unknown, isError = false): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
    structuredContent: isError ? undefined : (structuredContent as Record<string, unknown>),
    isError,
  };
}

interface FakeRemoteClient {
  callTool: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function makeFakeRemoteClient(
  handler: (
    name: string,
    args: Record<string, unknown>,
  ) => CallToolResult | Promise<CallToolResult>,
): FakeRemoteClient {
  return {
    callTool: vi.fn(handler),
    close: vi.fn(async () => {}),
  };
}

function providerWith(fake: FakeRemoteClient): EntscheidsucheMcpProvider {
  const config = loadEntscheidsucheConfig({});
  return new EntscheidsucheMcpProvider(config, fake as unknown as EntscheidsucheRemoteClient);
}

describe("EntscheidsucheMcpProvider", () => {
  it("searchCases mapea resultados, paginacion, filtros aplicados y advertencia no oficial", async () => {
    const fake = makeFakeRemoteClient((name) => {
      expect(name).toBe("search");
      return toolResult(loadSearchStructuredContent("search_fr_droit_du_bail"));
    });
    const provider = providerWith(fake);

    const outcome = await provider.searchCases({
      query: "droit du bail",
      language: "fr",
      pageSize: 3,
    });

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.pagination.total).toBeGreaterThan(0);
    expect(outcome.filtersApplied.query).toBe("droit du bail");
    expect(outcome.warning.aggregatorName).toBe("entscheidsuche.ch");
    expect(outcome.results[0]?.language).toBe("fr");
    expect(outcome.results[0]?.excerptOnly).toBe(true);
    expect(outcome.results[0]?.fullText).toBeUndefined();
  });

  it("searchCases con canton/court construye el filtro hierarchy correcto", async () => {
    const fake = makeFakeRemoteClient((name, args) => {
      expect(args["hierarchy"]).toEqual(["VD_TC"]);
      return toolResult(loadSearchStructuredContent("search_fr_vaud_cantonal"));
    });
    const provider = providerWith(fake);
    await provider.searchCases({ query: "bail", court: "VD_TC", canton: "VD" });
  });

  it("searchCases sin resultados no lanza error y devuelve un array vacio", async () => {
    const fake = makeFakeRemoteClient(() =>
      toolResult(loadSearchStructuredContent("search_empty_result")),
    );
    const provider = providerWith(fake);
    const outcome = await provider.searchCases({ query: "zzz_no_existe" });
    expect(outcome.results).toEqual([]);
    expect(outcome.pagination.total).toBe(0);
  });

  it("searchCases con respuesta malformada del proveedor lanza un error de validacion", async () => {
    const fake = makeFakeRemoteClient(() => toolResult({ hits: "esto-no-es-un-array" }));
    const provider = providerWith(fake);
    await expect(provider.searchCases({ query: "*" })).rejects.toThrow();
  });

  it("get_case (fetchDocument) recupera el documento federal completo en aleman", async () => {
    const hit = loadFetchDocumentHit("fetch_document_bge_142_III_1");
    const fake = makeFakeRemoteClient((name, args) => {
      expect(name).toBe("fetch_document");
      expect(args["id"]).toBe(hit.id);
      return toolResult({ result: hit });
    });
    const provider = providerWith(fake);
    const doc = await provider.fetchDocument(hit.id);
    expect(doc.fullText).toBeDefined();
    expect(doc.bgeAtfDtf).toBe("BGE 142 III 1");
  });

  it("get_case lanza NotFoundError cuando fetch_document devuelve result:null", async () => {
    const fake = makeFakeRemoteClient(() => toolResult({ result: null }));
    const provider = providerWith(fake);
    await expect(provider.fetchDocument("id-inexistente")).rejects.toThrow(NotFoundError);
  });

  it("get_case cachea el documento: la segunda llamada no vuelve a invocar al proveedor remoto", async () => {
    const hit = loadFetchDocumentHit("fetch_document_vd_fr_cantonal");
    const fake = makeFakeRemoteClient(() => toolResult({ result: hit }));
    const provider = providerWith(fake);
    await provider.fetchDocument(hit.id);
    await provider.fetchDocument(hit.id);
    expect(fake.callTool).toHaveBeenCalledTimes(1);
  });

  it("get_case_metadata no incluye fullText aunque internamente use fetch_document", async () => {
    const hit = loadFetchDocumentHit("fetch_document_ti_it_cantonal");
    const fake = makeFakeRemoteClient((name) => {
      expect(name).toBe("fetch_document");
      return toolResult({ result: hit });
    });
    const provider = providerWith(fake);
    const metadata = await provider.getCaseMetadata(hit.id);
    expect(metadata.fullText).toBeUndefined();
    expect(metadata.title).toBeTruthy();
  });

  it("search_cases_by_reference usa search_by_case_number y advierte sobre ambiguedad implicita", async () => {
    const fake = makeFakeRemoteClient((name, args) => {
      expect(name).toBe("search_by_case_number");
      expect(args["case_number"]).toBe("BGE 142 III 1");
      return toolResult(loadSearchStructuredContent("search_by_case_number_bge"));
    });
    const provider = providerWith(fake);
    const outcome = await provider.searchByCaseNumber({ caseNumber: "BGE 142 III 1" });
    expect(outcome.pagination.total).toBeGreaterThan(1); // no es un lookup exacto
    expect(outcome.warning).toBeDefined();
  });

  it("listHierarchy cachea: la segunda llamada no vuelve a invocar al proveedor remoto", async () => {
    const fake = makeFakeRemoteClient(() => toolResult({ entries: [{ id: "CH", count: 1 }] }));
    const provider = providerWith(fake);
    await provider.listHierarchy();
    await provider.listHierarchy();
    expect(fake.callTool).toHaveBeenCalledTimes(1);
  });

  it("listFacets cachea: la segunda llamada no vuelve a invocar al proveedor remoto", async () => {
    const fake = makeFakeRemoteClient(() =>
      toolResult({
        result: [{ id: "CH", label: { de: "x", fr: "y", it: "z", en: null }, children: [] }],
      }),
    );
    const provider = providerWith(fake);
    await provider.listFacets();
    await provider.listFacets();
    expect(fake.callTool).toHaveBeenCalledTimes(1);
  });

  it("getServerInfo cachea: la segunda llamada no vuelve a invocar al proveedor remoto", async () => {
    const fake = makeFakeRemoteClient(() =>
      toolResult({ name: "entscheidsuche-mcp", version: "0.1.1" }),
    );
    const provider = providerWith(fake);
    await provider.getServerInfo();
    await provider.getServerInfo();
    expect(fake.callTool).toHaveBeenCalledTimes(1);
  });

  it("nunca cachea un error: tras un fallo, el siguiente intento vuelve a llamar al proveedor", async () => {
    let call = 0;
    const fake = makeFakeRemoteClient(() => {
      call += 1;
      if (call === 1) throw new ProviderUnavailableError("entscheidsuche");
      return toolResult({ name: "entscheidsuche-mcp", version: "0.1.1" });
    });
    const provider = providerWith(fake);
    await expect(provider.getServerInfo()).rejects.toThrow(ProviderUnavailableError);
    const info = await provider.getServerInfo();
    expect(info["name"]).toBe("entscheidsuche-mcp");
    expect(call).toBe(2);
  });

  it("healthCheck() devuelve healthy:true cuando el proveedor remoto responde", async () => {
    const fake = makeFakeRemoteClient(() => toolResult({ name: "entscheidsuche-mcp" }));
    const provider = providerWith(fake);
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("healthCheck() devuelve healthy:false cuando el proveedor remoto esta caido", async () => {
    const fake = makeFakeRemoteClient(() => {
      throw new ProviderUnavailableError("entscheidsuche");
    });
    const provider = providerWith(fake);
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(false);
    expect(health.message).toBeDefined();
  });

  it("getSourceAttribution requiere haber llamado antes a getDocument", async () => {
    const fake = makeFakeRemoteClient(() => toolResult({ result: null }));
    const provider = providerWith(fake);
    expect(() => provider.getSourceAttribution("entscheidsuche:no-cargado")).toThrow(
      ProviderUnavailableError,
    );
  });

  it("getSourceAttribution funciona tras un getDocument previo (interfaz LegalSourceProvider)", async () => {
    const hit = loadFetchDocumentHit("fetch_document_bge_142_III_1");
    const fake = makeFakeRemoteClient(() => toolResult({ result: hit }));
    const provider = providerWith(fake);
    const doc = await provider.getDocument(`entscheidsuche:${hit.id}`);
    const attribution = provider.getSourceAttribution(doc.id);
    expect(attribution.officialCharacter).toBe("unofficial_aggregator");
  });

  it("close() delega en el cierre del cliente remoto (cierre ordenado)", async () => {
    const fake = makeFakeRemoteClient(() => toolResult({}));
    const provider = providerWith(fake);
    await provider.close();
    expect(fake.close).toHaveBeenCalledTimes(1);
  });
});
