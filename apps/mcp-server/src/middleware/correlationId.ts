import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  CORRELATION_ID_HEADER,
  generateCorrelationId,
  runWithCorrelationId,
} from "@swiss-legal-mcp/shared";

/**
 * Asigna un correlation id por peticion (reutilizando el header entrante si
 * el cliente ya proporciono uno) y lo expone via AsyncLocalStorage para que
 * el logger y los handlers de herramientas MCP lo puedan leer sin tener que
 * pasarlo explicitamente por cada capa.
 */
export function correlationIdMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers[CORRELATION_ID_HEADER];
    const correlationId =
      typeof incoming === "string" && incoming.length > 0 ? incoming : generateCorrelationId();
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    runWithCorrelationId(correlationId, () => next());
  };
}
