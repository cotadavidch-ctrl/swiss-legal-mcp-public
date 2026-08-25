import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "./circuitBreaker.js";

describe("CircuitBreaker", () => {
  it("empieza cerrado y permite intentos", () => {
    const breaker = new CircuitBreaker(3, 1000);
    expect(breaker.currentState).toBe("closed");
    expect(breaker.canAttempt()).toBe(true);
  });

  it("se abre tras alcanzar el umbral de fallos consecutivos", () => {
    const breaker = new CircuitBreaker(3, 1000);
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.currentState).toBe("closed");
    breaker.recordFailure();
    expect(breaker.currentState).toBe("open");
    expect(breaker.canAttempt()).toBe(false);
  });

  it("un exito reinicia el contador de fallos", () => {
    const breaker = new CircuitBreaker(3, 1000);
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.currentState).toBe("closed");
  });

  it("pasa a semiabierto tras el tiempo de enfriamiento y permite un intento", () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker(1, 500);
    breaker.recordFailure();
    expect(breaker.currentState).toBe("open");
    vi.advanceTimersByTime(501);
    expect(breaker.currentState).toBe("half_open");
    expect(breaker.canAttempt()).toBe(true);
    vi.useRealTimers();
  });

  it("en semiabierto, un exito cierra el circuito", () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker(1, 500);
    breaker.recordFailure();
    vi.advanceTimersByTime(501);
    expect(breaker.currentState).toBe("half_open");
    breaker.beginAttempt();
    breaker.recordSuccess();
    expect(breaker.currentState).toBe("closed");
    vi.useRealTimers();
  });

  it("en semiabierto, un fallo reabre el circuito", () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker(1, 500);
    breaker.recordFailure();
    vi.advanceTimersByTime(501);
    expect(breaker.currentState).toBe("half_open");
    breaker.beginAttempt();
    breaker.recordFailure();
    expect(breaker.currentState).toBe("open");
    vi.useRealTimers();
  });

  it("no permite mas de un intento simultaneo en semiabierto", () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker(1, 500);
    breaker.recordFailure();
    vi.advanceTimersByTime(501);
    expect(breaker.canAttempt()).toBe(true);
    breaker.beginAttempt();
    expect(breaker.canAttempt()).toBe(false);
    vi.useRealTimers();
  });
});
