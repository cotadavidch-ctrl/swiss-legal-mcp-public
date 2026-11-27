import { describe, expect, it, vi } from "vitest";
import type { LegislationProviderRegistry } from "@swiss-legal-mcp/core";
import { prewarmFedlexLaws } from "../src/prewarm.js";

const logger = { info: vi.fn(), debug: vi.fn() };

function registryWith(getArticle: (ref: unknown) => Promise<unknown>) {
  return {
    get: (id: string) => (id === "fedlex" ? { getArticle } : undefined),
  } as unknown as LegislationProviderRegistry;
}

describe("prewarmFedlexLaws", () => {
  it("pide el articulo 1 de cada ley, de una en una", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const calls: unknown[] = [];
    const getArticle = vi.fn(async (ref: unknown) => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      calls.push(ref);
      await new Promise((resolve) => setTimeout(resolve, 2));
      concurrent -= 1;
      return {};
    });
    const result = await prewarmFedlexLaws(registryWith(getArticle), logger, undefined, [
      "OR",
      "ZPO",
      "BV",
    ]);
    expect(result).toEqual({ attempted: 3, loaded: 3, failed: [] });
    expect(maxConcurrent).toBe(1);
    expect(calls[0]).toMatchObject({ articleNumber: "1" });
  });

  it("un fallo no impide precargar las demas leyes y no lanza", async () => {
    let n = 0;
    const getArticle = vi.fn(async () => {
      n += 1;
      if (n === 2) throw new Error("Fedlex no responde");
      return {};
    });
    const result = await prewarmFedlexLaws(registryWith(getArticle), logger, undefined, [
      "OR",
      "ZPO",
      "BV",
    ]);
    expect(result).toEqual({ attempted: 3, loaded: 2, failed: ["ZPO"] });
  });

  it("se detiene si la señal se cancela", async () => {
    const controller = new AbortController();
    const getArticle = vi.fn(async () => {
      controller.abort();
      return {};
    });
    const result = await prewarmFedlexLaws(registryWith(getArticle), logger, controller.signal, [
      "OR",
      "ZPO",
      "BV",
    ]);
    expect(result.attempted).toBe(1);
  });

  it("sin proveedor Fedlex no hace nada", async () => {
    const registry = { get: () => undefined } as unknown as LegislationProviderRegistry;
    expect(await prewarmFedlexLaws(registry, logger)).toEqual({
      attempted: 0,
      loaded: 0,
      failed: [],
    });
  });
});
