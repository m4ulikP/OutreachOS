import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser, ForbiddenError, NotFoundError } from "@/lib/auth/session";
import { handleApiError, ValidationError } from "@/lib/api-response";
import { cuidParamSchema } from "@/lib/validation/common";
import {
  generatePersonalizationSchema,
  updatePersonalizationSchema,
} from "@/lib/validation/research";
import { getAIProvider, personalizationOutputSchema } from "@/lib/providers/ai";
import { getServiceProfile } from "@/lib/service-profiles";
import { enforcePersonalizationRateLimit } from "@/lib/rate-limit";
import { withApiObservability } from "@/lib/api-wrapper";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

/**
 * GET /api/leads/[id]/personalization
 * Retrieves the latest generated outreach draft for the specified lead (tenant-isolated).
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
        throw new ForbiddenError("You do not have access to this lead's outreach drafts");
      }

      const personalization = await prisma.aIGeneration.findFirst({
        where: { userId: user.id, leadId },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(
        {
          success: true,
          personalization: personalization || null,
          requestId,
        },
        { status: 200 }
      );
    } catch (error: unknown) {
      return handleApiError(error, `GET /api/leads/${params?.id}/personalization error`, requestId);
    }
  }
);

/**
 * POST /api/leads/[id]/personalization
 * Generates personalized multi-channel outreach (email + LinkedIn) using research evidence.
 * Validates AI output before saving and enforces rate limits.
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
        throw new ForbiddenError("You do not have permission to personalize outreach for this lead");
      }

      // Parse body
      let body: unknown = {};
      try {
        const text = await req.text();
        if (text && text.trim()) {
          body = JSON.parse(text);
        }
      } catch {
        return handleApiError(new ValidationError("Invalid JSON payload"), undefined, requestId);
      }

      const bodyValidation = generatePersonalizationSchema.safeParse(body);
      if (!bodyValidation.success) {
        return handleApiError(bodyValidation.error, undefined, requestId);
      }

      const { serviceProfile: serviceProfileId, forceRegenerate } = bodyValidation.data;

      // Check if recent personalization already exists (unless forceRegenerate is set)
      if (!forceRegenerate) {
        const existingRecent = await prisma.aIGeneration.findFirst({
          where: {
            userId: user.id,
            leadId,
            serviceProfile: serviceProfileId,
          },
          orderBy: { createdAt: "desc" },
        });

        if (existingRecent) {
          return NextResponse.json(
            {
              success: true,
              personalization: existingRecent,
              cached: true,
              message: "Loaded existing saved outreach draft.",
              requestId,
            },
            { status: 200 }
          );
        }
      }

      // Enforce Rate Limiting (15 generations / 5 minutes per user)
      await enforcePersonalizationRateLimit(user.id, req);

      // Fetch latest research for this lead
      const latestResearch = await prisma.aIResearch.findFirst({
        where: { userId: user.id, leadId, status: "COMPLETED" },
        orderBy: { researchedAt: "desc" },
      });

      const profile = getServiceProfile(serviceProfileId);
      const aiProvider = getAIProvider();

      logger.info("[Personalization] Generating outreach draft via AI", {
        userId: user.id,
        leadId,
        provider: aiProvider.name,
        serviceProfile: profile.name,
        hasResearch: Boolean(latestResearch),
        requestId,
      });

      // Call AI provider with strict prompt injection defenses
      const leadName =
        lead.fullName ||
        [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
        "Executive";

      const output = await aiProvider.generatePersonalization({
        lead: {
          fullName: leadName,
          jobTitle: lead.jobTitle,
          companyName: lead.company?.name || lead.companySize || undefined,
          industry: lead.industry,
          location: lead.location,
          website: lead.website || lead.company?.website,
        },
        research: latestResearch
          ? {
              summary: latestResearch.summary,
              structuredEvidence: latestResearch.structuredEvidence as Record<string, unknown>,
              opportunitySignals: latestResearch.opportunitySignals as any,
            }
          : null,
        serviceProfile: {
          name: profile.name,
          focusAreas: profile.focusAreas,
          systemInstructionContext: profile.systemInstructionContext,
        },
      });

      // Validate output schema strictly before persistence (Constraint 13)
      const validated = personalizationOutputSchema.parse(output);

      // Persist to AIGeneration
      const savedGeneration = await prisma.aIGeneration.create({
        data: {
          userId: user.id,
          leadId,
          type: "COLD_EMAIL",
          prompt: `Personalization generation for ${leadName} (${profile.name})`,
          generatedText: validated.emailBody,
          subject: validated.subjectLine,
          emailBody: validated.emailBody,
          linkedInMessage: validated.linkedInMessage,
          whyProspect: validated.whyProspect,
          evidenceUsed: validated.evidenceUsed as any,
          serviceProfile: profile.id,
          confidence: validated.confidence,
        },
      });

      logger.info("[Personalization] Outreach draft generated and saved", {
        userId: user.id,
        leadId,
        generationId: savedGeneration.id,
        confidence: validated.confidence,
        requestId,
      });

      return NextResponse.json(
        {
          success: true,
          personalization: savedGeneration,
          cached: false,
          requestId,
        },
        { status: 200 }
      );
    } catch (error: unknown) {
      return handleApiError(error, `POST /api/leads/${params?.id}/personalization error`, requestId);
    }
  }
);

/**
 * PUT /api/leads/[id]/personalization
 * Saves user edits to subject line, email body, and LinkedIn message.
 * Strictly verifies tenant isolation and validates string bounds.
 */
export const PUT = withApiObservability<RouteParams>(
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
        throw new ForbiddenError("You do not have permission to edit this outreach draft");
      }

      let body: unknown = {};
      try {
        body = await req.json();
      } catch {
        return handleApiError(new ValidationError("Invalid JSON in request body"), undefined, requestId);
      }

      const bodyValidation = updatePersonalizationSchema.safeParse(body);
      if (!bodyValidation.success) {
        return handleApiError(bodyValidation.error, undefined, requestId);
      }

      const { id: draftId, subject, emailBody, linkedInMessage } = bodyValidation.data;

      // Find target draft (either by specific ID or latest for this lead)
      let targetDraft = null;
      if (draftId) {
        targetDraft = await prisma.aIGeneration.findUnique({
          where: { id: draftId },
        });
      } else {
        targetDraft = await prisma.aIGeneration.findFirst({
          where: { userId: user.id, leadId },
          orderBy: { createdAt: "desc" },
        });
      }

      if (!targetDraft || targetDraft.userId !== user.id) {
        throw new NotFoundError("Outreach draft not found or not owned by user");
      }

      const updatedDraft = await prisma.aIGeneration.update({
        where: { id: targetDraft.id },
        data: {
          ...(subject !== undefined ? { subject } : {}),
          ...(emailBody !== undefined ? { emailBody, editedText: emailBody } : {}),
          ...(linkedInMessage !== undefined ? { linkedInMessage } : {}),
          updatedAt: new Date(),
        },
      });

      logger.info("[Personalization] User outreach edits saved", {
        userId: user.id,
        leadId,
        generationId: updatedDraft.id,
        requestId,
      });

      return NextResponse.json(
        {
          success: true,
          personalization: updatedDraft,
          message: "Outreach draft saved successfully.",
          requestId,
        },
        { status: 200 }
      );
    } catch (error: unknown) {
      return handleApiError(error, `PUT /api/leads/${params?.id}/personalization error`, requestId);
    }
  }
);
