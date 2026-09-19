import { z } from "zod";

export const businessDiscoverySearchSchema = z
  .object({
    query: z.string().trim().max(500, "Query cannot exceed 500 characters").optional(),
    location: z.string().trim().max(150, "Location cannot exceed 150 characters").optional(),
    industry: z.string().trim().max(100, "Industry cannot exceed 100 characters").optional(),
    keywords: z
      .array(z.string().trim().max(50, "Keyword cannot exceed 50 characters"))
      .max(20, "Cannot specify more than 20 keywords")
      .optional(),
    headcount: z
      .union([
        z.object({
          min: z.number().int("Headcount min must be an integer").min(1, "Headcount min must be >= 1").optional(),
          max: z.number().int("Headcount max must be an integer").min(1, "Headcount max must be >= 1").optional(),
        }),
        z.string().trim().max(50, "Headcount string cannot exceed 50 characters"),
      ])
      .optional(),
    companyType: z.string().trim().max(50, "Company type cannot exceed 50 characters").optional(),
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
    persist: z.boolean().default(false),
  })
  .strict("Unrecognized or forbidden field submitted in business discovery search");

export type BusinessDiscoverySearchInputValidated = z.infer<typeof businessDiscoverySearchSchema>;
