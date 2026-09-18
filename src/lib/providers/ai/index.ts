import {
  AIProvider,
  PersonalizationInput,
  PersonalizationOutput,
  personalizationOutputSchema,
  PersonalizationRequest,
  PersonalizationResult,
  ResearchResult,
} from "./types";
import { buildPersonalizationSystemPrompt, buildPersonalizationUserPrompt } from "./prompt";
import { GeminiAIProvider } from "./gemini";
import { logger } from "@/lib/logger";

export * from "./types";
export * from "./prompt";
export { GeminiAIProvider } from "./gemini";

/**
 * Deterministic Development & Testing AI Provider.
 * Generates natural, evidence-based personalized outreach without requiring network calls or paid API keys.
 * Preserves full application testability in offline environments.
 */
export class DevelopmentAIProvider implements AIProvider {
  readonly name = "Development AI Provider (Mock)";

  isConfigured(): boolean {
    return true;
  }

  async generatePersonalization(input: PersonalizationInput): Promise<PersonalizationOutput> {
    const lead = input.lead;
    const firstName = lead.fullName.split(" ")[0] || "there";
    const company = lead.companyName || "your company";
    const opportunities = input.research?.opportunitySignals || [];

    const primaryOpportunity = opportunities[0];
    const evidenceUsed: string[] = [];

    let subjectLine = `Idea for ${company}'s website`;
    let hookText = `I was reviewing ${company}'s website recently`;
    let suggestionText = `noticed an opportunity to streamline your visitor experience and boost client inquiries.`;

    if (primaryOpportunity) {
      evidenceUsed.push(primaryOpportunity.issue);
      if (primaryOpportunity.category === "mobile_viewport") {
        subjectLine = `Quick question regarding ${company}'s mobile layout`;
        hookText = `I was checking out ${company}'s website on mobile`;
        suggestionText = `noticed ${primaryOpportunity.evidence.toLowerCase()} Ensuring a clean mobile viewport makes a big difference in keeping prospective clients engaged.`;
      } else if (primaryOpportunity.category === "seo_meta") {
        subjectLine = `Quick note on ${company}'s search snippet`;
        hookText = `I came across ${company} online`;
        suggestionText = `noticed your homepage search description isn't currently defined, which means search engines display automated text instead of your core pitch.`;
      } else if (primaryOpportunity.category === "online_booking") {
        subjectLine = `Streamlining consultation booking for ${company}`;
        hookText = `I was exploring ${company}'s service offerings`;
        suggestionText = `saw you offer great services, but noticed there's no direct self-service booking link for consultations. Adding an instant scheduling step usually cuts conversion drop-off significantly.`;
      } else if (primaryOpportunity.category === "transport_security") {
        subjectLine = `Quick security note for ${company}'s website`;
        suggestionText = `noticed the site currently serves over plain HTTP. Adding an automatic SSL redirect protects client trust and improves search indexing.`;
      } else {
        suggestionText = `noticed ${primaryOpportunity.evidence.toLowerCase()} Helping optimize these specific web touchpoints directly drives higher inquiry rates.`;
      }
    } else if (lead.industry) {
      suggestionText = `noticed your team is doing great work in ${lead.industry}. As a web developer, I build modern web platforms tailored to help businesses like yours convert more inbound visitors into booked clients.`;
      evidenceUsed.push(`Industry context: ${lead.industry}`);
    }

    if (lead.website) {
      evidenceUsed.push(`Public website review: ${lead.website}`);
    }

    const emailBody = `Hi ${firstName},

${hookText} and ${suggestionText}

As a web developer specializing in high-performing conversion platforms, I help businesses fix these gaps to turn more traffic into clients.

Would you be open to a brief 5-minute chat this week? Happy to share a couple of specific visual ideas with zero pressure.

Best regards,
Maulik Pandey`;

    const categoryText = primaryOpportunity?.category ? primaryOpportunity.category.replace("_", " ") : "web presence";
    const linkedInMessage = `Hi ${firstName}, noticed ${company}'s website recently and spotted a quick opportunity around your ${categoryText}. Would love to connect and share a quick suggestion if you're open to it!`;

    const whyProspect = primaryOpportunity
      ? `Strong fit: active business with identifiable web improvements (${primaryOpportunity.issue}) that directly impact conversion.`
      : `Good fit: established business with opportunities to modernize digital presence and client acquisition.`;

    const rawOutput: PersonalizationOutput = {
      subjectLine,
      emailBody,
      linkedInMessage: linkedInMessage.slice(0, 300),
      whyProspect,
      evidenceUsed: evidenceUsed.slice(0, 4),
      confidence: primaryOpportunity ? ((primaryOpportunity.confidence?.toLowerCase() as "high" | "medium" | "low") || "medium") : "medium",
    };

    return personalizationOutputSchema.parse(rawOutput);
  }

