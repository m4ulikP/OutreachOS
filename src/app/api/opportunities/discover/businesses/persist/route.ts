import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { persistDiscoveredBusinessSchema } from "@/lib/validation/business-persist";
import { persistDiscoveredBusinesses } from "@/lib/services/business-persistence-service";
import { withApiObservability } from "@/lib/api-wrapper";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/opportunities/discover/businesses/persist
 *
 * Persists a single, fully-resolved DiscoveredBusiness object that was already
 * returned by the discovery endpoint.  This allows the UI to save an individual
 * result without triggering a second provider search.
 *
 * Tenant isolation: userId is read exclusively from the authenticated session.
 * The request body cannot override the tenant scope.
 *
 * Hard boundary: Zero Lead, Opportunity, or AIResearch records are created.
 */
export const POST = withApiObservability(async (req: NextRequest, _ctx, { requestId }) => {
  try {
    // 1. Strict authentication — tenant id from session only
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

    // 3. Validate the inbound DiscoveredBusiness against the strict schema
    const validation = persistDiscoveredBusinessSchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(
        validation.error,
        "Validation error in POST /api/opportunities/discover/businesses/persist",
        requestId
      );
    }

    // 4. Persist using the existing Phase B.3 infrastructure
    //    persistDiscoveredBusinesses is tenant-scoped to userId, idempotent,
    //    and performs ZERO Lead/Opportunity/AIResearch mutations.
    const persisted = await persistDiscoveredBusinesses(user.id, [validation.data]);

    // 5. Structured logging
    logger.info("Single business persisted via direct-persist endpoint", {
      userId: user.id,
      businessName: validation.data.name,
      action: persisted.companies[0]?.action,
      companyId: persisted.companies[0]?.id,
      failed: persisted.failed,
      requestId,
    });

    // 6. Return persistence summary
    return NextResponse.json(persisted);
  } catch (error: unknown) {
    return handleApiError(
      error,
      "POST /api/opportunities/discover/businesses/persist error",
      requestId
    );
  }
});
