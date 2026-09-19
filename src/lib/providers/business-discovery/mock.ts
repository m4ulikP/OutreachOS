import {
  BusinessDiscoveryCriteria,
  BusinessDiscoveryProvider,
  BusinessProviderHealth,
  BusinessSearchResult,
  DiscoveredBusiness,
} from "./types";

/**
 * Deterministic business discovery pool for development, offline simulation, and testing.
 * Crucially includes businesses with and without websites/domains to allow testing
 * of website deficit opportunity detection (NO_WEBSITE vs WEBSITE_IMPROVEMENT).
 */
export const MOCK_BUSINESSES_POOL: DiscoveredBusiness[] = [
  {
    externalId: "mock_biz_001",
    name: "Apex Peak Dental Care",
    // No website or domain - classic freelance opportunity!
    domain: undefined,
    websiteUrl: undefined,
    industry: "Healthcare & Dental Clinics",
    description: "Family-owned dental and cosmetic oral surgery clinic operating in North Austin.",
    headquarters: {
      city: "Austin",
      state: "TX",
      country: "US",
    },
    employeeCount: 8,
    headcountRange: "1-10",
    companyType: "private",
    yearFounded: 2017,
    technologies: [],
    keywords: ["dentist", "oral surgery", "local healthcare", "appointment"],
    emailsCount: {
      personal: 0,
      generic: 0,
      total: 0,
    },
    source: "MOCK_SIMULATION",
    sourceUrl: "https://mock.outreachos.dev/companies/apex-peak-dental",
  },
  {
    externalId: "mock_biz_002",
    name: "Oak & Ember Artisan Bakery",
    // No website - operates solely via word-of-mouth and social media
    domain: undefined,
    websiteUrl: undefined,
    industry: "Restaurants & Food Services",
    description: "Craft sourdough bakery, specialty pastries, and wholesale bread distributor.",
    headquarters: {
      city: "Portland",
      state: "OR",
      country: "US",
    },
    employeeCount: 14,
    headcountRange: "11-50",
    companyType: "private",
    yearFounded: 2021,
    technologies: [],
    keywords: ["bakery", "restaurant", "cafe", "wholesale", "catering"],
    emailsCount: {
      personal: 0,
      generic: 1,
      total: 1,
    },
    source: "MOCK_SIMULATION",
    sourceUrl: "https://mock.outreachos.dev/companies/oak-ember-bakery",
  },
  {
    externalId: "mock_biz_003",
    name: "Rustbelt Heavy Machine Repair",
    // Outdated HTTP website needing modern web redesign
    domain: "rustbeltmachinerepair.com",
    websiteUrl: "http://rustbeltmachinerepair.com",
    industry: "Industrial Machinery & Manufacturing",
    description: "Precision CNC maintenance, gearbox re-machining, and heavy hydraulic equipment diagnostics.",
    headquarters: {
      city: "Cleveland",
      state: "OH",
      country: "US",
    },
    employeeCount: 35,
    headcountRange: "11-50",
    companyType: "private",
    yearFounded: 1998,
    technologies: ["Apache", "PHP 5.6", "jQuery"],
    keywords: ["cnc repair", "manufacturing", "hydraulics", "machinery", "industrial"],
    emailsCount: {
      personal: 2,
      generic: 2,
      total: 4,
    },
    source: "MOCK_SIMULATION",
    sourceUrl: "https://mock.outreachos.dev/companies/rustbelt-repair",
  },
  {
    externalId: "mock_biz_004",
    name: "CloudScale Systems",
    // Modern SaaS with domain and full web presence
    domain: "cloudscalesystems.io",
    websiteUrl: "https://cloudscalesystems.io",
    industry: "Information Technology & Services",
    description: "Kubernetes orchestration monitoring and cost optimization platform for hybrid multi-cloud workloads.",
    headquarters: {
      city: "San Francisco",
      state: "CA",
      country: "US",
    },
    employeeCount: 120,
    headcountRange: "51-200",
    companyType: "private",
    yearFounded: 2020,
    technologies: ["Next.js", "React", "AWS", "Stripe", "PostgreSQL"],
    keywords: ["cloud", "saas", "kubernetes", "devops", "monitoring"],
    emailsCount: {
      personal: 12,
      generic: 3,
      total: 15,
    },
    source: "MOCK_SIMULATION",
    sourceUrl: "https://mock.outreachos.dev/companies/cloudscale-systems",
  },
  {
    externalId: "mock_biz_005",
    name: "Nexora Intelligence",
    // Fast-growing AI scaleup
    domain: "nexora.ai",
    websiteUrl: "https://nexora.ai",
    industry: "Computer Software",
    description: "Generative AI orchestration and retrieval-augmented generation engine for enterprise compliance.",
    headquarters: {
      city: "New York",
      state: "NY",
      country: "US",
    },
    employeeCount: 42,
    headcountRange: "11-50",
    companyType: "private",
    yearFounded: 2023,
    technologies: ["Next.js", "Tailwind CSS", "Python", "FastAPI"],
    keywords: ["ai", "machine learning", "rag", "compliance", "software"],
    emailsCount: {
      personal: 8,
      generic: 2,
      total: 10,
    },
    source: "MOCK_SIMULATION",
    sourceUrl: "https://mock.outreachos.dev/companies/nexora-ai",
  },
  {
    externalId: "mock_biz_006",
    name: "Spice Route Bistro",
    // Restaurant with no website
    domain: undefined,
    websiteUrl: undefined,
    industry: "Restaurants & Food Services",
    description: "Contemporary regional Indian restaurant offering authentic coastal thalis and evening cocktails.",
    headquarters: {
      city: "London",
      state: "England",
      country: "GB",
    },
    employeeCount: 18,
    headcountRange: "11-50",
    companyType: "private",
    yearFounded: 2019,
    technologies: [],
    keywords: ["restaurant", "bistro", "dining", "indian food", "cocktails"],
    emailsCount: {
      personal: 0,
      generic: 1,
      total: 1,
    },
    source: "MOCK_SIMULATION",
    sourceUrl: "https://mock.outreachos.dev/companies/spice-route-bistro",
  },
  {
    externalId: "mock_biz_007",
    name: "Vanguard Studio & Architecture",
    // Boutique architecture firm
    domain: "vanguarddesign.studio",
    websiteUrl: "https://vanguarddesign.studio",
    industry: "Design & Architecture",
    description: "Sustainable commercial and residential architectural blueprints and interior design consultancy.",
    headquarters: {
      city: "Chicago",
      state: "IL",
      country: "US",
    },
    employeeCount: 7,
    headcountRange: "1-10",
    companyType: "private",
    yearFounded: 2016,
    technologies: ["WordPress", "Elementor", "Webflow"],
    keywords: ["architecture", "interior design", "sustainable", "commercial", "studio"],
    emailsCount: {
      personal: 3,
      generic: 1,
      total: 4,
    },
    source: "MOCK_SIMULATION",
    sourceUrl: "https://mock.outreachos.dev/companies/vanguard-studio",
  },
  {
    externalId: "mock_biz_008",
    name: "PayStream Rails India",
    // Fintech in Bangalore
    domain: "paystreamrails.in",
    websiteUrl: "https://paystreamrails.in",
    industry: "Financial Services",
    description: "Unified cross-border payment gateway integration tailored for Asian and Middle Eastern exporters.",
    headquarters: {
      city: "Bengaluru",
      state: "Karnataka",
      country: "IN",
    },
    employeeCount: 85,
    headcountRange: "51-200",
    companyType: "private",
    yearFounded: 2021,
    technologies: ["React", "Go", "Kubernetes", "PostgreSQL"],
    keywords: ["fintech", "payments", "upi", "banking", "financial"],
    emailsCount: {
      personal: 9,
      generic: 2,
      total: 11,
    },
    source: "MOCK_SIMULATION",
    sourceUrl: "https://mock.outreachos.dev/companies/paystream-rails",
  },
];

