import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { finderImportSchema } from "@/lib/validation/finder";
import { importDiscoveredProspects } from "@/lib/services/discovery-service";
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

    const validation = finderImportSchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(validation.error, "Validation error in POST /api/finder/import", requestId);
    }

    const summary = await importDiscoveredProspects(user.id, validation.data);

    logger.info("Prospects imported into leads database", {
      userId: user.id,
      totalSubmitted: summary.totalSubmitted,
      importedCount: summary.importedCount,
      alreadyExistedCount: summary.alreadyExistedCount,
      failedCount: summary.failedCount,
      requestId,
    });

    return NextResponse.json(summary, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, "POST /api/finder/import error", requestId);
  }
});
