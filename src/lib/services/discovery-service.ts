import { prisma } from "@/lib/db";
import { getLeadSourceProvider } from "@/lib/providers/lead-source";
import {
  DiscoveredLead,
  SearchResult,
} from "@/lib/providers/lead-source/types";
import {
  finderSearchSchema,
  FinderSearchInputValidated,
  DiscoveredProspectValidated,
  FinderImportInputValidated,
} from "@/lib/validation/finder";
import { findDuplicateLead, createLead } from "./lead-service";
import { logger } from "@/lib/logger";
import { LeadStage } from "@prisma/client";

import { z } from "zod";

export interface ProspectImportSummaryItem {
  id: string;
  fullName: string;
  companyName: string;
  status: "imported" | "already_exists" | "failed";
  reason?: string;
  leadId?: string | null;
}

export interface ProspectImportSummary {
  totalSubmitted: number;
  importedCount: number;
  alreadyExistedCount: number;
  failedCount: number;
  results: ProspectImportSummaryItem[];
}

/**
 * Searches prospects from the active provider and annotates each result
 * with tenant-scoped deduplication status.
 */
export async function searchProspects(
  userId: string,
  criteria: z.input<typeof finderSearchSchema>
): Promise<SearchResult> {
  const validated = finderSearchSchema.parse(criteria);
  const provider = getLeadSourceProvider(validated.providerId);
  const searchResult = await provider.search(validated);

  // If no leads or provider unconfigured, return immediately
  if (!searchResult.leads || searchResult.leads.length === 0) {
    return searchResult;
  }

  // Annotate each discovered lead with tenant-scoped deduplication status
  // STRICT TENANT ISOLATION: findDuplicateLead is scoped exclusively to userId
  const annotatedLeads: DiscoveredLead[] = await Promise.all(
    searchResult.leads.map(async (lead) => {
      try {
        const dupe = await findDuplicateLead(prisma, userId, {
          email: lead.email,
          linkedInUrl: lead.linkedInUrl,
          fullName: lead.fullName,
          firstName: lead.firstName,
          lastName: lead.lastName,
          companyName: lead.companyName,
          companyDomain: lead.companyDomain,
        });

        return {
          ...lead,
          isExistingLead: dupe.isDuplicate,
          existingLeadId: dupe.isDuplicate ? dupe.matchedLeadId : null,
          matchedBy: dupe.matchedBy,
        };
      } catch (err) {
        logger.warn("Deduplication check error during discovery search", {
          leadName: lead.fullName,
          userId,
          err: err instanceof Error ? err.message : String(err),
        });
        return {
          ...lead,
          isExistingLead: false,
          existingLeadId: null,
        };
      }
    })
  );

  return {
    ...searchResult,
    leads: annotatedLeads,
  };
}

/**
 * Authoritative batch import of selected discovered prospects.
 * Executes server-side deduplication, company resolution/reuse, and lead creation
 * utilizing OutreachOS's production-grade lead pipeline.
 */
export async function importDiscoveredProspects(
  userId: string,
  input: FinderImportInputValidated
): Promise<ProspectImportSummary> {
  const prospects = input.prospects;
  let importedCount = 0;
  let alreadyExistedCount = 0;
  let failedCount = 0;
  const results: ProspectImportSummaryItem[] = [];

  for (const prospect of prospects) {
    try {
      // Step 1: Authoritative server-side deduplication check
      const dupe = await findDuplicateLead(prisma, userId, {
        email: prospect.email,
        linkedInUrl: prospect.linkedInUrl,
        fullName: prospect.fullName,
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        companyName: prospect.companyName,
        companyDomain: prospect.companyDomain,
      });

      if (dupe.isDuplicate) {
        alreadyExistedCount++;
        results.push({
          id: prospect.id,
          fullName: prospect.fullName,
          companyName: prospect.companyName,
          status: "already_exists",
          reason: dupe.reason || "Prospect is already present in your leads database.",
          leadId: dupe.matchedLeadId,
        });
        continue;
      }

      // Step 2: Create lead through existing production lead service
      const nameParts = prospect.fullName.split(" ");
      const firstName = prospect.firstName || nameParts[0] || "";
      const lastName = prospect.lastName || nameParts.slice(1).join(" ") || "";

      const created = await createLead(userId, {
        firstName,
        lastName,
        fullName: prospect.fullName,
        jobTitle: prospect.jobTitle || "Professional",
        email: prospect.email || undefined,
        phone: prospect.phone || undefined,
        website: prospect.website || undefined,
        linkedInUrl: prospect.linkedInUrl || undefined,
        companyName: prospect.companyName,
        companyDomain: prospect.companyDomain || undefined,
        companySize: prospect.companySize || undefined,
        industry: prospect.industry || undefined,
        location: prospect.location || undefined,
        source: prospect.sourceProvider || "Discovered Prospect",
        stage: LeadStage.NEW,
        notes: `Imported via OutreachOS Client Discovery (${prospect.sourceProvider || "Discovery Provider"}).`,
      });

      if (created.lead) {
        importedCount++;
        results.push({
          id: prospect.id,
          fullName: prospect.fullName,
          companyName: prospect.companyName,
          status: "imported",
          leadId: created.lead.id,
        });
      } else if (created.deduplication.isDuplicate) {
        alreadyExistedCount++;
        results.push({
          id: prospect.id,
          fullName: prospect.fullName,
          companyName: prospect.companyName,
          status: "already_exists",
          reason: created.deduplication.reason,
          leadId: created.deduplication.matchedLeadId,
        });
      } else {
        failedCount++;
        results.push({
          id: prospect.id,
          fullName: prospect.fullName,
          companyName: prospect.companyName,
          status: "failed",
          reason: "Unknown failure during lead creation.",
        });
      }
    } catch (err: unknown) {
      failedCount++;
      logger.error("Failed to import individual discovered prospect", {
        userId,
        prospectId: prospect.id,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({
        id: prospect.id,
        fullName: prospect.fullName,
        companyName: prospect.companyName,
        status: "failed",
        reason: err instanceof Error ? err.message : "Failed to import prospect",
      });
    }
  }

  logger.info("Discovery prospects batch import completed", {
    userId,
    totalSubmitted: prospects.length,
    importedCount,
    alreadyExistedCount,
    failedCount,
  });

  return {
    totalSubmitted: prospects.length,
    importedCount,
    alreadyExistedCount,
    failedCount,
    results,
  };
}