  async researchProspect(leadInfo: { fullName: string; companyName: string }): Promise<ResearchResult> {
    return {
      verifiedFacts: [
        {
          category: "company",
          fact: `${leadInfo.companyName} is an active business prospect.`,
          confidence: 0.9,
        },
      ],
      keyPainPoints: ["Website modernization", "Inbound lead conversion"],
      personalizedHooks: [`Modernizing ${leadInfo.companyName}'s digital presence`],
      summary: `Researched ${leadInfo.fullName} at ${leadInfo.companyName}.`,
    };
  }

  async generatePersonalizedMessage(request: PersonalizationRequest): Promise<PersonalizationResult> {
    return {
      subjectLine: `Quick question for ${request.leadName}`,
      content: `Hi ${request.leadName}, wanted to reach out regarding ${request.valueProposition}.`,
      rationale: "Deterministic development mock output.",
      referencedFacts: [],
    };
  }
}

/**
 * Production OpenAI-compatible AI Provider.
 * Enforces strict prompt injection defenses, bounded context windows,
 * and Zod validation of all structured outputs.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name = "OpenAI Compatible AI";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(
    apiKeyOrOptions: string | { apiKey: string; baseUrl?: string; model?: string },
    baseUrl?: string,
    model?: string
  ) {
    if (typeof apiKeyOrOptions === "object" && apiKeyOrOptions !== null) {
      this.apiKey = apiKeyOrOptions.apiKey;
      this.baseUrl = (apiKeyOrOptions.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
      this.model = apiKeyOrOptions.model || "gpt-4o-mini";
    } else {
      this.apiKey = apiKeyOrOptions;
      this.baseUrl = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
      this.model = model || "gpt-4o-mini";
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  buildSystemPrompt(focusContext?: string): string {
    return buildPersonalizationSystemPrompt(focusContext);
  }

  buildPrompt(input: PersonalizationInput): string {
    return buildPersonalizationUserPrompt(input);
  }

  async generatePersonalization(input: PersonalizationInput): Promise<PersonalizationOutput> {
    if (!this.isConfigured()) {
      throw new Error("OpenAI-compatible AI provider is not configured. Set OPENAI_API_KEY in environment.");
    }

    const systemPrompt = this.buildSystemPrompt(input.serviceProfile?.systemInstructionContext);
    const userPrompt = this.buildPrompt(input);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error("AI generation timed out after 12s")), 12000);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 800,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        logger.error("[OpenAICompatibleProvider] AI API returned error status", {
          status: response.status,
          error: errorText.slice(0, 200),
        });
        throw new Error(`AI Provider API responded with status ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("AI provider returned empty content.");
      }

      let parsedJson: any;
      try {
        let cleaned = content.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        }
        parsedJson = JSON.parse(cleaned);
      } catch {
        throw new Error("AI provider returned invalid JSON.");
      }

      // Enforce Zod validation on AI output (Constraint 13)
      const validatedOutput = personalizationOutputSchema.parse({
        subjectLine: parsedJson.subjectLine,
        emailBody: parsedJson.emailBody,
        linkedInMessage: parsedJson.linkedInMessage,
        whyProspect: parsedJson.whyProspect,
        evidenceUsed: Array.isArray(parsedJson.evidenceUsed) ? parsedJson.evidenceUsed : [],
        confidence: parsedJson.confidence || "medium",
      });

      return validatedOutput;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      logger.error("[OpenAICompatibleProvider] Failed to generate personalization via OpenAI API", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async researchProspect(leadInfo: { fullName: string; companyName: string }): Promise<ResearchResult> {
    const dev = new DevelopmentAIProvider();
    return dev.researchProspect(leadInfo);
  }

  async generatePersonalizedMessage(request: PersonalizationRequest): Promise<PersonalizationResult> {
    const dev = new DevelopmentAIProvider();
    return dev.generatePersonalizedMessage(request);
  }
}

export const developmentAiProvider = new DevelopmentAIProvider();

/**
 * Returns the active AI Provider based on deterministic environment configuration.
 *
 * Supported values for AI_PROVIDER:
 * - "gemini": Returns GeminiAIProvider. If GEMINI_API_KEY is missing, provider is not configured
 *             and will not make network calls.
 * - "openai": Returns OpenAICompatibleProvider.
 * - "mock" / missing / unknown: Returns DevelopmentAIProvider.
 *
 * Deterministic: Does NOT automatically activate Gemini or OpenAI merely because a key exists.
 */
export function getAIProvider(): AIProvider {
  const providerType = (process.env.AI_PROVIDER || "").trim().toLowerCase();

  if (providerType === "gemini") {
    return new GeminiAIProvider();
  }

  if (providerType === "openai") {
    return new OpenAICompatibleProvider(
      process.env.OPENAI_API_KEY || "",
      process.env.OPENAI_BASE_URL,
      process.env.OPENAI_MODEL
    );
  }

  // AI_PROVIDER=mock, missing, or unknown -> always return the deterministic development/mock provider
  return developmentAiProvider;
}
