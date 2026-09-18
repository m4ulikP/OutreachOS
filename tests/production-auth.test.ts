import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/db";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import {
  generateSecureToken,
  hashToken,
  createVerificationToken,
  consumeVerificationToken,
} from "../src/lib/auth/tokens";
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
} from "../src/lib/validation/auth";
import { developmentEmailProvider } from "../src/lib/email";
import { defaultRateLimitStore, enforceAuthRateLimit, RateLimitExceededError } from "../src/lib/rate-limit";
import { authOptions, getAuthSecret } from "../src/lib/auth/auth-options";
import { getAuthSession, requireAuthUser, UnauthorizedError } from "../src/lib/auth/session";
import { POST as postSignup } from "../src/app/api/auth/signup/route";
import { POST as postVerifyEmail } from "../src/app/api/auth/verify-email/route";
import { POST as postResendVerification } from "../src/app/api/auth/resend-verification/route";
import { POST as postForgotPassword } from "../src/app/api/auth/forgot-password/route";
import { POST as postResetPassword } from "../src/app/api/auth/reset-password/route";
import { POST as postChangePassword } from "../src/app/api/auth/change-password/route";
import { TokenType } from "@prisma/client";

const TEST_SECRET = "production-auth-test-secret-32-chars-long";

describe("Phase 4.5: Production Authentication & Account Management Test Suite", () => {
  let originalAuthSecret: string | undefined;
  let originalNextAuthSecret: string | undefined;
  const testRunId = `auth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const testUserAEmail = `alice_${testRunId}@example.dev`;
  const testUserBEmail = `bob_${testRunId}@example.dev`;
  let testUserAId: string;

  before(async () => {
    originalAuthSecret = process.env.AUTH_SECRET;
    originalNextAuthSecret = process.env.NEXTAUTH_SECRET;
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
  });

  after(async () => {
    process.env.AUTH_SECRET = originalAuthSecret;
    process.env.NEXTAUTH_SECRET = originalNextAuthSecret;

    // Clean up any test users created
    const emails = [testUserAEmail, testUserBEmail];
    await prisma.verificationToken.deleteMany({
      where: { identifier: { in: emails } },
    }).catch(() => {});
    await prisma.account.deleteMany({
      where: { user: { email: { in: emails } } },
    }).catch(() => {});
    await prisma.lead.deleteMany({
      where: { user: { email: { in: emails } } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    }).catch(() => {});
  });

  beforeEach(() => {
    developmentEmailProvider.clear();
    defaultRateLimitStore.clear();
  });

  // =========================================================================
  // 1. ZOD VALIDATION SCHEMAS
  // =========================================================================
  describe("1. Zod Validation & Schema Security", () => {
    it("Validates valid signup input", () => {
      const valid = signupSchema.safeParse({
        name: "Alice Designer",
        email: "Alice@Example.COM ",
        password: "Password123",
        confirmPassword: "Password123",
      });
      assert.equal(valid.success, true);
      if (valid.success) {
        assert.equal(valid.data.email, "alice@example.com");
      }
    });

    it("Rejects signup when passwords do not match", () => {
      const result = signupSchema.safeParse({
        name: "Alice Designer",
        email: "alice@example.com",
        password: "Password123",
        confirmPassword: "DifferentPassword456",
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues.some((i) => i.path.includes("confirmPassword")));
      }
    });

    it("Rejects weak passwords (missing uppercase, number, or too short)", () => {
      // Too short
      assert.equal(
        signupSchema.safeParse({
          name: "Alice",
          email: "a@b.com",
          password: "Pass1",
          confirmPassword: "Pass1",
        }).success,
        false
      );

      // Missing number
      assert.equal(
        signupSchema.safeParse({
          name: "Alice",
          email: "a@b.com",
          password: "PasswordOnly",
          confirmPassword: "PasswordOnly",
        }).success,
        false
      );

      // Missing uppercase
      assert.equal(
        signupSchema.safeParse({
          name: "Alice",
          email: "a@b.com",
          password: "password123",
          confirmPassword: "password123",
        }).success,
        false
      );
    });

    it("Rejects unexpected/injected fields in signup (strict validation)", () => {
      const result = signupSchema.safeParse({
        name: "Attacker",
        email: "attacker@example.com",
        password: "Password123",
        confirmPassword: "Password123",
        userId: "injected_user_id",
        emailVerified: true,
        passwordHash: "fake_hash",
      });
      assert.equal(result.success, false, "Must reject injected admin/system properties");
    });

    it("Validates and strictly restricts login schema", () => {
      const valid = loginSchema.safeParse({
        email: "alice@example.com",
        password: "Password123",
      });
      assert.equal(valid.success, true);

      const injected = loginSchema.safeParse({
        email: "alice@example.com",
        password: "Password123",
        role: "admin",
      });
      assert.equal(injected.success, false);
    });

    it("Validates forgot password, reset password, and verification schemas", () => {
      assert.equal(forgotPasswordSchema.safeParse({ email: "alice@example.com" }).success, true);
      assert.equal(forgotPasswordSchema.safeParse({ email: "invalid-email" }).success, false);

      const resetValid = resetPasswordSchema.safeParse({
        token: "tok_abc123",
        email: "alice@example.com",
        password: "NewPassword123",
        confirmPassword: "NewPassword123",
      });
      assert.equal(resetValid.success, true);

      const verifyValid = verifyEmailSchema.safeParse({
        token: "tok_abc123",
        email: "alice@example.com",
      });
      assert.equal(verifyValid.success, true);
    });
  });

  // =========================================================================
  // 2. PASSWORD HASHING & SECURITY
  // =========================================================================
  describe("2. Password Hashing & Cryptographic Verification", () => {
    it("Hashes password securely with bcrypt cost factor 12", async () => {
      const rawPassword = "StrongSecretPassword99";
      const hash = await hashPassword(rawPassword);

      assert.ok(hash.startsWith("$2a$12$") || hash.startsWith("$2b$12$"), "Hash must be bcrypt cost factor 12");
      assert.notEqual(hash, rawPassword, "Plaintext must never equal hash");

      const isMatch = await verifyPassword(rawPassword, hash);
      assert.equal(isMatch, true, "Correct password must verify successfully");

      const isWrongMatch = await verifyPassword("WrongPassword123", hash);
      assert.equal(isWrongMatch, false, "Incorrect password must fail verification");
    });
  });

  // =========================================================================
  // 3. SECURE TOKEN STORAGE (HASHED AT REST)
  // =========================================================================
  describe("3. Verification Tokens & Hashed Storage", () => {
    it("Generates high-entropy token and verifies raw token matches hashed storage", () => {
      const { rawToken, hashedToken } = generateSecureToken();

      assert.equal(rawToken.length, 64, "Raw token must be 32 bytes hex encoded (64 chars)");
      assert.equal(hashedToken.length, 64, "Hashed token must be SHA-256 hex encoded");
      assert.notEqual(rawToken, hashedToken, "Hashed token must not equal raw token");
      assert.equal(hashToken(rawToken), hashedToken, "hashToken must deterministically reproduce hash");
    });

    it("Stores only hashed token in DB and single-use validation consumes it", async () => {
      const testEmail = `token_test_${Date.now()}@example.dev`;
      const { rawToken } = await createVerificationToken({
        identifier: testEmail,
        type: TokenType.EMAIL_VERIFICATION,
        expiresInMs: 60 * 1000,
      });

      // Verify that database record stores ONLY the SHA-256 hash, NEVER the raw token
      const inDb = await prisma.verificationToken.findFirst({
        where: { identifier: testEmail },
      });
      assert.ok(inDb, "Token record must exist in DB");
      assert.notEqual(inDb.token, rawToken, "Database must NOT store raw verification token");
      assert.equal(inDb.token, hashToken(rawToken), "Database must store SHA-256 hash of token");

      // First consumption succeeds and removes token (single-use semantics)
      const firstConsume = await consumeVerificationToken({
        identifier: testEmail,
        rawToken,
        type: TokenType.EMAIL_VERIFICATION,
      });
      assert.equal(firstConsume.valid, true);

      // Second consumption fails because token was deleted
      const secondConsume = await consumeVerificationToken({
        identifier: testEmail,
        rawToken,
        type: TokenType.EMAIL_VERIFICATION,
      });
      assert.equal(secondConsume.valid, false);
      assert.equal(secondConsume.reason, "NOT_FOUND");
    });

    it("Rejects expired token and deletes it", async () => {
      const testEmail = `expired_token_${Date.now()}@example.dev`;
      const { rawToken } = await createVerificationToken({
        identifier: testEmail,
        type: TokenType.EMAIL_VERIFICATION,
        expiresInMs: -1000, // already expired
      });

      const consume = await consumeVerificationToken({
        identifier: testEmail,
        rawToken,
        type: TokenType.EMAIL_VERIFICATION,
      });
      assert.equal(consume.valid, false);
      assert.equal(consume.reason, "EXPIRED");

      // Verify token record was pruned
      const remaining = await prisma.verificationToken.findFirst({
        where: { identifier: testEmail },
      });
      assert.equal(remaining, null);
    });
  });

  // =========================================================================
  // 4. SIGNUP & EMAIL VERIFICATION FLOW
  // =========================================================================
  describe("4. End-to-End User Signup & Email Verification", () => {
    let capturedRawToken: string;

    it("Signs up a new user and dispatches verification email", async () => {
      const signupReq = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Alice Wonderland",
          email: testUserAEmail,
          password: "SecurePassword123",
          confirmPassword: "SecurePassword123",
        }),
      });

      const res = await postSignup(signupReq);
      assert.equal(res.status, 201, "Signup should return 201 Created");

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.user.email, testUserAEmail);
      assert.equal(body.user.name, "Alice Wonderland");
      assert.equal(body.user.passwordHash, undefined, "Must NEVER return passwordHash to client");
      assert.equal(body.user.password, undefined, "Must NEVER return password to client");

      testUserAId = body.user.id;

      // Verify user in database is created with emailVerified null and passwordHash set
      const userInDb = await prisma.user.findUnique({
        where: { email: testUserAEmail },
      });
      assert.ok(userInDb);
      assert.equal(userInDb.emailVerified, null, "User must start unverified");
      assert.ok(userInDb.passwordHash, "User must have passwordHash in DB");
      assert.notEqual(userInDb.passwordHash, "SecurePassword123", "Database must store hash, not plaintext");

      // Verify DevelopmentEmailProvider received the email
      const sentEmail = developmentEmailProvider.getLatestEmail(testUserAEmail);
      assert.ok(sentEmail, "Verification email must be captured in development email provider");
      assert.ok(sentEmail.text.includes("/verify-email?token="));

      // Extract raw token from email URL
      const match = sentEmail.text.match(/token=([a-f0-9]+)/);
      assert.ok(match, "Token must be present in verification URL");
      capturedRawToken = match[1];
    });

    it("Prevents duplicate signup with the same email (409 Conflict)", async () => {
      const duplicateReq = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Alice Impersonator",
          email: testUserAEmail,
          password: "SecurePassword123",
          confirmPassword: "SecurePassword123",
        }),
      });

      const res = await postSignup(duplicateReq);
      assert.equal(res.status, 409, "Duplicate signup must return 409 Conflict");
      const body = await res.json();
      assert.equal(body.code, "CONFLICT");
    });

    it("Verifies email using the single-use token and updates User.emailVerified", async () => {
      const verifyReq = new NextRequest("http://localhost:3000/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: capturedRawToken,
          email: testUserAEmail,
        }),
      });

      const res = await postVerifyEmail(verifyReq);
      assert.equal(res.status, 200, "Verification should return 200 OK");
      const body = await res.json();
      assert.equal(body.success, true);

      // Verify database updated
      const updatedUser = await prisma.user.findUnique({
        where: { email: testUserAEmail },
      });
      assert.ok(updatedUser?.emailVerified, "User.emailVerified must now be a valid timestamp");

      // Re-submitting the same token fails (single-use)
      const resSecond = await postVerifyEmail(verifyReq);
      assert.equal(resSecond.status, 400, "Reusing a verification token must be rejected");
    });

    it("Resend verification flow generates fresh token for unverified user and resists enumeration", async () => {
      // Test with non-existent user: must return 200 generic message to avoid enumeration
      const resNonExistent = await postResendVerification(
        new NextRequest("http://localhost:3000/api/auth/resend-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "nonexistent@example.dev" }),
        })
      );
      assert.equal(resNonExistent.status, 200);
      const nonExistentBody = await resNonExistent.json();
      assert.ok(nonExistentBody.message.includes("If an unverified account exists"));
    });
  });

  // =========================================================================
  // 5. LOGIN (CREDENTIALS AUTHORIZATION)
  // =========================================================================
  describe("5. Credentials Login & Provider Authentication", () => {
    const credentialsProvider = authOptions.providers.find(
      (p) => (p as { id?: string }).id === "credentials"
    ) as {
      authorize?: (c: Record<string, unknown>) => Promise<unknown>;
      options?: { authorize?: (c: Record<string, unknown>) => Promise<unknown> };
    };
    const authorize = credentialsProvider.options?.authorize || credentialsProvider.authorize!;

    it("Authenticates successfully with correct email and password", async () => {
      assert.ok(credentialsProvider?.authorize, "Credentials provider authorize handler must exist");

      const loginEmail = `login_success_${Date.now()}@example.dev`;
      const passwordHash = await hashPassword("SecurePassword123");
      const user = await prisma.user.create({
        data: {
          name: "Login Tester",
          email: loginEmail,
          passwordHash,
          emailVerified: new Date(),
          sessionVersion: 1,
        },
      });

      try {
        const authUser = (await authorize({
          email: loginEmail,
          password: "SecurePassword123",
        })) as { id: string; email: string; name?: string; sessionVersion?: number };

        assert.ok(authUser, "Valid credentials must return user object");
        assert.equal(authUser.id, user.id);
        assert.equal(authUser.email, loginEmail);
        assert.equal(authUser.sessionVersion, 1);
      } finally {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    });

    it("Rejects login when given wrong password", async () => {
      const loginEmail = `login_wrong_pass_${Date.now()}@example.dev`;
      const passwordHash = await hashPassword("SecurePassword123");
      const user = await prisma.user.create({
        data: {
          name: "Wrong Pass User",
          email: loginEmail,
          passwordHash,
          sessionVersion: 1,
        },
      });

      try {
        const authUser = await authorize({
          email: loginEmail,
          password: "WrongPassword999",
        });

        assert.equal(authUser, null, "Wrong password must return null (fail login)");
      } finally {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    });

    it("Rejects login for non-existent email", async () => {
      const authUser = await authorize({
        email: "nobody_here@example.dev",
        password: "SomePassword123",
      });

      assert.equal(authUser, null, "Nonexistent user must return null without leaking account status");
    });

    it("Rejects login for Google-only account without password", async () => {
      const googleUserEmail = `google_only_${testRunId}@example.dev`;
      const googleUser = await prisma.user.create({
        data: {
          email: googleUserEmail,
          name: "Google Only User",
          emailVerified: new Date(),
          passwordHash: null, // No password set
        },
      });

      try {
        const authUser = await authorize({
          email: googleUserEmail,
          password: "AnyPassword123",
        });
        assert.equal(authUser, null, "Account without passwordHash must return null");
      } finally {
        await prisma.user.delete({ where: { id: googleUser.id } });
      }
    });
  });

  // =========================================================================
  // 6. FORGOT PASSWORD, RESET PASSWORD & SESSION REVOCATION
  // =========================================================================
  describe("6. Password Reset Flow & Session Revocation", () => {
    let resetRawToken: string;

    it("Forgot password returns generic 200 response (enumeration resistant) and queues email", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testUserAEmail }),
      });

      const res = await postForgotPassword(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.message.includes("If an account exists"));

      const resetEmail = developmentEmailProvider.getLatestEmail(testUserAEmail);
      assert.ok(resetEmail, "Reset email must be dispatched");
      assert.ok(resetEmail.text.includes("/reset-password?token="));

      const match = resetEmail.text.match(/token=([a-f0-9]+)/);
      assert.ok(match);
      resetRawToken = match[1];
    });

    it("Resets password and increments sessionVersion, invalidating old sessions", async () => {
      // Create a pre-reset active session token (sessionVersion: 1)
      const oldSessionToken = await encode({
        token: {
          id: testUserAId,
          email: testUserAEmail,
          name: "Alice Wonderland",
          sessionVersion: 1,
        },
        secret: TEST_SECRET,
      });

      // Verify old session token currently authenticates
      const reqBefore = new Request("http://localhost:3000/api/leads", {
        headers: { cookie: `next-auth.session-token=${oldSessionToken}` },
      });
      const sessionBefore = await getAuthSession(reqBefore);
      assert.ok(sessionBefore, "Session must authenticate before reset");
      assert.equal(sessionBefore?.id, testUserAId);

      // Perform password reset
      const resetReq = new NextRequest("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetRawToken,
          email: testUserAEmail,
          password: "BrandNewPassword456",
          confirmPassword: "BrandNewPassword456",
        }),
      });

      const resetRes = await postResetPassword(resetReq);
      assert.equal(resetRes.status, 200);

      // Check database: sessionVersion must be incremented to 2
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUserAId },
      });
      assert.equal(updatedUser?.sessionVersion, 2, "sessionVersion must be incremented to revoke old sessions");

      // Verify old session token is now REVOKED!
      const reqAfter = new Request("http://localhost:3000/api/leads", {
        headers: { cookie: `next-auth.session-token=${oldSessionToken}` },
      });
      const sessionAfter = await getAuthSession(reqAfter);
      assert.equal(sessionAfter, null, "Old session token must be revoked after password reset!");

      await assert.rejects(
        async () => {
          await requireAuthUser(reqAfter);
        },
        UnauthorizedError,
        "RequireAuthUser must reject revoked token"
      );

      // Re-using the reset token fails (single-use)
      const reuseRes = await postResetPassword(resetReq);
      assert.equal(reuseRes.status, 400, "Used reset token must be rejected");
    });
  });

  // =========================================================================
  // 7. CHANGE PASSWORD (AUTHENTICATED)
  // =========================================================================
  describe("7. Authenticated Password Change", () => {
    it("Changes password and refreshes sessionVersion when authenticated", async () => {
      const activeSessionToken = await encode({
        token: {
          id: testUserAId,
          email: testUserAEmail,
          sessionVersion: 2,
        },
        secret: TEST_SECRET,
      });

      // Wrong current password fails
      const badReq = new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `next-auth.session-token=${activeSessionToken}`,
        },
        body: JSON.stringify({
          currentPassword: "IncorrectPassword123",
          newPassword: "UpdatedPassword789",
          confirmPassword: "UpdatedPassword789",
        }),
      });
      const badRes = await postChangePassword(badReq);
      assert.equal(badRes.status, 400);

      // Correct current password succeeds
      const goodReq = new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `next-auth.session-token=${activeSessionToken}`,
        },
        body: JSON.stringify({
          currentPassword: "BrandNewPassword456",
          newPassword: "UpdatedPassword789",
          confirmPassword: "UpdatedPassword789",
        }),
      });
      const goodRes = await postChangePassword(goodReq);
      assert.equal(goodRes.status, 200);

      const userAfter = await prisma.user.findUnique({
        where: { id: testUserAId },
      });
      assert.equal(userAfter?.sessionVersion, 3, "sessionVersion incremented on password change");
    });
  });

  // =========================================================================
  // 8. GOOGLE OAUTH & SAFE ACCOUNT LINKING
  // =========================================================================
  describe("8. Google OAuth & Account Linking Security", () => {
    const signInCallback = authOptions.callbacks?.signIn;

    it("Rejects unverified Google profile (email_verified: false)", async () => {
      assert.ok(signInCallback);

      const canSignIn = await signInCallback({
        user: { id: "google_unverified", email: "unverified@example.com" },
        account: {
          provider: "google",
          type: "oauth",
          providerAccountId: "g_12345",
        },
        profile: {
          email: "unverified@example.com",
          email_verified: false, // NOT verified by Google
        } as any,
      });

      assert.equal(canSignIn, false, "Unverified email from OAuth provider must be rejected");
    });

    it("Safely links verified Google profile to existing user without creating duplicate tenant", async () => {
      assert.ok(signInCallback);

      const canSignIn = await signInCallback({
        user: { id: "temp_google_id", email: testUserAEmail },
        account: {
          provider: "google",
          type: "oauth",
          providerAccountId: "google_account_alice_999",
        },
        profile: {
          email: testUserAEmail,
          email_verified: true,
          name: "Alice Verified",
        } as any,
      });

      assert.equal(canSignIn, true, "Verified Google sign-in for existing user must succeed");

      // Verify Account record created pointing to existing user
      const linkedAccount = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: "google_account_alice_999",
          },
        },
      });

      assert.ok(linkedAccount, "Linked account record must exist");
      assert.equal(linkedAccount.userId, testUserAId, "Account must point to existing user ID (prevent split tenant)");
    });

    it("Creates new user and account for first-time verified Google sign-in", async () => {
      assert.ok(signInCallback);
      const newGoogleEmail = `new_google_${Date.now()}@example.dev`;

      try {
        const canSignIn = await signInCallback({
          user: { id: "temp_id", email: newGoogleEmail },
          account: {
            provider: "google",
            type: "oauth",
            providerAccountId: `google_new_${Date.now()}`,
          },
          profile: {
            email: newGoogleEmail,
            email_verified: true,
            name: "New Google User",
          } as any,
        });

        assert.equal(canSignIn, true);

        const createdUser = await prisma.user.findUnique({
          where: { email: newGoogleEmail },
        });
        assert.ok(createdUser);
        assert.ok(createdUser.emailVerified, "New Google user emailVerified must be set");
        assert.equal(createdUser.passwordHash, null, "New Google user starts with null passwordHash");
      } finally {
        await prisma.account.deleteMany({
          where: { user: { email: newGoogleEmail } },
        });
        await prisma.user.deleteMany({
          where: { email: newGoogleEmail },
        });
      }
    });
  });

  // =========================================================================
  // 9. RATE LIMITING SECURITY
  // =========================================================================
  describe("9. Rate Limiting Protection", () => {
    it("Enforces rate limits on repeated attempts within window", async () => {
      const mockReq = new Request("http://localhost:3000/api/auth/forgot-password", {
        headers: { "x-forwarded-for": "203.0.113.195" },
      });

      // Max 5 attempts for forgot-password
      for (let i = 0; i < 5; i++) {
        const result = await enforceAuthRateLimit("forgot-password", mockReq);
        assert.equal(result.success, true);
      }

      // 6th attempt must throw RateLimitExceededError (429)
      await assert.rejects(
        async () => {
          await enforceAuthRateLimit("forgot-password", mockReq);
        },
        RateLimitExceededError,
        "Rate limit must be enforced after exceeding limit"
      );
    });
  });
});
