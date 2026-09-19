import {
  BusinessDiscoveryCriteria,
  BusinessDiscoveryProvider,
  BusinessProviderHealth,
  BusinessSearchResult,
  DiscoveredBusiness,
  HeadcountRange,
} from "./types";
import { logger } from "@/lib/logger";
import { normalizeCountryCode } from "@/lib/providers/lead-source";

/**
 * Hunter.io Discover official headcount bucket taxonomy.
 */
const HUNTER_HEADCOUNT_BUCKETS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10001+",
] as const;

/**
 * Maps headcount criteria (range object or bucket string) into Hunter's supported headcount buckets.
 */
export function mapHeadcountToHunter(headcount?: HeadcountRange | string): string[] {
  if (!headcount) return [];

  if (typeof headcount === "string") {
    const trimmed = headcount.trim();
    if (HUNTER_HEADCOUNT_BUCKETS.includes(trimmed as any)) {
      return [trimmed];
    }
    // Attempt parsing common patterns like "10-50" or "50+"
    const parts = trimmed.split(/[-–—+]/).map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n));
    if (parts.length === 1 && trimmed.includes("+")) {
      return mapHeadcountToHunter({ min: parts[0] });
    }
    if (parts.length >= 2) {
      return mapHeadcountToHunter({ min: parts[0], max: parts[1] });
    }
    return [];
  }

  const min = headcount.min ?? 1;
  const max = headcount.max ?? Infinity;

  const bucketRanges: Array<{ bucket: string; bMin: number; bMax: number }> = [
    { bucket: "1-10", bMin: 1, bMax: 10 },
    { bucket: "11-50", bMin: 11, bMax: 50 },
    { bucket: "51-200", bMin: 51, bMax: 200 },
    { bucket: "201-500", bMin: 201, bMax: 500 },
    { bucket: "501-1000", bMin: 501, bMax: 1000 },
    { bucket: "1001-5000", bMin: 1001, bMax: 5000 },
    { bucket: "5001-10000", bMin: 5001, bMax: 10000 },
    { bucket: "10001+", bMin: 10001, bMax: Infinity },
  ];

  return bucketRanges
    .filter((r) => r.bMin <= max && r.bMax >= min)
    .map((r) => r.bucket);
}

