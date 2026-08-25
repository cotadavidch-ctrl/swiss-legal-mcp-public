#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const findings = [];
const secretPatterns = [
  { name: "generic bearer", re: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/ },
  { name: "private key", re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { name: "aws access key", re: /AKIA[0-9A-Z]{16}/ },
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git", "coverage"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else scanFile(full);
  }
}

function scanFile(file) {
  const rel = path.relative(root, file);
  if (/\.(png|jpg|jpeg|gif|pdf|xml|json|lock)$/.test(rel)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of secretPatterns) {
    if (pattern.re.test(text) && !rel.includes("test") && !rel.includes("docs/")) {
      findings.push({ file: rel, type: pattern.name });
    }
  }
}

walk(root);

const requiredDocs = [
  "docs/security/network-security.md",
  "docs/security/content-security.md",
  "docs/release/release-gate.md",
  "SECURITY.md",
];
for (const doc of requiredDocs) {
  if (!fs.existsSync(path.join(root, doc)))
    findings.push({ file: doc, type: "missing required security doc" });
}

if (findings.length > 0) {
  console.error(JSON.stringify({ status: "failed", findings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: "passed", findings: [] }, null, 2));
