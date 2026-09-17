import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { logger } from "../src/lib/logger";
import {
  redactSensitiveData,
  maskConnectionString,
  isSensitiveKey,
} from "../src/lib/redaction";
import {
  extractRequestId,
  isValidRequestId,
  resolveRequestId,
  generateRequestId,
  REQUEST_ID_HEADER,
} from "../src/lib/request-id";
import { withApiObservability } from "../src/lib/api-wrapper";
import { handleApiError } from "../src/lib/api-response";
import { GET as getHealth } from "../src/app/api/health/route";
import { POST as postLeads } from "../src/app/api/leads/route";
import * as dbModule from "../src/lib/db";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long-for-jwt-signing";
const TEST_USER_ID = "usr_obs_test_user_1";
let authCookie: string;

async function createAuthCookie(id: string, email: string, name: string): Promise<string> {
  const token = await encode({
    token: { id, email, name },
    secret: TEST_SECRET,
  });
  return `next-auth.session-token=${token}`;
}

describe("Milestone 5: Production Logging, Health Diagnostics & Observability", () => {
  const originalEnv = { ...process.env };

  before(async () => {
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    authCookie = await createAuthCookie(TEST_USER_ID, "obs_test@outreachos.com", "Obs User");
  });

  after(() => {
    process.env = originalEnv;
  });

  // 1. Logger emits structured records with standard fields
  it("1. Logger emits structured records with standard fields (timestamp, level, message)", () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: unknown) => {
      if (typeof msg === "string") logs.push(msg);
    };

    try {
      process.env.LOG_FORMAT = "json";
      logger.info("Test structured message", { testKey: "testValue" });
      assert.ok(logs.length > 0, "Expected at least one log to be emitted");
      const parsed = JSON.parse(logs[logs.length - 1]);
      assert.equal(parsed.level, "INFO");
      assert.equal(parsed.message, "Test structured message");
      assert.ok(parsed.timestamp, "Expected timestamp to exist");
      assert.equal(parsed.testKey, "testValue");
    } finally {
      console.log = origLog;
      delete process.env.LOG_FORMAT;
    }
  });

  // 2. Log levels work appropriately respecting LOG_LEVEL
  it("2. Log levels (debug, info, warn, error) work appropriately respecting LOG_LEVEL", () => {
    const logs: string[] = [];
    const origLog = console.log;
    const origError = console.error;
    console.log = (msg: unknown) => logs.push(String(msg));
    console.error = (msg: unknown) => logs.push(String(msg));

    try {
      process.env.LOG_FORMAT = "json";
      process.env.LOG_LEVEL = "error";

      logger.info("Should be suppressed by LOG_LEVEL=error");
      assert.equal(logs.length, 0, "Info log should have been filtered out");

      logger.error("Should be emitted at ERROR level");
      assert.equal(logs.length, 1, "Error log should be emitted");
      const parsed = JSON.parse(logs[0]);
      assert.equal(parsed.level, "ERROR");
      assert.equal(parsed.message, "Should be emitted at ERROR level");
    } finally {
      console.log = origLog;
      console.error = origError;
      delete process.env.LOG_LEVEL;
      delete process.env.LOG_FORMAT;
    }
  });

  // 3. Request IDs are generated when missing
  it("3. Request IDs are generated when missing", () => {
    const id1 = extractRequestId(null);
    const id2 = extractRequestId(new Headers());
    assert.ok(isValidRequestId(id1), "Generated request ID should be valid");
    assert.ok(isValidRequestId(id2), "Generated request ID should be valid");
    assert.notEqual(id1, id2, "Generated IDs should be distinct UUIDs");
    assert.match(id1, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  // 4. Existing incoming X-Request-ID header is respected when safe
  it("4. Existing incoming X-Request-ID header is respected when safe", () => {
    const safeCustomId = "req-client-test-uuid-12345678";
    const headers = new Headers({ [REQUEST_ID_HEADER]: safeCustomId });
    const resolved = extractRequestId(headers);
    assert.equal(resolved, safeCustomId, "Safe incoming request ID must be preserved");
  });

  // 5. Malformed or unsafe incoming request IDs are sanitized/regenerated
  it("5. Malformed or unsafe incoming request IDs are sanitized/regenerated", () => {
    const maliciousInputs = [
      "req-123\nINJECTION: true",
      "req-123\r\nHTTP/1.1 200 OK",
      "req-with spaces-not-allowed",
      "short", // < 8 characters
      "a".repeat(65), // > 64 characters
      "<script>alert(1)</script>",
      "req-\x00-null-byte",
      "   ",
    ];

    for (const badInput of maliciousInputs) {
      assert.equal(
        isValidRequestId(badInput),
        false,
        `Expected '${badInput}' to be rejected as an invalid request ID`
      );
      const safe = resolveRequestId(badInput);
      assert.notEqual(safe, badInput, "Unsafe request ID must never be preserved");
      assert.ok(isValidRequestId(safe), "Regenerated ID must be a safe valid UUID");
    }
  });

  // 6. X-Request-ID header is returned on responses
  it("6. X-Request-ID header is returned on responses (success and error)", async () => {
    const safeRequestId = "req-test-roundtrip-12345";
    const req = new NextRequest("http://localhost:3000/api/health", {
      headers: { [REQUEST_ID_HEADER]: safeRequestId },
    });

    const res = await getHealth(req);
    assert.equal(
      res.headers.get(REQUEST_ID_HEADER),
      safeRequestId,
      "Response must return the same canonical X-Request-ID"
    );

    // Also verify on error path
    const errRes = handleApiError(new Error("Test error"), "Test Context", safeRequestId);
    assert.equal(
      errRes.headers.get(REQUEST_ID_HEADER),
      safeRequestId,
      "Error response must return canonical X-Request-ID"
    );
  });

  // 7. Sensitive fields are redacted recursively
  it("7. Sensitive fields (password, apiKey, token, secret, cookie, email, phone) are redacted recursively", () => {
    const sensitivePayload = {
      user: {
        name: "Test User",
        email: "leak@secret.com",
        phone: "+15551234567",
        password: "SuperSecretPassword123!",
        nested: {
          apiKey: "sk-live-abcdef123456",
          authToken: "jwt.token.here",
          database_url: "postgresql://usr:pwd@host:5432/db",
          safeKey: "safeValue",
        },
      },
    };

    const sanitized = redactSensitiveData(sensitivePayload);
    assert.equal(sanitized.user.password, "[REDACTED]");
    assert.equal(sanitized.user.email, "[REDACTED]");
    assert.equal(sanitized.user.phone, "[REDACTED]");
    assert.equal(sanitized.user.nested.apiKey, "[REDACTED]");
    assert.equal(sanitized.user.nested.authToken, "[REDACTED]");
    assert.equal(sanitized.user.nested.database_url, "[REDACTED]");
    assert.equal(sanitized.user.nested.safeKey, "safeValue");
  });

  // 8. Database connection strings mask credentials
  it("8. Database connection strings mask credentials", () => {
    const rawUrl = "postgresql://postgres:production_db_password@db.cluster.internal:5432/outreachos?sslmode=require";
    const masked = maskConnectionString(rawUrl);
    assert.equal(
      masked,
      "postgresql://postgres:***@db.cluster.internal:5432/outreachos?sslmode=require"
    );
    assert.ok(!masked.includes("production_db_password"), "Password must not appear in masked string");
  });

  // 9. Authorization headers and session cookies are never logged
  it("9. Authorization headers and session cookies are redacted", () => {
    const headersMeta = {
      authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyJ9.sig",
      cookie: "next-auth.session-token=secret-token-payload; session=active",
      otherHeader: "application/json",
    };

    const sanitized = redactSensitiveData(headersMeta);
    assert.equal(sanitized.authorization, "[REDACTED]");
    assert.equal(sanitized.cookie, "[REDACTED]");
    assert.equal(sanitized.otherHeader, "application/json");

    // Also verify raw string Bearer token redaction
    const bearerString = "Bearer sensitive-access-token-1234567890";
    const sanitizedString = redactSensitiveData(bearerString);
    assert.equal(sanitizedString, "Bearer [REDACTED]");
  });

  // 10. Request bodies are never logged
  it("10. Request bodies are never logged", () => {
    assert.ok(isSensitiveKey("body"), "body key should be sensitive");
    assert.ok(isSensitiveKey("requestBody"), "requestBody key should be sensitive");
    assert.ok(isSensitiveKey("messageContent"), "messageContent key should be sensitive");

    const rawLogMeta = {
      body: { sensitive: "content", leadName: "Confidential Corp" },
      requestBody: { rawData: "secret" },
      action: "LEAD_CREATED",
    };

    const sanitized = redactSensitiveData(rawLogMeta);
    assert.equal(sanitized.body, "[REDACTED]");
    assert.equal(sanitized.requestBody, "[REDACTED]");
    assert.equal(sanitized.action, "LEAD_CREATED");
  });

  // 11. Unexpected errors generate structured server-side error logs
  it("11. Unexpected errors generate structured server-side error logs", () => {
    const captured: string[] = [];
    const origError = console.error;
    console.error = (msg: unknown) => captured.push(String(msg));

    try {
      process.env.LOG_FORMAT = "json";
      const testError = new Error("Database pool connection timed out");
      testError.stack = "Error: Database pool connection timed out\n  at query (db.ts:12:34)";

      handleApiError(testError, "POST /api/leads unexpected crash", "req-err-correlate-123");

      assert.ok(captured.length > 0, "Expected error log to be emitted");
      const parsed = JSON.parse(captured[0]);
      assert.equal(parsed.level, "ERROR");
      assert.equal(parsed.requestId, "req-err-correlate-123");
      assert.equal(parsed.message, "POST /api/leads unexpected crash");
      assert.equal(parsed.error.name, "Error");
      assert.equal(parsed.error.message, "Database pool connection timed out");
      assert.ok(parsed.error.stack, "Server-side error log should preserve stack trace");
    } finally {
      console.error = origError;
      delete process.env.LOG_FORMAT;
    }
  });

  // 12. Unexpected errors return sanitized 500 responses without leaking stack traces
  it("12. Unexpected errors return sanitized 500 responses without leaking stack traces", async () => {
    const testError = new Error("CRITICAL: SELECT * FROM leads WHERE password='raw_pwd'");
    testError.stack = "Error: critical stack trace at /app/src/db.ts:99";

    const response = handleApiError(testError, "Internal error", "req-sanitize-test");
    assert.equal(response.status, 500);

    const data = await response.json();
    assert.equal(data.error, "Internal server error");
    assert.equal(data.code, "INTERNAL_SERVER_ERROR");
    assert.equal(data.message, "Internal server error");
    assert.equal((data as Record<string, unknown>).stack, undefined, "Stack trace must NEVER be in client response");
    assert.ok(!JSON.stringify(data).includes("raw_pwd"), "Sensitive SQL must not leak in response");
  });

  // 13. Sanitized 500 response includes requestId
  it("13. Sanitized 500 response includes requestId", async () => {
    const expectedRequestId = "req-tracking-500-error";
    const response = handleApiError(new Error("Unexpected crash"), "Test crash", expectedRequestId);
    const data = await response.json();

    assert.equal(data.requestId, expectedRequestId, "500 response body must include correlation requestId");
    assert.equal(
      response.headers.get(REQUEST_ID_HEADER),
      expectedRequestId,
      "500 response header must include correlation X-Request-ID"
    );
  });

  // 14. /api/health returns 200 and healthy response when DB is connected
  it("14. /api/health returns 200 and healthy response when DB is connected", async () => {
    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await getHealth(req);

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "ok");
    assert.equal(data.database.connected, true);
    assert.equal(data.database.error, null);
  });

  // 15. /api/health reports latencyMs for DB query
  it("15. /api/health reports latencyMs for DB query as a non-negative number", async () => {
    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await getHealth(req);
    const data = await res.json();

    assert.equal(typeof data.database.latencyMs, "number");
    assert.ok(data.database.latencyMs >= 0, "latencyMs should be >= 0");
  });

  // 16. /api/health returns 503 and degraded status when DB is down
  it("16. /api/health returns 503 and degraded status when DB is down", async () => {
    // Temporarily mock prisma.$queryRaw to simulate database failure
    const origQueryRaw = dbModule.prisma.$queryRaw;
    (dbModule.prisma as unknown as { $queryRaw: unknown }).$queryRaw = async () => {
      throw new Error("Can't reach database server at localhost:5432");
    };

    try {
      const req = new NextRequest("http://localhost:3000/api/health");
      const res = await getHealth(req);

      assert.equal(res.status, 503, "Health endpoint must return 503 when database is disconnected");
      const data = await res.json();
      assert.equal(data.status, "degraded");
      assert.equal(data.database.connected, false);
      assert.equal(typeof data.database.latencyMs, "number");
      assert.ok(data.database.error.includes("unreachable"));
    } finally {
      (dbModule.prisma as unknown as { $queryRaw: unknown }).$queryRaw = origQueryRaw;
    }
  });

  // 17. /api/health never exposes database credentials or connection strings
  it("17. /api/health never exposes database credentials or connection strings", async () => {
    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await getHealth(req);
    const bodyText = await res.text();

    assert.ok(!bodyText.includes("postgresql://"), "Health response must not contain connection URLs");
    assert.ok(!bodyText.includes("postgres:"), "Health response must not expose user credentials");
    assert.ok(!bodyText.includes("DATABASE_URL"), "Health response must not expose environment variable names");
  });

  // 18. Provider configuration reports boolean flags (aiConfigured, prospectProviderConfigured, emailConfigured)
  it("18. Provider configuration reports boolean flags (aiConfigured, prospectProviderConfigured, emailConfigured)", async () => {
    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await getHealth(req);
    const data = await res.json();

    assert.equal(typeof data.aiConfigured, "boolean");
    assert.equal(typeof data.prospectProviderConfigured, "boolean");
    assert.equal(typeof data.emailConfigured, "boolean");

    // Also verify backward compatibility for existing UI components
    assert.ok(data.providers?.leadSource?.name, "Preserves providers.leadSource.name");
    assert.equal(typeof data.providers?.leadSource?.isConfigured, "boolean");
    assert.ok(data.providers?.ai?.name, "Preserves providers.ai.name");
    assert.equal(typeof data.providers?.ai?.isConfigured, "boolean");
  });

  // 19. API request duration (durationMs) is captured
  it("19. API request duration (durationMs) is captured in completion log", async () => {
    const captured: string[] = [];
    const origLog = console.log;
    console.log = (msg: unknown) => captured.push(String(msg));

    try {
      process.env.LOG_FORMAT = "json";
      const sampleHandler = withApiObservability(async () => {
        // Small delay to ensure duration > 0
        await new Promise((resolve) => setTimeout(resolve, 5));
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }) as unknown as import("next/server").NextResponse;
      });

      const req = new NextRequest("http://localhost:3000/api/test-timing");
      const res = await sampleHandler(req);

      assert.equal(res.status, 200);
      assert.ok(captured.length > 0, "Expected completion log to be emitted");
      const completionLog = JSON.parse(captured[captured.length - 1]);
      assert.equal(completionLog.message, "API request completed");
      assert.equal(typeof completionLog.durationMs, "number");
      assert.ok(completionLog.durationMs >= 0, "durationMs should be non-negative");
      assert.equal(completionLog.status, 200);
      assert.ok(completionLog.requestId, "Completion log must include requestId");
    } finally {
      console.log = origLog;
      delete process.env.LOG_FORMAT;
    }
  });

  // 20. Business events log identifiers only (userId, leadId), never PII or full lead objects
  it("20. Business events log identifiers only (userId, leadId), never PII or full lead objects", async () => {
    const captured: string[] = [];
    const origLog = console.log;
    console.log = (msg: unknown) => captured.push(String(msg));

    try {
      process.env.LOG_FORMAT = "json";
      const uniqueSuffix = Date.now().toString(36);
      const req = new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({
          firstName: "Observability",
          lastName: "Lead",
          email: `obs_${uniqueSuffix}@business.test`,
          phone: "+1-800-555-0199",
          linkedInUrl: `https://linkedin.com/in/obs-${uniqueSuffix}`,
          companyName: `Secret Corp ${uniqueSuffix}`,
          notes: "Private negotiations notes with client",
        }),
      });

      const res = await postLeads(req);
      assert.equal(res.status, 201);

      // Find the business event log ("Lead created successfully")
      const businessLogRaw = captured.find((line) => line.includes("Lead created successfully"));
      assert.ok(businessLogRaw, "Expected 'Lead created successfully' log event");
      const businessLog = JSON.parse(businessLogRaw);

      // Verify safe identifiers are present
      assert.equal(businessLog.userId, TEST_USER_ID);
      assert.ok(businessLog.leadId, "Must log leadId identifier");
      assert.ok(businessLog.requestId, "Must correlate with requestId");

      // Verify NO PII or sensitive payload leaked in the log
      assert.equal(businessLog.firstName, undefined);
      assert.equal(businessLog.lastName, undefined);
      assert.equal(businessLog.email, undefined);
      assert.equal(businessLog.phone, undefined);
      assert.equal(businessLog.linkedInUrl, undefined);
      assert.equal(businessLog.notes, undefined);
      assert.ok(!businessLogRaw.includes("Private negotiations notes"), "Private notes must not leak in logs");
    } finally {
      console.log = origLog;
      delete process.env.LOG_FORMAT;
    }
  });

  // 21. Milestone 1 authorization tests still pass (verified via wrapped route)
  it("21. Milestone 1 authorization enforcement preserves request correlation on 401", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName: "Anonymous" }),
    });

    const res = await postLeads(unauthReq);
    assert.equal(res.status, 401);
    assert.ok(res.headers.get(REQUEST_ID_HEADER), "Unauthenticated 401 response must still have X-Request-ID");
  });

  // 22. Milestone 2 database schema tests still pass
  it("22. Milestone 2 database schema indices and connectivity remain healthy", async () => {
    const status = await dbModule.checkDatabaseConnection();
    assert.equal(status.connected, true);
    assert.ok(status.latencyMs >= 0);
  });

  // 23. Milestone 3 query optimization & transaction tests still pass
  it("23. Milestone 3 duplicate detection logs conflict warning with matchedBy and matchedLeadId", async () => {
    const captured: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: unknown) => captured.push(String(msg));

    try {
      process.env.LOG_FORMAT = "json";
      const testUid = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const email = `dup_${testUid}@test.com`;
      const companyName = `Acme_${testUid}`;

      // First creation
      const req1 = new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: authCookie },
        body: JSON.stringify({ firstName: "First", lastName: "Lead", email, companyName }),
      });
      const res1 = await postLeads(req1);
      assert.equal(res1.status, 201);

      // Duplicate creation
      const req2 = new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: authCookie },
        body: JSON.stringify({ firstName: "Duplicate", lastName: "Lead", email, companyName }),
      });
      const res2 = await postLeads(req2);
      assert.equal(res2.status, 409);

      const warnLogRaw = captured.find((line) => line.includes("Duplicate lead detected"));
      assert.ok(warnLogRaw, "Expected duplicate lead warning log");
      const warnLog = JSON.parse(warnLogRaw);
      assert.equal(warnLog.matchedBy, "email");
      assert.ok(warnLog.matchedLeadId, "Expected matchedLeadId in duplicate log");
      assert.ok(warnLog.requestId, "Expected requestId in duplicate log");
    } finally {
      console.warn = origWarn;
      delete process.env.LOG_FORMAT;
    }
  });

  // 24. Milestone 4 validation tests still pass with request correlation
  it("24. Milestone 4 validation errors return standardized shape with correlation ID", async () => {
    const badReq = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: authCookie },
      body: JSON.stringify({
        // Missing required fields
        email: "not-an-email",
      }),
    });

    const res = await postLeads(badReq);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, "VALIDATION_ERROR");
    assert.ok(Array.isArray(data.details));
    assert.ok(res.headers.get(REQUEST_ID_HEADER), "Validation error must return X-Request-ID");
  });
});
