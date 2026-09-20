/**
 * OutreachOS Public Opportunities Provider Types
 *
 * Defines normalized interfaces and contracts for public opportunity discovery channels
 * (e.g. Hacker News, Remote OK, Mock simulation).
 */

export type PublicOpportunitySource =
  | "HACKER_NEWS"
  | "REMOTE_OK"
  | "MOCK"
  | "REDDIT"
  | "WEB_SEARCH";

export interface DiscoveredPublicOpportunity {
  externalId?: string;
  source: PublicOpportunitySource;
  sourceUrl: string;
  title: string;
  description?: string;
  authorName?: string;
  authorProfileUrl?: string;
  publishedAt?: string;

  sourceName?: string;
  sourceCommunity?: string;
  companyName?: string;

  budget?: number;
  currency?: string;

  location?: {
    city?: string;
    state?: string;
    country?: string;
  };

  tags?: string[];

  rawMetadata?: Record<string, unknown>;
}

export interface PublicOpportunityCriteria {
  query?: string;
  intent?: string;
  location?: string;
  days?: number;
  limit?: number;
  providerId?: string;
}

export interface PublicOpportunitySearchResult {
  opportunities: DiscoveredPublicOpportunity[];
  totalMatches: number;
  isConfigured: boolean;
  isDevelopmentMock?: boolean;
  providerName: string;
  providerId: string;
  message?: string;
}

export interface PublicOpportunityProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  discover(criteria: PublicOpportunityCriteria): Promise<PublicOpportunitySearchResult>;
}
