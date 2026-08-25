#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createLogger, loadStdioEnv } from "@swiss-legal-mcp/shared";
import {
  SecurityEventStore,
  createUpdater,
  detectBreachSignals,
  type UpdateManifestEnvelope,
} from "@swiss-legal-mcp/updater";
import { buildRegistries } from "./registry.js";

const root = process.cwd();
const stateDir = path.join(root, "artifacts", "updater");
const incidentFile = path.join(root, "artifacts", "security", "incidents.json");

async function main(): Promise<void> {
  const [area, action, ...args] = process.argv.slice(2);
  if (area === "update") {
    await handleUpdate(action, args);
    return;
  }
  if (area === "security") {
    await handleSecurity(action, args);
    return;
  }
  if (area === "integrity" && action === "verify") {
    await verifyIntegrity();
    return;
  }
  await printSystemStatus();
}

async function printSystemStatus(): Promise<void> {
  const settings = loadStdioEnv();
  const logger = createLogger({ level: settings.LOG_LEVEL, name: "swiss-legal-mcp-admin-cli" });
  const { providers, legislationProviders, tools } = buildRegistries(settings);
  const [providerInfos, legislationProviderInfos] = await Promise.all([
    providers.checkAllHealth(),
    legislationProviders.checkAllHealth(),
  ]);
  const toolInfos = tools.list();
  console.log(
    JSON.stringify(
      {
        providers: providerInfos,
        legislationProviders: legislationProviderInfos,
        tools: toolInfos,
      },
      null,
      2,
    ),
  );
  logger.debug(
    {
      providerCount: providerInfos.length,
      legislationProviderCount: legislationProviderInfos.length,
      toolCount: toolInfos.length,
    },
    "estado calculado",
  );
}

async function handleUpdate(action: string | undefined, args: string[]): Promise<void> {
  const updater = await makeUpdater(args);
  if (action === "status" || action === undefined) {
    console.log(JSON.stringify(await updater.status(), null, 2));
    return;
  }
  const manifestFile = option(args, "--manifest");
  if (!manifestFile) throw new Error("update command requires --manifest <file>");
  const envelope = JSON.parse(await fs.readFile(manifestFile, "utf8")) as UpdateManifestEnvelope;
  if (action === "check") {
    console.log(JSON.stringify(await updater.check(envelope), null, 2));
    return;
  }
  if (action === "download") {
    await updater.check(envelope);
    console.log(
      JSON.stringify({ artifactFile: await updater.download(envelope.manifest) }, null, 2),
    );
    return;
  }
  const artifactFile = option(args, "--artifact");
  if (!artifactFile) throw new Error("update command requires --artifact <file>");
  if (action === "verify") {
    await updater.verify(envelope.manifest, artifactFile);
    console.log(JSON.stringify({ status: "verified" }, null, 2));
    return;
  }
  if (action === "install") {
    await updater.install(envelope.manifest, artifactFile, { confirm: args.includes("--confirm") });
    console.log(
      JSON.stringify({ status: "installed", version: envelope.manifest.version }, null, 2),
    );
    return;
  }
  if (action === "rollback") {
    await updater.rollback({ confirm: args.includes("--confirm") });
    console.log(JSON.stringify({ status: "rolled_back" }, null, 2));
    return;
  }
  throw new Error(`Unknown update command: ${action}`);
}

async function makeUpdater(args: string[]) {
  const publicKeyFile = option(args, "--public-key");
  const publicKeys = new Map<string, string>();
  if (publicKeyFile) {
    publicKeys.set(
      option(args, "--key-id") ?? "configured-key",
      await fs.readFile(publicKeyFile, "utf8"),
    );
  }
  return createUpdater({
    installDir: option(args, "--install-dir") ?? root,
    stateDir,
    currentVersion: "1.0.0",
    allowedHosts: (option(args, "--allowed-hosts") ?? "localhost").split(","),
    publicKeys,
    platform: "darwin-arm64",
  });
}

async function handleSecurity(action: string | undefined, args: string[]): Promise<void> {
  const store = new SecurityEventStore(incidentFile);
  if (action === "scan" || action === "status" || action === undefined) {
    const events = detectBreachSignals({
      invalidTokenAttempts: Number(option(args, "--invalid-token-attempts") ?? 0),
      invalidSignature: args.includes("--invalid-signature"),
      artifactHashMismatch: args.includes("--artifact-hash-mismatch"),
      ssrfAttempt: args.includes("--ssrf-attempt"),
      pathTraversalAttempt: args.includes("--path-traversal"),
      secretInLog: args.includes("--secret-in-log"),
      fixtureToolInProduction: args.includes("--fixture-tool"),
      stdoutContaminated: args.includes("--stdout-contaminated"),
      downgradeAttempt: args.includes("--downgrade"),
      anomalousProviderResponse: args.includes("--provider-anomaly"),
    });
    for (const event of events) await store.append(event);
    console.log(JSON.stringify({ status: "scanned", eventCount: events.length, events }, null, 2));
    return;
  }
  if (action === "incidents" && args[0] === "list") {
    console.log(JSON.stringify(await store.list(), null, 2));
    return;
  }
  if (action === "incidents" && args[0] === "acknowledge") {
    const eventId = args[1];
    if (!eventId) throw new Error("security incidents acknowledge requires <eventId>");
    await store.acknowledge(eventId);
    console.log(JSON.stringify({ status: "acknowledged", eventId }, null, 2));
    return;
  }
  if (action === "incidents" && args[0] === "export") {
    console.log(JSON.stringify(await store.list(), null, 2));
    return;
  }
  throw new Error(`Unknown security command: ${action ?? "(empty)"}`);
}

async function verifyIntegrity(): Promise<void> {
  const hashesFile = path.join(root, "docs", "release", "generated", "build-hashes.json");
  const hashes = JSON.parse(await fs.readFile(hashesFile, "utf8")) as Array<{
    path: string;
    sha256: string;
  }>;
  const mismatches: string[] = [];
  for (const item of hashes) {
    const file = path.join(root, item.path);
    const bytes = await fs.readFile(file);
    const actualHex = createHash("sha256").update(bytes).digest("hex");
    if (actualHex !== item.sha256) mismatches.push(item.path);
  }
  console.log(
    JSON.stringify({ status: mismatches.length === 0 ? "passed" : "failed", mismatches }, null, 2),
  );
  if (mismatches.length > 0) process.exitCode = 1;
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

main().catch((error: unknown) => {
  console.error("swiss-legal-mcp-admin-cli: fallo", error);
  process.exitCode = 1;
});
