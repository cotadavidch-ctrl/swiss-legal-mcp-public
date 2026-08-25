import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkpointExists,
  deleteCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
} from "./checkpointStore.js";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "swiss-legal-mcp-checkpoint-test-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("checkpointStore", () => {
  it("devuelve null si no existe checkpoint previo", () => {
    expect(loadCheckpoint("missing-run", { directory: dir })).toBeNull();
    expect(checkpointExists("missing-run", { directory: dir })).toBe(false);
  });

  it("guarda y recupera el estado exacto", () => {
    const state = { page: 3, processedIds: ["a", "b", "c"] };
    saveCheckpoint("run-1", state, "in_progress", { directory: dir });
    const loaded = loadCheckpoint<typeof state>("run-1", { directory: dir });
    expect(loaded).not.toBeNull();
    expect(loaded?.state).toEqual(state);
    expect(loaded?.status).toBe("in_progress");
    expect(loaded?.schema_version).toBe(1);
  });

  it("conserva created_at entre actualizaciones sucesivas y actualiza updated_at", async () => {
    saveCheckpoint("run-2", { step: 1 }, "in_progress", { directory: dir });
    const first = loadCheckpoint<{ step: number }>("run-2", { directory: dir });
    await new Promise((resolve) => setTimeout(resolve, 5));
    saveCheckpoint("run-2", { step: 2 }, "in_progress", { directory: dir });
    const second = loadCheckpoint<{ step: number }>("run-2", { directory: dir });
    expect(second?.created_at).toBe(first?.created_at);
    expect(second?.state).toEqual({ step: 2 });
  });

  it("permite marcar completed y luego borrar tras finalizacion correcta", () => {
    saveCheckpoint("run-3", { done: true }, "completed", { directory: dir });
    expect(checkpointExists("run-3", { directory: dir })).toBe(true);
    deleteCheckpoint("run-3", { directory: dir });
    expect(checkpointExists("run-3", { directory: dir })).toBe(false);
  });

  it("borrar un checkpoint inexistente no lanza", () => {
    expect(() => deleteCheckpoint("never-existed", { directory: dir })).not.toThrow();
  });

  it("sanea run_id con caracteres no seguros para nombre de fichero", () => {
    const record = saveCheckpoint("run/with:weird*chars?", { x: 1 }, "in_progress", {
      directory: dir,
    });
    expect(record.run_id).toBe("run/with:weird*chars?");
    const loaded = loadCheckpoint("run/with:weird*chars?", { directory: dir });
    expect(loaded?.state).toEqual({ x: 1 });
  });

  it("ignora un fichero de checkpoint con version de esquema incompatible", () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "old-run.json"),
      JSON.stringify({ schema_version: 999, run_id: "old-run", state: {} }),
      "utf8",
    );
    expect(loadCheckpoint("old-run", { directory: dir })).toBeNull();
  });

  it("resuelve el directorio por defecto sin lanzar cuando no hay opciones", () => {
    expect(() => loadCheckpoint("anything-default-dir")).not.toThrow();
  });
});
