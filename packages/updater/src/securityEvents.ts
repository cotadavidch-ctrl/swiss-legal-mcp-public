import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type SecuritySeverity =
  "informational" | "suspicious" | "likely_incident" | "confirmed_incident";

export interface SecurityEvent {
  readonly eventId: string;
  readonly timestamp: string;
  readonly severity: SecuritySeverity;
  readonly category: string;
  readonly component: string;
  readonly operation: string;
  readonly providerId?: string;
  readonly correlationId?: string;
  readonly safeSummary: string;
  readonly evidenceReferences: readonly string[];
  readonly actionTaken: string;
  readonly status: "open" | "acknowledged";
}

const secretPatterns = [
  { pattern: /Bearer\s+[A-Za-z0-9._~+/=-]+/gi, replacement: "Bearer [REDACTED]" },
  {
    pattern: /(authorization|cookie|set-cookie|password|secret|token|session)[=:]\s*[^,\s]+/gi,
    replacement: "$1=[REDACTED]",
  },
  {
    pattern: /-----BEGIN [A-Z ]*SECRET MATERIAL-----[\s\S]*?-----END [A-Z ]*SECRET MATERIAL-----/g,
    replacement: "[REDACTED SECRET MATERIAL]",
  },
];

export function redactSensitiveValue(value: string): string {
  return secretPatterns.reduce((text, item) => text.replace(item.pattern, item.replacement), value);
}

export function classifySecurityEvent(category: string, count = 1): SecuritySeverity {
  if (
    [
      "invalid_signature",
      "tampered_artifact",
      "stdout_contamination",
      "fixture_in_production",
    ].includes(category)
  ) {
    return "likely_incident";
  }
  if (["path_traversal", "ssrf_attempt", "secret_exposure"].includes(category)) {
    return "suspicious";
  }
  if (category === "invalid_token" && count >= 5) return "suspicious";
  if (category === "confirmed_key_leak") return "confirmed_incident";
  return "informational";
}

export function createSecurityEvent(params: {
  readonly category: string;
  readonly component: string;
  readonly operation: string;
  readonly safeSummary: string;
  readonly count?: number;
  readonly providerId?: string;
  readonly correlationId?: string;
  readonly evidenceReferences?: readonly string[];
  readonly actionTaken?: string;
}): SecurityEvent {
  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    severity: classifySecurityEvent(params.category, params.count),
    category: params.category,
    component: params.component,
    operation: params.operation,
    ...(params.providerId !== undefined ? { providerId: params.providerId } : {}),
    ...(params.correlationId !== undefined ? { correlationId: params.correlationId } : {}),
    safeSummary: redactSensitiveValue(params.safeSummary),
    evidenceReferences: params.evidenceReferences ?? [],
    actionTaken: params.actionTaken ?? "recorded",
    status: "open",
  };
}

export class SecurityEventStore {
  constructor(private readonly filePath: string) {}

  async append(event: SecurityEvent): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const current = await this.list();
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify([...current, event], null, 2)}\n`, { mode: 0o600 });
    await fs.rename(tmp, this.filePath);
  }

  async list(): Promise<SecurityEvent[]> {
    try {
      return JSON.parse(await fs.readFile(this.filePath, "utf8")) as SecurityEvent[];
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async acknowledge(eventId: string): Promise<void> {
    const events = await this.list();
    const next = events.map((event) =>
      event.eventId === eventId ? { ...event, status: "acknowledged" as const } : event,
    );
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(tmp, this.filePath);
  }
}
