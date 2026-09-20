import {
  PublicOpportunityProvider,
  PublicOpportunityCriteria,
  PublicOpportunitySearchResult,
  DiscoveredPublicOpportunity,
} from "./types";

export const MOCK_PUBLIC_OPPORTUNITIES: DiscoveredPublicOpportunity[] = [
  {
    externalId: "hn_mock_101",
    source: "HACKER_NEWS",
    sourceUrl: "https://news.ycombinator.com/item?id=39000101",
    title: "Ask HN: Looking for someone to build a website for our boutique agency",
    description:
      "We are a boutique advisory firm in Boston looking to hire a freelance web developer to build our official company website from scratch. Must be modern, responsive, and SEO optimized.",
    authorName: "johndoe_founder",
    authorProfileUrl: "https://news.ycombinator.com/user?id=johndoe_founder",
    publishedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    sourceName: "Hacker News",
    sourceCommunity: "Ask HN",
    budget: 5000,
    currency: "USD",
    location: { city: "Boston", state: "MA", country: "USA" },
    tags: ["ask_hn", "web", "freelance"],
    rawMetadata: { mockType: "WEBSITE_BUILD" },
  },
  {
    externalId: "hn_mock_102",
    source: "HACKER_NEWS",
    sourceUrl: "https://news.ycombinator.com/item?id=39000102",
    title: "Ask HN: Looking to redesign our existing WordPress website",
    description:
      "Our current site is outdated and slow. We need a complete website redesign with a fresh modern UI, mobile responsiveness, and faster load speed.",
    authorName: "sarah_tech",
    authorProfileUrl: "https://news.ycombinator.com/user?id=sarah_tech",
    publishedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    sourceName: "Hacker News",
    sourceCommunity: "Ask HN",
    budget: 4000,
    currency: "USD",
    location: { city: "Austin", state: "TX", country: "USA" },
    tags: ["ask_hn", "redesign", "wordpress"],
    rawMetadata: { mockType: "WEBSITE_REDESIGN" },
  },
  {
    externalId: "remote_ok_mock_201",
    source: "REMOTE_OK",
    sourceUrl: "https://remoteok.com/l/201",
    title: "Ecommerce Web Developer needed for Shopify / Next.js Storefront",
    description:
      "Looking for an experienced ecommerce web developer to build a custom storefront integrated with Shopify Plus API. Urgent requirement, start immediately.",
    companyName: "Artisan Brands Co.",
    publishedAt: new Date(Date.now() - 3600000 * 36).toISOString(),
    sourceName: "Remote OK",
    sourceCommunity: "Remote OK Jobs",
    budget: 120000,
    currency: "USD",
    location: { country: "Remote" },
    tags: ["ecommerce", "shopify", "nextjs", "react"],
    rawMetadata: { mockType: "ECOMMERCE_BUILD" },
  },
  {
    externalId: "hn_mock_103",
    source: "HACKER_NEWS",
    sourceUrl: "https://news.ycombinator.com/item?id=39000103",
    title: "Need a landing page developer for upcoming product launch",
    description:
      "Launching a B2B AI product next month. Need a high-converting landing page built in Next.js + Tailwind CSS with lead capture integration.",
    authorName: "alex_builder",
    authorProfileUrl: "https://news.ycombinator.com/user?id=alex_builder",
    publishedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    sourceName: "Hacker News",
    sourceCommunity: "Ask HN",
    budget: 2500,
    currency: "USD",
    location: { country: "Remote" },
    tags: ["landing-page", "react", "tailwind"],
    rawMetadata: { mockType: "LANDING_PAGE" },
  },
  {
    externalId: "remote_ok_mock_202",
    source: "REMOTE_OK",
    sourceUrl: "https://remoteok.com/l/202",
    title: "Frontend React Developer for SaaS Analytics Dashboard",
    description:
      "We are looking for a skilled Frontend React/TypeScript developer to build dynamic charts and data tables for our SaaS web application dashboard.",
    companyName: "Metrics Cloud Inc",
    publishedAt: new Date(Date.now() - 3600000 * 60).toISOString(),
    sourceName: "Remote OK",
    sourceCommunity: "Remote OK Jobs",
    budget: 95000,
    currency: "USD",
    location: { country: "Remote" },
    tags: ["react", "frontend", "typescript", "saas"],
    rawMetadata: { mockType: "WEB_APPLICATION" },
  },
  {
    externalId: "hn_mock_104",
    source: "HACKER_NEWS",
    sourceUrl: "https://news.ycombinator.com/item?id=39000104",
    title: "Looking for a full-stack web developer for customer portal",
    description:
      "We need a full-stack developer (Node.js + React + Postgres) to develop a portal where clients can view their project milestones and invoices.",
    authorName: "michael_cto",
    authorProfileUrl: "https://news.ycombinator.com/user?id=michael_cto",
    publishedAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    sourceName: "Hacker News",
    sourceCommunity: "Ask HN",
    budget: 8000,
    currency: "USD",
    location: { country: "Remote" },
    tags: ["fullstack", "react", "node"],
    rawMetadata: { mockType: "FULL_STACK_DEVELOPMENT" },
  },
  {
    externalId: "hn_mock_105",
    source: "HACKER_NEWS",
    sourceUrl: "https://news.ycombinator.com/item?id=39000105",
    title: "Anyone know a good freelance web developer?",
    description:
      "Our company is seeking recommendations for a reliable freelance web developer to help us with web maintenance and ongoing development work.",
    authorName: "community_member",
    authorProfileUrl: "https://news.ycombinator.com/user?id=community_member",
    publishedAt: new Date(Date.now() - 3600000 * 80).toISOString(),
    sourceName: "Hacker News",
    sourceCommunity: "Ask HN",
    tags: ["freelance", "developer"],
    rawMetadata: { mockType: "GENERAL_DEVELOPER_REQUEST" },
  },
  {
    externalId: "hn_mock_106",
    source: "HACKER_NEWS",
    sourceUrl: "https://news.ycombinator.com/item?id=39000106",
    title: "Ask HN: How do I center a div in modern Tailwind CSS?",
    description:
      "I am trying to learn web development. What is the best way to center a div horizontally and vertically using flexbox vs grid in Tailwind?",
    authorName: "junior_learner",
    authorProfileUrl: "https://news.ycombinator.com/user?id=junior_learner",
    publishedAt: new Date(Date.now() - 3600000 * 90).toISOString(),
    sourceName: "Hacker News",
    sourceCommunity: "Ask HN",
    tags: ["learning", "css"],
    rawMetadata: { mockType: "INFORMATIONAL" },
  },
  {
    externalId: "hn_mock_107",
    source: "HACKER_NEWS",
    sourceUrl: "https://news.ycombinator.com/item?id=39000107",
    title: "Show HN: A new CLI tool for automated Postgres database backups",
    description:
      "I built a lightweight Go utility that handles automated encrypted backups to S3 storage with zero external dependencies.",
    authorName: "gopher_dev",
    authorProfileUrl: "https://news.ycombinator.com/user?id=gopher_dev",
    publishedAt: new Date(Date.now() - 3600000 * 96).toISOString(),
    sourceName: "Hacker News",
    sourceCommunity: "Show HN",
    tags: ["show_hn", "postgres", "go"],
    rawMetadata: { mockType: "UNRELATED" },
  },
];

export class MockPublicOpportunityProvider implements PublicOpportunityProvider {
  readonly id = "mock";
  readonly name = "Mock Simulation Provider";

  isConfigured(): boolean {
    return true;
  }

  async discover(criteria: PublicOpportunityCriteria): Promise<PublicOpportunitySearchResult> {
    const query = (criteria.query || "").toLowerCase().trim();
    const limit = Math.min(Math.max(criteria.limit || 20, 1), 50);

    let filtered = MOCK_PUBLIC_OPPORTUNITIES;

    if (query) {
      filtered = filtered.filter((op) => {
        const titleMatch = op.title.toLowerCase().includes(query);
        const descMatch = (op.description || "").toLowerCase().includes(query);
        const tagMatch = (op.tags || []).some((t) => t.toLowerCase().includes(query));
        return titleMatch || descMatch || tagMatch;
      });
    }

    const bounded = filtered.slice(0, limit);

    return {
      opportunities: bounded,
      totalMatches: filtered.length,
      isConfigured: true,
      isDevelopmentMock: true,
      providerName: this.name,
      providerId: this.id,
    };
  }
}
