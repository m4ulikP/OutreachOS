import { prisma } from "@/lib/db";
import { Prisma, Company } from "@prisma/client";
import { normalizeDomain } from "@/lib/deduplication/normalizer";
import {
  DiscoveredBusiness,
  PersistedBusinessResult,
  PersistedCompanySummary,
} from "@/lib/providers/business-discovery/types";
import { logger } from "@/lib/logger";

export interface NormalizedCompanyData {
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  companySize: string | null;
  location: string | null;
  description: string | null;
}

/**
 * Normalizes a discovered business into canonical Company attributes.
 *
 * Guarantees:
 * - Domain is normalized via root host canonicalization (lowercased, no www/path/query).
 * - A business without a website or domain remains with domain=null and website=null.
 * - Zero URL/domain fabrication from business names.
 */
export function normalizeDiscoveredBusinessForCompany(
  business: DiscoveredBusiness
): NormalizedCompanyData {
  const rawName = (business.name || "").trim();
  const name = rawName.length > 0 ? rawName : "Unnamed Business";

  // Normalize domain if explicitly present on business
  let domain: string | null = null;
  if (business.domain) {
    domain = normalizeDomain(business.domain);
  } else if (business.websiteUrl) {
    domain = normalizeDomain(business.websiteUrl);
  }

  // Normalize website URL if explicitly present
  let website: string | null = null;
  if (business.websiteUrl && business.websiteUrl.trim().length > 0) {
    const trimmed = business.websiteUrl.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      website = trimmed;
    } else if (domain) {
      website = `https://${trimmed}`;
    }
  } else if (domain) {
    website = `https://${domain}`;
  }

  // Normalize location from structured headquarters
  let location: string | null = null;
  if (business.headquarters?.formattedAddress?.trim()) {
    location = business.headquarters.formattedAddress.trim();
  } else if (business.headquarters) {
    const parts = [
      business.headquarters.city,
      business.headquarters.state,
      business.headquarters.country,
    ]
      .filter((p): p is string => Boolean(p && p.trim().length > 0))
      .map((p) => p.trim());

    if (parts.length > 0) {
      location = parts.join(", ");
    }
  }

  // Normalize industry / primaryType
  const industry =
    business.industry?.trim() ||
    business.primaryType?.trim() ||
    null;

  // Normalize company size
  let companySize: string | null = null;
  if (business.headcountRange?.trim()) {
    companySize = business.headcountRange.trim();
  } else if (business.employeeCount && business.employeeCount > 0) {
    companySize = String(business.employeeCount);
  }

  // Normalize description
  const description = business.description?.trim() || null;

  return {
    name,
    domain,
    website,
    industry,
    companySize,
    location,
    description,
  };
}

/**
 * Checks if two location strings are mutually compatible.
 * Returns true if both are compatible or either is missing.
 * Returns false only if both exist and distinctly contradict each other.
 */
export function areLocationsCompatible(
  loc1?: string | null,
  loc2?: string | null
): boolean {
  if (!loc1 || !loc2) return true;

  const clean1 = loc1.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const clean2 = loc2.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

  if (!clean1 || !clean2) return true;
  if (clean1 === clean2) return true;
  if (clean1.includes(clean2) || clean2.includes(clean1)) return true;

  const STOP_TOKENS = new Set([
    "usa", "us", "united", "states", "america", "country", "city", "street", "road",
    "rd", "st", "ave", "avenue", "blvd", "boulevard", "suite", "ste", "dr", "drive",
  ]);

  const tokens1 = new Set(clean1.split(" ").filter((t) => t.length > 2 && !STOP_TOKENS.has(t)));
  const tokens2 = new Set(clean2.split(" ").filter((t) => t.length > 2 && !STOP_TOKENS.has(t)));

  // If they share at least one significant local geographic token (e.g. city or state), treat as compatible
  for (const t of tokens1) {
    if (tokens2.has(t)) {
      return true;
    }
  }

  // Contradicting locations (e.g. "Austin TX" vs "Seattle WA")
  return false;
}

/**
 * Resolves a unique company name within the user's tenant to safely respect @@unique([userId, name]).
 */
async function resolveUniqueCompanyName(
  tx: Prisma.TransactionClient,
  userId: string,
  baseName: string,
  location?: string | null
): Promise<string> {
  let candidate = baseName;
  const existing = await tx.company.findUnique({
    where: {
      userId_name: {
        userId,
        name: candidate,
      },
    },
  });

  if (!existing) {
    return candidate;
  }

  // If conflicting, disambiguate with location if available
  if (location) {
    const locSnippet = location.split(",")[0].trim();
    candidate = `${baseName} (${locSnippet})`;
    const existingWithLoc = await tx.company.findUnique({
      where: {
        userId_name: {
          userId,
          name: candidate,
        },
      },
    });
    if (!existingWithLoc) {
      return candidate;
    }
  }

  // Numeric increment fallback
  let counter = 2;
  while (counter <= 50) {
    candidate = `${baseName} (${counter})`;
    const existingNum = await tx.company.findUnique({
      where: {
        userId_name: {
          userId,
          name: candidate,
        },
      },
    });
    if (!existingNum) {
      return candidate;
    }
    counter++;
  }

  return `${baseName} (${Date.now()})`;
}

/**
 * Finds an existing matching company within the specified user's tenant.
 *
 * Matching Strategy:
 * 1. Normalized Domain match (highest priority, strict tenant isolation)
 * 2. Normalized Name + Location match (when domain is absent or unmatched)
 */
