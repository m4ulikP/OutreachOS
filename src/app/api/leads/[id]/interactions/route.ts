import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser, assertResourceOwnership, NotFoundError } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api-response";
import { addLeadInteraction } from "@/lib/services/lead-service";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthUser(req);

    // 1. Verify existence and enforce resource ownership
    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });

    if (!lead) {
      throw new NotFoundError("Lead not found");
    }

    assertResourceOwnership(lead.userId, user.id);

    const body = await req.json();
    const { type = "NOTE", title, description } = body;
    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const interaction = await addLeadInteraction(
      user.id,
      params.id,
      type,
      title,
      description
    );

    return NextResponse.json({ interaction }, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, `POST /api/leads/${params.id}/interactions error`);
  }
}
