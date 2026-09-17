import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/db";
import { GET as getLeads, POST as postLeads } from "../src/app/api/leads/route";
import {
  GET as getLeadById,
  PATCH as patchLeadById,
  DELETE as deleteLeadById,
} from "../src/app/api/leads/[id]/route";
import {
  POST as postInteractions,
  GET as getInteractions,
} from "../src/app/api/leads/[id]/interactions/route";
import { GET as getTags, POST as postTags } from "../src/app/api/tags/route";
import { POST as postLeadTag } from "../src/app/api/leads/[id]/tags/route";
import { DELETE as deleteLeadTag } from "../src/app/api/leads/[id]/tags/[tagId]/route";
import { POST as postBulkLeads } from "../src/app/api/leads/bulk/route";
import { LeadStage, TagType } from "@prisma/client";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long-for-jwt-signing";
const USER_UI_A = "usr_ui_test_maulik_a";
const USER_UI_B = "usr_ui_test_other_b";

let cookieUserA: string;
let cookieUserB: string;

async function createAuthCookie(id: string, email: string, name: string): Promise<string> {
  const token = await encode({
    token: { id, email, name },
    secret: TEST_SECRET,
  });
  return `next-auth.session-token=${token}`;
}

describe("Milestone 3.2: Production Lead Management UI & Stage Counts Test Suite", () => {
  let leadA1Id: string;
  let leadA2Id: string;
  let leadA3Id: string;
  let leadB1Id: string;
  let tagA1Id: string;
  let tagA2Id: string;

  before(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;

    cookieUserA = await createAuthCookie(USER_UI_A, "maulik.test.suite@outreachos.dev", "Maulik Pandey");
    cookieUserB = await createAuthCookie(USER_UI_B, "competitor.test.suite@external.test", "Other Developer");

    // Clean up test data for these users
    await prisma.leadInteraction.deleteMany({
      where: { userId: { in: [USER_UI_A, USER_UI_B] } },
    });
    await prisma.leadTagAssignment.deleteMany({
      where: { lead: { userId: { in: [USER_UI_A, USER_UI_B] } } },
    });
    await prisma.leadTag.deleteMany({
      where: { userId: { in: [USER_UI_A, USER_UI_B] } },
    });
    await prisma.lead.deleteMany({
      where: { userId: { in: [USER_UI_A, USER_UI_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [USER_UI_A, USER_UI_B] } },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: [USER_UI_A, USER_UI_B] } },
          { email: { in: ["maulik.test.suite@outreachos.dev", "competitor.test.suite@external.test"] } },
        ],
      },
    });

    // Create test user records
    await prisma.user.create({
      data: {
        id: USER_UI_A,
        email: "maulik.test.suite@outreachos.dev",
        name: "Maulik Pandey",
      },
    });

    await prisma.user.create({
      data: {
        id: USER_UI_B,
        email: "competitor.test.suite@external.test",
        name: "Other Developer",
      },
    });

    // Seed User A leads across different stages
    const l1 = await prisma.lead.create({
      data: {
        userId: USER_UI_A,
        firstName: "Elena",
        lastName: "Rostova",
        fullName: "Elena Rostova",
        email: "elena@acmecorp.dev",
        normalizedEmail: "elena@acmecorp.dev",
        stage: LeadStage.NEW,
      },
    });
    leadA1Id = l1.id;

    const l2 = await prisma.lead.create({
      data: {
        userId: USER_UI_A,
        firstName: "Marcus",
        lastName: "Vance",
        fullName: "Marcus Vance",
        email: "marcus@cloudscale.io",
        normalizedEmail: "marcus@cloudscale.io",
        stage: LeadStage.MEETING_SCHEDULED,
      },
    });
    leadA2Id = l2.id;

    const l3 = await prisma.lead.create({
      data: {
        userId: USER_UI_A,
        firstName: "Sophia",
        lastName: "Lin",
        fullName: "Sophia Lin",
        email: "sophia@apexdesign.co",
        normalizedEmail: "sophia@apexdesign.co",
        stage: LeadStage.CLIENT,
      },
    });
    leadA3Id = l3.id;

    // Seed User B leads (for tenant isolation test)
    const lb1 = await prisma.lead.create({
      data: {
        userId: USER_UI_B,
        firstName: "Dave",
        lastName: "Miller",
        fullName: "Dave Miller",
        email: "dave@competitor.test",
        normalizedEmail: "dave@competitor.test",
        stage: LeadStage.NEW,
      },
    });
    leadB1Id = lb1.id;

    // Create custom tags for User A
    const t1 = await prisma.leadTag.create({
      data: {
        userId: USER_UI_A,
        name: "VIP Enterprise",
        type: TagType.CUSTOM,
      },
    });
    tagA1Id = t1.id;

    const t2 = await prisma.leadTag.create({
      data: {
        userId: USER_UI_A,
        name: "High Budget",
        type: TagType.CUSTOM,
      },
    });
    tagA2Id = t2.id;
  });

  after(async () => {
    // Cleanup
    await prisma.leadInteraction.deleteMany({
      where: { userId: { in: [USER_UI_A, USER_UI_B] } },
    });
    await prisma.leadTagAssignment.deleteMany({
      where: { lead: { userId: { in: [USER_UI_A, USER_UI_B] } } },
    });
    await prisma.leadTag.deleteMany({
      where: { userId: { in: [USER_UI_A, USER_UI_B] } },
    });
    await prisma.lead.deleteMany({
      where: { userId: { in: [USER_UI_A, USER_UI_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [USER_UI_A, USER_UI_B] } },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: [USER_UI_A, USER_UI_B] } },
          { email: { in: ["maulik.test.suite@outreachos.dev", "competitor.test.suite@external.test"] } },
        ],
      },
    });
  });

  it("1. STAGE COUNTS: stageCounts are returned and strictly scoped to authenticated user", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      headers: { cookie: cookieUserA },
    });
    const res = await getLeads(req, {} as any);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.stageCounts, "stageCounts should be returned in GET /api/leads response");

    // Check that all stages are present in counts
    assert.equal(typeof data.stageCounts.NEW, "number");
    assert.equal(typeof data.stageCounts.CONTACTED, "number");
    assert.equal(typeof data.stageCounts.FOLLOW_UP, "number");
    assert.equal(typeof data.stageCounts.REPLIED, "number");
    assert.equal(typeof data.stageCounts.POSITIVE_REPLY, "number");
    assert.equal(typeof data.stageCounts.MEETING_SCHEDULED, "number");
    assert.equal(typeof data.stageCounts.CLIENT, "number");
    assert.equal(typeof data.stageCounts.CLOSED_LOST, "number");

    // User A has 1 NEW, 1 MEETING_SCHEDULED, 1 CLIENT
    assert.equal(data.stageCounts.NEW, 1);
    assert.equal(data.stageCounts.MEETING_SCHEDULED, 1);
    assert.equal(data.stageCounts.CLIENT, 1);
    assert.equal(data.stageCounts.CONTACTED, 0);
  });

  it("2. STAGE COUNTS TENANT ISOLATION: User B counts do not leak into User A", async () => {
    // Check User B's stageCounts
    const reqB = new NextRequest("http://localhost:3000/api/leads", {
      headers: { cookie: cookieUserB },
    });
    const resB = await getLeads(reqB, {} as any);
    assert.equal(resB.status, 200);
    const dataB = await resB.json();

    // User B only has 1 NEW lead
    assert.equal(dataB.stageCounts.NEW, 1);
    assert.equal(dataB.stageCounts.MEETING_SCHEDULED, 0);
    assert.equal(dataB.stageCounts.CLIENT, 0);
    assert.equal(dataB.total, 1);
  });

  it("3. STAGE COUNTS: Global pipeline counts remain consistent regardless of lead filters", async () => {
    // When querying with a stage filter (e.g. stage=CLIENT), the paginated leads are filtered,
    // but stageCounts still reflects the entire authenticated pipeline for the ribbon
    const req = new NextRequest("http://localhost:3000/api/leads?stage=CLIENT", {
      headers: { cookie: cookieUserA },
    });
    const res = await getLeads(req, {} as any);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.leads.length, 1);
    assert.equal(data.leads[0].fullName, "Sophia Lin");
    assert.equal(data.total, 1); // Only 1 CLIENT lead

    // stageCounts still shows global pipeline counts for User A
    assert.equal(data.stageCounts.NEW, 1);
    assert.equal(data.stageCounts.MEETING_SCHEDULED, 1);
    assert.equal(data.stageCounts.CLIENT, 1);
  });

  it("4. BULK ACTION BAR: UPDATE_STAGE updates multiple leads atomically", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieUserA,
      },
      body: JSON.stringify({
        action: "UPDATE_STAGE",
        leadIds: [leadA1Id, leadA2Id],
        stage: LeadStage.CONTACTED,
      }),
    });

    const res = await postBulkLeads(req, {} as any);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.action, "UPDATE_STAGE");
    assert.equal(data.affectedCount, 2);

    // Verify DB update
    const updated1 = await prisma.lead.findUnique({ where: { id: leadA1Id } });
    const updated2 = await prisma.lead.findUnique({ where: { id: leadA2Id } });
    assert.equal(updated1?.stage, LeadStage.CONTACTED);
    assert.equal(updated2?.stage, LeadStage.CONTACTED);
  });

  it("5. BULK ACTION BAR: ASSIGN_TAG and REMOVE_TAG work on multiple leads", async () => {
    // Assign tagA1Id to leadA1 and leadA2
    const assignReq = new NextRequest("http://localhost:3000/api/leads/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieUserA,
      },
      body: JSON.stringify({
        action: "ASSIGN_TAG",
        leadIds: [leadA1Id, leadA2Id],
        tagId: tagA1Id,
      }),
    });

    const assignRes = await postBulkLeads(assignReq, {} as any);
    assert.equal(assignRes.status, 200);

    // Verify tags assigned
    const countAssignments = await prisma.leadTagAssignment.count({
      where: { tagId: tagA1Id },
    });
    assert.equal(countAssignments, 2);

    // Now remove tagA1Id via bulk
    const removeReq = new NextRequest("http://localhost:3000/api/leads/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieUserA,
      },
      body: JSON.stringify({
        action: "REMOVE_TAG",
        leadIds: [leadA1Id],
        tagId: tagA1Id,
      }),
    });

    const removeRes = await postBulkLeads(removeReq, {} as any);
    assert.equal(removeRes.status, 200);

    const remaining = await prisma.leadTagAssignment.count({
      where: { tagId: tagA1Id },
    });
    assert.equal(remaining, 1);
  });

  it("6. BULK ACTION SECURITY: Cannot perform bulk action on another tenant's leads", async () => {
    // User A attempts to update User B's lead
    const req = new NextRequest("http://localhost:3000/api/leads/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieUserA,
      },
      body: JSON.stringify({
        action: "UPDATE_STAGE",
        leadIds: [leadB1Id],
        stage: LeadStage.CLIENT,
      }),
    });

    const res = await postBulkLeads(req, {} as any);
    // Should fail with 403 or 404
    assert.ok(res.status === 403 || res.status === 404);

    // Verify User B's lead was not changed
    const unchanged = await prisma.lead.findUnique({ where: { id: leadB1Id } });
    assert.equal(unchanged?.stage, LeadStage.NEW);
  });

  it("7. LEAD DETAIL: Log interaction note via POST /api/leads/[id]/interactions", async () => {
    const req = new NextRequest(`http://localhost:3000/api/leads/${leadA3Id}/interactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieUserA,
      },
      body: JSON.stringify({
        type: "NOTE",
        title: "Initial Scope Review Call",
        description: "Discussed deliverables and agreed on 2-week milestone cycle.",
      }),
    });

    const res = await postInteractions(req, { params: { id: leadA3Id } } as any);
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.interaction);
    assert.equal(data.interaction.title, "Initial Scope Review Call");
    assert.equal(data.interaction.type, "NOTE");

    // Fetch interactions list
    const getReq = new NextRequest(`http://localhost:3000/api/leads/${leadA3Id}/interactions`, {
      headers: { cookie: cookieUserA },
    });
    const getRes = await getInteractions(getReq, { params: { id: leadA3Id } } as any);
    assert.equal(getRes.status, 200);
    const listData = await getRes.json();
    assert.ok(Array.isArray(listData.interactions));
    assert.ok(listData.interactions.some((i: any) => i.title === "Initial Scope Review Call"));
  });

  it("8. LEAD DETAIL: Assign and remove tag via dedicated lead tag endpoints", async () => {
    // Assign tagA2Id to leadA3Id
    const assignReq = new NextRequest(`http://localhost:3000/api/leads/${leadA3Id}/tags`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieUserA,
      },
      body: JSON.stringify({ tagId: tagA2Id }),
    });

    const assignRes = await postLeadTag(assignReq, { params: { id: leadA3Id } } as any);
    assert.equal(assignRes.status, 201);

    // Verify tag is assigned
    const leadDetailReq = new NextRequest(`http://localhost:3000/api/leads/${leadA3Id}`, {
      headers: { cookie: cookieUserA },
    });
    const leadDetailRes = await getLeadById(leadDetailReq, { params: { id: leadA3Id } } as any);
    assert.equal(leadDetailRes.status, 200);
    const detailData = await leadDetailRes.json();
    assert.ok(
      detailData.lead.tagAssignments.some((ta: any) => ta.tag.id === tagA2Id),
      "Tag should be in lead's tagAssignments"
    );

    // Remove tagA2Id from leadA3Id
    const deleteReq = new NextRequest(
      `http://localhost:3000/api/leads/${leadA3Id}/tags/${tagA2Id}`,
      {
        method: "DELETE",
        headers: { cookie: cookieUserA },
      }
    );
    const deleteRes = await deleteLeadTag(deleteReq, {
      params: { id: leadA3Id, tagId: tagA2Id },
    } as any);
    assert.equal(deleteRes.status, 200);
  });

  it("9. BULK ACTION: DELETE permanently removes multiple selected leads", async () => {
    // Create temporary lead to delete
    const tempLead = await prisma.lead.create({
      data: {
        userId: USER_UI_A,
        fullName: "Temp Prospect To Delete",
        email: "temp.delete@example.com",
        normalizedEmail: "temp.delete@example.com",
      },
    });

    const req = new NextRequest("http://localhost:3000/api/leads/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieUserA,
      },
      body: JSON.stringify({
        action: "DELETE",
        leadIds: [tempLead.id],
      }),
    });

    const res = await postBulkLeads(req, {} as any);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.action, "DELETE");
    assert.equal(data.affectedCount, 1);

    const check = await prisma.lead.findUnique({ where: { id: tempLead.id } });
    assert.equal(check, null);
  });
});
