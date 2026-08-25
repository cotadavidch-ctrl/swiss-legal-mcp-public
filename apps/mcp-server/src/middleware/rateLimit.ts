import type { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import type { Env } from "@swiss-legal-mcp/shared";

/** Rate limit por IP. Desactivado en NODE_ENV=test para no introducir flakiness en la suite. */
export function buildRateLimit(env: Env): RequestHandler {
  if (env.NODE_ENV === "test") {
    return (_req, _res, next) => next();
  }
  return rateLimit({
    windowMs: env.MCP_HTTP_RATE_LIMIT_WINDOW_MS,
    limit: env.MCP_HTTP_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Demasiadas peticiones." } },
  });
}
