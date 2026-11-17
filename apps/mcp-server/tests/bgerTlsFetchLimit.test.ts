import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ResponseTooLargeError,
  createByteBudget,
  tlsAwareFetch,
} from "../src/tools/bgerTlsFetch.js";

let server: http.Server;
let base = "";

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/declared") {
      res.writeHead(200, { "content-length": "5000000", "content-type": "text/plain" });
      res.end("x".repeat(10));
      return;
    }
    if (req.url === "/stream") {
      // Sin Content-Length: el limite debe cortar el flujo mientras llega.
      res.writeHead(200, { "content-type": "text/plain" });
      const chunk = "x".repeat(100_000);
      let sent = 0;
      const timer = setInterval(() => {
        if (sent >= 3_000_000 || res.destroyed) {
          clearInterval(timer);
          res.end();
          return;
        }
        res.write(chunk);
        sent += chunk.length;
      }, 1);
      res.on("close", () => clearInterval(timer));
      return;
    }
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("pequeno");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("limite de tamano durante la descarga", () => {
  it("el presupuesto de bytes falla en cuanto se supera", () => {
    const consume = createByteBudget(100);
    consume(60);
    expect(() => consume(40)).not.toThrow();
    expect(() => consume(1)).toThrow(ResponseTooLargeError);
  });

  it("rechaza de inmediato una respuesta cuyo Content-Length ya supera el maximo", async () => {
    await expect(tlsAwareFetch(`${base}/declared`, { maxBytes: 1_000 })).rejects.toThrow(
      "response_too_large",
    );
  });

  it("corta un flujo sin Content-Length al superar el maximo", async () => {
    const res = await tlsAwareFetch(`${base}/stream`, { maxBytes: 500_000 });
    await expect(res.arrayBuffer()).rejects.toThrow();
  });

  it("deja pasar una respuesta dentro del limite", async () => {
    const res = await tlsAwareFetch(`${base}/small`, { maxBytes: 1_000 });
    expect(await res.text()).toBe("pequeno");
  });
});
