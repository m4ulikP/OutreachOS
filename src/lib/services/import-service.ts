/**
 * OutreachOS Production-Grade CSV Lead Import Service
 *
 * Implements bounded, tenant-isolated, high-performance CSV importing with:
 * - RFC 4180 parsing with zero runtime dependencies
 * - Mass-assignment protection against server-controlled fields
 * - Intra-CSV duplicate detection (email, LinkedIn, composite)
 * - Database-level multi-tenant indexed O(1) duplicate detection
 * - Concurrently safe company resolution via findOrCreateCompany
 * - Bounded batch persistence (50 rows per batch transaction)
 * - Preview mode support (?preview=true) with zero database mutations
 * - Accurate operational metrics and row-level error reporting
 */

import { prisma } from "../db";
import { LeadStage, TagType, Prisma } from "@prisma/client";
import {
  parseCsv,
  MAX_FILE_SIZE_BYTES,
  MAX_ROW_COUNT,
  ParsedCsvRow,
} from "../csv/parser";
import { validateCsvRow, RowValidationError } from "../csv/validator";
import {
  findDuplicateLead,
  findOrCreateCompany,
  CreateLeadInput,
} from "./lead-service";
import {
  normalizeEmail,
  normalizeLinkedInUrl,
  computeCompositeHash,
} from "../deduplication/normalizer";
import { logger } from "../logger";

export const IMPORT_BATCH_SIZE = 50;

export interface DuplicateDetail {
  rowNumber: number;
  field: string;
  reason: string;
}

export interface CsvImportSummary {
  success: boolean;
  preview: boolean;
  totalProcessed: number;
  created: number;
  readyToImport?: number;
  duplicatesSkipped: number;
  invalidRows: number;
  batchCount: number;
  errors: RowValidationError[];
  duplicateDetails: DuplicateDetail[];
  sampleLeads: {
    rowNumber: number;
    fullName?: string;
    email?: string;
    companyName?: string;
    jobTitle?: string;
    stage?: LeadStage;
  }[];
  detectedHeaders: string[];
  canonicalHeaders: string[];
}

export interface ImportOptions {
  preview?: boolean;
}

/**
 * Validates, deduplicates, and processes a CSV string for a specific tenant.
 */
