import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { env } from "@/lib/env";

/**
 * Symmetric encryption for Whoop OAuth tokens stored at rest.
 *
 * AES-256-GCM. The 256-bit key is derived from `ENCRYPTION_KEY` via SHA-256 so
 * any sufficiently random secret works. Output layout (base64):
 *   [ 12-byte IV | 16-byte auth tag | ciphertext ]
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | undefined;

/**
 * Derived on first use, not at import: `next build` loads the modules that
 * reach this one, and reading ENCRYPTION_KEY there would make the build
 * require it. See docs/DECISIONS.md, ADR-0003.
 */
function getKey(): Buffer {
  return (cachedKey ??= createHash("sha256")
    .update(env.ENCRYPTION_KEY)
    .digest());
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decrypt(payload: string): string {
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
