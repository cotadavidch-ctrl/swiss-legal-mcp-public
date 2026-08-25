#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const files = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
}

for (const dir of ["apps", "packages"]) {
  walk(path.join(root, dir));
}

const distFiles = files
  .filter((file) => file.includes(`${path.sep}dist${path.sep}`))
  .sort()
  .map((file) => {
    const bytes = fs.readFileSync(file);
    return {
      path: path.relative(root, file),
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    };
  });

if (distFiles.length === 0) {
  console.error("No dist files found. Run pnpm build before build:verify.");
  process.exit(1);
}

const outDir = path.join(root, "docs", "release", "generated");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "build-hashes.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), files: distFiles }, null, 2)}\n`,
);
console.log(`Build hashes written for ${distFiles.length} dist files.`);
