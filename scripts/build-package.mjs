#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";
import { writeFreshnessManifest } from "./lib/bundle-freshness.mjs";

const root = process.cwd();
const entryPoint = path.join(root, "apps", "mcp-server", "src", "stdio.ts");
const outDir = path.join(root, "dist");
const outFile = path.join(outDir, "stdio.js");

/**
 * Genera el paquete distribuible: un unico archivo JS autonomo con todos los
 * @swiss-legal-mcp/* internos inlineados (nunca resolubles fuera del
 * workspace via workspace:*), dejando como dependencias externas reales solo
 * las librerias de npm genuinas que stdio.ts realmente importa (transitivamente).
 * No incluye express/express-rate-limit/pino-http: stdio.ts nunca importa el
 * transporte HTTP, asi que ni siquiera entran en el grafo del bundle.
 */
function loadDependencyNames(packageJsonPath) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  return Object.entries(pkg.dependencies ?? {})
    .filter(([, version]) => !version.startsWith("workspace:"))
    .map(([name]) => name);
}

/**
 * Las dependencias externas reales no solo estan en apps/mcp-server/package.json:
 * pino/cheerio/pdf-parse/fast-xml-parser estan declaradas mas abajo, en los
 * paquetes internos @swiss-legal-mcp/* que se inlinean en el bundle. Hay que
 * recolectarlas de TODOS los package.json relevantes para que esbuild las
 * mantenga como imports externos (resueltos via node_modules en runtime) en
 * vez de intentar bundlearlas.
 */
const internalPackageJsonPaths = [
  path.join(root, "apps", "mcp-server", "package.json"),
  path.join(root, "packages", "core", "package.json"),
  path.join(root, "packages", "shared", "package.json"),
  path.join(root, "packages", "shared-web", "package.json"),
  path.join(root, "packages", "documents", "package.json"),
  path.join(root, "packages", "citations", "package.json"),
  ...fs
    .readdirSync(path.join(root, "packages", "providers"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, "packages", "providers", entry.name, "package.json")),
];

const mcpServerDeps = [
  ...new Set(internalPackageJsonPaths.flatMap((p) => loadDependencyNames(p))),
].sort();

fs.mkdirSync(outDir, { recursive: true });

const result = await esbuild.build({
  entryPoints: [entryPoint],
  outfile: outFile,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  // No se anade banner de shebang: apps/mcp-server/src/stdio.ts ya empieza
  // con "#!/usr/bin/env node" y esbuild lo preserva automaticamente en el
  // punto de entrada -- anadir un banner duplicaria la linea (la segunda
  // apariencia de "#!" ya no esta en la primera linea del archivo, por lo
  // que Node la interpretaria como sintaxis invalida en vez de ignorarla).
  // Solo las dependencias externas genuinas quedan fuera del bundle (se
  // resuelven via node_modules en tiempo de ejecucion, con version real en
  // package.json). Todo @swiss-legal-mcp/* se inlinea porque workspace:* no
  // se resuelve fuera del workspace pnpm.
  external: mcpServerDeps,
  sourcemap: false,
  minify: false,
  legalComments: "none",
  metafile: true,
  logLevel: "warning",
});

fs.chmodSync(outFile, 0o755);

const emitted = fs.readFileSync(outFile, "utf8");

const workspaceImportMatches = [...emitted.matchAll(/@swiss-legal-mcp\/[a-z-]+/g)].map((m) => m[0]);
if (workspaceImportMatches.length > 0) {
  console.error(
    `build:package: quedan referencias @swiss-legal-mcp/* sin inlinear en ${path.relative(root, outFile)}: ${[...new Set(workspaceImportMatches)].join(", ")}`,
  );
  process.exit(1);
}

if (emitted.includes("workspace:")) {
  console.error(`build:package: el bundle contiene el literal "workspace:" -- revisar.`);
  process.exit(1);
}

const absolutePathPattern = /\/(Users|home)\/[^"'\s)]+/g;
const absolutePathMatches = [...emitted.matchAll(absolutePathPattern)].map((m) => m[0]);
if (absolutePathMatches.length > 0) {
  console.error(
    `build:package: el bundle contiene rutas absolutas locales: ${[...new Set(absolutePathMatches)].slice(0, 5).join(", ")}`,
  );
  process.exit(1);
}

const externalInMetafile = new Set();
for (const imp of Object.values(result.metafile.outputs)[0]?.imports ?? []) {
  if (imp.external) externalInMetafile.add(imp.path);
}

console.log(`build:package: bundle escrito en ${path.relative(root, outFile)}`);
console.log(`build:package: tamano: ${emitted.length} bytes`);
console.log(
  `build:package: dependencias externas reales (declaradas en apps/mcp-server): ${mcpServerDeps.join(", ")}`,
);
console.log(
  `build:package: dependencias externas realmente referenciadas en el bundle: ${[...externalInMetafile].sort().join(", ") || "(ninguna)"}`,
);
console.log("build:package: 0 referencias @swiss-legal-mcp/* sin inlinear, 0 rutas absolutas.");

// Registro de frescura: hash de las fuentes que alimentaron ESTE build,
// para que release-check.mjs pueda detectar un dist/stdio.js desactualizado
// (fuentes modificadas despues del ultimo build:package) en vez de aceptar
// cualquier archivo que exista sin importar si sigue reflejando el codigo actual.
const freshness = writeFreshnessManifest(root);
console.log(`build:package: registro de frescura escrito (sourceHash=${freshness.sourceHash}).`);
