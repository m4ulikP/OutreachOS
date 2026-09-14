export interface VerifiedFact {
  category: "company" | "role" | "achievement" | "technology" | "news";
  fact: string;
  sourceUrl?: string;
  confidence: number;
}

export interface ResearchResult {
  verifiedFacts: VerifiedFact[];
  keyPainPoints: string[];
  personalizedHooks: string[];
  summary: string;
}

export interface PersonalizationRequest {
  leadName: string;
  leadJobTitle?: string;
  companyName?: string;
  industry?: string;
  channel: "email" | "linkedin";
  valueProposition: string;
  tone?: "professional" | "conversational" | "direct";
  verifiedFacts?: VerifiedFact[];
}

export interface PersonalizationResult {
  subjectLine?: string;
  content: string;
  rationale: string;
  referencedFacts: string[];
}

export interface AIProvider {
  readonly name: string;
  isConfigured(): boolean;
  researchProspect(leadInfo: {
    fullName: string;
    companyName: string;
    website?: string;
    linkedInUrl?: string;
  }): Promise<ResearchResult>;
  generatePersonalizedMessage(request: PersonalizationRequest): Promise<PersonalizationResult>;
}
