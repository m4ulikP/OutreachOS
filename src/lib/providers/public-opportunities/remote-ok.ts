import {
  PublicOpportunityProvider,
  PublicOpportunityCriteria,
  PublicOpportunitySearchResult,
  DiscoveredPublicOpportunity,
} from "./types";

interface RemoteOKItem {
  id?: string | number;
  position?: string;
  company?: string;
  description?: string;
  date?: string;
  tags?: string[];
  url?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  legal?: string;
}

const RELEVANT_TAGS_AND_TERMS = [
  "web",
  "website",
  "frontend",
  "fullstack",
  "full-stack",
  "react",
  "nextjs",
  "next.js",
  "javascript",
  "typescript",
  "wordpress",
  "node",
  "vue",
  "ui",
  "ux",
  "developer",
  "engineer",
];

export class RemoteOKPublicOpportunityProvider implements PublicOpportunityProvider {
  readonly id = "remote_ok";
  readonly name = "Remote OK (Public JSON API)";

  isConfigured(): boolean {
    return true;
  }

  async discover(criteria: PublicOpportunityCriteria): Promise<PublicOpportunitySearchResult> {
    const limit = Math.min(Math.max(criteria.limit || 20, 1), 50);
    const query = (criteria.query || "").toLowerCase().trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch("https://remoteok.com/api", {
        headers: {
          "User-Agent": "OutreachOS Client Discovery/1.0",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          opportunities: [],
          totalMatches: 0,
          isConfigured: true,
          providerName: this.name,
          providerId: this.id,
          message: `Remote OK API returned status ${res.status}`,
        };
      }

      const rawData = await res.json();
      if (!Array.isArray(rawData)) {
        return {
          opportunities: [],
          totalMatches: 0,
          isConfigured: true,
          providerName: this.name,
          providerId: this.id,
          message: "Unexpected response format from Remote OK API",
        };
      }

      // First entry is disclaimer metadata
      const items: RemoteOKItem[] = rawData.filter((item) => item && typeof item === "object" && !item.legal);

      // Filter to relevant web dev jobs
      const filtered = items.filter((item) => {
        const title = (item.position || "").toLowerCase();
        const desc = (item.description || "").toLowerCase();
        const tags = (item.tags || []).map((t) => t.toLowerCase());

        if (query) {
          const matchesQuery = title.includes(query) || desc.includes(query) || tags.some((t) => t.includes(query));
          if (!matchesQuery) return false;
        }

        // Web development relevance filter
        const isWebRelated =
          RELEVANT_TAGS_AND_TERMS.some((term) => tags.includes(term)) ||
          RELEVANT_TAGS_AND_TERMS.some((term) => title.includes(term));

        return isWebRelated;
      });

      const boundedHits = filtered.slice(0, limit);

      const opportunities: DiscoveredPublicOpportunity[] = boundedHits.map((item) => {
        const extId = item.id ? String(item.id) : undefined;
        const jobUrl = item.url || (extId ? `https://remoteok.com/l/${extId}` : "https://remoteok.com");
        const cleanDesc = (item.description || "").replace(/<[^>]*>?/gm, "").trim().slice(0, 1500);

        let budget: number | undefined;
        if (typeof item.salary_max === "number" && item.salary_max > 0) {
          budget = item.salary_max;
        } else if (typeof item.salary_min === "number" && item.salary_min > 0) {
          budget = item.salary_min;
        }

        return {
          externalId: extId,
          source: "REMOTE_OK",
          sourceUrl: jobUrl,
          title: item.position || "Untitled Remote OK Listing",
          description: cleanDesc,
          companyName: item.company || undefined,
          publishedAt: item.date || undefined,
          sourceName: "Remote OK",
          sourceCommunity: "Remote OK Jobs",
          budget,
          currency: budget ? "USD" : undefined,
          location: item.location
            ? { country: item.location }
            : undefined,
          tags: item.tags || [],
          rawMetadata: {
            id: item.id,
            company: item.company,
            location: item.location,
            salary_min: item.salary_min,
            salary_max: item.salary_max,
          },
        };
      });

      return {
        opportunities,
        totalMatches: filtered.length,
        isConfigured: true,
        providerName: this.name,
        providerId: this.id,
      };
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      return {
        opportunities: [],
        totalMatches: 0,
        isConfigured: true,
        providerName: this.name,
        providerId: this.id,
        message: isAbort
          ? "Remote OK request timed out after 8000ms"
          : err instanceof Error
          ? err.message
          : "Failed to fetch from Remote OK",
      };
    }
  }
}
