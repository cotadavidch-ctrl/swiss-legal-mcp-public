import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Limita el numero de peticiones en vuelo simultaneas. */
export function concurrencyLimit(max: number): RequestHandler {
  let inFlight = 0;
  return (_req: Request, res: Response, next: NextFunction) => {
    if (inFlight >= max) {
      res.status(503).json({
        error: { code: "TOO_MANY_REQUESTS", message: `Concurrencia maxima (${max}) alcanzada.` },
      });
      return;
    }
    inFlight += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      inFlight -= 1;
    };
    res.on("finish", release);
    res.on("close", release);
    next();
  };
}
