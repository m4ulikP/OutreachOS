import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { getLeadSourceProvider } from "@/lib/providers/lead-source";
import { finderSearchSchema } from "@/lib/validation/finder";
import { withApiObservability } from "@/lib/api-wrapper";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const POST = withApiObservability(async (req: NextRequest, _ctx, { requestId }) => {
  try {
    const user = await requireAuthUser(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return handleApiError(new ValidationError("Invalid JSON in request body"), undefined, requestId);
    }

    const validation = finderSearchSchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(validation.error, "Validation error in POST /api/finder", requestId);
    }

    const provider = getLeadSourceProvider();
    const result = await provider.search(validation.data);

    logger.info("Prospect search executed", {
      userId: user.id,
      provider: provider.name,
      resultsCount: result.totalMatches,
      requestId,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(error, "POST /api/finder error", requestId);
  }
});
