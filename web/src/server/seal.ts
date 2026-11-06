import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Seals a value for a cookie: AES-256-GCM under the server's key, with the cookie's name as associated data so a sealed
 * value can't be moved into another cookie. Format: `v1.<iv>.<ciphertext+tag>`, base64url.
 */
const VERSION = "v1";

export function sealingKey(raw = process.env.WEB_SEALING_KEY): Buffer {
  const key = raw ? Buffer.from(raw, "base64url") : undefined;
  if (!key || key.length !== 32)
    throw new Error("WEB_SEALING_KEY must be 32 random bytes, base64url (see web/README.md)");
  return key;
}

export function seal(plaintext: string, context: string, key = sealingKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return `${VERSION}.${iv.toString("base64url")}.${body.toString("base64url")}`;
}

/** The plaintext, or undefined when the value was not sealed by this key for this context (tampered, moved, old key). */
export function unseal(sealed: string, context: string, key = sealingKey()): string | undefined {
  const [version, ivPart, bodyPart] = sealed.split(".");
  if (version !== VERSION || !ivPart || !bodyPart) return undefined;
  try {
    const iv = Buffer.from(ivPart, "base64url");
    const body = Buffer.from(bodyPart, "base64url");
    if (iv.length !== 12 || body.length < 17) return undefined;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(body.subarray(body.length - 16));
    return Buffer.concat([
      decipher.update(body.subarray(0, body.length - 16)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return undefined;
  }
}