export async function processCsvImport(
  userId: string,
  csvContent: string,
  options?: ImportOptions
): Promise<CsvImportSummary> {
  const isPreview = Boolean(options?.preview);
  const startTime = Date.now();

  // 1. Production Safety Checks: File Size
  if (typeof csvContent !== "string") {
    return {
      success: false,
      preview: isPreview,
      totalProcessed: 0,
      created: 0,
      readyToImport: 0,
      duplicatesSkipped: 0,
      invalidRows: 0,
      batchCount: 0,
      errors: [{ rowNumber: 0, message: "CSV content must be a valid text string." }],
      duplicateDetails: [],
      sampleLeads: [],
      detectedHeaders: [],
      canonicalHeaders: [],
    };
  }

  const byteLength = Buffer.byteLength(csvContent, "utf8");
  if (byteLength > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      preview: isPreview,
      totalProcessed: 0,
      created: 0,
      readyToImport: 0,
      duplicatesSkipped: 0,
      invalidRows: 0,
      batchCount: 0,
      errors: [
        {
          rowNumber: 0,
          message: `CSV file size exceeds the 5 MB limit (received ${(
            byteLength /
            (1024 * 1024)
          ).toFixed(2)} MB).`,
        },
      ],
      duplicateDetails: [],
      sampleLeads: [],
      detectedHeaders: [],
      canonicalHeaders: [],
    };
  }

  // 2. Parse CSV using RFC 4180 state machine
  const parseResult = parseCsv(csvContent);

  if (!parseResult.success) {
    return {
      success: false,
      preview: isPreview,
      totalProcessed: 0,
      created: 0,
      readyToImport: 0,
      duplicatesSkipped: 0,
      invalidRows: parseResult.errors.length,
      batchCount: 0,
      errors: parseResult.errors,
      duplicateDetails: [],
      sampleLeads: [],
      detectedHeaders: parseResult.headers,
      canonicalHeaders: parseResult.canonicalHeaders,
    };
  }

  // Check for forbidden server-controlled headers (Mass-Assignment Security)
  if (parseResult.forbiddenHeaders.length > 0) {
    return {
      success: false,
      preview: isPreview,
      totalProcessed: parseResult.totalRows,
      created: 0,
      readyToImport: 0,
      duplicatesSkipped: 0,
      invalidRows: parseResult.totalRows,
      batchCount: 0,
      errors: [
        {
          rowNumber: 1,
          message: `Mass-assignment security violation: forbidden server-controlled column(s) detected: ${parseResult.forbiddenHeaders.join(
            ", "
          )}. Direct control of internal identifiers, tenant boundaries, or audit timestamps is prohibited.`,
        },
      ],
      duplicateDetails: [],
      sampleLeads: [],
      detectedHeaders: parseResult.headers,
      canonicalHeaders: parseResult.canonicalHeaders,
    };
  }

  // Check row limit
  if (parseResult.totalRows > MAX_ROW_COUNT) {
    return {
      success: false,
      preview: isPreview,
      totalProcessed: parseResult.totalRows,
      created: 0,
      readyToImport: 0,
      duplicatesSkipped: 0,
      invalidRows: 0,
      batchCount: 0,
      errors: [
        {
          rowNumber: 0,
          message: `CSV row count (${parseResult.totalRows}) exceeds the maximum allowed limit of ${MAX_ROW_COUNT} rows per import.`,
        },
      ],
      duplicateDetails: [],
      sampleLeads: [],
      detectedHeaders: parseResult.headers,
      canonicalHeaders: parseResult.canonicalHeaders,
    };
  }

  // 3. Row-by-Row Validation
  const validationErrors: RowValidationError[] = [...parseResult.errors];
  const validCandidates: { rowNumber: number; leadInput: CreateLeadInput }[] = [];

  for (const row of parseResult.rows) {
    const rowValidation = validateCsvRow(row);
    if (!rowValidation.valid || !rowValidation.leadInput) {
      validationErrors.push(...rowValidation.errors);
    } else {
      validCandidates.push({
        rowNumber: row.rowNumber,
        leadInput: rowValidation.leadInput,
      });
    }
  }

  // 4. Intra-CSV Deduplication
  // Track normalized identity keys seen earlier in this exact CSV file
  const seenEmails = new Map<string, number>();
  const seenLinkedInUrls = new Map<string, number>();
  const seenCompositeKeys = new Map<string, number>();

  const intraCsvUniqueCandidates: { rowNumber: number; leadInput: CreateLeadInput }[] = [];
  const duplicateDetails: DuplicateDetail[] = [];

  for (const candidate of validCandidates) {
    const input = candidate.leadInput;
    let isIntraDuplicate = false;

    // Check email
    const normEmail = normalizeEmail(input.email);
    if (normEmail) {
      if (seenEmails.has(normEmail)) {
        isIntraDuplicate = true;
        duplicateDetails.push({
          rowNumber: candidate.rowNumber,
          field: "email",
          reason: `Duplicate email '${input.email}' already present in this import (first seen at row ${seenEmails.get(
            normEmail
          )}).`,
        });
      } else {
        seenEmails.set(normEmail, candidate.rowNumber);
      }
    }

    // Check LinkedIn URL
    const normLinkedIn = normalizeLinkedInUrl(input.linkedInUrl);
    if (!isIntraDuplicate && normLinkedIn) {
      if (seenLinkedInUrls.has(normLinkedIn)) {
        isIntraDuplicate = true;
        duplicateDetails.push({
          rowNumber: candidate.rowNumber,
          field: "linkedInUrl",
          reason: `Duplicate LinkedIn profile '${input.linkedInUrl}' already present in this import (first seen at row ${seenLinkedInUrls.get(
            normLinkedIn
          )}).`,
        });
      } else {
        seenLinkedInUrls.set(normLinkedIn, candidate.rowNumber);
      }
    }

    // Check Composite (Name + Company / Domain)
    const compKey = computeCompositeHash(
      input.fullName,
      input.companyDomain || input.companyName
    );
    if (!isIntraDuplicate && compKey) {
      if (seenCompositeKeys.has(compKey)) {
        isIntraDuplicate = true;
        const companyLabel = input.companyDomain || input.companyName || "company";
        duplicateDetails.push({
          rowNumber: candidate.rowNumber,
          field: "name_company",
          reason: `Duplicate prospect '${input.fullName}' at '${companyLabel}' already present in this import (first seen at row ${seenCompositeKeys.get(
            compKey
          )}).`,
        });
      } else {
        seenCompositeKeys.set(compKey, candidate.rowNumber);
      }
    }

    if (!isIntraDuplicate) {
      intraCsvUniqueCandidates.push(candidate);
    }
  }

  // 5. Database-Level Deduplication (Scoped to Authenticated Tenant)
  const readyToImportCandidates: { rowNumber: number; leadInput: CreateLeadInput }[] = [];

  for (const candidate of intraCsvUniqueCandidates) {
    const dedupResult = await findDuplicateLead(prisma, userId, candidate.leadInput);
    if (dedupResult.isDuplicate) {
      duplicateDetails.push({
        rowNumber: candidate.rowNumber,
        field: dedupResult.matchedBy || "database_duplicate",
        reason: dedupResult.reason,
      });
    } else {
      readyToImportCandidates.push(candidate);
    }
  }

  // 6. Preview Mode: Return early without mutating database
  if (isPreview) {
    return {
      success: true,
      preview: true,
      totalProcessed: parseResult.totalRows,
      created: 0,
      readyToImport: readyToImportCandidates.length,
      duplicatesSkipped: duplicateDetails.length,
      invalidRows: parseResult.totalRows - validCandidates.length,
      batchCount: 0,
      errors: validationErrors,
      duplicateDetails,
      sampleLeads: readyToImportCandidates.slice(0, 5).map((c) => ({
        rowNumber: c.rowNumber,
        fullName: c.leadInput.fullName,
        email: c.leadInput.email,
        companyName: c.leadInput.companyName,
        jobTitle: c.leadInput.jobTitle,
        stage: c.leadInput.stage,
      })),
      detectedHeaders: parseResult.headers,
      canonicalHeaders: parseResult.canonicalHeaders,
    };
  }

  // 7. Commit Mode: Persist in bounded batches of 50
  // Ensure user record exists for foreign key constraints
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: `${userId}@outreachos.dev`,
      name: "Outreach User",
    },
  });

  let createdCount = 0;
  const executionErrors: RowValidationError[] = [...validationErrors];
  const batches: (typeof readyToImportCandidates)[] = [];

  for (let i = 0; i < readyToImportCandidates.length; i += IMPORT_BATCH_SIZE) {
    batches.push(readyToImportCandidates.slice(i, i + IMPORT_BATCH_SIZE));
  }

  for (let bIndex = 0; bIndex < batches.length; bIndex++) {
    const batch = batches[bIndex];

    try {
      await prisma.$transaction(
        async (tx) => {
          for (const item of batch) {
            const input = item.leadInput;

            // 1. Resolve or create Company safely
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

            // 2. Compute canonical deduplication hashes
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

            // 3. Create Lead
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
                source: input.source || "CSV Import",
                stage: input.stage || LeadStage.NEW,
                notes: input.notes || null,
                normalizedEmail: normEmail,
                normalizedLinkedInUrl: normLinkedIn,
                compositeHash: compKey,
                lastInteractionAt: new Date(),
              },
            });

            // 4. Resolve / assign temperature tag
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
              } catch (tagErr: unknown) {
                if (
                  tagErr instanceof Prisma.PrismaClientKnownRequestError &&
                  tagErr.code === "P2002"
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
                if (!tag) throw tagErr;
              }
            }

            await tx.leadTagAssignment.create({
              data: {
                leadId: newLead.id,
                tagId: tag.id,
              },
            });

            // 5. Create timeline interaction
            await tx.leadInteraction.create({
              data: {
                userId,
                leadId: newLead.id,
                type: "STAGE_CHANGE",
                title: "Lead Imported",
                description: `Lead imported via CSV in stage ${newLead.stage}. Source: ${newLead.source}`,
              },
            });

            createdCount++;
          }
        },
        {
          maxWait: 10000,
          timeout: 30000,
        }
      );
    } catch (batchError: unknown) {
      const msg =
        batchError instanceof Error
          ? batchError.message
          : "Database batch transaction failed.";

      logger.error("CSV import batch transaction failed", {
        userId,
        batchIndex: bIndex + 1,
        batchSize: batch.length,
        error: msg,
      });

      for (const item of batch) {
        executionErrors.push({
          rowNumber: item.rowNumber,
          message: `Batch ${bIndex + 1} processing error: ${msg}`,
        });
      }
    }
  }

  const durationMs = Date.now() - startTime;

  logger.info("CSV lead import completed", {
    userId,
    durationMs,
    totalProcessed: parseResult.totalRows,
    created: createdCount,
    duplicatesSkipped: duplicateDetails.length,
    invalidRows: parseResult.totalRows - validCandidates.length,
    batchCount: batches.length,
  });

  return {
    success: true,
    preview: false,
    totalProcessed: parseResult.totalRows,
    created: createdCount,
    readyToImport: readyToImportCandidates.length,
    duplicatesSkipped: duplicateDetails.length,
    invalidRows: parseResult.totalRows - validCandidates.length,
    batchCount: batches.length,
    errors: executionErrors,
    duplicateDetails,
    sampleLeads: [],
    detectedHeaders: parseResult.headers,
    canonicalHeaders: parseResult.canonicalHeaders,
  };
}
