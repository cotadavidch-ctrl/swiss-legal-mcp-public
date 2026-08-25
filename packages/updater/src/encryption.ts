import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt as scryptCallback,
  type ScryptOptions,
} from "node:crypto";
import { IntegrityError } from "@swiss-legal-mcp/core";

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;
const KEY_BYTES = 32;

function scrypt(
  password: string,
  salt: Uint8Array,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export interface EncryptedObject {
  readonly schemaVersion: 1;
  readonly algorithm: "AES-256-GCM";
  readonly keyId: string;
  readonly nonce: string;
  readonly ciphertext: string;
  readonly authTag: string;
  readonly createdAt: string;
}

export async function deriveKeyWithScrypt(params: {
  readonly password: string;
  readonly salt: Uint8Array;
  readonly cost?: number;
  readonly blockSize?: number;
  readonly parallelization?: number;
}): Promise<Buffer> {
  return scrypt(params.password, params.salt, KEY_BYTES, {
    N: params.cost ?? 16_384,
    r: params.blockSize ?? 8,
    p: params.parallelization ?? 1,
    maxmem: 64 * 1024 * 1024,
  });
}

export function encryptAead(params: {
  readonly plaintext: Uint8Array | string;
  readonly key: Uint8Array;
  readonly keyId: string;
  readonly aad?: Uint8Array | string;
  readonly now?: Date;
}): EncryptedObject {
  assertKey(params.key);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, params.key, nonce);
  if (params.aad !== undefined) cipher.setAAD(Buffer.from(params.aad));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(params.plaintext)), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    schemaVersion: 1,
    algorithm: "AES-256-GCM",
    keyId: params.keyId,
    nonce: nonce.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: authTag.toString("base64"),
    createdAt: (params.now ?? new Date()).toISOString(),
  };
}

export function decryptAead(params: {
  readonly encrypted: EncryptedObject;
  readonly key: Uint8Array;
  readonly aad?: Uint8Array | string;
}): Buffer {
  assertKey(params.key);
  if (params.encrypted.schemaVersion !== 1 || params.encrypted.algorithm !== "AES-256-GCM") {
    throw new IntegrityError("Unsupported encrypted object format.");
  }
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      params.key,
      Buffer.from(params.encrypted.nonce, "base64"),
    );
    if (params.aad !== undefined) decipher.setAAD(Buffer.from(params.aad));
    decipher.setAuthTag(Buffer.from(params.encrypted.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(params.encrypted.ciphertext, "base64")),
      decipher.final(),
    ]);
  } catch (error) {
    throw new IntegrityError("Encrypted object authentication failed.", undefined, {
      cause: error,
    });
  }
}

export function rotateEncryptedObject(params: {
  readonly encrypted: EncryptedObject;
  readonly oldKey: Uint8Array;
  readonly newKey: Uint8Array;
  readonly newKeyId: string;
  readonly aad?: Uint8Array | string;
}): EncryptedObject {
  const plaintext = decryptAead({
    encrypted: params.encrypted,
    key: params.oldKey,
    ...(params.aad !== undefined ? { aad: params.aad } : {}),
  });
  return encryptAead({
    plaintext,
    key: params.newKey,
    keyId: params.newKeyId,
    ...(params.aad !== undefined ? { aad: params.aad } : {}),
  });
}

function assertKey(key: Uint8Array): void {
  if (key.byteLength !== KEY_BYTES) {
    throw new IntegrityError(`Invalid AES-256-GCM key length: ${key.byteLength} bytes.`);
  }
}
