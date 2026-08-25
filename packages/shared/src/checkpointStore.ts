import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Servicio generico de checkpoint/reanudacion para procesos largos (paginacion
 * masiva, resolucion por lotes, exportacion de corpus, etc.). No es especifico
 * de ningun dominio juridico ni de ningun reto: cualquier flujo del producto
 * que necesite sobrevivir a un reinicio o a un fallo parcial puede usarlo.
 *
 * Persistencia atomica en disco (escritura a fichero temporal + rename) bajo
 * un directorio configurable, con el mismo patron de resolucion de directorio
 * ya usado por el cache de casos oficiales
 * (`apps/mcp-server/src/tools/officialSwissCaseResolver.ts#resolveOfficialCaseStorePath`):
 * variable de entorno explicita primero, despues un subdirectorio del cache
 * general, despues `os.tmpdir()` como ultimo recurso.
 */

const CHECKPOINT_SCHEMA_VERSION = 1;

export type CheckpointStatus = "in_progress" | "completed" | "failed";

export interface CheckpointRecord<TState = unknown> {
  readonly schema_version: number;
  readonly run_id: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly status: CheckpointStatus;
  readonly state: TState;
}

export interface CheckpointStoreOptions {
  /** Directorio explicito; tiene prioridad sobre las variables de entorno. */
  readonly directory?: string;
  readonly env?: NodeJS.ProcessEnv;
}

function resolveCheckpointDirectory(options: CheckpointStoreOptions = {}): string {
  if (options.directory) return options.directory;
  const env = options.env ?? process.env;
  const explicit = env["SWISS_LEGAL_CHECKPOINT_DIR"];
  if (explicit) return explicit;
  const cacheDir = env["SWISS_LEGAL_CACHE_DIR"];
  if (cacheDir) return path.join(cacheDir, "checkpoints");
  return path.join(os.tmpdir(), "swiss-legal-mcp-checkpoints");
}

function sanitizeRunId(runId: string): string {
  const safe = runId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 200);
  if (safe.length === 0) throw new Error("checkpoint_run_id_empty_after_sanitization");
  return safe;
}

function checkpointFilePath(runId: string, options: CheckpointStoreOptions = {}): string {
  return path.join(resolveCheckpointDirectory(options), `${sanitizeRunId(runId)}.json`);
}

/**
 * Guarda (o actualiza) el checkpoint de una ejecucion. Escritura atomica:
 * nunca deja un fichero a medio escribir si el proceso se interrumpe.
 * Conserva `created_at` de un checkpoint previo con el mismo `run_id` si
 * existe.
 */
export function saveCheckpoint<TState>(
  runId: string,
  state: TState,
  status: CheckpointStatus = "in_progress",
  options: CheckpointStoreOptions = {},
): CheckpointRecord<TState> {
  const directory = resolveCheckpointDirectory(options);
  fs.mkdirSync(directory, { recursive: true });
  const filePath = checkpointFilePath(runId, options);
  const existing = loadCheckpoint<TState>(runId, options);
  const record: CheckpointRecord<TState> = {
    schema_version: CHECKPOINT_SCHEMA_VERSION,
    run_id: runId,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status,
    state,
  };
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(record, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
  return record;
}

/** Devuelve `null` si no existe checkpoint o si su version de esquema no coincide. */
export function loadCheckpoint<TState>(
  runId: string,
  options: CheckpointStoreOptions = {},
): CheckpointRecord<TState> | null {
  const filePath = checkpointFilePath(runId, options);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as { schema_version?: unknown }).schema_version !== CHECKPOINT_SCHEMA_VERSION
    ) {
      return null;
    }
    return parsed as CheckpointRecord<TState>;
  } catch {
    return null;
  }
}

export function checkpointExists(runId: string, options: CheckpointStoreOptions = {}): boolean {
  return loadCheckpoint(runId, options) !== null;
}

/**
 * Elimina el checkpoint. Debe llamarse unicamente tras una finalizacion
 * correcta del proceso que lo genero -- nunca tras un fallo parcial, para que
 * una reanudacion posterior siga siendo posible.
 */
export function deleteCheckpoint(runId: string, options: CheckpointStoreOptions = {}): void {
  const filePath = checkpointFilePath(runId, options);
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // Best-effort: un fallo al borrar no debe interrumpir al llamador.
  }
}
