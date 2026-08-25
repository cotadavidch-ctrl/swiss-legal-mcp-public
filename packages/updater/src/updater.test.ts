import { createServer, type Server } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IntegrityError, NetworkPolicyError, SecurityError } from "@swiss-legal-mcp/core";
import {
  canonicalJson,
  createUpdater,
  evaluateUpdatePolicy,
  sha256Hex,
  verifyManifestEnvelope,
  type UpdateManifest,
} from "./index.js";

let tmpDir: string;
let server: Server | undefined;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "swiss-legal-updater-"));
});

afterEach(async () => {
  await closeLocalServer();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("update manifest policy and signatures", () => {
  it("accepts a signed valid manifest and rejects tampering, unknown keys and revoked keys", () => {
    const keys = fixtureKeys();
    const artifact = artifactBytes("1.0.1");
    const manifest = makeManifest({
      artifact,
      artifactUrl: "https://updates.example.test/swiss-legal-mcp-1.0.1.artifact",
      publicKeyId: "fixture-key",
      artifactSignature: signBytes(keys.signingPem, artifact),
    });
    const envelope = {
      manifest,
      signature: signBytes(keys.signingPem, canonicalJson(manifest)),
    };

    expect(
      verifyManifestEnvelope({
        envelope,
        publicKeys: new Map([["fixture-key", keys.publicPem]]),
      }).manifest.version,
    ).toBe("1.0.1");
    expect(() =>
      verifyManifestEnvelope({
        envelope: { ...envelope, manifest: { ...manifest, version: "1.0.2" } },
        publicKeys: new Map([["fixture-key", keys.publicPem]]),
      }),
    ).toThrow(IntegrityError);
    expect(() => verifyManifestEnvelope({ envelope, publicKeys: new Map() })).toThrow(
      IntegrityError,
    );
    expect(() =>
      verifyManifestEnvelope({
        envelope,
        publicKeys: new Map([["fixture-key", keys.publicPem]]),
        revokedKeyIds: new Set(["fixture-key"]),
      }),
    ).toThrow(SecurityError);
  });

  it("blocks same version, downgrade, replay, expired manifest and channel changes", () => {
    const artifact = artifactBytes("1.0.1");
    const manifest = makeManifest({
      artifact,
      artifactUrl: "https://updates.example.test/swiss-legal-mcp-1.0.1.artifact",
      artifactSignature: "x".repeat(96),
    });
    const state = {
      currentVersion: "1.0.0",
      channel: "stable" as const,
      lastAcceptedReleaseSequence: 1,
    };
    expect(evaluateUpdatePolicy({ manifest, state }).allowed).toBe(true);
    expect(
      evaluateUpdatePolicy({
        manifest: { ...manifest, version: "1.0.0", releaseSequence: 2 },
        state,
      }).reason,
    ).toBe("downgrade_or_same_version");
    expect(
      evaluateUpdatePolicy({
        manifest: { ...manifest, version: "0.9.9", releaseSequence: 2 },
        state,
      }).reason,
    ).toBe("downgrade_or_same_version");
    expect(
      evaluateUpdatePolicy({ manifest: { ...manifest, releaseSequence: 1 }, state }).reason,
    ).toBe("release_sequence_replay");
    expect(
      evaluateUpdatePolicy({
        manifest: { ...manifest, expiresAt: "2026-01-01T00:00:00.000Z" },
        state,
        now: new Date("2026-08-03T00:00:00.000Z"),
      }).reason,
    ).toBe("manifest_expired");
    expect(evaluateUpdatePolicy({ manifest: { ...manifest, channel: "beta" }, state }).reason).toBe(
      "channel_change_requires_confirmation",
    );
    expect(
      evaluateUpdatePolicy({
        manifest: { ...manifest, publishedAt: "2026-08-03T00:20:01.000Z" },
        state,
        now: new Date("2026-08-03T00:00:00.000Z"),
      }).reason,
    ).toBe("manifest_from_future");
    expect(
      evaluateUpdatePolicy({
        manifest: { ...manifest, version: "1.0.1-rc.1", releaseSequence: 3 },
        state: { ...state, currentVersion: "1.0.1-beta.1", channel: "rc" },
        explicitChannelChange: true,
      }).allowed,
    ).toBe(true);
  });
});

describe("local updater", () => {
  it("reports default status and requires explicit confirmation for install and rollback", async () => {
    const keys = fixtureKeys();
    const installDir = path.join(tmpDir, "install");
    const stateDir = path.join(tmpDir, "state");
    await fs.mkdir(installDir, { recursive: true });
    const artifact = artifactBytes("1.0.1");
    const served = await serveLocalArtifact(artifact);
    const manifest = makeManifest({
      artifact,
      artifactUrl: served.url,
      artifactSignature: signBytes(keys.signingPem, artifact),
    });
    const updater = createUpdater({
      installDir,
      stateDir,
      currentVersion: "1.0.0",
      channel: "stable",
      lastAcceptedReleaseSequence: 1,
      allowedHosts: ["localhost"],
      publicKeys: new Map([["fixture-key", keys.publicPem]]),
      platform: "darwin-arm64",
    });

    await expect(updater.status()).resolves.toEqual({
      currentVersion: "1.0.0",
      channel: "stable",
      lastAcceptedReleaseSequence: 1,
    });
    await expect(updater.install(manifest, served.file)).rejects.toThrow(SecurityError);
    await expect(updater.rollback()).rejects.toThrow(SecurityError);
  });

  it("downloads, verifies, installs atomically and rolls back without touching real user install", async () => {
    const keys = fixtureKeys();
    const installDir = path.join(tmpDir, "install");
    const stateDir = path.join(tmpDir, "state");
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "version.txt"), "1.0.0", { mode: 0o600 });
    const artifact = artifactBytes("1.0.1", [{ path: "version.txt", content: "1.0.1" }]);
    const served = await serveLocalArtifact(artifact);
    const manifest = makeManifest({
      artifact,
      artifactUrl: served.url,
      artifactSignature: signBytes(keys.signingPem, artifact),
    });
    const updater = createUpdater({
      installDir,
      stateDir,
      currentVersion: "1.0.0",
      allowedHosts: ["localhost"],
      publicKeys: new Map([["fixture-key", keys.publicPem]]),
      platform: "darwin-arm64",
    });

    await updater.check({
      manifest,
      signature: signBytes(keys.signingPem, canonicalJson(manifest)),
    });
    const downloaded = await updater.download(manifest);
    await updater.verify(manifest, downloaded);
    await updater.install(manifest, downloaded, { confirm: true });
    await expect(fs.readFile(path.join(installDir, "version.txt"), "utf8")).resolves.toBe("1.0.1");
    await updater.rollback({ confirm: true });
    await expect(fs.readFile(path.join(installDir, "version.txt"), "utf8")).resolves.toBe("1.0.0");
  });

  it("rejects hash mismatch, size mismatch, non-allowlisted URLs and path traversal", async () => {
    const keys = fixtureKeys();
    const installDir = path.join(tmpDir, "install");
    const stateDir = path.join(tmpDir, "state");
    await fs.mkdir(installDir, { recursive: true });
    const artifact = artifactBytes("1.0.1", [{ path: "version.txt", content: "1.0.1" }]);
    const served = await serveLocalArtifact(artifact);
    const updater = createUpdater({
      installDir,
      stateDir,
      currentVersion: "1.0.0",
      allowedHosts: ["localhost"],
      publicKeys: new Map([["fixture-key", keys.publicPem]]),
      platform: "darwin-arm64",
    });
    const manifest = makeManifest({
      artifact,
      artifactUrl: served.url,
      artifactSignature: signBytes(keys.signingPem, artifact),
    });

    await expect(
      updater.verify(
        { ...manifest, artifacts: [{ ...manifest.artifacts[0]!, sha256: "0".repeat(64) }] },
        served.file,
      ),
    ).rejects.toThrow(IntegrityError);
    await expect(
      updater.verify(
        {
          ...manifest,
          artifacts: [{ ...manifest.artifacts[0]!, size: artifact.byteLength + 1 }],
        },
        served.file,
      ),
    ).rejects.toThrow(IntegrityError);
    await expect(
      updater.download({
        ...manifest,
        artifacts: [{ ...manifest.artifacts[0]!, url: "https://updates.evil.test/package" }],
      }),
    ).rejects.toThrow(NetworkPolicyError);
    const traversalArtifact = artifactBytes("1.0.1", [{ path: "../outside", content: "bad" }]);
    await fs.writeFile(served.file, traversalArtifact);
    await expect(
      updater.verify(
        makeManifest({
          artifact: traversalArtifact,
          artifactUrl: served.url,
          artifactSignature: signBytes(keys.signingPem, traversalArtifact),
        }),
        served.file,
      ),
    ).rejects.toThrow(SecurityError);
  });

  it("rejects redirects, wrong content type, oversized content length and embedded credentials", async () => {
    const keys = fixtureKeys();
    const installDir = path.join(tmpDir, "install");
    const stateDir = path.join(tmpDir, "state");
    await fs.mkdir(installDir, { recursive: true });
    const artifact = artifactBytes("1.0.1");
    const manifestBase = makeManifest({
      artifact,
      artifactUrl: "http://localhost:1/artifact.bin",
      artifactSignature: signBytes(keys.signingPem, artifact),
    });
    const updater = createUpdater({
      installDir,
      stateDir,
      currentVersion: "1.0.0",
      allowedHosts: ["localhost"],
      publicKeys: new Map([["fixture-key", keys.publicPem]]),
      platform: "darwin-arm64",
      maxArtifactBytes: 10,
    });

    await expect(
      updater.download({
        ...manifestBase,
        artifacts: [
          { ...manifestBase.artifacts[0]!, url: "https://user:pass@localhost/artifact.bin" },
        ],
      }),
    ).rejects.toThrow(NetworkPolicyError);

    let served = await serveLocalResponse({
      status: 302,
      headers: { location: "https://updates.example.test/artifact.bin" },
      body: "",
    });
    await expect(
      updater.download({
        ...manifestBase,
        artifacts: [{ ...manifestBase.artifacts[0]!, url: served.url }],
      }),
    ).rejects.toThrow(NetworkPolicyError);

    await closeLocalServer();
    served = await serveLocalResponse({
      status: 200,
      headers: { "content-type": "text/plain", "content-length": String(artifact.byteLength) },
      body: artifact,
    });
    await expect(
      updater.download({
        ...manifestBase,
        artifacts: [{ ...manifestBase.artifacts[0]!, url: served.url }],
      }),
    ).rejects.toThrow(SecurityError);

    await closeLocalServer();
    served = await serveLocalResponse({
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(artifact.byteLength + 100),
      },
      body: artifact,
    });
    await expect(
      updater.download({
        ...manifestBase,
        artifacts: [{ ...manifestBase.artifacts[0]!, url: served.url }],
      }),
    ).rejects.toThrow(SecurityError);
  });
});

