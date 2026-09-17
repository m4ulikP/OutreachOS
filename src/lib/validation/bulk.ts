import { z } from "zod";
import { LeadStage } from "@prisma/client";

export const BulkActionEnum = z.enum([
  "UPDATE_STAGE",
  "ASSIGN_TAG",
  "REMOVE_TAG",
  "DELETE",
]);

export const bulkLeadsOperationSchema = z
  .object({
    action: BulkActionEnum,
    leadIds: z
      .array(z.string().cuid("Each lead ID must be a valid CUID"))
      .min(1, "At least one lead ID is required")
      .max(100, "Bulk operations are limited to a maximum of 100 leads per request"),
    stage: z
      .nativeEnum(LeadStage, {
        errorMap: () => ({ message: "Invalid lead stage for bulk update" }),
      })
      .optional(),
    tagId: z
      .string()
      .cuid("Tag ID must be a valid CUID")
      .optional(),
  })
  .strict("Unrecognized or forbidden field submitted for bulk operation")
  .superRefine((data, ctx) => {
    if (data.action === "UPDATE_STAGE" && !data.stage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stage"],
        message: "Stage is required when action is UPDATE_STAGE",
      });
    }

    if (
      (data.action === "ASSIGN_TAG" || data.action === "REMOVE_TAG") &&
      !data.tagId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tagId"],
        message: `Tag ID is required when action is ${data.action}`,
      });
    }
  });

export type BulkLeadsOperationValidated = z.infer<typeof bulkLeadsOperationSchema>;
