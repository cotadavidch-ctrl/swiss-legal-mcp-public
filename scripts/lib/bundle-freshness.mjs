import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Directorios fuente cuyos .ts alimentan el bundle distribuible
 * (apps/mcp-server/src/stdio.ts y todo lo que inlinea desde @swiss-legal-mcp/*).
 * Deliberadamente excluye *.test.ts: los tests nunca entran en el bundle, asi
 * que un cambio en un test no debe forzar una reconstruccion.
 */
export function bundleSourceDirs(root) {
  const providersDir = path.join(root, "packages", "providers");
  const providerDirs = fs
    .readdirSync(providersDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(providersDir, entry.name, "src"));
  return [
    path.join(root, "apps", "mcp-server", "src"),
    path.join(root, "packages", "core", "src"),
    path.join(root, "packages", "shared", "src"),
    path.join(root, "packages", "shared-web", "src"),
    path.join(root, "packages", "documents", "src"),
    path.join(root, "packages", "citations", "src"),
    ...providerDirs,
  ];
}

function walkTsFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(full, acc);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) acc.push(full);
  }
  return acc;
}

/**
 * Hash determinista sobre el CONTENIDO de todas las fuentes relevantes
 * (ordenadas por ruta relativa, para que el hash no dependa del orden de
 * lectura del sistema de archivos). Cambia si y solo si cambia algo que
 * realmente afecta al bundle -- no depende de mtime, que no es fiable entre
 * checkouts/CI (todos los archivos pueden compartir el mismo mtime).
 */
export function computeSourceHash(root) {
  const files = bundleSourceDirs(root)
    .flatMap((dir) => walkTsFiles(dir))
    .map((file) => path.relative(root, file))
    .sort();
  const hash = crypto.createHash("sha256");
  for (const relFile of files) {
    hash.update(relFile);
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(root, relFile)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function freshnessManifestPath(root) {
  return path.join(root, "dist", ".source-hash.json");
}

export function writeFreshnessManifest(root) {
  const manifestPath = freshnessManifestPath(root);
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceHash: computeSourceHash(root),
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/**
 * Compara el hash de fuentes registrado en el ultimo build:package contra el
 * hash de las fuentes ACTUALES. Si difieren, el bundle esta desactualizado
 * respecto al codigo fuente -- se corrigio algo despues del ultimo build y
 * nadie volvio a ejecutar build:package antes de empaquetar.
 */
export function checkBundleFreshness(root) {
  const distEntry = path.join(root, "dist", "stdio.js");
  if (!fs.existsSync(distEntry)) {
    return { fresh: false, reason: "dist/stdio.js no existe -- ejecuta pnpm build:package." };
  }
  const manifestPath = freshnessManifestPath(root);
  if (!fs.existsSync(manifestPath)) {
    return {
      fresh: false,
      reason: "dist/.source-hash.json no existe -- ejecuta pnpm build:package.",
    };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const currentHash = computeSourceHash(root);
  if (manifest.sourceHash !== currentHash) {
    return {
      fresh: false,
      reason:
        "dist/stdio.js esta desactualizado: el codigo fuente cambio desde el ultimo pnpm build:package. Ejecuta pnpm build:package de nuevo.",
    };
  }
  return { fresh: true, reason: null };
}
