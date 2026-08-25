import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { LegislationProviderRegistry, ProviderRegistry, ToolRegistry } from "@swiss-legal-mcp/core";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/registry.js";
import { registerMatterRuntimeTools } from "../src/tools/matterRuntimeTools.js";

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

async function buildClientWithTools(tools: ToolRegistry) {
  const providers = new ProviderRegistry();
  const legislationProviders = new LegislationProviderRegistry();
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

function withMatterStoreDir<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const environment = process["env"];
  const previous = environment["SWISS_LEGAL_MATTER_STORE_DIR"];
  environment["SWISS_LEGAL_MATTER_STORE_DIR"] = dir;
  return fn().finally(() => {
    if (previous === undefined) {
      delete environment["SWISS_LEGAL_MATTER_STORE_DIR"];
    } else {
      environment["SWISS_LEGAL_MATTER_STORE_DIR"] = previous;
    }
  });
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

describe("Phase 9 MCP matter runtime tools", () => {
  it("M creates matter, analyzes, reloads and audits draft through MCP", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matter-runtime-mcp-"));
    const { client, server } = await withMatterStoreDir(dir, () => buildClient());
    try {
      const listed = await client.listTools();
      const toolNames = listed.tools.map((tool) => tool.name);
      expect(toolNames).toContain("create_or_update_matter");
      expect(toolNames).toContain("get_matter_state");
      expect(toolNames).toContain("analyze_matter");
      expect(toolNames).toContain("research_legal_issues");
      expect(toolNames).toContain("audit_legal_draft");

      const created = await client.callTool({
        name: "create_or_update_matter",
        arguments: { matter: matter(), created_by: "test", change_summary: "Create via MCP." },
      });
      expect(created.isError).toBeFalsy();
      expect(
        (created.structuredContent as { structured_result: { matter_id: string } })
          .structured_result.matter_id,
      ).toBe("matter-mcp-1");

      const analyzed = await client.callTool({
        name: "analyze_matter",
        arguments: { matter_id: "matter-mcp-1", stage: "CHRONOLOGY" },
      });
      expect(analyzed.isError).toBeFalsy();
      expect(JSON.stringify(analyzed.structuredContent)).toContain("CHRONOLOGY");

      const state = await client.callTool({
        name: "get_matter_state",
        arguments: { matter_id: "matter-mcp-1" },
      });
      expect(state.isError).toBeFalsy();
      expect(JSON.stringify(state.structuredContent)).toContain("MATTER_HEALTH");

      const qa = await client.callTool({
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
      expect(qa.isError).toBeFalsy();
      expect(JSON.stringify(qa.structuredContent)).toContain("UNSUPPORTED_FACT");
    } finally {
      await client.close();
      await server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("N reloads durable Matter state, checkpoints, audit trail and human locks across MCP lifecycles", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matter-runtime-restart-"));
    try {
      await withMatterStoreDir(dir, async () => {
        const processA = await buildClient();
        const input: ReturnType<typeof matter> & {
          legal_propositions: unknown[];
          human_review_records: unknown[];
        } = {
          ...matter(),
          legal_propositions: [],
          human_review_records: [],
        };
        input.legal_propositions = [
          {
            kind: "LegalProposition",
            id: "lp-locked",
            matter_id: "matter-mcp-1",
            legal_authority_id: "authority-1",
            text: "Human locked legal proposition.",
            provenance,
          },
        ];
        input.human_review_records = [
          {
            kind: "HumanReviewRecord",
            id: "human-lock-1",
            matter_id: "matter-mcp-1",
            reviewer_actor_id: "reviewer",
            reviewed_object_id: "lp-locked",
            reviewed_object_kind: "LegalProposition",
            decision: "LOCKED",
            provenance,
          },
        ];
        await processA.client.callTool({
          name: "create_or_update_matter",
          arguments: { matter: input, created_by: "test", change_summary: "Durable create." },
        });
        await processA.client.close();
        await processA.server.close();
      });

      await withMatterStoreDir(dir, async () => {
        const processB = await buildClient();
        const state = await processB.client.callTool({
          name: "get_matter_state",
          arguments: { matter_id: "matter-mcp-1", include_full_snapshot: true },
        });
        expect(state.isError).toBeFalsy();
        const text = JSON.stringify(state.structuredContent);
        expect(text).toContain("lp-locked");
        expect(text).toContain("human-lock-1");
        expect(text).toContain("LOCKED");
        expect(text).toContain("version_count");
        expect(text).toContain("checkpoint_count");
        expect(text).toContain("audit_entry_count");

        const analyzed = await processB.client.callTool({
          name: "analyze_matter",
          arguments: { matter_id: "matter-mcp-1", stage: "LEGAL_RESEARCH" },
        });
        expect(analyzed.isError).toBeFalsy();

        const qa = await processB.client.callTool({
          name: "audit_legal_draft",
          arguments: {
            matter_id: "matter-mcp-1",
            provenance,
            assertions: [
              {
                draft_sentence_id: "s-2",
                text: "Human locked legal proposition.",
                assertion_type: "LEGAL_CHARACTERIZATION",
                source_ids: ["doc-1"],
                evidence_ids: ["evidence-1"],
                legal_proposition_ids: ["lp-locked"],
                precedent_ids: [],
                confidence: 0.8,
                provenance,
                human_review_state: "HUMAN_LOCKED",
              },
            ],
          },
        });
        expect(qa.isError).toBeFalsy();
        expect(JSON.stringify(qa.structuredContent)).toContain("final_qa_count");
        await processB.client.close();
        await processB.server.close();
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("O orchestrates provider-backed research without metadata-only proposition jumps and persists deduped results", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matter-runtime-research-"));
    try {
      await withMatterStoreDir(dir, async () => {
        const tools = new ToolRegistry(new ProviderRegistry(), new LegislationProviderRegistry());
        tools.register({
          name: "search_legislation",
          description: "fake legislation search",
          inputSchema: {
            query: z.string().optional(),
            language: z.string().optional(),
            relevantDate: z.string().optional(),
            status: z.string().optional(),
            pageSize: z.number().optional(),
          },
          requiredProviderIds: [],
          handler: async () => ({
            items: [
              {
                eli: "https://www.fedlex.admin.ch/eli/cc/2026/1",
                title: "Synthetic Official Act",
                systematicNumber: "100.1",
              },
            ],
          }),
        });
        tools.register({
          name: "get_law",
          description: "fake law fetch",
          inputSchema: {
            eli: z.string().optional(),
            systematicNumber: z.string().optional(),
            language: z.string().optional(),
            date: z.string().optional(),
          },
          requiredProviderIds: [],
          handler: async () => ({
            title: "Synthetic Official Act",
            fullText: "Official full text: authorities must decide material requests.",
            provenance: { sourceUrl: "https://www.fedlex.admin.ch/eli/cc/2026/1" },
          }),
        });
        tools.register({
          name: "search_cases",
          description: "fake case search",
          inputSchema: {
            query: z.string(),
            language: z.string().optional(),
            pageSize: z.number().optional(),
          },
          requiredProviderIds: [],
          handler: async (input) => ({
            results: [
              {
                caseNumber: String(input.query).includes("abweisen")
                  ? "9C_999/2026"
                  : "9C_111/2026",
                title: "Synthetic Federal Supreme Court case",
              },
            ],
          }),
        });
        tools.register({
          name: "resolve_official_swiss_case",
          description: "fake official resolver",
          inputSchema: {
            case_reference: z.string(),
            language_hint: z.string().optional(),
            require_official_source: z.boolean().optional(),
            require_full_text: z.boolean().optional(),
            strict_identity_match: z.boolean().optional(),
          },
          requiredProviderIds: [],
          handler: async (input) => ({
            legal_use: { official_verification_status: "full_text_verified_official" },
            identity: { status: "identity_verified" },
            ratio_analysis: {
              main_ground: `Official ratio for ${input.case_reference}: material requests require exact scope review.`,
              ratio_status: "ratio_confirmed",
            },
            final_url: "https://search.bger.ch/fake",
          }),
        });
        tools.register({
          name: "verify_legal_citation",
          description: "fake citation verification",
          inputSchema: { citation: z.string().optional() },
          requiredProviderIds: [],
          handler: async () => ({ match: "exact" }),
        });
        registerMatterRuntimeTools(tools);

        const processA = await buildClientWithTools(tools);
        const input: ReturnType<typeof matter> & {
          legal_propositions: unknown[];
          precedent_applications: unknown[];
        } = {
          ...matter(),
          legal_propositions: [],
          precedent_applications: [],
        };
        input.legal_authorities = [];
        await processA.client.callTool({
          name: "create_or_update_matter",
          arguments: { matter: input, created_by: "test", change_summary: "Research create." },
        });
        const first = await processA.client.callTool({
          name: "research_legal_issues",
          arguments: { matter_id: "matter-mcp-1", language: "DE" },
        });
        expect(first.isError).toBeFalsy();
        expect(JSON.stringify(first.structuredContent)).toContain("PARTIAL_RESULT");
        const second = await processA.client.callTool({
          name: "research_legal_issues",
          arguments: { matter_id: "matter-mcp-1", language: "DE" },
        });
        expect(second.isError).toBeFalsy();
        await processA.client.close();
        await processA.server.close();

        const processB = await buildClientWithTools(tools);
        const state = await processB.client.callTool({
          name: "get_matter_state",
          arguments: { matter_id: "matter-mcp-1", include_full_snapshot: true },
        });
        const text = JSON.stringify(state.structuredContent);
        expect(text).toContain("FULL_TEXT_VERIFIED_OFFICIAL");
        expect(text).toContain("ADVERSE");
        expect(text).toContain("Official ratio");
        const snapshot = (
          state.structuredContent as {
            structured_result: {
              snapshot: {
                model: {
                  legal_authorities: Array<{ id: string }>;
                  legal_propositions: Array<{ id: string }>;
                };
              };
            };
          }
        ).structured_result.snapshot;
        expect(new Set(snapshot.model.legal_authorities.map((item) => item.id)).size).toBe(
          snapshot.model.legal_authorities.length,
        );
        expect(new Set(snapshot.model.legal_propositions.map((item) => item.id)).size).toBe(
          snapshot.model.legal_propositions.length,
        );
        await processB.client.close();
        await processB.server.close();
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it(
    "P enforces overall timeout for research_legal_issues and preserves partial results",
    { timeout: 90000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), "matter-runtime-timeout-"));
      try {
        await withMatterStoreDir(dir, async () => {
          const tools = new ToolRegistry(new ProviderRegistry(), new LegislationProviderRegistry());
          tools.register({
            name: "search_legislation",
            description: "fake legislation search with delay",
            inputSchema: {
              query: z.string().optional(),
              language: z.string().optional(),
              relevantDate: z.string().optional(),
              status: z.string().optional(),
              pageSize: z.number().optional(),
            },
            requiredProviderIds: [],
            // Mock provider that respects abort signals and delays for 70 seconds to trigger overall timeout
            handler: async (input, context) => {
              // Check if already aborted before starting
              if (context?.signal?.aborted) {
                throw new Error("Aborted");
              }

              // Delay for 70 seconds but check for abort signals every 100ms
              await new Promise((resolve, reject) => {
                const startTime = Date.now();
                const checkAbort = () => {
                  if (context?.signal?.aborted) {
                    reject(new Error("Aborted"));
                    return;
                  }

                  if (Date.now() - startTime >= 70_000) {
                    resolve(null);
                    return;
                  }

                  setTimeout(checkAbort, 100);
                };

                setTimeout(checkAbort, 100);
              });

              return {
                items: [
                  {
                    eli: "https://www.fedlex.admin.ch/eli/cc/2026/1",
                    title: "Synthetic Official Act",
                    systematicNumber: "100.1",
                  },
                ],
              };
            },
          });
          tools.register({
            name: "get_law",
            description: "fake law fetch",
            inputSchema: {
              eli: z.string().optional(),
              systematicNumber: z.string().optional(),
              language: z.string().optional(),
              date: z.string().optional(),
            },
            requiredProviderIds: [],
            handler: async () => ({
              title: "Synthetic Official Act",
              fullText: "Official full text: authorities must decide material requests.",
              provenance: { sourceUrl: "https://www.fedlex.admin.ch/eli/cc/2026/1" },
            }),
          });
          tools.register({
            name: "search_cases",
            description: "fake case search",
            inputSchema: {
              query: z.string(),
              language: z.string().optional(),
              pageSize: z.number().optional(),
            },
            requiredProviderIds: [],
            handler: async (input) => ({
              results: [
                {
                  caseNumber: String(input.query).includes("abweisen")
                    ? "9C_999/2026"
                    : "9C_111/2026",
                  title: "Synthetic Federal Supreme Court case",
                },
              ],
            }),
          });
          tools.register({
            name: "resolve_official_swiss_case",
            description: "fake official resolver",
            inputSchema: {
              case_reference: z.string(),
              language_hint: z.string().optional(),
              require_official_source: z.boolean().optional(),
              require_full_text: z.boolean().optional(),
              strict_identity_match: z.boolean().optional(),
            },
            requiredProviderIds: [],
            handler: async (input) => ({
              legal_use: { official_verification_status: "full_text_verified_official" },
              identity: { status: "identity_verified" },
              ratio_analysis: {
                main_ground: `Official ratio for ${input.case_reference}: material requests require exact scope review.`,
                ratio_status: "ratio_confirmed",
              },
              final_url: "https://search.bger.ch/fake",
            }),
          });
          tools.register({
            name: "verify_legal_citation",
            description: "fake citation verification",
            inputSchema: { citation: z.string().optional() },
            requiredProviderIds: [],
            handler: async () => ({ match: "exact" }),
          });
          registerMatterRuntimeTools(tools);

          const processA = await buildClientWithTools(tools);
          const inputMatter: ReturnType<typeof matter> & {
            legal_propositions: unknown[];
            precedent_applications: unknown[];
          } = {
            ...matter(),
            legal_propositions: [],
            precedent_applications: [],
          };
          inputMatter.legal_authorities = [];
          await processA.client.callTool({
            name: "create_or_update_matter",
            arguments: {
              matter: inputMatter,
              created_by: "test",
              change_summary: "Timeout test create.",
            },
          });

          // This should timeout after 60 seconds due to the 70-second delay in search_legislation
          const startTime = Date.now();
          const researchResult = await processA.client.callTool({
            name: "research_legal_issues",
            arguments: { matter_id: "matter-mcp-1", language: "DE" },
          });
          const endTime = Date.now();
          const duration = endTime - startTime;

          // Should complete within ~40-50 seconds (timeout + cleanup time)
          expect(duration).toBeLessThan(55_000); // Should not take the full 70 seconds of the mock delay
          expect(duration).toBeGreaterThan(40_000); // Should take at least about 40 seconds (timeout time)

          // Should indicate timeout or aborted status
          const resultText = JSON.stringify(researchResult.structuredContent);
          expect(resultText.includes("TIMEOUT") || resultText.includes("ABORTED")).toBe(true);

          // Should preserve the original matter and indicate human review required
          expect(JSON.stringify(researchResult.structuredContent)).toContain(
            "HUMAN_REVIEW_REQUIRED",
          );

          await processA.client.close();
          await processA.server.close();

          // Verify that the matter was still saved and can be retrieved
          const processB = await buildClientWithTools(tools);
          const stateAfterTimeout = await processB.client.callTool({
            name: "get_matter_state",
            arguments: { matter_id: "matter-mcp-1", include_full_snapshot: true },
          });
          expect(stateAfterTimeout.isError).toBeFalsy();
          const stateText = JSON.stringify(stateAfterTimeout.structuredContent);
          // Should still have the original matter data
          expect(stateText).toContain("matter-mcp-1");
          expect(stateText).toContain("doc-1");
          await processB.client.close();
          await processB.server.close();
        });
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
});
