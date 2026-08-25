import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { loadEnv } from "@swiss-legal-mcp/shared";
import { buildRateLimit } from "../../src/middleware/rateLimit.js";

describe("buildRateLimit", () => {
  it("no aplica limite en NODE_ENV=test", async () => {
    const settings = loadEnv({ NODE_ENV: "test" });
    const app = express();
    app.use(buildRateLimit(settings));
    app.get("/ping", (_req, res) => res.status(200).send("pong"));

    for (let i = 0; i < 5; i += 1) {
      const response = await request(app).get("/ping");
      expect(response.status).toBe(200);
    }
  });

  it("responde 429 al superar MCP_HTTP_RATE_LIMIT_MAX fuera de test", async () => {
    const settings = loadEnv({
      NODE_ENV: "production",
      MCP_HTTP_BEARER_TOKEN: "secret",
      MCP_HTTP_RATE_LIMIT_MAX: "2",
      MCP_HTTP_RATE_LIMIT_WINDOW_MS: "60000",
    });
    const app = express();
    app.use(buildRateLimit(settings));
    app.get("/ping", (_req, res) => res.status(200).send("pong"));

    const first = await request(app).get("/ping");
    const second = await request(app).get("/ping");
    const third = await request(app).get("/ping");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
  });
});
