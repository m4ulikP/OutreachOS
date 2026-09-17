import { z } from "zod";
import { LeadStage, TagType } from "@prisma/client";

/**
 * Validates optional email input:
 * - Rejects malformed email addresses
 * - Allows empty string or null/undefined (transforming empty string to undefined)
 * - Restricts length to standard 255 characters
 */
const optionalEmailSchema = z
  .string()
  .trim()
  .max(255, "Email address cannot exceed 255 characters")
  .refine(
    (val) => val === "" || z.string().email().safeParse(val).success,
    { message: "Invalid email address format" }
  )
  .transform((val) => (val === "" ? undefined : val))
  .optional();

/**
 * Validates optional LinkedIn URL input:
 * - Rejects malformed or non-LinkedIn URLs
 * - Allows empty string or null/undefined (transforming empty string to undefined)
 * - Restricts length to 500 characters
 */
const optionalLinkedInUrlSchema = z
  .string()
  .trim()
  .max(500, "LinkedIn profile URL cannot exceed 500 characters")
  .refine(
    (val) => {
      if (!val || val === "") return true;
      try {
        const withProto =
          val.startsWith("http://") || val.startsWith("https://")
            ? val
            : `https://${val}`;
        const parsed = new URL(withProto);
        return parsed.hostname.toLowerCase().includes("linkedin.com");
      } catch {
        return false;
      }
    },
    { message: "Must be a valid LinkedIn profile URL" }
  )
  .transform((val) => (val === "" ? undefined : val))
  .optional();

/**
 * Strict schema for POST /api/leads payload.
 * Rejects unexpected keys (mass-assignment protection) and enforces bounds.
 */
export const createLeadSchema = z
  .object({
    firstName: z.string().trim().max(100, "First name cannot exceed 100 characters").optional(),
    lastName: z.string().trim().max(100, "Last name cannot exceed 100 characters").optional(),
    fullName: z.string().trim().max(200, "Full name cannot exceed 200 characters").optional(),
    jobTitle: z.string().trim().max(150, "Job title cannot exceed 150 characters").optional(),
    email: optionalEmailSchema,
    phone: z.string().trim().max(50, "Phone number cannot exceed 50 characters").optional(),
    website: z.string().trim().max(255, "Website cannot exceed 255 characters").optional(),
    linkedInUrl: optionalLinkedInUrlSchema,
    companyName: z.string().trim().max(150, "Company name cannot exceed 150 characters").optional(),
    companyDomain: z.string().trim().max(150, "Company domain cannot exceed 150 characters").optional(),
    companySize: z.string().trim().max(50, "Company size cannot exceed 50 characters").optional(),
    industry: z.string().trim().max(100, "Industry cannot exceed 100 characters").optional(),
    location: z.string().trim().max(150, "Location cannot exceed 150 characters").optional(),
    source: z.string().trim().max(100, "Source cannot exceed 100 characters").optional(),
    stage: z
      .nativeEnum(LeadStage, {
        errorMap: () => ({ message: "Invalid lead stage" }),
      })
      .optional(),
    tagType: z
      .nativeEnum(TagType, {
        errorMap: () => ({ message: "Invalid tag temperature type" }),
      })
      .optional(),
    notes: z.string().trim().max(5000, "Notes cannot exceed 5000 characters").optional(),
  })
  .strict("Unrecognized or forbidden field submitted")
  .refine(
    (data) =>
      Boolean(
        data.fullName?.trim() ||
          data.firstName?.trim() ||
          data.lastName?.trim() ||
          data.email?.trim() ||
          data.linkedInUrl?.trim()
      ),
    {
      message:
        "At least one identifying detail (Name, Email, or LinkedIn URL) is required to create a prospect.",
      path: ["fullName"],
    }
  );

export type CreateLeadInputValidated = z.infer<typeof createLeadSchema>;

/**
 * Strict schema for PATCH /api/leads/[id] payload.
 * Rejects unexpected keys and requires at least one field for partial updates.
 */
export const updateLeadSchema = z
  .object({
    firstName: z.string().trim().max(100, "First name cannot exceed 100 characters").optional(),
    lastName: z.string().trim().max(100, "Last name cannot exceed 100 characters").optional(),
    fullName: z.string().trim().max(200, "Full name cannot exceed 200 characters").optional(),
    jobTitle: z.string().trim().max(150, "Job title cannot exceed 150 characters").optional(),
    email: optionalEmailSchema,
    phone: z.string().trim().max(50, "Phone number cannot exceed 50 characters").optional(),
    website: z.string().trim().max(255, "Website cannot exceed 255 characters").optional(),
    linkedInUrl: optionalLinkedInUrlSchema,
    companyName: z.string().trim().max(150, "Company name cannot exceed 150 characters").optional(),
    companyDomain: z.string().trim().max(150, "Company domain cannot exceed 150 characters").optional(),
    companySize: z.string().trim().max(50, "Company size cannot exceed 50 characters").optional(),
    industry: z.string().trim().max(100, "Industry cannot exceed 100 characters").optional(),
    location: z.string().trim().max(150, "Location cannot exceed 150 characters").optional(),
    stage: z
      .nativeEnum(LeadStage, {
        errorMap: () => ({ message: "Invalid lead stage" }),
      })
      .optional(),
    notes: z.string().trim().max(5000, "Notes cannot exceed 5000 characters").optional(),
  })
  .strict("Unrecognized or forbidden field submitted for update")
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided for update",
    }
  );

export type UpdateLeadInputValidated = z.infer<typeof updateLeadSchema>;

/**
 * Schema for query parameters in GET /api/leads.
 * Rejects invalid enums, non-numeric values, or bounds violations.
 */
export const listLeadsQuerySchema = z.object({
  search: z.string().trim().max(200, "Search query cannot exceed 200 characters").optional(),
  stage: z
    .nativeEnum(LeadStage, {
      errorMap: () => ({ message: "Invalid stage filter" }),
    })
    .optional(),
  temperature: z
    .nativeEnum(TagType, {
      errorMap: () => ({ message: "Invalid temperature filter" }),
    })
    .optional(),
  industry: z.string().trim().max(100, "Industry filter cannot exceed 100 characters").optional(),
  location: z.string().trim().max(150, "Location filter cannot exceed 150 characters").optional(),
  companyName: z.string().trim().max(150, "Company filter cannot exceed 150 characters").optional(),
  sortBy: z
    .enum(["name", "createdAt", "lastInteractionAt", "stage"], {
      errorMap: () => ({ message: "Invalid sortBy parameter" }),
    })
    .default("createdAt"),
  sortOrder: z
    .enum(["asc", "desc"], {
      errorMap: () => ({ message: "Invalid sortOrder parameter" }),
    })
    .default("desc"),
  page: z.coerce
    .number({ invalid_type_error: "Page must be a valid number" })
    .int("Page must be an integer")
    .min(1, "Page must be at least 1")
    .default(1),
  pageSize: z.coerce
    .number({ invalid_type_error: "Page size must be a valid number" })
    .int("Page size must be an integer")
    .min(1, "Page size must be at least 1")
    .max(100, "Page size cannot exceed 100")
    .default(20),
});
