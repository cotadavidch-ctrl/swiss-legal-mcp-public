import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  const env = loadEnv({
    NODE_ENV: "development",
    MCP_HTTP_BEARER_TOKEN: "dummy-token-for-testing",
  });
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

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "matter-e2e-"));
  let client, server;
  try {
    ({ client, server } = await buildClient());

    // Step 1: create_or_update_matter
    const createResult = await client.callTool({
      name: "create_or_update_matter",
      arguments: { matter: matter(), created_by: "e2e-test", change_summary: "Create via E2E." },
    });
    if (createResult.isError) {
      throw new Error(`create_or_update_matter failed: ${createResult.error}`);
    }
    const matterId = (
      createResult.structuredContent as { structured_result: { matter_id: string } }
    ).structured_result.matter_id;
    console.log(`Matter ID: ${matterId}`);

    // Step 1.5: get matter state BEFORE research
    const stateBeforeResult = await client.callTool({
      name: "get_matter_state",
      arguments: { matter_id: matterId, include_full_snapshot: true },
    });
    if (stateBeforeResult.isError) {
      throw new Error(`get_matter_state before research failed: ${stateBeforeResult.error}`);
    }
    const stateBeforeSnapshot = stateBeforeResult.structuredContent.structured_result.snapshot;
    const stateBeforeText = JSON.stringify(stateBeforeSnapshot);
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
    if (researchResult.isError) {
      throw new Error(`research_legal_issues failed: ${researchResult.error}`);
    }
    console.log(`Research result: ${JSON.stringify(researchResult.structuredContent)}`);

    // Step 3: destroy/recreate runtime/store (close and reopen)
    await client.close();
    await server.close();

    ({ client, server } = await buildClient());

    // Step 4: get_matter_state AFTER research (after reload)
    const stateAfterResult = await client.callTool({
      name: "get_matter_state",
      arguments: { matter_id: matterId, include_full_snapshot: true },
    });
    if (stateAfterResult.isError) {
      throw new Error(`get_matter_state after research failed: ${stateAfterResult.error}`);
    }
    const stateAfterSnapshot = stateAfterResult.structuredContent.structured_result.snapshot;
    const stateAfterText = JSON.stringify(stateAfterSnapshot);
    console.log("stateAfterText:", stateAfterText);
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
    // Extract provider metrics from the snapshot by parsing the JSON properly
    const providerAttemptsMatch = stateAfterText.match(/"provider_attempts"\s*:\s*(\[.*?\])/s);
    let providerAttempts = [];
    let providerAttemptsCount = 0;
    let totalAttempts = 0; // sum of all attempts (for global call budget)
    let retries = 0; // sum of (attempts - 1) across all provider attempts
    let supportiveResults = 0;
    let adverseResults = 0;
    let officialFullTextVerified = false;
    let providerName = "unknown";

    if (providerAttemptsMatch) {
      try {
        providerAttempts = JSON.parse(providerAttemptsMatch[1]);
        providerAttemptsCount = providerAttempts.length;

        // Calculate metrics from provider attempts
        for (const attempt of providerAttempts) {
          if (attempt.attempts !== undefined) {
            totalAttempts += attempt.attempts;
            retries += Math.max(0, attempt.attempts - 1); // retries = attempts - 1
          }

          if (attempt.result === "SUCCESS" || attempt.result === "PARTIAL_RESULT") {
            supportiveResults++;
          }

          if (
            attempt.result === "RETRYABLE_FAILURE" ||
            attempt.result === "NON_RETRYABLE_FAILURE"
          ) {
            adverseResults++;
          }

          // Get provider name from first attempt (or most recent)
          if (providerName === "unknown" && attempt.provider !== undefined) {
            providerName = attempt.provider;
          }
        }
      } catch (e) {
        console.warn("Failed to parse provider_attempts:", e);
      }
    }

    // Check for official/full-text verified material in source_freshness
    const sourceFreshnessMatch = stateAfterText.match(/"source_freshness"\s*:\s*(\[.*?\])/s);
    if (sourceFreshnessMatch) {
      try {
        const sourceFreshness = JSON.parse(sourceFreshnessMatch[1]);
        officialFullTextVerified = sourceFreshness.some(
          (fs: any) => fs.source_status === "FULL_TEXT_VERIFIED_OFFICIAL",
        );
      } catch (e) {
        console.warn("Failed to parse source_freshness:", e);
      }
    }

    // Step 5: analyze_matter
    const analyzeResult = await client.callTool({
      name: "analyze_matter",
      arguments: { matter_id: matterId, stage: "CHRONOLOGY" },
    });
    if (analyzeResult.isError) {
      throw new Error(`analyze_matter failed: ${analyzeResult.error}`);
    }
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
    if (auditResult.isError) {
      throw new Error(`audit_legal_draft failed: ${auditResult.error}`);
    }
    console.log(`Audit result: ${JSON.stringify(auditResult.structuredContent)}`);

    // Determine if real provider was used
    const realProviderUsed = providerAttemptsCount > 0 ? "YES" : "NO";

    // Output summary to stderr so it appears in vitest output
    const summary = {
      matterId,
      versionBeforeResearch,
      versionAfterResearch,
      realProviderUsed,
      provider: providerName,
      realProviderAttempts: providerAttemptsCount.toString(),
      retries: retries.toString(),
      globalCallBudgetConsumed: totalAttempts.toString(),
      supportiveResults: supportiveResults.toString(),
      adverseResults: adverseResults.toString(),
      officialFullTextVerified: officialFullTextVerified ? "true" : "false",
      runtimeStoreRecreated: "YES",
      matterFoundAfterRecreation: "YES",
      analyzeStatus: analyzeResult.isError ? "FAILED" : "SUCCESS",
      auditStatus: auditResult.isError ? "FAILED" : "SUCCESS",
    };

    process.stderr.write("SUMMARY: " + JSON.stringify(summary) + "\n");
  } finally {
    if (client) await client.close();
    if (server) await server.close();
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("E2E test failed:", err);
  process.exit(1);
});