export class MockBusinessDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly id = "mock-business-discovery";
  readonly name = "Mock Business Discovery (Dev Simulation)";

  isConfigured(): boolean {
    return true;
  }

  async discover(criteria: BusinessDiscoveryCriteria): Promise<BusinessSearchResult> {
    let filtered = [...MOCK_BUSINESSES_POOL];

    // Filter by query (text match across name, description, industry, keywords, domain)
    if (criteria.query && criteria.query.trim()) {
      const q = criteria.query.trim().toLowerCase();
      filtered = filtered.filter((b) => {
        const nameMatch = b.name.toLowerCase().includes(q);
        const descMatch = b.description?.toLowerCase().includes(q);
        const indMatch = b.industry?.toLowerCase().includes(q);
        const domainMatch = b.domain?.toLowerCase().includes(q);
        const kwMatch = b.keywords?.some((k) => k.toLowerCase().includes(q));
        return nameMatch || descMatch || indMatch || domainMatch || kwMatch;
      });
    }

    // Filter by location (city, state, or country)
    if (criteria.location && criteria.location.trim()) {
      const loc = criteria.location.trim().toLowerCase();
      filtered = filtered.filter((b) => {
        const hq = b.headquarters;
        if (!hq) return false;
        return (
          hq.city?.toLowerCase().includes(loc) ||
          hq.state?.toLowerCase().includes(loc) ||
          hq.country?.toLowerCase() === loc ||
          (loc === "india" && hq.country === "IN") ||
          (loc === "usa" && hq.country === "US") ||
          (loc === "united states" && hq.country === "US") ||
          (loc === "uk" && hq.country === "GB")
        );
      });
    }

    // Filter by industry
    if (criteria.industry && criteria.industry.trim()) {
      const ind = criteria.industry.trim().toLowerCase();
      filtered = filtered.filter((b) => b.industry?.toLowerCase().includes(ind));
    }

    // Filter by keywords
    if (criteria.keywords && criteria.keywords.length > 0) {
      const cleanKeywords = criteria.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
      if (cleanKeywords.length > 0) {
        filtered = filtered.filter((b) => {
          const bKeywords = (b.keywords || []).map((k) => k.toLowerCase());
          return cleanKeywords.some((ck) =>
            bKeywords.some((bk) => bk.includes(ck)) || b.name.toLowerCase().includes(ck)
          );
        });
      }
    }

    // Filter by headcount
    if (criteria.headcount) {
      if (typeof criteria.headcount === "string") {
        const hc = criteria.headcount.trim();
        filtered = filtered.filter((b) => b.headcountRange === hc);
      } else if (typeof criteria.headcount === "object") {
        const { min, max } = criteria.headcount;
        if (min !== undefined) {
          filtered = filtered.filter((b) => (b.employeeCount ?? 0) >= min);
        }
        if (max !== undefined) {
          filtered = filtered.filter((b) => (b.employeeCount ?? 0) <= max);
        }
      }
    }

    // Filter by companyType
    if (criteria.companyType && criteria.companyType.trim()) {
      const ct = criteria.companyType.trim().toLowerCase();
      filtered = filtered.filter((b) => b.companyType?.toLowerCase() === ct);
    }

    const totalMatches = filtered.length;
    const offset = Math.max(0, criteria.offset ?? 0);
    const limit = Math.min(Math.max(1, criteria.limit ?? 20), 100);

    const paginated = filtered.slice(offset, offset + limit);

    return {
      businesses: paginated,
      totalMatches,
      isConfigured: true,
      isDevelopmentMock: true,
      providerName: this.name,
      providerId: this.id,
      message: `Discovered ${paginated.length} business(es) via development simulation.`,
    };
  }

  async getHealth(): Promise<BusinessProviderHealth> {
    return {
      status: "ok",
      latencyMs: 1,
      message: "Mock business discovery provider is operational (offline simulation mode).",
      timestamp: new Date().toISOString(),
    };
  }
}
