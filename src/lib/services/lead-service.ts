import { prisma } from "../db";
import { LeadStage, TagType, InteractionType, Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../auth/session";
import { checkDuplicate, DeduplicationResult } from "../deduplication/detector";
import {
  normalizeEmail,
  normalizeLinkedInUrl,
  createNameCompanyKey,
  computeCompositeHash,
} from "../deduplication/normalizer";
import { transitionLeadStage } from "./lifecycle-service";

export interface ListLeadsParams {
  userId: string;
  search?: string;
  stage?: LeadStage;
  temperature?: TagType;
  tag?: string;
  tagId?: string;
  industry?: string;
  location?: string;
  companyName?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  lastInteractionAfter?: Date;
  lastInteractionBefore?: Date;
  sortBy?: "name" | "company" | "createdAt" | "updatedAt" | "lastInteractionAt" | "stage";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface CreateLeadInput {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedInUrl?: string;
  companyName?: string;
  companyDomain?: string;
  companySize?: string;
  industry?: string;
  location?: string;
  source?: string;
  stage?: LeadStage;
  notes?: string;
  tagType?: TagType;
}

export interface UpdateLeadInput {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedInUrl?: string;
  companyName?: string;
  companyDomain?: string;
  companySize?: string;
  industry?: string;
  location?: string;
  source?: string;
  stage?: LeadStage;
  notes?: string;
}

export async function listLeads(params: ListLeadsParams) {
  const {
    userId,
    search,
    stage,
    temperature,
    tag,
    tagId,
    industry,
    location,
    companyName,
    createdAfter,
    createdBefore,
    lastInteractionAfter,
    lastInteractionBefore,
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    pageSize = 20,
  } = params;

  const where: Prisma.LeadWhereInput = {
    userId,
  };

  // Search by name, email, job title, company, website, LinkedIn URL
  if (search && search.trim() !== "") {
    const q = search.trim();
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { jobTitle: { contains: q, mode: "insensitive" } },
      { company: { name: { contains: q, mode: "insensitive" } } },
      { website: { contains: q, mode: "insensitive" } },
      { linkedInUrl: { contains: q, mode: "insensitive" } },
    ];
  }

  if (stage) {
    where.stage = stage;
  }

  if (industry) {
    where.industry = { contains: industry, mode: "insensitive" };
  }

  if (location) {
    where.location = { contains: location, mode: "insensitive" };
  }

  if (companyName) {
    where.company = { name: { contains: companyName, mode: "insensitive" } };
  }

  // Tag & Temperature filters with deterministic AND behavior
  const tagConditions: Prisma.LeadWhereInput[] = [];
  if (temperature) {
    tagConditions.push({
      tagAssignments: {
        some: {
          tag: {
            type: temperature,
          },
        },
      },
    });
  }

  if (tag) {
    tagConditions.push({
      tagAssignments: {
        some: {
          tag: {
            name: { equals: tag, mode: "insensitive" },
          },
        },
      },
    });
  }

  if (tagId) {
    tagConditions.push({
      tagAssignments: {
        some: {
          tagId,
        },
      },
    });
  }

  if (tagConditions.length > 0) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      ...tagConditions,
    ];
  }

  // Date range filters
  if (createdAfter || createdBefore) {
    where.createdAt = {
      ...(createdAfter ? { gte: createdAfter } : {}),
      ...(createdBefore ? { lte: createdBefore } : {}),
    };
  }

  if (lastInteractionAfter || lastInteractionBefore) {
    where.lastInteractionAt = {
      ...(lastInteractionAfter ? { gte: lastInteractionAfter } : {}),
      ...(lastInteractionBefore ? { lte: lastInteractionBefore } : {}),
    };
  }

  // Safe server-side sorting with explicit allowlist & deterministic nullable relations
  let orderBy:
    | Prisma.LeadOrderByWithRelationInput
    | Prisma.LeadOrderByWithRelationInput[] = { createdAt: "desc" };

  if (sortBy === "name") {
    orderBy = { fullName: sortOrder };
  } else if (sortBy === "company") {
    // Relation sorting with deterministic tie-breaker
    orderBy = [{ company: { name: sortOrder } }, { id: "asc" }];
  } else if (sortBy === "updatedAt") {
    orderBy = { updatedAt: sortOrder };
  } else if (sortBy === "lastInteractionAt") {
    orderBy = { lastInteractionAt: sortOrder };
  } else if (sortBy === "stage") {
    orderBy = { stage: sortOrder };
  } else {
    orderBy = { createdAt: sortOrder };
  }

  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 100);
  const skip = (safePage - 1) * safePageSize;

  const [leads, total, stageGroups] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy,
      skip,
      take: safePageSize,
      include: {
        company: true,
        tagAssignments: {
          include: {
            tag: true,
          },
        },
      },
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({
      by: ["stage"],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  const stageCounts: Record<LeadStage, number> = {
    NEW: 0,
    CONTACTED: 0,
    FOLLOW_UP: 0,
    REPLIED: 0,
    POSITIVE_REPLY: 0,
    MEETING_SCHEDULED: 0,
    CLIENT: 0,
    CLOSED_LOST: 0,
  };

  for (const group of stageGroups) {
    stageCounts[group.stage] = group._count._all;
  }

  return {
    leads,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize),
    stageCounts,
  };
}