export async function findMatchingCompany(
  tx: Prisma.TransactionClient,
  userId: string,
  normalized: NormalizedCompanyData
): Promise<{ company: Company; matchMethod: "domain" | "name_location" } | null> {
  // 1. Domain match (Priority 1)
  if (normalized.domain) {
    const existingByDomain = await tx.company.findFirst({
      where: {
        userId,
        domain: normalized.domain,
      },
    });

    if (existingByDomain) {
      return { company: existingByDomain, matchMethod: "domain" };
    }
  }

  // 2. Name + Location match (Priority 2)
  const existingByName = await tx.company.findUnique({
    where: {
      userId_name: {
        userId,
        name: normalized.name,
      },
    },
  });

  if (existingByName) {
    // If existingByName already has a conflicting domain, they are different companies sharing a name
    if (
      normalized.domain &&
      existingByName.domain &&
      normalized.domain !== existingByName.domain
    ) {
      return null;
    }

    // Check location compatibility
    if (areLocationsCompatible(existingByName.location, normalized.location)) {
      return { company: existingByName, matchMethod: "name_location" };
    }
  }

  return null;
}

/**
 * Safely enriches an existing Company record with newly discovered information.
 * Never overwrites existing non-null data with null or undefined.
 */
export async function enrichCompany(
  tx: Prisma.TransactionClient,
  existing: Company,
  normalized: NormalizedCompanyData
): Promise<{ company: Company; action: "updated" | "matched" }> {
  const updateData: Prisma.CompanyUpdateInput = {};

  if (!existing.domain && normalized.domain) {
    updateData.domain = normalized.domain;
  }
  if (!existing.website && normalized.website) {
    updateData.website = normalized.website;
  }
  if (!existing.industry && normalized.industry) {
    updateData.industry = normalized.industry;
  }
  if (!existing.companySize && normalized.companySize) {
    updateData.companySize = normalized.companySize;
  }
  if (!existing.location && normalized.location) {
    updateData.location = normalized.location;
  }
  if (!existing.description && normalized.description) {
    updateData.description = normalized.description;
  }

  if (Object.keys(updateData).length === 0) {
    return { company: existing, action: "matched" };
  }

  const updated = await tx.company.update({
    where: { id: existing.id },
    data: updateData,
  });

  return { company: updated, action: "updated" };
}

/**
 * Persists a single discovered business into the Company domain within a transaction.
 *
 * Hard boundary: Zero Lead, Opportunity, or AIResearch records are created.
 */
export async function persistSingleBusiness(
  tx: Prisma.TransactionClient,
  userId: string,
  business: DiscoveredBusiness
): Promise<PersistedCompanySummary> {
  // 1. Ensure user exists (defensive foreign key constraint protection)
  await tx.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: `${userId}@outreachos.dev`,
      name: "Outreach User",
    },
  });

  // 2. Normalize discovered business
  const normalized = normalizeDiscoveredBusinessForCompany(business);

  // 3. Find matching company
  const match = await findMatchingCompany(tx, userId, normalized);

  if (match) {
    // 4. Enrich existing company
    const { company, action } = await enrichCompany(tx, match.company, normalized);
    return {
      id: company.id,
      name: company.name,
      domain: company.domain,
      website: company.website,
      location: company.location,
      action,
    };
  }

  // 5. Create new company with unique name
  const uniqueName = await resolveUniqueCompanyName(
    tx,
    userId,
    normalized.name,
    normalized.location
  );

  const created = await tx.company.create({
    data: {
      userId,
      name: uniqueName,
      domain: normalized.domain,
      website: normalized.website,
      industry: normalized.industry,
      companySize: normalized.companySize,
      location: normalized.location,
      description: normalized.description,
    },
  });

  return {
    id: created.id,
    name: created.name,
    domain: created.domain,
    website: created.website,
    location: created.location,
    action: "created",
  };
}

/**
 * Persists an array of discovered businesses for the authenticated user.
 *
 * Semantics:
 * - Strictly tenant-scoped (`where: { userId }`).
 * - Bounded batch execution.
 * - Idempotent and non-destructive.
 * - Each record is isolated so individual record errors do not abort unrelated records.
 */
export async function persistDiscoveredBusinesses(
  userId: string,
  businesses: DiscoveredBusiness[]
): Promise<PersistedBusinessResult> {
  const summaries: PersistedCompanySummary[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let matchedCount = 0;
  let failedCount = 0;

  // Bounded batch execution
  const boundedBusinesses = businesses.slice(0, 100);

  for (const business of boundedBusinesses) {
    try {
      const summary = await prisma.$transaction(async (tx) => {
        return await persistSingleBusiness(tx, userId, business);
      });

      summaries.push(summary);
      if (summary.action === "created") {
        createdCount++;
      } else if (summary.action === "updated") {
        updatedCount++;
      } else {
        matchedCount++;
      }
    } catch (err: unknown) {
      failedCount++;
      let safeBusinessName = "Unknown";
      try {
        safeBusinessName = business.name || "Unknown";
      } catch {
        // ignore error accessing malformed property
      }
      logger.error("Failed to persist individual discovered business", {
        userId,
        businessName: safeBusinessName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    total: boundedBusinesses.length,
    persistedCount: summaries.length,
    created: createdCount,
    updated: updatedCount,
    matched: matchedCount,
    failed: failedCount,
    companies: summaries,
  };
}
