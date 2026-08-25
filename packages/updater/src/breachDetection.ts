import { createSecurityEvent, type SecurityEvent } from "./securityEvents.js";

export interface BreachSignal {
  readonly category: string;
  readonly component: string;
  readonly operation: string;
  readonly summary: string;
  readonly count?: number;
}

export interface BreachDetectionInput {
  readonly invalidTokenAttempts?: number;
  readonly invalidSignature?: boolean;
  readonly artifactHashMismatch?: boolean;
  readonly ssrfAttempt?: boolean;
  readonly pathTraversalAttempt?: boolean;
  readonly secretInLog?: boolean;
  readonly fixtureToolInProduction?: boolean;
  readonly stdoutContaminated?: boolean;
  readonly downgradeAttempt?: boolean;
  readonly anomalousProviderResponse?: boolean;
}

export function detectBreachSignals(input: BreachDetectionInput): SecurityEvent[] {
  const signals: BreachSignal[] = [];
  if ((input.invalidTokenAttempts ?? 0) >= 5) {
    signals.push({
      category: "invalid_token",
      component: "http",
      operation: "auth",
      summary: `${input.invalidTokenAttempts} invalid bearer token attempts`,
      count: input.invalidTokenAttempts,
    });
  }
  if (input.invalidSignature === true) {
    signals.push({
      category: "invalid_signature",
      component: "updater",
      operation: "verify",
      summary: "Rejected update signature verification failure",
    });
  }
  if (input.artifactHashMismatch === true) {
    signals.push({
      category: "tampered_artifact",
      component: "updater",
      operation: "verify",
      summary: "Rejected artifact hash mismatch",
    });
  }
  if (input.ssrfAttempt === true) {
    signals.push({
      category: "ssrf_attempt",
      component: "network",
      operation: "request",
      summary: "Blocked SSRF or DNS rebinding attempt",
    });
  }
  if (input.pathTraversalAttempt === true) {
    signals.push({
      category: "path_traversal",
      component: "filesystem",
      operation: "write",
      summary: "Blocked path traversal attempt",
    });
  }
  if (input.secretInLog === true) {
    signals.push({
      category: "secret_exposure",
      component: "logging",
      operation: "redact",
      summary: "Potential Authorization=Bearer token in log was redacted",
    });
  }
  if (input.fixtureToolInProduction === true) {
    signals.push({
      category: "fixture_in_production",
      component: "mcp",
      operation: "tools/list",
      summary: "Fixture tool appeared in production catalog",
    });
  }
  if (input.stdoutContaminated === true) {
    signals.push({
      category: "stdout_contamination",
      component: "stdio",
      operation: "startup",
      summary: "Non-MCP output detected on stdout",
    });
  }
  if (input.downgradeAttempt === true) {
    signals.push({
      category: "update_downgrade",
      component: "updater",
      operation: "policy",
      summary: "Blocked update downgrade or replay",
    });
  }
  if (input.anomalousProviderResponse === true) {
    signals.push({
      category: "suspicious_provider_response",
      component: "provider",
      operation: "parse",
      summary: "Provider response exceeded expected contract or size",
    });
  }
  return signals.map((signal) =>
    createSecurityEvent({
      category: signal.category,
      component: signal.component,
      operation: signal.operation,
      safeSummary: signal.summary,
      count: signal.count,
      actionTaken: "recorded",
    }),
  );
}
