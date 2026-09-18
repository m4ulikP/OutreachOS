import {
  DiscoveredLead,
  LeadSearchFilter,
  LeadSourceProvider,
  ProviderCapabilities,
  ProviderHealth,
  SearchResult,
} from "./types";
import { logger } from "@/lib/logger";

/**
 * Realistic decision-maker pool for development and offline testing.
 * Strictly tagged as mock simulation data.
 */
const MOCK_PROSPECTS_POOL: Omit<DiscoveredLead, "isExistingLead" | "existingLeadId" | "matchedBy">[] = [
  {
    id: "disc_lead_001",
    firstName: "Sarah",
    lastName: "Jenkins",
    fullName: "Sarah Jenkins",
    jobTitle: "Founder & CEO",
    companyName: "CloudScale Systems",
    companyDomain: "cloudscalesystems.io",
    companySize: "1-10",
    industry: "B2B SaaS & Cloud",
    location: "San Francisco, CA, USA",
    email: "sarah.jenkins@cloudscalesystems.io",
    phone: "+1 (415) 555-0192",
    linkedInUrl: "https://www.linkedin.com/in/sarah-jenkins-cloudscale",
    website: "https://cloudscalesystems.io",
    keywords: "Next.js, AI, Stripe, Hiring, SaaS, Founder",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_002",
    firstName: "Marcus",
    lastName: "Chen",
    fullName: "Marcus Chen",
    jobTitle: "VP of Engineering",
    companyName: "Nexora Intelligence",
    companyDomain: "nexora.ai",
    companySize: "51-200",
    industry: "Artificial Intelligence & ML",
    location: "New York, NY, USA",
    email: "m.chen@nexora.ai",
    phone: "+1 (212) 555-0144",
    linkedInUrl: "https://www.linkedin.com/in/marcus-chen-nexora",
    website: "https://nexora.ai",
    keywords: "Python, PyTorch, LLMs, Vector DB",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_003",
    firstName: "Elena",
    lastName: "Rostova",
    fullName: "Elena Rostova",
    jobTitle: "Head of Growth & Marketing",
    companyName: "Aura Commerce",
    companyDomain: "auracommerce.com",
    companySize: "11-50",
    industry: "E-Commerce & D2C Retail",
    location: "Austin, TX, USA",
    email: "elena@auracommerce.com",
    phone: "+1 (512) 555-0188",
    linkedInUrl: "https://www.linkedin.com/in/elena-rostova-aura",
    website: "https://auracommerce.com",
    keywords: "Shopify, Klaviyo, Meta Ads, Retention, Growth",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_004",
    firstName: "David",
    lastName: "O'Connor",
    fullName: "David O'Connor",
    jobTitle: "Managing Director",
    companyName: "Vanguard Studio",
    companyDomain: "vanguardstudio.design",
    companySize: "1-10",
    industry: "Design & Digital Agencies",
    location: "London, UK",
    email: "david@vanguardstudio.design",
    phone: "+44 20 7946 0912",
    linkedInUrl: "https://www.linkedin.com/in/david-oconnor-design",
    website: "https://vanguardstudio.design",
    keywords: "Figma, Webflow, Branding, Retainers, UI/UX",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_005",
    firstName: "Priya",
    lastName: "Patel",
    fullName: "Priya Patel",
    jobTitle: "Chief Product Officer",
    companyName: "PayStream Rails",
    companyDomain: "paystream.co",
    companySize: "51-200",
    industry: "Financial Services & Payments",
    location: "San Francisco, CA, USA",
    email: "priya.p@paystream.co",
    phone: "+1 (415) 555-0176",
    linkedInUrl: "https://www.linkedin.com/in/priya-patel-paystream",
    website: "https://paystream.co",
    keywords: "Payments, Banking API, Mobile, Security, Rails",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_006",
    firstName: "Lucas",
    lastName: "Moreau",
    fullName: "Lucas Moreau",
    jobTitle: "Co-Founder & CTO",
    companyName: "Synthetix Labs",
    companyDomain: "synthetixlabs.tech",
    companySize: "1-10",
    industry: "B2B SaaS & Cloud",
    location: "San Francisco, Remote",
    email: "lucas@synthetixlabs.tech",
    phone: "+33 1 42 68 55 00",
    linkedInUrl: "https://www.linkedin.com/in/lucas-moreau-tech",
    website: "https://synthetixlabs.tech",
    keywords: "Next.js, AI, Stripe, Hiring, Cloud, B2B",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_007",
    firstName: "Chloe",
    lastName: "Nguyen",
    fullName: "Chloe Nguyen",
    jobTitle: "VP of Product Marketing",
    companyName: "DataWeave Analytics",
    companyDomain: "dataweave-hq.io",
    companySize: "51-200",
    industry: "Enterprise Software & Analytics",
    location: "Seattle, WA, USA",
    email: "chloe.nguyen@dataweave-hq.io",
    phone: "+1 (206) 555-0133",
    linkedInUrl: "https://www.linkedin.com/in/chloe-nguyen-analytics",
    website: "https://dataweave-hq.io",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_008",
    firstName: "Tobias",
    lastName: "Lindholm",
    fullName: "Tobias Lindholm",
    jobTitle: "Chief Technology Officer",
    companyName: "Nordic HealthTech",
    companyDomain: "nordichealth.se",
    companySize: "11-50",
    industry: "Healthcare & MedTech",
    location: "Stockholm, Sweden",
    email: "tobias@nordichealth.se",
    phone: "+46 8 123 4567",
    linkedInUrl: "https://www.linkedin.com/in/tobias-lindholm-health",
    website: "https://nordichealth.se",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_009",
    firstName: "Amara",
    lastName: "Okafor",
    fullName: "Amara Okafor",
    jobTitle: "Director of Operations",
    companyName: "SwiftRoute Logistics",
    companyDomain: "swiftroute.com",
    companySize: "201-500",
    industry: "Logistics & Supply Chain",
    location: "Chicago, IL, USA",
    email: "amara@swiftroute.com",
    phone: "+1 (312) 555-0122",
    linkedInUrl: "https://www.linkedin.com/in/amara-okafor-swift",
    website: "https://swiftroute.com",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_010",
    firstName: "Benjamin",
    lastName: "Katz",
    fullName: "Benjamin Katz",
    jobTitle: "Founder & Managing Partner",
    companyName: "Apex Venture Studio",
    companyDomain: "apexventures.co",
    companySize: "1-10",
    industry: "Venture Capital & Incubation",
    location: "Boston, MA, USA",
    email: "ben@apexventures.co",
    phone: "+1 (617) 555-0111",
    linkedInUrl: "https://www.linkedin.com/in/ben-katz-apex",
    website: "https://apexventures.co",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_011",
    firstName: "Maya",
    lastName: "Lin",
    fullName: "Maya Lin",
    jobTitle: "Head of Talent & People",
    companyName: "Hyperion Robotics",
    companyDomain: "hyperionrobotics.ai",
    companySize: "11-50",
    industry: "Artificial Intelligence & ML",
    location: "Toronto, Canada",
    email: "maya.lin@hyperionrobotics.ai",
    phone: "+1 (416) 555-0189",
    linkedInUrl: "https://www.linkedin.com/in/maya-lin-hyperion",
    website: "https://hyperionrobotics.ai",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_012",
    firstName: "Liam",
    lastName: "Fitzgerald",
    fullName: "Liam Fitzgerald",
    jobTitle: "VP of Growth",
    companyName: "Pulse Media Labs",
    companyDomain: "pulsemedialabs.com",
    companySize: "11-50",
    industry: "Media & AdTech",
    location: "Dublin, Ireland",
    email: "liam@pulsemedialabs.com",
    phone: "+353 1 496 0123",
    linkedInUrl: "https://www.linkedin.com/in/liam-fitzgerald-pulse",
    website: "https://pulsemedialabs.com",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_013",
    firstName: "Rachel",
    lastName: "Greenberg",
    fullName: "Rachel Greenberg",
    jobTitle: "Chief Executive Officer",
    companyName: "BioGenix Diagnostics",
    companyDomain: "biogenixdx.com",
    companySize: "51-200",
    industry: "Biotech & Life Sciences",
    location: "San Diego, CA, USA",
    email: "rachel@biogenixdx.com",
    phone: "+1 (858) 555-0199",
    linkedInUrl: "https://www.linkedin.com/in/rachel-greenberg-biogenix",
    website: "https://biogenixdx.com",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_014",
    firstName: "Tareq",
    lastName: "Al-Mansoor",
    fullName: "Tareq Al-Mansoor",
    jobTitle: "Head of Infrastructure",
    companyName: "FinMesh Global",
    companyDomain: "finmesh.io",
    companySize: "201-500",
    industry: "Financial Services & Payments",
    location: "Dubai, UAE",
    email: "tareq@finmesh.io",
    phone: "+971 4 312 3456",
    linkedInUrl: "https://www.linkedin.com/in/tareq-almansoor-finmesh",
    website: "https://finmesh.io",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
  {
    id: "disc_lead_015",
    firstName: "Sophie",
    lastName: "Martin",
    fullName: "Sophie Martin",
    jobTitle: "Creative Director",
    companyName: "Monolith Brand Consulting",
    companyDomain: "monolithbrand.com",
    companySize: "1-10",
    industry: "Design & Digital Agencies",
    location: "Berlin, Germany",
    email: "sophie@monolithbrand.com",
    phone: "+49 30 1234567",
    linkedInUrl: "https://www.linkedin.com/in/sophie-martin-monolith",
    website: "https://monolithbrand.com",
    sourceProvider: "Mock Lead Source (Dev Simulation)",
  },
];

/**
 * Mock / Development Lead Source Provider.
 * Allows safe, offline discovery testing without calling third-party APIs.
 * Explicitly flags data as simulation / mock so users and APIs are never misled.
 */
export class MockLeadDiscoveryProvider implements LeadSourceProvider {
  readonly id = "mock";
  readonly name = "Development Discovery Provider (Offline Simulation)";

  readonly capabilities: ProviderCapabilities = {
    supportedFilters: [
      "jobTitle",
      "companyName",
      "companyDomain",
      "companySize",
      "industry",
      "location",
      "keywords",
      "hasEmail",
      "hasLinkedIn",
    ],
    supportsEmail: true,
    supportsLinkedIn: true,
    supportsPagination: true,
    maxLimit: 100,
    rateLimitPerMinute: 300,
  };

  isConfigured(): boolean {
    return true;
  }

  async search(filters: LeadSearchFilter): Promise<SearchResult> {
    const limit = Math.min(Math.max(1, filters.limit ?? 25), this.capabilities.maxLimit);
    const offset = Math.max(0, filters.offset ?? 0);

    const filtered = MOCK_PROSPECTS_POOL.filter((p) => {
      if (filters.jobTitle && filters.jobTitle.trim() !== "") {
        const query = filters.jobTitle.toLowerCase().trim();
        const words = query.split(/[\s,]+/).filter(Boolean);
        const matchTitle = words.some((w) => p.jobTitle.toLowerCase().includes(w));
        if (!matchTitle) return false;
      }

      if (filters.companyName && filters.companyName.trim() !== "") {
        if (!p.companyName.toLowerCase().includes(filters.companyName.toLowerCase().trim())) {
          return false;
        }
      }

      if (filters.companyDomain && filters.companyDomain.trim() !== "") {
        if (!p.companyDomain?.toLowerCase().includes(filters.companyDomain.toLowerCase().trim())) {
          return false;
        }
      }

      if (filters.companySize && filters.companySize.trim() !== "") {
        if (p.companySize !== filters.companySize.trim()) {
          return false;
        }
      }

      if (filters.industry && filters.industry.trim() !== "") {
        const indTokens = filters.industry.split(/[,/&]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
        const matchInd = indTokens.some((t) => p.industry?.toLowerCase().includes(t));
        if (!matchInd) return false;
      }

      if (filters.location && filters.location.trim() !== "") {
        const locTokens = filters.location.split(/[,/]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
        const matchLoc = locTokens.some((t) => p.location?.toLowerCase().includes(t));
        if (!matchLoc) return false;
      }

      if (filters.keywords && filters.keywords.trim() !== "") {
        const kw = filters.keywords.toLowerCase().trim();
        const kwWords = kw.split(/[\s,]+/).filter(Boolean);
        const haystack = `${p.fullName} ${p.jobTitle} ${p.companyName} ${p.industry || ""} ${p.location || ""} ${(p as any).keywords || ""}`.toLowerCase();
        const matchKw = kwWords.some((w) => haystack.includes(w));
        if (!matchKw) return false;
      }

      if (filters.hasEmail && !p.email) {
        return false;
      }

      if (filters.hasLinkedIn && !p.linkedInUrl) {
        return false;
      }

      return true;
    });

    const paginated = filtered.slice(offset, offset + limit).map((lead) => ({
      ...lead,
    }));

    return {
      leads: paginated,
      totalMatches: filtered.length,
      isConfigured: true,
      isDevelopmentMock: true,
      providerName: this.name,
      providerId: this.id,
      capabilities: this.capabilities,
      message:
        "Development fallback active: returning realistic simulated B2B prospects for testing.",
    };
  }

  async getLead(id: string): Promise<DiscoveredLead | null> {
    const found = MOCK_PROSPECTS_POOL.find((p) => p.id === id);
    if (!found) return null;
    return { ...found };
  }

  async getHealth(): Promise<ProviderHealth> {
    return {
      status: "ok",
      latencyMs: 5,
      message: "Development Mock Provider is online and responsive.",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Lead Source Provider when no third-party API credentials are configured.
 * Never fabricates fake leads in production. Clearly indicates configuration is required.
 */
export class UnconfiguredLeadSourceProvider implements LeadSourceProvider {
  readonly id = "unconfigured";
  readonly name = "Permitted B2B Lead Discovery (Unconfigured)";

  readonly capabilities: ProviderCapabilities = {
    supportedFilters: [],
    supportsEmail: false,
    supportsLinkedIn: false,
    supportsPagination: false,
    maxLimit: 0,
  };

  isConfigured(): boolean {
    return false;
  }

  async search(_filters: LeadSearchFilter): Promise<SearchResult> {
    return {
      leads: [],
      totalMatches: 0,
      isConfigured: false,
      providerName: this.name,
      providerId: this.id,
      capabilities: this.capabilities,
      message:
        "No external lead discovery provider is currently configured. To search real prospects, connect a permitted provider API key (such as Apollo, Clearbit, or Hunter) in Settings.",
    };
  }

  async getLead(_id: string): Promise<DiscoveredLead | null> {
    return null;
  }

  async getHealth(): Promise<ProviderHealth> {
    return {
      status: "unconfigured",
      message: "Lead discovery provider credentials not configured.",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Lead Source Provider when credentials are configured.
 * Handles server-side calls with timeout, bounded retries for 5xx, and sanitized errors.
 */
export class ConfiguredLeadSourceProvider implements LeadSourceProvider {
  readonly id = "configured-http";
  readonly name = "Permitted Lead Data Provider";
  private apiKey: string;
  private baseUrl: string;

  readonly capabilities: ProviderCapabilities = {
    supportedFilters: [
      "jobTitle",
      "companyName",
      "companyDomain",
      "companySize",
      "industry",
      "location",
      "keywords",
      "hasEmail",
      "hasLinkedIn",
    ],
    supportsEmail: true,
    supportsLinkedIn: true,
    supportsPagination: true,
    maxLimit: 100,
    rateLimitPerMinute: 60,
  };

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl || "https://api.outreach-lead-provider.internal/v1").replace(/\/+$/, "");
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async search(filters: LeadSearchFilter): Promise<SearchResult> {
    if (!this.isConfigured()) {
      return new UnconfiguredLeadSourceProvider().search(filters);
    }

    const boundLimit = Math.min(Math.max(1, filters.limit ?? 25), this.capabilities.maxLimit);
    const boundOffset = Math.max(0, filters.offset ?? 0);
    const sanitizedFilters = { ...filters, limit: boundLimit, offset: boundOffset };

    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(`${this.baseUrl}/search`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(sanitizedFilters),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 401 || response.status === 403) {
          logger.error("Provider authentication failed", { provider: this.name, status: response.status });
          throw new Error("Provider authentication failed. Check API credentials.");
        }

        if (response.status === 429) {
          logger.warn("Provider rate limit reached", { provider: this.name });
          throw new Error("Provider rate limit reached. Please retry in a few moments.");
        }

        if (!response.ok) {
          // Retry only on 502, 503, 504
          if ([502, 503, 504].includes(response.status) && attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
            continue;
          }
          throw new Error(`Provider returned error status ${response.status}`);
        }

        const data = await response.json();
        const rawLeads: unknown[] = Array.isArray(data.leads) ? data.leads : [];

        // Normalize raw leads into DiscoveredLead
        const normalizedLeads: DiscoveredLead[] = rawLeads
          .map((item: any, idx: number): DiscoveredLead | null => {
            if (!item || typeof item !== "object") return null;
            const fullName = String(item.fullName || `${item.firstName || ""} ${item.lastName || ""}`.trim() || "Unknown");
            const jobTitle = String(item.jobTitle || "Professional");
            const companyName = String(item.companyName || "Company");
            return {
              id: String(item.id || `ext_${idx}_${Date.now()}`),
              firstName: item.firstName ? String(item.firstName) : undefined,
              lastName: item.lastName ? String(item.lastName) : undefined,
              fullName,
              jobTitle,
              companyName,
              companyDomain: item.companyDomain ? String(item.companyDomain) : undefined,
              companySize: item.companySize ? String(item.companySize) : undefined,
              industry: item.industry ? String(item.industry) : undefined,
              location: item.location ? String(item.location) : undefined,
              email: item.email ? String(item.email).trim().toLowerCase() : undefined,
              phone: item.phone ? String(item.phone) : undefined,
              linkedInUrl: item.linkedInUrl ? String(item.linkedInUrl) : undefined,
              website: item.website ? String(item.website) : undefined,
              sourceProvider: this.name,
            };
          })
          .filter((l): l is DiscoveredLead => l !== null);

        return {
          leads: normalizedLeads,
          totalMatches: typeof data.total === "number" ? data.total : normalizedLeads.length,
          isConfigured: true,
          providerName: this.name,
          providerId: this.id,
          capabilities: this.capabilities,
        };
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const isAbort = err instanceof Error && err.name === "AbortError";
        lastError = isAbort ? new Error("Lead discovery provider timed out after 8 seconds.") : err instanceof Error ? err : new Error(String(err));

        if (isAbort && attempt < maxRetries) {
          continue;
        }

        // Break on non-retryable errors
        if (!isAbort && lastError.message.includes("Provider authentication")) {
          break;
        }
      }
    }

    logger.error("Provider query failed", { error: lastError?.message });
    return {
      leads: [],
      totalMatches: 0,
      isConfigured: true,
      providerName: this.name,
      providerId: this.id,
      capabilities: this.capabilities,
      message: `Provider query failed: ${lastError?.message || "Unknown error"}`,
    };
  }

  async getLead(id: string): Promise<DiscoveredLead | null> {
    if (!this.isConfigured()) return null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/leads/${encodeURIComponent(id)}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const item = await response.json();
      return {
        id: String(item.id || id),
        firstName: item.firstName ? String(item.firstName) : undefined,
        lastName: item.lastName ? String(item.lastName) : undefined,
        fullName: String(item.fullName || `${item.firstName || ""} ${item.lastName || ""}`.trim() || "Unknown"),
        jobTitle: String(item.jobTitle || "Professional"),
        companyName: String(item.companyName || "Company"),
        companyDomain: item.companyDomain ? String(item.companyDomain) : undefined,
        companySize: item.companySize ? String(item.companySize) : undefined,
        industry: item.industry ? String(item.industry) : undefined,
        location: item.location ? String(item.location) : undefined,
        email: item.email ? String(item.email) : undefined,
        phone: item.phone ? String(item.phone) : undefined,
        linkedInUrl: item.linkedInUrl ? String(item.linkedInUrl) : undefined,
        website: item.website ? String(item.website) : undefined,
        sourceProvider: this.name,
      };
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  async getHealth(): Promise<ProviderHealth> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      return {
        status: response.ok ? "ok" : "degraded",
        latencyMs,
        message: response.ok ? "Provider responsive" : `Provider returned ${response.status}`,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      return {
        status: "down",
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : "Provider health check unreachable",
        timestamp: new Date().toISOString(),
      };
    }
  }
}

/**
 * Returns the active Lead Source Provider based on environment configuration.
 *
 * Priority:
 * 1. Explicit mock request / dev simulation mode.
 * 2. Configured HTTP provider if LEAD_SOURCE_API_KEY is present.
 * 3. In development (non-production) when no key is set: returns MockLeadDiscoveryProvider
 *    so developers have working out-of-the-box discovery with clear mock flags.
 * 4. In production when no key is set: returns UnconfiguredLeadSourceProvider.
 */
export function getLeadSourceProvider(providerId?: string): LeadSourceProvider {
  if (
    providerId === "mock" ||
    process.env.DISCOVERY_DEV_MODE === "true" ||
    process.env.DISCOVERY_PROVIDER === "mock"
  ) {
    return new MockLeadDiscoveryProvider();
  }

  const apiKey = process.env.LEAD_SOURCE_API_KEY;
  if (apiKey && apiKey.trim() !== "") {
    return new ConfiguredLeadSourceProvider(apiKey, process.env.LEAD_SOURCE_PROVIDER_URL);
  }

  return new UnconfiguredLeadSourceProvider();
}
