import { prisma } from "../db";
import { LeadStage, TagType, Prisma } from "@prisma/client";
import { checkDuplicate, DeduplicationResult } from "../deduplication/detector";
import {
  normalizeEmail,
  normalizeLinkedInUrl,
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

  const skip = (page - 1) * pageSize;

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
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
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getLeadById(userId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({
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
      },
      meetings: {
        orderBy: { startTime: "asc" },
      },
      emailMessages: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return lead;
}

export async function createLead(
  userId: string,
  input: CreateLeadInput,
  options?: { skipDuplicateCheck?: boolean }
): Promise<{
  lead?: Awaited<ReturnType<typeof getLeadById>>;
  deduplication: DeduplicationResult;
}> {
  // 1. Duplicate detection
  if (!options?.skipDuplicateCheck) {
    const existingCandidates = await prisma.lead.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        linkedInUrl: true,
        fullName: true,
        company: {
          select: { name: true, domain: true },
        },
      },
    });

    const dedupResult = checkDuplicate(
      {
        email: input.email,
        linkedInUrl: input.linkedInUrl,
        fullName: input.fullName,
        firstName: input.firstName,
        lastName: input.lastName,
        companyName: input.companyName,
        companyDomain: input.companyDomain,
      },
      existingCandidates.map((c) => ({
        id: c.id,
        email: c.email,
        linkedInUrl: c.linkedInUrl,
        fullName: c.fullName,
        companyName: c.company?.name,
        companyDomain: c.company?.domain,
      }))
    );

    if (dedupResult.isDuplicate) {
      return { deduplication: dedupResult };
    }
  }

  // Ensure default user exists in users table
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: `${userId}@outreachos.dev`,
      name: "Outreach User",
    },
  });

  // 2. Resolve or create Company
  let companyId: string | null = null;
  if (input.companyName && input.companyName.trim() !== "") {
    const trimmedName = input.companyName.trim();
    let company = await prisma.company.findFirst({
      where: {
        userId,
        name: { equals: trimmedName, mode: "insensitive" },
      },
    });

    if (!company) {
      try {
        company = await prisma.company.create({
          data: {
            userId,
            name: trimmedName,
            domain: input.companyDomain || null,
            website: input.website || null,
            industry: input.industry || null,
            companySize: input.companySize || null,
            location: input.location || null,
          },
        });
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          company = await prisma.company.findUnique({
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
    companyId = company.id;
  }

  // 3. Compute fullName and deduplication hashes
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

  // 4. Create Lead with persistent deduplication fields
  const newLead = await prisma.lead.create({
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

  // 5. Assign default temperature tag
  const tagType = input.tagType || TagType.WARM;
  let tag = await prisma.leadTag.findFirst({
    where: { userId, type: tagType },
  });

  if (!tag) {
    tag = await prisma.leadTag.create({
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
  }

  await prisma.leadTagAssignment.create({
    data: {
      leadId: newLead.id,
      tagId: tag.id,
    },
  });

  // 6. Log creation interaction
  await prisma.leadInteraction.create({
    data: {
      userId,
      leadId: newLead.id,
      type: "STAGE_CHANGE",
      title: "Lead Created",
      description: `Lead created in stage ${newLead.stage}. Source: ${newLead.source}`,
    },
  });

  const fullLead = await getLeadById(userId, newLead.id);

  return {
    lead: fullLead,
    deduplication: {
      isDuplicate: false,
      status: "CREATED",
      reason: "Lead created successfully.",
    },
  };
}

export async function updateLead(
  userId: string,
  leadId: string,
  input: UpdateLeadInput
) {
  const existing = await prisma.lead.findFirst({
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
    const comp = await prisma.company.findUnique({
      where: { id: existing.companyId },
      select: { domain: true, name: true },
    });
    companyRef = comp?.domain || comp?.name || null;
  }

  const updated = await prisma.lead.update({
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

  // If stage changed, log interaction
  if (stageChanged && input.stage) {
    await prisma.leadInteraction.create({
      data: {
        userId,
        leadId,
        type: "STAGE_CHANGE",
        title: `Stage Changed to ${input.stage}`,
        description: `Lead moved from ${existing.stage} to ${input.stage}.`,
      },
    });
  }

  return getLeadById(userId, leadId);
}

export async function deleteLead(userId: string, leadId: string) {
  const existing = await prisma.lead.findFirst({
    where: { id: leadId, userId },
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
  const existing = await prisma.lead.findFirst({
    where: { id: leadId, userId },
  });

  if (!existing) {
    throw new Error("Lead not found or unauthorized.");
  }

  const interaction = await prisma.leadInteraction.create({
    data: {
      userId,
      leadId,
      type,
      title,
      description,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { lastInteractionAt: new Date() },
  });

  return interaction;
}
