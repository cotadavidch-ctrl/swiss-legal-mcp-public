import { afterEach, describe, expect, it } from "vitest";
import {
  bgerMinIntervalMs,
  resetBgerPacingForTests,
  waitForBgerSlot,
} from "../src/tools/bgerTlsFetch.js";

afterEach(() => {
  resetBgerPacingForTests();
});

describe("ritmo de peticiones a bger.ch", () => {
  it("en NODE_ENV=test no espera (los tests no se ralentizan)", () => {
    expect(bgerMinIntervalMs()).toBe(0);
  });

  it("separa las peticiones al menos el intervalo indicado", async () => {
    const t0 = Date.now();
    await waitForBgerSlot(60);
    await waitForBgerSlot(60);
    await waitForBgerSlot(60);
    // la primera no espera; la segunda y tercera esperan ~60 ms cada una
    expect(Date.now() - t0).toBeGreaterThanOrEqual(110);
  });

  it("reserva las franjas en orden aunque varias llamadas compitan a la vez", async () => {
    const t0 = Date.now();
    const finished: number[] = [];
    await Promise.all(
      [0, 1, 2, 3].map(async () => {
        await waitForBgerSlot(40);
        finished.push(Date.now() - t0);
      }),
    );
    const sorted = [...finished].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(30);
    }
  });

  it("el tope por ventana reparte una racha: la peticion fuera de cupo espera a que salga la mas antigua", async () => {
    const window = { max: 2, ms: 300 };
    const t0 = Date.now();
    await waitForBgerSlot(5, undefined, window);
    await waitForBgerSlot(5, undefined, window);
    const afterTwo = Date.now() - t0;
    await waitForBgerSlot(5, undefined, window); // tercera: debe esperar ~300 ms desde la primera
    const afterThree = Date.now() - t0;
    expect(afterTwo).toBeLessThan(250);
    expect(afterThree).toBeGreaterThanOrEqual(280);
  });

  it("sin tope por ventana (max 0) solo aplica el intervalo", async () => {
    const t0 = Date.now();
    for (let i = 0; i < 5; i += 1) await waitForBgerSlot(5, undefined, { max: 0, ms: 300 });
    expect(Date.now() - t0).toBeLessThan(200);
  });

  it("intervalo 0 no espera", async () => {
    const t0 = Date.now();
    await waitForBgerSlot(0);
    await waitForBgerSlot(0);
    expect(Date.now() - t0).toBeLessThan(30);
  });

  it("se cancela si la señal se aborta mientras espera", async () => {
    await waitForBgerSlot(500); // ocupa la franja actual
    const controller = new AbortController();
    const pending = waitForBgerSlot(500, controller.signal);
    controller.abort(new Error("cancelado"));
    await expect(pending).rejects.toThrow("cancelado");
  });
});
