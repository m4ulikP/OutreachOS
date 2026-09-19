import { getBusinessDiscoveryProvider } from "@/lib/providers/business-discovery";
import {
  BusinessSearchResult,
} from "@/lib/providers/business-discovery/types";
import {
  businessDiscoverySearchSchema,
  BusinessDiscoverySearchInputValidated,
} from "@/lib/validation/business-discovery";
import { persistDiscoveredBusinesses } from "@/lib/services/business-persistence-service";
import { z } from "zod";

/**
 * Searches businesses/companies using the active Business Discovery Provider.
 *
 * Responsibilities:
 * - Validates input parameters via Zod
 * - Selects the appropriate provider (Hunter Discover, Google Places, or Mock)
 * - Invokes discovery
 * - Enforces bounded limits
 * - Preserves provider messages/metadata
 * - If persist: true, safely persists/enriches Company records for the current user
 * - Performs NO Opportunity, Lead, or AIResearch mutations (Phase B.3 boundary)
 */
export async function discoverBusinesses(
  userId: string,
  criteria: z.input<typeof businessDiscoverySearchSchema>
): Promise<BusinessSearchResult> {
  // 1. Validate and enforce bounds
  const validated: BusinessDiscoverySearchInputValidated =
    businessDiscoverySearchSchema.parse(criteria);

  // 2. Select configured provider
  const provider = getBusinessDiscoveryProvider(validated.providerId);

  // 3. Invoke provider search
  const result = await provider.discover(validated);

  // 4. If persistence is explicitly requested, persist discovered businesses (Phase B.3)
  if (validated.persist) {
    if (result.businesses.length > 0) {
      result.persisted = await persistDiscoveredBusinesses(userId, result.businesses);
    } else {
      result.persisted = {
        total: 0,
        persistedCount: 0,
        created: 0,
        updated: 0,
        matched: 0,
        failed: 0,
        companies: [],
      };
    }
  }

  return result;
}
