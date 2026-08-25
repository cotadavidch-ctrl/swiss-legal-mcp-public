import { describe, expect, it } from "vitest";
import { InvalidEnvironmentError, loadEnv, loadHttpEnv, loadStdioEnv } from "./env.js";

describe("loadEnv", () => {
  it("aplica defaults razonables en entorno test sin exigir bearer token", () => {
    const env = loadEnv({ NODE_ENV: "test" });
    expect(env.NODE_ENV).toBe("test");
    expect(env.MCP_HTTP_PORT).toBe(3000);
    expect(env.MCP_HTTP_BEARER_TOKEN).toBeUndefined();
  });

  it("exige MCP_HTTP_BEARER_TOKEN fuera de entorno test", () => {
    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(InvalidEnvironmentError);
  });

  it("loadHttpEnv exige MCP_HTTP_BEARER_TOKEN en production", () => {
    expect(() => loadHttpEnv({ NODE_ENV: "production" })).toThrow(InvalidEnvironmentError);
  });

  it("loadStdioEnv no exige MCP_HTTP_BEARER_TOKEN en production", () => {
    const env = loadStdioEnv({ NODE_ENV: "production" });
    expect(env.NODE_ENV).toBe("production");
    expect(env.MCP_HTTP_BEARER_TOKEN).toBeUndefined();
  });

  it("acepta configuracion completa en production", () => {
    const env = loadHttpEnv({
      NODE_ENV: "production",
      MCP_HTTP_BEARER_TOKEN: "a-real-token",
      MCP_HTTP_PORT: "8080",
    });
    expect(env.MCP_HTTP_BEARER_TOKEN).toBe("a-real-token");
    expect(env.MCP_HTTP_PORT).toBe(8080);
  });

  it("rechaza NODE_ENV invalido", () => {
    expect(() => loadEnv({ NODE_ENV: "staging" })).toThrow(InvalidEnvironmentError);
  });

  it("acepta MCP_HTTP_PORT=0 (asignacion automatica por el SO)", () => {
    const env = loadEnv({ NODE_ENV: "test", MCP_HTTP_PORT: "0" });
    expect(env.MCP_HTTP_PORT).toBe(0);
  });

  it("rechaza un MCP_HTTP_PORT negativo", () => {
    expect(() => loadEnv({ NODE_ENV: "test", MCP_HTTP_PORT: "-1" })).toThrow();
  });
});
