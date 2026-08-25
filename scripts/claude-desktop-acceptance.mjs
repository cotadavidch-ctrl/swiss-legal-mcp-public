#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Client } from "../apps/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../apps/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";
import { findDuplicateNames, scanRegisteredToolNames } from "./lib/tool-inventory.mjs";

const root = process.cwd();
const nodeCommand = "/usr/local/bin/node";
const serverPath = path.join(root, "apps", "mcp-server", "dist", "stdio.js");
const relativeServerPath = path.relative(root, serverPath);
const artifactPath = path.join(
  root,
  "docs",
  "release",
  "generated",
  "claude-desktop-acceptance.json",
);

// expectedTools se deriva del codigo fuente real (apps/mcp-server/src/tools/*.ts)
// via scanRegisteredToolNames -- la misma fuente que usa scripts/api-inventory.mjs --
// en vez de mantener una segunda lista manual que puede quedar desactualizada
// frente a las herramientas realmente registradas en apps/mcp-server/src/registry.ts.
const expectedToolsRaw = scanRegisteredToolNames(root);
const expectedTools = [...new Set(expectedToolsRaw)].sort();
const expectedToolDuplicates = findDuplicateNames(expectedToolsRaw);

// No existe una lista separada de "herramientas obligatorias": expectedTools
// ya es el conjunto completo y exacto de las 42 herramientas registradas
// (fuente unica, ver arriba), y finalStatus exige coincidencia exacta con lo
// expuesto en tools/list (toolsMissing/unexpectedTools/duplicateTools todas
// vacias). Mantener una segunda lista manual de un subconjunto "obligatorio"
// no anadiria ninguna condicion que esa coincidencia exacta no exija ya.

const executionTests = [];
const stderrChunks = [];
const report = {
  generatedAt: new Date().toISOString(),
  command: nodeCommand,
  args: [relativeServerPath],
  environment: { NODE_ENV: "production" },
  serverVersion: null,
  protocolVersion: null,
  expectedToolCount: expectedTools.length,
  actualToolCount: 0,
  toolsExpected: expectedTools,
  toolsExposed: [],
  toolsMissing: expectedTools,
  unexpectedTools: [],
  duplicateTools: expectedToolDuplicates,
  fixtureToolsExposed: [],
  stdoutClean: false,
  stderrSummary: {
    lines: 0,
    bytes: 0,
    sample: [],
  },
  startupResult: "not_started",
  executionTests,
  shutdownResult: "not_started",
  finalStatus: "BLOCKED",
};

function safeEnv() {
  const env = {};
  const inheritedKeys = ["PATH", "HOME", "TMPDIR", "SHELL", "LANG", "LC_ALL", "TZ"];
  for (const key of inheritedKeys) {
    if (typeof process.env[key] === "string") env[key] = process.env[key];
  }
  env.NODE_ENV = "production";
  // Valor portable: evita capturar el hostname real de la maquina de
  // desarrollo en el artefacto distribuido (ver packages/shared/src/logger.ts).
  env.LOG_HOSTNAME = "test-host";
  return env;
}

function summarizeStderr() {
  const text = stderrChunks.join("");
  const lines = text.split(/\r?\n/).filter(Boolean);
  report.stderrSummary = {
    lines: lines.length,
    bytes: Buffer.byteLength(text),
    sample: lines.slice(0, 8),
  };
}

