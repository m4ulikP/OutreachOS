import crypto from "crypto";
import { prisma } from "@/lib/db";
import { TokenType } from "@prisma/client";

/**
 * Generates a cryptographically secure random token (256 bits entropy).
 * Returns the raw token (to be sent via email) and its SHA-256 hash (to be stored in DB).
 * Raw tokens must NEVER be stored in the database.
 */
export function generateSecureToken(): { rawToken: string; hashedToken: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(rawToken);
  return { rawToken, hashedToken };
}

/**
 * Computes deterministic SHA-256 hash of a raw token for storage and lookup.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

/**
 * Creates and persists a hashed verification token in the database.
 * Replaces any existing unconsumed tokens for the same identifier and type.
 */
export async function createVerificationToken(params: {
  identifier: string;
  type: TokenType;
  expiresInMs: number;
}): Promise<{ rawToken: string; expires: Date }> {
  const { identifier, type, expiresInMs } = params;
  const normalizedEmail = identifier.toLowerCase().trim();
  const { rawToken, hashedToken } = generateSecureToken();
  const expires = new Date(Date.now() + expiresInMs);

  // Invalidate previous tokens of the same type for this identifier
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: normalizedEmail,
      type,
    },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: normalizedEmail,
      token: hashedToken,
      type,
      expires,
    },
  });

  return { rawToken, expires };
}

/**
 * Validates a submitted raw token against its stored hash in the database.
 * Enforces single-use semantics: deletes token upon successful validation.
 * Rejects expired tokens and removes them.
 */
export async function consumeVerificationToken(params: {
  identifier: string;
  rawToken: string;
  type: TokenType;
}): Promise<{ valid: boolean; reason?: "INVALID" | "EXPIRED" | "NOT_FOUND" }> {
  const normalizedEmail = params.identifier.toLowerCase().trim();
  const hashedToken = hashToken(params.rawToken);

  const record = await prisma.verificationToken.findFirst({
    where: {
      identifier: normalizedEmail,
      token: hashedToken,
      type: params.type,
    },
  });

  if (!record) {
    return { valid: false, reason: "NOT_FOUND" };
  }

  // Check expiration
  if (record.expires < new Date()) {
    // Delete expired token
    await prisma.verificationToken.delete({
      where: { id: record.id },
    }).catch(() => {});
    return { valid: false, reason: "EXPIRED" };
  }

  // Token is valid; enforce single-use by immediately deleting it
  await prisma.verificationToken.delete({
    where: { id: record.id },
  });

  return { valid: true };
}
