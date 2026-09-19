/**
 * OutreachOS Normalized Business Discovery Types (Phase B.1)
 *
 * Defines the contract for all company/business discovery providers.
 * Core application code depends exclusively on these interfaces,
 * isolating OutreachOS from specific vendor APIs (e.g. Hunter Discover, Google Places).
 *
 * Distinct from Lead Discovery:
 * - Lead Discovery finds individual human contacts/emails at a known company.
 * - Business Discovery identifies prospective companies/businesses based on high-level
 *   business criteria (industry, location, size, keywords, website presence).
 */

export type BusinessDiscoverySource =
  | "HUNTER_DISCOVER"
  | "GOOGLE_PLACES"
  | "MOCK_SIMULATION"
  | "PUBLIC_FEED"
  | "MANUAL"
  | "CSV_IMPORT";

export interface BusinessHeadquarters {
  city?: string;
  state?: string;
  country?: string;
}

export interface DiscoveredBusiness {
  externalId?: string;
  name: string;
  domain?: string;
  websiteUrl?: string;
  industry?: string;
  description?: string;
  headquarters?: BusinessHeadquarters;
  employeeCount?: number;
  headcountRange?: string; // e.g. "1-10", "11-50", "51-200"
  companyType?: string;
  yearFounded?: number;
  technologies?: string[];
  keywords?: string[];
  emailsCount?: {
    personal: number;
    generic: number;
    total: number;
  };
  source: BusinessDiscoverySource | string;
  sourceUrl?: string;
}

export interface HeadcountRange {
  min?: number;
  max?: number;
}

export interface BusinessDiscoveryCriteria {
  query?: string;
  location?: string;
  industry?: string;
  keywords?: string[];
  headcount?: HeadcountRange | string;
  companyType?: string;
  limit?: number;
  offset?: number;
  providerId?: string;
}

export interface BusinessSearchResult {
  businesses: DiscoveredBusiness[];
  totalMatches: number;
  isConfigured: boolean;
  isDevelopmentMock?: boolean;
  providerName: string;
  providerId?: string;
  message?: string;
}

export interface BusinessProviderHealth {
  status: "ok" | "degraded" | "down" | "unconfigured";
  latencyMs?: number;
  message?: string;
  timestamp: string;
}

/**
 * Universal interface that all business discovery adapters must implement.
 */
export interface BusinessDiscoveryProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  discover(criteria: BusinessDiscoveryCriteria): Promise<BusinessSearchResult>;
  getHealth?(): Promise<BusinessProviderHealth>;
}
