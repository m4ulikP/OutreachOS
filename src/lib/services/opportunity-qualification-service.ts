import { prisma } from "@/lib/db";
import {
  Opportunity,
  OpportunityType,
  OpportunityStage,
  OpportunitySource,
  Company,
  Prisma,
} from "@prisma/client";
import { NotFoundError } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { validateUrlProtocolAndHost } from "@/lib/research/ssrf-filter";
import { safeFetchWebsite } from "@/lib/research/safe-fetcher";
import {
  defaultWebsiteResearcher,
  WebsiteResearchResult,
  WebsiteResearchProvider,
  OpportunitySignal,
} from "@/lib/research";
import { normalizeDomain } from "@/lib/deduplication/normalizer";

export type WebsitePresenceStatus =
  | "WEBSITE_CONFIRMED"
  | "WEBSITE_NOT_FOUND"
  | "WEBSITE_UNREACHABLE"
  | "WEBSITE_UNVERIFIED";

export interface WebsitePresenceResult {
  status: WebsitePresenceStatus;
  candidateUrl: string | null;
  finalUrl?: string | null;
  error?: string;
}

export interface QualificationOptions {
  forceRefresh?: boolean;
  source?: OpportunitySource | string;
  websiteResearcher?: WebsiteResearchProvider;
  allowTestUrls?: boolean;
  verifiedNoWebsite?: boolean;
  absenceEvidence?: {
    verifiedBy?: string;
    reason?: string;
    details?: Record<string, unknown>;
  };
}

export interface QualificationResult {
  company: {
    id: string;
    name: string;
    domain: string | null;
    website: string | null;
  };
  qualification: {
    websiteStatus: WebsitePresenceStatus;
    opportunityCreated: boolean;
    action: "created" | "updated" | "none";
    opportunity?: Opportunity;
    signals: OpportunitySignal[];
    message?: string;
  };
}

/**
 * SSRF-safely determines the website presence status for a Company.
 *
 * Rules:
 * - If candidate URL exists, performs SSRF-safe HTTP fetch.
 * - Confirmed HTTP 2xx/3xx response -> WEBSITE_CONFIRMED.
 * - HTTP timeout / DNS failure / 403 / 429 / connection error -> WEBSITE_UNREACHABLE.
 * - Verified absence evidence present -> WEBSITE_NOT_FOUND.
 * - Missing website/domain candidate without verified absence evidence -> WEBSITE_UNVERIFIED.
 */
