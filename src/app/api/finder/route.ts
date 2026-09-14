import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getLeadSourceProvider } from "@/lib/providers/lead-source";

export async function POST(req: NextRequest) {
  try {
    await requireAuthUser(req);
    const body = await req.json();

    const provider = getLeadSourceProvider();
    const result = await provider.search(body);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lead discovery failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
