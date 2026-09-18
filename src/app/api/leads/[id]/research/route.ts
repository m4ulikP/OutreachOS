import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser, ForbiddenError, NotFoundError } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { cuidParamSchema } from "@/lib/validation/common";
import { researchWebsiteSchema } from "@/lib/validation/research";
import { defaultWebsiteResearcher } from "@/lib/research";
import { enforceResearchRateLimit } from "@/lib/rate-limit";
import { withApiObservability } from "@/lib/api-wrapper";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

/**
 * GET /api/leads/[id]/research
 * Retrieves latest cached research for the specified lead (tenant-isolated).
 */
export const GET = withApiObservability<RouteParams>(
  async (req: NextRequest, { params }, { requestId }) => {
    try {
      const user = await requireAuthUser(req);

      const idValidation = cuidParamSchema.safeParse(params?.id);
      if (!idValidation.success) {
        return handleApiError(idValidation.error, undefined, requestId);
      }
      const leadId = idValidation.data;

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, userId: true },
      });

      if (!lead) {
        throw new NotFoundError("Lead not found");
      }
      if (lead.userId !== user.id) {
        throw new ForbiddenError("You do not have access to this lead");
      }

      const research = await prisma.aIResearch.findFirst({
        where: { userId: user.id, leadId },
        orderBy: { researchedAt: "desc" },
      });

      return NextResponse.json(
        {
          success: true,
          research: research || null,
          cached: Boolean(research),
          requestId,
        },
        { status: 200 }
      );
    } catch (error: unknown) {
      return handleApiError(error, `GET /api/leads/${params?.id}/research error`, requestId);
    }
  }
);

/**
 * POST /api/leads/[id]/research
 * Executes an SSRF-safe website research request on the lead or company website.
 * Enforces rate limiting, caching, bounded JSON storage, and tenant isolation.
 */
export const POST = withApiObservability<RouteParams>(
  async (req: NextRequest, { params }, { requestId }) => {
    try {
      const user = await requireAuthUser(req);

      const idValidation = cuidParamSchema.safeParse(params?.id);
      if (!idValidation.success) {
        return handleApiError(idValidation.error, undefined, requestId);
      }
      const leadId = idValidation.data;

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { company: true },
      });

      if (!lead) {
        throw new NotFoundError("Lead not found");
      }
      if (lead.userId !== user.id) {
        throw new ForbiddenError("You do not have permission to research this lead");
      }

      // Parse and validate request body
      let body: unknown = {};
      try {
        const text = await req.text();
        if (text && text.trim()) {
          body = JSON.parse(text);
        }
      } catch {
        return handleApiError(new ValidationError("Invalid JSON payload"), undefined, requestId);
      }

      const bodyValidation = researchWebsiteSchema.safeParse(body);
      if (!bodyValidation.success) {
        return handleApiError(bodyValidation.error, undefined, requestId);
      }

      const { websiteUrl, forceRefresh } = bodyValidation.data;

      // Determine target URL from request, lead, or company record
      let targetUrl = websiteUrl || lead.website || lead.company?.website;
      if (!targetUrl || !targetUrl.trim()) {
        throw new ValidationError(
          "Lead has no website associated. Please provide a website URL to research."
        );
      }

      targetUrl = targetUrl.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = `https://${targetUrl}`;
      }

      // Check Cache / Freshness (Constraint 4: Cache recent completed research within 7 days)
      if (!forceRefresh) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const existingRecent = await prisma.aIResearch.findFirst({
          where: {
            userId: user.id,
            leadId,
            status: "COMPLETED",
            researchedAt: { gte: sevenDaysAgo },
          },
          orderBy: { researchedAt: "desc" },
        });

        if (existingRecent) {
          logger.info("[Research] Reusing fresh completed research from cache", {
            userId: user.id,
            leadId,
            researchId: existingRecent.id,
            requestId,
          });

          return NextResponse.json(
            {
              success: true,
              research: existingRecent,
              cached: true,
              message: "Loaded existing research from cache. Use 'Re-run Research' to refresh.",
              requestId,
            },
            { status: 200 }
          );
        }
      }

      // Enforce Rate Limiting (12 requests / 5 minutes per user)
      await enforceResearchRateLimit(user.id, req);

      logger.info("[Research] Executing website research", {
        userId: user.id,
        leadId,
        url: targetUrl,
        forceRefresh,
        requestId,
      });

      // Execute SSRF-safe website research
      const researchResult = await defaultWebsiteResearcher.researchWebsite(targetUrl);

      // Persist research record in database (bounded JSON storage)
      const savedResearch = await prisma.aIResearch.create({
        data: {
          userId: user.id,
          leadId,
          companyId: lead.companyId,
          status: "COMPLETED",
          url: researchResult.finalUrl,
          summary: researchResult.summary,
          structuredEvidence: researchResult.structuredEvidence as any,
          opportunitySignals: researchResult.opportunitySignals as any,
          serviceProfile: "web_development",
          provider: researchResult.provider,
          providerVersion: researchResult.providerVersion,
          researchedAt: new Date(),
        },
      });

      // If lead had no website or different website, update lead/company
      if (!lead.website && researchResult.finalUrl) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { website: researchResult.finalUrl },
        });
      }

      // Record LeadInteraction audit timeline
      await prisma.leadInteraction.create({
        data: {
          userId: user.id,
          leadId,
          type: "AI_RESEARCH",
          title: "Website Research Completed",
          description: researchResult.summary,
          metadata: {
            url: researchResult.finalUrl,
            opportunitiesCount: researchResult.opportunitySignals.length,
            durationMs: researchResult.durationMs,
          },
        },
      });

      await prisma.lead.update({
        where: { id: leadId },
        data: { lastInteractionAt: new Date() },
      });

      logger.info("[Research] Website research completed and stored", {
        userId: user.id,
        leadId,
        researchId: savedResearch.id,
        opportunitiesCount: researchResult.opportunitySignals.length,
        requestId,
      });

      return NextResponse.json(
        {
          success: true,
          research: savedResearch,
          cached: false,
          requestId,
        },
        { status: 200 }
      );
    } catch (error: unknown) {
      return handleApiError(error, `POST /api/leads/${params?.id}/research error`, requestId);
    }
  }
);