export async function determineWebsitePresence(
  company: Company,
  options?: QualificationOptions
): Promise<WebsitePresenceResult> {
  // 1. Resolve candidate URL from company fields
  let candidateUrl: string | null = null;
  if (company.website && company.website.trim().length > 0) {
    const trimmed = company.website.trim();
    candidateUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  } else if (company.domain && company.domain.trim().length > 0) {
    const norm = normalizeDomain(company.domain);
    if (norm) {
      candidateUrl = `https://${norm}`;
    }
  }

  // 2. If no candidate URL exists
  if (!candidateUrl) {
    const hasAbsenceEvidence =
      options?.verifiedNoWebsite === true ||
      !!options?.absenceEvidence ||
      (company.description && company.description.includes("NO_WEBSITE_VERIFIED"));

    if (hasAbsenceEvidence) {
      return {
        status: "WEBSITE_NOT_FOUND",
        candidateUrl: null,
        finalUrl: null,
        error: options?.absenceEvidence?.reason || "Verified absence of web presence",
      };
    }

    return {
      status: "WEBSITE_UNVERIFIED",
      candidateUrl: null,
      finalUrl: null,
      error: "No website candidate on record and website absence is not definitively verified",
    };
  }

  // 3. Custom researcher provided
  if (options?.websiteResearcher) {
    try {
      const res = await options.websiteResearcher.researchWebsite(candidateUrl);
      return {
        status: "WEBSITE_CONFIRMED",
        candidateUrl,
        finalUrl: res.finalUrl,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        status: "WEBSITE_UNREACHABLE",
        candidateUrl,
        finalUrl: null,
        error: errorMessage,
      };
    }
  }

  // 4. Test URLs explicitly permitted (for local loopback test HTTP servers)
  if (options?.allowTestUrls) {
    try {
      const parsed = new URL(candidateUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return {
          status: "WEBSITE_UNREACHABLE",
          candidateUrl,
          finalUrl: null,
          error: `Unsupported protocol '${parsed.protocol}'`,
        };
      }
      const fetchRes = await fetch(candidateUrl);
      if (fetchRes.ok || fetchRes.status < 400) {
        return {
          status: "WEBSITE_CONFIRMED",
          candidateUrl,
          finalUrl: candidateUrl,
        };
      } else {
        return {
          status: "WEBSITE_UNREACHABLE",
          candidateUrl,
          finalUrl: null,
          error: `HTTP ${fetchRes.status}`,
        };
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        status: "WEBSITE_UNREACHABLE",
        candidateUrl,
        finalUrl: null,
        error: errorMessage,
      };
    }
  }

  // 5. Default production path: Validate URL syntax and SSRF rules
  const urlValidation = validateUrlProtocolAndHost(candidateUrl);
  if (!urlValidation.valid || !urlValidation.parsedUrl) {
    return {
      status: "WEBSITE_UNREACHABLE",
      candidateUrl,
      finalUrl: null,
      error: urlValidation.error || "Invalid URL syntax or blocked by SSRF filter",
    };
  }

  // 6. Attempt SSRF-safe HTTP fetch
  try {
    const fetchResult = await safeFetchWebsite(candidateUrl, { timeoutMs: 8000 });
    return {
      status: "WEBSITE_CONFIRMED",
      candidateUrl,
      finalUrl: fetchResult.finalUrl,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn("Website presence check encountered reachability failure", {
      companyId: company.id,
      candidateUrl,
      error: errorMessage,
    });

    return {
      status: "WEBSITE_UNREACHABLE",
      candidateUrl,
      finalUrl: null,
      error: errorMessage,
    };
  }
}

/**
 * Maps evidence-backed opportunity signals to standard OutreachOS requested service tags.
 */
export function mapSignalsToRequestedServices(signals: OpportunitySignal[]): string[] {
  const services = new Set<string>();

  for (const signal of signals) {
    switch (signal.category) {
      case "mobile_viewport":
        services.add("website_redesign");
        break;
      case "transport_security":
        services.add("website_security");
        break;
      case "seo_meta":
        services.add("website_seo");
        break;
      case "online_booking":
      case "call_to_action":
        services.add("conversion_optimization");
        break;
      case "accessibility":
        services.add("website_accessibility");
        break;
      default:
        services.add("website_improvement");
        break;
    }
  }

  if (services.size === 0) {
    services.add("website_improvement");
  }

  return Array.from(services);
}

/**
 * Maps source inputs to standard OpportunitySource enum values.
 */
export function mapToOpportunitySource(sourceStr?: string | null): OpportunitySource {
  if (!sourceStr) return OpportunitySource.GOOGLE_PLACES;
  const upper = sourceStr.toUpperCase().trim();

  if (upper.includes("HUNTER_DISCOVER") || upper.includes("HUNTER")) {
    return OpportunitySource.HUNTER_DISCOVER;
  }
  if (upper.includes("HUNTER_DOMAIN")) {
    return OpportunitySource.HUNTER_DOMAIN_SEARCH;
  }
  if (upper.includes("GOOGLE") || upper.includes("PLACES")) {
    return OpportunitySource.GOOGLE_PLACES;
  }
  if (upper.includes("CSV")) {
    return OpportunitySource.CSV_IMPORT;
  }
  if (upper.includes("FEED") || upper.includes("PUBLIC")) {
    return OpportunitySource.PUBLIC_FEED;
  }
  if (upper.includes("MANUAL")) {
    return OpportunitySource.MANUAL;
  }

  return OpportunitySource.GOOGLE_PLACES;
}

/**
 * Qualifies a persisted Company record for web-development service opportunities.
 *
 * Core Workflow:
 * 1. Load Company with strict tenant isolation (`where: { id: companyId, userId }`).
 * 2. Determine website presence status.
 * 3. For WEBSITE_NOT_FOUND -> Classify NO_WEBSITE opportunity.
 * 4. For WEBSITE_CONFIRMED -> Reuse Phase 5 research & extract supported signals -> Classify WEBSITE_IMPROVEMENT if deficiencies exist.
 * 5. For WEBSITE_UNREACHABLE -> Log warning, return no opportunity (preserves data integrity).
 * 6. Idempotently create or update Opportunity record preserving existing CRM lifecycle stage.
 *
 * Hard boundary: Zero Lead records are created.
 */
export async function qualifyCompanyOpportunity(
  userId: string,
  companyId: string,
  options: QualificationOptions = {}
): Promise<QualificationResult> {
  // 1. Strict tenant-scoped Company lookup
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      userId,
    },
  });

  if (!company) {
    throw new NotFoundError("Company not found or access denied");
  }

  logger.info("Starting opportunity qualification for company", {
    userId,
    companyId: company.id,
    companyName: company.name,
    forceRefresh: options.forceRefresh ?? false,
  });

  // 2. Evaluate website presence
  const presence = await determineWebsitePresence(company, options);

  // 3. Handle WEBSITE_UNREACHABLE (Ambiguous / Temporary Network Error)
  if (presence.status === "WEBSITE_UNREACHABLE") {
    logger.info("Company website presence is ambiguous/unreachable. No opportunity created.", {
      userId,
      companyId: company.id,
      candidateUrl: presence.candidateUrl,
      error: presence.error,
    });

    return {
      company: {
        id: company.id,
        name: company.name,
        domain: company.domain,
        website: company.website,
      },
      qualification: {
        websiteStatus: "WEBSITE_UNREACHABLE",
        opportunityCreated: false,
        action: "none",
        signals: [],
        message: `Website presence check was unreachable (${presence.error || "connection failed"}). No opportunity created to avoid false facts.`,
      },
    };
  }

  // 4. Resolve Discovery Source
  let resolvedSource = mapToOpportunitySource(options.source);
  if (!options.source) {
    // Check connected lead for source if available
    const leadWithSource = await prisma.lead.findFirst({
      where: { companyId: company.id, userId, source: { not: null } },
      select: { source: true },
    });
    if (leadWithSource?.source) {
      resolvedSource = mapToOpportunitySource(leadWithSource.source);
    }
  }

  // 5. Qualification Branch: WEBSITE_UNVERIFIED (Missing candidate alone is NOT proof of absence)
  if (presence.status === "WEBSITE_UNVERIFIED") {
    logger.info("Company website candidate is missing and absence is unverified. No opportunity created.", {
      userId,
      companyId: company.id,
      companyName: company.name,
    });

    return {
      company: {
        id: company.id,
        name: company.name,
        domain: company.domain,
        website: company.website,
      },
      qualification: {
        websiteStatus: "WEBSITE_UNVERIFIED",
        opportunityCreated: false,
        action: "none",
        signals: [],
        message: "No website candidate on record. Missing website candidate alone does not prove website absence. No opportunity created.",
      },
    };
  }

  // 6. Qualification Branch: WEBSITE_NOT_FOUND (Definitive Verified Absence)
  if (presence.status === "WEBSITE_NOT_FOUND") {
    const targetType = OpportunityType.NO_WEBSITE;
    const isStronglyVerified = !!options.absenceEvidence?.verifiedBy || options.verifiedNoWebsite === true;
    const targetConfidence = isStronglyVerified ? "high" : "medium";
    const targetTitle = `Website development opportunity for ${company.name}`;
    const targetDescription = `Verified website absence for ${company.name}. Evidence: ${presence.error || "Confirmed absence of web presence"}.`;
    const targetServices = ["website_development"];
    const targetEvidence = {
      websiteStatus: "WEBSITE_NOT_FOUND",
      reason: presence.error || "Confirmed absence of web presence",
      absenceEvidence: options.absenceEvidence || { verified: true },
      companyLocation: company.location,
      evaluatedAt: new Date().toISOString(),
    };
    const targetSignals: OpportunitySignal[] = [];

    const oppResult = await saveOrUpdateOpportunity(prisma, {
      userId,
      companyId: company.id,
      type: targetType,
      source: resolvedSource,
      title: targetTitle,
      description: targetDescription,
      confidence: targetConfidence,
      evidence: targetEvidence,
      opportunitySignals: targetSignals,
      requestedServices: targetServices,
      targetUrl: null,
      researchId: null,
    });

    logger.info("Qualified NO_WEBSITE opportunity with verified absence evidence", {
      userId,
      companyId: company.id,
      action: oppResult.action,
      opportunityId: oppResult.opportunity.id,
      confidence: targetConfidence,
    });

    return {
      company: {
        id: company.id,
        name: company.name,
        domain: company.domain,
        website: company.website,
      },
      qualification: {
        websiteStatus: "WEBSITE_NOT_FOUND",
        opportunityCreated: true,
        action: oppResult.action,
        opportunity: oppResult.opportunity,
        signals: [],
      },
    };
  }

  // 6. Qualification Branch: WEBSITE_CONFIRMED
  const finalUrl = presence.finalUrl || company.website || `https://${company.domain}`;

  // Check cached research within 7 days unless forceRefresh === true
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let researchId: string | null = null;
  let structuredEvidence: any = null;
  let signals: OpportunitySignal[] = [];
  let summaryText = "";

  if (!options.forceRefresh) {
    const cachedResearch = await prisma.aIResearch.findFirst({
      where: {
        userId,
        companyId: company.id,
        status: "COMPLETED",
        researchedAt: { gte: sevenDaysAgo },
      },
      orderBy: { researchedAt: "desc" },
    });

    if (cachedResearch) {
      researchId = cachedResearch.id;
      structuredEvidence = cachedResearch.structuredEvidence;
      signals = (cachedResearch.opportunitySignals as unknown as OpportunitySignal[]) || [];
      summaryText = cachedResearch.summary || "";
    }
  }

  // Perform fresh research if no valid cache exists or forceRefresh is true
  if (!researchId) {
    const researcher = options.websiteResearcher ?? defaultWebsiteResearcher;
    const fetchOptions = options.allowTestUrls
      ? { customResolver: async () => ["127.0.0.1"], customFetch: fetch }
      : undefined;
    const researchResult: WebsiteResearchResult = await researcher.researchWebsite(
      finalUrl,
      fetchOptions
    );

    // Save AIResearch record in database
    const newResearch = await prisma.aIResearch.create({
      data: {
        userId,
        companyId: company.id,
        status: "COMPLETED",
        url: researchResult.finalUrl,
        summary: researchResult.summary,
        structuredEvidence: researchResult.structuredEvidence as any,
        opportunitySignals: researchResult.opportunitySignals as any,
        provider: researchResult.provider,
        providerVersion: researchResult.providerVersion,
        serviceProfile: "web_development",
      },
    });

    researchId = newResearch.id;
    structuredEvidence = researchResult.structuredEvidence;
    signals = researchResult.opportunitySignals;
    summaryText = researchResult.summary;
  }

  // If website exists but has ZERO supported deficiencies, no opportunity is created
  if (signals.length === 0) {
    logger.info("Website confirmed reachable with zero supported deficiencies. No opportunity created.", {
      userId,
      companyId: company.id,
      finalUrl,
    });

    return {
      company: {
        id: company.id,
        name: company.name,
        domain: company.domain,
        website: company.website,
      },
      qualification: {
        websiteStatus: "WEBSITE_CONFIRMED",
        opportunityCreated: false,
        action: "none",
        signals: [],
        message: "Website exists and is well-configured. No supported web-development deficiencies detected.",
      },
    };
  }

  // Classify WEBSITE_IMPROVEMENT opportunity
  const targetType = OpportunityType.WEBSITE_IMPROVEMENT;
  const hasHighConfidenceSignal = signals.some((s) => s.confidence === "high");
  const targetConfidence = hasHighConfidenceSignal ? "high" : "medium";
  const targetServices = mapSignalsToRequestedServices(signals);

  const targetTitle = `Website improvement opportunity for ${company.name}`;
  const targetDescription = `Existing website (${finalUrl}) was reachable. Website research identified ${signals.length} supported deficiencies: ${signals.map((s) => s.issue).join("; ")}.`;
  const targetEvidence = {
    websiteStatus: "WEBSITE_CONFIRMED",
    researchId,
    summary: summaryText,
    signalsCount: signals.length,
    structuredEvidence,
    evaluatedAt: new Date().toISOString(),
  };

  const oppResult = await saveOrUpdateOpportunity(prisma, {
    userId,
    companyId: company.id,
    type: targetType,
    source: resolvedSource,
    title: targetTitle,
    description: targetDescription,
    confidence: targetConfidence,
    evidence: targetEvidence,
    opportunitySignals: signals,
    requestedServices: targetServices,
    targetUrl: finalUrl,
    researchId,
  });

  logger.info("Qualified WEBSITE_IMPROVEMENT opportunity", {
    userId,
    companyId: company.id,
    action: oppResult.action,
    opportunityId: oppResult.opportunity.id,
    signalsCount: signals.length,
  });

  return {
    company: {
      id: company.id,
      name: company.name,
      domain: company.domain,
      website: company.website,
    },
    qualification: {
      websiteStatus: "WEBSITE_CONFIRMED",
      opportunityCreated: true,
      action: oppResult.action,
      opportunity: oppResult.opportunity,
      signals,
    },
  };
}

