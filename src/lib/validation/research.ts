import { z } from "zod";

export const researchWebsiteSchema = z.object({
  websiteUrl: z.string().url("Must be a valid URL").optional(),
  forceRefresh: z.boolean().optional().default(false),
});

export const generateResearchSchema = researchWebsiteSchema;

export const generatePersonalizationSchema = z.object({
  serviceProfile: z.string().optional().default("web_development"),
  forceRegenerate: z.boolean().optional().default(false),
});

export const updatePersonalizationSchema = z.object({
  id: z.string().optional(),
  subject: z.string().min(1, "Subject cannot be empty").max(200).optional(),
  emailBody: z.string().min(10, "Email body must be at least 10 characters").max(2500).optional(),
  linkedInMessage: z.string().min(5, "LinkedIn message must be at least 5 characters").max(600).optional(),
});
