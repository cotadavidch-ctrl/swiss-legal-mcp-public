#!/usr/bin/env node
// Script de validacion puntual, no forma parte del pipeline de release.
// Verifica, contra el bundle real empaquetado (dist/stdio.js, el mismo que
// contiene el tarball actual), el estado de FIND-01 y FIND-02:
//   - AILC-06 / AILC-13: resolve_official_swiss_case con require_full_text=true
//     para 2A.348/2004 y 4C.4/2004 (antes fallaban con error de limite de
//     tokens, ambos con exactamente 109.737 caracteres).
//   - AILC-21: search_cantonal_legislation canton=GE (antes fallaba con
//     PARSE_ERROR: Respuesta comprimida invalida contra silgeneve.ch).
// Tambien hace un handshake MCP real y valida el inventario de herramientas
// (42 esperadas, sin faltantes/inesperadas/duplicadas).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = path.join(
  root,
  "docs",
  "validation",
  "results",
  "targeted-fix-find-01-02.json",
);

const checks = [];
function record(name, passed, detail) {
  checks.push({ name, passed: Boolean(passed), detail: detail ?? null });
  if (!passed) console.error(`FALLO: ${name} -- ${JSON.stringify(detail)}`);
  else console.log(`OK: ${name}`);
}

// 1. localizar el tarball generado y calcular su SHA-256
const tarballs = fs.readdirSync(root).filter((f) => /^swiss-legal-mcp-.*\.tgz$/.test(f));
record("tarball_present", tarballs.length === 1, tarballs);
const tarballName = tarballs[0] ?? null;
let tarballSha256 = null;
if (tarballName) {
  const bytes = fs.readFileSync(path.join(root, tarballName));
  tarballSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
}

const distEntry = path.join(root, "dist", "stdio.js");
record("dist_stdio_js_present", fs.existsSync(distEntry));

// Confirmar que el dist/ en disco es exactamente el que empaqueta el tarball actual.
let distMatchesTarball = false;
if (tarballName) {
  const extractDir = fs.mkdtempSync(path.join(root, ".targeted-fix-extract-"));
  try {
    execFileSync("tar", ["-xzf", path.join(root, tarballName), "-C", extractDir]);
    const inTarball = fs.readFileSync(path.join(extractDir, "package", "dist", "stdio.js"));
    const onDisk = fs.readFileSync(distEntry);
    distMatchesTarball = Buffer.compare(inTarball, onDisk) === 0;
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}
record("dist_matches_packaged_tarball", distMatchesTarball);

const { Client } = await import(
  path.join(root, "apps/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js")
);
const { StdioClientTransport } = await import(
  path.join(root, "apps/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js")
);

const stderrChunks = [];
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [distEntry],
  cwd: root,
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "production",
  },
  stderr: "pipe",
});
transport.stderr?.on("data", (chunk) => stderrChunks.push(chunk.toString()));
const client = new Client({ name: "targeted-fix-find-01-02-check", version: "0.0.0" });

let handshakeOk = false;
try {
  await client.connect(transport);
  handshakeOk = true;
} catch (error) {
  record("mcp_handshake", false, String(error));
}
if (handshakeOk) record("mcp_handshake", true);

let toolCount = null;
let missingTools = [];
let unexpectedTools = [];
let duplicateTools = [];

const EXPECTED_TOOLS_PATH = path.join(root, "scripts", "lib", "tool-inventory.mjs");
const { scanRegisteredToolNames } = await import(EXPECTED_TOOLS_PATH);
const expectedTools = scanRegisteredToolNames(root);

const ailc = {
  AILC_06: null,
  AILC_13: null,
  AILC_21: null,
};

