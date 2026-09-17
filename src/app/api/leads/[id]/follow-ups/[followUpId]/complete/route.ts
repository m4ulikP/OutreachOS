import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser, NotFoundError } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { cuidParamSchema } from "@/lib/validation/common";
import { completeFollowUpSchema } from "@/lib/validation/lifecycle";
import { completeFollowUp } from "@/lib/services/lifecycle-service";
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

      // Ensure follow-up belongs to lead and tenant
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

      let notes: string | undefined;
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await req.json().catch(() => ({}));
        const bodyValidation = completeFollowUpSchema.safeParse(body);
        if (bodyValidation.success) {
          notes = bodyValidation.data.notes;
        }
      }

      const completed = await completeFollowUp(user.id, followUpId, notes);

      logger.info("Follow-up marked as completed", {
        userId: user.id,
        leadId,
        followUpId,
        requestId,
      });

      return NextResponse.json({
        success: true,
        followUp: completed,
        requestId,
      });
    } catch (error: unknown) {
      return handleApiError(
        error,
        `POST /api/leads/${params?.id}/follow-ups/${params?.followUpId}/complete error`,
        requestId
      );
    }
  }
);
