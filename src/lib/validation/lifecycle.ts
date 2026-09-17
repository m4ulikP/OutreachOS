import { z } from "zod";
import { LeadStage, FollowUpStatus } from "@prisma/client";

/**
 * Validates stage transition request payload.
 * Strictly checks that stage belongs to the existing LeadStage enum.
 * Rejects arbitrary or mass-assignment fields.
 */
export const stageTransitionSchema = z
  .object({
    stage: z.nativeEnum(LeadStage, {
      required_error: "Target stage is required",
      invalid_type_error: "Invalid lead stage",
    }),
    notes: z
      .string()
      .trim()
      .max(2000, "Notes cannot exceed 2,000 characters")
      .optional(),
    reason: z
      .string()
      .trim()
      .max(500, "Reason cannot exceed 500 characters")
      .optional(),
  })
  .strict();

export type StageTransitionInput = z.infer<typeof stageTransitionSchema>;

/**
 * Validates follow-up creation payload.
 * Requires valid ISO datetime for scheduledFor.
 */
export const createFollowUpSchema = z
  .object({
    scheduledFor: z
      .string({ required_error: "scheduledFor is required" })
      .refine(
        (val) => !isNaN(Date.parse(val)),
        { message: "scheduledFor must be a valid date/time string" }
      )
      .refine(
        (val) => Date.parse(val) >= Date.now() - 5 * 60 * 1000,
        { message: "scheduledFor must be in the present or future" }
      ),
    delayDays: z
      .number({ invalid_type_error: "delayDays must be a number" })
      .int("delayDays must be an integer")
      .min(0, "delayDays cannot be negative")
      .max(365, "delayDays cannot exceed 365")
      .optional()
      .default(0),
    notes: z
      .string()
      .trim()
      .max(2000, "Notes cannot exceed 2,000 characters")
      .optional(),
  })
  .strict();

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;

/**
 * Validates partial follow-up update payload.
 */
export const updateFollowUpSchema = z
  .object({
    scheduledFor: z
      .string()
      .refine(
        (val) => !isNaN(Date.parse(val)),
        { message: "scheduledFor must be a valid date/time string" }
      )
      .refine(
        (val) => Date.parse(val) >= Date.now() - 5 * 60 * 1000,
        { message: "scheduledFor must be in the present or future" }
      )
      .optional(),
    delayDays: z
      .number()
      .int()
      .min(0)
      .max(365)
      .optional(),
    notes: z
      .string()
      .trim()
      .max(2000)
      .optional(),
  })
  .strict();

export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;

/**
 * Validates follow-up completion payload.
 */
export const completeFollowUpSchema = z
  .object({
    notes: z
      .string()
      .trim()
      .max(2000, "Completion notes cannot exceed 2,000 characters")
      .optional(),
  })
  .strict();

export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>;

/**
 * Validates follow-up cancellation payload.
 */
export const cancelFollowUpSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(500, "Cancellation reason cannot exceed 500 characters")
      .optional(),
  })
  .strict();

export type CancelFollowUpInput = z.infer<typeof cancelFollowUpSchema>;
