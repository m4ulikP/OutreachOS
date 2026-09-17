import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/db";
import { LeadStage, FollowUpStatus, TagType } from "@prisma/client";
import {
  transitionLeadStage,
  createFollowUp,
  updateFollowUp,
  completeFollowUp,
  cancelFollowUp,
  listLeadFollowUps,
} from "../src/lib/services/lifecycle-service";
import { getDashboardMetrics } from "../src/lib/services/analytics-service";
import { POST as postStage } from "../src/app/api/leads/[id]/stage/route";
import {
  GET as getFollowUps,
  POST as postFollowUps,
} from "../src/app/api/leads/[id]/follow-ups/route";
import { PATCH as patchFollowUp } from "../src/app/api/leads/[id]/follow-ups/[followUpId]/route";
import { POST as postCompleteFollowUp } from "../src/app/api/leads/[id]/follow-ups/[followUpId]/complete/route";
import { POST as postCancelFollowUp } from "../src/app/api/leads/[id]/follow-ups/[followUpId]/cancel/route";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long-for-jwt-signing";
const USER_A = "usr_lifecycle_tenant_a";
const USER_B = "usr_lifecycle_tenant_b";

let cookieUserA: string;
let cookieUserB: string;

async function createAuthCookie(id: string, email: string, name: string): Promise<string> {
  const token = await encode({
    token: { id, email, name },
    secret: TEST_SECRET,
  });
  return `next-auth.session-token=${token}`;
}

