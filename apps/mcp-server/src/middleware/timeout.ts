import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Responde 503 si la peticion no ha terminado dentro de `ms`. No cancela el
 * trabajo subyacente (eso requeriria propagar un AbortSignal hasta cada
 * proveedor, fuera de alcance de Fase 1); solo evita que el cliente quede
 * colgado indefinidamente. Ver limitaciones conocidas en IMPLEMENTATION_STATUS.md.
 */
export function requestTimeout(ms: number): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res
          .status(503)
          .json({ error: { code: "TIMEOUT", message: `La peticion supero ${ms}ms.` } });
      }
    }, ms);
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));
    next();
  };
}
