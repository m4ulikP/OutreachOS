import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser, assertResourceOwnership, NotFoundError } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { assignTagToLead } from "@/lib/services/lead-service";
import { prisma } from "@/lib/db";
import { cuidParamSchema } from "@/lib/validation/common";
import { assignTagSchema } from "@/lib/validation/tags";
import { withApiObservability } from "@/lib/api-wrapper";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export const POST = withApiObservability<RouteParams>(
  async (req: NextRequest, { params }, { requestId }) => {
    try {
      const user = await requireAuthUser(req);

      // Validate route parameter
      const idValidation = cuidParamSchema.safeParse(params?.id);
      if (!idValidation.success) {
        return handleApiError(idValidation.error, "Validation error in POST /api/leads/[id]/tags", requestId);
      }
      const leadId = idValidation.data;

      // 1. Verify existence and enforce lead ownership
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, userId: true },
      });

      if (!lead) {
        throw new NotFoundError("Lead not found");
      }

      assertResourceOwnership(lead.userId, user.id);

      // 2. Validate body
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return handleApiError(new ValidationError("Invalid JSON in request body"), undefined, requestId);
      }

      const bodyValidation = assignTagSchema.safeParse(body);
      if (!bodyValidation.success) {
        return handleApiError(bodyValidation.error, "Validation error in POST /api/leads/[id]/tags", requestId);
      }

      const { tagId } = bodyValidation.data;

      // 3. Verify tag exists and enforce tag ownership
      const tag = await prisma.leadTag.findUnique({
        where: { id: tagId },
        select: { id: true, userId: true },
      });

      if (!tag) {
        throw new NotFoundError("Tag not found");
      }

      assertResourceOwnership(tag.userId, user.id);

      // 4. Assign tag to lead
      const result = await assignTagToLead(user.id, leadId, tagId);

      logger.info("Tag assigned to lead", {
        userId: user.id,
        leadId,
        tagId,
        requestId,
      });

      return NextResponse.json(result, { status: 201 });
    } catch (error: unknown) {
      return handleApiError(error, `POST /api/leads/${params?.id}/tags error`, requestId);
    }
  }
);
