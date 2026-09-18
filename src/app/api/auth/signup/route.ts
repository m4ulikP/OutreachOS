import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signupSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { createVerificationToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { enforceAuthRateLimit } from "@/lib/rate-limit";
import { handleApiError, ConflictError } from "@/lib/api-response";
import { extractRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { TokenType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  try {
    // 1. Rate limiting
    await enforceAuthRateLimit("signup", req);

    // 2. Validation
    const body = await req.json().catch(() => ({}));
    const validated = signupSchema.parse(body);

    const email = validated.email.toLowerCase().trim();

    // 3. Prevent duplicate accounts
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (existing) {
      // Safe 409 Conflict without revealing unnecessary account details
      throw new ConflictError("An account with this email address already exists. Please sign in instead.");
    }

    // 4. Hash password
    const passwordHash = await hashPassword(validated.password);

    // 5. Create user and verification token in transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: validated.name.trim(),
          email,
          passwordHash,
          sessionVersion: 1,
        },
      });

      return user;
    });

    // 6. Generate single-use verification token (hashed at rest)
    const { rawToken } = await createVerificationToken({
      identifier: email,
      type: TokenType.EMAIL_VERIFICATION,
      expiresInMs: 24 * 60 * 60 * 1000, // 24 hours
    });

    // 7. Dispatch verification email
    await sendVerificationEmail({
      email,
      rawToken,
      name: newUser.name,
    });

    logger.info("[Auth] New user registered successfully", {
      requestId,
      userId: newUser.id,
      emailDomain: email.split("@")[1],
    });

    // Return sanitized response (never expose password, passwordHash, or raw token in response)
    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully. Please check your email to verify your account.",
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return handleApiError(error, "User registration failed", requestId);
  }
}
