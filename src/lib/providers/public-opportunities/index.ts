import { PublicOpportunityProvider } from "./types";
import { MockPublicOpportunityProvider } from "./mock";
import { HackerNewsPublicOpportunityProvider } from "./hacker-news";
import { RemoteOKPublicOpportunityProvider } from "./remote-ok";

export * from "./types";
export * from "./mock";
export * from "./hacker-news";
export * from "./remote-ok";

/**
 * Returns the requested Public Opportunity Provider instance based on explicit provider ID,
 * environment configuration, or safe development fallback.
 */
export function getPublicOpportunityProvider(providerId?: string): PublicOpportunityProvider {
  const normId = (providerId || "").toLowerCase().trim();

  if (
    normId === "mock" ||
    process.env.PUBLIC_OPPORTUNITY_PROVIDER === "mock" ||
    process.env.DISCOVERY_DEV_MODE === "true"
  ) {
    return new MockPublicOpportunityProvider();
  }

  if (normId === "hacker_news" || normId === "hn" || normId === "hacker-news") {
    return new HackerNewsPublicOpportunityProvider();
  }

  if (normId === "remote_ok" || normId === "remoteok" || normId === "remote-ok") {
    return new RemoteOKPublicOpportunityProvider();
  }

  // Auto provider selection logic:
  // If explicitly "auto" or undefined, return Hacker News by default in production, or Mock in dev if DISCOVERY_DEV_MODE !== "false"
  if (process.env.NODE_ENV !== "production" && process.env.PUBLIC_OPPORTUNITY_PROVIDER === "mock") {
    return new MockPublicOpportunityProvider();
  }

  return new HackerNewsPublicOpportunityProvider();
}
