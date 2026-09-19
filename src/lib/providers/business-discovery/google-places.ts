import {
  BusinessDiscoveryCriteria,
  BusinessDiscoveryProvider,
  BusinessHeadquarters,
  BusinessProviderHealth,
  BusinessSearchResult,
  DiscoveredBusiness,
} from "./types";
import { logger } from "@/lib/logger";

/**
 * Standard field mask for Google Places API (New) Text Search.
 * Requests core identity, location, categorization, web presence, and Google Maps reference.
 * Excludes higher-priced Contact and Atmosphere SKUs (phone, rating, review count, editorial summary)
 * during initial discovery to minimize API costs.
 */
export const GOOGLE_PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.addressComponents",
  "places.googleMapsUri",
].join(",");

/**
 * Helper to safely extract domain name from a website URL.
 * Returns undefined if URL is absent or invalid.
 */
export function extractDomainFromUrl(url?: string): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Formats a snake_case Google place type into a human-readable title.
 * e.g. "dental_clinic" -> "Dental Clinic"
 */
export function formatPlaceType(type?: string): string | undefined {
  if (!type || typeof type !== "string") return undefined;
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Parses Google Places address components into a structured BusinessHeadquarters object.
 */
export function parseAddressComponents(
  components?: Array<{ longText: string; shortText: string; types: string[] }>,
  formattedAddress?: string
): BusinessHeadquarters | undefined {
  if (!components && !formattedAddress) return undefined;

  let city: string | undefined;
  let state: string | undefined;
  let country: string | undefined;
  let postalCode: string | undefined;
  let streetNumber: string | undefined;
  let route: string | undefined;

  if (Array.isArray(components)) {
    for (const comp of components) {
      if (!comp || !Array.isArray(comp.types)) continue;

      if (comp.types.includes("locality") || comp.types.includes("sublocality") || comp.types.includes("postal_town")) {
        if (!city) city = comp.longText || comp.shortText;
      }
      if (comp.types.includes("administrative_area_level_1")) {
        state = comp.shortText || comp.longText;
      }
      if (comp.types.includes("country")) {
        country = comp.shortText || comp.longText;
      }
      if (comp.types.includes("postal_code")) {
        postalCode = comp.longText || comp.shortText;
      }
      if (comp.types.includes("street_number")) {
        streetNumber = comp.longText || comp.shortText;
      }
      if (comp.types.includes("route")) {
        route = comp.longText || comp.shortText;
      }
    }
  }

  const streetAddress = streetNumber && route ? `${streetNumber} ${route}` : route || streetNumber || undefined;

  const hasAny = Boolean(city || state || country || postalCode || streetAddress || formattedAddress);
  if (!hasAny) return undefined;

  return {
    streetAddress,
    formattedAddress: formattedAddress ? formattedAddress.trim() : undefined,
    city: city ? city.trim() : undefined,
    state: state ? state.trim() : undefined,
    country: country ? country.trim() : undefined,
    postalCode: postalCode ? postalCode.trim() : undefined,
  };
}

/**
 * Google Places API (New) Business Discovery Provider.
 *
 * Discovers local businesses using Google Maps Platform's official Places API (New)
 * Text Search endpoint (POST https://places.googleapis.com/v1/places:searchText).
 *
 * Crucial semantic responsibility:
 * When a business has no websiteUri listed on Google Places, this provider returns:
 * websiteUrl === undefined
 * and does NOT fabricate a URL from the business name.
 */
export class GooglePlacesProvider implements BusinessDiscoveryProvider {
  readonly id = "google-places";
  readonly name = "Google Places (New)";

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = (
      apiKey ??
      process.env.GOOGLE_PLACES_API_KEY ??
      process.env.GOOGLE_MAPS_API_KEY ??
      ""
    ).trim();
    this.baseUrl = (
      baseUrl ??
      process.env.GOOGLE_PLACES_BASE_URL ??
      "https://places.googleapis.com/v1"
    ).replace(/\/+$/, "");
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Builds the natural language textQuery for Google Places Text Search.
   */
  private buildTextQuery(criteria: BusinessDiscoveryCriteria): string | null {
    const parts: string[] = [];

    if (criteria.query && criteria.query.trim()) {
      parts.push(criteria.query.trim());
    } else if (criteria.industry && criteria.industry.trim()) {
      parts.push(criteria.industry.trim());
    } else if (criteria.keywords && criteria.keywords.length > 0) {
      const cleanKeywords = criteria.keywords.map((k) => k.trim()).filter(Boolean);
      if (cleanKeywords.length > 0) {
        parts.push(cleanKeywords.join(" "));
      }
    }

    const loc = criteria.location ? criteria.location.trim() : "";
    if (parts.length > 0) {
      const mainQuery = parts.join(" ");
      if (loc && !mainQuery.toLowerCase().includes(loc.toLowerCase())) {
        return `${mainQuery} in ${loc}`;
      }
      return mainQuery;
    }

    if (loc) {
      return loc;
    }

    return null;
  }

  async discover(criteria: BusinessDiscoveryCriteria): Promise<BusinessSearchResult> {
    if (!this.isConfigured()) {
      return {
        businesses: [],
        totalMatches: 0,
        isConfigured: false,
        providerName: this.name,
        providerId: this.id,
        message: "Google Places API key is not configured in server environment.",
      };
    }

    const textQuery = this.buildTextQuery(criteria);
    if (!textQuery) {
      return {
        businesses: [],
        totalMatches: 0,
        isConfigured: true,
        providerName: this.name,
        providerId: this.id,
        message: "Google Places requires a query, industry, keyword, or location to discover businesses.",
      };
    }

    const targetLimit = Math.min(Math.max(1, criteria.limit ?? 20), 100);
    const pageSize = Math.min(targetLimit, 20);

    const allPlaces: any[] = [];
    let nextPageToken: string | undefined = undefined;
    let pageCount = 0;
    const maxPages = targetLimit > 20 ? 2 : 1; // Strict bound to prevent quota explosion

    do {
      pageCount++;
      const requestBody: Record<string, any> = {
        textQuery,
        pageSize,
      };

      if (nextPageToken) {
        requestBody.pageToken = nextPageToken;
      }

      const endpoint = `${this.baseUrl}/places:searchText`;
      const responseData = await this.executeSearchRequest(endpoint, requestBody);

      if (Array.isArray(responseData.places)) {
        allPlaces.push(...responseData.places);
      }

      nextPageToken = responseData.nextPageToken;
    } while (nextPageToken && allPlaces.length < targetLimit && pageCount < maxPages);

    const boundedPlaces = allPlaces.slice(0, targetLimit);

    const normalizedBusinesses: DiscoveredBusiness[] = boundedPlaces.map((place) => {
      const placeId = place.id ? String(place.id).trim() : undefined;
      const displayName = place.displayName?.text ? String(place.displayName.text).trim() : "Unnamed Business";
      const rawWebsite = place.websiteUri ? String(place.websiteUri).trim() : undefined;
      const domain = rawWebsite ? extractDomainFromUrl(rawWebsite) : undefined;

      const hq = parseAddressComponents(place.addressComponents, place.formattedAddress);

      const industry =
        place.primaryTypeDisplayName?.text
          ? String(place.primaryTypeDisplayName.text).trim()
          : place.primaryType
            ? formatPlaceType(place.primaryType)
            : Array.isArray(place.types) && place.types[0]
              ? formatPlaceType(place.types[0])
              : undefined;

      const description = place.editorialSummary?.text ? String(place.editorialSummary.text).trim() : undefined;

      const phoneNumber =
        place.nationalPhoneNumber ? String(place.nationalPhoneNumber).trim() :
        place.internationalPhoneNumber ? String(place.internationalPhoneNumber).trim() :
        undefined;

      const rating = typeof place.rating === "number" ? place.rating : undefined;
      const userRatingCount = typeof place.userRatingCount === "number" ? place.userRatingCount : undefined;
      const primaryType = place.primaryType ? String(place.primaryType).trim() : undefined;

      const sourceUrl =
        place.googleMapsUri ? String(place.googleMapsUri).trim() :
        placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` :
        undefined;

      return {
        externalId: placeId,
        name: displayName,
        domain,
        websiteUrl: rawWebsite, // undefined if Google returns no websiteUri
        industry,
        description,
        headquarters: hq,
        employeeCount: undefined,
        headcountRange: undefined,
        companyType: undefined,
        yearFounded: undefined,
        technologies: [],
        keywords: Array.isArray(place.types) ? place.types.map(String).filter(Boolean) : [],
        emailsCount: undefined,
        phoneNumber,
        rating,
        userRatingCount,
        primaryType,
        source: "GOOGLE_PLACES",
        sourceUrl,
      };
    });

    return {
      businesses: normalizedBusinesses,
      totalMatches: normalizedBusinesses.length,
      isConfigured: true,
      providerName: this.name,
      providerId: this.id,
      message:
        normalizedBusinesses.length === 0
          ? "No businesses matched your Google Places discovery query."
          : undefined,
    };
  }

  /**
   * Executes a single HTTP request to the Google Places API (New) with timeout and retries.
   */
  private async executeSearchRequest(endpoint: string, body: Record<string, any>): Promise<any> {
    const maxRetries = 1; // Conservative retry to avoid quota consumption
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Fatal 4xx client errors (never retry)
        if (response.status >= 400 && response.status < 500) {
          let errDetail = `Google Places API request failed with status ${response.status}`;
          try {
            const errJson = await response.json();
            if (errJson?.error?.message) {
              errDetail = this.sanitizeMessage(errJson.error.message);
            }
          } catch {}

          if (response.status === 401 || response.status === 403) {
            const err = new Error(`Google Places access denied: ${errDetail}`);
            (err as any).isFatal = true;
            throw err;
          }
          if (response.status === 429) {
            const err = new Error("Google Places API rate limit exceeded or quota exhausted.");
            (err as any).isFatal = true;
            throw err;
          }
          const err = new Error(errDetail);
          (err as any).isFatal = true;
          throw err;
        }

        // 502, 503, 504 - transient server errors (retry with backoff)
        if (!response.ok) {
          if ([502, 503, 504].includes(response.status) && attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
            continue;
          }
          throw new Error(`Google Places returned unexpected HTTP status ${response.status}`);
        }

        let json: any;
        try {
          json = await response.json();
        } catch {
          throw new Error("Google Places returned a malformed response format.");
        }

        if (!json || typeof json !== "object") {
          throw new Error("Google Places returned an unexpected response structure.");
        }

        return json;
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
          lastError = new Error("Google Places request timed out after 8000ms");
        } else {
          lastError = err instanceof Error ? err : new Error(String(err));
        }

        // Non-retryable errors
        if (err?.isFatal) {
          throw lastError;
        }

        const errMsg = lastError.message.toLowerCase();
        if (
          errMsg.includes("authentication failed") ||
          errMsg.includes("access denied") ||
          errMsg.includes("rate limit") ||
          errMsg.includes("quota") ||
          errMsg.includes("invalid parameters")
        ) {
          throw lastError;
        }

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
          continue;
        }
      }
    }

    throw lastError || new Error("Google Places discovery request failed.");
  }

  /**
   * Strips any occurrences of the API key from error strings to prevent secret leakage.
   */
  private sanitizeMessage(msg: string): string {
    if (!this.apiKey || !msg) return msg;
    return msg.replaceAll(this.apiKey, "[REDACTED]");
  }

  async getHealth(): Promise<BusinessProviderHealth> {
    if (!this.isConfigured()) {
      return {
        status: "unconfigured",
        message: "Google Places API key is not configured.",
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: "ok",
      message: "Google Places (New) is configured and operational.",
      timestamp: new Date().toISOString(),
    };
  }
}
