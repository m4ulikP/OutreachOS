import {
  PublicOpportunityProvider,
  PublicOpportunityCriteria,
  PublicOpportunitySearchResult,
  DiscoveredPublicOpportunity,
} from "./types";

interface AlgoliaHit {
  objectID: string;
  title?: string;
  story_title?: string;
  story_text?: string;
  comment_text?: string;
  author?: string;
  created_at?: string;
  created_at_i?: number;
  url?: string;
  _tags?: string[];
}

interface AlgoliaResponse {
  hits?: AlgoliaHit[];
  nbHits?: number;
}

export class HackerNewsPublicOpportunityProvider implements PublicOpportunityProvider {
  readonly id = "hacker_news";
  readonly name = "Hacker News (Algolia API)";

  isConfigured(): boolean {
    // Unauthenticated public API
    return true;
  }

  async discover(criteria: PublicOpportunityCriteria): Promise<PublicOpportunitySearchResult> {
    const query = (criteria.query || "looking for web developer").trim();
    const limit = Math.min(Math.max(criteria.limit || 20, 1), 50);
    const days = Math.min(Math.max(criteria.days || 14, 1), 30);

    const secondsAgo = days * 86400;
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - secondsAgo;

    const endpoint = new URL("https://hn.algolia.com/api/v1/search_by_date");
    endpoint.searchParams.set("query", query);
    endpoint.searchParams.set("numericFilters", `created_at_i>${cutoffTimestamp}`);
    endpoint.searchParams.set("hitsPerPage", String(limit));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(endpoint.toString(), {
        headers: { Accept: "application/json" },
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
          message: `Hacker News API returned status ${res.status}`,
        };
      }

      const data = (await res.json()) as AlgoliaResponse;
      const hits = Array.isArray(data.hits) ? data.hits : [];

      const opportunities: DiscoveredPublicOpportunity[] = hits.map((hit) => {
        const rawTitle = hit.title || hit.story_title || `HN Post #${hit.objectID}`;
        const rawText = hit.story_text || hit.comment_text || "";
        const cleanText = rawText.replace(/<[^>]*>?/gm, "").trim();

        const itemUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;

        const isAskHN =
          rawTitle.toLowerCase().startsWith("ask hn:") ||
          (hit._tags && hit._tags.includes("ask_hn"));

        return {
          externalId: hit.objectID,
          source: "HACKER_NEWS",
          sourceUrl: itemUrl,
          title: rawTitle,
          description: cleanText.slice(0, 1500),
          authorName: hit.author || undefined,
          authorProfileUrl: hit.author
            ? `https://news.ycombinator.com/user?id=${hit.author}`
            : undefined,
          publishedAt: hit.created_at || (hit.created_at_i ? new Date(hit.created_at_i * 1000).toISOString() : undefined),
          sourceName: "Hacker News",
          sourceCommunity: isAskHN ? "Ask HN" : "Hacker News",
          tags: hit._tags || [],
          rawMetadata: {
            objectID: hit.objectID,
            author: hit.author,
            created_at_i: hit.created_at_i,
            storyUrl: hit.url,
          },
        };
      });

      return {
        opportunities,
        totalMatches: data.nbHits || opportunities.length,
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
          ? "Hacker News request timed out after 8000ms"
          : err instanceof Error
          ? err.message
          : "Failed to fetch from Hacker News",
      };
    }
  }
}
