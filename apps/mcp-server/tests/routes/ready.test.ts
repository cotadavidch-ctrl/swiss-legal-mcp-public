import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { ProviderRegistry, type LegalSourceProvider } from "@swiss-legal-mcp/core";
import { readyHandler } from "../../src/routes/ready.js";

function fakeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function makeProvider(healthy: boolean): LegalSourceProvider {
  return {
    id: "fake",
    async search() {
      return [];
    },
    async getDocument() {
      throw new Error("no implementado");
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

describe("readyHandler", () => {
  it("responde 200 sin proveedores registrados", async () => {
    const providers = new ProviderRegistry();
    const res = fakeRes();
    await readyHandler(providers)({} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("responde 200 cuando todos los proveedores registrados estan sanos", async () => {
    const providers = new ProviderRegistry();
    providers.register(
      {
        id: "fake",
        provider: makeProvider(true),
        officialCharacter: "official",
        capabilities: [],
        languages: [],
        jurisdictions: [],
        enabledInEnv: ["test"],
      },
      "test",
    );
    const res = fakeRes();
    await readyHandler(providers)({} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("responde 503 cuando un proveedor registrado no esta sano", async () => {
    const providers = new ProviderRegistry();
    providers.register(
      {
        id: "fake",
        provider: makeProvider(false),
        officialCharacter: "official",
        capabilities: [],
        languages: [],
        jurisdictions: [],
        enabledInEnv: ["test"],
      },
      "test",
    );
    const res = fakeRes();
    await readyHandler(providers)({} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
