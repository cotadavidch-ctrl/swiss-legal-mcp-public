import fs from "node:fs";
import path from "node:path";

function walk(dir, predicate, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, acc);
    else if (predicate(full)) acc.push(full);
  }
  return acc;
}

/**
 * Unica fuente de verdad para el inventario de herramientas MCP registradas:
 * escanea los literales `name: "..."` en apps/mcp-server/src/tools/*.ts.
 * Usado tanto por scripts/api-inventory.mjs (documentacion) como por
 * scripts/claude-desktop-acceptance.mjs (validacion de aceptacion), para que
 * ninguno de los dos pueda divergir del otro ni del codigo fuente real.
 */
export function scanRegisteredTools(root) {
  const sourceFiles = walk(root, (file) => file.endsWith(".ts"));
  const tools = [];
  for (const file of sourceFiles.filter((f) =>
    f.includes(`${path.sep}apps${path.sep}mcp-server${path.sep}src${path.sep}tools${path.sep}`),
  )) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/name:\s*"([^"]+)"/g)) {
      tools.push({ name: match[1], file: path.relative(root, file) });
    }
  }
  return tools.sort((a, b) => a.name.localeCompare(b.name));
}

export function scanRegisteredToolNames(root) {
  return scanRegisteredTools(root).map((tool) => tool.name);
}

export function findDuplicateNames(names) {
  const seen = new Set();
  const duplicates = new Set();
  for (const name of names) {
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }
  return [...duplicates].sort();
}
