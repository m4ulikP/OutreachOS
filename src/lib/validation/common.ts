import { z } from "zod";

/**
 * Validates dynamic route parameter IDs (e.g. /api/leads/[id]).
 * Ensures non-empty, reasonably bounded string without arbitrary or malformed input.
 */
export const cuidParamSchema = z
  .string({ required_error: "ID parameter is required" })
  .trim()
  .min(1, "ID cannot be empty")
  .max(128, "ID is unreasonably long");

/**
 * Standard pagination query schema enforcing safe integer boundaries.
 */
export const paginationQuerySchema = z.object({
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
