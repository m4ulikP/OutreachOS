import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser, NotFoundError } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { cuidParamSchema } from "@/lib/validation/common";
import { updateFollowUpSchema } from "@/lib/validation/lifecycle";
import { updateFollowUp } from "@/lib/services/lifecycle-service";
import { prisma } from "@/lib/db";
import { withApiObservability } from "@/lib/api-wrapper";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: { id: string; followUpId: string };
}

export const dynamic = "force-dynamic";

export const PATCH = withApiObservability<RouteParams>(
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

      // Verify that follow-up belongs to the specific lead and the authenticated user
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

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return handleApiError(
          new ValidationError("Invalid JSON in request body"),
          undefined,
          requestId
        );
      }

      const bodyValidation = updateFollowUpSchema.safeParse(body);
      if (!bodyValidation.success) {
        return handleApiError(
          bodyValidation.error,
          "Validation error in PATCH follow-up",
          requestId
        );
      }

      const updated = await updateFollowUp(
        user.id,
        followUpId,
        bodyValidation.data
      );

      logger.info("Follow-up updated successfully", {
        userId: user.id,
        leadId,
        followUpId,
        requestId,
      });

      return NextResponse.json({
        success: true,
        followUp: updated,
        requestId,
      });
    } catch (error: unknown) {
      return handleApiError(
        error,
        `PATCH /api/leads/${params?.id}/follow-ups/${params?.followUpId} error`,
        requestId
      );
    }
  }
);
