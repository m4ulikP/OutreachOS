import { z } from "zod";
import { DiscoveredPublicOpportunity } from "../providers/public-opportunities/types";
import {
  ClassificationResult,
  PublicOpportunityIntent,
  PublicOpportunityDemandStrength,
} from "../classification/public-opportunity-classifier";
import { logger } from "@/lib/logger";

export const publicOpportunityQualificationSchema = z.object({
  relevant: z.boolean(),
  intent: z.enum([
    "WEBSITE_BUILD",
    "WEBSITE_REDESIGN",
    "ECOMMERCE_BUILD",
    "LANDING_PAGE",
    "WEB_APPLICATION",
    "FRONTEND_DEVELOPMENT",
    "FULL_STACK_DEVELOPMENT",
    "WORDPRESS_CMS",
    "GENERAL_DEVELOPER_REQUEST",
    "INFORMATIONAL",
    "UNRELATED",
  ]),
  demandStrength: z.enum(["EXPLICIT", "STRONG", "POSSIBLE", "WEAK", "NONE"]),
  reason: z.string(),
  requestedServices: z.array(z.string()).default([]),
  budgetMentioned: z.string().nullable().optional(),
  urgency: z.enum(["high", "medium", "low", "unknown"]).default("unknown"),
  businessContext: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.8),
});

export type PublicOpportunityQualification = z.infer<typeof publicOpportunityQualificationSchema>;

export interface QualificationPipelineResult {
  opportunity: DiscoveredPublicOpportunity;
  classification: ClassificationResult;
  qualification?: PublicOpportunityQualification;
  aiQualified: boolean;
}

/**
 * Qualifies a public opportunity using Gemini AI if configured, grounded strictly in the source text.
 */
export async function qualifyPublicOpportunityWithAI(
  opportunity: DiscoveredPublicOpportunity,
  initialClassification: ClassificationResult
): Promise<PublicOpportunityQualification> {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  const baseUrl = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/$/, "");
  const model = (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();

  if (!apiKey) {
    logger.debug("Gemini API key not configured; skipping AI qualification phase");
    return {
      relevant: initialClassification.relevant,
      intent: initialClassification.intent,
      demandStrength: initialClassification.demandStrength,
      reason: initialClassification.reason,
      requestedServices: initialClassification.requestedServices,
      budgetMentioned: opportunity.budget ? `${opportunity.budget} ${opportunity.currency || "USD"}` : null,
      urgency: "unknown",
      businessContext: opportunity.companyName || opportunity.authorName || undefined,
      confidence: initialClassification.confidence,
    };
  }

  const systemPrompt = `You are a strict B2B Sales Opportunity Classifier for OutreachOS.
Your job is to analyze a public post and evaluate whether the author is actively seeking web development, website design, ecommerce, or frontend/fullstack development services.

RULES:
1. Ground your output STRICTLY in the provided text.
2. DO NOT invent or hallucinate contact information, names, emails, phone numbers, budgets, or company identities.
3. If budget is not explicitly stated in the post, set budgetMentioned to null.
4. If urgency is not stated, set urgency to "unknown".
5. Return ONLY a valid, raw JSON object matching the requested schema. Do NOT include markdown code blocks or explanations outside JSON.`;

  const userPrompt = `Analyze this public posting for web development demand:
Source: ${opportunity.sourceName || opportunity.source}
Title: ${opportunity.title}
Text: ${opportunity.description || "N/A"}
Tags: ${(opportunity.tags || []).join(", ") || "None"}
Explicit Budget Stated: ${opportunity.budget ? `${opportunity.budget} ${opportunity.currency || "USD"}` : "None"}

Respond with a JSON object with keys:
relevant (boolean),
intent ("WEBSITE_BUILD" | "WEBSITE_REDESIGN" | "ECOMMERCE_BUILD" | "LANDING_PAGE" | "WEB_APPLICATION" | "FRONTEND_DEVELOPMENT" | "FULL_STACK_DEVELOPMENT" | "WORDPRESS_CMS" | "GENERAL_DEVELOPER_REQUEST" | "INFORMATIONAL" | "UNRELATED"),
demandStrength ("EXPLICIT" | "STRONG" | "POSSIBLE" | "WEAK" | "NONE"),
reason (string),
requestedServices (array of strings),
budgetMentioned (string or null),
urgency ("high" | "medium" | "low" | "unknown"),
businessContext (string or null),
confidence (number between 0 and 1)`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      logger.warn("Gemini API error during public opportunity qualification", {
        status: res.status,
      });
      return {
        relevant: initialClassification.relevant,
        intent: initialClassification.intent,
        demandStrength: initialClassification.demandStrength,
        reason: initialClassification.reason,
        requestedServices: initialClassification.requestedServices,
        urgency: "unknown",
        confidence: initialClassification.confidence,
      };
    }

    const json = await res.json();
    const rawContent = json?.choices?.[0]?.message?.content || "";
    const cleanContent = rawContent.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

    const parsed = JSON.parse(cleanContent);
    const validated = publicOpportunityQualificationSchema.parse(parsed);
    return validated;
  } catch (err: unknown) {
    logger.warn("Public opportunity AI qualification fallback to deterministic classification", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      relevant: initialClassification.relevant,
      intent: initialClassification.intent,
      demandStrength: initialClassification.demandStrength,
      reason: initialClassification.reason,
      requestedServices: initialClassification.requestedServices,
      urgency: "unknown",
      confidence: initialClassification.confidence,
    };
  }
}
