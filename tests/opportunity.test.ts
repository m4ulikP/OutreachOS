import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import {
  OpportunityType,
  OpportunityStage,
  OpportunitySource,
  LeadStage,
  ResearchStatus,
  Prisma,
} from "@prisma/client";

const TENANT_A = "usr_opp_test_tenant_a";
const TENANT_B = "usr_opp_test_tenant_b";

describe("Phase A: Opportunity Entity & Domain Model Foundation", () => {
  before(async () => {
    // Clean up test data if prior tests left residues
    await prisma.opportunity.deleteMany({
      where: { userId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.aIResearch.deleteMany({
      where: { userId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.lead.deleteMany({
      where: { userId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TENANT_A, TENANT_B] } },
    });

    // Create test tenants
    await prisma.user.createMany({
      data: [
        { id: TENANT_A, email: "opp_tenant_a@test.dev", name: "Tenant A" },
        { id: TENANT_B, email: "opp_tenant_b@test.dev", name: "Tenant B" },
      ],
    });
  });

  after(async () => {
    // Clean up all created test data
    await prisma.opportunity.deleteMany({
      where: { userId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.aIResearch.deleteMany({
      where: { userId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.lead.deleteMany({
      where: { userId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TENANT_A, TENANT_B] } },
    });
  });

  // =========================================================================
  // 1. DATABASE SCHEMA & POSTGRESQL CATALOG VERIFICATION
  // =========================================================================

  it("1. opportunities table exists with all required columns in PostgreSQL schema", async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opportunities'
    `;
    const columnNames = columns.map((c) => c.column_name);

    const requiredColumns = [
      "id",
      "userId",
      "companyId",
      "leadId",
      "researchId",
      "type",
      "stage",
      "source",
      "sourceUrl",
      "title",
      "description",
      "budget",
      "currency",
      "confidence",
      "evidence",
      "opportunitySignals",
      "requestedServices",
      "targetUrl",
      "discoveredAt",
      "createdAt",
      "updatedAt",
    ];

    for (const col of requiredColumns) {
      assert.ok(
        columnNames.includes(col),
        `opportunities table must have column '${col}'`
      );
    }
  });

  it("2. Tenant-scoped PostgreSQL composite indexes exist on opportunities", async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'opportunities'
    `;
    const indexNames = indexes.map((i) => i.indexname);

    assert.ok(
      indexNames.includes("opportunities_userId_stage_idx"),
      "opportunities must have index on (userId, stage)"
    );
    assert.ok(
      indexNames.includes("opportunities_userId_type_idx"),
      "opportunities must have index on (userId, type)"
    );
    assert.ok(
      indexNames.includes("opportunities_userId_companyId_idx"),
      "opportunities must have index on (userId, companyId)"
    );
    assert.ok(
      indexNames.includes("opportunities_userId_leadId_idx"),
      "opportunities must have index on (userId, leadId)"
    );
    assert.ok(
      indexNames.includes("opportunities_userId_researchId_idx"),
      "opportunities must have index on (userId, researchId)"
    );
    assert.ok(
      indexNames.includes("opportunities_userId_discoveredAt_idx"),
      "opportunities must have index on (userId, discoveredAt)"
    );
  });

  // =========================================================================
  // 2. ENUM COVERAGE: OpportunityType
  // =========================================================================

  it("3. Supports all OpportunityType enum values", async () => {
    const types: OpportunityType[] = [
      OpportunityType.NO_WEBSITE,
      OpportunityType.WEBSITE_IMPROVEMENT,
      OpportunityType.ACTIVE_PROJECT,
      OpportunityType.REDESIGN_REQUEST,
      OpportunityType.DEVELOPMENT_REQUEST,
    ];

    for (const oppType of types) {
      const opp = await prisma.opportunity.create({
        data: {
          userId: TENANT_A,
          type: oppType,
          title: `Test Opportunity ${oppType}`,
        },
      });

      assert.equal(opp.type, oppType);
      assert.equal(opp.userId, TENANT_A);
      assert.equal(opp.stage, OpportunityStage.IDENTIFIED); // Default
      assert.equal(opp.source, OpportunitySource.GOOGLE_PLACES); // Default
    }
  });

  // =========================================================================
  // 3. ENUM COVERAGE: OpportunityStage
  // =========================================================================

  it("4. Supports all OpportunityStage enum values", async () => {
    const stages: OpportunityStage[] = [
      OpportunityStage.IDENTIFIED,
      OpportunityStage.QUALIFIED,
      OpportunityStage.PITCH_DRAFTED,
      OpportunityStage.CONTACTED,
      OpportunityStage.IN_DISCUSSION,
      OpportunityStage.CONVERTED,
      OpportunityStage.PASSED,
    ];

    for (const oppStage of stages) {
      const opp = await prisma.opportunity.create({
        data: {
          userId: TENANT_A,
          type: OpportunityType.WEBSITE_IMPROVEMENT,
          stage: oppStage,
          title: `Stage Test ${oppStage}`,
        },
      });

      assert.equal(opp.stage, oppStage);
    }
  });

  // =========================================================================
  // 4. ENUM COVERAGE: OpportunitySource
  // =========================================================================

  it("5. Supports all OpportunitySource enum values", async () => {
    const sources: OpportunitySource[] = [
      OpportunitySource.GOOGLE_PLACES,
      OpportunitySource.HUNTER_DISCOVER,
      OpportunitySource.HUNTER_DOMAIN_SEARCH,
      OpportunitySource.PUBLIC_FEED,
      OpportunitySource.MANUAL,
      OpportunitySource.CSV_IMPORT,
    ];

    for (const oppSource of sources) {
      const opp = await prisma.opportunity.create({
        data: {
          userId: TENANT_A,
          type: OpportunityType.NO_WEBSITE,
          source: oppSource,
          title: `Source Test ${oppSource}`,
        },
      });

      assert.equal(opp.source, oppSource);
    }
  });

  // =========================================================================
  // 5. NULLABLE RELATIONS (companyId, leadId, researchId)
  // =========================================================================

  it("6. Supports completely unattached opportunity (nullable companyId, leadId, researchId)", async () => {
    const opp = await prisma.opportunity.create({
      data: {
        userId: TENANT_A,
        type: OpportunityType.ACTIVE_PROJECT,
        title: "Freelance Next.js Website Build Needed",
        description: "Looking for an engineer to build modern SaaS landing page.",
        budget: "$3,000 - $5,000",
        currency: "USD",
        confidence: "high",
        source: OpportunitySource.PUBLIC_FEED,
        sourceUrl: "https://example.com/jobs/123",
        requestedServices: ["nextjs", "tailwind", "seo"],
        companyId: null,
        leadId: null,
        researchId: null,
      },
    });

    assert.equal(opp.companyId, null);
    assert.equal(opp.leadId, null);
    assert.equal(opp.researchId, null);
    assert.equal(opp.confidence, "high");
    assert.deepEqual(opp.requestedServices, ["nextjs", "tailwind", "seo"]);
    assert.equal(opp.budget, "$3,000 - $5,000");
  });

  it("7. Links correctly to Company, Lead, and AIResearch when provided", async () => {
    // Create test Company
    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Acme Webworks",
        website: "https://acmewebworks.io",
      },
    });

    // Create test Lead
    const lead = await prisma.lead.create({
      data: {
        userId: TENANT_A,
        companyId: company.id,
        fullName: "Jane Doe",
        email: "jane@acmewebworks.io",
        stage: LeadStage.NEW,
      },
    });

    // Create test AIResearch
    const research = await prisma.aIResearch.create({
      data: {
        userId: TENANT_A,
        companyId: company.id,
        leadId: lead.id,
        url: "https://acmewebworks.io",
        status: ResearchStatus.COMPLETED,
        summary: "Audit completed: outdated design, no mobile support.",
        opportunitySignals: {
          hasMobileViewport: false,
          loadTimeSeconds: 4.5,
          sslValid: true,
        },
      },
    });

    // Create Opportunity linked to all three
    const opp = await prisma.opportunity.create({
      data: {
        userId: TENANT_A,
        companyId: company.id,
        leadId: lead.id,
        researchId: research.id,
        type: OpportunityType.WEBSITE_IMPROVEMENT,
        stage: OpportunityStage.QUALIFIED,
        source: OpportunitySource.HUNTER_DOMAIN_SEARCH,
        title: "Mobile Responsiveness & Speed Overhaul",
        targetUrl: "https://acmewebworks.io",
        evidence: {
          mobileViewportMissing: true,
          fcpMs: 3200,
        },
        opportunitySignals: {
          modernFrameworkMissing: true,
        },
      },
      include: {
        company: true,
        lead: true,
        research: true,
        user: true,
      },
    });

    assert.equal(opp.companyId, company.id);
    assert.equal(opp.company?.name, "Acme Webworks");
    assert.equal(opp.leadId, lead.id);
    assert.equal(opp.lead?.fullName, "Jane Doe");
    assert.equal(opp.researchId, research.id);
    assert.equal(opp.research?.status, ResearchStatus.COMPLETED);
    assert.equal(opp.user.id, TENANT_A);
  });

  // =========================================================================
  // 6. JSON STRUCTURED FIELDS & ARRAYS
  // =========================================================================

  it("8. Persists and retrieves structured JSON evidence and opportunitySignals", async () => {
    const evidenceData = {
      auditTimestamp: "2026-09-19T12:00:00Z",
      pagesChecked: ["/", "/about", "/pricing"],
      defects: [
        { code: "NO_MOBILE_VIEWPORT", severity: "HIGH" },
        { code: "BROKEN_CONTACT_FORM", severity: "CRITICAL" },
      ],
    };

    const signalsData = {
      detectedTech: ["WordPress 4.8", "jQuery 1.11"],
      lastUpdatedYear: 2018,
      missingSecurityHeaders: ["Content-Security-Policy", "X-Frame-Options"],
    };

    const opp = await prisma.opportunity.create({
      data: {
        userId: TENANT_A,
        type: OpportunityType.WEBSITE_IMPROVEMENT,
        title: "Legacy WordPress Rebuild Opportunity",
        evidence: evidenceData,
        opportunitySignals: signalsData,
        requestedServices: ["redesign", "headless-cms", "seo"],
      },
    });

    const retrieved = await prisma.opportunity.findUnique({
      where: { id: opp.id },
    });

    assert.ok(retrieved);
    assert.deepEqual(retrieved.evidence, evidenceData);
    assert.deepEqual(retrieved.opportunitySignals, signalsData);
    assert.deepEqual(retrieved.requestedServices, [
      "redesign",
      "headless-cms",
      "seo",
    ]);
  });

  // =========================================================================
  // 7. MULTI-TENANT ISOLATION
  // =========================================================================

  it("9. Enforces strict tenant isolation between users", async () => {
    // Tenant A creates an opportunity
    const oppA = await prisma.opportunity.create({
      data: {
        userId: TENANT_A,
        type: OpportunityType.NO_WEBSITE,
        title: "Tenant A Secret Client Opportunity",
      },
    });

    // Tenant B queries opportunities - must not see Tenant A's record
    const tenantBOpps = await prisma.opportunity.findMany({
      where: { userId: TENANT_B },
    });

    const foundOppAInTenantB = tenantBOpps.some((o) => o.id === oppA.id);
    assert.equal(
      foundOppAInTenantB,
      false,
      "Tenant B must not see opportunities created by Tenant A"
    );

    // Tenant B trying to update Tenant A's opportunity scoped to Tenant B affects 0 records
    const updateResult = await prisma.opportunity.updateMany({
      where: { id: oppA.id, userId: TENANT_B },
      data: { title: "Hijacked Title" },
    });
    assert.equal(updateResult.count, 0);

    // Confirm Tenant A's opportunity was unmodified
    const freshOppA = await prisma.opportunity.findUnique({
      where: { id: oppA.id },
    });
    assert.equal(freshOppA?.title, "Tenant A Secret Client Opportunity");
  });

  // =========================================================================
  // 8. CASCADE & SET-NULL BEHAVIOR
  // =========================================================================

  it("10. Preserves opportunity when linked Company is deleted (SetNull)", async () => {
    const company = await prisma.company.create({
      data: {
        userId: TENANT_A,
        name: "Temporary Co",
      },
    });

    const opp = await prisma.opportunity.create({
      data: {
        userId: TENANT_A,
        companyId: company.id,
        type: OpportunityType.WEBSITE_IMPROVEMENT,
        title: "Company SetNull Test",
      },
    });

    // Delete company
    await prisma.company.delete({
      where: { id: company.id },
    });

    // Opportunity must still exist, with companyId = null
    const retrieved = await prisma.opportunity.findUnique({
      where: { id: opp.id },
    });
    assert.ok(retrieved, "Opportunity must survive company deletion");
    assert.equal(retrieved.companyId, null);
  });

  it("11. Preserves opportunity when linked Lead is deleted (SetNull)", async () => {
    const lead = await prisma.lead.create({
      data: {
        userId: TENANT_A,
        fullName: "Temporary Contact",
        email: "temp_contact@test.dev",
        stage: LeadStage.NEW,
      },
    });

    const opp = await prisma.opportunity.create({
      data: {
        userId: TENANT_A,
        leadId: lead.id,
        type: OpportunityType.ACTIVE_PROJECT,
        title: "Lead SetNull Test",
      },
    });

    // Delete lead
    await prisma.lead.delete({
      where: { id: lead.id },
    });

    // Opportunity must still exist, with leadId = null
    const retrieved = await prisma.opportunity.findUnique({
      where: { id: opp.id },
    });
    assert.ok(retrieved, "Opportunity must survive lead deletion");
    assert.equal(retrieved.leadId, null);
  });

  it("12. Preserves opportunity when linked AIResearch is deleted (SetNull)", async () => {
    const research = await prisma.aIResearch.create({
      data: {
        userId: TENANT_A,
        status: ResearchStatus.COMPLETED,
        url: "https://temp-audit.dev",
      },
    });

    const opp = await prisma.opportunity.create({
      data: {
        userId: TENANT_A,
        researchId: research.id,
        type: OpportunityType.REDESIGN_REQUEST,
        title: "Research SetNull Test",
      },
    });

    // Delete research
    await prisma.aIResearch.delete({
      where: { id: research.id },
    });

    // Opportunity must still exist, with researchId = null
    const retrieved = await prisma.opportunity.findUnique({
      where: { id: opp.id },
    });
    assert.ok(retrieved, "Opportunity must survive research deletion");
    assert.equal(retrieved.researchId, null);
  });

  it("13. Allows multiple Opportunities to share the same AIResearch record", async () => {
    const sharedResearch = await prisma.aIResearch.create({
      data: {
        userId: TENANT_A,
        url: "https://multi-opp.com",
        status: ResearchStatus.COMPLETED,
        summary: "Audit discovered missing mobile optimization and outdated tech stack.",
      },
    });

    // Create Opp 1: Website improvement
    const opp1 = await prisma.opportunity.create({
      data: {
        userId: TENANT_A,
        researchId: sharedResearch.id,
        type: OpportunityType.WEBSITE_IMPROVEMENT,
        title: "Mobile Responsiveness",
      },
    });

    // Create Opp 2: Redesign request
    const opp2 = await prisma.opportunity.create({
      data: {
        userId: TENANT_A,
        researchId: sharedResearch.id,
        type: OpportunityType.REDESIGN_REQUEST,
        title: "Complete Visual Modernization",
      },
    });

    // Query research and verify reverse relation includes both opportunities
    const researchWithOpps = await prisma.aIResearch.findUnique({
      where: { id: sharedResearch.id },
      include: { opportunities: true },
    });

    assert.ok(researchWithOpps);
    assert.equal(researchWithOpps.opportunities.length, 2);
    const oppIds = researchWithOpps.opportunities.map((o) => o.id);
    assert.ok(oppIds.includes(opp1.id));
    assert.ok(oppIds.includes(opp2.id));
  });

  // =========================================================================
  // 9. EXISTING CORE MODELS INTEGRITY
  // =========================================================================

  it("14. Existing Lead, Company, and AIResearch creation and querying remain 100% functional", async () => {
    const company = await prisma.company.create({
      data: {
        userId: TENANT_B,
        name: "Standard Corp",
        website: "https://standardcorp.com",
      },
    });

    const lead = await prisma.lead.create({
      data: {
        userId: TENANT_B,
        companyId: company.id,
        fullName: "Alice Smith",
        email: "alice@standardcorp.com",
        stage: LeadStage.NEW,
      },
      include: {
        company: true,
        opportunities: true,
      },
    });

    assert.equal(lead.fullName, "Alice Smith");
    assert.equal(lead.company?.name, "Standard Corp");
    assert.deepEqual(lead.opportunities, []);

    const research = await prisma.aIResearch.create({
      data: {
        userId: TENANT_B,
        leadId: lead.id,
        companyId: company.id,
        status: ResearchStatus.COMPLETED,
        serviceProfile: "web_development",
        summary: "Website has modern stack, no immediate red flags.",
      },
      include: {
        lead: true,
        company: true,
        opportunities: true,
      },
    });

    assert.equal(research.status, ResearchStatus.COMPLETED);
    assert.equal(research.lead?.id, lead.id);
    assert.equal(research.company?.id, company.id);
    assert.deepEqual(research.opportunities, []);
  });
});
