import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { concurrencyLimit } from "../../src/middleware/concurrency.js";

function fakeRes() {
  const emitter = new EventEmitter();
  const res = Object.assign(emitter, {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  });
  return res as unknown as Response & EventEmitter;
}

describe("concurrencyLimit", () => {
  it("permite peticiones mientras no se supere el maximo", () => {
    const middleware = concurrencyLimit(2);
    const next = vi.fn();
    middleware({} as Request, fakeRes(), next);
    middleware({} as Request, fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("responde 503 al superar el maximo en vuelo", () => {
    const middleware = concurrencyLimit(1);
    const next = vi.fn();
    middleware({} as Request, fakeRes(), next);

    const res2 = fakeRes();
    middleware({} as Request, res2, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res2.status).toHaveBeenCalledWith(503);
  });

  it("libera el slot cuando la primera peticion termina ('finish')", () => {
    const middleware = concurrencyLimit(1);
    const next = vi.fn();
    const res1 = fakeRes();
    middleware({} as Request, res1, next);
    res1.emit("finish");

    const res2 = fakeRes();
    middleware({} as Request, res2, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("no libera el slot dos veces si 'finish' y 'close' se emiten ambos", () => {
    const middleware = concurrencyLimit(1);
    const next = vi.fn();
    const res1 = fakeRes();
    middleware({} as Request, res1, next);
    res1.emit("finish");
    res1.emit("close");

    const res2 = fakeRes();
    middleware({} as Request, res2, next);
    const res3 = fakeRes();
    middleware({} as Request, res3, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res3.status).toHaveBeenCalledWith(503);
  });
});
