import { ServiceProfile, DEFAULT_SERVICE_PROFILE_ID } from "./types";

export * from "./types";

export const WEB_DEVELOPMENT_PROFILE: ServiceProfile = {
  id: DEFAULT_SERVICE_PROFILE_ID,
  name: "Web Development",
  shortDescription: "Custom responsive websites, performance optimization, and conversion flow modernization.",
  focusAreas: [
    "Mobile viewport & responsive design",
    "Conversion optimization & booking CTAs",
    "SEO metadata & page discoverability",
    "Security & HTTPS transport",
    "Web accessibility (a11y)",
    "Modern tech stack & clean semantic markup",
  ],
  opportunityCategories: [
    "mobile_viewport",
    "seo_meta",
    "call_to_action",
    "transport_security",
    "online_booking",
    "accessibility",
  ],
  systemInstructionContext: `You are reaching out on behalf of Maulik, an elite freelance web developer.
Your value proposition is helping businesses turn their website into a high-converting client acquisition asset.
Focus strictly on objective, evidence-based website gaps:
- Missing/weak mobile viewport and responsiveness
- Missing SEO meta tags or broken information hierarchy
- Lacking clear booking/consultation CTAs or friction in client conversion
- Insecure connections or missing HTTPS
- Basic accessibility signals
Keep messages concise, respectful, peer-to-peer, and evidence-driven without superficial flattery or invented claims.`,
};

const PROFILES: Record<string, ServiceProfile> = {
  [DEFAULT_SERVICE_PROFILE_ID]: WEB_DEVELOPMENT_PROFILE,
};

/**
 * Returns the requested service profile, defaulting to Web Development if omitted or unknown.
 */
export function getServiceProfile(id?: string): ServiceProfile {
  if (!id) return WEB_DEVELOPMENT_PROFILE;
  const normalizedId = id.replace(/-/g, "_");
  return PROFILES[normalizedId] || WEB_DEVELOPMENT_PROFILE;
}

/**
 * Returns all available service profiles (extensible for future profiles).
 */
export function getAllServiceProfiles(): ServiceProfile[] {
  return Object.values(PROFILES);
}

export const listServiceProfiles = getAllServiceProfiles;

