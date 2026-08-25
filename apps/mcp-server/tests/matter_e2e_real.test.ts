import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/registry.js";
import { LegislationProviderRegistry, ProviderRegistry, ToolRegistry } from "@swiss-legal-mcp/core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const logger = createLogger({ level: "silent" });
const provenance = [
  { type: "SYSTEM_DERIVATION", system_derivation_input_ids: ["phase-9-mcp-test"] },
];

async function buildClient() {
  const env = loadEnv({ NODE_ENV: "test" });
  const { providers, legislationProviders, tools } = buildRegistries(env);
  await Promise.all([providers.checkAllHealth(), legislationProviders.checkAllHealth()]);
  const server = createMcpServer({
    name: "swiss-legal-mcp-test",
    version: "0.0.0",
    tools,
    providers,
    legislationProviders,
    logger,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, server };
}

function matter() {
  return {
    matter: { id: "matter-mcp-1", title: "MCP synthetic matter" },
    documents: [
      {
        kind: "Document",
        id: "doc-1",
        matter_id: "matter-mcp-1",
        title: "Document",
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
        provenance,
      },
    ],
    passages: [
      {
        kind: "Passage",
        id: "passage-1",
        matter_id: "matter-mcp-1",
        document_id: "doc-1",
        text: "Passage.",
        provenance,
      },
    ],
    propositions: [
      {
        kind: "Proposition",
        id: "prop-1",
        matter_id: "matter-mcp-1",
        text: "Fact.",
        scope: "mcp synthetic",
        legal_or_factual_domain: "FACTUAL",
        granularity: "ATOMIC",
        source_passage_ids: ["passage-1"],
        provenance,
      },
    ],
    evidence: [
      {
        kind: "Evidence",
        id: "evidence-1",
        matter_id: "matter-mcp-1",
        evidence_type: "DOCUMENT",
        document_id: "doc-1",
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
        supported_proposition_ids: ["prop-1"],
        evidence_use: "SUPPORT",
        provenance,
      },
    ],
    issues: [
      {
        kind: "Issue",
        id: "issue-1",
        matter_id: "matter-mcp-1",
        text: "Legal issue.",
        issue_type: "LEGAL",
        proposition_ids: ["prop-1"],
        provenance,
      },
    ],
    legal_authorities: [
      {
        kind: "LegalAuthority",
        id: "authority-1",
        matter_id: "matter-mcp-1",
        authority_type: "STATUTE",
        citation: "Synthetic Act",
        source_status: "FULL_TEXT_VERIFIED_OFFICIAL",
        provenance,
      },
    ],
    trace_links: [
      {
        id: "trace-1",
        matter_id: "matter-mcp-1",
        from_id: "evidence-1",
        to_id: "prop-1",
        relation: "supports",
        provenance,
      },
    ],
  };
}

describe("Matter E2E with real provider", () => {
  it("should perform the full workflow", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matter-e2e-real-"));
    let client, server;
    try {
      ({ client, server } = await buildClient());

      // Step 1: create_or_update_matter
      const createResult = await client.callTool({
        name: "create_or_update_matter",
        arguments: { matter: matter(), created_by: "e2e-test", change_summary: "Create via E2E." },
      });
      expect(createResult.isError).toBeFalsy();
      const matterId = (
        createResult.structuredContent as { structured_result: { matter_id: string } }
      ).structured_result.matter_id;
      console.log(`Matter ID: ${matterId}`);

      // Step 1.5: get matter state BEFORE research
      const stateBeforeResult = await client.callTool({
        name: "get_matter_state",
        arguments: { matter_id: matterId },
      });
      expect(stateBeforeResult.isError).toBeFalsy();
      const stateBeforeText = JSON.stringify(stateBeforeResult.structuredContent);
      let versionBeforeResearch = "unknown";
      const versionBeforeMatch = stateBeforeText.match(/"version"\s*:\s*(\d+)/);
      if (versionBeforeMatch) {
        versionBeforeResearch = versionBeforeMatch[1];
      } else {
        const versionCountBeforeMatch = stateBeforeText.match(/"version_count"\s*:\s*(\d+)/);
        if (versionCountBeforeMatch) {
          versionBeforeResearch = versionCountBeforeMatch[1];
        }
      }
      console.log(`State before research: ${stateBeforeText}`);

      // Step 2: research_legal_issues with REAL provider
      const researchResult = await client.callTool({
        name: "research_legal_issues",
        arguments: { matter_id: matterId, language: "DE" },
      });
      expect(researchResult.isError).toBeFalsy();
      console.log(`Research result: ${JSON.stringify(researchResult.structuredContent)}`);

      // Step 3: destroy/recreate runtime/store (close and reopen)
      await client.close();
      await server.close();

      ({ client, server } = await buildClient());

      // Step 4: get_matter_state AFTER research (after reload)
      const stateAfterResult = await client.callTool({
        name: "get_matter_state",
        arguments: { matter_id: matterId },
      });
      expect(stateAfterResult.isError).toBeFalsy();
      const stateAfterText = JSON.stringify(stateAfterResult.structuredContent);
      let versionAfterResearch = "unknown";
      const versionAfterMatch = stateAfterText.match(/"version"\s*:\s*(\d+)/);
      if (versionAfterMatch) {
        versionAfterResearch = versionAfterMatch[1];
      } else {
        const versionCountAfterMatch = stateAfterText.match(/"version_count"\s*:\s*(\d+)/);
        if (versionCountAfterMatch) {
          versionAfterResearch = versionCountAfterMatch[1];
        }
      }
      console.log(`State after research: ${stateAfterText}`);

      // Step 5: analyze_matter
      const analyzeResult = await client.callTool({
        name: "analyze_matter",
        arguments: { matter_id: matterId, stage: "CHRONOLOGY" },
      });
      expect(analyzeResult.isError).toBeFalsy();
      console.log(`Analyze result: ${JSON.stringify(analyzeResult.structuredContent)}`);

      // Step 6: audit_legal_draft
      const auditResult = await client.callTool({
        name: "audit_legal_draft",
        arguments: {
          provenance,
          assertions: [
            {
              draft_sentence_id: "s-1",
              text: "The material fact is established.",
              assertion_type: "FACT",
              source_ids: [],
              evidence_ids: [],
              legal_proposition_ids: [],
              precedent_ids: [],
              confidence: 0.5,
              provenance,
              human_review_state: "UNREVIEWED",
            },
          ],
        },
      });
      expect(auditResult.isError).toBeFalsy();
      console.log(`Audit result: ${JSON.stringify(auditResult.structuredContent)}`);

      // Output summary to stderr so it appears in vitest output
      const summary = {
        matterId,
        versionBeforeResearch,
        versionAfterResearch,
        realProviderAttempts: "unknown",
        retries: "unknown",
        globalCallBudgetConsumed: "unknown",
        supportiveResults: "unknown",
        adverseResults: "unknown",
        officialFullTextVerified: "unknown",
        runtimeStoreRecreated: "YES",
        matterFoundAfterRecreation: "YES",
        analyzeStatus: analyzeResult.isError ? "FAILED" : "SUCCESS",
        auditStatus: auditResult.isError ? "FAILED" : "SUCCESS",
      };

      // Try to extract official/full-text verified from the state after research (or before?)
      const officialMatch = stateAfterText.match(/"source_status"\s*:\s*"([^"]*)"/);
      if (officialMatch) {
        summary.officialFullTextVerified = officialMatch[1];
      }

      process.stderr.write("SUMMARY: " + JSON.stringify(summary) + "\n");
    } finally {
      if (client) await client.close();
      if (server) await server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
