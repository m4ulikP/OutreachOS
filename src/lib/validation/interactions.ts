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
