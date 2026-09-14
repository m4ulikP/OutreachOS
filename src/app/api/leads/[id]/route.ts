import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getLeadById, updateLead, deleteLead } from "@/lib/services/lead-service";

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthUser(req);
    const lead = await getLeadById(user.id, params.id);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json();

    const updated = await updateLead(user.id, params.id, body);
    return NextResponse.json({ lead: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthUser(req);
    const result = await deleteLead(user.id, params.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