export async function getLeadById(
  userId: string,
  leadId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  const lead = await client.lead.findFirst({
    where: {
      id: leadId,
      userId,
    },
    include: {
      company: true,
      tagAssignments: {
        include: {
          tag: true,
        },
      },
      interactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      meetings: {
        orderBy: { startTime: "asc" },
        take: 20,
      },
      emailMessages: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      followUps: {
        orderBy: { scheduledFor: "asc" },
        take: 50,
      },
    },
  });

  return lead;
}

/**
 * O(1) Database-level duplicate detection using compound multi-tenant indexes.
 * Preserves the strict 3-tier priority hierarchy:
 * 1. Normalized Email
 * 2. Normalized LinkedIn URL
 * 3. Composite (Name + Company/Domain)
 */
export async function findDuplicateLead(
  client: Prisma.TransactionClient | typeof prisma,
  userId: string,
  input: {
    email?: string | null;
    linkedInUrl?: string | null;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    companyDomain?: string | null;
  }
): Promise<DeduplicationResult> {
  // Priority 1: Normalized Email (indexed on [userId, normalizedEmail])
  const normEmail = normalizeEmail(input.email);
  if (normEmail) {
    const match = await client.lead.findFirst({
      where: { userId, normalizedEmail: normEmail },
      select: { id: true, email: true },
    });
    if (match) {
      return {
        isDuplicate: true,
        status: "ALREADY_EXISTS",
        reason: `Lead with email '${input.email}' already exists.`,
        matchedLeadId: match.id,
        matchedBy: "email",
      };
    }
  }

  // Priority 2: Normalized LinkedIn URL (indexed on [userId, normalizedLinkedInUrl])
  const normLinkedIn = normalizeLinkedInUrl(input.linkedInUrl);
  if (normLinkedIn) {
    const match = await client.lead.findFirst({
      where: { userId, normalizedLinkedInUrl: normLinkedIn },
      select: { id: true, linkedInUrl: true },
    });
    if (match) {
      return {
        isDuplicate: true,
        status: "ALREADY_EXISTS",
        reason: `Lead with LinkedIn profile '${input.linkedInUrl}' already exists.`,
        matchedLeadId: match.id,
        matchedBy: "linkedin",
      };
    }
  }

  // Priority 3: Name + Company / Domain (indexed on [userId, compositeHash])
  const computedFullName =
    input.fullName ||
    [input.firstName, input.lastName].filter(Boolean).join(" ") ||
    null;

  const compKeyName = createNameCompanyKey(computedFullName, input.companyName);
  const compKeyDomain = createNameCompanyKey(computedFullName, input.companyDomain);
  const compositeKeys = Array.from(
    new Set([compKeyName, compKeyDomain].filter((k): k is string => Boolean(k)))
  );

  if (compositeKeys.length > 0) {
    const match = await client.lead.findFirst({
      where: {
        userId,
        compositeHash:
          compositeKeys.length === 1 ? compositeKeys[0] : { in: compositeKeys },
      },
      select: { id: true },
    });
    if (match) {
      const companyDesc = input.companyDomain || input.companyName || "company";
      return {
        isDuplicate: true,
        status: "ALREADY_EXISTS",
        reason: `Lead with matching name '${computedFullName}' at company '${companyDesc}' already exists.`,
        matchedLeadId: match.id,
        matchedBy: "name_company",
      };
    }
  }

  return {
    isDuplicate: false,
    status: "CREATED",
    reason: "Unique lead verified. No duplicates detected.",
  };
}

