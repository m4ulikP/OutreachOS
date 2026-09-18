import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthUser } from "@/lib/auth/session";
import { changePasswordSchema } from "@/lib/validation/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { enforceAuthRateLimit } from "@/lib/rate-limit";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { extractRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  try {
    // 1. Enforce authentication
    const user = await requireAuthUser(req);

    // 2. Rate limiting
    await enforceAuthRateLimit("change-password", req, user.id);

    // 3. Validate input
    const body = await req.json().catch(() => ({}));
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    // 4. Fetch current user from DB
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      throw new ValidationError("User account not found.");
    }

    // 5. Verify current password if user has a password set
    if (dbUser.passwordHash) {
      const isMatch = await verifyPassword(currentPassword, dbUser.passwordHash);
      if (!isMatch) {
        throw new ValidationError("Current password is incorrect.");
      }
    }

    // 6. Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // 7. Update password and bump sessionVersion to revoke other active sessions
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        passwordHash: newPasswordHash,
        sessionVersion: { increment: 1 },
      },
    });

    logger.info("[Auth] Password changed successfully and sessions refreshed", {
      requestId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error: unknown) {
    return handleApiError(error, "Password change failed", requestId);
  }
}
