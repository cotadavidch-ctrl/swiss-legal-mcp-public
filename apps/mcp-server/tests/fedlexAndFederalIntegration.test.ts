import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  LegislationProviderRegistry,
  ProviderRegistry,
  ToolRegistry,
  type LegislationProvider,
} from "@swiss-legal-mcp/core";
import { FEDLEX_CAPABILITIES } from "@swiss-legal-mcp/provider-fedlex";
import { createLogger } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { registerCompareDocumentsTools } from "../src/tools/compareDocumentsTools.js";
import { registerExtractPassagesTools } from "../src/tools/extractPassagesTools.js";
import { registerCitationNetworkTools } from "../src/tools/citationNetworkTools.js";
import { registerOfficialSwissCaseTools } from "../src/tools/officialSwissCaseTools.js";
import {
  InvalidFedlexIdentifierError,
  normalizeFedlexIdentifier,
} from "../src/tools/fedlexIdentifier.js";
import {
  classifyPortalPage,
  setFederalCaseSearchHttpTransportForTests,
} from "../src/tools/officialFederalCaseSearch.js";

const logger = createLogger({ level: "silent" });
const WORK = "https://fedlex.data.admin.ch/eli/cc/27/317_321_377";
// Formato real que emite get_law: `fedlex:<consolidacion>/<idioma>`
const GET_LAW_ID = `fedlex:${WORK}/20240101/de`;
const GET_ARTICLE_ID = `fedlex:${WORK}/20240101/de/art_41`;

function doc(id: string, fullText = "Art. 41\n\nWer einem andern widerrechtlich Schaden zufügt.") {
  return {
    id,
    provider: "fedlex",
    documentType: "legislation_law" as const,
    jurisdiction: { level: "federal" as const },
    sourceOriginalId: id,
    date: {},
    language: "de" as const,
    title: "OR",
    fullText,
    provenance: {
      sourceUrl: WORK,
      retrievedAt: "2026-07-28T00:00:00.000Z",
      contentHash: "a".repeat(64),
      officialCharacter: "official" as const,
    },
    rawMetadata: {},
    contentNature: "literal" as const,
  };
}

function fakeFedlex() {
  const getLaw = vi.fn(async () => doc(GET_LAW_ID));
  const getArticle = vi.fn(async () => doc(GET_ARTICLE_ID));
  const provider: LegislationProvider = {
    id: "fedlex",
    capabilities: FEDLEX_CAPABILITIES,
    searchLegislation: vi.fn(),
    getLaw,
    getArticle,
    getArticleAtDate: vi.fn(),
    compareArticleVersions: vi.fn(),
    getAmendmentHistory: vi.fn(async () => []),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
  };
  return { provider, getLaw, getArticle };
}

async function buildClient(fedlex: LegislationProvider) {
  const providers = new ProviderRegistry();
  const legislationProviders = new LegislationProviderRegistry();
  legislationProviders.register(
    {
      id: "fedlex",
      provider: fedlex,
      officialCharacter: "official",
      jurisdictions: ["federal"],
      enabledInEnv: ["test"],
    },
    "test",
  );
  await legislationProviders.checkHealth("fedlex");
  const tools = new ToolRegistry(providers, legislationProviders);
  registerExtractPassagesTools(tools);
  registerCompareDocumentsTools(tools);
  registerCitationNetworkTools(tools);
  registerOfficialSwissCaseTools(tools);
  const server = createMcpServer({
    name: "t",
    version: "0.0.0",
    tools,
    providers,
    legislationProviders,
    logger,
  });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "c", version: "0.0.0" });
  await Promise.all([client.connect(ct), server.connect(st)]);
  return client;
}

describe("normalizeFedlexIdentifier", () => {
  it("acepta el id publico de get_law y conserva fecha, idioma y articulo", () => {
    expect(normalizeFedlexIdentifier(GET_LAW_ID)).toEqual({
      workEli: WORK,
      date: "2024-01-01",
      language: "de",
    });
    expect(normalizeFedlexIdentifier(GET_ARTICLE_ID)).toEqual({
      workEli: WORK,
      date: "2024-01-01",
      language: "de",
      articleNumber: "41",
    });
  });

  it("acepta fedlex:https://..., https://fedlex.data..., y la URL publica www.fedlex.admin.ch", () => {
    expect(normalizeFedlexIdentifier(`fedlex:${WORK}`).workEli).toBe(WORK);
    expect(normalizeFedlexIdentifier(WORK).workEli).toBe(WORK);
    expect(
      normalizeFedlexIdentifier("https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr").workEli,
    ).toBe(WORK);
  });

  it.each([
    "http://fedlex.data.admin.ch/eli/cc/27/317_321_377",
    "https://evil.example.com/eli/cc/27/317_321_377",
    "https://fedlex.data.admin.ch.evil.com/eli/cc/27/317_321_377",
    "https://user:pw@fedlex.data.admin.ch/eli/cc/27/317_321_377",
    "https://fedlex.data.admin.ch:8443/eli/cc/27/317_321_377",
    "https://fedlex.data.admin.ch/eli/cc/27/317_321_377?x=1",
    "https://fedlex.data.admin.ch/other/cc/27",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "fedlex:fedlex:https://fedlex.data.admin.ch/eli/cc/27/317_321_377",
    "220",
    "",
  ])("rechaza %s", (bad) => {
    expect(() => normalizeFedlexIdentifier(bad)).toThrow(InvalidFedlexIdentifierError);
  });
});

