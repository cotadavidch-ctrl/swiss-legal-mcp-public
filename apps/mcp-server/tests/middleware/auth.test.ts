import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { loadEnv } from "@swiss-legal-mcp/shared";
import { bearerAuth } from "../../src/middleware/auth.js";

function fakeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe("bearerAuth", () => {
  it("deja pasar sin token en NODE_ENV=test", () => {
    const settings = loadEnv({ NODE_ENV: "test" });
    const middleware = bearerAuth(settings);
    const next = vi.fn();
    middleware({ headers: {} } as unknown as Request, fakeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("rechaza con 401 si falta Authorization fuera de test", () => {
    const settings = loadEnv({ NODE_ENV: "production", MCP_HTTP_BEARER_TOKEN: "secret" });
    const middleware = bearerAuth(settings);
    const res = fakeRes();
    const next = vi.fn();
    middleware({ headers: {} } as unknown as Request, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rechaza con 401 si el token no coincide", () => {
    const settings = loadEnv({ NODE_ENV: "production", MCP_HTTP_BEARER_TOKEN: "secret" });
    const middleware = bearerAuth(settings);
    const res = fakeRes();
    const next = vi.fn();
    middleware(
      { headers: { authorization: "Bearer incorrecto" } } as unknown as Request,
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("deja pasar si el token coincide exactamente", () => {
    const settings = loadEnv({ NODE_ENV: "production", MCP_HTTP_BEARER_TOKEN: "secret" });
    const middleware = bearerAuth(settings);
    const next = vi.fn();
    middleware(
      { headers: { authorization: "Bearer secret" } } as unknown as Request,
      fakeRes(),
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
