import { prisma } from "@/lib/db";
import {
  Opportunity,
  OpportunityType,
  OpportunityStage,
  OpportunitySource,
  Prisma,
} from "@prisma/client";
import { DiscoveredPublicOpportunity } from "../providers/public-opportunities/types";
import {
  ClassificationResult,
  PublicOpportunityIntent,
} from "../classification/public-opportunity-classifier";
import { PublicOpportunityQualification } from "./public-opportunity-qualification-service";
import { logger } from "@/lib/logger";
import { createHash } from "crypto";

export interface PublicOpportunityItemToPersist {
  opportunity: DiscoveredPublicOpportunity;
  classification: ClassificationResult;
  qualification?: PublicOpportunityQualification;
}

export interface PersistedOpportunitySummary {
  id: string;
  title: string;
  sourceUrl: string | null;
  stage: OpportunityStage;
  action: "created" | "updated" | "matched";
}

export interface PersistedPublicOpportunitiesResult {
  total: number;
  persistedCount: number;
  created: number;
  updated: number;
  matched: number;
  failed: number;
  opportunities: PersistedOpportunitySummary[];
}

export function mapIntentToOpportunityType(intent: PublicOpportunityIntent): OpportunityType {
  switch (intent) {
    case "WEBSITE_BUILD":
    case "ECOMMERCE_BUILD":
    case "LANDING_PAGE":
      return OpportunityType.ACTIVE_PROJECT;
    case "WEBSITE_REDESIGN":
      return OpportunityType.REDESIGN_REQUEST;
    case "WEB_APPLICATION":
    case "FRONTEND_DEVELOPMENT":
    case "FULL_STACK_DEVELOPMENT":
    case "WORDPRESS_CMS":
    case "GENERAL_DEVELOPER_REQUEST":
    default:
      return OpportunityType.DEVELOPMENT_REQUEST;
  }
}

export function calculateConfidenceLabel(confidenceScore?: number): string {
  if (typeof confidenceScore !== "number") return "medium";
  if (confidenceScore >= 0.8) return "high";
  if (confidenceScore >= 0.5) return "medium";
  return "low";
}

export function generateOpportunityFingerprint(item: DiscoveredPublicOpportunity): string {
  if (item.externalId && item.externalId.trim().length > 0) {
    return `${item.source}:${item.externalId.trim()}`;
  }
  const normTitle = (item.title || "").toLowerCase().trim().replace(/\s+/g, " ");
  const rawKey = `${item.source}|${item.sourceUrl}|${normTitle}`;
  return `${item.source}:${createHash("sha256").update(rawKey).digest("hex").slice(0, 24)}`;
}

/**
 * Grounded evidence generator explaining why OutreachOS identified this item as a public opportunity.
 */
