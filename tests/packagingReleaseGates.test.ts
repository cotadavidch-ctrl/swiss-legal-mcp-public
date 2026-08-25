import { afterEach, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Todos los tests de este archivo mutan archivos REALES y compartidos del
// repositorio (apps/mcp-server/src/stdio.ts, dist/stdio.js,
// dist/.source-hash.json, docs/release/generated/release-manifest.json).
// Se agrupan deliberadamente en un unico archivo -- vitest ejecuta distintos
// *archivos* de test en paralelo por defecto (fileParallelism), pero los
// tests DENTRO de un mismo archivo se ejecutan en orden salvo que se marquen
// `.concurrent` explicitamente (no se hace aqui) -- para evitar que dos
// archivos de test compitan por el mismo `apps/mcp-server/src/stdio.ts` o el
// mismo `dist/stdio.js` a la vez, lo que produjo una carrera real (un test de
// frescura viendo el archivo renombrado a mitad de otro test) la primera vez
// que se dividieron en archivos separados.
//
// Estos tests tambien lanzan varios procesos reales pesados (pnpm pack,
// pnpm add en un directorio temporal, builds de esbuild, spawns de node) --
// bajo `NODE_ENV=test pnpm test` (la suite rapida, ejecutada en paralelo
// junto a apps/mcp-server/tests/shutdown.test.ts) esa carga concurrente hizo
// que shutdown.test.ts superase su timeout de 45s esperando a que el
// servidor stdio (arrancado via tsx) emitiera su log de "conectado" -- un
// caso real de contencion de recursos, no un fallo logico. Siguiendo el
// mismo patron que packages/providers/*/src/liveIntegration.test.ts para
// tests pesados, este archivo completo se salta por defecto y solo corre
// con la variable de entorno indicada, invocada como paso propio y
// bloqueante en `pnpm run ci` / `pnpm release:prepare` (ver
// `test:packaging-gates` en package.json), nunca dentro de la suite rapida:
//
//   RUN_PACKAGING_GATE_TESTS=true pnpm test -- packagingReleaseGates
//
const heavyEnabled = process.env["RUN_PACKAGING_GATE_TESTS"] === "true";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "docs", "release", "generated", "release-manifest.json");
const distEntry = path.join(root, "dist", "stdio.js");
const freshnessManifest = path.join(root, "dist", ".source-hash.json");
const stdioSource = path.join(root, "apps", "mcp-server", "src", "stdio.ts");
const stdioSourceBackup = path.join(
  root,
  "apps",
  "mcp-server",
  "src",
  "stdio.ts.packaging-test-backup",
);

function runNodeScript(
  args: string[],
  env?: NodeJS.ProcessEnv,
): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("node", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: env ?? process.env,
    });
    return { exitCode: 0, stdout, stderr: "" };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return { exitCode: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

function breakStdioSource(): void {
  fs.renameSync(stdioSource, stdioSourceBackup);
}
function restoreStdioSource(): void {
  if (fs.existsSync(stdioSourceBackup)) fs.renameSync(stdioSourceBackup, stdioSource);
}

describe.skipIf(!heavyEnabled)(
  "scripts/release-prepare.mjs: manejo de fallos de pnpm pack --dry-run",
  () => {
    let manifestBackup: Buffer | undefined;

    function installFakePnpm(behaviorForPack: string): { dir: string; cleanup: () => void } {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-pnpm-"));
      const fakePnpmPath = path.join(dir, "pnpm");
      fs.writeFileSync(
        fakePnpmPath,
        `#!/bin/sh\nif [ "$1" = "pack" ]; then\n${behaviorForPack}\nfi\nexit 0\n`,
      );
      fs.chmodSync(fakePnpmPath, 0o755);
      return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
    }

    afterEach(() => {
      if (manifestBackup !== undefined) {
        fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        fs.writeFileSync(manifestPath, manifestBackup);
      } else if (fs.existsSync(manifestPath)) {
        fs.rmSync(manifestPath);
      }
      manifestBackup = undefined;
    });

    it("falla con exit code distinto de 0 y NO deja release-manifest.json cuando pnpm pack --dry-run falla", () => {
      manifestBackup = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath) : undefined;
      const fake = installFakePnpm("echo 'simulated pack failure' >&2\nexit 1");
      try {
        const result = runNodeScript(["scripts/release-prepare.mjs"], {
          ...process.env,
          PATH: `${fake.dir}:${process.env.PATH ?? ""}`,
        });
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain("simulated pack failure");
        expect(fs.existsSync(manifestPath)).toBe(false);
      } finally {
        fake.cleanup();
      }
    });

    it("termina con exit 0 y escribe un release-manifest.json valido cuando pnpm pack --dry-run funciona", () => {
      manifestBackup = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath) : undefined;
      const fake = installFakePnpm("echo 'FAKE_PACK_DRY_RUN_OUTPUT'\nexit 0");
      try {
        const result = runNodeScript(["scripts/release-prepare.mjs"], {
          ...process.env,
          PATH: `${fake.dir}:${process.env.PATH ?? ""}`,
        });
        expect(result.exitCode).toBe(0);
        expect(fs.existsSync(manifestPath)).toBe(true);
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
          packDryRun: string;
        };
        expect(manifest.packDryRun).toContain("FAKE_PACK_DRY_RUN_OUTPUT");
      } finally {
        fake.cleanup();
      }
    });
  },
);

