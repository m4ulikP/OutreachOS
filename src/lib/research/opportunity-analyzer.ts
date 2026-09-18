import { StructuredEvidence } from "./evidence-extractor";

export type OpportunityConfidence = "high" | "medium" | "low";

export interface OpportunitySignal {
  category: string;
  issue: string;
  evidence: string;
  confidence: OpportunityConfidence;
  source: string;
  recommendation: string;
}

/**
 * Analyzes structured website evidence against the Web Development service profile
 * to identify objective, verifiable improvement opportunities.
 * Never invents issues or uses subjective aesthetic critique.
 */
export function analyzeWebDevelopmentOpportunities(
  evidence: StructuredEvidence
): OpportunitySignal[] {
  const opportunities: OpportunitySignal[] = [];
  const source = evidence.finalUrl || evidence.researchedUrl;

  // 1. Mobile Viewport & Responsiveness
  if (!evidence.technical.hasViewportMeta) {
    opportunities.push({
      category: "mobile_viewport",
      issue: "Missing mobile viewport meta tag",
      evidence: "No <meta name='viewport'> tag detected in the HTML document head.",
      confidence: "high",
      source,
      recommendation:
        "Implement a standard responsive viewport tag (<meta name='viewport' content='width=device-width, initial-scale=1'>) to ensure proper mobile rendering.",
    });
  } else if (!evidence.technical.isResponsive) {
    opportunities.push({
      category: "mobile_viewport",
      issue: "Non-standard viewport configuration",
      evidence: `Viewport tag found (${evidence.technical.viewportContent || "custom"}) but lacks standard device-width directives.`,
      confidence: "medium",
      source,
      recommendation:
        "Update viewport configuration to 'width=device-width, initial-scale=1' for optimal responsiveness across modern screens.",
    });
  }

  // 2. Transport Security (HTTPS)
  // Factually precise: only report if final loaded URL is genuinely insecure
  if (!evidence.technical.isFinalHttps) {
    opportunities.push({
      category: "transport_security",
      issue: "Insecure plain HTTP connection",
      evidence: `The final destination (${evidence.finalUrl}) loads over unencrypted HTTP without TLS.`,
      confidence: "high",
      source,
      recommendation:
        "Install an SSL/TLS certificate and enforce automatic 301 redirection from HTTP to HTTPS across all pages.",
    });
  }

  // 3. Search Engine Meta Description
  if (!evidence.identity.metaDescription || evidence.identity.metaDescription.trim().length === 0) {
    opportunities.push({
      category: "seo_meta",
      issue: "Missing search engine meta description",
      evidence: "Homepage head contains no <meta name='description'> tag.",
      confidence: "high",
      source,
      recommendation:
        "Add a 150-character meta description that clearly defines your services and location for Google search snippets.",
    });
  }

  // 4. Online Booking / Instant Scheduling Flow
  if (!evidence.business.hasOnlineBooking) {
    opportunities.push({
      category: "online_booking",
      issue: "No self-service consultation or appointment scheduler",
      evidence: "Website relies entirely on manual contact forms or phone calls without direct calendar booking.",
      confidence: "medium",
      source,
      recommendation:
        "Integrate an embedded meeting or consultation scheduler (e.g. Cal.com or Calendly) to remove friction for prospective clients.",
    });
  }

  // 5. Clear Call-to-Action (CTA)
  if (evidence.business.detectedCtas.length === 0) {
    opportunities.push({
      category: "call_to_action",
      issue: "No prominent call-to-action button detected",
      evidence: "Homepage lacks clearly labeled action buttons (e.g. 'Book Consultation', 'Get a Quote', 'Contact Us') above the fold.",
      confidence: "medium",
      source,
      recommendation:
        "Place a prominent, high-contrast primary CTA button in the header navigation and hero section.",
    });
  }

  // 6. Accessibility: Image Alt Text
  if (evidence.technical.accessibility.imagesWithoutAlt >= 3) {
    opportunities.push({
      category: "accessibility",
      issue: "Multiple images missing descriptive alt text",
      evidence: `Detected ${evidence.technical.accessibility.imagesWithoutAlt} out of ${evidence.technical.accessibility.totalImages} images lacking alt attributes.`,
      confidence: "medium",
      source,
      recommendation:
        "Add descriptive alt text to content images to improve accessibility for screen reader users and image SEO rankings.",
    });
  }

  // Bound array to max 6 opportunities
  return opportunities.slice(0, 6);
}

export { analyzeWebDevelopmentOpportunities as analyzeWebsiteOpportunities };
