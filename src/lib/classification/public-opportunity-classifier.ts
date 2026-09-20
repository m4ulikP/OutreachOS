import { DiscoveredPublicOpportunity } from "../providers/public-opportunities/types";

export type PublicOpportunityIntent =
  | "WEBSITE_BUILD"
  | "WEBSITE_REDESIGN"
  | "ECOMMERCE_BUILD"
  | "LANDING_PAGE"
  | "WEB_APPLICATION"
  | "FRONTEND_DEVELOPMENT"
  | "FULL_STACK_DEVELOPMENT"
  | "WORDPRESS_CMS"
  | "GENERAL_DEVELOPER_REQUEST"
  | "INFORMATIONAL"
  | "UNRELATED";

export type PublicOpportunityDemandStrength =
  | "EXPLICIT"
  | "STRONG"
  | "POSSIBLE"
  | "WEAK"
  | "NONE";

export interface ClassificationResult {
  intent: PublicOpportunityIntent;
  demandStrength: PublicOpportunityDemandStrength;
  relevant: boolean;
  matchedSignals: string[];
  reason: string;
  requestedServices: string[];
  confidence: number;
}

// Intent rules regex patterns
const INTENT_PATTERNS: Array<{
  intent: PublicOpportunityIntent;
  defaultDemand: PublicOpportunityDemandStrength;
  patterns: RegExp[];
  services: string[];
}> = [
  {
    intent: "ECOMMERCE_BUILD",
    defaultDemand: "EXPLICIT",
    patterns: [
      /\b(ecommerce|e-commerce|shopify|woocommerce|online store|shopping cart)\b/i,
    ],
    services: ["Web Development", "Ecommerce Development", "Shopify / WooCommerce"],
  },
  {
    intent: "WEBSITE_REDESIGN",
    defaultDemand: "EXPLICIT",
    patterns: [
      /\b(redesign|revamp|rebuild|overhaul|update (our|my|the) site|redesigning)\b/i,
    ],
    services: ["Web Development", "UI/UX Redesign", "Website Modernization"],
  },
  {
    intent: "LANDING_PAGE",
    defaultDemand: "EXPLICIT",
    patterns: [
      /\b(landing page|sales page|lead capture page|squeeze page)\b/i,
    ],
    services: ["Landing Page Development", "UI/UX Design", "Conversion Optimization"],
  },
  {
    intent: "WORDPRESS_CMS",
    defaultDemand: "EXPLICIT",
    patterns: [
      /\b(wordpress|webflow|squarespace|cms site|elementor)\b/i,
    ],
    services: ["WordPress Development", "CMS Setup & Customization"],
  },
  {
    intent: "WEBSITE_BUILD",
    defaultDemand: "EXPLICIT",
    patterns: [
      /\b(build (a|our|my) website|website from scratch|company website|business website|need a website|new website)\b/i,
    ],
    services: ["Custom Web Development", "UI/UX Design", "SEO Setup"],
  },
  {
    intent: "WEB_APPLICATION",
    defaultDemand: "STRONG",
    patterns: [
      /\b(web app|web application|saas dashboard|customer portal|client portal|admin dashboard|dashboard)\b/i,
    ],
    services: ["Web Application Development", "Full Stack Development", "API Integration"],
  },
  {
    intent: "FRONTEND_DEVELOPMENT",
    defaultDemand: "STRONG",
    patterns: [
      /\b(frontend developer|front-end developer|react developer|vue developer|next\.js developer|tailwind)\b/i,
    ],
    services: ["Frontend Development", "React / Next.js", "UI Implementation"],
  },
  {
    intent: "FULL_STACK_DEVELOPMENT",
    defaultDemand: "STRONG",
    patterns: [
      /\b(full-stack developer|fullstack developer|full stack developer|node \+ react)\b/i,
    ],
    services: ["Full Stack Development", "Node.js & React", "Database & Backend"],
  },
  {
    intent: "GENERAL_DEVELOPER_REQUEST",
    defaultDemand: "POSSIBLE",
    patterns: [
      /\b(looking for (a|any) developer|need a developer|hire a developer|web dev needed|freelance web developer|looking for a freelancer)\b/i,
    ],
    services: ["Web Development", "Freelance Developer Services"],
  },
];

const DEMAND_VERBS = [
  "looking for",
  "need",
  "hiring",
  "hire",
  "seeking",
  "wanted",
  "help us build",
  "looking to get built",
  "looking to hire",
  "job",
];

const INFORMATIONAL_TRIGGERS = [
  /\bhow (do|can|to) (i|we|you)\b/i,
  /\bhow to build\b/i,
  /\bwhat is the best\b/i,
  /\bhow does\b/i,
  /\blearning\b/i,
  /\btutorial\b/i,
  /\bshow hn:\b/i,
  /\bshowcase\b/i,
];

/**
 * Classifies a discovered public post/opportunity using a deterministic rule engine.
 */
export function classifyPublicOpportunity(
  opportunity: DiscoveredPublicOpportunity
): ClassificationResult {
  const title = (opportunity.title || "").trim();
  const description = (opportunity.description || "").trim();
  const fullText = `${title}\n${description}`;
  const tags = (opportunity.tags || []).join(" ");

  const matchedSignals: string[] = [];

  // Check for informational triggers first
  const isInformationalTrigger = INFORMATIONAL_TRIGGERS.some((re) => {
    if (re.test(title)) {
      matchedSignals.push(`Informational pattern in title: ${re.source}`);
      return true;
    }
    return false;
  });

  // Check for active demand verbs
  const hasDemandVerb = DEMAND_VERBS.some((verb) => {
    if (fullText.toLowerCase().includes(verb)) {
      matchedSignals.push(`Demand trigger phrase: "${verb}"`);
      return true;
    }
    return false;
  });

  // If title explicitly indicates informational query (e.g. "How do I center a div?") with no demand verb
  if (isInformationalTrigger && !hasDemandVerb) {
    return {
      intent: "INFORMATIONAL",
      demandStrength: "WEAK",
      relevant: false,
      matchedSignals,
      reason: "Post is an informational or learning query rather than a service request",
      requestedServices: [],
      confidence: 0.85,
    };
  }

  // Iterate over intent patterns to find highest priority match
  for (const item of INTENT_PATTERNS) {
    for (const pattern of item.patterns) {
      if (pattern.test(title) || pattern.test(description) || pattern.test(tags)) {
        matchedSignals.push(`Pattern match: ${item.intent}`);

        let demandStrength: PublicOpportunityDemandStrength = item.defaultDemand;

        // Upgrade/Downgrade demand strength based on contextual verbs
        if (!hasDemandVerb && demandStrength === "EXPLICIT") {
          demandStrength = "STRONG";
        }

        return {
          intent: item.intent,
          demandStrength,
          relevant: true,
          matchedSignals,
          reason: `Matched active project intent pattern for ${item.intent.replace(/_/g, " ")}`,
          requestedServices: item.services,
          confidence: hasDemandVerb ? 0.9 : 0.75,
        };
      }
    }
  }

  // If demand verb is present but no specific category matched
  if (hasDemandVerb) {
    return {
      intent: "GENERAL_DEVELOPER_REQUEST",
      demandStrength: "POSSIBLE",
      relevant: true,
      matchedSignals,
      reason: "General developer demand request detected",
      requestedServices: ["Web Development Services"],
      confidence: 0.65,
    };
  }

  // Unrelated post fallback
  return {
    intent: "UNRELATED",
    demandStrength: "NONE",
    relevant: false,
    matchedSignals: [],
    reason: "No web development demand signals or keywords detected",
    requestedServices: [],
    confidence: 0.9,
  };
}
