import { pinoHttp } from "pino-http";
import type { RequestHandler } from "express";
import { getCorrelationId, type Logger } from "@swiss-legal-mcp/shared";

/**
 * Logging estructurado por peticion HTTP. Reutiliza el logger ya configurado
 * (con redaccion de authorization/cookie) en vez de crear uno nuevo, y adjunta
 * el correlation id de la peticion a cada linea.
 */
export function requestLogger(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    customProps: () => {
      const correlationId = getCorrelationId();
      return correlationId ? { correlationId } : {};
    },
  });
}
