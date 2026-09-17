/**
 * OutreachOS Centralized Lead Lifecycle Service
 *
 * One source of truth for:
 * - Lead Stage Transitions (deterministic, auditable, duplicate-prevention)
 * - True Interaction Semantics (strict separation between internal state updates and prospect interactions)
 * - Follow-up Scheduling, Completion, Cancellation, and Overdue Tracking
 * - Client Conversion & Closed-Lost Terminal States
 * - Multi-Tenant Isolation & Database Transaction Integrity
 */

import { prisma } from "../db";
import { LeadStage, FollowUpStatus, Prisma } from "@prisma/client";
import { NotFoundError, ForbiddenError } from "../auth/session";
import { getLeadById } from "./lead-service";
import { logger } from "../logger";

export interface StageTransitionMetadata {
  notes?: string;
  reason?: string;
  source?: string;
}

export interface StageTransitionResult {
  lead: Awaited<ReturnType<typeof getLeadById>> | null;
  interaction?: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    createdAt: Date;
  } | null;
  transitioned: boolean;
  message: string;
}

export interface FollowUpItem {
  id: string;
  campaignId: string | null;
  leadId: string;
  stepNumber: number;
  delayDays: number;
  status: FollowUpStatus;
  scheduledFor: Date;
  sentAt: Date | null;
  createdAt: Date;
  isOverdue: boolean;
}

export function formatStageLabel(stage: LeadStage): string {
  switch (stage) {
    case LeadStage.NEW:
      return "New";
    case LeadStage.CONTACTED:
      return "Contacted";
    case LeadStage.FOLLOW_UP:
      return "Follow-up";
    case LeadStage.REPLIED:
      return "Replied";
    case LeadStage.POSITIVE_REPLY:
      return "Positive Reply";
    case LeadStage.MEETING_SCHEDULED:
      return "Discovery Call";
    case LeadStage.CLIENT:
      return "Client Won";
    case LeadStage.CLOSED_LOST:
      return "Closed Lost";
    default:
      return stage;
  }
}

/**
 * Executes a deterministic, auditable stage transition for a lead.
 *
 * Rules:
 * - One source of truth for all stage changes.
 * - If current stage === targetStage: returns no-op with zero duplicate timeline entries.
 * - NEVER mutates lastInteractionAt merely because the stage changed.
 * - Creates a STAGE_CHANGE interaction atomically with fromStage/toStage metadata.
 * - CLIENT and CLOSED_LOST are real terminal states that preserve all prospect history.
 */
