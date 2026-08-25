import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createLogger } from "@swiss-legal-mcp/shared";
import { ProviderRegistry, type HealthStatus, type LegalSourceProvider } from "./provider.js";
import { ToolRegistry } from "./toolRegistry.js";
import {
  ProviderUnavailableByPolicyError,
  ToolDisabledError,
  ToolValidationError,
} from "./errors.js";

const logger = createLogger({ level: "silent" });

function makeFakeProvider(healthy: boolean, id = "fake"): LegalSourceProvider {
  return {
    id,
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

/** Como makeFakeProvider, pero el healthCheck reporta un bloqueo permanente por politica (p.ej. robots.txt), no una caida transitoria -- ver ShabProvider. */
function makePolicyBlockedProvider(id = "fake-policy"): LegalSourceProvider {
  return {
    id,
    async search() {
      throw new Error("no deberia llamarse: proveedor bloqueado por politica");
    },
    async getDocument() {
      throw new Error("no deberia llamarse: proveedor bloqueado por politica");
    },
    async getMetadata() {
      throw new Error("no deberia llamarse: proveedor bloqueado por politica");
    },
    async healthCheck(): Promise<HealthStatus> {
      return {
        healthy: false,
        checkedAt: new Date().toISOString(),
        unavailableByPolicy: { reason: "robots_txt_disallow" },
      };
    },
    normalize(raw: unknown) {
      return raw as never;
    },
    getSourceAttribution() {
      throw new Error("no deberia llamarse: proveedor bloqueado por politica");
    },
  };
}

describe("ToolRegistry", () => {
  it("una herramienta sin proveedor registrado queda 'pending'", () => {
    const providers = new ProviderRegistry();
    const tools = new ToolRegistry(providers);
    tools.register({
      name: "demo_tool",
      description: "herramienta de prueba",
      inputSchema: {},
      requiredProviderIds: ["fake"],
      handler: async () => ({ ok: true }),
    });
    const info = tools.list().find((t) => t.name === "demo_tool");
    expect(info?.status).toBe("pending");
    expect(tools.isActive("demo_tool")).toBe(false);
  });

  it("una herramienta cuyo proveedor esta 'unhealthy' queda 'blocked' y call() lanza ToolDisabledError", async () => {
    const providers = new ProviderRegistry();
    providers.register(
      {
        id: "fake",
        provider: makeFakeProvider(false),
        officialCharacter: "official",
        capabilities: [],
        languages: [],
        jurisdictions: [],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth("fake");

    const tools = new ToolRegistry(providers);
    tools.register({
      name: "demo_tool",
      description: "herramienta de prueba",
      inputSchema: {},
      requiredProviderIds: ["fake"],
      handler: async () => ({ ok: true }),
    });

    expect(tools.isActive("demo_tool")).toBe(false);
    await expect(
      tools.call("demo_tool", {}, { providers, correlationId: "test", logger }),
    ).rejects.toThrow(ToolDisabledError);
  });

  it("una herramienta activa ejecuta su handler con la entrada validada", async () => {
    const providers = new ProviderRegistry();
    providers.register(
      {
        id: "fake",
        provider: makeFakeProvider(true),
        officialCharacter: "official",
        capabilities: [],
        languages: [],
        jurisdictions: [],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth("fake");

    const tools = new ToolRegistry(providers);
    tools.register({
      name: "demo_tool",
      description: "herramienta de prueba",
      inputSchema: { query: z.string().min(1) },
      requiredProviderIds: ["fake"],
      handler: async (input) => ({ echoed: input.query }),
    });

    expect(tools.isActive("demo_tool")).toBe(true);
    const result = await tools.call(
      "demo_tool",
      { query: "OR Art. 41" },
      { providers, correlationId: "test", logger },
    );
    expect(result).toEqual({ echoed: "OR Art. 41" });
  });

  it("rechaza entrada invalida con ToolValidationError sin llegar a llamar al handler", async () => {
    const providers = new ProviderRegistry();
    providers.register(
      {
        id: "fake",
        provider: makeFakeProvider(true),
        officialCharacter: "official",
        capabilities: [],
        languages: [],
        jurisdictions: [],
        enabledInEnv: ["test"],
      },
      "test",
    );
    await providers.checkHealth("fake");

    const tools = new ToolRegistry(providers);
    let handlerCalled = false;
    tools.register({
      name: "demo_tool",
      description: "herramienta de prueba",
      inputSchema: { query: z.string().min(1) },
      requiredProviderIds: ["fake"],
      handler: async () => {
        handlerCalled = true;
        return { ok: true };
      },
    });

    await expect(
      tools.call("demo_tool", { query: "" }, { providers, correlationId: "test", logger }),
    ).rejects.toThrow(ToolValidationError);
    expect(handlerCalled).toBe(false);
  });

  it("una herramienta sin proveedores requeridos esta siempre activa", () => {
    const providers = new ProviderRegistry();
    const tools = new ToolRegistry(providers);
    tools.register({
      name: "no_provider_tool",
      description: "no depende de ningun proveedor",
      inputSchema: {},
      requiredProviderIds: [],
      handler: async () => ({ ok: true }),
    });
    expect(tools.isActive("no_provider_tool")).toBe(true);
  });

  it("call() de una herramienta inexistente lanza ToolDisabledError", async () => {
    const providers = new ProviderRegistry();
    const tools = new ToolRegistry(providers);
    await expect(
      tools.call("no_existe", {}, { providers, correlationId: "test", logger }),
    ).rejects.toThrow(ToolDisabledError);
  });

  describe("requireAnyProviderIds (activacion canton-aware)", () => {
    it("queda 'pending' si ninguno de los proveedores alternativos esta registrado", () => {
      const providers = new ProviderRegistry();
      const tools = new ToolRegistry(providers);
      tools.register({
        name: "multi_tool",
        description: "requiere al menos uno de varios proveedores",
        inputSchema: {},
        requiredProviderIds: [],
        requireAnyProviderIds: ["fake-a", "fake-b"],
        handler: async () => ({ ok: true }),
      });
      const info = tools.list().find((t) => t.name === "multi_tool");
      expect(info?.status).toBe("pending");
      expect(tools.isActive("multi_tool")).toBe(false);
    });

    it("queda 'blocked' si estan registrados pero ninguno esta healthy", async () => {
      const providers = new ProviderRegistry();
      providers.register(
        {
          id: "fake-a",
          provider: makeFakeProvider(false, "fake-a"),
          officialCharacter: "official",
          capabilities: [],
          languages: [],
          jurisdictions: [],
          enabledInEnv: ["test"],
        },
        "test",
      );
      await providers.checkHealth("fake-a");

      const tools = new ToolRegistry(providers);
      tools.register({
        name: "multi_tool",
        description: "requiere al menos uno de varios proveedores",
        inputSchema: {},
        requiredProviderIds: [],
        requireAnyProviderIds: ["fake-a", "fake-b"],
        handler: async () => ({ ok: true }),
      });
      expect(tools.isActive("multi_tool")).toBe(false);
      expect(tools.list().find((t) => t.name === "multi_tool")?.status).toBe("blocked");
    });

    it("queda 'active' si al menos uno de los proveedores alternativos esta healthy", async () => {
      const providers = new ProviderRegistry();
      providers.register(
        {
          id: "fake-a",
          provider: makeFakeProvider(false, "fake-a"),
          officialCharacter: "official",
          capabilities: [],
          languages: [],
          jurisdictions: [],
          enabledInEnv: ["test"],
        },
        "test",
      );
      providers.register(
        {
          id: "fake-b",
          provider: makeFakeProvider(true, "fake-b"),
          officialCharacter: "official",
          capabilities: [],
          languages: [],
          jurisdictions: [],
          enabledInEnv: ["test"],
        },
        "test",
      );
      await providers.checkAllHealth();

      const tools = new ToolRegistry(providers);
      tools.register({
        name: "multi_tool",
        description: "requiere al menos uno de varios proveedores",
        inputSchema: {},
        requiredProviderIds: [],
        requireAnyProviderIds: ["fake-a", "fake-b"],
        handler: async () => ({ ok: true }),
      });
      expect(tools.isActive("multi_tool")).toBe(true);
    });
  });

  describe("proveedores bloqueados por politica (blockedByPolicy)", () => {
    it("list() marca la herramienta como 'blocked' con blockedByPolicy cuando el proveedor esta unavailableByPolicy", async () => {
      const providers = new ProviderRegistry();
      providers.register(
        {
          id: "fake-policy",
          provider: makePolicyBlockedProvider(),
          officialCharacter: "official",
          capabilities: [],
          languages: [],
          jurisdictions: [],
          enabledInEnv: ["test"],
        },
        "test",
      );
      await providers.checkHealth("fake-policy");

      const tools = new ToolRegistry(providers);
      tools.register({
        name: "policy_tool",
        description: "herramienta bloqueada por politica",
        inputSchema: {},
        requiredProviderIds: ["fake-policy"],
        handler: async () => ({ ok: true }),
      });

      const info = tools.list().find((t) => t.name === "policy_tool");
      expect(info?.status).toBe("blocked");
      expect(info?.blockedByPolicy).toEqual({
        providerId: "fake-policy",
        reason: "robots_txt_disallow",
      });
    });

    it("call() lanza ProviderUnavailableByPolicyError (no ToolDisabledError) y nunca invoca el handler", async () => {
      const providers = new ProviderRegistry();
      providers.register(
        {
          id: "fake-policy",
          provider: makePolicyBlockedProvider(),
          officialCharacter: "official",
          capabilities: [],
          languages: [],
          jurisdictions: [],
          enabledInEnv: ["test"],
        },
        "test",
      );
      await providers.checkHealth("fake-policy");

      const tools = new ToolRegistry(providers);
      let handlerCalled = false;
      tools.register({
        name: "policy_tool",
        description: "herramienta bloqueada por politica",
        inputSchema: {},
        requiredProviderIds: ["fake-policy"],
        handler: async () => {
          handlerCalled = true;
          return { ok: true };
        },
      });

      const error = await tools
        .call("policy_tool", {}, { providers, correlationId: "test", logger })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderUnavailableByPolicyError);
      const policyError = error as ProviderUnavailableByPolicyError;
      expect(policyError.providerId).toBe("fake-policy");
      expect(policyError.reason).toBe("robots_txt_disallow");
      expect(policyError.retryable).toBe(false);
      expect(policyError.details).toEqual({
        reason: "robots_txt_disallow",
        networkRequestPerformed: false,
      });
      expect(handlerCalled).toBe(false);
    });

    it("isActive() sigue devolviendo false para una herramienta bloqueada por politica (nunca se falsea como activa)", async () => {
      const providers = new ProviderRegistry();
      providers.register(
        {
          id: "fake-policy",
          provider: makePolicyBlockedProvider(),
          officialCharacter: "official",
          capabilities: [],
          languages: [],
          jurisdictions: [],
          enabledInEnv: ["test"],
        },
        "test",
      );
      await providers.checkHealth("fake-policy");

      const tools = new ToolRegistry(providers);
      tools.register({
        name: "policy_tool",
        description: "herramienta bloqueada por politica",
        inputSchema: {},
        requiredProviderIds: ["fake-policy"],
        handler: async () => ({ ok: true }),
      });
      expect(tools.isActive("policy_tool")).toBe(false);
    });
  });
});
