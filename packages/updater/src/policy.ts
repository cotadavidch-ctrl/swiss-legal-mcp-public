import { SecurityError } from "@swiss-legal-mcp/core";
import type { UpdateChannel, UpdateManifest } from "./manifest.js";

export interface AcceptedReleaseState {
  readonly currentVersion: string;
  readonly channel: UpdateChannel;
  readonly lastAcceptedReleaseSequence: number;
}

export interface UpdatePolicyDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

export function compareSemver(left: string, right: string): number {
  const [leftCore, leftPre] = left.split("-");
  const [rightCore, rightPre] = right.split("-");
  const leftParts = leftCore!.split(".").map(Number);
  const rightParts = rightCore!.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  if (leftPre === rightPre) return 0;
  if (!leftPre) return 1;
  if (!rightPre) return -1;
  return leftPre.localeCompare(rightPre);
}

export function evaluateUpdatePolicy(params: {
  readonly manifest: UpdateManifest;
  readonly state: AcceptedReleaseState;
  readonly now?: Date;
  readonly allowDowngrade?: boolean;
  readonly explicitChannelChange?: boolean;
}): UpdatePolicyDecision {
  const now = params.now ?? new Date();
  const publishedAt = new Date(params.manifest.publishedAt);
  const expiresAt = new Date(params.manifest.expiresAt);
  if (expiresAt.getTime() <= now.getTime()) {
    return { allowed: false, reason: "manifest_expired" };
  }
  if (publishedAt.getTime() - now.getTime() > 10 * 60 * 1000) {
    return { allowed: false, reason: "manifest_from_future" };
  }
  if (params.manifest.releaseSequence <= params.state.lastAcceptedReleaseSequence) {
    return { allowed: false, reason: "release_sequence_replay" };
  }
  if (params.manifest.channel !== params.state.channel && params.explicitChannelChange !== true) {
    return { allowed: false, reason: "channel_change_requires_confirmation" };
  }
  if (
    params.state.channel === "stable" &&
    params.manifest.channel !== "stable" &&
    params.explicitChannelChange !== true
  ) {
    return { allowed: false, reason: "stable_to_prerelease_requires_confirmation" };
  }
  if (
    compareSemver(params.manifest.version, params.state.currentVersion) <= 0 &&
    params.allowDowngrade !== true
  ) {
    return { allowed: false, reason: "downgrade_or_same_version" };
  }
  return { allowed: true, reason: "allowed" };
}

export function assertUpdateAllowed(params: Parameters<typeof evaluateUpdatePolicy>[0]): void {
  const decision = evaluateUpdatePolicy(params);
  if (!decision.allowed) {
    throw new SecurityError(`Update rejected: ${decision.reason}`, { reason: decision.reason });
  }
}
