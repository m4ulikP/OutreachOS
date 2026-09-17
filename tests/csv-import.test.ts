import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/db";
import { parseCsv, MAX_FILE_SIZE_BYTES, MAX_ROW_COUNT } from "../src/lib/csv/parser";
import { validateCsvRow } from "../src/lib/csv/validator";
import { processCsvImport } from "../src/lib/services/import-service";
import { POST as importApi } from "../src/app/api/leads/import/route";
import { LeadStage, TagType } from "@prisma/client";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long-for-jwt-signing";
const USER_A = "usr_csv_tenant_a";
const USER_B = "usr_csv_tenant_b";

let cookieUserA: string;
let cookieUserB: string;

async function createAuthCookie(id: string, email: string, name: string): Promise<string> {
  const token = await encode({
    token: { id, email, name },
    secret: TEST_SECRET,
  });
  return `next-auth.session-token=${token}`;
}

describe("Milestone 3.3: Production-Grade CSV Lead Import", () => {
  before(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;

    cookieUserA = await createAuthCookie(USER_A, "tenant_a@csv.test", "Maulik Pandey");
    cookieUserB = await createAuthCookie(USER_B, "tenant_b@csv.test", "Tenant B");

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

  // ==================================================
  // 1. CSV PARSING TESTS (RFC 4180 Pure TypeScript)
  // ==================================================
  describe("CSV Parser (RFC 4180)", () => {
    it("parses normal unquoted CSV with LF line endings", () => {
      const csv = "Full Name,Email,Job Title,Company\nAlice Smith,alice@example.com,CTO,Acme Corp\nBob Jones,bob@example.com,VP Eng,Beta Inc";
      const result = parseCsv(csv);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.totalRows, 2);
      assert.strictEqual(result.rows[0].mappedValues.fullName, "Alice Smith");
      assert.strictEqual(result.rows[0].mappedValues.email, "alice@example.com");
      assert.strictEqual(result.rows[0].rowNumber, 2);
      assert.strictEqual(result.rows[1].mappedValues.fullName, "Bob Jones");
      assert.strictEqual(result.rows[1].rowNumber, 3);
    });

    it("parses CRLF line endings properly", () => {
      const csv = "Name,Email\r\nAlice,alice@example.com\r\nBob,bob@example.com\r\n";
      const result = parseCsv(csv);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.totalRows, 2);
      assert.strictEqual(result.rows[0].mappedValues.fullName, "Alice");
      assert.strictEqual(result.rows[1].mappedValues.fullName, "Bob");
    });

    it("handles quoted fields with commas inside quotes", () => {
      const csv = 'Name,Company,Notes\n"Smith, Alice","Acme, Inc.","Great contact, follow up soon"';
      const result = parseCsv(csv);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.rows[0].mappedValues.fullName, "Smith, Alice");
      assert.strictEqual(result.rows[0].mappedValues.companyName, "Acme, Inc.");
      assert.strictEqual(result.rows[0].mappedValues.notes, "Great contact, follow up soon");
    });

    it("handles newlines inside quoted fields", () => {
      const csv = 'Name,Notes\nAlice,"Line 1\nLine 2\nLine 3"';
      const result = parseCsv(csv);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.totalRows, 1);
      assert.strictEqual(result.rows[0].mappedValues.notes, "Line 1\nLine 2\nLine 3");
    });

    it("handles escaped double quotes (\"\") inside quotes", () => {
      const csv = 'Name,Notes\nAlice,"She said ""Hello World"" yesterday"';
      const result = parseCsv(csv);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.rows[0].mappedValues.notes, 'She said "Hello World" yesterday');
    });

    it("strips UTF-8 Byte Order Mark (BOM: \\uFEFF)", () => {
      const csv = "\uFEFFName,Email\nAlice,alice@example.com";
      const result = parseCsv(csv);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.canonicalHeaders.includes("fullName"), true);
      assert.strictEqual(result.rows[0].mappedValues.fullName, "Alice");
    });

    it("handles empty CSV input safely", () => {
      const result = parseCsv("");
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.totalRows, 0);
    });

    it("handles CSV with only whitespace or empty lines", () => {
      const result = parseCsv("   \n\n\r\n   ");
      assert.strictEqual(result.success, false);
    });

    it("detects unclosed quote syntax error", () => {
      const csv = 'Name,Email\n"Alice Smith,alice@example.com';
      const result = parseCsv(csv);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errors.length > 0, true);
    });
  });

  // ==================================================
  // 2. VALIDATION ENGINE TESTS
  // ==================================================
  describe("Validation Engine", () => {
    it("validates a fully valid row", () => {
      const row = {
        rowNumber: 2,
        rawValues: {},
        mappedValues: {
          fullName: "Maulik Pandey",
          email: "maulik@example.com",
          linkedInUrl: "https://www.linkedin.com/in/maulikpandey",
          companyName: "OutreachOS Tech",
          stage: "NEW",
          notes: "Prospect interested in freelancer CRM.",
        },
      };

      const res = validateCsvRow(row);
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.leadInput?.fullName, "Maulik Pandey");
      assert.strictEqual(res.leadInput?.email, "maulik@example.com");
      assert.strictEqual(res.leadInput?.stage, LeadStage.NEW);
    });

    it("rejects row missing all identifying information (Name, Email, LinkedIn)", () => {
      const row = {
        rowNumber: 3,
        rawValues: {},
        mappedValues: {
          jobTitle: "Software Engineer",
          companyName: "Acme Corp",
        },
      };

      const res = validateCsvRow(row);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.errors.some((e) => e.field === "fullName"), true);
    });

    it("accepts row with only Email (valid identifier)", () => {
      const row = {
        rowNumber: 4,
        rawValues: {},
        mappedValues: {
          email: "valid.only@example.com",
        },
      };

      const res = validateCsvRow(row);
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.leadInput?.email, "valid.only@example.com");
    });

    it("accepts row with only LinkedIn URL (valid identifier)", () => {
      const row = {
        rowNumber: 5,
        rawValues: {},
        mappedValues: {
          linkedInUrl: "https://linkedin.com/in/validprospect",
        },
      };

      const res = validateCsvRow(row);
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.leadInput?.linkedInUrl, "https://linkedin.com/in/validprospect");
    });

    it("rejects invalid email address format", () => {
      const row = {
        rowNumber: 6,
        rawValues: {},
        mappedValues: {
          fullName: "John Doe",
          email: "not-an-email",
        },
      };

      const res = validateCsvRow(row);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.errors.some((e) => e.field === "email"), true);
    });

    it("rejects non-LinkedIn URL in linkedInUrl field", () => {
      const row = {
        rowNumber: 7,
        rawValues: {},
        mappedValues: {
          fullName: "John Doe",
          linkedInUrl: "https://twitter.com/johndoe",
        },
      };

      const res = validateCsvRow(row);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.errors.some((e) => e.field === "linkedInUrl"), true);
    });

    it("defaults omitted stage to NEW", () => {
      const row = {
        rowNumber: 8,
        rawValues: {},
        mappedValues: {
          fullName: "Jane Doe",
          email: "jane@example.com",
        },
      };

      const res = validateCsvRow(row);
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.leadInput?.stage, LeadStage.NEW);
    });

    it("rejects invalid stage value", () => {
      const row = {
        rowNumber: 9,
        rawValues: {},
        mappedValues: {
          fullName: "Jane Doe",
          email: "jane@example.com",
          stage: "SUPER_WARM_NON_EXISTENT_STAGE",
        },
      };

      const res = validateCsvRow(row);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.errors.some((e) => e.field === "stage"), true);
    });

    it("rejects notes exceeding 5,000 characters", () => {
      const longNotes = "a".repeat(5001);
      const row = {
        rowNumber: 10,
        rawValues: {},
        mappedValues: {
          fullName: "Jane Doe",
          email: "jane@example.com",
          notes: longNotes,
        },
      };

      const res = validateCsvRow(row);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.errors.some((e) => e.field === "notes"), true);
    });
  });

  // ==================================================
  // 3. MASS-ASSIGNMENT & SECURITY PROTECTION
  // ==================================================
  describe("Mass-Assignment & Security Protection", () => {
    it("flags and rejects CSV containing forbidden userId or id columns", async () => {
      const maliciousCsv = "userId,id,fullName,email\nusr_hacker,lead_123,Attacker,hacker@example.com";
      const summary = await processCsvImport(USER_A, maliciousCsv);

      assert.strictEqual(summary.success, false);
      assert.strictEqual(summary.created, 0);
      assert.strictEqual(
        summary.errors.some((e) => e.message.includes("Mass-assignment security violation")),
        true
      );
    });

    it("flags and rejects CSV containing createdAt, updatedAt, lastInteractionAt columns", async () => {
      const maliciousCsv = "createdAt,updatedAt,lastInteractionAt,Name,Email\n2020-01-01,2020-01-01,2020-01-01,Attacker,hacker2@example.com";
      const summary = await processCsvImport(USER_A, maliciousCsv);

      assert.strictEqual(summary.success, false);
      assert.strictEqual(summary.created, 0);
    });

    it("never permits untrusted CSV input to assign userId to another tenant", async () => {
      const csv = "Full Name,Email,Company\nTarget Lead,target@example.com,Target Corp";
      const summary = await processCsvImport(USER_A, csv);

      assert.strictEqual(summary.success, true);
      assert.strictEqual(summary.created, 1);

      // Verify the lead in DB belongs strictly to USER_A
      const createdLead = await prisma.lead.findFirst({
        where: { email: "target@example.com" },
      });
      assert.ok(createdLead);
      assert.strictEqual(createdLead.userId, USER_A);
    });
  });

  // ==================================================
  // 4. DEDUPLICATION (INTRA-CSV & DATABASE LEVEL)
  // ==================================================
  describe("Deduplication Engine", () => {
    it("detects and skips duplicate emails within the same CSV", async () => {
      const csv = [
        "Full Name,Email,Company",
        "Lead 1,dup.email@example.com,Company A",
        "Lead 2,dup.email@example.com,Company B", // Intra-CSV duplicate
      ].join("\n");

      const summary = await processCsvImport(USER_A, csv);
      assert.strictEqual(summary.success, true);
      assert.strictEqual(summary.created, 1);
      assert.strictEqual(summary.duplicatesSkipped, 1);
      assert.strictEqual(
        summary.duplicateDetails.some((d) => d.field === "email"),
        true
      );
    });

    it("detects and skips duplicate LinkedIn URLs within the same CSV", async () => {
      const csv = [
        "Full Name,LinkedIn URL,Company",
        "Lead X,https://linkedin.com/in/unique-profile,Company X",
        "Lead Y,https://linkedin.com/in/unique-profile,Company Y", // Intra-CSV duplicate
      ].join("\n");

      const summary = await processCsvImport(USER_A, csv);
      assert.strictEqual(summary.success, true);
      assert.strictEqual(summary.created, 1);
      assert.strictEqual(summary.duplicatesSkipped, 1);
      assert.strictEqual(
        summary.duplicateDetails.some((d) => d.field === "linkedInUrl"),
        true
      );
    });

    it("detects and skips composite identity (Name + Company) within the same CSV", async () => {
      const csv = [
        "Full Name,Company",
        "Maulik Pandey,Specialized Agency Inc",
        "Maulik Pandey,Specialized Agency Inc", // Intra-CSV duplicate
      ].join("\n");

      const summary = await processCsvImport(USER_A, csv);
      assert.strictEqual(summary.success, true);
      assert.strictEqual(summary.created, 1);
      assert.strictEqual(summary.duplicatesSkipped, 1);
    });

    it("skips leads that already exist in the database for the same tenant", async () => {
      const csv1 = "Full Name,Email,Company\nOriginal Lead,existing@example.com,Corp Alpha";
      const firstImport = await processCsvImport(USER_A, csv1);
      assert.strictEqual(firstImport.created, 1);

      // Attempt second import with same email
      const csv2 = "Full Name,Email,Company\nSecond Try,existing@example.com,Corp Beta";
      const secondImport = await processCsvImport(USER_A, csv2);

      assert.strictEqual(secondImport.created, 0);
      assert.strictEqual(secondImport.duplicatesSkipped, 1);
      assert.strictEqual(
        secondImport.duplicateDetails.some((d) => d.field === "email"),
        true
      );
    });

    it("preserves multi-tenant isolation: different tenants can import leads with same email", async () => {
      const csv = "Full Name,Email,Company\nShared Prospect,shared.prospect@example.com,Shared Corp";

      const importUserA = await processCsvImport(USER_A, csv);
      const importUserB = await processCsvImport(USER_B, csv);

      assert.strictEqual(importUserA.created, 1);
      assert.strictEqual(importUserB.created, 1);

      // Verify both leads exist under respective users
      const leadA = await prisma.lead.findFirst({
        where: { userId: USER_A, email: "shared.prospect@example.com" },
      });
      const leadB = await prisma.lead.findFirst({
        where: { userId: USER_B, email: "shared.prospect@example.com" },
      });

      assert.ok(leadA);
      assert.ok(leadB);
      assert.notStrictEqual(leadA.id, leadB.id);
    });
  });

  // ==================================================
  // 5. COMPANY RESOLUTION & REUSE
  // ==================================================
  describe("Company Handling", () => {
    it("safely creates and reuses companies across rows within an import", async () => {
      const csv = [
        "Full Name,Email,Company,Industry",
        "Employee 1,emp1@acmewidgets.com,Acme Widgets Global,Manufacturing",
        "Employee 2,emp2@acmewidgets.com,Acme Widgets Global,Manufacturing",
      ].join("\n");

      const summary = await processCsvImport(USER_A, csv);
      assert.strictEqual(summary.created, 2);

      const companies = await prisma.company.findMany({
        where: { userId: USER_A, name: "Acme Widgets Global" },
      });
      // Exactly 1 company created and reused
      assert.strictEqual(companies.length, 1);

      const leads = await prisma.lead.findMany({
        where: {
          userId: USER_A,
          email: { in: ["emp1@acmewidgets.com", "emp2@acmewidgets.com"] },
        },
      });
      assert.strictEqual(leads[0].companyId, companies[0].id);
      assert.strictEqual(leads[1].companyId, companies[0].id);
    });
  });

  // ==================================================
  // 6. PRODUCTION SAFETY LIMITS
  // ==================================================
  describe("Production Limits", () => {
    it("rejects input exceeding MAX_ROW_COUNT (2,000 rows)", async () => {
      const header = "Full Name,Email\n";
      const rows: string[] = [];
      for (let i = 0; i <= 2005; i++) {
        rows.push(`User ${i},user${i}@limit.example.com`);
      }
      const hugeCsv = header + rows.join("\n");

      const summary = await processCsvImport(USER_A, hugeCsv);
      assert.strictEqual(summary.success, false);
      assert.strictEqual(summary.created, 0);
      assert.strictEqual(
        summary.errors.some((e) => e.message.includes("exceeds the maximum allowed limit of 2000 rows")),
        true
      );
    });
  });

  // ==================================================
  // 7. API ENDPOINT (POST /api/leads/import)
  // ==================================================
  describe("API Endpoint (POST /api/leads/import)", () => {
    it("returns 401 when unauthenticated", async () => {
      const req = new NextRequest("http://localhost:3000/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent: "Name,Email\nTest,test@example.com" }),
      });

      const res = await importApi(req, { params: {} });
      assert.strictEqual(res.status, 401);
    });

    it("supports ?preview=true without writing records to the database", async () => {
      const previewCsv = "Full Name,Email,Company\nPreview Lead,preview@example.com,Preview Co";
      const req = new NextRequest("http://localhost:3000/api/leads/import?preview=true", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieUserA,
        },
        body: JSON.stringify({ csvContent: previewCsv }),
      });

      const res = await importApi(req, { params: {} });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.preview, true);
      assert.strictEqual(data.readyToImport, 1);
      assert.strictEqual(data.created, 0);

      // Verify lead was NOT persisted to DB
      const dbCheck = await prisma.lead.findFirst({
        where: { email: "preview@example.com" },
      });
      assert.strictEqual(dbCheck, null);
    });

    it("commits import successfully and persists records to database", async () => {
      const commitCsv = "Full Name,Email,Company,Job Title\nCommit Lead,commit.lead@example.com,Commit Co,Director";
      const req = new NextRequest("http://localhost:3000/api/leads/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieUserA,
        },
        body: JSON.stringify({ csvContent: commitCsv }),
      });

      const res = await importApi(req, { params: {} });
      assert.strictEqual(res.status, 201);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.created, 1);

      // Verify lead was persisted
      const dbLead = await prisma.lead.findFirst({
        where: { email: "commit.lead@example.com" },
      });
      assert.ok(dbLead);
      assert.strictEqual(dbLead.fullName, "Commit Lead");
      assert.strictEqual(dbLead.jobTitle, "Director");
    });

    it("returns 400 with safe error on empty upload", async () => {
      const req = new NextRequest("http://localhost:3000/api/leads/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieUserA,
        },
        body: JSON.stringify({ csvContent: "" }),
      });

      const res = await importApi(req, { params: {} });
      assert.strictEqual(res.status, 400);

      const data = await res.json();
      assert.strictEqual(data.code, "VALIDATION_ERROR");
    });
  });
});
