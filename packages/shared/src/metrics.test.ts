import { describe, expect, it } from "vitest";
import { InMemoryMetricsSink, NoopMetricsSink } from "./metrics.js";

describe("metrics sinks", () => {
  it("NoopMetricsSink acepta todas las metricas sin efectos laterales", () => {
    const sink = new NoopMetricsSink();
    expect(() => {
      sink.increment("requests", { providerId: "fedlex" });
      sink.observeLatency("search", 12);
      sink.setCircuitBreakerState("fedlex", "closed");
      sink.setProviderHealth("fedlex", true);
    }).not.toThrow();
  });

  it("InMemoryMetricsSink registra contadores, latencia y salud", () => {
    const sink = new InMemoryMetricsSink();
    sink.increment("requests", { providerId: "fedlex", operation: "search" }, 2);
    sink.observeLatency("search", 35, { providerId: "fedlex" });
    sink.setCircuitBreakerState("fedlex", "open");
    sink.setProviderHealth("fedlex", false);

    expect(sink.snapshot()).toEqual([
      {
        name: "requests",
        value: 2,
        labels: { providerId: "fedlex", operation: "search" },
      },
      {
        name: "latency",
        value: 35,
        labels: { providerId: "fedlex", operation: "search" },
      },
      {
        name: "circuitBreakerState",
        value: 1,
        labels: { providerId: "fedlex", result: "open" },
      },
      {
        name: "providerHealth",
        value: 0,
        labels: { providerId: "fedlex", result: "unhealthy" },
      },
    ]);
  });
});
