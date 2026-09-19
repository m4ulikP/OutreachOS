import { getBusinessDiscoveryProvider } from "@/lib/providers/business-discovery";
import {
  BusinessDiscoveryCriteria,
  BusinessSearchResult,
} from "@/lib/providers/business-discovery/types";
import {
  businessDiscoverySearchSchema,
  BusinessDiscoverySearchInputValidated,
} from "@/lib/validation/business-discovery";
import { z } from "zod";

/**
 * Searches businesses/companies using the active Business Discovery Provider.
 *
 * Responsibilities:
 * - Validates input parameters via Zod
 * - Selects the appropriate provider (Hunter Discover or Mock)
 * - Invokes discovery
 * - Enforces bounded limits
 * - Preserves provider messages/metadata
 * - Performs NO database writes in this phase (Phase B.1 foundation)
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

  return result;
}
