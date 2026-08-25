import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ProviderUnavailableError } from "@swiss-legal-mcp/core";
import { ShabProvider } from "./shabProvider.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/shab",
);

describe("ShabProvider (bloqueado por robots.txt, sin peticiones de red reales)", () => {
  it("nunca llama a fetch: search/getDocument/getMetadata/getSourceAttribution lanzan de inmediato", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const provider = new ShabProvider();

    await expect(provider.search({ text: "x" })).rejects.toThrow(ProviderUnavailableError);
    await expect(provider.getDocument("shab:x")).rejects.toThrow(ProviderUnavailableError);
    await expect(provider.getMetadata("shab:x")).rejects.toThrow(ProviderUnavailableError);
    expect(() => provider.getSourceAttribution("shab:x")).toThrow(ProviderUnavailableError);

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("healthCheck() siempre reporta unhealthy con el motivo del bloqueo, sin llamar a fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const provider = new ShabProvider();

    const health = await provider.healthCheck();
    expect(health.healthy).toBe(false);
    expect(health.message).toContain("robots.txt");
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("normalize() SI funciona (no requiere red) y valida contra un objeto real capturado", () => {
    const raw: { content: unknown[] } = JSON.parse(
      readFileSync(path.join(fixturesDir, "publications_hr_sample.json"), "utf8"),
    );
    const provider = new ShabProvider();
    const doc = provider.normalize(raw.content[0]);
    expect(doc.documentType).toBe("shab_entry");
    expect(doc.shabPublication?.rubric).toBe("HR");
  });

  it("normalize() rechaza un objeto que no cumple el esquema real observado", () => {
    const provider = new ShabProvider();
    expect(() => provider.normalize({ meta: { foo: "bar" } })).toThrow();
  });
});
