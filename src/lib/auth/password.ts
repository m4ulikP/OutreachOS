import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/**
 * Securely hashes a plain-text password using bcrypt with cost factor 12.
 * Never logs or exposes the plain-text password.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Securely verifies a plain-text password against a bcrypt hash.
 * Constant-time comparison handled internally by bcrypt.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
