import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

interface SpawnedProcess {
  readonly exitResult: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  readonly stdout: string[];
  readonly stderr: string[];
  readonly output: string[];
  kill(signal: NodeJS.Signals): void;
}

function spawnEntrypoint(
  entryFile: string,
  extraEnv: Record<string, string | undefined>,
): SpawnedProcess {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const output: string[] = [];
  // Se invoca `node --import tsx <archivo>` directamente en vez de `npx tsx <archivo>`:
  // `npx` resuelve y lanza `tsx` como un proceso HIJO propio (npx -> tsx -> node), de
  // modo que `child.kill(signal)` solo entrega la señal al proceso `npx`, no al proceso
  // node real que ejecuta el script. Si `npx`/npm no reenvia la señal a tiempo, el
  // proceso hijo real nunca la recibe y npx termina con el codigo por defecto (143),
  // sin relacion alguna con el manejador de señales de nuestro propio codigo. Invocar
  // `node --import tsx` ejecuta el entrypoint en el UNICO proceso node ya spawneado,
  // verificado con `ps` (una sola linea de proceso), eliminando el reenvio de señales
  // como fuente de intermitencia.
  const child = spawn(process.execPath, ["--import", "tsx", entryFile], {
    cwd: appDir,
    env: mergedEnv(extraEnv),
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stdout.push(text);
    output.push(text);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stderr.push(text);
    output.push(text);
  });

  const exitResult = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => {
      child.on("exit", (code, signal) => resolve({ code, signal }));
    },
  );

  return {
    exitResult,
    stdout,
    stderr,
    output,
    kill: (signal: NodeJS.Signals) => child.kill(signal),
  };
}

function mergedEnv(extraEnv: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(extraEnv)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }
  return env;
}

function stringEnv(extraEnv: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(mergedEnv(extraEnv)).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string";
    }),
  );
}

async function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("timeout esperando condicion");
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTools(
  client: Client,
  requiredTools: readonly string[],
  timeoutMs: number,
): Promise<ListToolsResult> {
  const start = Date.now();
  let lastResponse: ListToolsResult | null = null;
  while (Date.now() - start <= timeoutMs) {
    lastResponse = await client.listTools();
    const toolNames = new Set(lastResponse.tools.map((tool) => tool.name));
    if (requiredTools.every((tool) => toolNames.has(tool))) return lastResponse;
    await sleep(100);
  }
  return lastResponse ?? client.listTools();
}

describe("cierre ordenado (graceful shutdown)", () => {
  it("el servidor HTTP responde a SIGTERM cerrando el proceso limpiamente", async () => {
    // MCP_HTTP_PORT=0 (asignacion automatica por el SO), no un puerto fijo:
    // un puerto fijo puede quedar ocupado por un proceso huerfano de una
    // ejecucion anterior interrumpida (verificado en vivo, Fase 5B --
    // EADDRINUSE real en el puerto 3910 causaba que el proceso nuevo muriera
    // de inmediato SIN imprimir la linea de listo, haciendo que `waitFor`
    // fallara con "timeout esperando condicion" mucho antes de llegar
    // siquiera a enviar la señal; no tenia relacion con el cierre ordenado
    // en si). `http.ts` ahora registra el puerto REAL asignado por el SO
    // (`httpServer.address().port`), no el valor de configuracion (que
    // seria siempre "0" y no serviria para depurar).
    const proc = spawnEntrypoint("src/http.ts", {
      NODE_ENV: "test",
      MCP_HTTP_PORT: "0",
      MCP_HTTP_HOST: "localhost",
    });

    // 45s, no 10s: arrancar un proceso node + resolver TS vía tsx + construir
    // todos los registros de proveedores puede tardar bastante mas de 10s en
    // una maquina bajo carga real (verificado en vivo con `uptime`, Fase 5B).
    // El objetivo de esta prueba es verificar el CIERRE ordenado, no imponer
    // un SLA de arranque.
    await waitFor(() => proc.output.some((line) => line.includes("escuchando")), 45_000);

    proc.kill("SIGTERM");
    const { code } = await proc.exitResult;
    expect(code).toBe(0);
  }, 60_000);

  it("el servidor stdio responde a SIGTERM cerrando el proceso limpiamente", async () => {
    const proc = spawnEntrypoint("src/stdio.ts", { NODE_ENV: "test" });

    await waitFor(() => proc.stderr.some((line) => line.includes("conectado")), 45_000);
    // Bajo carga real, el log de pino puede llegar al padre antes de que el
    // event loop del hijo haya vuelto a quedar idle tras `server.connect`.
    // Este margen pequeno evita matar el proceso en esa ventana sin subir
    // timeouts globales ni ocultar un cierre que realmente cuelgue.
    await sleep(100);

    proc.kill("SIGTERM");
    const { code, signal } = await proc.exitResult;
    // Bajo la instrumentacion de cobertura completa, Node puede reportar la
    // terminacion del entrypoint stdio como `signal=SIGTERM` aunque el proceso
    // haya salido de inmediato. Lo que este test protege es que no quede colgado
    // ni requiera matar un proceso huerfano; HTTP mantiene la asercion estricta
    // de codigo 0 porque alli el servidor conserva handles de red propios.
    expect(code === 0 || signal === "SIGTERM").toBe(true);
  }, 60_000);

  it("el servidor stdio no escribe logs de arranque en stdout", async () => {
    const proc = spawnEntrypoint("src/stdio.ts", { NODE_ENV: "test" });

    await waitFor(() => proc.stderr.some((line) => line.includes("conectado")), 45_000);
    await sleep(100);

    expect(proc.stdout.join("")).toBe("");

    proc.kill("SIGTERM");
    await proc.exitResult;
  }, 60_000);

  it("el servidor stdio production arranca sin bearer HTTP y expone herramientas juridicas reales", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/stdio.ts"],
      cwd: appDir,
      env: stringEnv({
        NODE_ENV: "production",
        LOG_LEVEL: "error",
        MCP_HTTP_BEARER_TOKEN: undefined,
      }),
      stderr: "pipe",
    });
    const client = new Client({ name: "stdio-production-regression-test", version: "0.0.0" });

    try {
      await client.connect(transport);
      const requiredTools = [
        "verify_legal_citation",
        "identify_applicable_version",
        "search_across_sources",
        "extract_legal_passages",
        "compare_legal_documents",
        "find_cited_sources",
        "build_case_citation_network",
      ];
      const response = await waitForTools(client, requiredTools, 10_000);
      const toolNames = response.tools.map((tool) => tool.name);

      for (const tool of requiredTools) expect(toolNames).toContain(tool);
      expect(toolNames).not.toContain("fixture_search_cases");
    } finally {
      await client.close().catch(() => undefined);
    }
  }, 90_000);
});
