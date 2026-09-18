import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resendVerificationSchema } from "@/lib/validation/auth";
import { createVerificationToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { enforceAuthRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-response";
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
    const { email } = resendVerificationSchema.parse(body);

    const normalizedEmail = email.toLowerCase().trim();

    // 3. Look up user (safe against account enumeration: always return the same success message)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user && !user.emailVerified) {
      // 4. Issue fresh verification token
      const { rawToken } = await createVerificationToken({
        identifier: normalizedEmail,
        type: TokenType.EMAIL_VERIFICATION,
        expiresInMs: 24 * 60 * 60 * 1000, // 24 hours
      });

      // 5. Send email
      await sendVerificationEmail({
        email: normalizedEmail,
        rawToken,
        name: user.name,
      });

      logger.info("[Auth] Resent verification email", {
        requestId,
        userId: user.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: "If an unverified account exists with that email address, a new verification link has been sent.",
    });
  } catch (error: unknown) {
    return handleApiError(error, "Resend verification failed", requestId);
  }
}
