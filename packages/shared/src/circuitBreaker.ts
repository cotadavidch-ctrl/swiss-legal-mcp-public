export type CircuitState = "closed" | "open" | "half_open";

/**
 * Circuit breaker sencillo de 3 estados (cerrado/abierto/semiabierto), sin
 * dependencias externas. `canAttempt()` decide si intentar la llamada;
 * `recordSuccess()`/`recordFailure()` actualizan el estado tras el intento.
 * Extraido a packages/shared en Fase 3: identico para EntscheidsucheMcpProvider
 * y FedlexProvider, evita duplicar la logica y sus pruebas por proveedor.
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private consecutiveFailures = 0;
  private openedAt = 0;
  private halfOpenInFlight = false;

  constructor(
    private readonly failureThreshold: number,
    private readonly resetMs: number,
  ) {}

  get currentState(): CircuitState {
    this.refreshState();
    return this.state;
  }

  canAttempt(): boolean {
    this.refreshState();
    if (this.state === "open") return false;
    if (this.state === "half_open" && this.halfOpenInFlight) return false;
    return true;
  }

  beginAttempt(): void {
    if (this.state === "half_open") {
      this.halfOpenInFlight = true;
    }
  }

  recordSuccess(): void {
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.halfOpenInFlight = false;
  }

  recordFailure(): void {
    if (this.state === "half_open") {
      this.state = "open";
      this.openedAt = Date.now();
      this.halfOpenInFlight = false;
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  private refreshState(): void {
    if (this.state === "open" && Date.now() - this.openedAt >= this.resetMs) {
      this.state = "half_open";
      this.halfOpenInFlight = false;
    }
  }
}
