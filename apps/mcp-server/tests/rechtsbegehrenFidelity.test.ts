import { describe, expect, it } from "vitest";
import { buildRechtsbegehren } from "../src/tools/legalDraftingRules.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/tools/../registry.js";

const logger = createLogger({ level: "silent" });

function input(objectives: string[]) {
  return {
    jurisdiction: { country: "CH", canton: "ZH" },
    challengedAct: { type: "decision" as const },
    objectives,
    claims: [],
  };
}

const classes = (objectives: string[]) =>
  buildRechtsbegehren(input(objectives) as never).requests.map((r) => r.classification);
const texts = (objectives: string[]) =>
  buildRechtsbegehren(input(objectives) as never)
    .requests.map((r) => r.text)
    .join("\n");

describe("Rechtsbegehren: fidelidad de pretensiones", () => {
  it("Akteneinsicht sola nunca produce Kontoauszug, Edition ni Rueckweisung inventada", () => {
    expect(classes(["Akteneinsicht"])).toEqual(["file_access"]);
    expect(texts(["Akteneinsicht"])).not.toMatch(/Kontoauszug|Edition|zurückzuweisen/);
  });

  it("Kontoauszug solo produce solo bank_statement", () => {
    expect(classes(["Beizug eines Kontoauszugs"])).toEqual(["bank_statement"]);
  });

  it("Edition generica de documentos no se convierte en Kontoauszug", () => {
    expect(classes(["Edition der Arbeitsverträge"])).toEqual(["document_edition"]);
    expect(texts(["Edition der Arbeitsverträge"])).not.toMatch(/Kontoauszug/);
    expect(texts(["Edition der Arbeitsverträge"])).toContain("Edition der Arbeitsverträge");
  });

  it("'Edition eines Kontoauszugs' es una unica pretension, no dos", () => {
    expect(classes(["Edition eines Kontoauszugs"])).toEqual(["bank_statement"]);
  });

  it("solicitudes combinadas e independientes generan pretensiones distintas", () => {
    expect(classes(["Akteneinsicht", "Edition der Mietverträge", "Kontoauszug 2025"])).toEqual([
      "file_access",
      "document_edition",
      "bank_statement",
    ]);
  });

  it("un unico objetivo con Akteneinsicht y Kontoauszug explicitos genera ambas", () => {
    expect(classes(["Akteneinsicht und Kontoauszug"]).sort()).toEqual([
      "bank_statement",
      "file_access",
    ]);
  });

  it("peticion ambigua conserva el texto original y se marca para revision", () => {
    const result = buildRechtsbegehren(input(["Irgendeine unklare Forderung"]) as never);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]!.classification).toBe("unclassified");
    expect(result.requests[0]!.text).toContain("Irgendeine unklare Forderung");
    expect(result.requests[0]!.status).toBe("deferred_pending_verification");
    expect(result.warnings).toContain("request_pending_verification");
  });

  it("la palabra 'addition' no se interpreta como Edition", () => {
    expect(classes(["Addition der Kosten"])).not.toContain("document_edition");
  });
});

describe("draft_swiss_legal_document: sin pretensiones no solicitadas", () => {
  it("Akteneinsicht en el borrador no introduce Kontoauszug ni readyForFiling", async () => {
    const { providers, legislationProviders, tools } = buildRegistries(
      loadEnv({ NODE_ENV: "test" }),
    );
    await Promise.all([providers.checkAllHealth(), legislationProviders.checkAllHealth()]);
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
    const result = await client.callTool({
      name: "draft_swiss_legal_document",
      arguments: {
        jurisdiction: { country: "CH", canton: "ZH" },
        challengedAct: { type: "decision", summary: "Verfügung" },
        procedure: { requestedDocumentType: "Akteneinsichtsgesuch", language: "de" },
        objectives: ["Akteneinsicht"],
        claims: [],
      },
    });
    const body = JSON.stringify(result.structuredContent ?? result.content);
    expect(body).not.toMatch(/Kontoauszug/);
    expect((result.structuredContent as { readyForFiling: boolean }).readyForFiling).toBe(false);
  });
});