/**
 * Resolves or creates a company safely handling concurrent requests via @@unique([userId, name]).
 */
export async function findOrCreateCompany(
  userId: string,
  name: string,
  domain?: string | null,
  industry?: string | null,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  const trimmedName = name.trim();
  let company = await client.company.findUnique({
    where: {
      userId_name: {
        userId,
        name: trimmedName,
      },
    },
  });

  if (!company) {
    try {
      company = await client.company.create({
        data: {
          userId,
          name: trimmedName,
          domain: domain || null,
          industry: industry || null,
        },
      });
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        company = await client.company.findUnique({
          where: {
            userId_name: {
              userId,
              name: trimmedName,
            },
          },
        });
      }
      if (!company) throw err;
    }
  }

  return company;
}

export async function createLead(
  userId: string,
  input: CreateLeadInput,
  options?: { skipDuplicateCheck?: boolean }
): Promise<{
  lead: Awaited<ReturnType<typeof getLeadById>> | null;
  deduplication: DeduplicationResult;
}> {
  return await prisma.$transaction(async (tx) => {
    // 1. O(1) Database-level duplicate detection
    if (!options?.skipDuplicateCheck) {
      const dedupResult = await findDuplicateLead(tx, userId, input);
      if (dedupResult.isDuplicate) {
        return {
          lead: null,
          deduplication: dedupResult,
        };
      }
    }

    // 2. Ensure default user exists in users table
    await tx.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@outreachos.dev`,
        name: "Outreach User",
      },
    });

    // 3. Resolve or create Company (concurrently safe via @@unique([userId, name]))
    let companyId: string | null = null;
    if (input.companyName && input.companyName.trim() !== "") {
      const company = await findOrCreateCompany(
        userId,
        input.companyName,
        input.companyDomain,
        input.industry,
        tx
      );
      companyId = company.id;
    }

    // 4. Compute fullName and deduplication hashes
    const computedFullName =
      input.fullName ||
      [input.firstName, input.lastName].filter(Boolean).join(" ") ||
      "Unnamed Lead";

    const normEmail = normalizeEmail(input.email);
    const normLinkedIn = normalizeLinkedInUrl(input.linkedInUrl);
    const compKey = computeCompositeHash(
      computedFullName,
      input.companyDomain || input.companyName
    );

    // 5. Create Lead with persistent deduplication fields
    const newLead = await tx.lead.create({
      data: {
        userId,
        companyId,
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        fullName: computedFullName,
        jobTitle: input.jobTitle || null,
        email: input.email || null,
        phone: input.phone || null,
        website: input.website || null,
        linkedInUrl: input.linkedInUrl || null,
        companySize: input.companySize || null,
        industry: input.industry || null,
        location: input.location || null,
        source: input.source || "Manual Entry",
        stage: input.stage || LeadStage.NEW,
        notes: input.notes || null,
        normalizedEmail: normEmail,
        normalizedLinkedInUrl: normLinkedIn,
        compositeHash: compKey,
        lastInteractionAt: new Date(),
      },
    });

    // 6. Assign default temperature tag
    const tagType = input.tagType || TagType.WARM;
    let tag = await tx.leadTag.findUnique({
      where: {
        userId_name: {
          userId,
          name: tagType,
        },
      },
    });

    if (!tag) {
      try {
        tag = await tx.leadTag.create({
          data: {
            userId,
            name: tagType,
            type: tagType,
            color:
              tagType === TagType.HOT
                ? "#ef4444"
                : tagType === TagType.WARM
                ? "#f59e0b"
                : tagType === TagType.COLD
                ? "#6b7280"
                : tagType === TagType.CLIENT
                ? "#10b981"
                : "#3b82f6",
          },
        });
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          tag = await tx.leadTag.findUnique({
            where: {
              userId_name: {
                userId,
                name: tagType,
              },
            },
          });
        }
        if (!tag) throw err;
      }
    }

    await tx.leadTagAssignment.create({
      data: {
        leadId: newLead.id,
        tagId: tag.id,
      },
    });

    // 7. Log creation interaction
    await tx.leadInteraction.create({
      data: {
        userId,
        leadId: newLead.id,
        type: "STAGE_CHANGE",
        title: "Lead Created",
        description: `Lead created in stage ${newLead.stage}. Source: ${newLead.source}`,
      },
    });

    const fullLead = await getLeadById(userId, newLead.id, tx);

    return {
      lead: fullLead,
      deduplication: {
        isDuplicate: false,
        status: "CREATED",
        reason: "Lead created successfully.",
      },
    };
  });
}

export async function updateLead(
  userId: string,
  leadId: string,
  input: UpdateLeadInput
) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({
      where: { id: leadId, userId },
    });

    if (!existing) {
      throw new Error("Lead not found or unauthorized.");
    }

    const stageChanged = input.stage && input.stage !== existing.stage;

    const effectiveFullName =
      input.fullName !== undefined
        ? input.fullName
        : input.firstName || input.lastName
        ? [input.firstName || existing.firstName, input.lastName || existing.lastName]
            .filter(Boolean)
            .join(" ")
        : existing.fullName;
    const effectiveEmail = input.email !== undefined ? input.email : existing.email;
    const effectiveLinkedIn =
      input.linkedInUrl !== undefined ? input.linkedInUrl : existing.linkedInUrl;

    let companyRef = input.companyDomain || input.companyName || null;
    if (!companyRef && existing.companyId) {
      const comp = await tx.company.findUnique({
        where: { id: existing.companyId },
        select: { domain: true, name: true },
      });
      companyRef = comp?.domain || comp?.name || null;
    }

    await tx.lead.update({
      where: { id: leadId },
      data: {
        firstName: input.firstName !== undefined ? input.firstName : existing.firstName,
        lastName: input.lastName !== undefined ? input.lastName : existing.lastName,
        fullName: effectiveFullName,
        jobTitle: input.jobTitle !== undefined ? input.jobTitle : existing.jobTitle,
        email: input.email !== undefined ? input.email : existing.email,
        phone: input.phone !== undefined ? input.phone : existing.phone,
        website: input.website !== undefined ? input.website : existing.website,
        linkedInUrl: input.linkedInUrl !== undefined ? input.linkedInUrl : existing.linkedInUrl,
        companySize: input.companySize !== undefined ? input.companySize : existing.companySize,
        industry: input.industry !== undefined ? input.industry : existing.industry,
        location: input.location !== undefined ? input.location : existing.location,
        stage: existing.stage,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        normalizedEmail: normalizeEmail(effectiveEmail),
        normalizedLinkedInUrl: normalizeLinkedInUrl(effectiveLinkedIn),
        compositeHash: computeCompositeHash(effectiveFullName, companyRef),
        lastInteractionAt: existing.lastInteractionAt,
      },
    });

    // If stage changed, delegate to centralized lifecycle service
    if (stageChanged && input.stage) {
      await transitionLeadStage(userId, leadId, input.stage, undefined, tx);
    }

    return getLeadById(userId, leadId, tx);
  });
}

export async function deleteLead(userId: string, leadId: string) {
  const existing = await prisma.lead.findFirst({
    where: { id: leadId, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Lead not found or unauthorized.");
  }

  await prisma.lead.delete({
    where: { id: leadId },
  });

  return { success: true, deletedId: leadId };
}

export async function addLeadInteraction(
  userId: string,
  leadId: string,
  type: "NOTE" | "CALL" | "MEETING" | "EMAIL_SENT" | "REPLY_RECEIVED",
  title: string,
  description?: string
) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({
      where: { id: leadId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Lead not found or unauthorized.");
    }

    const interaction = await tx.leadInteraction.create({
      data: {
        userId,
        leadId,
        type,
        title,
        description,
      },
    });

    await tx.lead.update({
      where: { id: leadId },
      data: { lastInteractionAt: new Date() },
    });

    return interaction;
  });
}

// --------------------------------------------------------
// TAG MANAGEMENT (TENANT-SCOPED)
// --------------------------------------------------------

export async function createTag(
  userId: string,
  input: { name: string; type?: TagType; color?: string }
) {
  const trimmedName = input.name.trim();
  let tag = await prisma.leadTag.findUnique({
    where: {
      userId_name: {
        userId,
        name: trimmedName,
      },
    },
  });

  if (!tag) {
    try {
      tag = await prisma.leadTag.create({
        data: {
          userId,
          name: trimmedName,
          type: input.type || TagType.CUSTOM,
          color: input.color || null,
        },
      });
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        tag = await prisma.leadTag.findUnique({
          where: {
            userId_name: {
              userId,
              name: trimmedName,
            },
          },
        });
      }
      if (!tag) throw err;
    }
  }

  return tag;
}

export async function listTags(userId: string) {
  return await prisma.leadTag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { assignments: true },
      },
    },
  });
}

export async function assignTagToLead(
  userId: string,
  leadId: string,
  tagId: string
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Verify lead belongs to user
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      select: { id: true, userId: true },
    });
    if (!lead) {
      throw new NotFoundError("Lead not found.");
    }
    if (lead.userId !== userId) {
      throw new ForbiddenError("Unauthorized access to lead.");
    }

    // 2. Verify tag belongs to user
    const tag = await tx.leadTag.findUnique({
      where: { id: tagId },
      select: { id: true, userId: true },
    });
    if (!tag) {
      throw new NotFoundError("Tag not found.");
    }
    if (tag.userId !== userId) {
      throw new ForbiddenError("Unauthorized access to tag.");
    }

    // 3. Prevent duplicate assignment gracefully
    let assignment = await tx.leadTagAssignment.findUnique({
      where: {
        leadId_tagId: {
          leadId,
          tagId,
        },
      },
    });

    if (!assignment) {
      assignment = await tx.leadTagAssignment.create({
        data: {
          leadId,
          tagId,
        },
      });
    }

    return { assignment, tag };
  });
}

export async function removeTagFromLead(
  userId: string,
  leadId: string,
  tagId: string
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Verify lead belongs to user
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      select: { id: true, userId: true },
    });
    if (!lead) {
      throw new NotFoundError("Lead not found.");
    }
    if (lead.userId !== userId) {
      throw new ForbiddenError("Unauthorized access to lead.");
    }

    // 2. Verify tag belongs to user
    const tag = await tx.leadTag.findUnique({
      where: { id: tagId },
      select: { id: true, userId: true },
    });
    if (!tag) {
      throw new NotFoundError("Tag not found.");
    }
    if (tag.userId !== userId) {
      throw new ForbiddenError("Unauthorized access to tag.");
    }

    await tx.leadTagAssignment.deleteMany({
      where: {
        leadId,
        tagId,
      },
    });

    return { success: true, leadId, tagId };
  });
}

// --------------------------------------------------------
// TIMELINE INTERACTIONS (BOUNDED RETRIEVAL)
// --------------------------------------------------------

export async function listLeadInteractions(
  userId: string,
  leadId: string,
  params: { page?: number; pageSize?: number; type?: InteractionType }
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, userId: true },
  });
  if (!lead) {
    throw new NotFoundError("Lead not found.");
  }
  if (lead.userId !== userId) {
    throw new ForbiddenError("Unauthorized access to lead.");
  }

  const safePage = Math.max(1, params.page || 1);
  const safePageSize = Math.min(Math.max(1, params.pageSize || 20), 100);
  const skip = (safePage - 1) * safePageSize;

  const where: Prisma.LeadInteractionWhereInput = {
    leadId,
    userId,
  };
  if (params.type) {
    where.type = params.type;
  }

  const [interactions, total] = await Promise.all([
    prisma.leadInteraction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: safePageSize,
    }),
    prisma.leadInteraction.count({ where }),
  ]);

  return {
    interactions,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize),
  };
}

// --------------------------------------------------------
// BULK OPERATIONS (TRANSACTIONAL & TENANT-ISOLATED)
// --------------------------------------------------------

export interface BulkLeadsInput {
  action: "UPDATE_STAGE" | "ASSIGN_TAG" | "REMOVE_TAG" | "DELETE";
  leadIds: string[];
  stage?: LeadStage;
  tagId?: string;
}

export async function bulkLeadOperation(
  userId: string,
  input: BulkLeadsInput
) {
  const uniqueLeadIds = Array.from(new Set(input.leadIds));
  if (uniqueLeadIds.length === 0) {
    return { affectedCount: 0 };
  }
  if (uniqueLeadIds.length > 100) {
    throw new Error("Cannot process more than 100 leads per bulk operation.");
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Verify all leads exist and enforce strict tenant ownership
    const foundLeads = await tx.lead.findMany({
      where: {
        id: { in: uniqueLeadIds },
      },
      select: { id: true, userId: true, stage: true },
    });

    if (foundLeads.length !== uniqueLeadIds.length) {
      throw new NotFoundError("One or more leads do not exist.");
    }

    const crossTenantLead = foundLeads.some((l) => l.userId !== userId);
    if (crossTenantLead) {
      throw new ForbiddenError("One or more leads belong to another tenant.");
    }

    if (input.action === "ASSIGN_TAG" || input.action === "REMOVE_TAG") {
      if (!input.tagId) {
        throw new Error("Tag ID is required for tag operations.");
      }
      const tag = await tx.leadTag.findUnique({
        where: { id: input.tagId },
        select: { id: true, userId: true },
      });
      if (!tag) {
        throw new NotFoundError("Tag not found.");
      }
      if (tag.userId !== userId) {
        throw new ForbiddenError("Tag belongs to another tenant.");
      }

      if (input.action === "ASSIGN_TAG") {
        await tx.leadTagAssignment.createMany({
          data: uniqueLeadIds.map((leadId) => ({
            leadId,
            tagId: input.tagId!,
          })),
          skipDuplicates: true,
        });
        return { affectedCount: uniqueLeadIds.length };
      } else {
        const result = await tx.leadTagAssignment.deleteMany({
          where: {
            leadId: { in: uniqueLeadIds },
            tagId: input.tagId,
          },
        });
        return { affectedCount: result.count };
      }
    }

    if (input.action === "UPDATE_STAGE") {
      if (!input.stage) {
        throw new Error("Stage is required for stage update.");
      }

      // Bulk update stage without altering lastInteractionAt
      await tx.lead.updateMany({
        where: {
          id: { in: uniqueLeadIds },
          userId,
        },
        data: {
          stage: input.stage,
        },
      });

      // Record STAGE_CHANGE interactions in bulk for leads whose stage actually changed
      const changedLeads = foundLeads.filter((l) => l.stage !== input.stage);
      if (changedLeads.length > 0) {
        await tx.leadInteraction.createMany({
          data: changedLeads.map((l) => ({
            userId,
            leadId: l.id,
            type: "STAGE_CHANGE" as const,
            title: `Stage Changed to ${input.stage}`,
            description: `Lead moved from ${l.stage} to ${input.stage}.`,
          })),
        });
      }

      return { affectedCount: uniqueLeadIds.length };
    }

    if (input.action === "DELETE") {
      const result = await tx.lead.deleteMany({
        where: {
          id: { in: uniqueLeadIds },
          userId,
        },
      });
      return { affectedCount: result.count };
    }

    throw new Error(`Unsupported action: ${input.action}`);
  });
}
