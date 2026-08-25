#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const artifactPath = path.join(
  root,
  "docs",
  "release",
  "generated",
  "package-installability-check.json",
);

const checks = [];
function record(name, passed, detail) {
  checks.push({ name, passed: Boolean(passed), detail: detail ?? null });
  if (!passed) console.error(`FALLO: ${name}${detail ? ` -- ${detail}` : ""}`);
}

function readTextFilesRecursive(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) results.push(...readTextFilesRecursive(full));
    else results.push(full);
  }
  return results;
}

function grepAll(dir, pattern) {
  const hits = [];
  for (const file of readTextFilesRecursive(dir)) {
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue; // binario no UTF-8 (p.ej. pdf-parse test fixtures no aplica aqui, pero por si acaso)
    }
    if (pattern.test(content)) hits.push(file);
  }
  return hits;
}

const report = {
  generatedAt: new Date().toISOString(),
  tarballName: null,
  tarballSha256: null,
  cleanInstallPath: null,
  checks,
  finalStatus: "BLOCKED",
};

// 1. pnpm pack genera tarball real (sin --dry-run)
for (const oldTarball of fs.readdirSync(root).filter((f) => /^swiss-legal-mcp-.*\.tgz$/.test(f))) {
  fs.rmSync(path.join(root, oldTarball));
}
execFileSync("pnpm", ["pack"], { cwd: root, encoding: "utf8" });
const tarballName = fs.readdirSync(root).find((f) => /^swiss-legal-mcp-.*\.tgz$/.test(f));
record("1_pack_generates_tarball", Boolean(tarballName), tarballName);
if (!tarballName) {
  fs.writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
  process.exit(1);
}
report.tarballName = tarballName;
const tarballPath = path.join(root, tarballName);
const tarballBytes = fs.readFileSync(tarballPath);
report.tarballSha256 = crypto.createHash("sha256").update(tarballBytes).digest("hex");

const listing = execFileSync("tar", ["-tzf", tarballPath], { encoding: "utf8" }).trim().split("\n");

// 2. tarball contiene dist
record(
  "2_tarball_contains_dist",
  listing.some((f) => f.startsWith("package/dist/")),
);
// 3. tarball contiene package.json valido
record("3_tarball_contains_package_json", listing.includes("package/package.json"));
// 4. tarball contiene bin (el entrypoint al que apunta package.json.bin)
record("4_tarball_contains_bin_entrypoint", listing.includes("package/dist/stdio.js"));
// 16. no hay node_modules empaquetado
record("16_no_packaged_node_modules", !listing.some((f) => f.includes("node_modules/")));
// 14. no hay .env
record("14_no_env_files", !listing.some((f) => /(^|\/)\.env($|\.)/.test(f)));
// 15. no hay settings.local.json
record(
  "15_no_settings_local_json",
  !listing.some((f) => f.includes(".claude/settings.local.json")),
);

const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "swiss-legal-mcp-tarball-inspect-"));
execFileSync("tar", ["-xzf", tarballPath, "-C", extractDir]);
const pkgDir = path.join(extractDir, "package");

// 5. bin es ejecutable
const binPath = path.join(pkgDir, "dist", "stdio.js");
const binMode = fs.existsSync(binPath) ? fs.statSync(binPath).mode : 0;
record("5_bin_is_executable", Boolean(binMode & 0o111), `mode=${(binMode & 0o777).toString(8)}`);

// 12. no rutas /Users en el contenido real
const absolutePathHits = grepAll(pkgDir, /\/Users\/[a-zA-Z0-9_.-]+\//).filter(
  (f) => !f.includes(`${path.sep}stdio.js.map`), // no generamos sourcemap, defensivo
);
record("12_no_absolute_user_paths", absolutePathHits.length === 0, absolutePathHits.join(", "));

// 13. no hostname local real (verificado tras el arranque, mas abajo con LOG_HOSTNAME de control)

const installedPkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
// 17. no hay workspace:* en package.json instalado
const hasWorkspaceProtocol = JSON.stringify(installedPkgJson).includes("workspace:");
record("17_no_workspace_protocol_in_installed_package_json", !hasWorkspaceProtocol);

fs.rmSync(extractDir, { recursive: true, force: true });