if (handshakeOk) {
  const toolsResponse = await client.listTools();
  const names = toolsResponse.tools.map((t) => t.name).sort();
  const unique = [...new Set(names)];
  toolCount = names.length;
  duplicateTools = names.filter((n, i) => names.indexOf(n) !== i);
  const expectedSorted = [...expectedTools].sort();
  missingTools = expectedSorted.filter((t) => !names.includes(t));
  unexpectedTools = names.filter((t) => !expectedSorted.includes(t));
  record("tools_list_count_42", toolCount === 42, `actual=${toolCount}`);
  record("tools_list_no_missing", missingTools.length === 0, missingTools);
  record("tools_list_no_unexpected", unexpectedTools.length === 0, unexpectedTools);
  record("tools_list_no_duplicates", duplicateTools.length === 0, duplicateTools);

  // --- AILC-06: 2A.348/2004, resolve_official_swiss_case, require_full_text=true ---
  async function runResolveFullText(caseReference) {
    const result = await client.callTool({
      name: "resolve_official_swiss_case",
      arguments: {
        case_reference: caseReference,
        require_official_source: true,
        require_full_text: true,
        retrieval_mode: "full_text",
      },
    });
    const text = result.content?.find((c) => c.type === "text")?.text ?? "{}";
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { parse_error: true, raw: text.slice(0, 500) };
    }
    return { isError: result.isError === true, payload, rawTextLength: text.length };
  }

  const ailc06 = await runResolveFullText("2A.348/2004");
  const fetch06 = ailc06.payload?.fetch ?? ailc06.payload ?? {};
  const tokenLimitError06 =
    /excede el limite maximo de tokens|excede el l.mite m.ximo de tokens/i.test(
      JSON.stringify(ailc06.payload),
    );
  const fullText06 =
    typeof fetch06.text === "string"
      ? fetch06.text
      : typeof fetch06.text_chunk === "string"
        ? fetch06.text_chunk
        : "";
  ailc.AILC_06 = {
    case_reference: "2A.348/2004",
    isError: ailc06.isError,
    fetch_status: fetch06.fetch_status ?? null,
    full_text_length: fullText06.length,
    token_limit_error_present: tokenLimitError06,
    is_chunked: fetch06.is_chunked ?? false,
  };
  record(
    "AILC-06_full_text_no_token_limit_error",
    !ailc06.isError && !tokenLimitError06 && fullText06.length > 0,
    ailc.AILC_06,
  );

  // --- AILC-13: 4C.4/2004, resolve_official_swiss_case, require_full_text=true ---
  const ailc13 = await runResolveFullText("4C.4/2004");
  const fetch13 = ailc13.payload?.fetch ?? ailc13.payload ?? {};
  const tokenLimitError13 =
    /excede el limite maximo de tokens|excede el l.mite m.ximo de tokens/i.test(
      JSON.stringify(ailc13.payload),
    );
  const fullText13 =
    typeof fetch13.text === "string"
      ? fetch13.text
      : typeof fetch13.text_chunk === "string"
        ? fetch13.text_chunk
        : "";
  ailc.AILC_13 = {
    case_reference: "4C.4/2004",
    isError: ailc13.isError,
    fetch_status: fetch13.fetch_status ?? null,
    full_text_length: fullText13.length,
    token_limit_error_present: tokenLimitError13,
    is_chunked: fetch13.is_chunked ?? false,
  };
  record(
    "AILC-13_full_text_no_token_limit_error",
    !ailc13.isError && !tokenLimitError13 && fullText13.length > 0,
    ailc.AILC_13,
  );

  // --- AILC-21: search_cantonal_legislation, canton=GE ---
  const geResult = await client.callTool({
    name: "search_cantonal_legislation",
    arguments: { canton: "GE" },
  });
  const geText = geResult.content?.find((c) => c.type === "text")?.text ?? "{}";
  let gePayload;
  try {
    gePayload = JSON.parse(geText);
  } catch {
    gePayload = { parse_error: true, raw: geText.slice(0, 500) };
  }
  const parseErrorPresent =
    /PARSE_ERROR/i.test(JSON.stringify(gePayload)) || /Respuesta comprimida/i.test(geText);
  const resultCount = Array.isArray(gePayload?.result?.results)
    ? gePayload.result.results.length
    : Array.isArray(gePayload?.result?.documents)
      ? gePayload.result.documents.length
      : Array.isArray(gePayload?.results)
        ? gePayload.results.length
        : Array.isArray(gePayload?.documents)
          ? gePayload.documents.length
          : Array.isArray(gePayload)
            ? gePayload.length
            : null;
  ailc.AILC_21 = {
    canton: "GE",
    isError: geResult.isError === true,
    parse_error_present: parseErrorPresent,
    result_count: resultCount,
    source_url: gePayload?.result?.results?.[0]?.provenance?.sourceUrl ?? null,
  };
  record(
    "AILC-21_geneva_cantonal_no_parse_error",
    geResult.isError !== true && !parseErrorPresent,
    ailc.AILC_21,
  );

  const stderrText = stderrChunks.join("");
  await client.close();
  record("mcp_shutdown_clean", true);
  ailc._stderr_sample = stderrText.slice(0, 2000);
}

const report = {
  generatedAt: new Date().toISOString(),
  scope: "FIND-01 (AILC-06, AILC-13) y FIND-02 (AILC-21) -- cierre puntual",
  tarballName,
  tarballSha256,
  distMatchesTarball,
  mcpHandshake: handshakeOk,
  toolInventory: {
    expectedCount: 42,
    actualCount: toolCount,
    missingTools,
    unexpectedTools,
    duplicateTools,
  },
  ailc,
  checks,
  finalStatus: checks.every((c) => c.passed) ? "PASS" : "FAIL",
};

fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nArtefacto escrito: ${path.relative(root, artifactPath)}`);
console.log(`finalStatus: ${report.finalStatus}`);

if (report.finalStatus !== "PASS") process.exitCode = 1;
