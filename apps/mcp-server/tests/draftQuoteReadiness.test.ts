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
import { registerLegalDraftingTools } from "../src/tools/legalDraftingTools.js";

const SOURCE =
  "Art. 41\n1 Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht, sei es aus Fahrlässigkeit, wird ihm zum Ersatze verpflichtet.";

function fakeFedlex(fail = false) {
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
      fullText: SOURCE,
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
  registerLegalDraftingTools(tools);
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

const base = {
  jurisdiction: { country: "CH", canton: "ZH" },
  challengedAct: { type: "decision", summary: "Verfügung" },
  procedure: { requestedDocumentType: "Beschwerde", language: "de" },
  objectives: ["Aufhebung"],
  claims: [],
};

type Out = {
  readyForFiling: boolean;
  checks?: Record<string, string>;
  legal_drafting_check?: Record<string, string>;
  warnings: string[];
  quoteVerification: { status: string; problems: { status: string }[] } | null;
};

describe("citas verificadas condicionan readyForFiling", () => {
  it("cita literal de la fuente oficial -> quotes=passed", async () => {
    const f = fakeFedlex();
    const c = await client(f.provider);
    const r = await c.callTool({
      name: "validate_swiss_legal_draft",
      arguments: {
        ...base,
        cleanDocument:
          "Nach Art. 41 OR gilt: „Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht, sei es aus Fahrlässigkeit“.",
      },
    });
    const out = r.structuredContent as Out;
    expect(out.checks?.["quotes"]).toBe("passed");
    expect(out.quoteVerification?.status).toBe("passed");
    expect(out.warnings).not.toContain("quotes_altered_or_not_found");
  });

  it("cita alterada -> quotes=failed y el borrador NO queda listo", async () => {
    const c = await client(fakeFedlex().provider);
    const r = await c.callTool({
      name: "validate_swiss_legal_draft",
      arguments: {
        ...base,
        cleanDocument:
          "Nach Art. 41 OR gilt: „Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht, sei es aus Fahrlässigkeit, wird ihm zum Schadenersatz verpflichtet“.",
      },
    });
    const out = r.structuredContent as Out;
    expect(out.checks?.["quotes"]).toBe("failed");
    expect(out.readyForFiling).toBe(false);
    expect(out.warnings).toContain("quotes_altered_or_not_found");
    expect(out.quoteVerification?.problems[0]?.status).toBe("near_match_altered");
  });

  it("fuente no disponible -> warning (nunca listo con citas sin verificar)", async () => {
    const c = await client(fakeFedlex(true).provider);
    const r = await c.callTool({
      name: "review_swiss_legal_document",
      arguments: {
        ...base,
        cleanDocument:
          "Nach Art. 41 OR gilt: „Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht“.",
      },
    });
    const out = r.structuredContent as Out;
    expect(out.legal_drafting_check?.["quotes"]).toBe("warning");
    expect(out.readyForFiling).toBe(false);
    expect(out.warnings).toContain("quotes_not_verified");
  });

  it("sin citas entrecomilladas: not_applicable y ninguna peticion a la fuente", async () => {
    const f = fakeFedlex();
    const c = await client(f.provider);
    const r = await c.callTool({
      name: "validate_swiss_legal_draft",
      arguments: { ...base, cleanDocument: "Beschwerde gegen die Verfügung vom 1. Oktober 2026." },
    });
    expect((r.structuredContent as Out).checks?.["quotes"]).toBe("not_applicable");
    expect(f.getArticle).not.toHaveBeenCalled();
  });

  it("draft_swiss_legal_document incluye la verificacion de citas", async () => {
    const c = await client(fakeFedlex().provider);
    const r = await c.callTool({ name: "draft_swiss_legal_document", arguments: base });
    const out = r.structuredContent as Out;
    expect(out.quoteVerification).not.toBeNull();
    expect(out.legal_drafting_check?.["quotes"]).toBeDefined();
    expect(out.readyForFiling).toBe(false);
  });
});
