import {
  DiscoveredLead,
  LeadSearchFilter,
  LeadSourceProvider,
  SearchResult,
} from "./types";

/**
 * Lead Source Provider when no third-party API credentials are configured.
 * Never fabricates fake leads. Clearly indicates configuration is required.
 */
export class UnconfiguredLeadSourceProvider implements LeadSourceProvider {
  readonly name = "Permitted B2B Lead Discovery (Unconfigured)";

  isConfigured(): boolean {
    return false;
  }

  async search(filters: LeadSearchFilter): Promise<SearchResult> {
    return {
      leads: [],
      totalMatches: 0,
      isConfigured: false,
      providerName: this.name,
      message:
        "No external lead discovery provider is currently configured. To search real prospects, connect a permitted provider API key (such as Apollo, Clearbit, or Hunter) in Settings.",
    };
  }

  async getLead(id: string): Promise<DiscoveredLead | null> {
    return null;
  }
}

/**
 * Lead Source Provider when credentials are configured.
 */
export class ConfiguredLeadSourceProvider implements LeadSourceProvider {
  readonly name = "Permitted Lead Data Provider";
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || "https://api.outreach-lead-provider.internal/v1";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async search(filters: LeadSearchFilter): Promise<SearchResult> {
    if (!this.isConfigured()) {
      return new UnconfiguredLeadSourceProvider().search(filters);
    }

    // Call real provider API endpoint server-side
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        throw new Error(`Lead provider returned error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        leads: data.leads || [],
        totalMatches: data.total || 0,
        isConfigured: true,
        providerName: this.name,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        leads: [],
        totalMatches: 0,
        isConfigured: true,
        providerName: this.name,
        message: `Provider query failed: ${msg}`,
      };
    }
  }

  async getLead(id: string): Promise<DiscoveredLead | null> {
    if (!this.isConfigured()) return null;
    return null;
  }
}

/**
 * Returns the active Lead Source Provider based on environment configuration.
 */
export function getLeadSourceProvider(): LeadSourceProvider {
  const apiKey = process.env.LEAD_SOURCE_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return new UnconfiguredLeadSourceProvider();
  }
  return new ConfiguredLeadSourceProvider(apiKey, process.env.LEAD_SOURCE_PROVIDER_URL);
}
