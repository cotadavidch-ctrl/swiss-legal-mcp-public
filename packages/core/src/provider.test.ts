import { describe, expect, it } from "vitest";
import { ProviderRegistry, type LegalSourceProvider } from "./provider.js";

function makeFakeProvider(healthy: boolean): LegalSourceProvider {
  return {
    id: "fake",
    async search() {
      return [];
    },
    async getDocument() {
      throw new Error("not implemented in fake provider");
    },
    async getMetadata() {
      return {};
    },
    async healthCheck() {
      return { healthy, checkedAt: new Date().toISOString() };
    },
    normalize(raw: unknown) {
      return raw as never;
    },
    getSourceAttribution() {
      return {
        sourceUrl: "https://example.test",
        retrievedAt: new Date().toISOString(),
        officialCharacter: "official",
      };
    },
  };
}

describe("ProviderRegistry", () => {
  it("marca un proveedor como 'disabled' si el entorno actual no esta en enabledInEnv", () => {
    const registry = new ProviderRegistry();
    registry.register(
      {
        id: "fake",
        provider: makeFakeProvider(true),
        officialCharacter: "official",
        capabilities: ["search"],
        languages: ["de"],
        jurisdictions: ["federal"],
        enabledInEnv: ["test"],
      },
      "production",
    );
    expect(registry.info("fake")?.status).toBe("disabled");
    expect(registry.get("fake")).toBeUndefined();
  });

  it("healthCheck marca 'healthy' cuando el proveedor responde ok", async () => {
    const registry = new ProviderRegistry();
    registry.register(
      {
        id: "fake",
        provider: makeFakeProvider(true),
        officialCharacter: "official",
        capabilities: ["search"],
        languages: ["de"],
        jurisdictions: ["federal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    const info = await registry.checkHealth("fake");
    expect(info.status).toBe("healthy");
    expect(registry.isAvailable("fake")).toBe(true);
  });

  it("healthCheck marca 'unhealthy' cuando el proveedor reporta fallo", async () => {
    const registry = new ProviderRegistry();
    registry.register(
      {
        id: "fake",
        provider: makeFakeProvider(false),
        officialCharacter: "unofficial_aggregator",
        aggregatorName: "test-aggregator",
        capabilities: ["search"],
        languages: ["fr"],
        jurisdictions: ["federal", "cantonal"],
        enabledInEnv: ["test"],
      },
      "test",
    );
    const info = await registry.checkHealth("fake");
    expect(info.status).toBe("unhealthy");
    expect(registry.isAvailable("fake")).toBe(false);
  });

  it("healthCheck marca 'unhealthy' cuando el proveedor lanza una excepcion", async () => {
    const registry = new ProviderRegistry();
    const throwingProvider = makeFakeProvider(true);
    throwingProvider.healthCheck = async () => {
      throw new Error("boom");
    };
    registry.register(
      {
        id: "fake",
        provider: throwingProvider,
        officialCharacter: "official",
        capabilities: [],
        languages: [],
        jurisdictions: [],
        enabledInEnv: ["test"],
      },
      "test",
    );
    const info = await registry.checkHealth("fake");
    expect(info.status).toBe("unhealthy");
    expect(info.lastCheckMessage).toContain("boom");
  });

  it("rechaza registrar dos veces el mismo id", () => {
    const registry = new ProviderRegistry();
    const registration = {
      id: "fake",
      provider: makeFakeProvider(true),
      officialCharacter: "official" as const,
      capabilities: [],
      languages: [],
      jurisdictions: [],
      enabledInEnv: ["test"],
    };
    registry.register(registration, "test");
    expect(() => registry.register(registration, "test")).toThrow();
  });
});