describe("get_law -> otras herramientas (identificador compartido)", () => {
  it("get_law -> extract_legal_passages usa el ELI de obra y la version temporal", async () => {
    const f = fakeFedlex();
    const client = await buildClient(f.provider);
    const result = await client.callTool({
      name: "extract_legal_passages",
      arguments: { provider: "fedlex", documentId: GET_LAW_ID, searchTerm: "Schaden" },
    });
    expect(result.isError).toBeFalsy();
    expect(f.getLaw).toHaveBeenCalledWith({ eli: WORK, language: "de", date: "2024-01-01" });
  });

  it("get_law -> extract_legal_passages con articleNumber conserva articulo e idioma", async () => {
    const f = fakeFedlex();
    const client = await buildClient(f.provider);
    await client.callTool({
      name: "extract_legal_passages",
      arguments: { provider: "fedlex", documentId: GET_ARTICLE_ID, articleNumber: "41" },
    });
    expect(f.getArticle).toHaveBeenCalledWith({
      lawRef: { eli: WORK, language: "de", date: "2024-01-01" },
      articleNumber: "41",
    });
  });

  it("get_law -> compare_legal_documents", async () => {
    const f = fakeFedlex();
    const client = await buildClient(f.provider);
    const result = await client.callTool({
      name: "compare_legal_documents",
      arguments: {
        documentA: { provider: "fedlex", documentId: GET_LAW_ID },
        documentB: { provider: "fedlex", documentId: `fedlex:${WORK}/20250101/de` },
      },
    });
    expect(result.isError).toBeFalsy();
    expect(f.getLaw).toHaveBeenCalledTimes(2);
    expect(f.getLaw.mock.calls.map((c) => (c[0] as { date?: string }).date)).toEqual([
      "2024-01-01",
      "2025-01-01",
    ]);
  });

  it("get_law -> find_cited_sources", async () => {
    const f = fakeFedlex();
    const client = await buildClient(f.provider);
    const result = await client.callTool({
      name: "find_cited_sources",
      arguments: { provider: "fedlex", documentId: GET_LAW_ID },
    });
    expect(result.isError).toBeFalsy();
    expect(f.getLaw).toHaveBeenCalledWith({ eli: WORK, language: "de", date: "2024-01-01" });
  });

  it("get_law -> build_case_citation_network", async () => {
    const f = fakeFedlex();
    const client = await buildClient(f.provider);
    const result = await client.callTool({
      name: "build_case_citation_network",
      arguments: { documents: [{ provider: "fedlex", documentId: GET_LAW_ID }] },
    });
    expect(result.isError).toBeFalsy();
    expect(f.getLaw).toHaveBeenCalledWith({ eli: WORK, language: "de", date: "2024-01-01" });
  });

  it("un identificador de dominio no autorizado falla sin llamar al proveedor", async () => {
    const f = fakeFedlex();
    const client = await buildClient(f.provider);
    const result = await client.callTool({
      name: "extract_legal_passages",
      arguments: {
        provider: "fedlex",
        documentId: "https://evil.example.com/eli/cc/27/317_321_377",
        searchTerm: "x",
      },
    });
    expect(f.getLaw).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toMatch(/dominio no autorizado|no valido/i);
  });
});

