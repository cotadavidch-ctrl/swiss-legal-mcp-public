import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Env } from "@swiss-legal-mcp/shared";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Exige un bearer token valido en Authorization para POST /mcp, salvo en
 * NODE_ENV=test. env.MCP_HTTP_BEARER_TOKEN esta garantizado presente fuera
 * de test (loadEnv lo valida al arrancar), por eso el chequeo de aqui es
 * solo defensivo, no de arranque.
 */
export function bearerAuth(env: Env): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (env.NODE_ENV === "test") {
      next();
      return;
    }
    const expectedToken = env.MCP_HTTP_BEARER_TOKEN;
    const header = req.headers.authorization;
    if (!expectedToken || !header || !safeEqual(header, `Bearer ${expectedToken}`)) {
      res
        .status(401)
        .json({ error: { code: "UNAUTHORIZED", message: "Bearer token invalido o ausente." } });
      return;
    }
    next();
  };
}
