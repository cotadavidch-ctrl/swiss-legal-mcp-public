import { describe, expect, it, vi } from "vitest";
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
import { registerQuoteTools } from "../src/tools/quoteTools.js";
import {
  extractQuotesFromDraft,
  lawSourceForAbbreviation,
  verifyQuoteAgainstText,
} from "../src/tools/quoteVerifier.js";

const SOURCE = `Art. 41
1 Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht, sei es aus Fahrlässigkeit, wird ihm zum Ersatze verpflichtet.
2 Ebenso ist zum Ersatze verpflichtet, wer einem andern in einer gegen die guten Sitten verstossenden Weise absichtlich Schaden zufügt.`;

describe("verifyQuoteAgainstText", () => {
  it("cita literal (solo difieren los espacios) -> verified_exact con posicion y contexto", () => {
    const r = verifyQuoteAgainstText(
      "Wer einem andern   widerrechtlich Schaden zufügt, sei es mit Absicht",
      SOURCE,
    );
    expect(r.status).toBe("verified_exact");
    expect(r.start).toBeGreaterThanOrEqual(0);
    expect(r.context).toContain("widerrechtlich Schaden");
  });

  it("mayusculas y puntuacion distintas -> verified_normalized", () => {
    const r = verifyQuoteAgainstText(
      "WER EINEM ANDERN WIDERRECHTLICH SCHADEN ZUFÜGT; sei es mit Absicht",
      SOURCE,
    );
    expect(r.status).toBe("verified_normalized");
    expect(r.context).toContain("widerrechtlich");
  });

  it("elipsis [...] : fragmentos en orden", () => {
    const r = verifyQuoteAgainstText(
      "Wer einem andern widerrechtlich Schaden zufügt [...] wird ihm zum Ersatze verpflichtet",
      SOURCE,
    );
    expect(r.status).toBe("verified_exact");
    expect(r.segments).toBe(2);
  });

  it("fragmentos en orden invertido NO se verifican como literales", () => {
    const r = verifyQuoteAgainstText(
      "wird ihm zum Ersatze verpflichtet [...] Wer einem andern widerrechtlich Schaden zufügt",
      SOURCE,
    );
    expect(["near_match_altered", "not_found"]).toContain(r.status);
    expect(r.status).not.toBe("verified_exact");
    expect(r.status).not.toBe("verified_normalized");
  });

  it("cita alterada (palabra cambiada) -> near_match_altered con el pasaje cercano", () => {
    const r = verifyQuoteAgainstText(
      "Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht, sei es aus Fahrlässigkeit, wird ihm zum Schadenersatz verpflichtet",
      SOURCE,
    );
    expect(r.status).toBe("near_match_altered");
    expect(r.similarity).toBeGreaterThanOrEqual(0.8);
    expect(r.closestPassage).toContain("zum Ersatze verpflichtet");
  });

  it("texto que no esta en la fuente -> not_found", () => {
    const r = verifyQuoteAgainstText(
      "Der Arbeitnehmer hat Anspruch auf eine Entschädigung in der Höhe von sechs Monatslöhnen",
      SOURCE,
    );
    expect(r.status).toBe("not_found");
  });

  it("cita demasiado corta no se verifica de forma fiable", () => {
    const r = verifyQuoteAgainstText("Wer einem", SOURCE);
    expect(r.status).toBe("not_found");
    expect(r.notes.join(" ")).toContain("demasiado corta");
  });

  it("guiones blandos y comillas tipograficas se normalizan", () => {
    const r = verifyQuoteAgainstText(
      "„Ebenso ist zum Ersatze verpflich­tet, wer einem andern“",
      SOURCE,
    );
    expect(["verified_exact", "verified_normalized"]).toContain(r.status);
  });
});

describe("extractQuotesFromDraft", () => {
  it("asocia cada cita con la referencia mas cercana del parrafo", () => {
    const draft = `Nach Art. 41 OR gilt: „Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht“.\n\nIm Urteil 4C.4/2004 hielt das Bundesgericht fest, «dass die Voraussetzungen der Haftung nicht erfüllt waren und die Klage abzuweisen ist».`;
    const q = extractQuotesFromDraft(draft);
    expect(q).toHaveLength(2);
    expect(q[0]!.citation).toMatchObject({ type: "article", abbreviation: "OR", article: "41" });
    expect(q[1]!.citation).toMatchObject({ type: "case", reference: "4C.4/2004" });
  });

  it("una cita sin referencia queda sin fuente", () => {
    const q = extractQuotesFromDraft(
      'Der Gegner behauptet, "die Kündigung sei ohne jeden sachlichen Grund erfolgt und daher missbräuchlich".',
    );
    expect(q).toHaveLength(1);
    expect(q[0]!.citation).toBeNull();
  });

  it("tabla de leyes: solo identificadores comprobados", () => {
    expect(lawSourceForAbbreviation("OR")?.eli).toContain("eli/cc/27/317_321_377");
    expect(lawSourceForAbbreviation("ATSG")?.systematicNumber).toBe("830.1");
    expect(lawSourceForAbbreviation("LPGA")?.language).toBe("fr");
    expect(lawSourceForAbbreviation("XYZ")).toBeNull();
  });
});

