import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { bulkLeadOperation } from "@/lib/services/lead-service";
import { bulkLeadsOperationSchema } from "@/lib/validation/bulk";
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

    const validation = bulkLeadsOperationSchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(validation.error, "Validation error in POST /api/leads/bulk", requestId);
    }

    const result = await bulkLeadOperation(user.id, validation.data);

    logger.info("Bulk lead operation executed successfully", {
      userId: user.id,
      action: validation.data.action,
      affectedCount: result.affectedCount,
      requestId,
    });

    return NextResponse.json({
      success: true,
      action: validation.data.action,
      affectedCount: result.affectedCount,
    });
  } catch (error: unknown) {
    return handleApiError(error, "POST /api/leads/bulk error", requestId);
  }
});
