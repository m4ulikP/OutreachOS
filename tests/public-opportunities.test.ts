import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { OpportunitySource, OpportunityStage, OpportunityType } from "@prisma/client";
import {
  HackerNewsPublicOpportunityProvider,
  RemoteOKPublicOpportunityProvider,
  MockPublicOpportunityProvider,
  getPublicOpportunityProvider,
} from "../src/lib/providers/public-opportunities";
import {
  classifyPublicOpportunity,
} from "../src/lib/classification/public-opportunity-classifier";
import {
  qualifyPublicOpportunityWithAI,
  publicOpportunityQualificationSchema,
} from "../src/lib/services/public-opportunity-qualification-service";
import {
  persistPublicOpportunities,
  generateOpportunityFingerprint,
} from "../src/lib/services/public-opportunity-persistence-service";
import { publicOpportunityDiscoverySchema } from "../src/lib/validation/public-opportunity-discovery";
import { POST as publicDiscoveryRoute } from "../src/app/api/opportunities/discover/public/route";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";

const TEST_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "outreachos_dev_secret_key_change_in_production_32chars";
const TENANT_A_USER = "usr_pub_opp_tenant_a";
const TENANT_B_USER = "usr_pub_opp_tenant_b";

let authCookieA: string;
let authCookieB: string;

async function createAuthCookie(id: string, email: string, name: string): Promise<string> {
  const token = await encode({
    token: { id, email, name },
    secret: TEST_SECRET,
  });
  return `next-auth.session-token=${token}`;
}