function fakeFedlex(articleText: string, fail = false) {
  const getArticle = vi.fn(async () => {
    if (fail) throw new Error("Fedlex no responde");
    return {
      id: "fedlex:https://fedlex.data.admin.ch/eli/cc/27/317_321_377/20260101/de/art_41",
      provider: "fedlex",
      documentType: "legislation_law" as const,
      jurisdiction: { level: "federal" as const },
      sourceOriginalId: "x",
      date: {},
      language: "de" as const,
      title: "OR Art. 41",
      fullText: articleText,
      provenance: {
        sourceUrl: "https://www.fedlex.admin.ch/",
        retrievedAt: "2026-11-11T00:00:00.000Z",
        contentHash: "a".repeat(64),
        officialCharacter: "official" as const,
      },
      rawMetadata: {},
      contentNature: "literal" as const,
    };
  });
  const provider: LegislationProvider = {
    id: "fedlex",
    capabilities: FEDLEX_CAPABILITIES,
    searchLegislation: vi.fn(),
    getLaw: vi.fn(),
    getArticle,
    getArticleAtDate: vi.fn(),
    compareArticleVersions: vi.fn(),
    getAmendmentHistory: vi.fn(async () => []),
    healthCheck: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString() })),
  };
  return { provider, getArticle };
}

async function client(fedlex: LegislationProvider) {
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
  registerQuoteTools(tools);
  const server = createMcpServer({
    name: "t",
    version: "0.0.0",
    tools,
    providers,
    legislationProviders,
    logger: createLogger({ level: "silent" }),
  });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const c = new Client({ name: "c", version: "0.0.0" });
  await Promise.all([c.connect(ct), server.connect(st)]);
  return c;
}

type Out = {
  status: string;
  summary: Record<string, number | boolean>;
  results: Array<{ status: string; sourceInferredFromCitation: boolean; verification: unknown }>;
};

describe("verify_quoted_passages via MCP", () => {
  const art41 = { type: "article", abbreviation: "OR", articleNumber: "41", language: "de" };

  it("verifica citas explicitas: literal, alterada y ausente", async () => {
    const f = fakeFedlex(SOURCE);
    const c = await client(f.provider);
    const r = await c.callTool({
      name: "verify_quoted_passages",
      arguments: {
        quotes: [
          {
            quote: "Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht",
            source: art41,
          },
          {
            quote:
              "Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht, sei es aus Fahrlässigkeit, wird ihm zum Schadenersatz verpflichtet",
            source: art41,
          },
          {
            quote:
              "Der Arbeitnehmer hat Anspruch auf eine Entschädigung in der Höhe von sechs Monatslöhnen",
            source: art41,
          },
        ],
      },
    });
    const out = r.structuredContent as Out;
    expect(out.results.map((x) => x.status)).toEqual([
      "verified_exact",
      "near_match_altered",
      "not_found",
    ]);
    expect(out.summary["all_verified"]).toBe(false);
    expect(out.summary["verified"]).toBe(1);
    // una sola descarga para la misma fuente
    expect(f.getArticle).toHaveBeenCalledTimes(1);
  });

  it("extrae las citas del borrador e infiere la fuente; sin referencia -> no_source", async () => {
    const f = fakeFedlex(SOURCE);
    const c = await client(f.provider);
    const r = await c.callTool({
      name: "verify_quoted_passages",
      arguments: {
        draft:
          'Nach Art. 41 OR gilt: „Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht“.\n\nDie Gegenseite sagt, "die Kündigung sei ohne jeden sachlichen Grund erfolgt und daher missbräuchlich".',
      },
    });
    const out = r.structuredContent as Out;
    expect(out.results.map((x) => x.status)).toEqual(["verified_exact", "no_source"]);
    expect(out.results[0]!.sourceInferredFromCitation).toBe(true);
    expect(JSON.stringify(out)).toContain("INFIEREN");
  });

  it("fuente no disponible NO se confunde con cita falsa", async () => {
    const f = fakeFedlex(SOURCE, true);
    const c = await client(f.provider);
    const r = await c.callTool({
      name: "verify_quoted_passages",
      arguments: {
        quotes: [
          {
            quote: "Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht",
            source: art41,
          },
        ],
      },
    });
    const out = r.structuredContent as Out;
    expect(out.results[0]!.status).toBe("source_unavailable");
    expect(out.summary["not_found"]).toBe(0);
  });

  it("sin entrada util devuelve invalid_input", async () => {
    const c = await client(fakeFedlex(SOURCE).provider);
    const r = await c.callTool({ name: "verify_quoted_passages", arguments: {} });
    expect((r.structuredContent as Out).status).toBe("invalid_input");
  });
});
