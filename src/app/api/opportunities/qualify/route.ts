import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { qualifyCompanySchema } from "@/lib/validation/opportunity-qualification";
import { qualifyCompanyOpportunity } from "@/lib/services/opportunity-qualification-service";
import { withApiObservability } from "@/lib/api-wrapper";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const POST = withApiObservability(async (req: NextRequest, _ctx, { requestId }) => {
  try {
    // 1. Strict authentication check
    const user = await requireAuthUser(req);

    // 2. Parse request JSON body safely
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return handleApiError(
        new ValidationError("Invalid JSON in request body"),
        undefined,
        requestId
      );
    }

    // 3. Validate request schema strictly
    const validation = qualifyCompanySchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(
        validation.error,
        "Validation error in POST /api/opportunities/qualify",
        requestId
      );
    }

    // 4. Execute opportunity qualification
    const result = await qualifyCompanyOpportunity(user.id, validation.data.companyId, {
      forceRefresh: validation.data.forceRefresh,
    });

    // 5. Correlated structured logging
    logger.info("Opportunity qualification executed", {
      userId: user.id,
      companyId: validation.data.companyId,
      websiteStatus: result.qualification.websiteStatus,
      opportunityCreated: result.qualification.opportunityCreated,
      action: result.qualification.action,
      opportunityType: result.qualification.opportunity?.type,
      signalsCount: result.qualification.signals.length,
      requestId,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(
      error,
      "POST /api/opportunities/qualify error",
      requestId
    );
  }
});
