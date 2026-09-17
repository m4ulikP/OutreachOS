import { prisma } from "../db";
import { LeadStage, TagType, Prisma } from "@prisma/client";
import { checkDuplicate, DeduplicationResult } from "../deduplication/detector";
import {
  normalizeEmail,
  normalizeLinkedInUrl,
  createNameCompanyKey,
  computeCompositeHash,
} from "../deduplication/normalizer";

export interface ListLeadsParams {
  userId: string;
  search?: string;
  stage?: LeadStage;
  temperature?: TagType;
  industry?: string;
  location?: string;
  companyName?: string;
  sortBy?: "name" | "createdAt" | "lastInteractionAt" | "stage";
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
    industry,
    location,
    companyName,
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    pageSize = 20,
  } = params;

  const where: Prisma.LeadWhereInput = {
    userId,
  };

  // Search by name, email, job title, company
  if (search && search.trim() !== "") {
    const q = search.trim();
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { jobTitle: { contains: q, mode: "insensitive" } },
      { company: { name: { contains: q, mode: "insensitive" } } },
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

  if (temperature) {
    where.tagAssignments = {
      some: {
        tag: {
          type: temperature,
        },
      },
    };
  }

  // Ordering
  let orderBy: Prisma.LeadOrderByWithRelationInput = { createdAt: "desc" };
  if (sortBy === "name") {
    orderBy = { fullName: sortOrder };
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

  const [leads, total] = await Promise.all([
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
  ]);

  return {
    leads,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize),
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
        stage: input.stage !== undefined ? input.stage : existing.stage,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        normalizedEmail: normalizeEmail(effectiveEmail),
        normalizedLinkedInUrl: normalizeLinkedInUrl(effectiveLinkedIn),
        compositeHash: computeCompositeHash(effectiveFullName, companyRef),
        lastInteractionAt: stageChanged ? new Date() : existing.lastInteractionAt,
      },
    });

    // If stage changed, log interaction atomically
    if (stageChanged && input.stage) {
      await tx.leadInteraction.create({
        data: {
          userId,
          leadId,
          type: "STAGE_CHANGE",
          title: `Stage Changed to ${input.stage}`,
          description: `Lead moved from ${existing.stage} to ${input.stage}.`,
        },
      });
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
