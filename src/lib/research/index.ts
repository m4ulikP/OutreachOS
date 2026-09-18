import { safeFetchWebsite, SafeFetchOptions, SafeFetchResult } from "./safe-fetcher";
import {
  extractStructuredEvidence,
  boundStructuredEvidence,
  StructuredEvidence,
} from "./evidence-extractor";
import {
  analyzeWebDevelopmentOpportunities,
  OpportunitySignal,
} from "./opportunity-analyzer";

export * from "./ssrf-filter";
export * from "./safe-fetcher";
export * from "./evidence-extractor";
export * from "./opportunity-analyzer";

export interface WebsiteResearchResult {
  url: string;
  finalUrl: string;
  summary: string;
  structuredEvidence: StructuredEvidence;
  opportunitySignals: OpportunitySignal[];
  provider: string;
  providerVersion: string;
  durationMs: number;
}

export interface WebsiteResearchProvider {
  readonly name: string;
  researchWebsite(url: string, options?: SafeFetchOptions): Promise<WebsiteResearchResult>;
}

/**
 * Production Website Researcher.
 * Performs SSRF-safe fetching, extracts structured evidence, and runs
 * objective opportunity analysis.
 */
export class ProductionWebsiteResearcher implements WebsiteResearchProvider {
  readonly name = "ProductionWebsiteResearcher";
  readonly version = "1.0.0";

  async researchWebsite(url: string, options?: SafeFetchOptions): Promise<WebsiteResearchResult> {
    const fetchResult: SafeFetchResult = await safeFetchWebsite(url, options);

    // 1. Extract raw structured evidence
    const rawEvidence = extractStructuredEvidence({
      html: fetchResult.html,
      requestedUrl: fetchResult.requestedUrl,
      finalUrl: fetchResult.finalUrl,
      isFinalHttps: fetchResult.isFinalHttps,
      headers: fetchResult.headers,
    });

    // 2. Bound payload sizes for safe persistence
    const structuredEvidence = boundStructuredEvidence(rawEvidence);

    // 3. Analyze objective opportunities
    const opportunitySignals = analyzeWebDevelopmentOpportunities(structuredEvidence);

    // 4. Generate concise, evidence-based business summary
    const brand = structuredEvidence.identity.detectedBusinessName || "Company";
    const title = structuredEvidence.identity.pageTitle ? ` titled "${structuredEvidence.identity.pageTitle}"` : "";
    const techSummary = structuredEvidence.technology.detectedPlatforms.length > 0
      ? ` built with ${structuredEvidence.technology.detectedPlatforms.join(", ")}`
      : "";
    const contactSummary = structuredEvidence.business.emails.length > 0 || structuredEvidence.business.phones.length > 0
      ? ` Public contact channels available (${structuredEvidence.business.emails.length} email, ${structuredEvidence.business.phones.length} phone).`
      : "";
    const opportunitiesSummary = `${opportunitySignals.length} web development opportunities identified.`;

    const summary = `${brand} public website (${fetchResult.finalUrl})${title}${techSummary}.${contactSummary} ${opportunitiesSummary}`;

    return {
      url: fetchResult.requestedUrl,
      finalUrl: fetchResult.finalUrl,
      summary: summary.slice(0, 500),
      structuredEvidence,
      opportunitySignals,
      provider: this.name,
      providerVersion: this.version,
      durationMs: fetchResult.durationMs,
    };
  }
}

export const defaultWebsiteResearcher = new ProductionWebsiteResearcher();