export class HunterDiscoverProvider implements BusinessDiscoveryProvider {
  readonly id = "hunter-discover";
  readonly name = "Hunter.io B2B Discover";

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = (apiKey ?? process.env.LEAD_SOURCE_API_KEY ?? process.env.HUNTER_API_KEY ?? "").trim();
    this.baseUrl = (baseUrl ?? process.env.HUNTER_BASE_URL ?? "https://api.hunter.io/v2").replace(/\/+$/, "");
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async discover(criteria: BusinessDiscoveryCriteria): Promise<BusinessSearchResult> {
    if (!this.isConfigured()) {
      return {
        businesses: [],
        totalMatches: 0,
        isConfigured: false,
        providerName: this.name,
        providerId: this.id,
        message: "Hunter.io API key is not configured in server environment.",
      };
    }

    const boundLimit = Math.min(Math.max(1, criteria.limit ?? 20), 100);
    const boundOffset = Math.max(0, criteria.offset ?? 0);

    // Construct Hunter Discover request body
    const requestBody: Record<string, any> = {
      limit: boundLimit,
      offset: boundOffset,
    };

    let hasAnyFilterOrQuery = false;

    // 1. Natural language query
    if (criteria.query && criteria.query.trim()) {
      requestBody.query = criteria.query.trim();
      hasAnyFilterOrQuery = true;
    }

    // 2. Headquarters location filter
    if (criteria.location && criteria.location.trim()) {
      const normalizedCountry = normalizeCountryCode(criteria.location);
      if (normalizedCountry) {
        requestBody.headquarters_location = {
          include: [{ country: normalizedCountry }],
        };
        hasAnyFilterOrQuery = true;
      }
    }

    // 3. Industry filter
    if (criteria.industry && criteria.industry.trim()) {
      requestBody.industry = {
        include: [criteria.industry.trim()],
      };
      hasAnyFilterOrQuery = true;
    }

    // 4. Keywords filter
    if (criteria.keywords && criteria.keywords.length > 0) {
      const cleanKeywords = criteria.keywords.map((k) => k.trim()).filter(Boolean);
      if (cleanKeywords.length > 0) {
        requestBody.keywords = {
          include: cleanKeywords,
          match: "any",
        };
        hasAnyFilterOrQuery = true;
      }
    }

    // 5. Headcount filter
    if (criteria.headcount) {
      const mappedHeadcount = mapHeadcountToHunter(criteria.headcount);
      if (mappedHeadcount.length > 0) {
        requestBody.headcount = mappedHeadcount;
        hasAnyFilterOrQuery = true;
      }
    }

    // 6. Company type filter
    if (criteria.companyType && criteria.companyType.trim()) {
      requestBody.company_type = {
        include: [criteria.companyType.trim()],
      };
      hasAnyFilterOrQuery = true;
    }

    // Hunter Discover officially requires either a natural language query or at least one filter
    if (!hasAnyFilterOrQuery) {
      return {
        businesses: [],
        totalMatches: 0,
        isConfigured: true,
        providerName: this.name,
        providerId: this.id,
        message:
          "Hunter Discover requires a search query or at least one filter (such as location, industry, keywords, headcount, or company type) to discover companies.",
      };
    }

    const targetUrl = `${this.baseUrl}/discover`;
    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": this.apiKey,
            Accept: "application/json",
            "User-Agent": "OutreachOS/1.0",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Authentication failure
        if (response.status === 401 || response.status === 403) {
          logger.error("Hunter Discover authentication failed", {
            provider: this.name,
            status: response.status,
          });
          throw new Error("Hunter.io authentication failed. Please check your LEAD_SOURCE_API_KEY.");
        }

        // Rate limit / quota exceeded
        if (response.status === 429) {
          logger.warn("Hunter Discover rate limit or quota exceeded", {
            provider: this.name,
          });
          throw new Error("Hunter.io rate limit or search quota exceeded. Please check your Hunter account usage.");
        }

        // Bad request / invalid filter format
        if (response.status === 400 || response.status === 422) {
          let errDetail = "Invalid search parameters supplied to Hunter Discover.";
          try {
            const errJson = await response.json();
            if (errJson?.errors?.[0]?.details) {
              errDetail = errJson.errors[0].details;
            } else if (errJson?.message) {
              errDetail = errJson.message;
            }
          } catch {}
          throw new Error(errDetail);
        }

        // Server-side errors (502, 503, 504) - retry with bounded backoff
        if (!response.ok) {
          if ([502, 503, 504].includes(response.status) && attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
            continue;
          }
          throw new Error(`Hunter.io returned unexpected HTTP status ${response.status}`);
        }

        let json: any;
        try {
          json = await response.json();
        } catch {
          throw new Error("Hunter.io returned a malformed response format.");
        }

        if (!json || typeof json !== "object" || !Array.isArray(json.data)) {
          throw new Error("Hunter.io returned an unexpected response structure.");
        }

        const rawCompanies: any[] = json.data;
        const meta = json.meta || {};
        const totalMatches = typeof meta.results === "number" ? meta.results : rawCompanies.length;

        const normalizedBusinesses: DiscoveredBusiness[] = rawCompanies.map((item) => {
          const domain = item.domain ? String(item.domain).trim().toLowerCase() : undefined;
          const organization = item.organization ? String(item.organization).trim() : undefined;
          const name = organization || domain || "Unnamed Company";

          const hqCity = item.city ? String(item.city).trim() : undefined;
          const hqState = item.state ? String(item.state).trim() : undefined;
          const hqCountry = item.country ? String(item.country).trim() : undefined;

          const hasHq = Boolean(hqCity || hqState || hqCountry);

          let emailsCount: DiscoveredBusiness["emailsCount"];
          if (item.emails_count && typeof item.emails_count === "object") {
            emailsCount = {
              personal: Number(item.emails_count.personal) || 0,
              generic: Number(item.emails_count.generic) || 0,
              total: Number(item.emails_count.total) || 0,
            };
          }

          return {
            externalId: domain || organization || undefined,
            name,
            domain,
            websiteUrl: domain ? `https://${domain}` : undefined,
            industry: item.industry ? String(item.industry).trim() : undefined,
            description: item.description ? String(item.description).trim() : undefined,
            headquarters: hasHq
              ? {
                  city: hqCity,
                  state: hqState,
                  country: hqCountry,
                }
              : undefined,
            employeeCount: undefined,
            headcountRange: item.headcount ? String(item.headcount).trim() : undefined,
            companyType: item.company_type ? String(item.company_type).trim() : undefined,
            yearFounded: typeof item.year_founded === "number" ? item.year_founded : undefined,
            technologies: Array.isArray(item.technologies)
              ? item.technologies.map(String).filter(Boolean)
              : [],
            keywords: Array.isArray(item.keywords)
              ? item.keywords.map(String).filter(Boolean)
              : [],
            emailsCount,
            source: "HUNTER_DISCOVER",
            sourceUrl: domain ? `https://hunter.io/discover?domain=${encodeURIComponent(domain)}` : undefined,
          };
        });

        return {
          businesses: normalizedBusinesses,
          totalMatches,
          isConfigured: true,
          providerName: this.name,
          providerId: this.id,
          message:
            normalizedBusinesses.length === 0
              ? "No companies matched your discovery criteria."
              : undefined,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);

        // If AbortError (timeout)
        if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
          lastError = new Error("Hunter.io request timed out after 8000ms");
        } else {
          lastError = err instanceof Error ? err : new Error(String(err));
        }

        // Fatal errors (401, 403, 429, validation 400) should not be retried
        if (
          lastError.message.includes("authentication failed") ||
          lastError.message.includes("rate limit") ||
          lastError.message.includes("Invalid search parameters")
        ) {
          throw lastError;
        }

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
          continue;
        }
      }
    }

    throw lastError || new Error("Hunter.io discovery request failed.");
  }

  async getHealth(): Promise<BusinessProviderHealth> {
    if (!this.isConfigured()) {
      return {
        status: "unconfigured",
        message: "Hunter.io API key is not configured.",
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: "ok",
      message: "Hunter.io B2B Discover is configured and operational.",
      timestamp: new Date().toISOString(),
    };
  }
}
