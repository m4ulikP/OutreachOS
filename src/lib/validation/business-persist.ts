import { z } from "zod";

/**
 * Zod schema for a BusinessHeadquarters sub-object within a direct persist request.
 */
const businessHeadquartersSchema = z
  .object({
    streetAddress: z.string().max(500).optional(),
    formattedAddress: z.string().max(500).optional(),
    city: z.string().max(150).optional(),
    state: z.string().max(150).optional(),
    country: z.string().max(150).optional(),
    postalCode: z.string().max(20).optional(),
  })
  .strict("Unrecognized field in headquarters object");

/**
 * Zod schema for the emailsCount sub-object.
 */
const emailsCountSchema = z
  .object({
    personal: z.number().int().min(0),
    generic: z.number().int().min(0),
    total: z.number().int().min(0),
  })
  .strict("Unrecognized field in emailsCount object");

/**
 * Schema for a single DiscoveredBusiness submitted directly to the persist endpoint.
 *
 * Security contract:
 * - The authenticated user's ID (tenant scope) is taken ONLY from the session,
 *   never from the request body.
 * - Strict mode: any unrecognized field causes a 400 error.
 * - Mirrors DiscoveredBusiness type — no new fields are introduced.
 */
export const persistDiscoveredBusinessSchema = z
  .object({
    name: z
      .string({ required_error: "Business name is required" })
      .trim()
      .min(1, "Business name cannot be empty")
      .max(500, "Business name cannot exceed 500 characters"),
    externalId: z.string().trim().max(500).optional(),
    domain: z.string().trim().max(253).optional(),
    websiteUrl: z.string().trim().url("websiteUrl must be a valid URL").max(2048).optional(),
    industry: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    headquarters: businessHeadquartersSchema.optional(),
    employeeCount: z.number().int().min(0).max(9_999_999).optional(),
    headcountRange: z.string().trim().max(50).optional(),
    companyType: z.string().trim().max(100).optional(),
    yearFounded: z
      .number()
      .int()
      .min(1600)
      .max(new Date().getFullYear() + 1)
      .optional(),
    technologies: z.array(z.string().trim().max(100)).max(200).optional(),
    keywords: z.array(z.string().trim().max(100)).max(200).optional(),
    emailsCount: emailsCountSchema.optional(),
    phoneNumber: z.string().trim().max(50).optional(),
    rating: z.number().min(0).max(5).optional(),
    userRatingCount: z.number().int().min(0).optional(),
    primaryType: z.string().trim().max(200).optional(),
    source: z
      .string({ required_error: "source is required" })
      .trim()
      .min(1, "source cannot be empty")
      .max(100, "source cannot exceed 100 characters"),
    sourceUrl: z
      .string()
      .trim()
      .url("sourceUrl must be a valid URL")
      .max(2048)
      .optional(),
  })
  .strict("Unrecognized or forbidden field in persist request");

export type PersistDiscoveredBusinessInput = z.infer<
  typeof persistDiscoveredBusinessSchema
>;
