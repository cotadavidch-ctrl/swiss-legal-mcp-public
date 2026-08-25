import { z } from "zod";

const semver = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const base64Signature = z.string().min(64);
const channelSchema = z.enum(["stable", "rc", "beta", "alpha"]);
const platformSchema = z.enum([
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-x64",
  "win32-x64",
]);

export const securityAdvisorySchema = z
  .object({
    advisoryId: z.string().min(1),
    cve: z.string().min(1).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    affectedVersions: z.array(z.string().min(1)),
    fixedInVersion: semver,
    description: z.string().min(1).max(2_000),
    recommendedAction: z.string().min(1).max(2_000),
  })
  .strict();

export const updateArtifactSchema = z
  .object({
    platform: platformSchema,
    url: z.url().refine((value) => {
      return value.startsWith("https://") || value.startsWith("http://localhost:");
    }, "artifact URL must use HTTPS, except explicit local test fixtures"),
    sha256,
    size: z.number().int().positive().max(500_000_000),
    signature: base64Signature,
    contentType: z.enum(["application/gzip", "application/octet-stream"]),
  })
  .strict();

export const updateManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    project: z.literal("swiss-legal-mcp"),
    version: semver,
    channel: channelSchema,
    publishedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    minimumNodeVersion: z.string().regex(/^\d+(?:\.\d+){0,2}$/),
    maximumNodeVersion: z
      .string()
      .regex(/^\d+(?:\.\d+){0,2}$/)
      .optional(),
    mcpProtocolCompatibility: z
      .object({
        minimum: z.string().min(1),
        maximum: z.string().min(1),
      })
      .strict(),
    releaseSequence: z.number().int().positive(),
    artifacts: z.array(updateArtifactSchema).min(1).max(12),
    changelogUrl: z.url().optional(),
    securityAdvisories: z.array(securityAdvisorySchema).default([]),
    rollbackSupported: z.boolean(),
    signingKeyId: z.string().min(1).max(120),
  })
  .strict();

export const updateManifestEnvelopeSchema = z
  .object({
    manifest: updateManifestSchema,
    signature: base64Signature,
  })
  .strict();

export type UpdateArtifact = z.infer<typeof updateArtifactSchema>;
export type UpdateChannel = z.infer<typeof channelSchema>;
export type UpdateManifest = z.infer<typeof updateManifestSchema>;
export type UpdateManifestEnvelope = z.infer<typeof updateManifestEnvelopeSchema>;