export async function transitionLeadStage(
  userId: string,
  leadId: string,
  targetStage: LeadStage,
  metadata?: StageTransitionMetadata,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<StageTransitionResult> {
  // 1. Verify existence and tenant ownership
  const existing = await client.lead.findFirst({
    where: { id: leadId, userId },
    select: {
      id: true,
      stage: true,
      fullName: true,
      lastInteractionAt: true,
    },
  });

  if (!existing) {
    throw new NotFoundError("Lead not found or unauthorized.");
  }

  // 2. No-op if stage has not changed (Duplicate Event Prevention)
  if (existing.stage === targetStage) {
    const fullLead = await getLeadById(userId, leadId, client);
    return {
      lead: fullLead,
      interaction: null,
      transitioned: false,
      message: `Lead is already in stage ${formatStageLabel(targetStage)}.`,
    };
  }

  const fromStage = existing.stage;
  const toStage = targetStage;

  // 3. Atomically update stage and record audit interaction
  const executeTransition = async (tx: Prisma.TransactionClient) => {
    // Update stage while preserving lastInteractionAt
    await tx.lead.update({
      where: { id: leadId },
      data: {
        stage: toStage,
        lastInteractionAt: existing.lastInteractionAt,
      },
    });

    // Construct human-readable audit description
    const reasonPart = metadata?.reason ? ` Reason: ${metadata.reason}.` : "";
    const notesPart = metadata?.notes ? ` Notes: ${metadata.notes}.` : "";
    const description = `Lead moved from ${formatStageLabel(fromStage)} to ${formatStageLabel(toStage)}.${reasonPart}${notesPart}`;

    const interaction = await tx.leadInteraction.create({
      data: {
        userId,
        leadId,
        type: "STAGE_CHANGE",
        title: `Stage Changed to ${toStage}`,
        description,
        metadata: {
          fromStage,
          toStage,
          notes: metadata?.notes || null,
          reason: metadata?.reason || null,
          source: metadata?.source || "Lifecycle Engine",
        },
      },
    });

    // If converted to CLIENT, assign or ensure CLIENT tag
    if (toStage === LeadStage.CLIENT) {
      try {
        let clientTag = await tx.leadTag.findUnique({
          where: {
            userId_name: {
              userId,
              name: "CLIENT",
            },
          },
        });

        if (!clientTag) {
          clientTag = await tx.leadTag.create({
            data: {
              userId,
              name: "CLIENT",
              type: "CLIENT",
              color: "#10b981",
            },
          });
        }

        await tx.leadTagAssignment.upsert({
          where: {
            leadId_tagId: {
              leadId,
              tagId: clientTag.id,
            },
          },
          update: {},
          create: {
            leadId,
            tagId: clientTag.id,
          },
        });
      } catch (tagErr) {
        // Tag assignment is supplemental; do not abort transition if duplicate key occurs
        logger.warn("Non-fatal CLIENT tag assignment note", { leadId, error: tagErr });
      }
    }

    const updatedLead = await getLeadById(userId, leadId, tx);

    return {
      lead: updatedLead,
      interaction,
      transitioned: true,
      message: `Lead transitioned from ${formatStageLabel(fromStage)} to ${formatStageLabel(toStage)}.`,
    };
  };

  const result =
    client === prisma
      ? await prisma.$transaction(executeTransition)
      : await executeTransition(client as Prisma.TransactionClient);

  logger.info("Lead stage transitioned successfully", {
    userId,
    leadId,
    fromStage,
    toStage,
    transitioned: true,
  });

  return result;
}

// --------------------------------------------------------
// FOLLOW-UP MANAGEMENT ENGINE
// --------------------------------------------------------

export interface CreateFollowUpParams {
  scheduledFor: string | Date;
  delayDays?: number;
  notes?: string;
  campaignId?: string;
}

/**
 * Creates a scheduled follow-up for a lead.
 * Does NOT update lastInteractionAt (internal CRM scheduling).
 */
export async function createFollowUp(
  userId: string,
  leadId: string,
  input: CreateFollowUpParams
): Promise<FollowUpItem> {
  // 1. Verify lead ownership
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, userId },
    select: { id: true, fullName: true },
  });

  if (!lead) {
    throw new NotFoundError("Lead not found or unauthorized.");
  }

  const scheduledForDate = new Date(input.scheduledFor);
  if (isNaN(scheduledForDate.getTime())) {
    throw new Error("Invalid scheduled date/time.");
  }

  return await prisma.$transaction(async (tx) => {
    // 2. Sequential step number based on count of existing follow-ups
    const existingCount = await tx.followUp.count({
      where: { leadId },
    });
    const stepNumber = existingCount + 1;

    // 3. Create FollowUp record
    const followUp = await tx.followUp.create({
      data: {
        leadId,
        campaignId: input.campaignId || null,
        stepNumber,
        delayDays: input.delayDays ?? 0,
        status: FollowUpStatus.SCHEDULED,
        scheduledFor: scheduledForDate,
      },
    });

    // 4. Log internal activity event (NOT changing lastInteractionAt)
    const notesPart = input.notes ? ` Notes: ${input.notes}` : "";
    await tx.leadInteraction.create({
      data: {
        userId,
        leadId,
        type: "NOTE",
        title: `Follow-up #${stepNumber} Scheduled`,
        description: `Follow-up scheduled for ${scheduledForDate.toLocaleDateString()}.${notesPart}`,
        metadata: {
          followUpId: followUp.id,
          stepNumber,
          scheduledFor: scheduledForDate.toISOString(),
          delayDays: input.delayDays ?? 0,
          notes: input.notes || null,
        },
      },
    });

    const isOverdue =
      followUp.status === FollowUpStatus.SCHEDULED &&
      followUp.scheduledFor < new Date();

    return {
      ...followUp,
      isOverdue,
    };
  });
}

/**
 * Updates a scheduled follow-up's date or parameters.
 * Strict multi-tenant check through lead.userId.
 */
