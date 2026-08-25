import { createHash } from "node:crypto";

/** Hash sha256 en hexadecimal, usado por SecureHttpClient para poblar `provenance.contentHash`. */
export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
