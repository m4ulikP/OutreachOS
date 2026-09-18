import { z } from "zod";

export const finderSearchSchema = z
  .object({
    jobTitle: z.string().trim().max(100, "Job title cannot exceed 100 characters").optional(),
    companyName: z.string().trim().max(100, "Company name cannot exceed 100 characters").optional(),
    companyDomain: z.string().trim().max(100, "Company domain cannot exceed 100 characters").optional(),
    companySize: z.string().trim().max(50, "Company size cannot exceed 50 characters").optional(),
    industry: z.string().trim().max(100, "Industry cannot exceed 100 characters").optional(),
    location: z.string().trim().max(150, "Location cannot exceed 150 characters").optional(),
    keywords: z.string().trim().max(200, "Keywords query cannot exceed 200 characters").optional(),
    hasEmail: z.boolean().optional(),
    hasLinkedIn: z.boolean().optional(),
    providerId: z.string().trim().max(50, "Provider ID cannot exceed 50 characters").optional(),
    limit: z.coerce
      .number({ invalid_type_error: "Limit must be a valid number" })
      .int("Limit must be an integer")
      .min(1, "Limit must be at least 1")
      .max(100, "Limit cannot exceed 100")
      .default(20),
    offset: z.coerce
      .number({ invalid_type_error: "Offset must be a valid number" })
      .int("Offset must be an integer")
      .min(0, "Offset cannot be negative")
      .default(0),
  })
  .strict("Unrecognized or forbidden field submitted in finder search");

export type FinderSearchInputValidated = z.infer<typeof finderSearchSchema>;

export const discoveredProspectSchema = z
  .object({
    id: z.string().trim().min(1, "Prospect ID is required").max(100),
    fullName: z.string().trim().min(1, "Full name is required").max(100),
    firstName: z.string().trim().max(50).optional(),
    lastName: z.string().trim().max(50).optional(),
    jobTitle: z.string().trim().max(100).optional().default("Professional"),
    companyName: z.string().trim().min(1, "Company name is required").max(100),
    companyDomain: z.string().trim().max(100).optional(),
    companySize: z.string().trim().max(50).optional(),
    industry: z.string().trim().max(100).optional(),
    location: z.string().trim().max(150).optional(),
    email: z
      .string()
      .trim()
      .email("Invalid email format")
      .optional()
      .or(z.literal("")),
    phone: z.string().trim().max(50).optional(),
    linkedInUrl: z
      .string()
      .trim()
      .url("Invalid LinkedIn URL")
      .optional()
      .or(z.literal("")),
    website: z.string().trim().optional().or(z.literal("")),
    sourceProvider: z.string().trim().max(100).optional(),
  })
  .strict("Forbidden field submitted in prospect import payload");

export const finderImportSchema = z
  .object({
    prospects: z
      .array(discoveredProspectSchema)
      .min(1, "At least one prospect must be selected for import")
      .max(100, "Cannot import more than 100 prospects in a single batch"),
  })
  .strict("Forbidden field submitted in finder import payload");

export type DiscoveredProspectValidated = z.infer<typeof discoveredProspectSchema>;
export type FinderImportInputValidated = z.infer<typeof finderImportSchema>;
