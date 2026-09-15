import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Deterministic lookup hash for opaque tokens (refresh tokens, invite/reset tokens). Not for passwords — use argon2 for those. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Constant-time string comparison, for CSRF token / token-equality checks. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Hashes IP/user-agent for audit log storage — never store raw identifiers. */
export function hashIdentifier(
  value: string | undefined | null,
): string | undefined {
  if (!value) return undefined;
  return sha256Hex(value);
}
