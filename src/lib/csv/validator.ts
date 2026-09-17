import { z } from "zod";
import { LeadStage, TagType } from "@prisma/client";
import { ParsedCsvRow } from "./parser";
import { CreateLeadInput } from "../services/lead-service";

export interface RowValidationError {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface ValidatedRowResult {
  valid: boolean;
  rowNumber: number;
  leadInput?: CreateLeadInput;
  errors: RowValidationError[];
}

/**
 * Normalizes user-entered stage string to the LeadStage Prisma enum.
 * Supports case-insensitivity and human-readable aliases.
 */
export function normalizeStageValue(raw?: string | null): {
  stage: LeadStage;
  isValid: boolean;
  error?: string;
} {
  if (!raw || raw.trim() === "") {
    return { stage: LeadStage.NEW, isValid: true };
  }

  const cleaned = raw.trim().toUpperCase().replace(/[\s_-]+/g, "_");

  // Direct enum match
  if (Object.values(LeadStage).includes(cleaned as LeadStage)) {
    return { stage: cleaned as LeadStage, isValid: true };
  }

  // Common UI aliases
  const aliasMap: Record<string, LeadStage> = {
    DISCOVERY_CALL: LeadStage.MEETING_SCHEDULED,
    MEETING: LeadStage.MEETING_SCHEDULED,
    CALL_SCHEDULED: LeadStage.MEETING_SCHEDULED,
    WARM_POSITIVE: LeadStage.POSITIVE_REPLY,
    POSITIVE: LeadStage.POSITIVE_REPLY,
    CLIENT_WON: LeadStage.CLIENT,
    LOST: LeadStage.CLOSED_LOST,
    CLOSED: LeadStage.CLOSED_LOST,
  };

  if (aliasMap[cleaned]) {
    return { stage: aliasMap[cleaned], isValid: true };
  }

  return {
    stage: LeadStage.NEW,
    isValid: false,
    error: `Invalid lead stage '${raw}'. Supported values: ${Object.values(LeadStage).join(", ")}.`,
  };
}

/**
 * Normalizes temperature / tag string to TagType enum.
 */
export function normalizeTagValue(raw?: string | null): TagType {
  if (!raw || raw.trim() === "") {
    return TagType.WARM;
  }

  const cleaned = raw.trim().toUpperCase().replace(/[\s_-]+/g, "_");
  if (Object.values(TagType).includes(cleaned as TagType)) {
    return cleaned as TagType;
  }

  return TagType.WARM;
}

/**
 * Validates a single parsed CSV row strictly against OutreachOS business rules.
 */
export function validateCsvRow(row: ParsedCsvRow): ValidatedRowResult {
  const errors: RowValidationError[] = [];
  const mapped = row.mappedValues;

  // 1. Minimum Identity Requirement
  const computedFullName =
    mapped.fullName?.trim() ||
    [mapped.firstName?.trim(), mapped.lastName?.trim()].filter(Boolean).join(" ") ||
    "";

  const email = mapped.email?.trim() || "";
  const linkedInUrl = mapped.linkedInUrl?.trim() || "";

  if (!computedFullName && !email && !linkedInUrl) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "fullName",
      message: "At least one identifying detail (Name, Email, or LinkedIn URL) is required.",
    });
  }

  // 2. Email Validation
  let validatedEmail: string | undefined = undefined;
  if (email) {
    if (email.length > 255) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "email",
        message: "Email address cannot exceed 255 characters.",
      });
    } else {
      const emailParsed = z.string().email().safeParse(email);
      if (!emailParsed.success) {
        errors.push({
          rowNumber: row.rowNumber,
          field: "email",
          message: `Invalid email address format: '${email}'.`,
        });
      } else {
        validatedEmail = email;
      }
    }
  }

  // 3. LinkedIn URL Validation
  let validatedLinkedInUrl: string | undefined = undefined;
  if (linkedInUrl) {
    if (linkedInUrl.length > 500) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "linkedInUrl",
        message: "LinkedIn profile URL cannot exceed 500 characters.",
      });
    } else {
      const withProto =
        linkedInUrl.startsWith("http://") || linkedInUrl.startsWith("https://")
          ? linkedInUrl
          : `https://${linkedInUrl}`;

      try {
        const parsed = new URL(withProto);
        if (!parsed.hostname.toLowerCase().includes("linkedin.com")) {
          errors.push({
            rowNumber: row.rowNumber,
            field: "linkedInUrl",
            message: "Must be a valid LinkedIn profile URL (must contain linkedin.com).",
          });
        } else {
          validatedLinkedInUrl = linkedInUrl;
        }
      } catch {
        errors.push({
          rowNumber: row.rowNumber,
          field: "linkedInUrl",
          message: `Invalid LinkedIn URL format: '${linkedInUrl}'.`,
        });
      }
    }
  }

  // 4. Website Validation
  const website = mapped.website?.trim();
  if (website && website.length > 255) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "website",
      message: "Website URL cannot exceed 255 characters.",
    });
  }

  // 5. Stage Validation
  const stageResult = normalizeStageValue(mapped.stage);
  if (!stageResult.isValid && stageResult.error) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "stage",
      message: stageResult.error,
    });
  }

  // 6. Notes Validation
  const notes = mapped.notes?.trim();
  if (notes && notes.length > 5000) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "notes",
      message: `Notes exceed maximum length of 5,000 characters (received ${notes.length} characters).`,
    });
  }

  // 7. Field Length Bounds
  const firstName = mapped.firstName?.trim();
  if (firstName && firstName.length > 100) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "firstName",
      message: "First name cannot exceed 100 characters.",
    });
  }

  const lastName = mapped.lastName?.trim();
  if (lastName && lastName.length > 100) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "lastName",
      message: "Last name cannot exceed 100 characters.",
    });
  }

  if (computedFullName && computedFullName.length > 200) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "fullName",
      message: "Full name cannot exceed 200 characters.",
    });
  }

  const jobTitle = mapped.jobTitle?.trim();
  if (jobTitle && jobTitle.length > 150) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "jobTitle",
      message: "Job title cannot exceed 150 characters.",
    });
  }

  const companyName = mapped.companyName?.trim();
  if (companyName && companyName.length > 150) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "companyName",
      message: "Company name cannot exceed 150 characters.",
    });
  }

  const companyDomain = mapped.companyDomain?.trim();
  if (companyDomain && companyDomain.length > 150) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "companyDomain",
      message: "Company domain cannot exceed 150 characters.",
    });
  }

  const companySize = mapped.companySize?.trim();
  if (companySize && companySize.length > 50) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "companySize",
      message: "Company size cannot exceed 50 characters.",
    });
  }

  const industry = mapped.industry?.trim();
  if (industry && industry.length > 100) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "industry",
      message: "Industry cannot exceed 100 characters.",
    });
  }

  const location = mapped.location?.trim();
  if (location && location.length > 150) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "location",
      message: "Location cannot exceed 150 characters.",
    });
  }

  const phone = mapped.phone?.trim();
  if (phone && phone.length > 50) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "phone",
      message: "Phone number cannot exceed 50 characters.",
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      rowNumber: row.rowNumber,
      errors,
    };
  }

  // Construct safe, strictly-typed lead input (MASS-ASSIGNMENT PROOF)
  const leadInput: CreateLeadInput = {
    fullName: computedFullName || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    email: validatedEmail,
    jobTitle: jobTitle || undefined,
    companyName: companyName || undefined,
    companyDomain: companyDomain || undefined,
    website: website || undefined,
    linkedInUrl: validatedLinkedInUrl,
    phone: phone || undefined,
    industry: industry || undefined,
    location: location || undefined,
    companySize: companySize || undefined,
    notes: notes || undefined,
    stage: stageResult.stage,
    tagType: normalizeTagValue(mapped.tagType),
    source: "CSV Import",
  };

  return {
    valid: true,
    rowNumber: row.rowNumber,
    leadInput,
    errors: [],
  };
}
