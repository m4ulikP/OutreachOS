import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api-response";
import { getLeadSourceProvider } from "@/lib/providers/lead-source";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireAuthUser(req);
    const body = await req.json();

    const provider = getLeadSourceProvider();
    const result = await provider.search(body);

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(error, "POST /api/finder error");
  }
}
