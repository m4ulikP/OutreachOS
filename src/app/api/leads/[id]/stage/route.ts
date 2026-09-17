import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { cuidParamSchema } from "@/lib/validation/common";
import { stageTransitionSchema } from "@/lib/validation/lifecycle";
import { transitionLeadStage } from "@/lib/services/lifecycle-service";
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
        return handleApiError(
          idValidation.error,
          "Validation error in POST /api/leads/[id]/stage",
          requestId
        );
      }
      const leadId = idValidation.data;

      // Safely parse JSON body
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

      // Validate body
      const bodyValidation = stageTransitionSchema.safeParse(body);
      if (!bodyValidation.success) {
        return handleApiError(
          bodyValidation.error,
          "Validation error in POST /api/leads/[id]/stage",
          requestId
        );
      }

      const { stage, notes, reason } = bodyValidation.data;

      // Execute centralized stage transition
      const result = await transitionLeadStage(user.id, leadId, stage, {
        notes,
        reason,
        source: "API Route",
      });

      logger.info("Lead stage transition requested via API", {
        userId: user.id,
        leadId,
        targetStage: stage,
        transitioned: result.transitioned,
        requestId,
      });

      return NextResponse.json(
        {
          success: true,
          lead: result.lead,
          interaction: result.interaction,
          transitioned: result.transitioned,
          message: result.message,
          requestId,
        },
        { status: 200 }
      );
    } catch (error: unknown) {
      return handleApiError(
        error,
        `POST /api/leads/${params?.id}/stage error`,
        requestId
      );
    }
  }
);
