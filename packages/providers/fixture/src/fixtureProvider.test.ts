import { describe, expect, it } from "vitest";
import { NotFoundError } from "@swiss-legal-mcp/core";
import { FixtureNotAllowedError, FixtureProvider } from "./fixtureProvider.js";

describe("FixtureProvider", () => {
  it("se niega a instanciarse fuera de NODE_ENV=test", () => {
    expect(() => new FixtureProvider("production")).toThrow(FixtureNotAllowedError);
    expect(() => new FixtureProvider("development")).toThrow(FixtureNotAllowedError);
  });

  it("se instancia correctamente en entorno test", () => {
    expect(() => new FixtureProvider("test")).not.toThrow();
  });

  it("search() encuentra documentos por titulo", async () => {
    const provider = new FixtureProvider("test");
    const results = await provider.search({ text: "cantonal" });
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("fixture:case-2");
  });

  it("getDocument() devuelve el documento normalizado completo", async () => {
    const provider = new FixtureProvider("test");
    const doc = await provider.getDocument("fixture:case-1");
    expect(doc.title).toContain("Fixture");
    expect(doc.provenance.officialCharacter).toBe("unofficial_aggregator");
    expect(doc.provenance.aggregatorName).toBe("fixture-test-provider");
  });

  it("getDocument() lanza NotFoundError para un id inexistente", async () => {
    const provider = new FixtureProvider("test");
    await expect(provider.getDocument("fixture:no-existe")).rejects.toThrow(NotFoundError);
  });

  it("getSourceAttribution() expone el caracter no oficial del proveedor de prueba", () => {
    const provider = new FixtureProvider("test");
    const attribution = provider.getSourceAttribution("fixture:case-1");
    expect(attribution.officialCharacter).toBe("unofficial_aggregator");
    expect(attribution.aggregatorName).toBe("fixture-test-provider");
  });

  it("healthCheck() siempre reporta healthy", async () => {
    const provider = new FixtureProvider("test");
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });
});
