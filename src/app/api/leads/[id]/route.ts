import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser, assertResourceOwnership, NotFoundError } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { getLeadById, updateLead, deleteLead } from "@/lib/services/lead-service";
import { prisma } from "@/lib/db";
import { cuidParamSchema } from "@/lib/validation/common";
import { updateLeadSchema } from "@/lib/validation/leads";

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthUser(req);

    // Validate route parameter
    const idValidation = cuidParamSchema.safeParse(params.id);
    if (!idValidation.success) {
      return handleApiError(idValidation.error);
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
    return handleApiError(error, `GET /api/leads/${params.id} error`);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthUser(req);

    // Validate route parameter
    const idValidation = cuidParamSchema.safeParse(params.id);
    if (!idValidation.success) {
      return handleApiError(idValidation.error);
    }
    const leadId = idValidation.data;

    // Validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return handleApiError(new ValidationError("Invalid JSON in request body"));
    }

    const bodyValidation = updateLeadSchema.safeParse(body);
    if (!bodyValidation.success) {
      return handleApiError(bodyValidation.error);
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
    return NextResponse.json({ lead: updated });
  } catch (error: unknown) {
    return handleApiError(error, `PATCH /api/leads/${params.id} error`);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthUser(req);

    // Validate route parameter
    const idValidation = cuidParamSchema.safeParse(params.id);
    if (!idValidation.success) {
      return handleApiError(idValidation.error);
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
    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(error, `DELETE /api/leads/${params.id} error`);
  }
}
