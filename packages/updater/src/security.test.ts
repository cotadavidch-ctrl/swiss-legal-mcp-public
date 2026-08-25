import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { IntegrityError } from "@swiss-legal-mcp/core";
import {
  decryptAead,
  deriveKeyWithScrypt,
  detectBreachSignals,
  encryptAead,
  redactSensitiveValue,
  rotateEncryptedObject,
  SecurityEventStore,
} from "./index.js";

describe("encryption at rest", () => {
  it("encrypts with AES-256-GCM, rejects tampering and supports key rotation", async () => {
    const oldKey = randomBytes(32);
    const newKey = randomBytes(32);
    const encrypted = encryptAead({
      plaintext: "sensitive case file",
      key: oldKey,
      keyId: "local-storage-v1",
      aad: "case-file",
    });
    expect(encrypted.algorithm).toBe("AES-256-GCM");
    expect(decryptAead({ encrypted, key: oldKey, aad: "case-file" }).toString()).toBe(
      "sensitive case file",
    );
    expect(() =>
      decryptAead({
        encrypted: { ...encrypted, authTag: Buffer.from("tampered-tag-123").toString("base64") },
        key: oldKey,
        aad: "case-file",
      }),
    ).toThrow(IntegrityError);
    const rotated = rotateEncryptedObject({
      encrypted,
      oldKey,
      newKey,
      newKeyId: "local-storage-v2",
      aad: "case-file",
    });
    expect(rotated.keyId).toBe("local-storage-v2");
    expect(decryptAead({ encrypted: rotated, key: newKey, aad: "case-file" }).toString()).toBe(
      "sensitive case file",
    );
  });

  it("derives keys with scrypt and random salt input", async () => {
    const salt = randomBytes(16);
    const key = await deriveKeyWithScrypt({ password: "fixture-password", salt });
    expect(key.byteLength).toBe(32);
  });
});

describe("breach detection", () => {
  it("detects simulated critical signals without leaking secrets", async () => {
    const events = detectBreachSignals({
      invalidTokenAttempts: 6,
      invalidSignature: true,
      artifactHashMismatch: true,
      ssrfAttempt: true,
      pathTraversalAttempt: true,
      secretInLog: true,
      fixtureToolInProduction: true,
      stdoutContaminated: true,
      downgradeAttempt: true,
      anomalousProviderResponse: true,
    });
    expect(events.map((event) => event.category)).toEqual([
      "invalid_token",
      "invalid_signature",
      "tampered_artifact",
      "ssrf_attempt",
      "path_traversal",
      "secret_exposure",
      "fixture_in_production",
      "stdout_contamination",
      "update_downgrade",
      "suspicious_provider_response",
    ]);
    expect(events.some((event) => event.severity === "likely_incident")).toBe(true);
    expect(redactSensitiveValue("Authorization=Bearer secret-token")).not.toContain("secret-token");

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "swiss-legal-incidents-"));
    try {
      const store = new SecurityEventStore(path.join(dir, "incidents.json"));
      await store.append(events[0]!);
      const listed = await store.list();
      expect(listed[0]?.category).toBe("invalid_token");
      await store.acknowledge(listed[0]!.eventId);
      expect((await store.list())[0]?.status).toBe("acknowledged");
      const stat = await fs.stat(path.join(dir, "incidents.json"));
      expect((stat.mode & 0o077).toString(8)).toBe("0");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
