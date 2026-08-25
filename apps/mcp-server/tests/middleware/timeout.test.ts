import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { requestTimeout } from "../../src/middleware/timeout.js";

function fakeRes(headersSent = false) {
  const emitter = new EventEmitter();
  const res = Object.assign(emitter, {
    headersSent,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  });
  return res as unknown as Response & EventEmitter;
}

describe("requestTimeout", () => {
  it("responde 503 si la peticion no termina antes del limite", async () => {
    const middleware = requestTimeout(20);
    const res = fakeRes();
    middleware({} as Request, res, vi.fn());

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it("no responde si la peticion termina ('finish') antes del limite", async () => {
    const middleware = requestTimeout(50);
    const res = fakeRes();
    middleware({} as Request, res, vi.fn());
    res.emit("finish");

    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(res.status).not.toHaveBeenCalled();
  });

  it("no intenta responder si headersSent ya es true", async () => {
    const middleware = requestTimeout(10);
    const res = fakeRes(true);
    middleware({} as Request, res, vi.fn());

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(res.status).not.toHaveBeenCalled();
  });
});
