import { BusinessDiscoveryProvider } from "./types";
import { MockBusinessDiscoveryProvider } from "./mock";
import { HunterDiscoverProvider } from "./hunter";
import { GooglePlacesProvider } from "./google-places";

export * from "./types";
export * from "./mock";
export * from "./hunter";
export * from "./google-places";

/**
 * Returns the active Business Discovery Provider based on environment configuration or explicit selection.
 *
 * Selection Priority:
 * 1. Explicit mock request or dev simulation mode (DISCOVERY_DEV_MODE="true" or BUSINESS_DISCOVERY_PROVIDER="mock").
 * 2. Explicit provider selection:
 *    - "google-places" | "google" -> GooglePlacesProvider
 *    - "hunter" | "hunter-discover" -> HunterDiscoverProvider
 * 3. Environment configuration override (BUSINESS_DISCOVERY_PROVIDER="google-places" | "hunter").
 * 4. Configured API keys:
 *    - If Hunter key configured -> HunterDiscoverProvider
 *    - If Google Places key configured -> GooglePlacesProvider
 * 5. In development (non-production) when no key is set and DISCOVERY_DEV_MODE !== "false" -> MockBusinessDiscoveryProvider
 * 6. Default unconfigured HunterDiscoverProvider.
 */
export function getBusinessDiscoveryProvider(providerId?: string): BusinessDiscoveryProvider {
  if (
    providerId === "mock" ||
    process.env.DISCOVERY_DEV_MODE === "true" ||
    process.env.BUSINESS_DISCOVERY_PROVIDER === "mock"
  ) {
    return new MockBusinessDiscoveryProvider();
  }

  // Explicit provider ID request
  if (providerId === "google-places" || providerId === "google") {
    return new GooglePlacesProvider();
  }

  if (providerId === "hunter" || providerId === "hunter-discover") {
    const apiKey = (process.env.LEAD_SOURCE_API_KEY || process.env.HUNTER_API_KEY || "").trim();
    const baseUrl = process.env.HUNTER_BASE_URL || process.env.LEAD_SOURCE_PROVIDER_URL;
    return new HunterDiscoverProvider(apiKey, baseUrl);
  }

  // Environment override
  if (process.env.BUSINESS_DISCOVERY_PROVIDER === "google-places") {
    return new GooglePlacesProvider();
  }

  const hunterKey = (process.env.LEAD_SOURCE_API_KEY || process.env.HUNTER_API_KEY || "").trim();
  const hunterBaseUrl = process.env.HUNTER_BASE_URL || process.env.LEAD_SOURCE_PROVIDER_URL;

  if (hunterKey.length > 0) {
    return new HunterDiscoverProvider(hunterKey, hunterBaseUrl);
  }

  const googleKey = (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "").trim();
  if (googleKey.length > 0) {
    return new GooglePlacesProvider(googleKey);
  }

  // Development fallback when key is not configured
  if (process.env.NODE_ENV !== "production" && process.env.DISCOVERY_DEV_MODE !== "false") {
    return new MockBusinessDiscoveryProvider();
  }

  return new HunterDiscoverProvider("", hunterBaseUrl);
}
