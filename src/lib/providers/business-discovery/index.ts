import { BusinessDiscoveryProvider } from "./types";
import { MockBusinessDiscoveryProvider } from "./mock";
import { HunterDiscoverProvider, mapHeadcountToHunter } from "./hunter";

export * from "./types";
export * from "./mock";
export * from "./hunter";

/**
 * Returns the active Business Discovery Provider based on environment configuration.
 *
 * Selection Priority:
 * 1. Explicit mock request or dev simulation mode (DISCOVERY_DEV_MODE="true" or BUSINESS_DISCOVERY_PROVIDER="mock").
 * 2. If LEAD_SOURCE_API_KEY (or HUNTER_API_KEY) is configured, returns HunterDiscoverProvider.
 * 3. In development (non-production) when no key is set and DISCOVERY_DEV_MODE !== "false",
 *    returns MockBusinessDiscoveryProvider so developers have functional out-of-the-box discovery.
 * 4. Otherwise returns HunterDiscoverProvider in unconfigured state (isConfigured() === false).
 */
export function getBusinessDiscoveryProvider(providerId?: string): BusinessDiscoveryProvider {
  if (
    providerId === "mock" ||
    process.env.DISCOVERY_DEV_MODE === "true" ||
    process.env.BUSINESS_DISCOVERY_PROVIDER === "mock"
  ) {
    return new MockBusinessDiscoveryProvider();
  }

  const apiKey = (process.env.LEAD_SOURCE_API_KEY || process.env.HUNTER_API_KEY || "").trim();
  const baseUrl = process.env.HUNTER_BASE_URL || process.env.LEAD_SOURCE_PROVIDER_URL;

  if (apiKey.length > 0) {
    return new HunterDiscoverProvider(apiKey, baseUrl);
  }

  if (providerId === "hunter") {
    return new HunterDiscoverProvider("", baseUrl);
  }

  // Development fallback when key is not configured
  if (process.env.NODE_ENV !== "production" && process.env.DISCOVERY_DEV_MODE !== "false") {
    return new MockBusinessDiscoveryProvider();
  }

  return new HunterDiscoverProvider("", baseUrl);
}