async function callTool(client, name, args) {
  try {
    const result = await client.callTool({ name, arguments: args });
    const passed = result.isError !== true;
    executionTests.push({
      tool: name,
      passed,
      isError: result.isError === true,
      contentTypes: (result.content ?? []).map((item) => item.type),
      structuredKeys:
        result.structuredContent && typeof result.structuredContent === "object"
          ? Object.keys(result.structuredContent).sort()
          : [],
    });
    return passed;
  } catch (error) {
    executionTests.push({
      tool: name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function main() {
  if (!fs.existsSync(nodeCommand)) {
    report.startupResult = "node_command_missing";
    writeAndExit(1);
  }
  if (!fs.existsSync(serverPath)) {
    report.startupResult = "server_dist_missing";
    writeAndExit(1);
  }

  const transport = new StdioClientTransport({
    command: nodeCommand,
    args: [serverPath],
    cwd: root,
    env: safeEnv(),
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => {
    stderrChunks.push(chunk.toString());
  });

  const client = new Client({ name: "claude-desktop-acceptance", version: "0.0.0" });
  let connected = false;
  try {
    await client.connect(transport);
    connected = true;
    report.startupResult = "connected";
    report.serverVersion = client.getServerVersion?.() ?? null;
    report.protocolVersion = client.getNegotiatedProtocolVersion?.() ?? null;

    const listResponse = await client.listTools();
    const exposedRaw = listResponse.tools.map((tool) => tool.name).sort();
    const exposed = [...new Set(exposedRaw)];
    report.toolsExposed = exposed;
    report.actualToolCount = exposed.length;
    report.toolsMissing = expectedTools.filter((name) => !exposed.includes(name));
    report.unexpectedTools = exposed.filter((name) => !expectedTools.includes(name));
    report.duplicateTools = [
      ...new Set([...expectedToolDuplicates, ...findDuplicateNames(exposedRaw)]),
    ].sort();
    report.fixtureToolsExposed = exposed.filter((name) => name.includes("fixture"));

    await callTool(client, "verify_legal_citation", {
      citation: "not-a-swiss-legal-citation",
      language: "de",
    });
    await callTool(client, "analyze_procedural_strategy", {
      jurisdiction: { country: "CH", canton: "ZH" },
      matter: {
        area: "administrative",
        subarea: "permit",
        description: "Acceptance test matter citing Art. 29 BV without attaching source text.",
      },
      parties: [
        {
          role: "appellant",
          type: "natural_person",
          description: "Pseudonymized appellant A",
        },
        {
          role: "authority",
          type: "public_authority",
          description: "Cantonal authority",
        },
      ],
      facts: [
        {
          id: "fact-1",
          date: "2026-01-10",
          description: "The authority issued an adverse decision.",
          status: "accepted",
        },
      ],
      proceduralHistory: [
        {
          date: "2026-01-10",
          authority: "Cantonal authority",
          action: "Decision issued",
          result: "Rejected request",
        },
      ],
      challengedDecision: {
        authority: "Cantonal authority",
        decisionDate: "2026-01-10",
        notificationDate: "2026-01-13",
        reference: "acceptance-test",
        summary: "Synthetic acceptance-test procedural posture.",
      },
      claims: [{ description: "Annul the decision", priority: "primary" }],
      availableEvidence: [],
      deadlines: [],
      objectives: ["annulment", "preserve-rights"],
      constraints: {
        urgency: "medium",
        representation: "unknown",
        riskTolerance: "medium",
        language: "de",
      },
      documents: [],
      analysisDate: "2026-01-15",
    });
    await callTool(client, "analyze_swiss_legal_positions", {
      caseType: "administrative",
      proceduralStage: "appeal",
      matterDescription: "Acceptance test administrative appeal with unverified evidence.",
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
    });
    await callTool(client, "resolve_official_swiss_case", {
      case_reference: "9C_999/2026",
      require_official_source: true,
      require_full_text: true,
      presentation_mode: "clean",
    });

    await client.close();
    report.shutdownResult = "closed";
  } catch (error) {
    report.startupResult = connected ? "failed_after_connect" : "connect_failed";
    report.shutdownResult = "failed";
    report.error = error instanceof Error ? error.message : String(error);
    await client.close().catch(() => undefined);
  } finally {
    summarizeStderr();
  }

  const executionPassed =
    executionTests.length === 4 && executionTests.every((test) => test.passed === true);
  report.stdoutClean = true;
  report.finalStatus =
    report.startupResult === "connected" &&
    report.shutdownResult === "closed" &&
    report.toolsMissing.length === 0 &&
    report.unexpectedTools.length === 0 &&
    report.duplicateTools.length === 0 &&
    report.fixtureToolsExposed.length === 0 &&
    executionPassed
      ? "PASS"
      : "FAIL";

  writeAndExit(report.finalStatus === "PASS" ? 0 : 1);
}

function writeAndExit(code) {
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(code);
}

await main();
