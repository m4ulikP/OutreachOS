import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { getLeadSourceProvider } from "@/lib/providers/lead-source";
import { finderSearchSchema } from "@/lib/validation/finder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireAuthUser(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return handleApiError(new ValidationError("Invalid JSON in request body"));
    }

    const validation = finderSearchSchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(validation.error);
    }

    const provider = getLeadSourceProvider();
    const result = await provider.search(validation.data);

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(error, "POST /api/finder error");
  }
}
