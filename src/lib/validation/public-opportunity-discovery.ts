import { z } from "zod";

export const publicOpportunityDiscoverySchema = z
  .object({
    provider: z
      .enum(["auto", "hacker_news", "remote_ok", "mock", "hn", "remoteok"])
      .default("auto"),
    query: z
      .string()
      .trim()
      .max(200, "Search query cannot exceed 200 characters")
      .optional(),
    intent: z.string().trim().max(100).optional(),
    location: z.string().trim().max(100).optional(),
    days: z
      .number()
      .int()
      .min(1, "Recency window must be at least 1 day")
      .max(30, "Recency window cannot exceed 30 days")
      .default(14),
    limit: z
      .number()
      .int()
      .min(1, "Limit must be at least 1")
      .max(50, "Limit cannot exceed 50 items per search")
      .default(20),
    qualify: z.boolean().default(false),
    persist: z.boolean().default(false),
  })
  .strict();

export type PublicOpportunityDiscoveryInput = z.infer<typeof publicOpportunityDiscoverySchema>;
