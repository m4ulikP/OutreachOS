export interface LeadSearchFilter {
  jobTitle?: string;
  companySize?: string;
  industry?: string;
  location?: string;
  keywords?: string;
  limit?: number;
  offset?: number;
}

export interface DiscoveredLead {
  id: string;
  firstName: string;
  lastName: string;
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
  sourceProvider: string;
}

export interface SearchResult {
  leads: DiscoveredLead[];
  totalMatches: number;
  isConfigured: boolean;
  providerName: string;
  message?: string;
}

export interface LeadSourceProvider {
  readonly name: string;
  isConfigured(): boolean;
  search(filters: LeadSearchFilter): Promise<SearchResult>;
  getLead(id: string): Promise<DiscoveredLead | null>;
}
