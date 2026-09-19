import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { businessDiscoverySearchSchema } from "@/lib/validation/business-discovery";
import { discoverBusinesses } from "@/lib/services/business-discovery-service";
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

    // 3. Validate request schema
    const validation = businessDiscoverySearchSchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(
        validation.error,
        "Validation error in POST /api/opportunities/discover/businesses",
        requestId
      );
    }

    // 4. Execute business discovery through service
    const result = await discoverBusinesses(user.id, validation.data);

    // 5. Correlated structured logging
    logger.info("Business discovery search executed", {
      userId: user.id,
      provider: result.providerName,
      resultsCount: result.businesses.length,
      totalMatches: result.totalMatches,
      isConfigured: result.isConfigured,
      isDevelopmentMock: result.isDevelopmentMock ?? false,
      persisted: validation.data.persist,
      persistedCount: result.persisted?.persistedCount,
      persistedCreated: result.persisted?.created,
      persistedUpdated: result.persisted?.updated,
      persistedFailed: result.persisted?.failed,
      requestId,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(
      error,
      "POST /api/opportunities/discover/businesses error",
      requestId
    );
  }
});