describe("Public Opportunities Client Acquisition Channel Test Suite", () => {
  before(async () => {
    // Ensure test user records exist in DB for foreign key constraints
    await prisma.user.upsert({
      where: { id: TENANT_A_USER },
      update: {},
      create: { id: TENANT_A_USER, email: "tenant_a@pubopp.test", name: "PubOpp Tenant A" },
    });
    await prisma.user.upsert({
      where: { id: TENANT_B_USER },
      update: {},
      create: { id: TENANT_B_USER, email: "tenant_b@pubopp.test", name: "PubOpp Tenant B" },
    });

    authCookieA = await createAuthCookie(TENANT_A_USER, "tenant_a@pubopp.test", "PubOpp Tenant A");
    authCookieB = await createAuthCookie(TENANT_B_USER, "tenant_b@pubopp.test", "PubOpp Tenant B");

    // Clean up prior test residues
    await prisma.opportunity.deleteMany({
      where: { userId: { in: [TENANT_A_USER, TENANT_B_USER] } },
    });
  });

  after(async () => {
    await prisma.opportunity.deleteMany({
      where: { userId: { in: [TENANT_A_USER, TENANT_B_USER] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TENANT_A_USER, TENANT_B_USER] } },
    });
  });

  // ----------------------------------------------------------------
  // 1. PROVIDER TESTS
  // ----------------------------------------------------------------
  describe("Provider Layer Tests", () => {
    it("1. Mock provider returns deterministic normalized items", async () => {
      const provider = new MockPublicOpportunityProvider();
      const res = await provider.discover({ query: "website", limit: 5 });

      assert.equal(res.isConfigured, true);
      assert.equal(res.isDevelopmentMock, true);
      assert.ok(res.opportunities.length > 0);
      assert.ok(res.opportunities.length <= 5);

      const first = res.opportunities[0];
      assert.ok(first.title);
      assert.ok(first.sourceUrl.startsWith("http"));
      assert.ok(first.source);
    });

    it("2. Provider factory resolves requested providers correctly", () => {
      const mock = getPublicOpportunityProvider("mock");
      assert.equal(mock.id, "mock");

      const hn = getPublicOpportunityProvider("hacker_news");
      assert.equal(hn.id, "hacker_news");

      const remoteok = getPublicOpportunityProvider("remote_ok");
      assert.equal(remoteok.id, "remote_ok");
    });

    it("3. Hacker News provider normalizes Algolia payload and bounds search limit", async () => {
      const hn = new HackerNewsPublicOpportunityProvider();
      const res = await hn.discover({ query: "web developer", limit: 5, days: 30 });

      assert.equal(res.providerId, "hacker_news");
      assert.equal(res.isConfigured, true);
      assert.ok(res.opportunities.length <= 5);

      if (res.opportunities.length > 0) {
        const item = res.opportunities[0];
        assert.equal(item.source, "HACKER_NEWS");
        assert.ok(item.sourceUrl.includes("news.ycombinator.com/item?id="));
      }
    });

    it("4. Remote OK provider filters web development opportunities", async () => {
      const remoteok = new RemoteOKPublicOpportunityProvider();
      const res = await remoteok.discover({ query: "web", limit: 5 });

      assert.equal(res.providerId, "remote_ok");
      assert.equal(res.isConfigured, true);
      assert.ok(res.opportunities.length <= 5);

      if (res.opportunities.length > 0) {
        const item = res.opportunities[0];
        assert.equal(item.source, "REMOTE_OK");
        assert.ok(item.sourceUrl.toLowerCase().includes("remoteok"));
      }
    });
  });

  // ----------------------------------------------------------------
  // 2. DETERMINISTIC CLASSIFIER TESTS
  // ----------------------------------------------------------------
  describe("Deterministic Classifier Tests", () => {
    it("5. Classifies explicit website build request", () => {
      const res = classifyPublicOpportunity({
        source: "HACKER_NEWS",
        sourceUrl: "https://news.ycombinator.com/item?id=1",
        title: "Looking for someone to build a website for our agency",
        description: "We need a custom company website built from scratch.",
      });

      assert.equal(res.intent, "WEBSITE_BUILD");
      assert.equal(res.demandStrength, "EXPLICIT");
      assert.equal(res.relevant, true);
      assert.ok(res.requestedServices.includes("Custom Web Development"));
    });

    it("6. Classifies website redesign request", () => {
      const res = classifyPublicOpportunity({
        source: "HACKER_NEWS",
        sourceUrl: "https://news.ycombinator.com/item?id=2",
        title: "Need a web developer to redesign our website",
        description: "Looking to overhaul and redesign our existing corporate site.",
      });

      assert.equal(res.intent, "WEBSITE_REDESIGN");
      assert.equal(res.demandStrength, "EXPLICIT");
      assert.equal(res.relevant, true);
    });

    it("7. Classifies ecommerce build request", () => {
      const res = classifyPublicOpportunity({
        source: "REMOTE_OK",
        sourceUrl: "https://remoteok.com/l/3",
        title: "Need an ecommerce website built on Shopify",
        description: "Looking for a developer to set up our online store.",
      });

      assert.equal(res.intent, "ECOMMERCE_BUILD");
      assert.equal(res.demandStrength, "EXPLICIT");
      assert.equal(res.relevant, true);
    });

    it("8. Classifies landing page request", () => {
      const res = classifyPublicOpportunity({
        source: "HACKER_NEWS",
        sourceUrl: "https://news.ycombinator.com/item?id=4",
        title: "Need a landing page developer for upcoming launch",
      });

      assert.equal(res.intent, "LANDING_PAGE");
      assert.equal(res.demandStrength, "EXPLICIT");
      assert.equal(res.relevant, true);
    });

    it("9. Classifies web application request", () => {
      const res = classifyPublicOpportunity({
        source: "REMOTE_OK",
        sourceUrl: "https://remoteok.com/l/5",
        title: "Looking for a React developer to build SaaS analytics dashboard",
      });

      assert.equal(res.intent, "WEB_APPLICATION");
      assert.equal(res.relevant, true);
    });

    it("10. Rejects informational query (How do I center a div?)", () => {
      const res = classifyPublicOpportunity({
        source: "HACKER_NEWS",
        sourceUrl: "https://news.ycombinator.com/item?id=6",
        title: "Ask HN: How do I center a div in Tailwind CSS?",
        description: "I am trying to learn CSS. What is the best way?",
      });

      assert.equal(res.intent, "INFORMATIONAL");
      assert.equal(res.demandStrength, "WEAK");
      assert.equal(res.relevant, false);
    });

    it("11. Rejects completely unrelated post", () => {
      const res = classifyPublicOpportunity({
        source: "HACKER_NEWS",
        sourceUrl: "https://news.ycombinator.com/item?id=7",
        title: "Show HN: Automated CLI tool for Postgres backups",
        description: "A lightweight Go utility for DB backups.",
      });

      assert.equal(res.intent, "UNRELATED");
      assert.equal(res.relevant, false);
    });
  });

  // ----------------------------------------------------------------
  // 3. AI QUALIFICATION TESTS
  // ----------------------------------------------------------------
  describe("AI Qualification Tests", () => {
    it("12. Validates AI qualification response schema", () => {
      const mockAiOutput = {
        relevant: true,
        intent: "WEBSITE_BUILD",
        demandStrength: "EXPLICIT",
        reason: "Author explicitly asks for a web developer to build a company website.",
        requestedServices: ["Web Development", "UI/UX Design"],
        budgetMentioned: "$5,000 USD",
        urgency: "high",
        businessContext: "Boutique advisory firm",
        confidence: 0.95,
      };

      const parsed = publicOpportunityQualificationSchema.parse(mockAiOutput);
      assert.equal(parsed.relevant, true);
      assert.equal(parsed.intent, "WEBSITE_BUILD");
    });

    it("13. AI qualification falls back gracefully when API key is missing", async () => {
      const initial = classifyPublicOpportunity({
        source: "HACKER_NEWS",
        sourceUrl: "https://news.ycombinator.com/item?id=8",
        title: "Looking for a web developer",
      });

      const qual = await qualifyPublicOpportunityWithAI(
        {
          source: "HACKER_NEWS",
          sourceUrl: "https://news.ycombinator.com/item?id=8",
          title: "Looking for a web developer",
        },
        initial
      );

      assert.equal(qual.relevant, initial.relevant);
      assert.equal(qual.intent, initial.intent);
    });
  });

  // ----------------------------------------------------------------
  // 4. PERSISTENCE & DEDUPLICATION TESTS
  // ----------------------------------------------------------------
  describe("Persistence & Multi-Tenant Deduplication Tests", () => {
    it("14. Persists public opportunity: source = PUBLIC_FEED, companyId = null, leadId = null", async () => {
      const item = {
        externalId: "test_hn_1001",
        source: "HACKER_NEWS" as const,
        sourceUrl: "https://news.ycombinator.com/item?id=1001",
        title: "Looking for someone to build a website for our clinic",
        description: "Need a modern web developer to create a responsive site.",
        budget: 3500,
        currency: "USD",
        publishedAt: new Date().toISOString(),
      };

      const classification = classifyPublicOpportunity(item);

      const result = await persistPublicOpportunities(TENANT_A_USER, [
        { opportunity: item, classification },
      ]);

      assert.equal(result.persistedCount, 1);
      assert.equal(result.created, 1);

      // Verify DB record
      const dbOpp = await prisma.opportunity.findFirst({
        where: { userId: TENANT_A_USER, sourceUrl: item.sourceUrl },
      });

      assert.ok(dbOpp);
      assert.equal(dbOpp.source, OpportunitySource.PUBLIC_FEED);
      assert.equal(dbOpp.companyId, null); // HARD BOUNDARY: Zero company created
      assert.equal(dbOpp.leadId, null); // HARD BOUNDARY: Zero lead created
      assert.equal(dbOpp.stage, OpportunityStage.QUALIFIED);

      // Verify ZERO Leads or Companies created
      const leadCount = await prisma.lead.count({ where: { userId: TENANT_A_USER } });
      const companyCount = await prisma.company.count({ where: { userId: TENANT_A_USER } });
      assert.equal(leadCount, 0);
      assert.equal(companyCount, 0);
    });

    it("15. Idempotent deduplication: running second persistence update does not create duplicate opportunity", async () => {
      const item = {
        externalId: "test_hn_1001",
        source: "HACKER_NEWS" as const,
        sourceUrl: "https://news.ycombinator.com/item?id=1001",
        title: "Looking for someone to build a website for our clinic",
        description: "Need a modern web developer to create a responsive site.",
        budget: 3500,
        currency: "USD",
      };

      const classification = classifyPublicOpportunity(item);

      const result = await persistPublicOpportunities(TENANT_A_USER, [
        { opportunity: item, classification },
      ]);

      assert.equal(result.created, 0);
      assert.equal(result.matched, 1);

      const totalOpps = await prisma.opportunity.count({
        where: { userId: TENANT_A_USER, sourceUrl: item.sourceUrl },
      });
      assert.equal(totalOpps, 1);
    });

    it("16. Preserves existing stage when opportunity is already advanced (e.g. PITCH_DRAFTED)", async () => {
      const item = {
        externalId: "test_hn_1002",
        source: "HACKER_NEWS" as const,
        sourceUrl: "https://news.ycombinator.com/item?id=1002",
        title: "Need a React developer for SaaS portal",
      };

      const classification = classifyPublicOpportunity(item);

      // First create opportunity
      const firstRes = await persistPublicOpportunities(TENANT_A_USER, [
        { opportunity: item, classification },
      ]);
      const oppId = firstRes.opportunities[0].id;

      // Manually advance stage to PITCH_DRAFTED
      await prisma.opportunity.update({
        where: { id: oppId },
        data: { stage: OpportunityStage.PITCH_DRAFTED },
      });

      // Second persistence run
      await persistPublicOpportunities(TENANT_A_USER, [
        { opportunity: item, classification },
      ]);

      const updated = await prisma.opportunity.findUnique({ where: { id: oppId } });
      assert.equal(updated?.stage, OpportunityStage.PITCH_DRAFTED);
    });

    it("17. Multi-tenant isolation: Tenant B cannot see or overwrite Tenant A opportunity", async () => {
      const item = {
        externalId: "test_hn_1003",
        source: "HACKER_NEWS" as const,
        sourceUrl: "https://news.ycombinator.com/item?id=1003",
        title: "Shared source URL item",
      };

      const classification = classifyPublicOpportunity(item);

      await persistPublicOpportunities(TENANT_A_USER, [{ opportunity: item, classification }]);
      await persistPublicOpportunities(TENANT_B_USER, [{ opportunity: item, classification }]);

      const countA = await prisma.opportunity.count({ where: { userId: TENANT_A_USER } });
      const countB = await prisma.opportunity.count({ where: { userId: TENANT_B_USER } });

      assert.equal(countA, 3);
      assert.equal(countB, 1);
    });
  });

  // ----------------------------------------------------------------
  // 5. ZOD VALIDATION & API ROUTE TESTS
  // ----------------------------------------------------------------
  describe("Zod Validation & API Route Regressions", () => {
    it("18. Zod validation enforces limit <= 50 and days <= 30", () => {
      const invalidLimit = publicOpportunityDiscoverySchema.safeParse({ limit: 100 });
      assert.equal(invalidLimit.success, false);

      const invalidDays = publicOpportunityDiscoverySchema.safeParse({ days: 60 });
      assert.equal(invalidDays.success, false);

      const valid = publicOpportunityDiscoverySchema.safeParse({ limit: 20, days: 14 });
      assert.equal(valid.success, true);
    });

    it("19. Strict Zod mode blocks forbidden mass assignment fields (such as userId)", () => {
      const res = publicOpportunityDiscoverySchema.safeParse({
        provider: "mock",
        userId: "hacked_user_id",
      });
      assert.equal(res.success, false);
    });

    it("20. API Route: Unauthenticated request is rejected (401)", async () => {
      const req = new NextRequest("http://localhost:3000/api/opportunities/discover/public", {
        method: "POST",
        body: JSON.stringify({ provider: "mock", query: "website" }),
      });

      const res = await publicDiscoveryRoute(req, { params: {} });
      assert.equal(res.status, 401);
    });

    it("21. API Route: Authenticated discovery with mock provider returns normalized opportunities", async () => {
      const req = new NextRequest("http://localhost:3000/api/opportunities/discover/public", {
        method: "POST",
        headers: {
          cookie: authCookieA,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          provider: "mock",
          query: "website",
          days: 14,
          limit: 5,
          qualify: false,
          persist: false,
        }),
      });

      const res = await publicDiscoveryRoute(req, { params: {} });
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.isConfigured, true);
      assert.ok(Array.isArray(json.opportunities));
      assert.equal(json.persisted, null);
    });

    it("22. API Route: Authenticated discovery with persist=true creates DB opportunities with zero Leads", async () => {
      const req = new NextRequest("http://localhost:3000/api/opportunities/discover/public", {
        method: "POST",
        headers: {
          cookie: authCookieA,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          provider: "mock",
          query: "website",
          days: 14,
          limit: 3,
          qualify: false,
          persist: true,
        }),
      });

      const res = await publicDiscoveryRoute(req, { params: {} });
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.ok(json.persisted);
      assert.ok(json.persisted.persistedCount > 0);

      // Verify zero leads were created
      const leadCount = await prisma.lead.count({ where: { userId: TENANT_A_USER } });
      assert.equal(leadCount, 0);
    });
  });
});
