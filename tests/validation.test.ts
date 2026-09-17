import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/db";
import { handleApiError } from "../src/lib/api-response";
import { GET as getLeads, POST as postLeads } from "../src/app/api/leads/route";
import {
  GET as getLeadById,
  PATCH as patchLeadById,
  DELETE as deleteLeadById,
} from "../src/app/api/leads/[id]/route";
import { POST as postInteractions } from "../src/app/api/leads/[id]/interactions/route";
import { POST as postFinder } from "../src/app/api/finder/route";
import { LeadStage, TagType } from "@prisma/client";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long-for-jwt-signing";
const USER_VAL_A = "usr_val_tenant_a";
const USER_VAL_B = "usr_val_tenant_b";

let authHeaderUserA: string;
let authHeaderUserB: string;

async function createAuthCookie(id: string, email: string, name: string): Promise<string> {
  const token = await encode({
    token: { id, email, name },
    secret: TEST_SECRET,
  });
  return `next-auth.session-token=${token}`;
}

describe("Milestone 4: Server-Side Zod Validation & Standardized API Errors", () => {
  before(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;

    authHeaderUserA = await createAuthCookie(USER_VAL_A, "tenant_a@val.test", "Tenant A");
    authHeaderUserB = await createAuthCookie(USER_VAL_B, "tenant_b@val.test", "Tenant B");

    // Clean up test data
    await prisma.leadInteraction.deleteMany({
      where: { userId: { in: [USER_VAL_A, USER_VAL_B] } },
    });
    await prisma.leadTagAssignment.deleteMany({
      where: { lead: { userId: { in: [USER_VAL_A, USER_VAL_B] } } },
    });
    await prisma.leadTag.deleteMany({
      where: { userId: { in: [USER_VAL_A, USER_VAL_B] } },
    });
    await prisma.lead.deleteMany({
      where: { userId: { in: [USER_VAL_A, USER_VAL_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [USER_VAL_A, USER_VAL_B] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_VAL_A, USER_VAL_B] } },
    });

    // Seed test users
    await prisma.user.createMany({
      data: [
        { id: USER_VAL_A, email: "tenant_a@val.test", name: "Tenant A" },
        { id: USER_VAL_B, email: "tenant_b@val.test", name: "Tenant B" },
      ],
    });
  });

  after(async () => {
    await prisma.leadInteraction.deleteMany({
      where: { userId: { in: [USER_VAL_A, USER_VAL_B] } },
    });
    await prisma.leadTagAssignment.deleteMany({
      where: { lead: { userId: { in: [USER_VAL_A, USER_VAL_B] } } },
    });
    await prisma.leadTag.deleteMany({
      where: { userId: { in: [USER_VAL_A, USER_VAL_B] } },
    });
    await prisma.lead.deleteMany({
      where: { userId: { in: [USER_VAL_A, USER_VAL_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [USER_VAL_A, USER_VAL_B] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_VAL_A, USER_VAL_B] } },
    });
  });

  // ==========================================
  // SECTION 1: LEADS (POST /api/leads)
  // ==========================================

  it("1. Valid lead payload succeeds", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        firstName: "Alexander",
        lastName: "Wright",
        email: "alexander.wright@stellarscale.dev",
        companyName: "StellarScale Systems",
        jobTitle: "VP Engineering",
        stage: LeadStage.NEW,
        tagType: TagType.HOT,
      }),
    });

    const res = await postLeads(req);
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.lead);
    assert.equal(data.lead.email, "alexander.wright@stellarscale.dev");
    assert.equal(data.deduplication.isDuplicate, false);
  });

  it("2. Missing required identifying fields → 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        jobTitle: "Senior Architect",
        location: "San Francisco, CA",
      }),
    });

    const res = await postLeads(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
    assert.ok(data.error.includes("identifying detail"));
  });

  it("3. Invalid email → 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        fullName: "Invalid Email User",
        email: "not-a-valid-email-address",
      }),
    });

    const res = await postLeads(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
    assert.ok(data.fields?.email);
  });

  it("4. Invalid LinkedIn URL → 400 where URL is supplied", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        fullName: "Twitter User",
        linkedInUrl: "https://twitter.com/prospect_profile",
      }),
    });

    const res = await postLeads(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
    assert.ok(data.fields?.linkedInUrl);
  });

  it("5. Invalid LeadStage → 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        fullName: "Stage Test",
        email: "stage@test.dev",
        stage: "INVALID_STAGE_PROSPECT",
      }),
    });

    const res = await postLeads(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
    assert.ok(data.fields?.stage);
  });

  it("6. Oversized string → 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        fullName: "A".repeat(300), // Max is 200
        email: "oversize@test.dev",
      }),
    });

    const res = await postLeads(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("7. userId supplied in body cannot override authenticated user", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        userId: USER_VAL_B, // Malicious mass-assignment attempt
        fullName: "Injected User Prospect",
        email: "injected@test.dev",
      }),
    });

    const res = await postLeads(req);
    // Strict schema rejects forbidden/unexpected userId key
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  // ==========================================
  // SECTION 2: UPDATE (PATCH /api/leads/[id])
  // ==========================================

  let createdLeadId: string;

  it("8. Valid partial update succeeds", async () => {
    // First create a lead to update
    const setupReq = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        fullName: "Lead To Update",
        email: "update.target@test.dev",
        stage: LeadStage.NEW,
      }),
    });
    const setupRes = await postLeads(setupReq);
    const setupData = await setupRes.json();
    createdLeadId = setupData.lead.id;

    // Now send valid partial PATCH
    const patchReq = new NextRequest(`http://localhost:3000/api/leads/${createdLeadId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        notes: "Detailed discovery call notes recorded.",
        jobTitle: "Chief Technology Officer",
      }),
    });

    const patchRes = await patchLeadById(patchReq, { params: { id: createdLeadId } });
    assert.equal(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.equal(patchData.lead.notes, "Detailed discovery call notes recorded.");
    assert.equal(patchData.lead.jobTitle, "Chief Technology Officer");
  });

  it("9. Empty update object → 400", async () => {
    const req = new NextRequest(`http://localhost:3000/api/leads/${createdLeadId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({}),
    });

    const res = await patchLeadById(req, { params: { id: createdLeadId } });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("10. Invalid stage on update → 400", async () => {
    const req = new NextRequest(`http://localhost:3000/api/leads/${createdLeadId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        stage: "BOGUS_STAGE",
      }),
    });

    const res = await patchLeadById(req, { params: { id: createdLeadId } });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("11. Attempt to change userId via update → rejected (400)", async () => {
    const req = new NextRequest(`http://localhost:3000/api/leads/${createdLeadId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        userId: USER_VAL_B,
        notes: "Trying to transfer ownership",
      }),
    });

    const res = await patchLeadById(req, { params: { id: createdLeadId } });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  // ==========================================
  // SECTION 3: INTERACTIONS (POST /api/leads/[id]/interactions)
  // ==========================================

  it("12. Valid interaction succeeds", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/leads/${createdLeadId}/interactions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: authHeaderUserA,
        },
        body: JSON.stringify({
          type: "CALL",
          title: "Introduction call completed",
          description: "Prospect is interested in Phase 2 timeline.",
        }),
      }
    );

    const res = await postInteractions(req, { params: { id: createdLeadId } });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.interaction);
    assert.equal(data.interaction.type, "CALL");
    assert.equal(data.interaction.title, "Introduction call completed");
  });

  it("13. Invalid interaction type → 400", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/leads/${createdLeadId}/interactions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: authHeaderUserA,
        },
        body: JSON.stringify({
          type: "CARRIER_PIGEON",
          title: "Failed communication",
        }),
      }
    );

    const res = await postInteractions(req, { params: { id: createdLeadId } });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("14. Oversized content → 400", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/leads/${createdLeadId}/interactions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: authHeaderUserA,
        },
        body: JSON.stringify({
          type: "NOTE",
          title: "Oversized Note Title".repeat(20), // Exceeds 200 chars
        }),
      }
    );

    const res = await postInteractions(req, { params: { id: createdLeadId } });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  // ==========================================
  // SECTION 4: FINDER (POST /api/finder)
  // ==========================================

  it("15. Valid finder payload succeeds", async () => {
    const req = new NextRequest("http://localhost:3000/api/finder", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        jobTitle: "Founder & CEO",
        industry: "SaaS",
        limit: 10,
        offset: 0,
      }),
    });

    const res = await postFinder(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.leads));
  });

  it("16. Invalid pagination on finder → 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/finder", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        offset: -10, // Negative offset forbidden
      }),
    });

    const res = await postFinder(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("17. Excessive limit on finder → 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/finder", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        limit: 500, // Max is 100
      }),
    });

    const res = await postFinder(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("18. Excessive keyword count/length → rejected (400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/finder", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        keywords: "A".repeat(500), // Max is 200
      }),
    });

    const res = await postFinder(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  // ==========================================
  // SECTION 5: QUERY PARAMETERS (GET /api/leads)
  // ==========================================

  it("19. Valid page/pageSize works", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads?page=1&pageSize=10", {
      method: "GET",
      headers: { cookie: authHeaderUserA },
    });

    const res = await getLeads(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.page, 1);
    assert.equal(data.pageSize, 10);
    assert.ok(Array.isArray(data.leads));
  });

  it("20. pageSize > 100 behaves according to established API contract (400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads?pageSize=150", {
      method: "GET",
      headers: { cookie: authHeaderUserA },
    });

    const res = await getLeads(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("21. Invalid pageSize (e.g. 0 or negative) → 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads?pageSize=0", {
      method: "GET",
      headers: { cookie: authHeaderUserA },
    });

    const res = await getLeads(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("22. Invalid stage filter → 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads?stage=NON_EXISTENT_STAGE", {
      method: "GET",
      headers: { cookie: authHeaderUserA },
    });

    const res = await getLeads(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("23. Invalid numeric values such as NaN/Infinity-like inputs → 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads?page=invalid-non-number", {
      method: "GET",
      headers: { cookie: authHeaderUserA },
    });

    const res = await getLeads(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  // ==========================================
  // SECTION 6: STANDARDIZED API ERROR MAPPINGS
  // ==========================================

  it("24. Validation error has standardized shape", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({ email: "invalid-email" }),
    });

    const res = await postLeads(req);
    assert.equal(res.status, 400);
    const data = await res.json();

    // Standardized contract verification
    assert.equal(data.code, "VALIDATION_ERROR");
    assert.equal(typeof data.error, "string");
    assert.equal(typeof data.message, "string");
    assert.ok(data.fields);
    assert.ok(Array.isArray(data.details));
  });

  it("25. Unauthorized request → 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "GET",
      // No auth cookie provided
    });

    const res = await getLeads(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, "AUTHENTICATION_REQUIRED");
    assert.equal(typeof data.error, "string");
  });

  it("26. Cross-tenant access → 403", async () => {
    // User B tries to view Lead belonging to User A
    const req = new NextRequest(`http://localhost:3000/api/leads/${createdLeadId}`, {
      method: "GET",
      headers: { cookie: authHeaderUserB },
    });

    const res = await getLeadById(req, { params: { id: createdLeadId } });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.code, "FORBIDDEN");
    assert.equal(typeof data.error, "string");
  });

  it("27. Missing lead → 404", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads/non_existent_cuid_12345", {
      method: "GET",
      headers: { cookie: authHeaderUserA },
    });

    const res = await getLeadById(req, { params: { id: "non_existent_cuid_12345" } });
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.code, "NOT_FOUND");
    assert.equal(typeof data.error, "string");
  });

  it("28. Unique conflict where applicable → 409", async () => {
    // Attempt duplicate creation of existing lead
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authHeaderUserA,
      },
      body: JSON.stringify({
        fullName: "Alexander Wright",
        email: "alexander.wright@stellarscale.dev",
      }),
    });

    const res = await postLeads(req);
    assert.equal(res.status, 409);
    const data = await res.json();
    assert.equal(data.code, "CONFLICT");
    assert.ok(data.deduplication);
  });

  it("29. Unexpected error → safe 500 response", async () => {
    const unexpectedErr = new Error("Fatal unhandled database engine crash");
    const res = handleApiError(unexpectedErr, "Simulated fatal error");

    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.code, "INTERNAL_SERVER_ERROR");
    assert.equal(data.error, "Internal server error");
    assert.equal(data.stack, undefined, "Stack trace must not leak to client");
  });
});
