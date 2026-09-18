/**
 * OutreachOS Provider-Agnostic Lead Discovery Types
 *
 * Defines the contract for all external B2B prospect discovery providers.
 * Core application code depends exclusively on these interfaces,
 * isolating OutreachOS from specific vendor APIs.
 */

export type SupportedSearchFilter =
  | "jobTitle"
  | "companyName"
  | "companyDomain"
  | "companySize"
  | "industry"
  | "location"
  | "keywords"
  | "hasEmail"
  | "hasLinkedIn";

export interface ProviderCapabilities {
  supportedFilters: SupportedSearchFilter[];
  supportsEmail: boolean;
  supportsLinkedIn: boolean;
  supportsPagination: boolean;
  maxLimit: number;
  rateLimitPerMinute?: number;
}

export interface ProviderHealth {
  status: "ok" | "degraded" | "down" | "unconfigured";
  latencyMs?: number;
  message?: string;
  timestamp: string;
}

export interface LeadSearchFilter {
  jobTitle?: string;
  companyName?: string;
  companyDomain?: string;
  companySize?: string;
  industry?: string;
  location?: string;
  keywords?: string;
  hasEmail?: boolean;
  hasLinkedIn?: boolean;
  limit?: number;
  offset?: number;
  providerId?: string;
}

export interface DiscoveredLead {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  companyDomain?: string;
  companySize?: string;
  industry?: string;
  location?: string;
  email?: string;
  phone?: string;
  linkedInUrl?: string;
  website?: string;
  keywords?: string;
  sourceProvider: string;
  // Multi-tenant deduplication metadata computed server-side
  isExistingLead?: boolean;
  existingLeadId?: string | null;
  matchedBy?: "email" | "linkedin" | "name_company";
}

export interface SearchResult {
  leads: DiscoveredLead[];
  totalMatches: number;
  isConfigured: boolean;
  isDevelopmentMock?: boolean;
  providerName: string;
  providerId?: string;
  capabilities?: ProviderCapabilities;
  message?: string;
}

/**
 * Universal interface that all lead discovery adapters must implement.
 */
export interface LeadSourceProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  isConfigured(): boolean;
  search(filters: LeadSearchFilter): Promise<SearchResult>;
  getLead(id: string): Promise<DiscoveredLead | null>;
  getHealth(): Promise<ProviderHealth>;
}
