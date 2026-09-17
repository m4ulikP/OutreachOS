import { z } from "zod";

export const finderSearchSchema = z
  .object({
    jobTitle: z.string().trim().max(100, "Job title cannot exceed 100 characters").optional(),
    companySize: z.string().trim().max(50, "Company size cannot exceed 50 characters").optional(),
    industry: z.string().trim().max(100, "Industry cannot exceed 100 characters").optional(),
    location: z.string().trim().max(150, "Location cannot exceed 150 characters").optional(),
    keywords: z.string().trim().max(200, "Keywords query cannot exceed 200 characters").optional(),
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
