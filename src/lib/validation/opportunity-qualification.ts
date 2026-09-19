import { z } from "zod";

export const qualifyCompanySchema = z
  .object({
    companyId: z
      .string({ required_error: "companyId is required" })
      .trim()
      .min(1, "companyId is required"),
    forceRefresh: z.boolean().default(false),
  })
  .strict("Unrecognized or forbidden field submitted in opportunity qualification request");

export type QualifyCompanyInputValidated = z.infer<typeof qualifyCompanySchema>;
