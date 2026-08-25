import type { RequestHandler } from "express";

/** GET /health: solo confirma que el proceso esta vivo, sin comprobar dependencias. */
export function healthHandler(): RequestHandler {
  const startedAt = Date.now();
  return (_req, res) => {
    res.status(200).json({
      status: "ok",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    });
  };
}