export function buildWhyFoundReasons(
  item: DiscoveredPublicOpportunity,
  classification: ClassificationResult,
  qualification?: PublicOpportunityQualification
): string[] {
  const reasons: string[] = [];

  if (item.sourceName) {
    reasons.push(`Discovered on ${item.sourceName} (${item.sourceCommunity || "Public Feed"})`);
  }

  if (classification.matchedSignals.length > 0) {
    reasons.push(`Matched intent signals for ${classification.intent.replace(/_/g, " ")}`);
  }

  if (qualification?.reason) {
    reasons.push(`AI Qualification: ${qualification.reason}`);
  } else if (classification.reason) {
    reasons.push(`Classification: ${classification.reason}`);
  }

  if (item.publishedAt) {
    try {
      const dateStr = new Date(item.publishedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      reasons.push(`Posted on ${dateStr}`);
    } catch {
      // Ignore date formatting errors
    }
  }

  if (item.budget) {
    reasons.push(`Explicit budget mentioned: ${item.budget} ${item.currency || "USD"}`);
  }

  return reasons;
}

/**
 * Persists discovered public opportunities into the existing Opportunity Prisma model.
 *
 * Constraints & Boundaries:
 * - Hard Boundary: companyId = null, leadId = null. Zero Lead or Company records created.
 * - Multi-tenant isolated to session userId.
 * - Idempotent deduplication by userId + fingerprint.
 * - Preserves existing Opportunity stage flow (does NOT reset PITCH_DRAFTED/CONTACTED/etc.).
 */
export async function persistPublicOpportunities(
  userId: string,
  items: PublicOpportunityItemToPersist[]
): Promise<PersistedPublicOpportunitiesResult> {
  if (!userId || userId.trim().length === 0) {
    throw new Error("userId is required for persisting public opportunities");
  }

  let createdCount = 0;
  let updatedCount = 0;
  let matchedCount = 0;
  let failedCount = 0;
  const summaries: PersistedOpportunitySummary[] = [];

  for (const entry of items) {
    try {
      const { opportunity: item, classification, qualification } = entry;
      const fingerprint = generateOpportunityFingerprint(item);
      const whyFound = buildWhyFoundReasons(item, classification, qualification);

      const mappedType = mapIntentToOpportunityType(qualification?.intent || classification.intent);
      const confidenceLabel = calculateConfidenceLabel(qualification?.confidence ?? classification.confidence);

      const isQualified = qualification ? qualification.relevant : classification.relevant;
      const initialStage = isQualified ? OpportunityStage.QUALIFIED : OpportunityStage.IDENTIFIED;

      const budgetStr = item.budget ? String(item.budget) : qualification?.budgetMentioned || null;
      const currencyStr = item.currency || (item.budget ? "USD" : null);

      const evidencePayload: Prisma.JsonObject = {
        source: item.source,
        externalId: item.externalId || null,
        sourceUrl: item.sourceUrl,
        originalTitle: item.title,
        originalText: item.description || null,
        authorName: item.authorName || null,
        authorProfileUrl: item.authorProfileUrl || null,
        publishedAt: item.publishedAt || null,
        companyName: item.companyName || null,
        fingerprint,
        matchedSignals: classification.matchedSignals,
        whyFound,
        classification: classification as unknown as Prisma.JsonObject,
        qualification: (qualification || null) as unknown as Prisma.JsonObject,
        rawMetadata: (item.rawMetadata || null) as unknown as Prisma.JsonObject,
      };

      const signalsPayload: Prisma.JsonObject = {
        intent: qualification?.intent || classification.intent,
        demandStrength: qualification?.demandStrength || classification.demandStrength,
        requestedServices: qualification?.requestedServices || classification.requestedServices,
        urgency: qualification?.urgency || "unknown",
        businessContext: qualification?.businessContext || null,
      };

      const requestedServices = qualification?.requestedServices || classification.requestedServices;

      // 1. Query for existing opportunity by userId and fingerprint/sourceUrl
      const existing = await prisma.opportunity.findFirst({
        where: {
          userId,
          source: OpportunitySource.PUBLIC_FEED,
          OR: [
            { sourceUrl: item.sourceUrl },
            { targetUrl: fingerprint },
          ],
        },
      });

      if (existing) {
        // Stage preservation: do NOT reset if advanced past IDENTIFIED/QUALIFIED
        const preservedStage =
          existing.stage === OpportunityStage.IDENTIFIED || existing.stage === OpportunityStage.QUALIFIED
            ? initialStage
            : existing.stage;

        const updated = await prisma.opportunity.update({
          where: { id: existing.id },
          data: {
            stage: preservedStage,
            title: item.title,
            description: item.description || existing.description,
            budget: budgetStr || existing.budget,
            currency: currencyStr || existing.currency,
            confidence: confidenceLabel,
            evidence: evidencePayload,
            opportunitySignals: signalsPayload,
            requestedServices: requestedServices.length > 0 ? requestedServices : existing.requestedServices,
            updatedAt: new Date(),
          },
        });

        matchedCount++;
        updatedCount++;
        summaries.push({
          id: updated.id,
          title: updated.title,
          sourceUrl: updated.sourceUrl,
          stage: updated.stage,
          action: "matched",
        });
      } else {
        // 2. Create new Opportunity (companyId = null, leadId = null)
        const created = await prisma.opportunity.create({
          data: {
            userId,
            companyId: null,
            leadId: null,
            researchId: null,
            type: mappedType,
            stage: initialStage,
            source: OpportunitySource.PUBLIC_FEED,
            sourceUrl: item.sourceUrl,
            targetUrl: fingerprint, // Store fingerprint in targetUrl for indexing
            title: item.title,
            description: item.description || null,
            budget: budgetStr,
            currency: currencyStr,
            confidence: confidenceLabel,
            evidence: evidencePayload,
            opportunitySignals: signalsPayload,
            requestedServices,
            discoveredAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
          },
        });

        createdCount++;
        summaries.push({
          id: created.id,
          title: created.title,
          sourceUrl: created.sourceUrl,
          stage: created.stage,
          action: "created",
        });
      }
    } catch (err: unknown) {
      failedCount++;
      logger.error("Failed to persist public opportunity item", {
        userId,
        title: entry.opportunity.title,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    total: items.length,
    persistedCount: createdCount + updatedCount,
    created: createdCount,
    updated: updatedCount,
    matched: matchedCount,
    failed: failedCount,
    opportunities: summaries,
  };
}
