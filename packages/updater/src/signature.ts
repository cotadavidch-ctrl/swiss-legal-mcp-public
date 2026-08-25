import { createHash, verify } from "node:crypto";
import { IntegrityError, SecurityError } from "@swiss-legal-mcp/core";
import { updateManifestEnvelopeSchema, type UpdateManifestEnvelope } from "./manifest.js";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function verifyEd25519Signature(params: {
  readonly payload: Uint8Array | string;
  readonly signatureBase64: string;
  readonly publicKeyPem: string;
}): boolean {
  return verify(
    null,
    Buffer.from(params.payload),
    params.publicKeyPem,
    Buffer.from(params.signatureBase64, "base64"),
  );
}

export function verifyManifestEnvelope(params: {
  readonly envelope: unknown;
  readonly publicKeys: ReadonlyMap<string, string>;
  readonly revokedKeyIds?: ReadonlySet<string>;
}): UpdateManifestEnvelope {
  const parsed = updateManifestEnvelopeSchema.safeParse(params.envelope);
  if (!parsed.success) {
    throw new SecurityError("Invalid update manifest schema", {
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    });
  }

  const keyId = parsed.data.manifest.signingKeyId;
  if (params.revokedKeyIds?.has(keyId)) {
    throw new SecurityError("Update manifest signing key is revoked", { signingKeyId: keyId });
  }
  const publicKey = params.publicKeys.get(keyId);
  if (!publicKey) {
    throw new IntegrityError(`Unknown update signing key '${keyId}'.`, { signingKeyId: keyId });
  }
  const ok = verifyEd25519Signature({
    payload: canonicalJson(parsed.data.manifest),
    signatureBase64: parsed.data.signature,
    publicKeyPem: publicKey,
  });
  if (!ok) {
    throw new IntegrityError("Invalid update manifest signature.", { signingKeyId: keyId });
  }
  return parsed.data;
}
