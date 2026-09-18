import { z } from "zod";

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

// --------------------------------------------------------
// PHASE 5: STRUCTURED PERSONALIZATION TYPES & SCHEMAS
// --------------------------------------------------------

export interface OpportunitySignalInput {
  category: string;
  issue: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
  source?: string;
  recommendation?: string;
}

export interface PersonalizationInput {
  lead: {
    fullName: string;
    jobTitle?: string | null;
    companyName?: string | null;
    industry?: string | null;
    location?: string | null;
    website?: string | null;
  };
  research?: {
    summary?: string | null;
    structuredEvidence?: Record<string, unknown> | null;
    opportunitySignals?: OpportunitySignalInput[] | null;
  } | null;
  serviceProfile?: {
    name: string;
    focusAreas: string[];
    systemInstructionContext?: string;
  };
}

export const personalizationOutputSchema = z.object({
  subjectLine: z.string().min(3).max(160),
  emailBody: z.string().min(10).max(1500),
  linkedInMessage: z.string().min(5).max(450),
  whyProspect: z.string().min(5).max(500),
  evidenceUsed: z.array(z.string().max(160)).max(6),
  confidence: z.enum(["high", "medium", "low"]),
});

export type PersonalizationOutput = z.infer<typeof personalizationOutputSchema>;

export interface AIProvider {
  readonly name: string;
  isConfigured(): boolean;
  generatePersonalization(input: PersonalizationInput): Promise<PersonalizationOutput>;
  researchProspect?(leadInfo: {
    fullName: string;
    companyName: string;
    website?: string;
    linkedInUrl?: string;
  }): Promise<ResearchResult>;
  generatePersonalizedMessage?(request: PersonalizationRequest): Promise<PersonalizationResult>;
}