describe("search_federal_cases: respuestas invalidas no son 'cero sentencias'", () => {
  afterEach(() => setFederalCaseSearchHttpTransportForTests(null));

  async function search(body: string, status = 200, headers: Record<string, string> = {}) {
    setFederalCaseSearchHttpTransportForTests(async (url) => ({
      status_code: status,
      final_url: url,
      body,
      headers,
    }));
    const client = await buildClient(fakeFedlex().provider);
    const result = await client.callTool({
      name: "search_federal_cases",
      arguments: { query: "2A.348/2004", language: "de" },
    });
    return result.structuredContent as {
      results: Array<Record<string, unknown>>;
      source_status: string;
      partial_results: boolean;
      warnings: string[];
    };
  }

  it("desafio antibot -> unavailable con warning explicito", async () => {
    const out = await search(
      "<html><title>Just a moment...</title><div id='cf-chl-widget'></div></html>",
    );
    expect(out.results).toHaveLength(0);
    expect(out.source_status).toBe("unavailable");
    expect(out.warnings.join(" ")).toContain("access_challenge_detected");
  });

  it("HTML vacio o no reconocible -> unavailable, no cero resultados", async () => {
    const out = await search("<html><body>Wartungsarbeiten</body></html>");
    expect(out.source_status).toBe("unavailable");
    expect(out.warnings.join(" ")).toContain("unrecognized_portal_response");
  });

  it("pagina del portal sin enlaces ni marcador de cero -> no afirma ausencia", async () => {
    const out = await search(
      "<html><body>Bundesgericht search.bger.ch query_words=x</body></html>",
    );
    expect(out.source_status).not.toBe("official");
    expect(out.partial_results).toBe(true);
    expect(out.warnings.join(" ")).toContain("zero_results_unconfirmed");
  });

  it("cero resultados confirmados por el portal se mantienen como official", async () => {
    const out = await search(
      "<html><body>Bundesgericht search.bger.ch query_words=x. Keine Treffer gefunden.</body></html>",
    );
    expect(out.results).toHaveLength(0);
    expect(out.source_status).toBe("official");
    expect(out.warnings.join(" ")).not.toContain("unconfirmed");
  });

  it("parsea el formato actual de highlight_docid (AAAA-MM-DD-expediente)", async () => {
    const out = await search(
      `<html><body>Bundesgericht search.bger.ch 1 exakte Treffer gefunden
<a href="/ext/eurospider/live/de/php/aza/http/index.php?lang=de&amp;type=highlight_simple_query&amp;query_words=x&amp;highlight_docid=2004-12-01-2A.348-2004&amp;page=1&amp;rank=1">01.12.2004 2A.348/2004</a></body></html>`,
    );
    expect(out.source_status).toBe("official");
    expect(out.results).toHaveLength(1);
    expect(out.results[0]).toMatchObject({
      case_number: "2A.348/2004",
      decision_date: "2004-12-01",
    });
  });

  it("pagina legitima del portal con el script de monitorizacion Incapsula NO es un desafio", async () => {
    const filler = "<p>Bundesgericht Eurospider</p>".repeat(400);
    const out = await search(
      `<html><body>${filler}<script src="/_Incapsula_Resource?SWJIYLWA=abc"></script>Keine Treffer gefunden query_words=x</body></html>`,
    );
    expect(out.warnings.join(" ")).not.toContain("access_challenge_detected");
    expect(out.source_status).toBe("official");
  });

  it("desafio Incapsula real (pagina minima con iframe) sigue siendo indisponibilidad", async () => {
    const out = await search(
      '<html><body><iframe src="/_Incapsula_Resource?SWUDNSAI=31"></iframe></body></html>',
    );
    expect(out.source_status).toBe("unavailable");
    expect(out.warnings.join(" ")).toContain("access_challenge_detected");
  });

  it("HTTP 204 sigue siendo indisponibilidad", async () => {
    const out = await search("", 204);
    expect(out.source_status).toBe("unavailable");
  });

  it("classifyPortalPage: resultados reales -> results", () => {
    expect(classifyPortalPage({ body: "<a>", headers: {}, parsedResultCount: 3 })).toBe("results");
  });
});

describe("verify_swiss_case_identity: se compara el candidato aportado", () => {
  async function verify(args: Record<string, unknown>) {
    const client = await buildClient(fakeFedlex().provider);
    const r = await client.callTool({ name: "verify_swiss_case_identity", arguments: args });
    return r.structuredContent as {
      status: string;
      mismatched_fields: string[];
      official_identity_verified: boolean;
    };
  }
  const base = {
    requested_reference: "7B_123/2025",
    candidate_court_family: "swiss_federal_supreme_court",
    official: true,
  };

  it("un candidato con otro expediente NO se verifica", async () => {
    const out = await verify({ ...base, candidate_reference: "7B_124/2025" });
    expect(out.official_identity_verified).toBe(false);
    expect(out.status).toBe("identity_mismatch");
    expect(out.mismatched_fields).toContain("reference");
  });

  it("un candidato con el mismo expediente no se marca como discrepante", async () => {
    const out = await verify({ ...base, candidate_reference: "7B_123/2025" });
    expect(out.mismatched_fields).toEqual([]);
    expect(out.status).not.toBe("identity_mismatch");
  });

  it("solo la referencia (sin candidato) sigue sin ser verificable por circularidad", async () => {
    const out = await verify({ requested_reference: "7B_123/2025" });
    expect(out.official_identity_verified).toBe(false);
  });
});

describe("stripTags: el CSS y los scripts no entran en el texto de la sentencia", () => {
  it("elimina el contenido de <style>, <script>, <noscript> y comentarios", async () => {
    const { stripTags } = await import("../src/tools/officialSwissCaseResolver.js");
    const html =
      "<html><head><style>@media print { .body { display: none; } }</style><script>var x=1;</script></head>" +
      "<body><!-- comentario interno --><noscript>activar JS</noscript><p>Das Bundesgericht zieht in Erwägung:</p></body></html>";
    const text = stripTags(html).replace(/\s+/g, " ").trim();
    expect(text).toBe("Das Bundesgericht zieht in Erwägung:");
    expect(text).not.toMatch(/@media|display|var x|comentario|activar JS/);
  });
});
