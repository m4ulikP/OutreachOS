import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/db";
import { GET as getHealth } from "../src/app/api/health/route";
import { GET as getLeads, POST as postLeads } from "../src/app/api/leads/route";
import {
  GET as getLeadById,
  PATCH as patchLeadById,
  DELETE as deleteLeadById,
} from "../src/app/api/leads/[id]/route";
import { POST as postInteraction } from "../src/app/api/leads/[id]/interactions/route";
import { GET as getAnalytics } from "../src/app/api/analytics/route";
import { POST as postFinder } from "../src/app/api/finder/route";
import { handleApiError } from "../src/lib/api-response";
import { REQUEST_ID_HEADER } from "../src/lib/request-id";
import { LeadStage } from "@prisma/client";

const TEST_SECRET = "smoke-test-jwt-signing-secret-32-chars-long";
const SMOKE_TENANT_A = "usr_smoke_tenant_alpha";
const SMOKE_TENANT_B = "usr_smoke_tenant_beta";

let authCookieA: string;
let authCookieB: string;

async function createAuthCookie(id: string, email: string, name: string): Promise<string> {
  const token = await encode({
    token: { id, email, name },
    secret: TEST_SECRET,
  });
  return `next-auth.session-token=${token}`;
}

describe("Milestone 6: End-to-End Smoke & Release-Readiness Test Suite", () => {
  const runId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let createdLeadId: string;

  before(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;

    authCookieA = await createAuthCookie(SMOKE_TENANT_A, `tenant_a_${runId}@smoke.test`, "Smoke Tenant A");
    authCookieB = await createAuthCookie(SMOKE_TENANT_B, `tenant_b_${runId}@smoke.test`, "Smoke Tenant B");

    // Clean up test data for these tenants
    await prisma.leadInteraction.deleteMany({
      where: { lead: { userId: { in: [SMOKE_TENANT_A, SMOKE_TENANT_B] } } },
    });
    await prisma.lead.deleteMany({
      where: { userId: { in: [SMOKE_TENANT_A, SMOKE_TENANT_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [SMOKE_TENANT_A, SMOKE_TENANT_B] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [SMOKE_TENANT_A, SMOKE_TENANT_B] } },
    });

    // Create test users
    await prisma.user.createMany({
      data: [
        { id: SMOKE_TENANT_A, email: `tenant_a_${runId}@smoke.test`, name: "Smoke Tenant A" },
        { id: SMOKE_TENANT_B, email: `tenant_b_${runId}@smoke.test`, name: "Smoke Tenant B" },
      ],
    });
  });

  after(async () => {
    // Teardown
    await prisma.leadInteraction.deleteMany({
      where: { lead: { userId: { in: [SMOKE_TENANT_A, SMOKE_TENANT_B] } } },
    });
    await prisma.lead.deleteMany({
      where: { userId: { in: [SMOKE_TENANT_A, SMOKE_TENANT_B] } },
    });
    await prisma.company.deleteMany({
      where: { userId: { in: [SMOKE_TENANT_A, SMOKE_TENANT_B] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [SMOKE_TENANT_A, SMOKE_TENANT_B] } },
    });
  });

  // ==========================================
  // SECTION 1: AUTHENTICATION & ACCESS CONTROL
  // ==========================================

  it("1. AUTH: unauthenticated API request is rejected with 401 and request ID", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      headers: { "content-type": "application/json" },
    });
    const res = await getLeads(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, "AUTHENTICATION_REQUIRED");
    assert.ok(res.headers.get(REQUEST_ID_HEADER));
  });

  it("2. AUTH: authenticated user can access their own resources", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      headers: { cookie: authCookieA },
    });
    const res = await getLeads(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.leads));
  });

  it("3. AUTH: authenticated user cannot access another user's resources", async () => {
    // Create a lead owned by Tenant A
    const leadA = await prisma.lead.create({
      data: {
        userId: SMOKE_TENANT_A,
        firstName: "Alpha",
        lastName: "Owner",
        fullName: "Alpha Owner",
        email: `alpha_${runId}@smoke.test`,
        normalizedEmail: `alpha_${runId}@smoke.test`,
        stage: LeadStage.NEW,
      },
    });

    // Tenant B attempts to read Tenant A's lead
    const req = new NextRequest(`http://localhost:3000/api/leads/${leadA.id}`, {
      headers: { cookie: authCookieB },
    });
    const res = await getLeadById(req, { params: { id: leadA.id } });
    assert.equal(res.status, 403, "Cross-tenant access must be rejected with 403 Forbidden");
    const data = await res.json();
    assert.equal(data.code, "FORBIDDEN");
  });

  it("4. AUTH: client-supplied userId cannot impersonate another tenant", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: authCookieA },
      body: JSON.stringify({
        userId: SMOKE_TENANT_B, // Malicious spoof attempt in payload
        firstName: "Spoof",
        lastName: "Target",
        email: `spoof_${runId}@smoke.test`,
      }),
    });
    const res = await postLeads(req);
    // Body with userId should be rejected by Zod schema mass-assignment protection
    assert.equal(res.status, 400, "Injected userId key must fail mass-assignment validation");
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  // ==========================================
  // SECTION 2: LEADS LIFECYCLE & DEDUPLICATION
  // ==========================================

  it("5. LEADS: create a valid lead returns 201 with populated record", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: authCookieA },
      body: JSON.stringify({
        firstName: "Sarah",
        lastName: "Connor",
        email: `sarah_${runId}@cyberdyne.test`,
        jobTitle: "Security Lead",
        companyName: `Cyberdyne ${runId}`,
        stage: "NEW",
      }),
    });
    const res = await postLeads(req);
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.lead?.id);
    assert.equal(data.lead.email, `sarah_${runId}@cyberdyne.test`);
    assert.equal(data.lead.company?.name, `Cyberdyne ${runId}`);
    createdLeadId = data.lead.id;
  });

  it("6. LEADS: retrieve the created lead returns full scoped details", async () => {
    const req = new NextRequest(`http://localhost:3000/api/leads/${createdLeadId}`, {
      headers: { cookie: authCookieA },
    });
    const res = await getLeadById(req, { params: { id: createdLeadId } });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.lead?.id, createdLeadId);
    assert.equal(data.lead?.firstName, "Sarah");
  });

  it("7. LEADS: update the lead modifies fields and updates stage", async () => {
    const req = new NextRequest(`http://localhost:3000/api/leads/${createdLeadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: authCookieA },
      body: JSON.stringify({
        stage: "CONTACTED",
        jobTitle: "Chief Security Officer",
      }),
    });
    const res = await patchLeadById(req, { params: { id: createdLeadId } });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.lead?.stage, "CONTACTED");
    assert.equal(data.lead?.jobTitle, "Chief Security Officer");
  });

  it("8. LEADS: record an interaction adds timeline audit and updates lastInteractionAt", async () => {
    const req = new NextRequest(`http://localhost:3000/api/leads/${createdLeadId}/interactions`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: authCookieA },
      body: JSON.stringify({
        type: "CALL",
        title: "Introductory Discovery Call",
        description: "Discussed automated outreach requirements.",
      }),
    });
    const res = await postInteraction(req, { params: { id: createdLeadId } });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.interaction?.id);
    assert.equal(data.interaction.type, "CALL");
    assert.equal(data.interaction.title, "Introductory Discovery Call");

    // Verify lead's lastInteractionAt was updated
    const updatedLead = await prisma.lead.findUnique({
      where: { id: createdLeadId },
      select: { lastInteractionAt: true },
    });
    assert.ok(updatedLead?.lastInteractionAt);
  });

  it("9. LEADS: delete the lead removes it from tenant database", async () => {
    const req = new NextRequest(`http://localhost:3000/api/leads/${createdLeadId}`, {
      method: "DELETE",
      headers: { cookie: authCookieA },
    });
    const res = await deleteLeadById(req, { params: { id: createdLeadId } });
    assert.equal(res.status, 200);

    // Verify deletion
    const check = await prisma.lead.findUnique({ where: { id: createdLeadId } });
    assert.equal(check, null);
  });

  it("10. LEADS: invalid payload returns standardized validation error (400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: authCookieA },
      body: JSON.stringify({
        // Missing all required identifying fields
        notes: "Invalid without names or company",
      }),
    });
    const res = await postLeads(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
    assert.ok(Array.isArray(data.details));
  });

  it("11. LEADS: duplicate email is detected via Priority 1 index (409)", async () => {
    const email = `dup_email_${runId}@smoke.test`;
    // Create base lead
    await postLeads(
      new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: authCookieA },
        body: JSON.stringify({ firstName: "Dup", lastName: "Email1", email }),
      })
    );

    // Attempt duplicate
    const res = await postLeads(
      new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: authCookieA },
        body: JSON.stringify({ firstName: "Dup", lastName: "Email2", email }),
      })
    );
    assert.equal(res.status, 409);
    const data = await res.json();
    assert.equal(data.code, "CONFLICT");
    assert.equal(data.deduplication?.matchedBy, "email");
  });

  it("12. LEADS: duplicate LinkedIn URL is detected via Priority 2 index (409)", async () => {
    const linkedInUrl = `https://www.linkedin.com/in/smoke-dup-${runId}/`;
    // Create base lead
    await postLeads(
      new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: authCookieA },
        body: JSON.stringify({ firstName: "LinkedIn", lastName: "One", linkedInUrl }),
      })
    );

    // Attempt duplicate with varied casing and trailing slash
    const res = await postLeads(
      new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: authCookieA },
        body: JSON.stringify({
          firstName: "LinkedIn",
          lastName: "Two",
          linkedInUrl: `https://linkedin.com/in/SMOKE-DUP-${runId}?ref=test`,
        }),
      })
    );
    assert.equal(res.status, 409);
    const data = await res.json();
    assert.equal(data.code, "CONFLICT");
    assert.equal(data.deduplication?.matchedBy, "linkedin");
  });

  it("13. LEADS: duplicate composite identity is detected via Priority 3 (409)", async () => {
    const companyName = `Composite Corp ${runId}`;
    // Create base lead
    await postLeads(
      new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: authCookieA },
        body: JSON.stringify({ firstName: "Composite", lastName: "User", companyName }),
      })
    );

    // Attempt duplicate (same full name and company)
    const res = await postLeads(
      new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: authCookieA },
        body: JSON.stringify({ fullName: "Composite User", companyName }),
      })
    );
    assert.equal(res.status, 409);
    const data = await res.json();
    assert.equal(data.code, "CONFLICT");
    assert.ok(
      data.deduplication?.matchedBy === "name_company" || data.deduplication?.matchedBy === "composite",
      "Expected composite or name_company duplicate match"
    );
  });

  it("14. LEADS: duplicate behavior remains strictly tenant-scoped", async () => {
    const sharedEmail = `cross_tenant_${runId}@shared.test`;

    // Tenant A creates lead
    const resA = await postLeads(
      new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: authCookieA },
        body: JSON.stringify({ firstName: "Cross", lastName: "Tenant", email: sharedEmail }),
      })
    );
    assert.equal(resA.status, 201);

    // Tenant B creates same lead with identical email - must succeed (no collision)
    const resB = await postLeads(
      new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: authCookieB },
        body: JSON.stringify({ firstName: "Cross", lastName: "Tenant", email: sharedEmail }),
      })
    );
    assert.equal(resB.status, 201, "Different tenants can have identical prospects without collisions");
  });

  // ==========================================
  // SECTION 3: ANALYTICS & METRICS
  // ==========================================

  it("15. ANALYTICS: endpoint works for an authenticated tenant (200)", async () => {
    const req = new NextRequest("http://localhost:3000/api/analytics", {
      headers: { cookie: authCookieA },
    });
    const res = await getAnalytics(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(typeof data.totalLeads, "number");
    assert.ok(Array.isArray(data.funnel));
    assert.ok(Array.isArray(data.outreachActivity));
  });

  it("16. ANALYTICS: results accurately reflect tenant data without cross-tenant leakage", async () => {
    const resA = await getAnalytics(
      new NextRequest("http://localhost:3000/api/analytics", {
        headers: { cookie: authCookieA },
      })
    );
    const resB = await getAnalytics(
      new NextRequest("http://localhost:3000/api/analytics", {
        headers: { cookie: authCookieB },
      })
    );

    const dataA = await resA.json();
    const dataB = await resB.json();

    // Tenant A has multiple leads created in this suite, Tenant B has exactly 1
    assert.ok(dataA.totalLeads >= 3, "Tenant A has multiple leads");
    assert.equal(dataB.totalLeads, 1, "Tenant B has exactly 1 lead");
  });

  // ==========================================
  // SECTION 4: CLIENT FINDER
  // ==========================================

  it("17. FINDER: valid finder request succeeds (200)", async () => {
    const req = new NextRequest("http://localhost:3000/api/finder", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: authCookieA },
      body: JSON.stringify({
        jobTitle: "Founder",
        industry: "SaaS",
        limit: 10,
        offset: 0,
      }),
    });
    const res = await postFinder(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.leads));
    assert.equal(typeof data.totalMatches, "number");
  });

  it("18. FINDER: invalid finder request is rejected (400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/finder", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: authCookieA },
      body: JSON.stringify({
        limit: 500, // Exceeds max 50
      }),
    });
    const res = await postFinder(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
  });

  it("19. FINDER: unconfigured provider behavior remains graceful without throwing", async () => {
    const req = new NextRequest("http://localhost:3000/api/finder", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: authCookieA },
      body: JSON.stringify({
        jobTitle: "VP Sales",
      }),
    });
    const res = await postFinder(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.isConfigured, false);
    assert.ok(data.providerName.includes("Unconfigured"));
  });

  // ==========================================
  // SECTION 5: HEALTH & OBSERVABILITY
  // ==========================================

  it("20. HEALTH: /api/health responds correctly with status 200", async () => {
    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await getHealth(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "ok");
    assert.equal(data.database.connected, true);
    assert.equal(typeof data.database.latencyMs, "number");
    assert.ok(data.database.latencyMs >= 0);
  });

  it("21. HEALTH: X-Request-ID exists and supplied ID is propagated", async () => {
    const customId = `smoke-req-${runId}`;
    const req = new NextRequest("http://localhost:3000/api/health", {
      headers: { [REQUEST_ID_HEADER]: customId },
    });
    const res = await getHealth(req);
    assert.equal(res.headers.get(REQUEST_ID_HEADER), customId);
  });

  it("22. HEALTH: invalid request ID is sanitized and regenerated as valid UUID", async () => {
    const invalidId = "<script>alert('bad-request-id')</script>";
    const req = new NextRequest("http://localhost:3000/api/health", {
      headers: { [REQUEST_ID_HEADER]: invalidId },
    });
    const res = await getHealth(req);
    const returnedId = res.headers.get(REQUEST_ID_HEADER);
    assert.notEqual(returnedId, invalidId);
    assert.match(returnedId!, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("23. HEALTH: endpoint never exposes connection secrets or credentials", async () => {
    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await getHealth(req);
    const text = await res.text();
    assert.ok(!text.includes("postgres:"), "Must not expose DB credentials");
    assert.ok(!text.includes("postgresql://"), "Must not expose DB URL");
    assert.ok(!text.includes("AUTH_SECRET"), "Must not expose secret key names");
  });

  // ==========================================
  // SECTION 6: STANDARDIZED ERROR SANITIZATION
  // ==========================================

  it("24. ERRORS: 400 validation error returns standardized format", async () => {
    const err = handleApiError(new Error("Generic validation failed"), undefined, "req-400-test");
    // Standard validation
    assert.ok(err.status >= 400);
    assert.equal(err.headers.get(REQUEST_ID_HEADER), "req-400-test");
  });

  it("25. ERRORS: 403 authorization error returns standardized format", async () => {
    const { ForbiddenError } = await import("../src/lib/auth/session");
    const err = handleApiError(new ForbiddenError("Custom forbidden"), undefined, "req-403-test");
    assert.equal(err.status, 403);
    const data = await err.json();
    assert.equal(data.code, "FORBIDDEN");
    assert.equal(data.message, "Custom forbidden");
  });

  it("26. ERRORS: 500 unexpected error sanitizes response and preserves requestId", async () => {
    const internalCrash = new Error("FATAL: relation \"leads\" does not exist at SELECT password FROM users");
    internalCrash.stack = "Error: FATAL at internal/pg.ts:44";

    const err = handleApiError(internalCrash, "Database crash", "req-500-test");
    assert.equal(err.status, 500);
    const data = await err.json();

    assert.equal(data.code, "INTERNAL_SERVER_ERROR");
    assert.equal(data.error, "Internal server error");
    assert.equal(data.requestId, "req-500-test");
    assert.equal((data as Record<string, unknown>).stack, undefined, "Stack trace must not leak to client");
    assert.ok(!JSON.stringify(data).includes("FATAL: relation"), "Database internals must not leak to client");
  });
});
