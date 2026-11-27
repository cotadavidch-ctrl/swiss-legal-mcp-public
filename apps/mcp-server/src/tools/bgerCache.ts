import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Cache en disco de las respuestas GET de bger.ch.
 *
 * Una sentencia publicada no cambia, y los reinicios del servicio (cada despliegue) vaciaban
 * toda la memoria: cada corpus volvia a pedir las mismas paginas al portal, que responde
 * con un reto antibots si recibe muchas peticiones. Con la cache, lo ya descargado no se
 * vuelve a pedir y sigue disponible aunque el portal este bloqueando.
 *  - Sentencias (show_document / highlight_docid): 30 dias.
 *  - Paginas de resultados de busqueda: 6 horas.
 * Solo se guardan respuestas 200 que no son un reto antibots.
 */
const DOCUMENT_TTL_MS = 30 * 24 * 3_600_000;
const SEARCH_TTL_MS = 6 * 3_600_000;
const MAX_FILES = 4_000;
const PRUNE_EVERY_N_WRITES = 50;
const PRUNE_COUNT = 400;

export interface CachedBgerResponse {
  readonly status: number;
  readonly contentType: string | null;
  readonly body: Buffer;
  readonly storedAt: number;
}

interface CacheMeta {
  readonly url: string;
  readonly storedAt: number;
  readonly status: number;
  readonly contentType: string | null;
}

let writes = 0;

export function bgerCacheDir(): string | null {
  const dir = process["env"]["SWISS_LEGAL_BGER_CACHE_DIR"];
  if (dir) return dir;
  if (process["env"]["NODE_ENV"] === "test") return null;
  return path.join(os.homedir(), ".local", "share", "swiss-legal-mcp", "bger-cache");
}

export function bgerCacheTtlMs(url: string): number {
  return /type=show_document|highlight_docid=/.test(url) ? DOCUMENT_TTL_MS : SEARCH_TTL_MS;
}

function keyFor(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

export async function readBgerCache(
  url: string,
  now: number = Date.now(),
): Promise<CachedBgerResponse | null> {
  const dir = bgerCacheDir();
  if (!dir) return null;
  const key = keyFor(url);
  try {
    const meta = JSON.parse(await fs.readFile(path.join(dir, `${key}.json`), "utf8")) as CacheMeta;
    if (meta.url !== url || now - meta.storedAt > bgerCacheTtlMs(url)) return null;
    const body = await fs.readFile(path.join(dir, `${key}.bin`));
    return { status: meta.status, contentType: meta.contentType, body, storedAt: meta.storedAt };
  } catch {
    return null;
  }
}

export async function writeBgerCache(
  url: string,
  status: number,
  contentType: string | null,
  body: Buffer,
  now: number = Date.now(),
): Promise<void> {
  const dir = bgerCacheDir();
  if (!dir || status !== 200 || body.byteLength === 0) return;
  const key = keyFor(url);
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${key}.bin`), body);
    const meta: CacheMeta = { url, storedAt: now, status, contentType };
    await fs.writeFile(path.join(dir, `${key}.json`), JSON.stringify(meta));
    writes += 1;
    if (writes % PRUNE_EVERY_N_WRITES === 0) await pruneBgerCache(dir);
  } catch {
    // la cache es una ayuda: un fallo al guardar nunca rompe la peticion
  }
}

async function pruneBgerCache(dir: string): Promise<void> {
  try {
    const metas = (await fs.readdir(dir)).filter((name) => name.endsWith(".json"));
    if (metas.length <= MAX_FILES) return;
    const withTime = await Promise.all(
      metas.map(async (name) => ({
        name,
        mtime: (await fs.stat(path.join(dir, name))).mtimeMs,
      })),
    );
    withTime.sort((a, b) => a.mtime - b.mtime);
    for (const { name } of withTime.slice(0, PRUNE_COUNT)) {
      const key = name.slice(0, -".json".length);
      await fs.rm(path.join(dir, `${key}.json`), { force: true });
      await fs.rm(path.join(dir, `${key}.bin`), { force: true });
    }
  } catch {
    // sin poda no pasa nada: se reintenta en las siguientes escrituras
  }
}
