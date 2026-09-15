import * as argon2 from "argon2";

// argon2id: resistant to both GPU cracking and side-channel attacks,
// the OWASP-recommended variant for password hashing.
const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MiB, OWASP minimum recommendation
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, HASH_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  plaintext: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    // Malformed hash (shouldn't happen for our own hashes) fails closed.
    return false;
  }
}
