import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { addLeadInteraction } from "@/lib/services/lead-service";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json();

    const { type = "NOTE", title, description } = body;
    if (!title || title.trim() === "") {
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
    const message = error instanceof Error ? error.message : "Failed to log interaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
