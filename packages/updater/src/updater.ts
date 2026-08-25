import fs from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { IntegrityError, NetworkPolicyError, SecurityError } from "@swiss-legal-mcp/core";
import { z } from "zod";
import { assertUpdateAllowed, type AcceptedReleaseState } from "./policy.js";
import { sha256Hex, verifyEd25519Signature, verifyManifestEnvelope } from "./signature.js";
import type {
  UpdateArtifact,
  UpdateChannel,
  UpdateManifest,
  UpdateManifestEnvelope,
} from "./manifest.js";

const artifactPayloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    project: z.literal("swiss-legal-mcp"),
    version: z.string().min(1),
    files: z
      .array(
        z
          .object({
            path: z.string().min(1),
            contentBase64: z.string().min(1),
            mode: z.number().int().nonnegative().optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

type ArtifactPayload = z.infer<typeof artifactPayloadSchema>;

export interface UpdateStatus {
  readonly currentVersion: string;
  readonly channel: UpdateChannel;
  readonly lastAcceptedReleaseSequence: number;
  readonly pendingVersion?: string;
  readonly lastRollbackVersion?: string;
}

export interface UpdaterConfig {
  readonly installDir: string;
  readonly stateDir: string;
  readonly currentVersion: string;
  readonly channel?: UpdateChannel;
  readonly lastAcceptedReleaseSequence?: number;
  readonly allowedHosts: readonly string[];
  readonly publicKeys: ReadonlyMap<string, string>;
  readonly revokedKeyIds?: ReadonlySet<string>;
  readonly platform: UpdateArtifact["platform"];
  readonly maxArtifactBytes?: number;
}

export interface Updater {
  status(): Promise<UpdateStatus>;
  check(envelope: unknown): Promise<UpdateManifestEnvelope>;
  download(manifest: UpdateManifest): Promise<string>;
  verify(manifest: UpdateManifest, artifactFile: string): Promise<void>;
  install(
    manifest: UpdateManifest,
    artifactFile: string,
    options?: { confirm?: boolean },
  ): Promise<void>;
  rollback(options?: { confirm?: boolean }): Promise<void>;
}

export function createUpdater(config: UpdaterConfig): Updater {
  return new LocalUpdater(config);
}

class LocalUpdater implements Updater {
  private readonly maxArtifactBytes: number;

  constructor(private readonly config: UpdaterConfig) {
    this.maxArtifactBytes = config.maxArtifactBytes ?? 100_000_000;
  }

  async status(): Promise<UpdateStatus> {
    const state = await this.readState();
    return {
      currentVersion: state.currentVersion,
      channel: state.channel,
      lastAcceptedReleaseSequence: state.lastAcceptedReleaseSequence,
      ...(state.pendingVersion !== undefined ? { pendingVersion: state.pendingVersion } : {}),
      ...(state.lastRollbackVersion !== undefined
        ? { lastRollbackVersion: state.lastRollbackVersion }
        : {}),
    };
  }

  async check(envelope: unknown): Promise<UpdateManifestEnvelope> {
    const verified = verifyManifestEnvelope({
      envelope,
      publicKeys: this.config.publicKeys,
      revokedKeyIds: this.config.revokedKeyIds,
    });
    assertUpdateAllowed({
      manifest: verified.manifest,
      state: await this.acceptedState(),
    });
    this.selectArtifact(verified.manifest);
    return verified;
  }

  async download(manifest: UpdateManifest): Promise<string> {
    const artifact = this.selectArtifact(manifest);
    this.assertAllowedUrl(artifact.url);
    const response = await fetch(artifact.url, { redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      throw new NetworkPolicyError(artifact.url, "redirects are not allowed for update artifacts");
    }
    if (!response.ok) {
      throw new NetworkPolicyError(artifact.url, `HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes(artifact.contentType)) {
      throw new SecurityError("Update artifact content type mismatch.", {
        expected: artifact.contentType,
        actual: contentType,
      });
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > Math.min(artifact.size, this.maxArtifactBytes)) {
      throw new SecurityError("Update artifact content length exceeds policy.", {
        contentLength,
      });
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > this.maxArtifactBytes || bytes.byteLength !== artifact.size) {
      throw new IntegrityError("Update artifact size mismatch.", {
        expected: artifact.size,
        actual: bytes.byteLength,
      });
    }
    await this.ensurePrivateDir(this.config.stateDir);
    const downloadDir = path.join(this.config.stateDir, "downloads");
    await this.ensurePrivateDir(downloadDir);
    const filePath = path.join(downloadDir, `${manifest.version}-${artifact.platform}.artifact`);
    await fs.writeFile(filePath, bytes, { mode: 0o600 });
    return filePath;
  }

  async verify(manifest: UpdateManifest, artifactFile: string): Promise<void> {
    const artifact = this.selectArtifact(manifest);
    const bytes = await fs.readFile(artifactFile);
    if (bytes.byteLength !== artifact.size) {
      throw new IntegrityError("Update artifact size mismatch.", {
        expected: artifact.size,
        actual: bytes.byteLength,
      });
    }
    const hash = sha256Hex(bytes);
    if (hash !== artifact.sha256) {
      throw new IntegrityError("Update artifact hash mismatch.", {
        expected: artifact.sha256,
        actual: hash,
      });
    }
    const publicKey = this.config.publicKeys.get(manifest.signingKeyId);
    if (!publicKey)
      throw new IntegrityError(`Unknown update signing key '${manifest.signingKeyId}'.`);
    if (
      !verifyEd25519Signature({
        payload: bytes,
        signatureBase64: artifact.signature,
        publicKeyPem: publicKey,
      })
    ) {
      throw new IntegrityError("Invalid update artifact signature.");
    }
    this.parseArtifact(bytes, manifest.version);
  }

  async install(
    manifest: UpdateManifest,
    artifactFile: string,
    options: { confirm?: boolean } = {},
  ): Promise<void> {
    if (options.confirm !== true) {
      throw new SecurityError("Update install requires explicit confirmation.");
    }
    assertUpdateAllowed({ manifest, state: await this.acceptedState() });
    await this.verify(manifest, artifactFile);
    const payload = this.parseArtifact(await fs.readFile(artifactFile), manifest.version);
    await this.ensurePrivateDir(this.config.stateDir);
    const staging = path.join(this.config.stateDir, `staging-${process.pid}-${Date.now()}`);
    const backup = path.join(this.config.stateDir, "backup-current");
    const next = path.join(this.config.stateDir, "next-installation");
    await fs.rm(staging, { recursive: true, force: true });
    await fs.rm(next, { recursive: true, force: true });
    await this.ensurePrivateDir(staging);
    try {
      await this.writeArtifactPayload(payload, staging);
      await fs.rm(backup, { recursive: true, force: true });
      await fs.cp(this.config.installDir, backup, { recursive: true, force: false });
      await fs.rename(staging, next);
      await fs.rm(this.config.installDir, { recursive: true, force: true });
      await fs.rename(next, this.config.installDir);
      await this.writeState({
        currentVersion: manifest.version,
        channel: manifest.channel,
        lastAcceptedReleaseSequence: manifest.releaseSequence,
      });
      await this.appendHistory({
        fromVersion: this.config.currentVersion,
        toVersion: manifest.version,
        channel: manifest.channel,
        releaseSequence: manifest.releaseSequence,
        signingKeyId: manifest.signingKeyId,
        artifactHash: this.selectArtifact(manifest).sha256,
        result: "installed",
        rollback: false,
      });
    } catch (error) {
      await fs.rm(staging, { recursive: true, force: true });
      await fs.rm(next, { recursive: true, force: true });
      await this.restoreBackupIfPresent(backup);
      await this.appendHistory({
        fromVersion: this.config.currentVersion,
        toVersion: manifest.version,
        channel: manifest.channel,
        releaseSequence: manifest.releaseSequence,
        signingKeyId: manifest.signingKeyId,
        artifactHash: this.selectArtifact(manifest).sha256,
        result: "failed",
        rollback: true,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async rollback(options: { confirm?: boolean } = {}): Promise<void> {
    if (options.confirm !== true) {
      throw new SecurityError("Update rollback requires explicit confirmation.");
    }
    const backup = path.join(this.config.stateDir, "backup-current");
    await fs.access(backup, constants.R_OK);
    await fs.rm(this.config.installDir, { recursive: true, force: true });
    await fs.cp(backup, this.config.installDir, { recursive: true, force: false });
    await this.writeState({
      currentVersion: this.config.currentVersion,
      channel: this.config.channel ?? "stable",
      lastAcceptedReleaseSequence: this.config.lastAcceptedReleaseSequence ?? 0,
      lastRollbackVersion: this.config.currentVersion,
    });
  }

  private async acceptedState(): Promise<AcceptedReleaseState> {
    const state = await this.readState();
    return {
      currentVersion: state.currentVersion,
      channel: state.channel,
      lastAcceptedReleaseSequence: state.lastAcceptedReleaseSequence,
    };
  }

  private async readState(): Promise<UpdateStatus> {
    try {
      return JSON.parse(
        await fs.readFile(path.join(this.config.stateDir, "update-state.json"), "utf8"),
      ) as UpdateStatus;
    } catch {
      return {
        currentVersion: this.config.currentVersion,
        channel: this.config.channel ?? "stable",
        lastAcceptedReleaseSequence: this.config.lastAcceptedReleaseSequence ?? 0,
      };
    }
  }

  private async writeState(state: UpdateStatus): Promise<void> {
    await this.ensurePrivateDir(this.config.stateDir);
    await this.atomicJson(path.join(this.config.stateDir, "update-state.json"), state);
  }

  private async appendHistory(entry: Record<string, unknown>): Promise<void> {
    const file = path.join(this.config.stateDir, "update-history.json");
    let current: unknown[];
    try {
      current = JSON.parse(await fs.readFile(file, "utf8")) as unknown[];
    } catch {
      current = [];
    }
    await this.atomicJson(file, [...current, { ...entry, date: new Date().toISOString() }]);
  }

  private async atomicJson(file: string, value: unknown): Promise<void> {
    await this.ensurePrivateDir(path.dirname(file));
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(tmp, file);
  }

  private selectArtifact(manifest: UpdateManifest): UpdateArtifact {
    const artifact = manifest.artifacts.find((item) => item.platform === this.config.platform);
    if (!artifact) throw new SecurityError(`No artifact for platform ${this.config.platform}.`);
    return artifact;
  }

  private assertAllowedUrl(rawUrl: string): void {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      throw new NetworkPolicyError(rawUrl, "updates require HTTPS except explicit localhost tests");
    }
    if (!this.config.allowedHosts.includes(url.hostname)) {
      throw new NetworkPolicyError(rawUrl, "host not allowlisted for updates");
    }
    if (url.username || url.password) {
      throw new NetworkPolicyError(rawUrl, "embedded credentials are not allowed");
    }
  }

  private parseArtifact(bytes: Uint8Array, version: string): ArtifactPayload {
    const parsedJson = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
    const result = artifactPayloadSchema.safeParse(parsedJson);
    if (!result.success) {
      throw new IntegrityError("Invalid update artifact schema.", {
        issues: result.error.issues.map((issue) => issue.message),
      });
    }

    const parsed = result.data;
    if (parsed.version !== version) {
      throw new IntegrityError("Update artifact metadata mismatch.");
    }
    for (const file of parsed.files) {
      this.safeRelativePath(file.path);
      if (file.mode !== undefined && (file.mode & 0o077) !== 0) {
        throw new SecurityError("Update artifact file permissions are too broad.", {
          path: file.path,
        });
      }
    }
    return parsed;
  }

  private async writeArtifactPayload(payload: ArtifactPayload, destination: string): Promise<void> {
    for (const file of payload.files) {
      const relative = this.safeRelativePath(file.path);
      const target = path.join(destination, relative);
      await this.ensurePrivateDir(path.dirname(target));
      await fs.writeFile(target, Buffer.from(file.contentBase64, "base64"), {
        mode: file.mode ?? 0o600,
      });
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink()) {
        throw new SecurityError("Update artifact created a symlink.", { path: file.path });
      }
    }
  }

  private safeRelativePath(value: string): string {
    if (value.includes("\0") || path.isAbsolute(value)) {
      throw new SecurityError("Unsafe update artifact path.", { path: value });
    }
    const normalized = path.normalize(value);
    if (
      normalized === "." ||
      normalized.startsWith("..") ||
      normalized.includes(`${path.sep}..${path.sep}`)
    ) {
      throw new SecurityError("Update artifact path traversal blocked.", { path: value });
    }
    return normalized;
  }

  private async ensurePrivateDir(directory: string): Promise<void> {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  }

  private async restoreBackupIfPresent(backup: string): Promise<void> {
    try {
      await fs.access(backup, constants.R_OK);
      await fs.rm(this.config.installDir, { recursive: true, force: true });
      await fs.cp(backup, this.config.installDir, { recursive: true, force: false });
    } catch {
      // No backup exists yet; preserve the original error path.
    }
  }
}
