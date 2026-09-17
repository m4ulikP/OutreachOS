import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser, assertResourceOwnership, NotFoundError } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { addLeadInteraction, listLeadInteractions } from "@/lib/services/lead-service";
import { prisma } from "@/lib/db";
import { cuidParamSchema } from "@/lib/validation/common";
import { createInteractionSchema, listInteractionsQuerySchema } from "@/lib/validation/interactions";
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
        return handleApiError(idValidation.error, "Validation error in POST interaction", requestId);
      }
      const leadId = idValidation.data;

      // 1. Verify existence and enforce resource ownership
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, userId: true },
      });

      if (!lead) {
        throw new NotFoundError("Lead not found");
      }

      assertResourceOwnership(lead.userId, user.id);

      // 2. Safely parse and validate JSON body
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return handleApiError(new ValidationError("Invalid JSON in request body"), undefined, requestId);
      }

      const validation = createInteractionSchema.safeParse(body);
      if (!validation.success) {
        return handleApiError(validation.error, "Validation error in POST interaction", requestId);
      }

      const { type, title, description } = validation.data;

      const interaction = await addLeadInteraction(
        user.id,
        leadId,
        type,
        title,
        description
      );

      logger.info("Lead interaction recorded", {
        userId: user.id,
        leadId,
        interactionId: interaction.id,
        type,
        requestId,
      });

      return NextResponse.json({ interaction }, { status: 201 });
    } catch (error: unknown) {
      return handleApiError(error, `POST /api/leads/${params?.id}/interactions error`, requestId);
    }
  }
);

export const GET = withApiObservability<RouteParams>(
  async (req: NextRequest, { params }, { requestId }) => {
    try {
      const user = await requireAuthUser(req);

      // Validate route parameter
      const idValidation = cuidParamSchema.safeParse(params?.id);
      if (!idValidation.success) {
        return handleApiError(idValidation.error, "Validation error in GET interactions", requestId);
      }
      const leadId = idValidation.data;

      // 1. Verify existence and enforce resource ownership
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, userId: true },
      });

      if (!lead) {
        throw new NotFoundError("Lead not found");
      }

      assertResourceOwnership(lead.userId, user.id);

      // 2. Validate query parameters
      const { searchParams } = new URL(req.url);
      const rawQuery: Record<string, string> = {};
      for (const [key, value] of searchParams.entries()) {
        if (value !== "") {
          rawQuery[key] = value;
        }
      }

      const queryValidation = listInteractionsQuerySchema.safeParse(rawQuery);
      if (!queryValidation.success) {
        return handleApiError(queryValidation.error, "Validation error in GET interactions", requestId);
      }

      const query = queryValidation.data;
      const result = await listLeadInteractions(user.id, leadId, query);

      return NextResponse.json(result);
    } catch (error: unknown) {
      return handleApiError(error, `GET /api/leads/${params?.id}/interactions error`, requestId);
    }
  }
);
