import {
  AIProvider,
  PersonalizationRequest,
  PersonalizationResult,
  ResearchResult,
} from "./types";

export class UnconfiguredAIProvider implements AIProvider {
  readonly name = "OpenAI Compatible (Unconfigured)";

  isConfigured(): boolean {
    return false;
  }

  async researchProspect(): Promise<ResearchResult> {
    throw new Error(
      "AI provider is not configured. Please supply an OpenAI-compatible API key in Settings or environment variables."
    );
  }

  async generatePersonalizedMessage(): Promise<PersonalizationResult> {
    throw new Error(
      "AI provider is not configured. Please supply an OpenAI-compatible API key in Settings or environment variables."
    );
  }
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly name = "OpenAI Compatible AI";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, baseUrl?: string, model?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || "https://api.openai.com/v1";
    this.model = model || "gpt-4o-mini";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async researchProspect(leadInfo: {
    fullName: string;
    companyName: string;
    website?: string;
    linkedInUrl?: string;
  }): Promise<ResearchResult> {
    if (!this.isConfigured()) {
      throw new Error("Cannot execute AI research without configured API credentials.");
    }

    const prompt = `You are a B2B sales research intelligence assistant. Research the prospect '${leadInfo.fullName}' at company '${leadInfo.companyName}'. Extract strictly verified, factual information only. Do NOT make up facts.`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Provider API responded with status ${response.status}`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    return {
      verifiedFacts: parsed.verifiedFacts || [],
      keyPainPoints: parsed.keyPainPoints || [],
      personalizedHooks: parsed.personalizedHooks || [],
      summary: parsed.summary || "",
    };
  }

  async generatePersonalizedMessage(request: PersonalizationRequest): Promise<PersonalizationResult> {
    if (!this.isConfigured()) {
      throw new Error("Cannot generate personalized outreach without configured API credentials.");
    }

    const systemPrompt = `You are an elite B2B copywriter generating personalized outreach for freelancers.
Rules:
- Never make unverified claims.
- Keep emails under 125 words.
- Specific value proposition: ${request.valueProposition}`;

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
          {
            role: "user",
            content: `Write a high-converting ${request.channel} outreach message to ${request.leadName} (${request.leadJobTitle || "Executive"} at ${request.companyName || "their company"}).`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Provider API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    return {
      content,
      rationale: "Crafted focusing on specific prospect role context and value proposition.",
      referencedFacts: [],
    };
  }
}

export function getAIProvider(): AIProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return new UnconfiguredAIProvider();
  }
  return new OpenAICompatibleProvider(
    apiKey,
    process.env.OPENAI_BASE_URL,
    process.env.OPENAI_MODEL
  );
}
