export type MetricName =
  | "requests"
  | "successes"
  | "failures"
  | "timeouts"
  | "retries"
  | "rateLimits"
  | "cacheHits"
  | "cacheMisses"
  | "bytesDownloaded"
  | "parseFailures"
  | "validationFailures";

export interface MetricLabels {
  readonly providerId?: string;
  readonly operation?: string;
  readonly result?: string;
  readonly cacheStatus?: string;
}

export interface MetricsSink {
  increment(name: MetricName, labels?: MetricLabels, value?: number): void;
  observeLatency(operation: string, durationMs: number, labels?: MetricLabels): void;
  setCircuitBreakerState(providerId: string, state: string): void;
  setProviderHealth(providerId: string, healthy: boolean): void;
}

export class NoopMetricsSink implements MetricsSink {
  increment(_name: MetricName, _labels?: MetricLabels, _value?: number): void {}
  observeLatency(_operation: string, _durationMs: number, _labels?: MetricLabels): void {}
  setCircuitBreakerState(_providerId: string, _state: string): void {}
  setProviderHealth(_providerId: string, _healthy: boolean): void {}
}

export interface InMemoryMetricSample {
  readonly name: MetricName | "latency" | "circuitBreakerState" | "providerHealth";
  readonly value: number;
  readonly labels: MetricLabels;
}

export class InMemoryMetricsSink implements MetricsSink {
  private readonly samples: InMemoryMetricSample[] = [];

  increment(name: MetricName, labels: MetricLabels = {}, value = 1): void {
    this.samples.push({ name, value, labels });
  }

  observeLatency(operation: string, durationMs: number, labels: MetricLabels = {}): void {
    this.samples.push({
      name: "latency",
      value: durationMs,
      labels: { ...labels, operation },
    });
  }

  setCircuitBreakerState(providerId: string, state: string): void {
    this.samples.push({
      name: "circuitBreakerState",
      value: state === "open" ? 1 : state === "half-open" ? 0.5 : 0,
      labels: { providerId, result: state },
    });
  }

  setProviderHealth(providerId: string, healthy: boolean): void {
    this.samples.push({
      name: "providerHealth",
      value: healthy ? 1 : 0,
      labels: { providerId, result: healthy ? "healthy" : "unhealthy" },
    });
  }

  snapshot(): readonly InMemoryMetricSample[] {
    return [...this.samples];
  }
}
