import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser, assertResourceOwnership, NotFoundError } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api-response";
import { getLeadById, updateLead, deleteLead } from "@/lib/services/lead-service";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthUser(req);

    // 1. Verify existence and enforce resource ownership
    const existing = await prisma.lead.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });

    if (!existing) {
      throw new NotFoundError("Lead not found");
    }

    assertResourceOwnership(existing.userId, user.id);

    // 2. Fetch full scoped lead
    const lead = await getLeadById(user.id, params.id);
    return NextResponse.json({ lead });
  } catch (error: unknown) {
    return handleApiError(error, `GET /api/leads/${params.id} error`);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthUser(req);

    // 1. Verify existence and enforce resource ownership
    const existing = await prisma.lead.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });

    if (!existing) {
      throw new NotFoundError("Lead not found");
    }

    assertResourceOwnership(existing.userId, user.id);

    // 2. Update lead
    const body = await req.json();
    const updated = await updateLead(user.id, params.id, body);
    return NextResponse.json({ lead: updated });
  } catch (error: unknown) {
    return handleApiError(error, `PATCH /api/leads/${params.id} error`);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthUser(req);

    // 1. Verify existence and enforce resource ownership
    const existing = await prisma.lead.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });

    if (!existing) {
      throw new NotFoundError("Lead not found");
    }

    assertResourceOwnership(existing.userId, user.id);

    // 2. Delete lead
    const result = await deleteLead(user.id, params.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(error, `DELETE /api/leads/${params.id} error`);
  }
}