export async function updateFollowUp(
  userId: string,
  followUpId: string,
  input: { scheduledFor?: string | Date; delayDays?: number; notes?: string }
): Promise<FollowUpItem> {
  const existing = await prisma.followUp.findFirst({
    where: {
      id: followUpId,
      lead: { userId },
    },
    include: {
      lead: { select: { id: true, userId: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError("Follow-up not found or unauthorized.");
  }

  if (existing.status !== FollowUpStatus.SCHEDULED) {
    throw new Error("Cannot update a follow-up that is not scheduled.");
  }

  const data: Prisma.FollowUpUpdateInput = {};

  if (input.scheduledFor !== undefined) {
    const d = new Date(input.scheduledFor);
    if (isNaN(d.getTime())) {
      throw new Error("Invalid date for scheduledFor");
    }
    data.scheduledFor = d;
  }

  if (input.delayDays !== undefined) {
    data.delayDays = input.delayDays;
  }

  const updated = await prisma.followUp.update({
    where: { id: followUpId },
    data,
  });

  const isOverdue =
    updated.status === FollowUpStatus.SCHEDULED &&
    updated.scheduledFor < new Date();

  return {
    ...updated,
    isOverdue,
  };
}

/**
 * Marks a follow-up as completed (SENT).
 * This is a GENUINE prospect interaction:
 * - Updates followUp.status = SENT, sentAt = now
 * - Creates interaction record
 * - Updates lead.lastInteractionAt = now
 */
export async function completeFollowUp(
  userId: string,
  followUpId: string,
  notes?: string
): Promise<FollowUpItem> {
  const existing = await prisma.followUp.findFirst({
    where: {
      id: followUpId,
      lead: { userId },
    },
    include: {
      lead: { select: { id: true, userId: true, fullName: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError("Follow-up not found or unauthorized.");
  }

  if (existing.status === FollowUpStatus.SENT) {
    throw new Error("Follow-up has already been completed.");
  }

  if (existing.status === FollowUpStatus.CANCELLED) {
    throw new Error("Cannot complete a cancelled follow-up.");
  }

  return await prisma.$transaction(async (tx) => {
    const now = new Date();

    // 1. Mark follow-up as SENT
    const updated = await tx.followUp.update({
      where: { id: followUpId },
      data: {
        status: FollowUpStatus.SENT,
        sentAt: now,
      },
    });

    // 2. Log genuine touchpoint interaction
    const desc = notes
      ? `Follow-up completed: ${notes}`
      : `Follow-up touchpoint step #${existing.stepNumber} completed.`;

    await tx.leadInteraction.create({
      data: {
        userId,
        leadId: existing.leadId,
        type: "NOTE",
        title: `Follow-up #${existing.stepNumber} Completed`,
        description: desc,
        metadata: {
          followUpId: existing.id,
          stepNumber: existing.stepNumber,
          notes: notes || null,
          completedAt: now.toISOString(),
        },
      },
    });

    // 3. Update lastInteractionAt because completing a follow-up touchpoint is an interaction
    await tx.lead.update({
      where: { id: existing.leadId },
      data: {
        lastInteractionAt: now,
      },
    });

    return {
      ...updated,
      isOverdue: false,
    };
  });
}

/**
 * Cancels a scheduled follow-up.
 * Does NOT update lastInteractionAt (internal cancellation).
 */
export async function cancelFollowUp(
  userId: string,
  followUpId: string,
  reason?: string
): Promise<FollowUpItem> {
  const existing = await prisma.followUp.findFirst({
    where: {
      id: followUpId,
      lead: { userId },
    },
    include: {
      lead: { select: { id: true, userId: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError("Follow-up not found or unauthorized.");
  }

  if (existing.status === FollowUpStatus.CANCELLED) {
    throw new Error("Follow-up is already cancelled.");
  }

  if (existing.status === FollowUpStatus.SENT) {
    throw new Error("Cannot cancel an already completed follow-up.");
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.followUp.update({
      where: { id: followUpId },
      data: {
        status: FollowUpStatus.CANCELLED,
      },
    });

    const desc = reason
      ? `Follow-up cancelled. Reason: ${reason}`
      : `Follow-up step #${existing.stepNumber} was cancelled.`;

    await tx.leadInteraction.create({
      data: {
        userId,
        leadId: existing.leadId,
        type: "NOTE",
        title: `Follow-up #${existing.stepNumber} Cancelled`,
        description: desc,
        metadata: {
          followUpId: existing.id,
          stepNumber: existing.stepNumber,
          reason: reason || null,
        },
      },
    });

    return {
      ...updated,
      isOverdue: false,
    };
  });
}

/**
 * Lists all follow-ups for a lead with strict tenant isolation and derived isOverdue flag.
 */
export async function listLeadFollowUps(
  userId: string,
  leadId: string
): Promise<FollowUpItem[]> {
  // Verify lead belongs to user
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, userId },
    select: { id: true },
  });

  if (!lead) {
    throw new NotFoundError("Lead not found or unauthorized.");
  }

  const now = new Date();
  const followUps = await prisma.followUp.findMany({
    where: {
      leadId,
      lead: { userId },
    },
    orderBy: {
      scheduledFor: "asc",
    },
  });

  return followUps.map((f) => ({
    ...f,
    isOverdue: f.status === FollowUpStatus.SCHEDULED && f.scheduledFor < now,
  }));
}
