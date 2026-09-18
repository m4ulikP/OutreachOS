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
 * Normalizes user-supplied domain input (stripping schemes, www, query params, ports).
 */
export function extractDomain(input?: string): string | undefined {
  if (!input) return undefined;
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//i, "");
  domain = domain.replace(/^www\./i, "");
  domain = domain.split("/")[0].split("?")[0].split("#")[0];
  domain = domain.split(":")[0].replace(/\.+$/, "");
  return domain.length > 0 ? domain : undefined;
}

/**
 * Maps common job titles to Hunter's officially supported seniority and department query parameters.
 * Hunter accepts:
 * - seniority: junior, senior, executive, director, manager
 * - department: executive, it, finance, management, sales, marketing, hr, legal, operations, engineering, communication
 */
export function mapSeniorityAndDepartment(jobTitle?: string): {
  seniority?: string;
  department?: string;
} {
  if (!jobTitle || jobTitle.trim() === "") {
    return {};
  }

  const title = jobTitle.toLowerCase();
  const seniorities: string[] = [];
  const departments: string[] = [];

  // Hunter official seniority values: 'junior', 'senior', 'executive'
  if (
    title.includes("founder") ||
    title.includes("ceo") ||
    title.includes("cto") ||
    title.includes("cfo") ||
    title.includes("cpo") ||
    title.includes("coo") ||
    title.includes("chief") ||
    title.includes("owner") ||
    title.includes("partner") ||
    title.includes("president") ||
    title.includes("director") ||
    title.includes("vp") ||
    title.includes("vice president") ||
    title.includes("head") ||
    title.includes("executive")
  ) {
    seniorities.push("executive");
  }

  if (
    title.includes("senior") ||
    title.includes("sr") ||
    title.includes("lead") ||
    title.includes("manager") ||
    title.includes("principal") ||
    title.includes("architect")
  ) {
    seniorities.push("senior");
  }

  if (
    title.includes("junior") ||
    title.includes("jr") ||
    title.includes("associate") ||
    title.includes("intern")
  ) {
    seniorities.push("junior");
  }

  // Hunter official department values: 'executive', 'it', 'finance', 'management', 'sales', 'marketing', 'hr', 'legal', 'operations', 'communication'
  if (
    title.includes("eng") ||
    title.includes("tech") ||
    title.includes("developer") ||
    title.includes("software") ||
    title.includes("cto") ||
    title.includes("architect") ||
    title.includes("data") ||
    title.includes("code") ||
    title.includes("dev")
  ) {
    departments.push("it");
  }

  if (
    title.includes("founder") ||
    title.includes("ceo") ||
    title.includes("chief") ||
    title.includes("president") ||
    title.includes("executive")
  ) {
    departments.push("executive", "management");
  }

  if (
    title.includes("head") ||
    title.includes("director") ||
    title.includes("vp") ||
    title.includes("vice president") ||
    title.includes("manager") ||
    title.includes("lead") ||
    title.includes("product") ||
    title.includes("cpo")
  ) {
    departments.push("management");
  }

  if (
    title.includes("market") ||
    title.includes("growth") ||
    title.includes("brand") ||
    title.includes("content") ||
    title.includes("seo") ||
    title.includes("acquisition")
  ) {
    departments.push("marketing");
  }

  if (
    title.includes("sale") ||
    title.includes("revenue") ||
    title.includes("account") ||
    title.includes("bizdev") ||
    title.includes("business development") ||
    title.includes("commercial")
  ) {
    departments.push("sales");
  }

  if (
    title.includes("finance") ||
    title.includes("cfo") ||
    title.includes("accounting") ||
    title.includes("treasur")
  ) {
    departments.push("finance");
  }

  if (
    title.includes("talent") ||
    title.includes("people") ||
    title.includes("hr") ||
    title.includes("recruit")
  ) {
    departments.push("hr");
  }

  if (
    title.includes("operation") ||
    title.includes("coo") ||
    title.includes("ops") ||
    title.includes("logistics")
  ) {
    departments.push("operations");
  }

  if (
    title.includes("legal") ||
    title.includes("counsel") ||
    title.includes("compliance")
  ) {
    departments.push("legal");
  }

  if (
    title.includes("communication") ||
    title.includes("pr") ||
    title.includes("public relation")
  ) {
    departments.push("communication");
  }

  return {
    seniority: seniorities.length > 0 ? Array.from(new Set(seniorities)).join(",") : undefined,
    department: departments.length > 0 ? Array.from(new Set(departments)).join(",") : undefined,
  };
}

