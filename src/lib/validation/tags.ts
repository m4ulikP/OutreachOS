import { z } from "zod";
import { TagType } from "@prisma/client";

export const createTagSchema = z
  .object({
    name: z
      .string({ required_error: "Tag name is required" })
      .trim()
      .min(1, "Tag name cannot be empty")
      .max(50, "Tag name cannot exceed 50 characters"),
    type: z
      .nativeEnum(TagType, {
        errorMap: () => ({ message: "Invalid tag type" }),
      })
      .default(TagType.CUSTOM),
    color: z
      .string()
      .trim()
      .max(30, "Color cannot exceed 30 characters")
      .optional(),
  })
  .strict("Unrecognized or forbidden field submitted for tag");

export type CreateTagInputValidated = z.infer<typeof createTagSchema>;

export const assignTagSchema = z
  .object({
    tagId: z
      .string({ required_error: "Tag ID is required" })
      .cuid("Tag ID must be a valid CUID"),
  })
  .strict("Unrecognized or forbidden field submitted for tag assignment");

export type AssignTagInputValidated = z.infer<typeof assignTagSchema>;