// FASE 3: instalacion limpia en directorio temporal fuera del proyecto
const cleanDir = fs.mkdtempSync(
  path.join(os.tmpdir(), `swiss-legal-mcp-clean-install-${Date.now()}-`),
);
report.cleanInstallPath = cleanDir;
fs.writeFileSync(
  path.join(cleanDir, "package.json"),
  `${JSON.stringify({ name: "clean-install-probe", version: "0.0.0", private: true }, null, 2)}\n`,
);

try {
  execFileSync("pnpm", ["add", tarballPath], { cwd: cleanDir, encoding: "utf8" });
  const installedRoot = path.join(cleanDir, "node_modules", "swiss-legal-mcp");
  record("6_clean_install_succeeds", fs.existsSync(installedRoot));

  const installedDist = path.join(installedRoot, "dist", "stdio.js");
  record("6b_dependencies_resolve_in_temp_node_modules", fs.existsSync(installedDist));

  // 10. no hay imports al workspace en el JS instalado
  const installedSource = fs.existsSync(installedDist)
    ? fs.readFileSync(installedDist, "utf8")
    : "";
  record(
    "10_no_workspace_imports_in_installed_js",
    !/@swiss-legal-mcp\//.test(installedSource) && !installedSource.includes("workspace:"),
  );

  // 11. no hay symlink en vivo al workspace (el store interno de pnpm es una copia extraida, no el workspace real)
  const marker = `.probe_marker_${Date.now()}.txt`;
  fs.writeFileSync(path.join(root, marker), "marker");
  const realInstalledPath = fs.realpathSync(installedRoot);
  const markerLeaked = fs.existsSync(path.join(realInstalledPath, marker));
  fs.rmSync(path.join(root, marker));
  record("11_no_live_symlink_to_workspace", !markerLeaked, realInstalledPath);

  // Arranque real del binario instalado (nunca el del workspace)
  const { Client } = await import(
    path.join(
      root,
      "apps/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js",
    )
  );
  const { StdioClientTransport } = await import(
    path.join(
      root,
      "apps/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js",
    )
  );

  const stderrChunks = [];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [installedDist],
    cwd: cleanDir,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: "production",
      LOG_HOSTNAME: "test-host",
    },
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => stderrChunks.push(chunk.toString()));
  const client = new Client({ name: "package-installability-check", version: "0.0.0" });

  let handshakeOk = false;
  try {
    await client.connect(transport);
    handshakeOk = true;
  } catch (error) {
    record("7_server_starts_from_temp_node_modules", false, String(error));
  }
  record("7_server_starts_from_temp_node_modules", handshakeOk);
  record("8_mcp_handshake_passes", handshakeOk);

  if (handshakeOk) {
    const toolsResponse = await client.listTools();
    const names = toolsResponse.tools.map((t) => t.name).sort();
    const unique = [...new Set(names)];
    record("9_tools_list_returns_42", names.length === 42, `actual=${names.length}`);
    record("9b_no_duplicate_tools", names.length === unique.length);

    // 18. SHAB sigue sin red, error estructurado de politica
    const shabResult = await client.callTool({ name: "search_shab_publications", arguments: {} });
    const shabText = shabResult.content?.find((c) => c.type === "text")?.text ?? "{}";
    const shabPayload = JSON.parse(shabText);
    record(
      "18_shab_policy_error_no_network",
      shabResult.isError === true &&
        shabPayload.code === "PROVIDER_UNAVAILABLE_BY_POLICY" &&
        shabPayload.details?.reason === "robots_txt_disallow" &&
        shabPayload.details?.networkRequestPerformed === false &&
        shabPayload.retryable === false,
      shabText,
    );

    // 19. capacidad juridica basica desde el binario instalado (verify_legal_citation, offline)
    const citationResult = await client.callTool({
      name: "verify_legal_citation",
      arguments: { citation: "Art. 41 OR", language: "de" },
    });
    record("19_legal_capability_smoke_passes", citationResult.isError !== true);

    // 13. sin hostname local real en stderr (usamos LOG_HOSTNAME=test-host arriba)
    const stderrText = stderrChunks.join("");
    const realHostname = os.hostname();
    record(
      "13_no_local_hostname_in_runtime_output",
      !stderrText.includes(realHostname),
      realHostname,
    );

    await client.close();
    record("server_shutdown_clean", true);
  }
} finally {
  fs.rmSync(cleanDir, { recursive: true, force: true });
  record("20_temp_cleanup_correct", !fs.existsSync(cleanDir));
}

report.finalStatus = checks.every((c) => c.passed) ? "PASS" : "FAIL";
fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(report.finalStatus === "PASS" ? 0 : 1);