interface SaveOpportunityParams {
  userId: string;
  companyId: string;
  type: OpportunityType;
  source: OpportunitySource;
  title: string;
  description: string;
  confidence: string;
  evidence: any;
  opportunitySignals: OpportunitySignal[];
  requestedServices: string[];
  targetUrl: string | null;
  researchId: string | null;
}

/**
 * Idempotently creates or updates an Opportunity for (userId, companyId, type).
 * Preserves existing CRM stage if stage is beyond IDENTIFIED.
 */
async function saveOrUpdateOpportunity(
  client: typeof prisma | Prisma.TransactionClient,
  params: SaveOpportunityParams
): Promise<{ opportunity: Opportunity; action: "created" | "updated" }> {
  const existing = await client.opportunity.findFirst({
    where: {
      userId: params.userId,
      companyId: params.companyId,
      type: params.type,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    // Preserve existing stage if beyond IDENTIFIED (e.g. QUALIFIED, CONTACTED, CONVERTED)
    const stageToKeep = existing.stage !== OpportunityStage.IDENTIFIED ? existing.stage : OpportunityStage.IDENTIFIED;

    const updated = await client.opportunity.update({
      where: { id: existing.id },
      data: {
        stage: stageToKeep,
        title: params.title,
        description: params.description,
        confidence: params.confidence,
        evidence: params.evidence as any,
        opportunitySignals: params.opportunitySignals as any,
        requestedServices: params.requestedServices,
        targetUrl: params.targetUrl,
        researchId: params.researchId || existing.researchId,
        updatedAt: new Date(),
      },
    });

    return { opportunity: updated, action: "updated" };
  }

  const created = await client.opportunity.create({
    data: {
      userId: params.userId,
      companyId: params.companyId,
      type: params.type,
      stage: OpportunityStage.IDENTIFIED,
      source: params.source,
      title: params.title,
      description: params.description,
      confidence: params.confidence,
      evidence: params.evidence as any,
      opportunitySignals: params.opportunitySignals as any,
      requestedServices: params.requestedServices,
      targetUrl: params.targetUrl,
      researchId: params.researchId,
    },
  });

  return { opportunity: created, action: "created" };
}
