import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser, assertResourceOwnership, NotFoundError } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { getLeadById, updateLead, deleteLead } from "@/lib/services/lead-service";
import { prisma } from "@/lib/db";
import { cuidParamSchema } from "@/lib/validation/common";
import { updateLeadSchema } from "@/lib/validation/leads";
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

      // Validate route parameter
      const idValidation = cuidParamSchema.safeParse(params?.id);
      if (!idValidation.success) {
        return handleApiError(idValidation.error, "Validation error in GET /api/leads/[id]", requestId);
      }
      const leadId = idValidation.data;

      // 1. Verify existence and enforce resource ownership
      const existing = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, userId: true },
      });

      if (!existing) {
        throw new NotFoundError("Lead not found");
      }

      assertResourceOwnership(existing.userId, user.id);

      // 2. Fetch full scoped lead
      const lead = await getLeadById(user.id, leadId);
      return NextResponse.json({ lead });
    } catch (error: unknown) {
      return handleApiError(error, `GET /api/leads/${params?.id} error`, requestId);
    }
  }
);

export const PATCH = withApiObservability<RouteParams>(
  async (req: NextRequest, { params }, { requestId }) => {
    try {
      const user = await requireAuthUser(req);

      // Validate route parameter
      const idValidation = cuidParamSchema.safeParse(params?.id);
      if (!idValidation.success) {
        return handleApiError(idValidation.error, "Validation error in PATCH /api/leads/[id]", requestId);
      }
      const leadId = idValidation.data;

      // Validate body
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return handleApiError(new ValidationError("Invalid JSON in request body"), undefined, requestId);
      }

      const bodyValidation = updateLeadSchema.safeParse(body);
      if (!bodyValidation.success) {
        return handleApiError(bodyValidation.error, "Validation error in PATCH /api/leads/[id]", requestId);
      }

      const validatedData = bodyValidation.data;

      // 1. Verify existence and enforce resource ownership
      const existing = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, userId: true },
      });

      if (!existing) {
        throw new NotFoundError("Lead not found");
      }

      assertResourceOwnership(existing.userId, user.id);

      // 2. Update lead with validated fields
      const updated = await updateLead(user.id, leadId, validatedData);

      logger.info("Lead updated successfully", {
        userId: user.id,
        leadId,
        requestId,
      });

      return NextResponse.json({ lead: updated });
    } catch (error: unknown) {
      return handleApiError(error, `PATCH /api/leads/${params?.id} error`, requestId);
    }
  }
);

export const DELETE = withApiObservability<RouteParams>(
  async (req: NextRequest, { params }, { requestId }) => {
    try {
      const user = await requireAuthUser(req);

      // Validate route parameter
      const idValidation = cuidParamSchema.safeParse(params?.id);
      if (!idValidation.success) {
        return handleApiError(idValidation.error, "Validation error in DELETE /api/leads/[id]", requestId);
      }
      const leadId = idValidation.data;

      // 1. Verify existence and enforce resource ownership
      const existing = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, userId: true },
      });

      if (!existing) {
        throw new NotFoundError("Lead not found");
      }

      assertResourceOwnership(existing.userId, user.id);

      // 2. Delete lead
      const result = await deleteLead(user.id, leadId);

      logger.info("Lead deleted successfully", {
        userId: user.id,
        leadId,
        requestId,
      });

      return NextResponse.json(result);
    } catch (error: unknown) {
      return handleApiError(error, `DELETE /api/leads/${params?.id} error`, requestId);
    }
  }
);
