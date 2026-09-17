import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser, NotFoundError } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { cuidParamSchema } from "@/lib/validation/common";
import { cancelFollowUpSchema } from "@/lib/validation/lifecycle";
import { cancelFollowUp } from "@/lib/services/lifecycle-service";
import { prisma } from "@/lib/db";
import { withApiObservability } from "@/lib/api-wrapper";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: { id: string; followUpId: string };
}

export const dynamic = "force-dynamic";

export const POST = withApiObservability<RouteParams>(
  async (req: NextRequest, { params }, { requestId }) => {
    try {
      const user = await requireAuthUser(req);

      const leadIdValidation = cuidParamSchema.safeParse(params?.id);
      const followUpIdValidation = cuidParamSchema.safeParse(params?.followUpId);

      if (!leadIdValidation.success || !followUpIdValidation.success) {
        return handleApiError(
          new ValidationError("Invalid lead or follow-up ID parameter"),
          undefined,
          requestId
        );
      }

      const leadId = leadIdValidation.data;
      const followUpId = followUpIdValidation.data;

      // Verify follow-up belongs to lead and tenant
      const existing = await prisma.followUp.findFirst({
        where: {
          id: followUpId,
          leadId,
          lead: { userId: user.id },
        },
      });

      if (!existing) {
        throw new NotFoundError("Follow-up not found or unauthorized for this lead");
      }

      let reason: string | undefined;
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await req.json().catch(() => ({}));
        const bodyValidation = cancelFollowUpSchema.safeParse(body);
        if (bodyValidation.success) {
          reason = bodyValidation.data.reason;
        }
      }

      const cancelled = await cancelFollowUp(user.id, followUpId, reason);

      logger.info("Follow-up cancelled", {
        userId: user.id,
        leadId,
        followUpId,
        requestId,
      });

      return NextResponse.json({
        success: true,
        followUp: cancelled,
        requestId,
      });
    } catch (error: unknown) {
      return handleApiError(
        error,
        `POST /api/leads/${params?.id}/follow-ups/${params?.followUpId}/cancel error`,
        requestId
      );
    }
  }
);
