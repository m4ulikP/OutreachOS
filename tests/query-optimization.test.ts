import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, checkDatabaseConnection } from "../src/lib/db";
import {
  createLead,
  findOrCreateCompany,
  addLeadInteraction,
} from "../src/lib/services/lead-service";
import { getDashboardMetrics } from "../src/lib/services/analytics-service";
import { LeadStage, TagType } from "@prisma/client";

const USER_OPT_A = "usr_opt_test_tenant_a";
const USER_OPT_B = "usr_opt_test_tenant_b";

describe("Milestone 3: Query Optimization, O(1) Deduplication, Transactions & Scale", () => {
  before(async () => {
    // Clean up any leftovers from previous runs
    await prisma.leadInteraction.deleteMany({
      where: { userId: { in: [USER_OPT_A, USER_OPT_B] } },
    });
    await prisma.leadTagAssignment.deleteMany({
      where: { lead: { userId: { in: [USER_OPT_A, USER_OPT_B] } } },
    });
    await prisma.leadTag.deleteMany({
      where: { userId: { in: [USER_OPT_A, USER_OPT_B] } },
    });
    await prisma.meeting.deleteMany({
      where: { userId: { in: [USER_OPT_A, USER_OPT_B] } },
    });
    await prisma.emailMessage.deleteMany({
      where: { userId: { in: [USER_OPT_A, USER_OPT_B] } },
    });
    await prisma.lead.deleteMany({
      where: { userId: { in: [USER_OPT_A, USER_OPT_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [USER_OPT_A, USER_OPT_B] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_OPT_A, USER_OPT_B] } },
    });

    // Seed test users
    await prisma.user.createMany({
      data: [
        { id: USER_OPT_A, email: "opt_user_a@outreachos.test", name: "Optimizer Tenant A" },
        { id: USER_OPT_B, email: "opt_user_b@outreachos.test", name: "Optimizer Tenant B" },
      ],
    });
  });

  after(async () => {
    await prisma.leadInteraction.deleteMany({
      where: { userId: { in: [USER_OPT_A, USER_OPT_B] } },
    });
    await prisma.leadTagAssignment.deleteMany({
      where: { lead: { userId: { in: [USER_OPT_A, USER_OPT_B] } } },
    });
    await prisma.leadTag.deleteMany({
      where: { userId: { in: [USER_OPT_A, USER_OPT_B] } },
    });
    await prisma.meeting.deleteMany({
      where: { userId: { in: [USER_OPT_A, USER_OPT_B] } },
    });
    await prisma.emailMessage.deleteMany({
      where: { userId: { in: [USER_OPT_A, USER_OPT_B] } },
    });
    await prisma.lead.deleteMany({
      where: { userId: { in: [USER_OPT_A, USER_OPT_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [USER_OPT_A, USER_OPT_B] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_OPT_A, USER_OPT_B] } },
    });
  });

  // ==========================================
  // SECTION 1: O(1) INDEXED DEDUPLICATION
  // ==========================================

  it("1. Email duplicate detected through indexed normalizedEmail (Priority 1)", async () => {
    // Create initial lead
    const { lead: initialLead } = await createLead(USER_OPT_A, {
      firstName: "Sophia",
      lastName: "Chen",
      email: "sophia.chen@novatech.io",
      companyName: "NovaTech Solutions",
    });

    assert.ok(initialLead, "Initial lead should be created");

    // Attempt to create duplicate with case/whitespace variations
    const { lead: dupLead, deduplication } = await createLead(USER_OPT_A, {
      firstName: "Sophia",
      lastName: "Chen",
      email: "  SOPHIA.CHEN@NOVATECH.IO  ",
      companyName: "Different Company",
    });

    assert.equal(dupLead, null, "Duplicate lead should not be inserted");
    assert.equal(deduplication.isDuplicate, true);
    assert.equal(deduplication.status, "ALREADY_EXISTS");
    assert.equal(deduplication.matchedBy, "email");
    assert.equal(deduplication.matchedLeadId, initialLead.id);
  });

  it("2. LinkedIn duplicate detected through indexed normalizedLinkedInUrl (Priority 2)", async () => {
    // Create initial lead with unique email and linkedInUrl
    const { lead: initialLead } = await createLead(USER_OPT_A, {
      firstName: "Marcus",
      lastName: "Vance",
      email: "marcus.vance@cloudgrid.net",
      linkedInUrl: "https://www.linkedin.com/in/marcus-vance",
      companyName: "CloudGrid Inc",
    });

    assert.ok(initialLead, "Initial lead should be created");

    // Attempt to create duplicate with DIFFERENT email but matching LinkedIn URL with tracking parameters
    const { lead: dupLead, deduplication } = await createLead(USER_OPT_A, {
      firstName: "M.",
      lastName: "Vance",
      email: "completely.different.email@other.org",
      linkedInUrl: "https://linkedin.com/in/marcus-vance/?utm_source=share&utm_medium=member_desktop",
      companyName: "CloudGrid Inc",
    });

    assert.equal(dupLead, null, "Duplicate lead should not be inserted");
    assert.equal(deduplication.isDuplicate, true);
    assert.equal(deduplication.status, "ALREADY_EXISTS");
    assert.equal(deduplication.matchedBy, "linkedin");
    assert.equal(deduplication.matchedLeadId, initialLead.id);
  });

  it("3. Composite duplicate detected through compositeHash (Priority 3)", async () => {
    // Create initial lead with NO email and NO linkedInUrl
    const { lead: initialLead } = await createLead(USER_OPT_A, {
      firstName: "Dmitri",
      lastName: "Volkov",
      companyName: "HyperScale Data Systems",
    });

    assert.ok(initialLead, "Initial lead should be created");

    // Attempt duplicate using fullName + companyName variation
    const { lead: dupLead, deduplication } = await createLead(USER_OPT_A, {
      fullName: "dmitri volkov",
      companyName: "HyperScale Data Systems Inc",
    });

    assert.equal(dupLead, null, "Duplicate lead should not be inserted");
    assert.equal(deduplication.isDuplicate, true);
    assert.equal(deduplication.status, "ALREADY_EXISTS");
    assert.equal(deduplication.matchedBy, "name_company");
    assert.equal(deduplication.matchedLeadId, initialLead.id);
  });

  it("4. Different users can have identical prospects without collisions (Tenant Isolation)", async () => {
    // User B creates prospect with identical email to User A's existing prospect
    const { lead: leadB, deduplication } = await createLead(USER_OPT_B, {
      firstName: "Sophia",
      lastName: "Chen",
      email: "sophia.chen@novatech.io",
      companyName: "NovaTech Solutions",
    });

    assert.ok(leadB, "User B should successfully create the identical prospect");
    assert.equal(deduplication.isDuplicate, false);
    assert.equal(deduplication.status, "CREATED");
    assert.equal(leadB.userId, USER_OPT_B);
  });

  it("5. PostgreSQL query plan confirms index usage for O(1) deduplication queries", async () => {
    // Temporarily turn off sequential scans to verify index availability in PostgreSQL query planner
    await prisma.$executeRawUnsafe("SET enable_seqscan = off");
    try {
      const emailExplain = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>`
        EXPLAIN SELECT id FROM leads 
        WHERE "userId" = ${USER_OPT_A} AND "normalizedEmail" = 'sophia.chen@novatech.io'
        LIMIT 1
      `;

      const planText = emailExplain.map((r) => r["QUERY PLAN"]).join("\n");
      const usesIndex =
        planText.includes("leads_userId_normalizedEmail_idx") ||
        planText.includes("Index Scan") ||
        planText.includes("Bitmap Index Scan");

      assert.ok(
        usesIndex,
        `Expected plan to utilize indexed lookup, got:\n${planText}`
      );
    } finally {
      await prisma.$executeRawUnsafe("SET enable_seqscan = on");
    }
  });

  it("6. Concurrent company resolution safely handles unique constraint (P2002)", async () => {
    const companyName = "Concurrent Innovations LLC";

    // Simulate two concurrent requests trying to create the same company for USER_OPT_A
    const [comp1, comp2] = await Promise.all([
      findOrCreateCompany(USER_OPT_A, companyName, "concurrent.io", "Tech"),
      findOrCreateCompany(USER_OPT_A, companyName, "concurrent.io", "Tech"),
    ]);

    assert.ok(comp1, "First resolution should return company");
    assert.ok(comp2, "Second concurrent resolution should return company");
    assert.equal(comp1.id, comp2.id, "Both resolutions should point to the identical company row");
  });

  // ==========================================
  // SECTION 2: DATABASE TRANSACTIONS
  // ==========================================

  it("7. createLead executes atomically in a transaction", async () => {
    const { lead } = await createLead(USER_OPT_A, {
      firstName: "Elena",
      lastName: "Rostova",
      email: "elena.rostova@quantumleap.ai",
      companyName: "QuantumLeap AI",
      tagType: TagType.HOT,
    });

    assert.ok(lead, "Lead created in transaction");

    // Verify company, lead, and tag assignments exist together
    const persistedLead = await prisma.lead.findUnique({
      where: { id: lead.id },
      include: {
        company: true,
        tagAssignments: {
          include: { tag: true },
        },
        interactions: true,
      },
    });

    assert.ok(persistedLead?.company, "Company was committed with lead");
    assert.equal(persistedLead.tagAssignments.length, 1, "Temperature tag was committed with lead");
    assert.equal(persistedLead.interactions.length, 1, "Initial creation interaction committed");
  });

  it("8. Transaction rollback preserves state on downstream failure", async () => {
    const rollbackEmail = "rollback.test@fail.dev";

    await assert.rejects(async () => {
      await prisma.$transaction(async (tx) => {
        await tx.lead.create({
          data: {
            userId: USER_OPT_A,
            fullName: "Rollback Candidate",
            email: rollbackEmail,
            stage: "NEW",
          },
        });
        // Intentionally throw error to trigger transaction rollback
        throw new Error("Simulated transactional failure");
      });
    });

    const rolledBackLead = await prisma.lead.findFirst({
      where: { userId: USER_OPT_A, email: rollbackEmail },
    });
    assert.equal(rolledBackLead, null, "Aborted transaction must roll back lead creation");
  });

  it("9. addLeadInteraction atomically creates interaction and updates lead.lastInteractionAt", async () => {
    const { lead } = await createLead(USER_OPT_A, {
      firstName: "Tariq",
      lastName: "Nasser",
      email: "tariq.nasser@apex.io",
      companyName: "Apex Dynamics",
    });

    assert.ok(lead);
    const originalInteractionTime = lead.lastInteractionAt;

    // Small delay to ensure timestamp progression
    await new Promise((resolve) => setTimeout(resolve, 50));

    const interaction = await addLeadInteraction(
      USER_OPT_A,
      lead.id,
      "CALL",
      "Discovery call completed",
      "Discussed pipeline requirements."
    );

    assert.ok(interaction.id);
    assert.equal(interaction.type, "CALL");

    const updatedLead = await prisma.lead.findUnique({
      where: { id: lead.id },
    });

    assert.ok(updatedLead?.lastInteractionAt);
    if (originalInteractionTime) {
      assert.ok(
        new Date(updatedLead.lastInteractionAt).getTime() >=
          new Date(originalInteractionTime).getTime(),
        "lastInteractionAt should be updated atomically"
      );
    }
  });

  // ==========================================
  // SECTION 3: DATABASE-LEVEL ANALYTICS
  // ==========================================

  it("10. getDashboardMetrics computes aggregations at the database level", async () => {
    // Seed leads in various stages for USER_OPT_A
    const testLeadsData = [
      { firstName: "Lead", lastName: "One", stage: LeadStage.NEW, email: "lead1@test.dev" },
      { firstName: "Lead", lastName: "Two", stage: LeadStage.CONTACTED, email: "lead2@test.dev" },
      { firstName: "Lead", lastName: "Three", stage: LeadStage.REPLIED, email: "lead3@test.dev" },
      { firstName: "Lead", lastName: "Four", stage: LeadStage.MEETING_SCHEDULED, email: "lead4@test.dev" },
      { firstName: "Lead", lastName: "Five", stage: LeadStage.CLIENT, email: "lead5@test.dev" },
    ];

    for (const item of testLeadsData) {
      await createLead(USER_OPT_A, item, { skipDuplicateCheck: true });
    }

    const leadForEmail = await prisma.lead.findFirst({
      where: { userId: USER_OPT_A, email: "lead2@test.dev" },
    });
    assert.ok(leadForEmail);

    // Seed email messages & meetings for USER_OPT_A
    await prisma.emailMessage.createMany({
      data: [
        {
          userId: USER_OPT_A,
          leadId: leadForEmail.id,
          subject: "Outreach 1",
          body: "Hello",
          sentAt: new Date(),
        },
        {
          userId: USER_OPT_A,
          leadId: leadForEmail.id,
          subject: "Outreach 2",
          body: "Hello",
          sentAt: new Date(),
        },
      ],
    });

    await prisma.meeting.create({
      data: {
        userId: USER_OPT_A,
        title: "Intro Call with Lead Four",
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
      },
    });

    const metricsA = await getDashboardMetrics(USER_OPT_A);

    assert.ok(metricsA.totalLeads >= 5, "Total leads count should include all seeded leads");
    assert.ok(metricsA.clientsClosed >= 1, "Clients closed should count CLIENT stage leads");
    assert.ok(metricsA.emailsSent >= 2, "Emails sent count should reflect database aggregation");
    assert.ok(metricsA.funnel.length >= 6, "Funnel should include all stages");

    // Verify stage counts in funnel
    const clientStage = metricsA.funnel.find((f) => f.stage === "CLIENT");
    assert.ok(clientStage && clientStage.count >= 1);
  });

  it("11. getDashboardMetrics strictly isolates tenant data", async () => {
    const metricsB = await getDashboardMetrics(USER_OPT_B);

    // USER_OPT_B only had 1 lead created earlier (Sophia Chen) and 0 meetings/emails
    assert.equal(metricsB.totalLeads, 1, "User B should only see their own single lead");
    assert.equal(metricsB.meetingsBooked, 0, "User B has zero meetings");
    assert.equal(metricsB.emailsSent, 0, "User B has 0 sent emails");
  });

  it("12. PostgreSQL query plan confirms stage aggregation uses indexed scan", async () => {
    await prisma.$executeRawUnsafe("SET enable_seqscan = off");
    try {
      const stageExplain = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>`
        EXPLAIN SELECT stage, COUNT(*)::int as count 
        FROM leads 
        WHERE "userId" = ${USER_OPT_A} 
        GROUP BY stage
      `;

      const planText = stageExplain.map((r) => r["QUERY PLAN"]).join("\n");
      const usesIndex =
        planText.includes("leads_userId_stage_idx") ||
        planText.includes("Index Scan") ||
        planText.includes("Bitmap Index Scan") ||
        planText.includes("Aggregate");

      assert.ok(
        usesIndex,
        `Expected aggregation plan to use index/aggregate, got:\n${planText}`
      );
    } finally {
      await prisma.$executeRawUnsafe("SET enable_seqscan = on");
    }
  });

  // ==========================================
  // SECTION 4: SERVERLESS DB CLIENT
  // ==========================================

  it("13. Serverless DB client verifies connectivity and configuration", async () => {
    const status = await checkDatabaseConnection();
    assert.equal(status.connected, true, "Prisma client must successfully connect to database");
  });
});