describe.skipIf(!heavyEnabled)("scripts/release-check.mjs: frescura de dist/stdio.js", () => {
  let distBackup: Buffer | undefined;
  let manifestBackup: Buffer | undefined;
  let distExistedBefore = false;
  let manifestExistedBefore = false;

  beforeAll(() => {
    distExistedBefore = fs.existsSync(distEntry);
    manifestExistedBefore = fs.existsSync(freshnessManifest);
    if (distExistedBefore) distBackup = fs.readFileSync(distEntry);
    if (manifestExistedBefore) manifestBackup = fs.readFileSync(freshnessManifest);
  });

  afterEach(() => {
    if (distExistedBefore && distBackup) fs.writeFileSync(distEntry, distBackup);
    if (manifestExistedBefore && manifestBackup) {
      fs.writeFileSync(freshnessManifest, manifestBackup);
    }
  });

  it.skipIf(!fs.existsSync(distEntry))(
    "rechaza (BLOCKED) cuando dist/stdio.js esta ausente",
    () => {
      fs.rmSync(distEntry);
      const result = runNodeScript(["scripts/release-check.mjs"]);
      const report = result.stdout ? (JSON.parse(result.stdout) as Record<string, unknown>) : null;
      expect(result.exitCode).not.toBe(0);
      expect(report?.status).toBe("BLOCKED");
      expect(String(report?.blockers)).toContain("dist/stdio.js");
    },
  );

  it.skipIf(!fs.existsSync(distEntry))(
    "rechaza (BLOCKED) cuando el hash de fuentes registrado no coincide (bundle desactualizado)",
    () => {
      fs.writeFileSync(
        freshnessManifest,
        `${JSON.stringify({ generatedAt: new Date().toISOString(), sourceHash: "0".repeat(64) }, null, 2)}\n`,
      );
      const result = runNodeScript(["scripts/release-check.mjs"]);
      const report = result.stdout ? (JSON.parse(result.stdout) as Record<string, unknown>) : null;
      expect(result.exitCode).not.toBe(0);
      expect(report?.status).toBe("BLOCKED");
      expect(String(report?.blockers)).toContain("desactualizado");
    },
  );

  it.skipIf(!fs.existsSync(distEntry))(
    "no reporta el bloqueo de frescura cuando dist/stdio.js esta realmente al dia",
    () => {
      const result = runNodeScript(["scripts/release-check.mjs"]);
      const report = result.stdout
        ? (JSON.parse(result.stdout) as { status?: string; blockers?: string[] })
        : null;
      const blockersText = (report?.blockers ?? []).join(" ");
      expect(blockersText).not.toContain("dist/stdio.js esta desactualizado");
    },
  );
});

describe.skipIf(!heavyEnabled)(
  "build:package: un fallo real bloquea (exit code distinto de 0)",
  () => {
    it("falla cuando el entrypoint de esbuild no existe", () => {
      breakStdioSource();
      try {
        const result = runNodeScript(["scripts/build-package.mjs"]);
        expect(result.exitCode).not.toBe(0);
      } finally {
        restoreStdioSource();
      }
    });
  },
);

describe.skipIf(!heavyEnabled)(
  "test:package-install: un fallo real bloquea (exit code distinto de 0)",
  () => {
    it("falla cuando pnpm pack no puede completarse (prepack -> build:package falla por una fuente rota)", () => {
      breakStdioSource();
      try {
        const result = runNodeScript(["scripts/package-installability-check.mjs"]);
        expect(result.exitCode).not.toBe(0);
      } finally {
        restoreStdioSource();
      }
    }, 30_000);
  },
);

describe("pipeline de package.json: sin recursion entre scripts", () => {
  it("ningun script pnpm se invoca a si mismo, directa o transitivamente", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const scriptNames = new Set(Object.keys(pkg.scripts));

    function referencedScripts(command: string): string[] {
      const matches = [...command.matchAll(/\bpnpm\s+(?:run\s+)?([a-zA-Z0-9:_-]+)/g)];
      return matches.map((m) => m[1]).filter((name) => scriptNames.has(name));
    }

    const graph = new Map<string, string[]>();
    for (const [name, command] of Object.entries(pkg.scripts)) {
      graph.set(name, referencedScripts(command));
    }

    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    for (const name of scriptNames) color.set(name, WHITE);
    const cyclePath: string[] = [];

    function visit(name: string, stack: string[]): boolean {
      color.set(name, GRAY);
      stack.push(name);
      for (const next of graph.get(name) ?? []) {
        if (color.get(next) === GRAY) {
          cyclePath.push(...stack, next);
          return true;
        }
        if (color.get(next) === WHITE && visit(next, stack)) return true;
      }
      stack.pop();
      color.set(name, BLACK);
      return false;
    }

    let hasCycle = false;
    for (const name of scriptNames) {
      if (color.get(name) === WHITE) {
        if (visit(name, [])) {
          hasCycle = true;
          break;
        }
      }
    }

    expect({ hasCycle, cyclePath }).toEqual({ hasCycle: false, cyclePath: [] });
  });

  it("test:package-install no invoca ci, release:prepare ni release:check (evita el bucle pack -> prepack -> test:package-install -> pack)", () => {
    const scriptSource = fs.readFileSync(
      path.join(root, "scripts", "package-installability-check.mjs"),
      "utf8",
    );
    expect(scriptSource).not.toMatch(/pnpm\s+(run\s+)?ci\b/);
    expect(scriptSource).not.toMatch(/pnpm\s+release:(prepare|check)\b/);
  });
});
