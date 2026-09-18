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
import { logger } from "@/lib/logger";
import { DevelopmentAIProvider } from "./index";

export interface GeminiProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Production Gemini AI Provider using Google's official OpenAI-compatible endpoint:
 * https://generativelanguage.googleapis.com/v1beta/openai/
 *
 * Enforces strict prompt-injection defenses, untrusted website evidence isolation,
 * 15-second bounded timeouts, transient error retry, and Zod output schema validation.
 * Zero external SDK dependencies — uses native server-side fetch.
 */
export class GeminiAIProvider implements AIProvider {
  readonly name = "Gemini";
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private timeoutMs: number;

  constructor(options?: GeminiProviderOptions) {
    this.apiKey = (options?.apiKey ?? process.env.GEMINI_API_KEY ?? "").trim();
    const rawBaseUrl = options?.baseUrl ?? process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
    this.baseUrl = rawBaseUrl.replace(/\/$/, "");
    this.model = (options?.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash").trim();
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  getModel(): string {
    return this.model;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Helper to strip markdown code blocks if the LLM output is wrapped in ```json ... ```
   */
  private cleanJsonResponse(content: string): string {
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
      cleaned = cleaned.replace(/\s*```$/i, "");
    }
    return cleaned.trim();
  }

  /**
   * Dispatches a single chat completion request with an explicit timeout.
   */
  private async executeRequest(
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ status: number; ok: boolean; data?: any; errorText?: string }> {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      controller.abort(new Error(`Gemini request timed out after ${this.timeoutMs}ms`));
    }, this.timeoutMs);

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
          max_tokens: 1000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        return { status: response.status, ok: false, errorText };
      }

      const data = await response.json();
      return { status: response.status, ok: true, data };
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);
      throw err;
    }
  }

  async generatePersonalization(input: PersonalizationInput): Promise<PersonalizationOutput> {
    if (!this.isConfigured()) {
      throw new Error("Gemini AI provider is not configured. GEMINI_API_KEY is missing.");
    }

    const systemPrompt = buildPersonalizationSystemPrompt(input.serviceProfile?.systemInstructionContext);
    const userPrompt = buildPersonalizationUserPrompt(input);

    const startTime = Date.now();
    let result: { status: number; ok: boolean; data?: any; errorText?: string } | null = null;
    let lastError: unknown = null;

    // Retry loop: max 2 attempts (1 initial + 1 retry for transient 5xx or network errors)
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        result = await this.executeRequest(systemPrompt, userPrompt);
        if (result.ok) {
          break;
        }

        // Categorize non-OK HTTP status
        const status = result.status;
        if (status === 401 || status === 403) {
          logger.error("[GeminiAIProvider] Authentication failed", {
            status,
            model: this.model,
          });
          throw new Error("Gemini API authentication failed. Check your GEMINI_API_KEY.");
        }

        if (status === 404) {
          logger.error("[GeminiAIProvider] Model or endpoint not found", {
            status,
            model: this.model,
          });
          throw new Error(`Configured Gemini model '${this.model}' was not found. Check GEMINI_MODEL.`);
        }

        if (status === 429) {
          logger.error("[GeminiAIProvider] Rate limit or quota exhausted", {
            status,
            model: this.model,
          });
          throw new Error("Gemini API quota exceeded or rate limit reached. Please try again later.");
        }

        if (status >= 400 && status < 500) {
          logger.error("[GeminiAIProvider] Client request rejected", {
            status,
            model: this.model,
          });
          throw new Error(`Gemini API rejected request with status ${status}.`);
        }

        // For 5xx errors: retry once if on attempt 1
        if (attempt < maxAttempts && status >= 500) {
          logger.warn("[GeminiAIProvider] Transient 5xx error received; retrying request once", {
            status,
            attempt,
            model: this.model,
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        throw new Error(`Gemini API responded with status ${status}`);
      } catch (err: unknown) {
        lastError = err;

        // If it was an intentional non-retryable error, re-throw immediately
        if (err instanceof Error && (
          err.message.includes("authentication failed") ||
          err.message.includes("quota exceeded") ||
          err.message.includes("rejected request") ||
          err.message.includes("was not found")
        )) {
          throw err;
        }

        // Retry network / timeout errors once
        if (attempt < maxAttempts) {
          logger.warn("[GeminiAIProvider] Network/transient error during generation; retrying once", {
            attempt,
            error: err instanceof Error ? err.message : String(err),
            model: this.model,
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        logger.error("[GeminiAIProvider] Failed to generate personalization via Gemini", {
          durationMs: Date.now() - startTime,
          error: err instanceof Error ? err.message : String(err),
          model: this.model,
        });
        throw err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!result || !result.ok || !result.data) {
      throw lastError instanceof Error ? lastError : new Error("Gemini API returned an empty or invalid response.");
    }

    const durationMs = Date.now() - startTime;
    logger.info("[GeminiAIProvider] Personalization completed successfully", {
      model: this.model,
      durationMs,
    });

    const content = result.data.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      logger.error("[GeminiAIProvider] Gemini returned empty message content");
      throw new Error("Gemini API returned empty content.");
    }

    // Parse JSON (stripping code fences if present)
    let parsedJson: any;
    try {
      const cleaned = this.cleanJsonResponse(content);
      parsedJson = JSON.parse(cleaned);
    } catch (parseErr: unknown) {
      logger.error("[GeminiAIProvider] Failed to parse model output as JSON", {
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
      throw new Error("Gemini returned invalid or unparseable JSON.");
    }

    // Enforce Zod validation on AI output before returning or persisting
    try {
      const validatedOutput = personalizationOutputSchema.parse({
        subjectLine: parsedJson.subjectLine,
        emailBody: parsedJson.emailBody,
        linkedInMessage: parsedJson.linkedInMessage,
        whyProspect: parsedJson.whyProspect,
        evidenceUsed: Array.isArray(parsedJson.evidenceUsed) ? parsedJson.evidenceUsed : [],
        confidence: parsedJson.confidence || "medium",
      });

      return validatedOutput;
    } catch (validationErr: unknown) {
      logger.error("[GeminiAIProvider] Model output failed personalization schema validation", {
        error: validationErr instanceof Error ? validationErr.message : String(validationErr),
      });
      throw new Error("Gemini output failed schema validation.");
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
