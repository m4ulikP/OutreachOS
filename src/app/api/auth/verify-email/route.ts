import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { consumeVerificationToken } from "@/lib/auth/tokens";
import { enforceAuthRateLimit } from "@/lib/rate-limit";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { extractRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { TokenType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  try {
    // 1. Rate limiting
    await enforceAuthRateLimit("resend-verification", req);

    // 2. Validate input
    const body = await req.json().catch(() => ({}));
    const { token, email } = verifyEmailSchema.parse(body);

    const normalizedEmail = email.toLowerCase().trim();

    // 3. Consume token (single-use validation against hashed token)
    const result = await consumeVerificationToken({
      identifier: normalizedEmail,
      rawToken: token,
      type: TokenType.EMAIL_VERIFICATION,
    });

    if (!result.valid) {
      if (result.reason === "EXPIRED") {
        throw new ValidationError("Verification link has expired. Please request a new verification email.");
      }
      throw new ValidationError("Invalid or already used verification token. Please request a new verification link.");
    }

    // 4. Update user emailVerified timestamp
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new ValidationError("No account found with this email address.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    logger.info("[Auth] User email verified successfully", {
      requestId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Your email has been verified successfully. You may now sign in.",
    });
  } catch (error: unknown) {
    return handleApiError(error, "Email verification failed", requestId);
  }
}
