import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { cuidParamSchema } from "@/lib/validation/common";
import { createFollowUpSchema } from "@/lib/validation/lifecycle";
import {
  createFollowUp,
  listLeadFollowUps,
} from "@/lib/services/lifecycle-service";
import { withApiObservability } from "@/lib/api-wrapper";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export const GET = withApiObservability<RouteParams>(
  async (req: NextRequest, { params }, { requestId }) => {
    try {
      const user = await requireAuthUser(req);

      const idValidation = cuidParamSchema.safeParse(params?.id);
      if (!idValidation.success) {
        return handleApiError(
          idValidation.error,
          "Validation error in GET /api/leads/[id]/follow-ups",
          requestId
        );
      }
      const leadId = idValidation.data;

      const followUps = await listLeadFollowUps(user.id, leadId);

      return NextResponse.json({
        success: true,
        followUps,
        total: followUps.length,
        requestId,
      });
    } catch (error: unknown) {
      return handleApiError(
        error,
        `GET /api/leads/${params?.id}/follow-ups error`,
        requestId
      );
    }
  }
);

export const POST = withApiObservability<RouteParams>(
  async (req: NextRequest, { params }, { requestId }) => {
    try {
      const user = await requireAuthUser(req);

      const idValidation = cuidParamSchema.safeParse(params?.id);
      if (!idValidation.success) {
        return handleApiError(
          idValidation.error,
          "Validation error in POST /api/leads/[id]/follow-ups",
          requestId
        );
      }
      const leadId = idValidation.data;

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

      const bodyValidation = createFollowUpSchema.safeParse(body);
      if (!bodyValidation.success) {
        return handleApiError(
          bodyValidation.error,
          "Validation error in POST /api/leads/[id]/follow-ups",
          requestId
        );
      }

      const followUp = await createFollowUp(user.id, leadId, bodyValidation.data);

      logger.info("Follow-up created successfully", {
        userId: user.id,
        leadId,
        followUpId: followUp.id,
        stepNumber: followUp.stepNumber,
        scheduledFor: followUp.scheduledFor,
        requestId,
      });

      return NextResponse.json(
        {
          success: true,
          followUp,
          requestId,
        },
        { status: 201 }
      );
    } catch (error: unknown) {
      return handleApiError(
        error,
        `POST /api/leads/${params?.id}/follow-ups error`,
        requestId
      );
    }
  }
);
