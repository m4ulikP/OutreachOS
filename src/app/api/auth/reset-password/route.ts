import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { consumeVerificationToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { enforceAuthRateLimit } from "@/lib/rate-limit";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { extractRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { TokenType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  try {
    // 1. Rate limiting
    await enforceAuthRateLimit("reset-password", req);

    // 2. Validate input
    const body = await req.json().catch(() => ({}));
    const { token, email, password } = resetPasswordSchema.parse(body);

    const normalizedEmail = email.toLowerCase().trim();

    // 3. Consume token (single-use validation against hashed token)
    const result = await consumeVerificationToken({
      identifier: normalizedEmail,
      rawToken: token,
      type: TokenType.PASSWORD_RESET,
    });

    if (!result.valid) {
      if (result.reason === "EXPIRED") {
        throw new ValidationError("Password reset link has expired. Please request a new password reset.");
      }
      throw new ValidationError("Invalid or already used password reset token. Please request a new reset link.");
    }

    // 4. Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new ValidationError("No account found with this email address.");
    }

    // 5. Hash new password
    const newPasswordHash = await hashPassword(password);

    // 6. Update user password and increment sessionVersion (revokes all active sessions!)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        emailVerified: user.emailVerified || new Date(),
        sessionVersion: { increment: 1 },
      },
    });

    logger.info("[Auth] Password reset successfully and prior sessions revoked", {
      requestId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You may now sign in with your new password.",
    });
  } catch (error: unknown) {
    return handleApiError(error, "Password reset failed", requestId);
  }
}
