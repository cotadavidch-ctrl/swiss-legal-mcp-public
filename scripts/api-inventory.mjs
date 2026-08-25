#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { scanRegisteredTools } from "./lib/tool-inventory.mjs";

const root = process.cwd();
const outDir = path.join(root, "docs", "release", "generated");
fs.mkdirSync(outDir, { recursive: true });

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walk(dir, predicate, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, acc);
    else if (predicate(full)) acc.push(full);
  }
  return acc;
}

const packageFiles = walk(root, (file) => file.endsWith("package.json"));
const packages = packageFiles.map((file) => {
  const pkg = readJson(file);
  return {
    path: path.relative(root, path.dirname(file)),
    name: pkg.name,
    version: pkg.version,
    private: pkg.private === true,
    license: pkg.license ?? null,
    main: pkg.main ?? null,
    types: pkg.types ?? null,
    bin: pkg.bin ?? null,
    scripts: Object.keys(pkg.scripts ?? {}).sort(),
    dependencies: Object.keys(pkg.dependencies ?? {}).sort(),
    devDependencies: Object.keys(pkg.devDependencies ?? {}).sort(),
  };
});

const sourceFiles = walk(root, (file) => file.endsWith(".ts"));
const tools = scanRegisteredTools(root);

const exports = [];
for (const file of sourceFiles.filter((f) => f.endsWith(`${path.sep}src${path.sep}index.ts`))) {
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*export\s/.test(line))
      exports.push({ file: path.relative(root, file), export: line.trim() });
  }
}

const env = Array.from(
  new Set(
    sourceFiles
      .flatMap((file) =>
        Array.from(fs.readFileSync(file, "utf8").matchAll(/\b[A-Z][A-Z0-9_]{2,}\b/g)).map(
          (m) => m[0],
        ),
      )
      .filter((name) => name.startsWith("MCP_") || name === "NODE_ENV" || name === "LOG_LEVEL"),
  ),
).sort();

const inventory = {
  generatedAt: new Date().toISOString(),
  packages,
  publicExports: exports,
  mcpTools: tools.sort((a, b) => a.name.localeCompare(b.name)),
  environmentVariables: env,
};

fs.writeFileSync(
  path.join(outDir, "api-inventory.json"),
  `${JSON.stringify(inventory, null, 2)}\n`,
);
console.log(
  `API inventory written: ${path.relative(root, path.join(outDir, "api-inventory.json"))}`,
);
