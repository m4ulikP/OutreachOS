import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import {
  getAuthSession,
  requireAuthUser,
  assertResourceOwnership,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "../src/lib/auth/session";
import { getAuthSecret } from "../src/lib/auth/auth-options";
import { handleApiError } from "../src/lib/api-response";

const TEST_SECRET = "outreachos_test_secret_32_characters_long_key";

describe("Milestone 1: Hardened Production Authentication & Tenant Isolation", () => {
  let originalAuthSecret: string | undefined;
  let originalNextAuthSecret: string | undefined;

  before(() => {
    originalAuthSecret = process.env.AUTH_SECRET;
    originalNextAuthSecret = process.env.NEXTAUTH_SECRET;
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
  });

  after(() => {
    process.env.AUTH_SECRET = originalAuthSecret;
    process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
  });

  // A & F: Unauthenticated request handling
  it("A & F: Unauthenticated request produces null session and throws UnauthorizedError (never defaults to usr_dev_primary)", async () => {
    const fakeRequest = new Request("http://localhost:3000/api/leads");

    const session = await getAuthSession(fakeRequest);
    assert.equal(session, null, "Unauthenticated session must be null");

    await assert.rejects(
      async () => {
        await requireAuthUser(fakeRequest);
      },
      UnauthorizedError,
      "Unauthenticated request must throw UnauthorizedError"
    );
  });

  // D: Header spoofing prevention
  it("D: Arbitrary x-authenticated-user-id header is ignored and cannot impersonate another user", async () => {
    const spoofRequest = new Request("http://localhost:3000/api/leads", {
      headers: {
        "x-authenticated-user-id": "usr_victim_target",
      },
    });

    const session = await getAuthSession(spoofRequest);
    assert.equal(session, null, "Custom unauthenticated header must not produce a session");

    await assert.rejects(
      async () => {
        await requireAuthUser(spoofRequest);
      },
      UnauthorizedError,
      "Spoofed header must reject with UnauthorizedError"
    );
  });

  // E: Raw Bearer userId spoofing prevention
  it("E: Arbitrary raw string Authorization: Bearer <userId> cannot impersonate another user", async () => {
    const rawBearerRequest = new Request("http://localhost:3000/api/leads", {
      headers: {
        authorization: "Bearer usr_victim_target",
      },
    });

    const session = await getAuthSession(rawBearerRequest);
    assert.equal(session, null, "Raw user ID in Bearer header must not produce a session");

    await assert.rejects(
      async () => {
        await requireAuthUser(rawBearerRequest);
      },
      UnauthorizedError,
      "Raw Bearer string must reject with UnauthorizedError"
    );
  });

  // Cryptographically signed session cookie verification
  it("B: Cryptographically signed session cookie authenticates the user successfully", async () => {
    const signedToken = await encode({
      token: {
        id: "usr_alice",
        email: "alice@example.com",
        name: "Alice Freelancer",
      },
      secret: TEST_SECRET,
    });

    const validRequest = new Request("http://localhost:3000/api/leads", {
      headers: {
        cookie: `next-auth.session-token=${signedToken}`,
      },
    });

    const user = await requireAuthUser(validRequest);
    assert.equal(user.id, "usr_alice");
    assert.equal(user.email, "alice@example.com");
    assert.equal(user.name, "Alice Freelancer");
  });

  // Cryptographically signed Bearer JWT verification
  it("B (Bearer): Cryptographically signed Bearer JWT authenticates the user successfully", async () => {
    const signedToken = await encode({
      token: {
        id: "usr_alice",
        email: "alice@example.com",
        name: "Alice Freelancer",
      },
      secret: TEST_SECRET,
    });

    const validBearerRequest = new Request("http://localhost:3000/api/leads", {
      headers: {
        authorization: `Bearer ${signedToken}`,
      },
    });

    const user = await requireAuthUser(validBearerRequest);
    assert.equal(user.id, "usr_alice");
    assert.equal(user.email, "alice@example.com");
  });

  // Tampered token rejection
  it("Rejects tampered signed session token with signature mismatch", async () => {
    const signedToken = await encode({
      token: {
        id: "usr_alice",
        email: "alice@example.com",
      },
      secret: TEST_SECRET,
    });

    // Tamper with the token string
    const tamperedToken = signedToken.slice(0, -6) + "xxxxxx";

    const tamperedRequest = new Request("http://localhost:3000/api/leads", {
      headers: {
        cookie: `next-auth.session-token=${tamperedToken}`,
      },
    });

    const session = await getAuthSession(tamperedRequest);
    assert.equal(session, null, "Tampered token must be rejected");

    await assert.rejects(
      async () => {
        await requireAuthUser(tamperedRequest);
      },
      UnauthorizedError
    );
  });

  // Foreign secret rejection
  it("Rejects token signed with an invalid or foreign secret", async () => {
    const foreignToken = await encode({
      token: {
        id: "usr_attacker",
        email: "attacker@evil.com",
      },
      secret: "foreign_secret_that_does_not_match_32chars",
    });

    const foreignRequest = new Request("http://localhost:3000/api/leads", {
      headers: {
        cookie: `next-auth.session-token=${foreignToken}`,
      },
    });

    const session = await getAuthSession(foreignRequest);
    assert.equal(session, null, "Token with foreign secret must be rejected");

    await assert.rejects(
      async () => {
        await requireAuthUser(foreignRequest);
      },
      UnauthorizedError
    );
  });

  // Resource ownership check
  it("B: Passes resource ownership check when user IDs match", () => {
    assert.doesNotThrow(() => {
      assertResourceOwnership("usr_alice", "usr_alice");
    });
  });

  it("C: Throws ForbiddenError when authenticated user attempts to access another user's resource", () => {
    const currentUserId = "usr_alice";
    const foreignResourceUserId = "usr_bob";

    assert.throws(
      () => {
        assertResourceOwnership(foreignResourceUserId, currentUserId);
      },
      ForbiddenError
    );
  });

  // I: Missing secret configuration fails safely
  it("I: Fails safely with configuration error when AUTH_SECRET is missing", () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    assert.throws(
      () => {
        getAuthSecret();
      },
      /AUTH_SECRET/
    );

    // Restore test secret
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
  });

  // API status codes handling (401, 403, 404, 500)
  it("Correctly maps error types to HTTP 401, 403, 404, and 500 status codes", async () => {
    const authErrRes = handleApiError(new UnauthorizedError("Token expired"));
    assert.equal(authErrRes.status, 401);
    const authErrJson = await authErrRes.json();
    assert.equal(authErrJson.error, "Token expired");

    const forbiddenRes = handleApiError(new ForbiddenError("Cross-tenant access blocked"));
    assert.equal(forbiddenRes.status, 403);
    const forbiddenJson = await forbiddenRes.json();
    assert.equal(forbiddenJson.error, "Cross-tenant access blocked");

    const notFoundRes = handleApiError(new NotFoundError("Lead does not exist"));
    assert.equal(notFoundRes.status, 404);
    const notFoundJson = await notFoundRes.json();
    assert.equal(notFoundJson.error, "Lead does not exist");

    const genericErrRes = handleApiError(new Error("Database connection timeout"));
    assert.equal(genericErrRes.status, 500);
    const genericErrJson = await genericErrRes.json();
    assert.equal(genericErrJson.error, "Internal server error");
    assert.equal(genericErrJson.stack, undefined, "Stack trace must not leak to client");
  });
});
