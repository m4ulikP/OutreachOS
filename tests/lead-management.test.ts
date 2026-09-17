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
const USER_A = "usr_lm_tenant_a";
const USER_B = "usr_lm_tenant_b";

let cookieUserA: string;
let cookieUserB: string;

async function createAuthCookie(id: string, email: string, name: string): Promise<string> {
  const token = await encode({
    token: { id, email, name },
    secret: TEST_SECRET,
  });
  return `next-auth.session-token=${token}`;
}

describe("Milestone 3.1: Production-Grade Lead Management Backend", () => {
  let createdLeadA1Id: string;
  let createdLeadA2Id: string;
  let createdLeadA3Id: string;
  let createdLeadBId: string;
  let tagA1Id: string;
  let tagA2Id: string;
  let tagBId: string;

  before(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;

    cookieUserA = await createAuthCookie(USER_A, "tenant_a@lm.test", "Tenant A");
    cookieUserB = await createAuthCookie(USER_B, "tenant_b@lm.test", "Tenant B");

    // Clean up test data for test users
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
        { id: USER_A, email: "tenant_a@lm.test", name: "Tenant A" },
        { id: USER_B, email: "tenant_b@lm.test", name: "Tenant B" },
      ],
    });

    // Seed initial leads for Tenant A
    const resA1 = await postLeads(
      new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieUserA },
        body: JSON.stringify({
          fullName: "Alice Wonderland",
          email: "alice@wonderland.io",
          companyName: "Acme Corp",
          website: "https://wonderland.io",
          linkedInUrl: "https://linkedin.com/in/alicewonderland",
          stage: "NEW",
          tagType: "HOT",
        }),
      })
    );
    const dataA1 = await resA1.json();
    createdLeadA1Id = dataA1.lead.id;

    const resA2 = await postLeads(
      new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieUserA },
        body: JSON.stringify({
          fullName: "Bob Builder",
          email: "bob@builder.org",
          companyName: "Zenith Global",
          website: "https://builder.org",
          linkedInUrl: "https://linkedin.com/in/bobbuilder",
          stage: "CONTACTED",
          tagType: "WARM",
        }),
      })
    );
    const dataA2 = await resA2.json();
    createdLeadA2Id = dataA2.lead.id;

    // Seed lead without company for Tenant A (to test null-company sorting)
    const resA3 = await postLeads(
      new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieUserA },
        body: JSON.stringify({
          fullName: "Charlie Solo",
          email: "charlie@freelance.dev",
          stage: "CLIENT",
          tagType: "COLD",
        }),
      })
    );
    const dataA3 = await resA3.json();
    createdLeadA3Id = dataA3.lead.id;

    // Seed initial lead for Tenant B
    const resB = await postLeads(
      new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieUserB },
        body: JSON.stringify({
          fullName: "Diana Prince",
          email: "diana@themyscira.gov",
          companyName: "Themyscira Embassy",
          website: "https://themyscira.gov",
          stage: "MEETING_SCHEDULED",
        }),
      })
    );
    const dataB = await resB.json();
    createdLeadBId = dataB.lead.id;

    // Seed tags for Tenant A and Tenant B
    const tagA1Res = await postTags(
      new NextRequest("http://localhost:3000/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieUserA },
        body: JSON.stringify({ name: "Enterprise", type: "CUSTOM", color: "#3b82f6" }),
      })
    );
    const tagA1Data = await tagA1Res.json();
    tagA1Id = tagA1Data.tag.id;

    const tagA2Res = await postTags(
      new NextRequest("http://localhost:3000/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieUserA },
        body: JSON.stringify({ name: "VIP", type: "HOT", color: "#ef4444" }),
      })
    );
    const tagA2Data = await tagA2Res.json();
    tagA2Id = tagA2Data.tag.id;

    const tagBRes = await postTags(
      new NextRequest("http://localhost:3000/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieUserB },
        body: JSON.stringify({ name: "TenantBTag", type: "CUSTOM" }),
      })
    );
    const tagBData = await tagBRes.json();
    tagBId = tagBData.tag.id;
  });

  after(async () => {
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

  // ============================================================
  // 1. LEAD SEARCH
  // ============================================================
  describe("1. Search", () => {
    it("1.1 searches leads by name (partial & case-insensitive)", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?search=alice", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 1);
      assert.equal(data.leads[0].fullName, "Alice Wonderland");
    });

    it("1.2 searches leads by company name", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?search=Zenith", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 1);
      assert.equal(data.leads[0].fullName, "Bob Builder");
    });

    it("1.3 searches leads by email", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?search=wonderland.io", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 1);
      assert.equal(data.leads[0].fullName, "Alice Wonderland");
    });

    it("1.4 searches leads by website", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?search=builder.org", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 1);
      assert.equal(data.leads[0].fullName, "Bob Builder");
    });

    it("1.5 searches leads by LinkedIn profile URL", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?search=alicewonderland", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 1);
      assert.equal(data.leads[0].fullName, "Alice Wonderland");
    });

    it("1.6 empty / whitespace search cleanly returns all tenant leads without error", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?search=%20%20%20", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 3);
    });

    it("1.7 tenant isolation: search never returns another tenant's leads", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?search=Diana", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 0, "Tenant A should not find Diana belonging to Tenant B");
    });
  });

  // ============================================================
  // 2. FILTERING
  // ============================================================
  describe("2. Filtering", () => {
    it("2.1 filters leads by stage", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?stage=NEW", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 1);
      assert.equal(data.leads[0].stage, "NEW");
    });

    it("2.2 filters leads by temperature tag (HOT/WARM/COLD)", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?temperature=HOT", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 1);
      assert.equal(data.leads[0].fullName, "Alice Wonderland");
    });

    it("2.3 temperature filter rejects CUSTOM type with 400", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?temperature=CUSTOM", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "VALIDATION_ERROR");
    });

    it("2.4 filters leads by tag name", async () => {
      // Assign tagA1 ("Enterprise") to lead A1
      await postLeadTag(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA1Id}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({ tagId: tagA1Id }),
        }),
        { params: { id: createdLeadA1Id } }
      );

      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?tag=Enterprise", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 1);
      assert.equal(data.leads[0].id, createdLeadA1Id);
    });

    it("2.5 filters leads by tagId", async () => {
      const res = await getLeads(
        new NextRequest(`http://localhost:3000/api/leads?tagId=${tagA1Id}`, {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 1);
      assert.equal(data.leads[0].id, createdLeadA1Id);
    });

    it("2.6 combined tag and tagId filter executes deterministic AND without overwriting", async () => {
      // Matching tag and tagId for same lead -> returns lead
      const resMatch = await getLeads(
        new NextRequest(`http://localhost:3000/api/leads?tag=Enterprise&tagId=${tagA1Id}`, {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(resMatch.status, 200);
      const dataMatch = await resMatch.json();
      assert.equal(dataMatch.leads.length, 1);

      // Conflicting tag and tagId (tagA1 name is Enterprise, but tagId is tagA2) -> returns 0
      const resMismatch = await getLeads(
        new NextRequest(`http://localhost:3000/api/leads?tag=Enterprise&tagId=${tagA2Id}`, {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(resMismatch.status, 200);
      const dataMismatch = await resMismatch.json();
      assert.equal(dataMismatch.leads.length, 0);
    });

    it("2.7 combined search + stage + tag filter", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?search=Alice&stage=NEW&tag=Enterprise", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 1);
      assert.equal(data.leads[0].fullName, "Alice Wonderland");
    });

    it("2.8 date-based filter: createdAfter / createdBefore with ISO validation", async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const futureDate = new Date(Date.now() + 3600000).toISOString();

      const res = await getLeads(
        new NextRequest(`http://localhost:3000/api/leads?createdAfter=${pastDate}&createdBefore=${futureDate}`, {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 3);
    });

    it("2.9 invalid date filter returns 400 validation error", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?createdAfter=not-a-valid-date", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "VALIDATION_ERROR");
    });
  });

  // ============================================================
  // 3. SORTING
  // ============================================================
  describe("3. Sorting", () => {
    it("3.1 sorts by name ascending and descending", async () => {
      const resAsc = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?sortBy=name&sortOrder=asc", {
          headers: { Cookie: cookieUserA },
        })
      );
      const dataAsc = await resAsc.json();
      assert.equal(dataAsc.leads[0].fullName, "Alice Wonderland");

      const resDesc = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?sortBy=name&sortOrder=desc", {
          headers: { Cookie: cookieUserA },
        })
      );
      const dataDesc = await resDesc.json();
      assert.equal(dataDesc.leads[0].fullName, "Charlie Solo");
    });

    it("3.2 sorts by company and handles leads with null companies safely and deterministically", async () => {
      const resAsc = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?sortBy=company&sortOrder=asc", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(resAsc.status, 200);
      const dataAsc = await resAsc.json();
      assert.equal(dataAsc.leads.length, 3);

      const resDesc = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?sortBy=company&sortOrder=desc", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(resDesc.status, 200);
      const dataDesc = await resDesc.json();
      assert.equal(dataDesc.leads.length, 3);
    });

    it("3.3 sorts by updatedAt, lastInteractionAt, stage, and createdAt", async () => {
      for (const field of ["updatedAt", "lastInteractionAt", "stage", "createdAt"]) {
        const res = await getLeads(
          new NextRequest(`http://localhost:3000/api/leads?sortBy=${field}&sortOrder=desc`, {
            headers: { Cookie: cookieUserA },
          })
        );
        assert.equal(res.status, 200, `Sort by ${field} should succeed`);
      }
    });

    it("3.4 rejects invalid sortBy field with 400", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?sortBy=unsupportedField", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "VALIDATION_ERROR");
    });

    it("3.5 rejects invalid sortOrder with 400", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?sortOrder=sideways", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 400);
    });
  });

  // ============================================================
  // 4. PAGINATION
  // ============================================================
  describe("4. Pagination", () => {
    it("4.1 returns page metadata and correct pageSize slice", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?page=1&pageSize=2", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 2);
      assert.equal(data.total, 3);
      assert.equal(data.page, 1);
      assert.equal(data.pageSize, 2);
      assert.equal(data.totalPages, 2);
    });

    it("4.2 retrieves subsequent pages", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?page=2&pageSize=2", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.leads.length, 1);
      assert.equal(data.page, 2);
    });

    it("4.3 rejects excessive pageSize (> 100) with 400", async () => {
      const res = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?pageSize=101", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 400);
    });

    it("4.4 rejects non-positive or invalid page with 400", async () => {
      const resZero = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?page=0", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(resZero.status, 400);

      const resNeg = await getLeads(
        new NextRequest("http://localhost:3000/api/leads?page=-1", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(resNeg.status, 400);
    });
  });

  // ============================================================
  // 5. TAG MANAGEMENT & MULTI-TENANT ISOLATION
  // ============================================================
  describe("5. Tag Management", () => {
    it("5.1 lists tags scoped to authenticated tenant", async () => {
      const res = await getTags(
        new NextRequest("http://localhost:3000/api/tags", {
          headers: { Cookie: cookieUserA },
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      // Tenant A should have WARM, HOT, COLD (from lead creation) + Enterprise, VIP
      const names = data.tags.map((t: any) => t.name);
      assert.ok(names.includes("Enterprise"));
      assert.ok(names.includes("VIP"));
      assert.ok(!names.includes("TenantBTag"), "Must not list Tenant B's tag");
    });

    it("5.2 assigns tag to lead and handles duplicate assignment idempotently", async () => {
      // First assignment
      const res1 = await postLeadTag(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA2Id}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({ tagId: tagA2Id }),
        }),
        { params: { id: createdLeadA2Id } }
      );
      assert.equal(res1.status, 201);

      // Duplicate assignment should succeed gracefully without error
      const res2 = await postLeadTag(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA2Id}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({ tagId: tagA2Id }),
        }),
        { params: { id: createdLeadA2Id } }
      );
      assert.equal(res2.status, 201);
    });

    it("5.3 removes tag from lead", async () => {
      const res = await deleteLeadTag(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA2Id}/tags/${tagA2Id}`, {
          method: "DELETE",
          headers: { Cookie: cookieUserA },
        }),
        { params: { id: createdLeadA2Id, tagId: tagA2Id } }
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    });

    it("5.4 cross-tenant tag protection: cannot assign another tenant's tag (403)", async () => {
      const res = await postLeadTag(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA1Id}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({ tagId: tagBId }), // Tenant B's tag
        }),
        { params: { id: createdLeadA1Id } }
      );
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.code, "FORBIDDEN");
    });

    it("5.5 cross-tenant lead protection: cannot assign tag to another tenant's lead (403)", async () => {
      const res = await postLeadTag(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadBId}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({ tagId: tagA1Id }),
        }),
        { params: { id: createdLeadBId } }
      );
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.code, "FORBIDDEN");
    });

    it("5.6 cross-tenant tag deletion protection: cannot remove tag from another tenant's lead (403)", async () => {
      const res = await deleteLeadTag(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadBId}/tags/${tagBId}`, {
          method: "DELETE",
          headers: { Cookie: cookieUserA },
        }),
        { params: { id: createdLeadBId, tagId: tagBId } }
      );
      assert.equal(res.status, 403);
    });
  });

  // ============================================================
  // 6. LEAD NOTES
  // ============================================================
  describe("6. Lead Notes", () => {
    it("6.1 saves and updates lead notes safely", async () => {
      const noteContent = "Discussed budget of $50k and start date in Q4.";
      const res = await patchLeadById(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA1Id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({ notes: noteContent }),
        }),
        { params: { id: createdLeadA1Id } }
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.lead.notes, noteContent);

      // Verify retrieval returns notes
      const getRes = await getLeadById(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA1Id}`, {
          headers: { Cookie: cookieUserA },
        }),
        { params: { id: createdLeadA1Id } }
      );
      const getData = await getRes.json();
      assert.equal(getData.lead.notes, noteContent);
    });

    it("6.2 rejects notes exceeding 5000 characters with 400", async () => {
      const oversizedNotes = "A".repeat(5001);
      const res = await patchLeadById(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA1Id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({ notes: oversizedNotes }),
        }),
        { params: { id: createdLeadA1Id } }
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "VALIDATION_ERROR");
    });

    it("6.3 cross-tenant notes update rejected with 403", async () => {
      const res = await patchLeadById(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadBId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({ notes: "Malicious cross-tenant note update" }),
        }),
        { params: { id: createdLeadBId } }
      );
      assert.equal(res.status, 403);
    });
  });

  // ============================================================
  // 7. INTERACTIONS & TIMELINE RETRIEVAL
  // ============================================================
  describe("7. Interaction Timeline", () => {
    it("7.1 records interaction and updates lead lastInteractionAt", async () => {
      const leadBefore = await prisma.lead.findUnique({
        where: { id: createdLeadA1Id },
        select: { lastInteractionAt: true },
      });

      const res = await postInteractions(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA1Id}/interactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            type: "CALL",
            title: "Introductory Discovery Call",
            description: "Client confirmed interest in full suite.",
          }),
        }),
        { params: { id: createdLeadA1Id } }
      );
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.interaction.title, "Introductory Discovery Call");

      const leadAfter = await prisma.lead.findUnique({
        where: { id: createdLeadA1Id },
        select: { lastInteractionAt: true },
      });

      assert.ok(leadAfter?.lastInteractionAt);
      if (leadBefore?.lastInteractionAt) {
        assert.ok(
          new Date(leadAfter.lastInteractionAt).getTime() >=
            new Date(leadBefore.lastInteractionAt).getTime()
        );
      }
    });

    it("7.2 retrieves timeline via GET /api/leads/[id]/interactions with ordering", async () => {
      const res = await getInteractions(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA1Id}/interactions`, {
          headers: { Cookie: cookieUserA },
        }),
        { params: { id: createdLeadA1Id } }
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.interactions));
      assert.ok(data.interactions.length >= 2); // Initial creation STAGE_CHANGE + Discovery CALL
      assert.equal(data.interactions[0].title, "Introductory Discovery Call"); // Ordered createdAt desc
    });

    it("7.3 cross-tenant interaction retrieval rejected with 403", async () => {
      const res = await getInteractions(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadBId}/interactions`, {
          headers: { Cookie: cookieUserA },
        }),
        { params: { id: createdLeadBId } }
      );
      assert.equal(res.status, 403);
    });

    it("7.4 cross-tenant interaction creation rejected with 403", async () => {
      const res = await postInteractions(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadBId}/interactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            type: "NOTE",
            title: "Unauthorized note",
          }),
        }),
        { params: { id: createdLeadBId } }
      );
      assert.equal(res.status, 403);
    });
  });

  // ============================================================
  // 8. STAGE MANAGEMENT
  // ============================================================
  describe("8. Stage Management", () => {
    it("8.1 updates stage, logs STAGE_CHANGE interaction, and does NOT alter lastInteractionAt", async () => {
      // Get lead's current lastInteractionAt
      const beforeUpdate = await prisma.lead.findUnique({
        where: { id: createdLeadA2Id },
        select: { lastInteractionAt: true, stage: true },
      });

      const res = await patchLeadById(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA2Id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({ stage: "POSITIVE_REPLY" }),
        }),
        { params: { id: createdLeadA2Id } }
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.lead.stage, "POSITIVE_REPLY");

      const afterUpdate = await prisma.lead.findUnique({
        where: { id: createdLeadA2Id },
        select: { lastInteractionAt: true },
      });

      // Semantic check: stage change does NOT alter lastInteractionAt
      assert.equal(
        beforeUpdate?.lastInteractionAt?.toISOString(),
        afterUpdate?.lastInteractionAt?.toISOString(),
        "Stage change must NOT alter lastInteractionAt"
      );

      // Verify STAGE_CHANGE timeline interaction was logged
      const interactions = await prisma.leadInteraction.findMany({
        where: { leadId: createdLeadA2Id, type: "STAGE_CHANGE" },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(interactions.length > 0);
      assert.ok(interactions[0].title.includes("POSITIVE_REPLY"));
    });

    it("8.2 rejects invalid stage with 400", async () => {
      const res = await patchLeadById(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA2Id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({ stage: "NOT_A_REAL_STAGE" }),
        }),
        { params: { id: createdLeadA2Id } }
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "VALIDATION_ERROR");
    });
  });

  // ============================================================
  // 9. BULK OPERATIONS
  // ============================================================
  describe("9. Bulk Operations", () => {
    it("9.1 executes bulk UPDATE_STAGE across multiple leads atomically", async () => {
      const res = await postBulkLeads(
        new NextRequest("http://localhost:3000/api/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            action: "UPDATE_STAGE",
            leadIds: [createdLeadA1Id, createdLeadA2Id],
            stage: "MEETING_SCHEDULED",
          }),
        })
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.action, "UPDATE_STAGE");
      assert.equal(data.affectedCount, 2);

      // Verify both leads are now in MEETING_SCHEDULED stage
      const leads = await prisma.lead.findMany({
        where: { id: { in: [createdLeadA1Id, createdLeadA2Id] } },
        select: { stage: true },
      });
      assert.ok(leads.every((l) => l.stage === "MEETING_SCHEDULED"));
    });

    it("9.2 executes bulk ASSIGN_TAG and bulk REMOVE_TAG", async () => {
      // Bulk assign tagA1
      const resAssign = await postBulkLeads(
        new NextRequest("http://localhost:3000/api/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            action: "ASSIGN_TAG",
            leadIds: [createdLeadA1Id, createdLeadA2Id],
            tagId: tagA1Id,
          }),
        })
      );
      assert.equal(resAssign.status, 200);
      const dataAssign = await resAssign.json();
      assert.equal(dataAssign.affectedCount, 2);

      // Bulk remove tagA1
      const resRemove = await postBulkLeads(
        new NextRequest("http://localhost:3000/api/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            action: "REMOVE_TAG",
            leadIds: [createdLeadA1Id, createdLeadA2Id],
            tagId: tagA1Id,
          }),
        })
      );
      assert.equal(resRemove.status, 200);
      const dataRemove = await resRemove.json();
      assert.equal(dataRemove.affectedCount >= 1, true);
    });

    it("9.3 enforces strict maximum of 100 lead IDs (rejects >100 with 400)", async () => {
      // Generate 101 valid cuids
      const fakeLeadIds = Array.from({ length: 101 }, (_, i) => `cmu5o${String(i).padStart(20, "0")}`);
      const res = await postBulkLeads(
        new NextRequest("http://localhost:3000/api/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            action: "UPDATE_STAGE",
            leadIds: fakeLeadIds,
            stage: "CLIENT",
          }),
        })
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "VALIDATION_ERROR");
    });

    it("9.4 cross-tenant lead IDs in bulk payload abort atomically with 403 (no partial mutation)", async () => {
      // Payload has Tenant A's lead AND Tenant B's lead
      const res = await postBulkLeads(
        new NextRequest("http://localhost:3000/api/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            action: "UPDATE_STAGE",
            leadIds: [createdLeadA1Id, createdLeadBId],
            stage: "CLOSED_LOST",
          }),
        })
      );
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.code, "FORBIDDEN");

      // Verify atomicity: Tenant A's lead was NOT modified!
      const leadA1 = await prisma.lead.findUnique({
        where: { id: createdLeadA1Id },
        select: { stage: true },
      });
      assert.notEqual(leadA1?.stage, "CLOSED_LOST", "Lead must not be mutated when bulk request fails auth check");
    });

    it("9.5 cross-tenant tag in bulk payload is rejected with 403", async () => {
      const res = await postBulkLeads(
        new NextRequest("http://localhost:3000/api/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            action: "ASSIGN_TAG",
            leadIds: [createdLeadA1Id],
            tagId: tagBId, // Tenant B's tag
          }),
        })
      );
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.code, "FORBIDDEN");
    });

    it("9.6 executes bulk DELETE and deletes target leads safely", async () => {
      // Seed a temporary lead to delete
      const tempRes = await postLeads(
        new NextRequest("http://localhost:3000/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            fullName: "Temp Lead For Bulk Delete",
            email: "temp.bulk.del@test.com",
          }),
        })
      );
      const tempData = await tempRes.json();
      const tempLeadId = tempData.lead.id;

      const delRes = await postBulkLeads(
        new NextRequest("http://localhost:3000/api/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            action: "DELETE",
            leadIds: [tempLeadId],
          }),
        })
      );
      assert.equal(delRes.status, 200);
      const delData = await delRes.json();
      assert.equal(delData.affectedCount, 1);

      const check = await prisma.lead.findUnique({ where: { id: tempLeadId } });
      assert.equal(check, null, "Deleted lead should no longer exist in database");
    });
  });

  // ============================================================
  // 10. SECURITY & MASS ASSIGNMENT PROTECTION
  // ============================================================
  describe("10. Security & Mass-Assignment Protection", () => {
    it("10.1 client-supplied userId in POST /api/tags is rejected with 400", async () => {
      const res = await postTags(
        new NextRequest("http://localhost:3000/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            name: "SpoofedTag",
            userId: USER_B,
          }),
        })
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "VALIDATION_ERROR");
    });

    it("10.2 client-supplied userId in POST /api/leads/bulk is rejected with 400", async () => {
      const res = await postBulkLeads(
        new NextRequest("http://localhost:3000/api/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            action: "UPDATE_STAGE",
            leadIds: [createdLeadA1Id],
            stage: "CLIENT",
            userId: USER_B,
          }),
        })
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "VALIDATION_ERROR");
    });

    it("10.3 mass assignment of forbidden internal fields (compositeHash, id, createdAt) rejected with 400", async () => {
      const res = await patchLeadById(
        new NextRequest(`http://localhost:3000/api/leads/${createdLeadA1Id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: cookieUserA },
          body: JSON.stringify({
            compositeHash: "spoofed-hash-value",
          }),
        }),
        { params: { id: createdLeadA1Id } }
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, "VALIDATION_ERROR");
    });
  });
});
