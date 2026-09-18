import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { createVerificationToken } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { enforceAuthRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-response";
import { extractRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { TokenType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  try {
    // 1. Rate limiting
    await enforceAuthRateLimit("forgot-password", req);

    // 2. Validate input
    const body = await req.json().catch(() => ({}));
    const { email } = forgotPasswordSchema.parse(body);

    const normalizedEmail = email.toLowerCase().trim();

    // 3. Find user (safe against enumeration: response is identical whether user exists or not)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      // 4. Generate 1-hour single-use reset token (hashed in DB)
      const { rawToken } = await createVerificationToken({
        identifier: normalizedEmail,
        type: TokenType.PASSWORD_RESET,
        expiresInMs: 60 * 60 * 1000, // 1 hour
      });

      // 5. Send password reset email
      await sendPasswordResetEmail({
        email: normalizedEmail,
        rawToken,
        name: user.name,
      });

      logger.info("[Auth] Password reset requested", {
        requestId,
        userId: user.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists with that email address, a password reset link has been sent.",
    });
  } catch (error: unknown) {
    return handleApiError(error, "Forgot password request failed", requestId);
  }
}
