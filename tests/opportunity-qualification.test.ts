import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/db";
import {
  OpportunityType,
  OpportunityStage,
  OpportunitySource,
  Prisma,
} from "@prisma/client";
import {
  determineWebsitePresence,
  qualifyCompanyOpportunity,
  mapSignalsToRequestedServices,
  mapToOpportunitySource,
} from "../src/lib/services/opportunity-qualification-service";
import { qualifyCompanySchema } from "../src/lib/validation/opportunity-qualification";
import { POST as qualifyRoute } from "../src/app/api/opportunities/qualify/route";
import {
  analyzeWebDevelopmentOpportunities,
  extractStructuredEvidence,
  boundStructuredEvidence,
  OpportunitySignal,
  WebsiteResearchProvider,
} from "../src/lib/research";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long-for-jwt-signing";
const TENANT_A = "usr_opp_qual_tenant_a";
const TENANT_B = "usr_opp_qual_tenant_b";

let authCookieA: string;
let authCookieB: string;

async function createAuthCookie(id: string, email: string, name: string): Promise<string> {
  const token = await encode({
    token: { id, email, name },
    secret: TEST_SECRET,
  });
  return `next-auth.session-token=${token}`;
}

describe("Phase B.4: Opportunity Qualification & Generation", () => {
  before(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;

    authCookieA = await createAuthCookie(TENANT_A, "tenant_a@qualify.dev", "Tenant A");
    authCookieB = await createAuthCookie(TENANT_B, "tenant_b@qualify.dev", "Tenant B");

    // Clean up test data
    await prisma.opportunity.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.aIResearch.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.lead.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.company.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.user.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });

    await prisma.user.createMany({
      data: [
        { id: TENANT_A, email: "tenant_a@qualify.dev", name: "Tenant A" },
        { id: TENANT_B, email: "tenant_b@qualify.dev", name: "Tenant B" },
      ],
    });
  });

  after(async () => {
    await prisma.opportunity.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.aIResearch.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.lead.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.company.deleteMany({ where: { userId: { in: [TENANT_A, TENANT_B] } } });
    await prisma.user.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
  });

  // =========================================================================
  // 1. COMPONENT 1: VALIDATION SCHEMAS
  // =========================================================================

  it("1. qualifyCompanySchema validates companyId and rejects unauthorized extra fields", () => {
    const valid = qualifyCompanySchema.parse({ companyId: "comp_123" });
    assert.equal(valid.companyId, "comp_123");
    assert.equal(valid.forceRefresh, false);

    assert.throws(() => {
      qualifyCompanySchema.parse({});
    }, /companyId is required/);

    assert.throws(() => {
      qualifyCompanySchema.parse({ companyId: "comp_123", userId: "hacked_user" });
    }, /Unrecognized or forbidden field/);

    assert.throws(() => {
      qualifyCompanySchema.parse({ companyId: "comp_123", ownerId: "admin" });
    }, /Unrecognized or forbidden field/);

    assert.throws(() => {
      qualifyCompanySchema.parse({ companyId: "comp_123", verifiedNoWebsite: true });
    }, /Unrecognized or forbidden field/);
  });

  // =========================================================================
  // 2. COMPONENT 3: WEBSITE PRESENCE QUALIFICATION
  // =========================================================================

  it("2. determineWebsitePresence returns WEBSITE_UNVERIFIED when company has no website/domain candidate", async () => {
    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "No Web Plumbing LLC",
        domain: null,
        website: null,
      },
    });

    const unverified = await determineWebsitePresence(company);
    assert.equal(unverified.status, "WEBSITE_UNVERIFIED");
    assert.equal(unverified.candidateUrl, null);

    const verified = await determineWebsitePresence(company, { verifiedNoWebsite: true });
    assert.equal(verified.status, "WEBSITE_NOT_FOUND");
    assert.equal(verified.candidateUrl, null);
  });

  it("3. determineWebsitePresence returns WEBSITE_UNREACHABLE on invalid URL or SSRF block", async () => {
    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Internal Metadata Malicious",
        domain: null,
        website: "http://169.254.169.254/latest/meta-data",
      },
    });

    const presence = await determineWebsitePresence(company);
    assert.equal(presence.status, "WEBSITE_UNREACHABLE");
    assert.ok(presence.error?.includes("SSRF") || presence.error?.includes("blocked"));
  });

  it("4. determineWebsitePresence returns WEBSITE_CONFIRMED for reachable HTTP endpoint", async () => {
    const mockServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><head><title>Test Business</title></head><body>Welcome</body></html>");
    });

    await new Promise<void>((resolve) => mockServer.listen(0, resolve));
    const port = (mockServer.address() as any).port;
    const testUrl = `http://127.0.0.1:${port}`;

    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Reachable Test Local",
        domain: null,
        website: testUrl,
      },
    });

    try {
      const presence = await determineWebsitePresence(company, { allowTestUrls: true });
      assert.equal(presence.status, "WEBSITE_CONFIRMED");
      assert.equal(presence.finalUrl, testUrl);
    } finally {
      mockServer.close();
    }
  });

  // =========================================================================
  // 3. COMPONENT 4 & 5: QUALIFICATION SERVICE (NO_WEBSITE & WEBSITE_IMPROVEMENT)
  // =========================================================================

  it("5. Company with confirmed verified no website creates NO_WEBSITE opportunity with strict boundaries", async () => {
    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Apex Roofers Austin",
        domain: null,
        website: null,
        location: "Austin, TX",
      },
    });

    const initialLeadCount = await prisma.lead.count({ where: { userId: TENANT_A } });

    const result = await qualifyCompanyOpportunity(TENANT_A, company.id, {
      verifiedNoWebsite: true,
      absenceEvidence: { verifiedBy: "manual_phone_audit", reason: "Direct call confirmed no active website" },
    });

    assert.equal(result.qualification.websiteStatus, "WEBSITE_NOT_FOUND");
    assert.equal(result.qualification.opportunityCreated, true);
    assert.equal(result.qualification.action, "created");
    assert.ok(result.qualification.opportunity);

    const opp = result.qualification.opportunity!;
    assert.equal(opp.type, OpportunityType.NO_WEBSITE);
    assert.equal(opp.stage, OpportunityStage.IDENTIFIED);
    assert.equal(opp.confidence, "high");
    assert.equal(opp.targetUrl, null);
    assert.deepEqual(opp.requestedServices, ["website_development"]);
    assert.ok(opp.title.includes("Apex Roofers Austin"));

    // HARD BOUNDARY: Zero Lead records created
    const finalLeadCount = await prisma.lead.count({ where: { userId: TENANT_A } });
    assert.equal(finalLeadCount, initialLeadCount, "Must NOT create Lead records");
  });

  it("6. Missing Google Places websiteUri alone returns WEBSITE_UNVERIFIED without creating false NO_WEBSITE opportunity", async () => {
    // Simulated company persisted from Google Places without websiteUri
    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Local Dentist No Website",
        domain: null,
        website: null,
        description: "Discovered via GOOGLE_PLACES",
      },
    });

    const result = await qualifyCompanyOpportunity(TENANT_A, company.id);
    assert.equal(result.qualification.websiteStatus, "WEBSITE_UNVERIFIED");
    assert.equal(result.qualification.opportunityCreated, false);
    assert.equal(result.qualification.action, "none");
    assert.equal(result.qualification.opportunity, undefined);
  });

  it("7. Existing website with supported deficiencies creates WEBSITE_IMPROVEMENT opportunity", async () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Old School HVAC</title>
        </head>
        <body>
          <h1>Old School HVAC Services</h1>
          <p>Call us at 512-555-0199 for quotes.</p>
          <img src="/img1.jpg" />
          <img src="/img2.jpg" />
          <img src="/img3.jpg" />
        </body>
      </html>
    `;

    const testUrl = "https://oldschoolhvac-austin-test-domain.com";

    const testResearcher: WebsiteResearchProvider = {
      name: "TestWebsiteResearcher",
      async researchWebsite(url: string) {
        const rawEvidence = extractStructuredEvidence({
          html: htmlContent,
          requestedUrl: url,
          finalUrl: url,
          isFinalHttps: false,
          headers: {},
        });
        const structuredEvidence = boundStructuredEvidence(rawEvidence);
        const opportunitySignals = analyzeWebDevelopmentOpportunities(structuredEvidence);
        return {
          url,
          finalUrl: url,
          summary: `Test research summary for ${url}`,
          structuredEvidence,
          opportunitySignals,
          provider: "TestWebsiteResearcher",
          providerVersion: "1.0.0",
          durationMs: 5,
        };
      },
    };

    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Old School HVAC",
        website: testUrl,
      },
    });

    const result = await qualifyCompanyOpportunity(TENANT_A, company.id, { websiteResearcher: testResearcher });

    assert.equal(result.qualification.websiteStatus, "WEBSITE_CONFIRMED");
    assert.equal(result.qualification.opportunityCreated, true);
    assert.equal(result.qualification.action, "created");
    assert.ok(result.qualification.opportunity);

    const opp = result.qualification.opportunity!;
    assert.equal(opp.type, OpportunityType.WEBSITE_IMPROVEMENT);
    assert.equal(opp.stage, OpportunityStage.IDENTIFIED);
    assert.equal(opp.targetUrl, testUrl);
    assert.ok(opp.requestedServices.includes("website_redesign"));
    assert.ok(opp.requestedServices.includes("website_seo"));
    assert.ok(result.qualification.signals.length > 0);

    // Verify AIResearch persisted and linked
    assert.ok(opp.researchId);
    const research = await prisma.aIResearch.findUnique({ where: { id: opp.researchId! } });
    assert.ok(research);
    assert.equal(research.companyId, company.id);
  });

  it("8. Existing website with no supported deficiencies returns no opportunity created", async () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta name="description" content="Modern dentistry clinic in Austin offering online booking and consultations.">
          <title>Modern Dental Spa</title>
        </head>
        <body>
          <header>
            <a href="/book" class="cta-btn">Book Appointment Online</a>
            <a href="https://calendly.com/dental-spa">Schedule Consultation</a>
          </header>
          <main>
            <img src="/logo.png" alt="Modern Dental Spa Logo" />
          </main>
        </body>
      </html>
    `;

    const testUrl = "https://moderndentalspa-austin-test-domain.com";

    const testResearcher: WebsiteResearchProvider = {
      name: "TestWebsiteResearcher",
      async researchWebsite(url: string) {
        const rawEvidence = extractStructuredEvidence({
          html: htmlContent,
          requestedUrl: url,
          finalUrl: url,
          isFinalHttps: true,
          headers: {},
        });
        const structuredEvidence = boundStructuredEvidence(rawEvidence);
        const opportunitySignals = analyzeWebDevelopmentOpportunities(structuredEvidence);
        return {
          url,
          finalUrl: url,
          summary: `Test research summary for ${url}`,
          structuredEvidence,
          opportunitySignals,
          provider: "TestWebsiteResearcher",
          providerVersion: "1.0.0",
          durationMs: 5,
        };
      },
    };

    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Modern Dental Spa",
        website: testUrl,
      },
    });

    const result = await qualifyCompanyOpportunity(TENANT_A, company.id, { websiteResearcher: testResearcher });

    assert.equal(result.qualification.websiteStatus, "WEBSITE_CONFIRMED");
    assert.equal(result.qualification.opportunityCreated, false);
    assert.equal(result.qualification.action, "none");
    assert.equal(result.qualification.opportunity, undefined);
  });

  it("9. Website reachability failure returns WEBSITE_UNREACHABLE without creating false opportunities", async () => {
    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Unreachable Domain Corp",
        website: "http://127.0.0.1:59999/does-not-exist-port",
      },
    });

    const result = await qualifyCompanyOpportunity(TENANT_A, company.id);

    assert.equal(result.qualification.websiteStatus, "WEBSITE_UNREACHABLE");
    assert.equal(result.qualification.opportunityCreated, false);
    assert.equal(result.qualification.action, "none");

    const count = await prisma.opportunity.count({ where: { companyId: company.id } });
    assert.equal(count, 0, "No opportunity must be created for unreachable website");
  });

  // =========================================================================
  // 4. COMPONENT 9: IDEMPOTENCY & LIFECYCLE PRESERVATION
  // =========================================================================

  it("10. Qualification is idempotent and updates existing opportunity without creating duplicates", async () => {
    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Idempotent Qualify Corp",
        domain: null,
        website: null,
      },
    });

    // First qualification run
    const run1 = await qualifyCompanyOpportunity(TENANT_A, company.id, { verifiedNoWebsite: true });
    assert.equal(run1.qualification.action, "created");

    const oppCount1 = await prisma.opportunity.count({ where: { companyId: company.id } });
    assert.equal(oppCount1, 1);

    // Second qualification run
    const run2 = await qualifyCompanyOpportunity(TENANT_A, company.id, { verifiedNoWebsite: true });
    assert.equal(run2.qualification.action, "updated");
    assert.equal(run2.qualification.opportunity?.id, run1.qualification.opportunity?.id);

    const oppCount2 = await prisma.opportunity.count({ where: { companyId: company.id } });
    assert.equal(oppCount2, 1, "Must NOT create duplicate opportunity");
  });

  it("11. Existing opportunity CRM lifecycle stage beyond IDENTIFIED is strictly preserved", async () => {
    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Advanced Stage Company",
        domain: null,
        website: null,
      },
    });

    // Manually progress opportunity to IN_DISCUSSION
    const opp = await prisma.opportunity.create({
      data: {
        userId: TENANT_A,
        companyId: company.id,
        type: OpportunityType.NO_WEBSITE,
        stage: OpportunityStage.IN_DISCUSSION,
        title: "Initial Pitch",
        confidence: "high",
        requestedServices: ["website_development"],
      },
    });

    const result = await qualifyCompanyOpportunity(TENANT_A, company.id, { verifiedNoWebsite: true });

    assert.equal(result.qualification.action, "updated");
    assert.equal(result.qualification.opportunity?.id, opp.id);
    assert.equal(result.qualification.opportunity?.stage, OpportunityStage.IN_DISCUSSION, "Stage must NOT be downgraded to IDENTIFIED");
  });

  // =========================================================================
  // 5. COMPONENT 12 & 13: API ROUTE & TENANT ISOLATION
  // =========================================================================

  it("12. API Route POST /api/opportunities/qualify qualifies company for authenticated user", async () => {
    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "API Qualify Target",
        domain: null,
        website: null,
      },
    });

    const req = new NextRequest("http://localhost:3000/api/opportunities/qualify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookieA,
      },
      body: JSON.stringify({ companyId: company.id }),
    });

    const res = await qualifyRoute(req, { params: {} });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.company.id, company.id);
    assert.equal(data.qualification.websiteStatus, "WEBSITE_UNVERIFIED");
    assert.equal(data.qualification.opportunityCreated, false);
    assert.equal(data.qualification.action, "none");
  });

  it("13. API Route rejects unauthenticated request (401)", async () => {
    const req = new NextRequest("http://localhost:3000/api/opportunities/qualify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: "some_id" }),
    });

    const res = await qualifyRoute(req, { params: {} });
    assert.equal(res.status, 401);
  });

  it("14. API Route rejects cross-tenant company access (404/403)", async () => {
    // Tenant B creates a company
    const companyB = await prisma.company.create({
      data: {
        userId: TENANT_B,
        name: "Tenant B Secret Business",
        domain: null,
        website: null,
      },
    });

    // Tenant A attempts to qualify Tenant B's company
    const req = new NextRequest("http://localhost:3000/api/opportunities/qualify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookieA,
      },
      body: JSON.stringify({ companyId: companyB.id }),
    });

    const res = await qualifyRoute(req, { params: {} });
    assert.equal(res.status, 404, "Must reject cross-tenant access with 404/403");

    // Verify Tenant B has 0 opportunities created by Tenant A
    const oppCountB = await prisma.opportunity.count({ where: { companyId: companyB.id } });
    assert.equal(oppCountB, 0);
  });

  it("15. API Route rejects client-supplied userId or ownership overrides (400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/opportunities/qualify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookieA,
      },
      body: JSON.stringify({ companyId: "comp_123", userId: TENANT_B }),
    });

    const res = await qualifyRoute(req, { params: {} });
    assert.equal(res.status, 400);
  });

  it("16. API Route rejects client self-attestation of verifiedNoWebsite (400)", async () => {
    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Malicious Self Attesting Co",
        domain: null,
        website: null,
      },
    });

    // Client attempts to manufacture a high-confidence NO_WEBSITE opportunity by injecting verifiedNoWebsite
    const req = new NextRequest("http://localhost:3000/api/opportunities/qualify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookieA,
      },
      body: JSON.stringify({ companyId: company.id, verifiedNoWebsite: true }),
    });

    const res = await qualifyRoute(req, { params: {} });
    assert.equal(res.status, 400, "Must reject client-supplied verifiedNoWebsite flag with 400 Bad Request");

    const data = await res.json();
    assert.ok(
      data.error?.message?.includes("Unrecognized or forbidden field") ||
        JSON.stringify(data).includes("Unrecognized or forbidden field")
    );

    // Verify 0 opportunities were created in DB
    const oppCount = await prisma.opportunity.count({ where: { companyId: company.id } });
    assert.equal(oppCount, 0, "Clients cannot manufacture NO_WEBSITE opportunities via request body flags");
  });

  // =========================================================================
  // 6. COMPONENT 6 & 11: EVIDENCE, SIGNALS & SERVICE MAPPING
  // =========================================================================

  it("17. mapSignalsToRequestedServices maps detected categories to standard requestedServices tags", () => {
    const signals: OpportunitySignal[] = [
      {
        category: "mobile_viewport",
        issue: "Missing viewport",
        evidence: "No meta viewport",
        confidence: "high",
        source: "https://test.dev",
        recommendation: "Add viewport",
      },
      {
        category: "transport_security",
        issue: "HTTP connection",
        evidence: "HTTP site",
        confidence: "high",
        source: "http://test.dev",
        recommendation: "Install SSL",
      },
      {
        category: "seo_meta",
        issue: "Missing description",
        evidence: "No description",
        confidence: "high",
        source: "https://test.dev",
        recommendation: "Add description",
      },
    ];

    const services = mapSignalsToRequestedServices(signals);
    assert.ok(services.includes("website_redesign"));
    assert.ok(services.includes("website_security"));
    assert.ok(services.includes("website_seo"));
  });

  it("18. mapToOpportunitySource correctly maps string providers to OpportunitySource enums", () => {
    assert.equal(mapToOpportunitySource("GOOGLE_PLACES"), OpportunitySource.GOOGLE_PLACES);
    assert.equal(mapToOpportunitySource("HUNTER_DISCOVER"), OpportunitySource.HUNTER_DISCOVER);
    assert.equal(mapToOpportunitySource("CSV_IMPORT"), OpportunitySource.CSV_IMPORT);
    assert.equal(mapToOpportunitySource("PUBLIC_FEED"), OpportunitySource.PUBLIC_FEED);
    assert.equal(mapToOpportunitySource("MANUAL"), OpportunitySource.MANUAL);
    assert.equal(mapToOpportunitySource("unknown"), OpportunitySource.GOOGLE_PLACES);
  });
});