describe("Milestone 3.4: Production-Grade Lead Lifecycle & Follow-Up Engine", () => {
  let leadA1Id: string;
  let leadA2Id: string;
  let leadB1Id: string;
  const initialInteractionTime = new Date("2026-09-01T12:00:00.000Z");

  before(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;

    cookieUserA = await createAuthCookie(USER_A, "tenant_a@lifecycle.test", "Maulik Pandey");
    cookieUserB = await createAuthCookie(USER_B, "tenant_b@lifecycle.test", "Tenant B");

    // Clean up test data for test users
    await prisma.followUp.deleteMany({
      where: { lead: { userId: { in: [USER_A, USER_B] } } },
    });
    await prisma.leadInteraction.deleteMany({
      where: { userId: { in: [USER_A, USER_B] } },
    });
    await prisma.leadTagAssignment.deleteMany({
      where: { lead: { userId: { in: [USER_A, USER_B] } } },
    });
    await prisma.leadTag.deleteMany({
      where: { userId: { in: [USER_A, USER_B] } },
    });
    await prisma.lead.deleteMany({
      where: { userId: { in: [USER_A, USER_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [USER_A, USER_B] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_A, USER_B] } },
    });

    // Create users in DB
    await prisma.user.createMany({
      data: [
        { id: USER_A, email: "tenant_a@lifecycle.test", name: "Maulik Pandey" },
        { id: USER_B, email: "tenant_b@lifecycle.test", name: "Tenant B" },
      ],
    });

    // Seed test leads for Tenant A
    const leadA1 = await prisma.lead.create({
      data: {
        userId: USER_A,
        fullName: "Jane Doe",
        email: "jane@acmecorp.io",
        stage: LeadStage.NEW,
        normalizedEmail: "jane@acmecorp.io",
        compositeHash: "jane-doe:none",
        lastInteractionAt: initialInteractionTime,
      },
    });
    leadA1Id = leadA1.id;

    const leadA2 = await prisma.lead.create({
      data: {
        userId: USER_A,
        fullName: "John Smith",
        email: "john@techcorp.io",
        stage: LeadStage.NEW,
        normalizedEmail: "john@techcorp.io",
        compositeHash: "john-smith:none",
        lastInteractionAt: initialInteractionTime,
      },
    });
    leadA2Id = leadA2.id;

    // Seed test lead for Tenant B
    const leadB1 = await prisma.lead.create({
      data: {
        userId: USER_B,
        fullName: "Bob Rival",
        email: "bob@rival.io",
        stage: LeadStage.NEW,
        normalizedEmail: "bob@rival.io",
        compositeHash: "bob-rival:none",
        lastInteractionAt: initialInteractionTime,
      },
    });
    leadB1Id = leadB1.id;
  });

  after(async () => {
    await prisma.followUp.deleteMany({
      where: { lead: { userId: { in: [USER_A, USER_B] } } },
    });
    await prisma.leadInteraction.deleteMany({
      where: { userId: { in: [USER_A, USER_B] } },
    });
    await prisma.leadTagAssignment.deleteMany({
      where: { lead: { userId: { in: [USER_A, USER_B] } } },
    });
    await prisma.leadTag.deleteMany({
      where: { userId: { in: [USER_A, USER_B] } },
    });
    await prisma.lead.deleteMany({
      where: { userId: { in: [USER_A, USER_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [USER_A, USER_B] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_A, USER_B] } },
    });
  });

  // ========================================================
  // STAGE TRANSITIONS
  // ========================================================
  describe("Stage Transitions & Lifecycle Semantics", () => {
    it("1. NEW -> CONTACTED succeeds", async () => {
      const res = await postStage(
        new NextRequest(`http://localhost:3000/api/leads/${leadA1Id}/stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            stage: "CONTACTED",
            notes: "Sent initial cold pitch",
            reason: "First touch completed",
          }),
        }),
        { params: { id: leadA1Id } }
      );

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.transitioned, true);
      assert.equal(data.lead.stage, "CONTACTED");

      const dbLead = await prisma.lead.findUnique({ where: { id: leadA1Id } });
      assert.equal(dbLead?.stage, LeadStage.CONTACTED);
    });

    it("2. NEW -> MEETING_SCHEDULED succeeds", async () => {
      const res = await postStage(
        new NextRequest(`http://localhost:3000/api/leads/${leadA2Id}/stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            stage: "MEETING_SCHEDULED",
            notes: "Prospect booked via Calendly",
          }),
        }),
        { params: { id: leadA2Id } }
      );

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.lead.stage, "MEETING_SCHEDULED");

      const dbLead = await prisma.lead.findUnique({ where: { id: leadA2Id } });
      assert.equal(dbLead?.stage, LeadStage.MEETING_SCHEDULED);
    });

    it("3. NEW -> CLIENT succeeds", async () => {
      const res = await postStage(
        new NextRequest(`http://localhost:3000/api/leads/${leadA1Id}/stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            stage: "CLIENT",
            notes: "Signed retainer contract",
          }),
        }),
        { params: { id: leadA1Id } }
      );

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.lead.stage, "CLIENT");

      const dbLead = await prisma.lead.findUnique({
        where: { id: leadA1Id },
        include: { tagAssignments: { include: { tag: true } } },
      });
      assert.equal(dbLead?.stage, LeadStage.CLIENT);
      assert.ok(dbLead?.tagAssignments.some((ta) => ta.tag.name === "CLIENT"));
    });

    it("4. NEW -> CLOSED_LOST succeeds", async () => {
      const res = await postStage(
        new NextRequest(`http://localhost:3000/api/leads/${leadA2Id}/stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            stage: "CLOSED_LOST",
            reason: "Budget constraints",
          }),
        }),
        { params: { id: leadA2Id } }
      );

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.lead.stage, "CLOSED_LOST");

      const dbLead = await prisma.lead.findUnique({ where: { id: leadA2Id } });
      assert.equal(dbLead?.stage, LeadStage.CLOSED_LOST);
      assert.ok(dbLead !== null); // Confirms lead was not deleted
    });

    it("5. Same-stage transition is a no-op", async () => {
      const res = await postStage(
        new NextRequest(`http://localhost:3000/api/leads/${leadA2Id}/stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            stage: "CLOSED_LOST",
          }),
        }),
        { params: { id: leadA2Id } }
      );

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.transitioned, false);
      assert.ok(data.message.includes("already in stage"));
    });

    it("6. Same-stage transition creates no duplicate timeline event", async () => {
      const beforeCount = await prisma.leadInteraction.count({
        where: { leadId: leadA2Id, type: "STAGE_CHANGE" },
      });

      await transitionLeadStage(USER_A, leadA2Id, LeadStage.CLOSED_LOST);

      const afterCount = await prisma.leadInteraction.count({
        where: { leadId: leadA2Id, type: "STAGE_CHANGE" },
      });

      assert.equal(afterCount, beforeCount);
    });

    it("7. Invalid stage returns validation error", async () => {
      const res = await postStage(
        new NextRequest(`http://localhost:3000/api/leads/${leadA1Id}/stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            stage: "NOT_A_REAL_STAGE",
          }),
        }),
        { params: { id: leadA1Id } }
      );

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "VALIDATION_ERROR");
    });

    it("8. Stage change does NOT modify lastInteractionAt", async () => {
      // Create fresh lead with known lastInteractionAt
      const freshLead = await prisma.lead.create({
        data: {
          userId: USER_A,
          fullName: "Stage Test Lead",
          stage: LeadStage.NEW,
          compositeHash: "stage-test-lead:none",
          lastInteractionAt: initialInteractionTime,
        },
      });

      await transitionLeadStage(USER_A, freshLead.id, LeadStage.CONTACTED);

      const afterLead = await prisma.lead.findUnique({
        where: { id: freshLead.id },
      });

      assert.equal(
        afterLead?.lastInteractionAt?.getTime(),
        initialInteractionTime.getTime()
      );
    });

    it("9. STAGE_CHANGE contains correct fromStage/toStage metadata", async () => {
      const testLead = await prisma.lead.create({
        data: {
          userId: USER_A,
          fullName: "Audit Metadata Lead",
          stage: LeadStage.CONTACTED,
          compositeHash: "audit-metadata-lead:none",
        },
      });

      const result = await transitionLeadStage(
        USER_A,
        testLead.id,
        LeadStage.POSITIVE_REPLY,
        {
          notes: "Prospect wants portfolio",
          reason: "Received positive response",
        }
      );

      assert.ok(result.interaction);
      const interaction = await prisma.leadInteraction.findUnique({
        where: { id: result.interaction.id },
      });

      assert.equal(interaction?.type, "STAGE_CHANGE");
      const meta = interaction?.metadata as Record<string, any>;
      assert.equal(meta?.fromStage, "CONTACTED");
      assert.equal(meta?.toStage, "POSITIVE_REPLY");
      assert.equal(meta?.notes, "Prospect wants portfolio");
      assert.equal(meta?.reason, "Received positive response");
    });

    it("10. Stage + timeline event are atomic", async () => {
      const atomicLead = await prisma.lead.create({
        data: {
          userId: USER_A,
          fullName: "Atomic Lead",
          stage: LeadStage.NEW,
          compositeHash: "atomic-lead:none",
        },
      });

      const res = await transitionLeadStage(
        USER_A,
        atomicLead.id,
        LeadStage.CONTACTED
      );

      assert.equal(res.transitioned, true);
      const [persistedLead, persistedEvent] = await Promise.all([
        prisma.lead.findUnique({ where: { id: atomicLead.id } }),
        prisma.leadInteraction.findFirst({
          where: { leadId: atomicLead.id, type: "STAGE_CHANGE" },
        }),
      ]);

      assert.equal(persistedLead?.stage, LeadStage.CONTACTED);
      assert.ok(persistedEvent !== null);
    });
  });

  // ========================================================
  // FOLLOW-UPS
  // ========================================================
  describe("Follow-Up Scheduling & Management Engine", () => {
    let followUp1Id: string;
    let followUp2Id: string;

    it("11. Future follow-up creates SCHEDULED record", async () => {
      const futureDate = new Date(Date.now() + 86400000 * 3); // 3 days in future

      const res = await postFollowUps(
        new NextRequest(
          `http://localhost:3000/api/leads/${leadA1Id}/follow-ups`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookieUserA },
            body: JSON.stringify({
              scheduledFor: futureDate.toISOString(),
              delayDays: 3,
              notes: "Follow up on proposal feedback",
            }),
          }
        ),
        { params: { id: leadA1Id } }
      );

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.followUp.status, "SCHEDULED");
      assert.equal(data.followUp.stepNumber, 1);
      followUp1Id = data.followUp.id;

      const dbFollowUp = await prisma.followUp.findUnique({
        where: { id: followUp1Id },
      });
      assert.equal(dbFollowUp?.status, FollowUpStatus.SCHEDULED);
    });

    it("12. stepNumber is sequential", async () => {
      const futureDate = new Date(Date.now() + 86400000 * 7);

      const f2 = await createFollowUp(USER_A, leadA1Id, {
        scheduledFor: futureDate.toISOString(),
        delayDays: 7,
        notes: "Second touchpoint",
      });

      assert.equal(f2.stepNumber, 2);
      followUp2Id = f2.id;
    });

    it("13. List returns scheduled follow-ups sorted correctly", async () => {
      const list = await listLeadFollowUps(USER_A, leadA1Id);
      assert.ok(list.length >= 2);
      // Scheduled dates should be sorted ascending
      for (let i = 0; i < list.length - 1; i++) {
        assert.ok(
          new Date(list[i].scheduledFor).getTime() <=
            new Date(list[i + 1].scheduledFor).getTime()
        );
      }
    });

    it("14. Overdue detection works", async () => {
      // Create a follow-up directly with a past scheduled date
      const pastDate = new Date(Date.now() - 86400000 * 2); // 2 days ago
      const overdueFollowUp = await prisma.followUp.create({
        data: {
          leadId: leadA1Id,
          stepNumber: 3,
          delayDays: 0,
          status: FollowUpStatus.SCHEDULED,
          scheduledFor: pastDate,
        },
      });

      const list = await listLeadFollowUps(USER_A, leadA1Id);
      const found = list.find((f) => f.id === overdueFollowUp.id);
      assert.ok(found);
      assert.equal(found.isOverdue, true);

      // Clean up the overdue one
      await prisma.followUp.delete({ where: { id: overdueFollowUp.id } });
    });

    it("15. Complete changes status to SENT", async () => {
      const completed = await completeFollowUp(USER_A, followUp1Id, "Sent check-in email");
      assert.equal(completed.status, FollowUpStatus.SENT);

      const dbFollowUp = await prisma.followUp.findUnique({
        where: { id: followUp1Id },
      });
      assert.equal(dbFollowUp?.status, FollowUpStatus.SENT);
    });

    it("16. Complete sets sentAt", async () => {
      const dbFollowUp = await prisma.followUp.findUnique({
        where: { id: followUp1Id },
      });
      assert.ok(dbFollowUp);
      assert.ok(dbFollowUp.sentAt !== null);
      assert.ok(dbFollowUp.sentAt instanceof Date);
    });

    it("17. Complete updates lastInteractionAt", async () => {
      const dbLead = await prisma.lead.findUnique({
        where: { id: leadA1Id },
      });
      assert.ok(dbLead?.lastInteractionAt);
      assert.ok(
        dbLead.lastInteractionAt.getTime() > initialInteractionTime.getTime()
      );
    });

    it("18. Complete creates interaction", async () => {
      const interaction = await prisma.leadInteraction.findFirst({
        where: {
          leadId: leadA1Id,
          type: "NOTE",
          title: { contains: "Completed" },
        },
        orderBy: { createdAt: "desc" },
      });

      assert.ok(interaction !== null);
      assert.ok(interaction.description?.includes("Sent check-in email"));
    });

    it("19. Complete is atomic", async () => {
      // Trying to complete an already SENT follow-up should throw
      await assert.rejects(
        async () => {
          await completeFollowUp(USER_A, followUp1Id, "Duplicate completion attempt");
        },
        /already been completed/
      );
    });

    it("20. Cancel changes status to CANCELLED", async () => {
      const cancelled = await cancelFollowUp(
        USER_A,
        followUp2Id,
        "Lead replied beforehand"
      );
      assert.equal(cancelled.status, FollowUpStatus.CANCELLED);

      const dbFollowUp = await prisma.followUp.findUnique({
        where: { id: followUp2Id },
      });
      assert.equal(dbFollowUp?.status, FollowUpStatus.CANCELLED);
    });

    it("21. Cancel preserves scheduledFor/history", async () => {
      const dbFollowUp = await prisma.followUp.findUnique({
        where: { id: followUp2Id },
      });
      assert.ok(dbFollowUp?.scheduledFor);
      assert.equal(dbFollowUp.stepNumber, 2);
    });

    it("22. Cancel does not update lastInteractionAt", async () => {
      const leadBefore = await prisma.lead.findUnique({
        where: { id: leadA1Id },
      });
      const timestampBefore = leadBefore?.lastInteractionAt?.getTime();

      // Create a follow-up and immediately cancel it
      const tempFollowUp = await createFollowUp(USER_A, leadA1Id, {
        scheduledFor: new Date(Date.now() + 86400000 * 5).toISOString(),
      });

      await cancelFollowUp(USER_A, tempFollowUp.id, "Testing no lastInteraction update");

      const leadAfter = await prisma.lead.findUnique({
        where: { id: leadA1Id },
      });
      assert.equal(leadAfter?.lastInteractionAt?.getTime(), timestampBefore);
    });

    it("23. Cross-tenant user cannot view another user's follow-up", async () => {
      const res = await getFollowUps(
        new NextRequest(
          `http://localhost:3000/api/leads/${leadA1Id}/follow-ups`,
          {
            headers: { Cookie: cookieUserB },
          }
        ),
        { params: { id: leadA1Id } }
      );

      assert.equal(res.status, 404);
    });

    it("24. Cross-tenant user cannot update another user's follow-up", async () => {
      const res = await patchFollowUp(
        new NextRequest(
          `http://localhost:3000/api/leads/${leadA1Id}/follow-ups/${followUp1Id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Cookie: cookieUserB },
            body: JSON.stringify({ notes: "Malicious cross-tenant update" }),
          }
        ),
        { params: { id: leadA1Id, followUpId: followUp1Id } }
      );

      assert.equal(res.status, 404);
    });

    it("25. Cross-tenant user cannot complete another user's follow-up", async () => {
      const res = await postCompleteFollowUp(
        new NextRequest(
          `http://localhost:3000/api/leads/${leadA1Id}/follow-ups/${followUp1Id}/complete`,
          {
            method: "POST",
            headers: { Cookie: cookieUserB },
          }
        ),
        { params: { id: leadA1Id, followUpId: followUp1Id } }
      );

      assert.equal(res.status, 404);
    });

    it("26. Cross-tenant user cannot cancel another user's follow-up", async () => {
      const res = await postCancelFollowUp(
        new NextRequest(
          `http://localhost:3000/api/leads/${leadA1Id}/follow-ups/${followUp1Id}/cancel`,
          {
            method: "POST",
            headers: { Cookie: cookieUserB },
          }
        ),
        { params: { id: leadA1Id, followUpId: followUp1Id } }
      );

      assert.equal(res.status, 404);
    });

    it("27. Follow-up cannot be accessed through a mismatched leadId", async () => {
      // User A owns both leadA1 and leadA2. followUp1Id belongs to leadA1Id.
      const res = await postCompleteFollowUp(
        new NextRequest(
          `http://localhost:3000/api/leads/${leadA2Id}/follow-ups/${followUp1Id}/complete`,
          {
            method: "POST",
            headers: { Cookie: cookieUserA },
          }
        ),
        { params: { id: leadA2Id, followUpId: followUp1Id } }
      );

      assert.equal(res.status, 404);
    });
  });

  // ========================================================
  // ANALYTICS INTEGRATION
  // ========================================================
  describe("Lifecycle Analytics Integration", () => {
    let analyticsUserId: string;

    before(async () => {
      analyticsUserId = "usr_analytics_lifecycle_test";
      await prisma.user.deleteMany({
        where: { id: analyticsUserId },
      });
      await prisma.user.create({
        data: {
          id: analyticsUserId,
          email: "analytics@lifecycle.test",
          name: "Maulik Pandey",
        },
      });

      // Seed exact pipeline for analytics user:
      // 1 NEW, 1 CONTACTED, 1 CLIENT, 1 CLOSED_LOST -> total 4 leads
      const [l1, l2, l3, l4] = await Promise.all([
        prisma.lead.create({
          data: {
            userId: analyticsUserId,
            fullName: "Lead New",
            stage: LeadStage.NEW,
            compositeHash: "lead-new:none",
          },
        }),
        prisma.lead.create({
          data: {
            userId: analyticsUserId,
            fullName: "Lead Contacted",
            stage: LeadStage.CONTACTED,
            compositeHash: "lead-contacted:none",
          },
        }),
        prisma.lead.create({
          data: {
            userId: analyticsUserId,
            fullName: "Lead Client",
            stage: LeadStage.CLIENT,
            compositeHash: "lead-client:none",
          },
        }),
        prisma.lead.create({
          data: {
            userId: analyticsUserId,
            fullName: "Lead Lost",
            stage: LeadStage.CLOSED_LOST,
            compositeHash: "lead-lost:none",
          },
        }),
      ]);

      // Seed follow-ups:
      // 1 SCHEDULED in future (pending)
      // 1 SCHEDULED in past (overdue)
      // 1 SENT (completed)
      await prisma.followUp.createMany({
        data: [
          {
            leadId: l1.id,
            stepNumber: 1,
            delayDays: 2,
            status: FollowUpStatus.SCHEDULED,
            scheduledFor: new Date(Date.now() + 86400000 * 2), // future
          },
          {
            leadId: l2.id,
            stepNumber: 1,
            delayDays: 0,
            status: FollowUpStatus.SCHEDULED,
            scheduledFor: new Date(Date.now() - 86400000 * 2), // past
          },
          {
            leadId: l3.id,
            stepNumber: 1,
            delayDays: 0,
            status: FollowUpStatus.SENT,
            scheduledFor: new Date(Date.now() - 86400000 * 5),
            sentAt: new Date(Date.now() - 86400000 * 4),
          },
        ],
      });
    });

    after(async () => {
      await prisma.followUp.deleteMany({
        where: { lead: { userId: analyticsUserId } },
      });
      await prisma.lead.deleteMany({
        where: { userId: analyticsUserId },
      });
      await prisma.user.deleteMany({
        where: { id: analyticsUserId },
      });
    });

    it("28. activeProspects is correct (total - CLIENT - CLOSED_LOST)", async () => {
      const metrics = await getDashboardMetrics(analyticsUserId);
      assert.equal(metrics.totalLeads, 4);
      // activeProspects = 4 - 1 (CLIENT) - 1 (CLOSED_LOST) = 2
      assert.equal(metrics.activeProspects, 2);
    });

    it("29. closedLostLeads is correct", async () => {
      const metrics = await getDashboardMetrics(analyticsUserId);
      assert.equal(metrics.closedLostLeads, 1);
      assert.equal(metrics.stageCounts.CLOSED_LOST, 1);
    });

    it("30. pendingFollowUps is correct", async () => {
      const metrics = await getDashboardMetrics(analyticsUserId);
      // 2 SCHEDULED follow-ups exist
      assert.equal(metrics.pendingFollowUps, 2);
    });

    it("31. overdueFollowUps is correct", async () => {
      const metrics = await getDashboardMetrics(analyticsUserId);
      // Exactly 1 SCHEDULED in the past
      assert.equal(metrics.overdueFollowUps, 1);
    });

    it("32. Existing analytics metrics remain correct", async () => {
      const metrics = await getDashboardMetrics(analyticsUserId);
      assert.equal(metrics.clientsClosed, 1);
      assert.equal(metrics.stageCounts.NEW, 1);
      assert.equal(metrics.stageCounts.CONTACTED, 1);
      assert.equal(metrics.stageCounts.CLIENT, 1);
      assert.ok(Array.isArray(metrics.funnel));
      assert.ok(metrics.funnel.length > 0);
    });
  });
});