/**
 * Generates a stable, deterministic lead ID for caching and tracking.
 */
function generateLeadId(email?: string, name?: string, company?: string): string {
  const seed = (email || `${name || "prospect"}_${company || "company"}`).toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `hunter_${hex}`;
}

/**
 * Production-grade Hunter.io Lead Discovery Provider Adapter.
 *
 * Adheres strictly to OutreachOS Phase 4 provider architecture:
 * - Uses Hunter's official API v2 only (GET /v2/domain-search, GET /v2/account)
 * - Transmits API key strictly server-side via X-API-KEY header (never query string)
 * - Never logs or exposes credentials
 * - Enforces personal decision-maker email resolution (type: personal)
 * - Handles rate limits (HTTP 429) and auth failures (HTTP 401/403) gracefully
 * - Provides bounded 5xx retries and timeout protection
 */
export class HunterLeadDiscoveryProvider implements LeadSourceProvider {
  readonly id = "hunter";
  readonly name = "Hunter.io B2B Lead Discovery";
  private apiKey: string;
  private baseUrl: string;
  private cache = new Map<string, DiscoveredLead>();

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

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = (apiKey || "").trim();
    this.baseUrl = (baseUrl || "https://api.hunter.io/v2").replace(/\/+$/, "");
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async search(filters: LeadSearchFilter): Promise<SearchResult> {
    if (!this.isConfigured()) {
      return {
        leads: [],
        totalMatches: 0,
        isConfigured: false,
        providerName: this.name,
        providerId: this.id,
        capabilities: this.capabilities,
        message: "Hunter.io API key is not configured in server environment.",
      };
    }

    const cleanDomain = extractDomain(filters.companyDomain);
    const cleanCompany = filters.companyName?.trim();

    // Check if companyName actually looks like a domain (e.g. "stripe.com")
    let searchDomain = cleanDomain;
    let searchCompany = cleanCompany;

    if (!searchDomain && searchCompany && searchCompany.includes(".") && !searchCompany.includes(" ")) {
      searchDomain = extractDomain(searchCompany);
      searchCompany = undefined;
    }

    // Hunter domain-search officially requires either a domain or company parameter.
    // If neither is provided, inform the user clearly rather than making an invalid request.
    if (!searchDomain && !searchCompany) {
      return {
        leads: [],
        totalMatches: 0,
        isConfigured: true,
        providerName: this.name,
        providerId: this.id,
        capabilities: this.capabilities,
        message:
          "Hunter.io requires a company name or company domain (e.g. 'Stripe' or 'stripe.com') to discover decision-makers. Please provide a company or domain in your criteria.",
      };
    }

    let boundLimit = Math.min(Math.max(1, filters.limit ?? 10), this.capabilities.maxLimit);
    const boundOffset = Math.max(0, filters.offset ?? 0);

    // Build Hunter query parameters
    const queryParams = new URLSearchParams();
    if (searchDomain) {
      queryParams.set("domain", searchDomain);
    } else if (searchCompany) {
      queryParams.set("company", searchCompany);
    }

    // Always request personal decision-maker emails (avoid generic support/info mailboxes)
    queryParams.set("type", "personal");
    queryParams.set("limit", String(boundLimit));
    queryParams.set("offset", String(boundOffset));

    // Map seniority and department from job title if provided
    const { seniority, department } = mapSeniorityAndDepartment(filters.jobTitle);
    if (seniority) {
      queryParams.set("seniority", seniority);
    }
    if (department) {
      queryParams.set("department", department);
    }

    let targetUrl = `${this.baseUrl}/domain-search?${queryParams.toString()}`;

    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(targetUrl, {
          method: "GET",
          headers: {
            "X-API-KEY": this.apiKey,
            Accept: "application/json",
            "User-Agent": "OutreachOS/1.0",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Authentication failure
        if (response.status === 401 || response.status === 403) {
          logger.error("Hunter API authentication failed", {
            provider: this.name,
            status: response.status,
          });
          throw new Error("Hunter.io authentication failed. Please check your LEAD_SOURCE_API_KEY.");
        }

        // Rate limit / Quota exceeded
        if (response.status === 429) {
          logger.warn("Hunter API rate limit or search quota reached", {
            provider: this.name,
          });
          throw new Error("Hunter.io rate limit or search quota exceeded. Please check your Hunter account usage.");
        }

        // Invalid search parameter or free plan limit (400)
        if (response.status === 400) {
          let errDetail = "Invalid request to Hunter.io.";
          let errId = "";
          try {
            const errJson = await response.json();
            errId = errJson?.errors?.[0]?.id || "";
            errDetail = errJson?.errors?.[0]?.details || errDetail;
          } catch {}

          // Hunter Free plan restricts search results to 10 email addresses.
          // If a pagination_error is encountered because limit > 10, auto-fallback to limit: 10.
          if (errId === "pagination_error" && boundLimit > 10 && attempt < maxRetries) {
            boundLimit = 10;
            queryParams.set("limit", "10");
            targetUrl = `${this.baseUrl}/domain-search?${queryParams.toString()}`;
            continue;
          }

          throw new Error(errDetail);
        }

        // Invalid search parameter (e.g. invalid domain syntax)
        if (response.status === 422) {
          let errDetail = "Invalid search parameters supplied to Hunter.io.";
          try {
            const errJson = await response.json();
            if (errJson?.errors?.[0]?.details) {
              errDetail = errJson.errors[0].details;
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

        const json = await response.json();
        const data = json.data || {};
        const meta = json.meta || {};

        // Parse organization metadata
        const orgName = data.organization || searchCompany || data.domain || "Company";
        const orgDomain = data.domain || searchDomain || filters.companyDomain;
        const orgIndustry = data.industry || filters.industry;
        const locationParts = [data.city, data.state, data.country].filter(Boolean);
        const orgLocation = locationParts.length > 0 ? locationParts.join(", ") : filters.location;
        const orgWebsite = orgDomain ? `https://${orgDomain}` : undefined;
        const techKeywords = Array.isArray(data.technologies)
          ? data.technologies.slice(0, 5).join(", ")
          : undefined;

        // Parse raw emails into DiscoveredLead
        const rawEmails: any[] = Array.isArray(data.emails) ? data.emails : [];
        const normalizedLeads: DiscoveredLead[] = [];

        for (const item of rawEmails) {
          if (!item || typeof item !== "object") continue;

          const firstName = item.first_name ? String(item.first_name).trim() : undefined;
          const lastName = item.last_name ? String(item.last_name).trim() : undefined;
          const fullName =
            [firstName, lastName].filter(Boolean).join(" ").trim() ||
            (item.value ? String(item.value).split("@")[0].replace(/[._-]/g, " ") : "Decision Maker");

          // Determine title from position, seniority, or department
          let jobTitle = item.position ? String(item.position).trim() : "";
          if (!jobTitle && item.seniority) {
            const capSeniority = item.seniority.charAt(0).toUpperCase() + item.seniority.slice(1);
            jobTitle = `${capSeniority} Professional`;
          }
          if (!jobTitle) {
            jobTitle = "Decision Maker";
          }

          const emailValue = item.value ? String(item.value).trim().toLowerCase() : undefined;
          const phoneValue = item.phone_number ? String(item.phone_number).trim() : undefined;
          const linkedInValue = item.linkedin ? String(item.linkedin).trim() : undefined;

          // Apply post-filters
          if (filters.hasEmail && !emailValue) {
            continue;
          }

          if (filters.hasLinkedIn && (!linkedInValue || !linkedInValue.includes("linkedin.com"))) {
            continue;
          }

          // If user specified job title and we mapped it to seniority/department,
          // Hunter already filtered server-side.
          // If neither seniority nor department was mapped, apply client-side position keyword check.
          if (filters.jobTitle && filters.jobTitle.trim() !== "") {
            const queryWords = filters.jobTitle.toLowerCase().split(/[\s,]+/).filter(Boolean);
            const titleHaystack = `${jobTitle} ${item.seniority || ""} ${item.department || ""}`.toLowerCase();
            const matchesQuery = queryWords.some((w) => titleHaystack.includes(w));
            if (!matchesQuery && !seniority && !department && item.position) {
              continue;
            }
          }

          const id = generateLeadId(emailValue, fullName, orgName);
          const lead: DiscoveredLead = {
            id,
            firstName,
            lastName,
            fullName,
            jobTitle,
            companyName: orgName,
            companyDomain: orgDomain,
            companySize: filters.companySize || undefined,
            industry: orgIndustry,
            location: orgLocation,
            email: emailValue,
            phone: phoneValue,
            linkedInUrl: linkedInValue,
            website: orgWebsite,
            keywords: techKeywords,
            sourceProvider: this.name,
          };

          // Cache for getLead
          this.cacheLead(lead);
          normalizedLeads.push(lead);
        }

        const totalMatches =
          typeof meta.results === "number" ? meta.results : normalizedLeads.length;

        return {
          leads: normalizedLeads,
          totalMatches,
          isConfigured: true,
          providerName: this.name,
          providerId: this.id,
          capabilities: this.capabilities,
        };
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const isAbort = err instanceof Error && err.name === "AbortError";
        lastError = isAbort
          ? new Error("Hunter.io API query timed out after 8 seconds.")
          : err instanceof Error
          ? err
          : new Error(String(err));

        if (isAbort && attempt < maxRetries) {
          continue;
        }

        // Non-retryable errors
        if (
          !isAbort &&
          (lastError.message.includes("authentication failed") ||
            lastError.message.includes("quota exceeded") ||
            lastError.message.includes("Invalid search parameters"))
        ) {
          break;
        }
      }
    }

    logger.error("Hunter.io query failed", { error: lastError?.message });
    return {
      leads: [],
      totalMatches: 0,
      isConfigured: true,
      providerName: this.name,
      providerId: this.id,
      capabilities: this.capabilities,
      message: `Hunter.io query failed: ${lastError?.message || "Unknown error"}`,
    };
  }

  async getLead(id: string): Promise<DiscoveredLead | null> {
    const cached = this.cache.get(id);
    if (cached) {
      return { ...cached };
    }
    return null;
  }

  async getHealth(): Promise<ProviderHealth> {
    if (!this.isConfigured()) {
      return {
        status: "unconfigured",
        message: "Hunter.io API credentials not configured in server environment.",
        timestamp: new Date().toISOString(),
      };
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/account`, {
        method: "GET",
        headers: {
          "X-API-KEY": this.apiKey,
          Accept: "application/json",
          "User-Agent": "OutreachOS/1.0",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      if (response.status === 401 || response.status === 403) {
        return {
          status: "down",
          latencyMs,
          message: "Hunter.io authentication failed. Please verify LEAD_SOURCE_API_KEY.",
          timestamp: new Date().toISOString(),
        };
      }

      if (response.status === 429) {
        return {
          status: "degraded",
          latencyMs,
          message: "Hunter.io API rate limit or search quota exceeded.",
          timestamp: new Date().toISOString(),
        };
      }

      if (!response.ok) {
        return {
          status: "degraded",
          latencyMs,
          message: `Hunter.io account check returned HTTP ${response.status}`,
          timestamp: new Date().toISOString(),
        };
      }

      const json = await response.json();
      const accountData = json.data || {};
      const planName = accountData.plan_name || "Active";
      const availableSearches =
        accountData.requests?.searches?.available ?? accountData.calls?.available ?? "N/A";

      return {
        status: "ok",
        latencyMs,
        message: `Hunter.io connected (Plan: ${planName}, Available searches: ${availableSearches})`,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      return {
        status: "down",
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : "Hunter.io health check unreachable",
        timestamp: new Date().toISOString(),
      };
    }
  }

  private cacheLead(lead: DiscoveredLead): void {
    if (this.cache.size > 500) {
      // Evict oldest entries
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(lead.id, lead);
  }
}
