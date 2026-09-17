import { z } from "zod";

export const InteractionTypeEnum = z.enum(
  ["NOTE", "CALL", "MEETING", "EMAIL_SENT", "REPLY_RECEIVED"],
  {
    errorMap: () => ({ message: "Invalid interaction type. Must be NOTE, CALL, MEETING, EMAIL_SENT, or REPLY_RECEIVED." }),
  }
);

export const createInteractionSchema = z
  .object({
    type: InteractionTypeEnum.default("NOTE"),
    title: z
      .string({ required_error: "Title is required" })
      .trim()
      .min(1, "Title cannot be empty")
      .max(200, "Title cannot exceed 200 characters"),
    description: z
      .string()
      .trim()
      .max(5000, "Description cannot exceed 5000 characters")
      .optional(),
  })
  .strict("Unrecognized or forbidden field submitted for interaction");

export type CreateInteractionInputValidated = z.infer<typeof createInteractionSchema>;

export const listInteractionsQuerySchema = z.object({
  type: z
    .enum(["NOTE", "CALL", "MEETING", "EMAIL_SENT", "REPLY_RECEIVED", "STAGE_CHANGE", "AI_RESEARCH"], {
      errorMap: () => ({ message: "Invalid interaction type filter" }),
    })
    .optional(),
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

export type ListInteractionsQueryValidated = z.infer<typeof listInteractionsQuerySchema>;
