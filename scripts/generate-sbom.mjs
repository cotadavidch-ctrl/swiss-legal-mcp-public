#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const outDir = path.join(root, "docs", "release", "generated");
fs.mkdirSync(outDir, { recursive: true });

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walkPackageJsons(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walkPackageJsons(full, acc);
    } else if (entry.name === "package.json") {
      acc.push(full);
    }
  }
  return acc;
}

const rootPkg = readJson(path.join(root, "package.json"));
const workspaceComponents = walkPackageJsons(root)
  .map((file) => ({ file, pkg: readJson(file) }))
  .filter(({ pkg }) => pkg.name)
  .map(({ file, pkg }) => ({
    type: "library",
    name: pkg.name,
    version: pkg.version ?? "0.0.0",
    purl: `pkg:npm/${encodeURIComponent(pkg.name)}@${pkg.version ?? "0.0.0"}`,
    properties: [{ name: "workspace:path", value: path.relative(root, path.dirname(file)) }],
  }));

const lockfile = fs.existsSync(path.join(root, "pnpm-lock.yaml"))
  ? fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8")
  : "";
const lockHash = crypto.createHash("sha256").update(lockfile).digest("hex");

const bom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  serialNumber: `urn:uuid:${crypto.randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: "application",
      name: rootPkg.name,
      version: rootPkg.version,
      licenses: [{ license: { id: rootPkg.license ?? "NOASSERTION" } }],
    },
    properties: [{ name: "pnpm-lock.sha256", value: lockHash }],
  },
  components: workspaceComponents,
};

for (const file of ["sbom.cdx.json", "pnpm-sbom.cdx.json"]) {
  const out = path.join(outDir, file);
  fs.writeFileSync(out, `${JSON.stringify(bom, null, 2)}\n`);
  console.log(`SBOM written: ${path.relative(root, out)}`);
}
