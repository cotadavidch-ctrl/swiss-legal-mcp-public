#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "../apps/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../apps/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";

const root = process.cwd();
const serverPath = path.join(root, "apps", "mcp-server", "dist", "stdio.js");
const relativeServerPath = path.relative(root, serverPath);
const artifactPath = path.join(root, "docs", "release", "generated", "mcp-persistence-check.json");
const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "swiss-legal-mcp-persistence-"));

const report = {
  generatedAt: new Date().toISOString(),
  serverPath: relativeServerPath,
  cacheDir,
  firstProcess: null,
  secondProcess: null,
  finalStatus: "BLOCKED",
};

function safeEnv(overrides = {}) {
  const env = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "SHELL", "LANG", "LC_ALL", "TZ"]) {
    if (typeof process.env[key] === "string") env[key] = process.env[key];
  }
  return {
    ...env,
    NODE_ENV: "production",
    SWISS_LEGAL_CACHE_DIR: cacheDir,
    // Valor portable: evita capturar el hostname real de la maquina de
    // desarrollo en el artefacto distribuido (ver packages/shared/src/logger.ts).
    LOG_HOSTNAME: "test-host",
    ...overrides,
  };
}

async function withClient(env, action) {
  const stderrChunks = [];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: root,
    env,
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => stderrChunks.push(chunk.toString()));
  const client = new Client({ name: "mcp-persistence-check", version: "0.0.0" });
  try {
    await client.connect(transport);
    const result = await action(client);
    await client.close();
    return {
      ...result,
      stderrLines: stderrChunks.join("").split(/\r?\n/).filter(Boolean).slice(0, 8),
    };
  } catch (error) {
    await client.close().catch(() => undefined);
    return {
      error: error instanceof Error ? error.message : String(error),
      stderrLines: stderrChunks.join("").split(/\r?\n/).filter(Boolean).slice(0, 8),
    };
  }
}

async function callTool(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    throw new Error(`${name} returned MCP error: ${JSON.stringify(result.content ?? [])}`);
  }
  if (result.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent;
  }
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error(`${name} did not return structured or text JSON content`);
  return JSON.parse(text);
}

const multiroleInput = {
  caseType: "administrative",
  proceduralStage: "appeal",
  matterDescription: "Persistence check administrative appeal with pseudonymized facts.",
  jurisdiction: { country: "CH" },
  parties: [
    { role: "appellant", description: "Pseudonymized appellant A" },
    { role: "authority", description: "Cantonal authority" },
  ],
  facts: [{ id: "f1", description: "The authority issued a decision.", status: "confirmed" }],
  evidence: [],
  norms: [],
  caseLaw: [],
  challengedPassages: [],
};

if (!fs.existsSync(serverPath)) {
  report.finalStatus = "BLOCKED";
  report.error = "server_dist_missing";
} else {
  report.firstProcess = await withClient(safeEnv(), async (client) => {
    const resolution = await callTool(client, "resolve_official_swiss_case", {
      case_reference: "BGE 142 III 91",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
      presentation_mode: "debug",
    });
    const fetched = await callTool(client, "fetch_official_swiss_case_full_text", {
      resolution_id: resolution.resolution_id,
    });
    const analysis = await callTool(client, "analyze_swiss_legal_positions", multiroleInput);
    const validation = await callTool(client, "validate_multirole_legal_analysis", {
      analysis_id: analysis.analysis_id,
    });
    return {
      resolution_id: resolution.resolution_id,
      document_id: resolution.document_id,
      document_hash: resolution.fetch?.document_hash ?? fetched.document_hash ?? null,
      fetch_status: resolution.fetch?.fetch_status ?? fetched.fetch_status ?? null,
      identity_status: resolution.identity?.status ?? null,
      candidate_count: resolution.candidate_count,
      selected_candidate_id: resolution.selected_candidate_id,
      selection_blockers: resolution.selection_blockers,
      cache_status_after_fetch: fetched.cache_status ?? null,
      analysis_id: analysis.analysis_id,
      analysis_hash: analysis.analysis_hash,
      schema_version: analysis.schema_version,
      evidence_snapshot_hash: analysis.evidence_snapshot_hash,
      role_count: analysis.role_count,
      role_ids: analysis.role_ids,
      role_hashes: analysis.role_hashes,
      narrative_hash: analysis.narrative_hash,
      created_at: analysis.created_at,
      updated_at: analysis.updated_at,
      validation: validation.analysis_integrity,
    };
  });

  report.secondProcess = await withClient(safeEnv({ NODE_ENV: "test" }), async (client) => {
    const fetched = await callTool(client, "fetch_official_swiss_case_full_text", {
      resolution_id: report.firstProcess?.resolution_id,
    });
    const identity = await callTool(client, "verify_swiss_case_identity", {
      resolution_id: report.firstProcess?.resolution_id,
      requested_reference: "BGE 142 III 91",
    });
    const validation = await callTool(client, "validate_multirole_legal_analysis", {
      analysis_id: report.firstProcess?.analysis_id,
    });
    return {
      resolution_id: report.firstProcess?.resolution_id,
      document_hash: fetched.document_hash ?? null,
      fetch_status: fetched.fetch_status ?? null,
      cache_status: fetched.cache_status ?? null,
      network_request_performed: fetched.cache_status !== "cache_hit_valid",
      identity_status: identity.status ?? null,
      official_identity_verified: identity.official_identity_verified ?? null,
      analysis_id: report.firstProcess?.analysis_id,
      validation: validation.analysis_integrity,
    };
  });

  const first = report.firstProcess ?? {};
  const second = report.secondProcess ?? {};
  const validation = second.validation ?? {};
  const passed =
    Boolean(first.resolution_id) &&
    Boolean(first.analysis_id) &&
    second.fetch_status === "fetch_success" &&
    second.cache_status === "cache_hit_valid" &&
    second.network_request_performed === false &&
    second.document_hash === first.document_hash &&
    second.identity_status === "identity_verified" &&
    second.official_identity_verified === true &&
    validation.analysis_id === first.analysis_id &&
    validation.analysis_hash === first.analysis_hash &&
    validation.evidence_snapshot_hash === first.evidence_snapshot_hash &&
    validation.narrative_hash === first.narrative_hash &&
    validation.persistence_verified === true &&
    validation.network_request_performed === false &&
    validation.narrative_state_mismatch === false &&
    validation.role_integrity === "verified" &&
    validation.evidence_consistency === "verified";
  report.finalStatus = passed ? "PASS" : "BLOCKED";
}

fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(report.finalStatus === "PASS" ? 0 : 1);
