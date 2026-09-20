import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { publicOpportunityDiscoverySchema } from "@/lib/validation/public-opportunity-discovery";
import { getPublicOpportunityProvider } from "@/lib/providers/public-opportunities";
import { classifyPublicOpportunity } from "@/lib/classification/public-opportunity-classifier";
import { qualifyPublicOpportunityWithAI } from "@/lib/services/public-opportunity-qualification-service";
import {
  persistPublicOpportunities,
  PublicOpportunityItemToPersist,
} from "@/lib/services/public-opportunity-persistence-service";
import { withApiObservability } from "@/lib/api-wrapper";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/opportunities/discover/public
 *
 * Public Opportunities Client Acquisition Channel.
 * Discovers, classifies, qualifies, and optionally persists public requests for web development.
 *
 * Hard Boundary: Zero Lead or Company records created. Creates Opportunity records (source = PUBLIC_FEED).
 * Tenant Isolated: userId read exclusively from session.
 */
export const POST = withApiObservability(async (req: NextRequest, _ctx, { requestId }) => {
  try {
    // 1. Authenticate user
    const user = await requireAuthUser(req);

    // 2. Parse request JSON body
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

    // 3. Strict Zod validation
    const validation = publicOpportunityDiscoverySchema.safeParse(body);
    if (!validation.success) {
      return handleApiError(
        validation.error,
        "Validation error in POST /api/opportunities/discover/public",
        requestId
      );
    }

    const { provider: providerId, query, location, days, limit, qualify, persist } = validation.data;

    // 4. Resolve provider
    const provider = getPublicOpportunityProvider(providerId);

    // 5. Discover raw items
    const rawResult = await provider.discover({
      query,
      location,
      days,
      limit,
      providerId,
    });

    // 6. Process items through classifier & optional AI qualification
    const processedItems: PublicOpportunityItemToPersist[] = [];

    for (const item of rawResult.opportunities) {
      const classification = classifyPublicOpportunity(item);

      let qualification;
      if (qualify && classification.relevant) {
        qualification = await qualifyPublicOpportunityWithAI(item, classification);
      }

      processedItems.push({
        opportunity: item,
        classification,
        qualification,
      });
    }

    // Filter to relevant opportunities if not explicitly searching for mock items
    const relevantItems = processedItems.filter((entry) => {
      if (entry.qualification) {
        return entry.qualification.relevant;
      }
      return entry.classification.relevant;
    });

    // 7. Optional persistence
    let persistenceResult;
    if (persist && relevantItems.length > 0) {
      persistenceResult = await persistPublicOpportunities(user.id, relevantItems);
    }

    logger.info("Public opportunity discovery executed", {
      userId: user.id,
      providerId: provider.id,
      query,
      totalDiscovered: rawResult.opportunities.length,
      relevantCount: relevantItems.length,
      qualify,
      persist,
      persistedCount: persistenceResult?.persistedCount ?? 0,
      requestId,
    });

    // 8. Return normalized payload
    return NextResponse.json({
      opportunities: relevantItems.map((entry) => ({
        ...entry.opportunity,
        classification: entry.classification,
        qualification: entry.qualification || null,
        whyFound: entry.qualification
          ? [entry.qualification.reason]
          : [entry.classification.reason],
      })),
      totalMatches: rawResult.totalMatches,
      relevantCount: relevantItems.length,
      providerName: provider.name,
      providerId: provider.id,
      isConfigured: provider.isConfigured(),
      isDevelopmentMock: rawResult.isDevelopmentMock || false,
      persisted: persistenceResult || null,
    });
  } catch (error: unknown) {
    return handleApiError(
      error,
      "POST /api/opportunities/discover/public error",
      requestId
    );
  }
});