function fixtureKeys() {
  const pair = generateKeyPairSync("ed25519");
  const signingKey = Object.values(pair).find((value) => {
    return (value as KeyObject).type === "private";
  }) as KeyObject;
  return {
    publicPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    signingPem: signingKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

function signBytes(signingPem: string, payload: Uint8Array | string): string {
  return sign(null, Buffer.from(payload), signingPem).toString("base64");
}

function artifactBytes(
  version: string,
  files: Array<{ path: string; content: string }> = [{ path: "version.txt", content: version }],
): Buffer {
  return Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      project: "swiss-legal-mcp",
      version,
      files: files.map((file) => ({
        path: file.path,
        contentBase64: Buffer.from(file.content).toString("base64"),
        mode: 0o600,
      })),
    }),
  );
}

function makeManifest(params: {
  artifact: Uint8Array;
  artifactUrl: string;
  publicKeyId?: string;
  artifactSignature: string;
}): UpdateManifest {
  return {
    schemaVersion: 1,
    project: "swiss-legal-mcp",
    version: "1.0.1",
    channel: "stable",
    publishedAt: "2026-08-03T00:00:00.000Z",
    expiresAt: "2027-08-03T00:00:00.000Z",
    minimumNodeVersion: "22",
    mcpProtocolCompatibility: { minimum: "2025-06-18", maximum: "2026-12-31" },
    releaseSequence: 2,
    artifacts: [
      {
        platform: "darwin-arm64",
        url: params.artifactUrl,
        sha256: sha256Hex(params.artifact),
        size: params.artifact.byteLength,
        signature: params.artifactSignature,
        contentType: "application/octet-stream",
      },
    ],
    securityAdvisories: [],
    rollbackSupported: true,
    signingKeyId: params.publicKeyId ?? "fixture-key",
  };
}

async function serveLocalArtifact(bytes: Uint8Array): Promise<{ url: string; file: string }> {
  const file = path.join(tmpDir, "artifact.bin");
  await fs.writeFile(file, bytes);
  const served = await serveLocalResponse({
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(bytes.byteLength),
    },
    body: bytes,
  });
  return { ...served, file };
}

async function serveLocalResponse(params: {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: Uint8Array | string;
}): Promise<{ url: string }> {
  server = createServer((_request, response) => {
    response.writeHead(params.status, params.headers);
    response.end(params.body);
  });
  await new Promise<void>((resolve) => server!.listen(0, "localhost", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local test server address");
  return { url: `http://localhost:${address.port}/artifact.bin` };
}

async function closeLocalServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
}
