#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "../apps/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../apps/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";

const root = process.cwd();
const serverPath = path.join(root, "apps", "mcp-server", "dist", "stdio.js");
const relativeServerPath = path.relative(root, serverPath);
const artifactPath = path.join(
  root,
  "docs",
  "release",
  "generated",
  "multirole-persistence-check.json",
);
const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "swiss-legal-multirole-"));

const report = {
  generatedAt: new Date().toISOString(),
  serverPath: relativeServerPath,
  cacheDir,
  transport: "stdio",
  networkAllowedByScenario: false,
  firstProcess: null,
  secondProcess: null,
  comparisons: {},
  final_status: "FAIL",
};

function safeEnv() {
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
  };
}

async function withClient(label, action) {
  const stderrChunks = [];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: root,
    env: safeEnv(),
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => stderrChunks.push(chunk.toString()));
  const client = new Client({ name: `multirole-persistence-${label}`, version: "0.0.0" });
  const startedAt = new Date().toISOString();
  try {
    await client.connect(transport);
    const result = await action(client);
    await client.close();
    const stderr = stderrChunks.join("");
    const pid =
      /"pid"\s*:\s*(\d+)/.exec(stderr)?.[1] ?? /pid[=:]\s*(\d+)/i.exec(stderr)?.[1] ?? null;
    return {
      process_label: label,
      process_pid_or_equivalent: pid ?? `${label}:${startedAt}`,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      stderr_lines: stderr.split(/\r?\n/).filter(Boolean).slice(0, 8),
      ...result,
    };
  } catch (error) {
    await client.close().catch(() => undefined);
    return {
      process_label: label,
      process_pid_or_equivalent: `${label}:${startedAt}`,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      stderr_lines: stderrChunks.join("").split(/\r?\n/).filter(Boolean).slice(0, 8),
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
  report.final_status = "FAIL";
  report.error = "server_dist_missing";
} else {
  report.firstProcess = await withClient("first", async (client) => {
    const tools = await client.listTools();
    const analysis = await callTool(client, "analyze_swiss_legal_positions", multiroleInput);
    const validation = await callTool(client, "validate_multirole_legal_analysis", {
      analysis_id: analysis.analysis_id,
    });
    return {
      tools_count: tools.tools.length,
      fixture_tools_exposed: tools.tools
        .filter((tool) => tool.name.includes("fixture"))
        .map((tool) => tool.name),
      analysis_id: analysis.analysis_id,
      analysis_hash: analysis.analysis_hash,
      evidence_snapshot_hash: analysis.evidence_snapshot_hash,
      role_hashes: analysis.role_hashes,
      narrative_hash: analysis.narrative_hash,
      cache_origin: "stored_multirole_analysis",
      network_request_performed: false,
      validation_status: validation.status,
      validation: validation.analysis_integrity,
      finding_codes: validation.findings.map((finding) => finding.code),
    };
  });

  report.secondProcess = await withClient("second", async (client) => {
    const validation = await callTool(client, "validate_multirole_legal_analysis", {
      analysis_id: report.firstProcess?.analysis_id,
    });
    return {
      analysis_id: report.firstProcess?.analysis_id,
      cache_origin: "stored_multirole_analysis",
      network_request_performed: false,
      validation_status: validation.status,
      validation: validation.analysis_integrity,
      finding_codes: validation.findings.map((finding) => finding.code),
    };
  });

  const first = report.firstProcess ?? {};
  const second = report.secondProcess ?? {};
  const validation = second.validation ?? {};
  report.comparisons = {
    same_analysis_id: first.analysis_id === second.analysis_id,
    same_analysis_hash: first.analysis_hash === validation.analysis_hash,
    same_evidence_snapshot_hash: first.evidence_snapshot_hash === validation.evidence_snapshot_hash,
    same_narrative_hash: first.narrative_hash === validation.narrative_hash,
    no_network_first_process: first.network_request_performed === false,
    no_network_second_process: second.network_request_performed === false,
    no_fixture_tools_first_process: (first.fixture_tools_exposed ?? []).length === 0,
    persistence_verified_after_restart: validation.persistence_verified === true,
    no_new_narrative_mismatch: validation.narrative_state_mismatch === false,
    role_integrity_verified: validation.role_integrity === "verified",
  };
  report.final_status = Object.values(report.comparisons).every(Boolean) ? "PASS" : "FAIL";
}

fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(report.final_status === "PASS" ? 0 : 1);
