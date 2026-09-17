import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser, assertResourceOwnership, NotFoundError } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api-response";
import { removeTagFromLead } from "@/lib/services/lead-service";
import { prisma } from "@/lib/db";
import { cuidParamSchema } from "@/lib/validation/common";
import { withApiObservability } from "@/lib/api-wrapper";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: { id: string; tagId: string };
}

export const dynamic = "force-dynamic";

export const DELETE = withApiObservability<RouteParams>(
  async (req: NextRequest, { params }, { requestId }) => {
    try {
      const user = await requireAuthUser(req);

      // 1. Validate route parameters
      const leadIdValidation = cuidParamSchema.safeParse(params?.id);
      if (!leadIdValidation.success) {
        return handleApiError(leadIdValidation.error, "Validation error: invalid lead ID", requestId);
      }
      const leadId = leadIdValidation.data;

      const tagIdValidation = cuidParamSchema.safeParse(params?.tagId);
      if (!tagIdValidation.success) {
        return handleApiError(tagIdValidation.error, "Validation error: invalid tag ID", requestId);
      }
      const tagId = tagIdValidation.data;

      // 2. Verify lead existence and ownership
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, userId: true },
      });

      if (!lead) {
        throw new NotFoundError("Lead not found");
      }

      assertResourceOwnership(lead.userId, user.id);

      // 3. Verify tag existence and ownership
      const tag = await prisma.leadTag.findUnique({
        where: { id: tagId },
        select: { id: true, userId: true },
      });

      if (!tag) {
        throw new NotFoundError("Tag not found");
      }

      assertResourceOwnership(tag.userId, user.id);

      // 4. Remove tag assignment
      const result = await removeTagFromLead(user.id, leadId, tagId);

      logger.info("Tag removed from lead", {
        userId: user.id,
        leadId,
        tagId,
        requestId,
      });

      return NextResponse.json(result);
    } catch (error: unknown) {
      return handleApiError(error, `DELETE /api/leads/${params?.id}/tags/${params?.tagId} error`, requestId);
    }
  }
);
