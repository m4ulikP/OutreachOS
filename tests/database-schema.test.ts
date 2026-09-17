import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { createLead } from "../src/lib/services/lead-service";
import { backfillLeadDeduplication } from "../scripts/backfill-lead-dedup";
import { Prisma } from "@prisma/client";

const TEST_TENANT_A = "usr_db_test_tenant_a";
const TEST_TENANT_B = "usr_db_test_tenant_b";

describe("Milestone 2: Database Migration Baseline, Indexing & Deduplication Fields", () => {
  before(async () => {
    // Clean up any leftovers from prior test runs
    await prisma.lead.deleteMany({
      where: { userId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });

    // Seed test users
    await prisma.user.createMany({
      data: [
        { id: TEST_TENANT_A, email: "tenant_a@test.dev", name: "Tenant A" },
        { id: TEST_TENANT_B, email: "tenant_b@test.dev", name: "Tenant B" },
      ],
    });
  });

  after(async () => {
    // Clean up test data
    await prisma.lead.deleteMany({
      where: { userId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
  });

  // 1. Column presence verification in PostgreSQL
  it("1. Lead table contains persistent deduplication columns", async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'leads' 
        AND column_name IN ('normalizedEmail', 'normalizedLinkedInUrl', 'compositeHash')
    `;
    const columnNames = columns.map((c) => c.column_name);

    assert.ok(columnNames.includes("normalizedEmail"), "leads must have normalizedEmail column");
    assert.ok(
      columnNames.includes("normalizedLinkedInUrl"),
      "leads must have normalizedLinkedInUrl column"
    );
    assert.ok(columnNames.includes("compositeHash"), "leads must have compositeHash column");
  });

  // 2. Indexes presence in PostgreSQL
  it("2. Required PostgreSQL indexes exist in system catalog", async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('leads', 'follow_ups', 'companies')
    `;
    const indexNames = indexes.map((i) => i.indexname);

    // FollowUp indexes
    assert.ok(
      indexNames.includes("follow_ups_status_scheduledFor_idx"),
      "follow_ups must have (status, scheduledFor) index"
    );
    assert.ok(
      indexNames.includes("follow_ups_leadId_status_idx"),
      "follow_ups must have (leadId, status) index"
    );

    // Lead indexes
    assert.ok(
      indexNames.includes("leads_userId_normalizedEmail_idx"),
      "leads must have (userId, normalizedEmail) index"
    );
    assert.ok(
      indexNames.includes("leads_userId_normalizedLinkedInUrl_idx"),
      "leads must have (userId, normalizedLinkedInUrl) index"
    );
    assert.ok(
      indexNames.includes("leads_userId_compositeHash_idx"),
      "leads must have (userId, compositeHash) index"
    );

    // Company unique index
    assert.ok(
      indexNames.includes("companies_userId_name_key"),
      "companies must have (userId, name) unique index"
    );
  });

  // 3. Company uniqueness enforced per user
  it("3. Company uniqueness is enforced per user workspace", async () => {
    await prisma.company.create({
      data: {
        userId: TEST_TENANT_A,
        name: "Starlight Dynamics",
        industry: "Software",
      },
    });

    // Attempting to create duplicate company for same user should throw P2002
    await assert.rejects(
      async () => {
        await prisma.company.create({
          data: {
            userId: TEST_TENANT_A,
            name: "Starlight Dynamics",
            industry: "Hardware",
          },
        });
      },
      (err: unknown) => {
        return (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        );
      },
      "Duplicate company name within the same tenant must violate unique constraint"
    );
  });

  // 4. Same company name can exist for different users
  it("4. Same company name can exist across different user workspaces without collision", async () => {
    const companyB = await prisma.company.create({
      data: {
        userId: TEST_TENANT_B,
        name: "Starlight Dynamics",
        industry: "Consulting",
      },
    });

    assert.equal(companyB.name, "Starlight Dynamics");
    assert.equal(companyB.userId, TEST_TENANT_B);
  });

  // 5. New Lead creation correctly populates normalized deduplication fields
  it("5. New Lead creation correctly populates normalized deduplication fields", async () => {
    const { lead } = await createLead(
      TEST_TENANT_A,
      {
        firstName: "Alexander",
        lastName: "Wright",
        email: "  alex.wright+sales@acmecorp.com  ",
        linkedInUrl: "https://www.linkedin.com/in/alex-wright/?tracking=123",
        companyName: "Starlight Dynamics",
      },
      { skipDuplicateCheck: true }
    );

    assert.ok(lead, "Lead should be created successfully");
    assert.equal(
      lead.normalizedEmail,
      "alex.wright+sales@acmecorp.com",
      "Normalized email should trim and lowercase"
    );
    assert.equal(
      lead.normalizedLinkedInUrl,
      "https://linkedin.com/in/alex-wright",
      "Normalized LinkedIn URL should strip subdomain and tracking parameters"
    );
    assert.equal(
      lead.compositeHash,
      "alexander wright:::starlight dynamics",
      "Composite hash should contain canonical name:::company"
    );
  });

  // 6. Deduplication fields support multiple tenants without global collisions
  it("6. Deduplication fields support multiple tenants with identical lead data", async () => {
    // Tenant B can create the same prospect without database unique violation
    const { lead: leadB } = await createLead(
      TEST_TENANT_B,
      {
        firstName: "Alexander",
        lastName: "Wright",
        email: "alex.wright+sales@acmecorp.com",
        linkedInUrl: "https://www.linkedin.com/in/alex-wright/",
        companyName: "Starlight Dynamics",
      },
      { skipDuplicateCheck: true }
    );

    assert.ok(leadB, "Tenant B should be able to create the prospect independently");
    assert.equal(leadB.userId, TEST_TENANT_B);
    assert.equal(leadB.normalizedEmail, "alex.wright+sales@acmecorp.com");
  });

  // 7. Backfill script operates deterministically and preserves data
  it("7. Backfill utility operates safely and idempotently on existing data", async () => {
    // Clear deduplication fields manually to simulate pre-migration records
    await prisma.lead.updateMany({
      where: { userId: TEST_TENANT_A },
      data: {
        normalizedEmail: null,
        normalizedLinkedInUrl: null,
        compositeHash: null,
      },
    });

    // Run backfill
    const result = await backfillLeadDeduplication();
    assert.ok(result.totalExamined >= 1, "Backfill must examine existing leads");
    assert.ok(result.updatedCount >= 1, "Backfill must populate missing fields");

    // Check that fields are restored
    const lead = await prisma.lead.findFirst({
      where: { userId: TEST_TENANT_A },
    });
    assert.ok(lead?.normalizedEmail, "Lead normalizedEmail must be backfilled");
    assert.ok(lead?.normalizedLinkedInUrl, "Lead normalizedLinkedInUrl must be backfilled");
    assert.ok(lead?.compositeHash, "Lead compositeHash must be backfilled");

    // Second run should be idempotent
    const secondRun = await backfillLeadDeduplication();
    assert.equal(secondRun.updatedCount, 0, "Second backfill run should update 0 leads");
  });
});
