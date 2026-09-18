import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { BrevoEmailProvider } from "../src/lib/email/brevo-provider";
import {
  getEmailProvider,
  developmentEmailProvider,
  brevoEmailProvider,
  productionEmailProvider,
  SendEmailOptions,
} from "../src/lib/email";
import { GET as getHealth } from "../src/app/api/health/route";
import { NextRequest } from "next/server";

describe("Brevo Transactional Email Provider Test Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ==========================================
  // SECTION 1: CONFIGURATION
  // ==========================================
  describe("1. Configuration & isConfigured Detection", () => {
    it("isConfigured is true when both BREVO_API_KEY and BREVO_FROM_EMAIL exist", () => {
      process.env.BREVO_API_KEY = "xkeysib-test-api-key-123456789";
      process.env.BREVO_FROM_EMAIL = "outreach@outreachos.dev";

      const provider = new BrevoEmailProvider();
      assert.equal(provider.isConfigured, true);
    });

    it("isConfigured is false when BREVO_API_KEY is missing", () => {
      delete process.env.BREVO_API_KEY;
      process.env.BREVO_FROM_EMAIL = "outreach@outreachos.dev";

      const provider = new BrevoEmailProvider();
      assert.equal(provider.isConfigured, false);
    });

    it("isConfigured is false when BREVO_FROM_EMAIL is missing", () => {
      process.env.BREVO_API_KEY = "xkeysib-test-api-key-123456789";
      delete process.env.BREVO_FROM_EMAIL;

      const provider = new BrevoEmailProvider();
      assert.equal(provider.isConfigured, false);
    });

    it("isConfigured is false when environment variables are empty or whitespace", () => {
      process.env.BREVO_API_KEY = "   ";
      process.env.BREVO_FROM_EMAIL = "";

      const provider = new BrevoEmailProvider();
      assert.equal(provider.isConfigured, false);
    });

    it("supports constructor options overriding environment variables", () => {
      delete process.env.BREVO_API_KEY;
      delete process.env.BREVO_FROM_EMAIL;

      const provider = new BrevoEmailProvider({
        apiKey: "xkeysib-explicit-key",
        fromEmail: "explicit@outreachos.dev",
      });
      assert.equal(provider.isConfigured, true);
    });

    it("fails safely if sendEmail is invoked when unconfigured", async () => {
      delete process.env.BREVO_API_KEY;
      delete process.env.BREVO_FROM_EMAIL;

      const provider = new BrevoEmailProvider();
      const result = await provider.sendEmail({
        to: "recipient@example.com",
        subject: "Hello",
        text: "World",
        html: "<p>World</p>",
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("not configured"));
    });
  });

  // ==========================================
  // SECTION 2: PAYLOAD MAPPING & SUCCESS
  // ==========================================
  describe("2. Payload Mapping & Delivery Metadata", () => {
    it("correctly maps sender, recipient, subject, html, and text to Brevo API payload", async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      let capturedHeaders: Headers | null = null;

      const mockFetch: typeof fetch = async (_input, init) => {
        capturedHeaders = new Headers(init?.headers);
        if (init?.body && typeof init.body === "string") {
          capturedPayload = JSON.parse(init.body);
        }
        return new Response(
          JSON.stringify({ messageId: "<20260918.brevo-msg-123@smtp-relay.brevo.com>" }),
          {
            status: 201,
            headers: { "content-type": "application/json" },
          }
        );
      };

      const provider = new BrevoEmailProvider({
        apiKey: "xkeysib-test-secret-key-abcdef",
        fromEmail: "studio@outreachos.dev",
        fromName: "OutreachOS Team",
        fetchFn: mockFetch,
        baseDelayMs: 1,
      });

      const options: SendEmailOptions = {
        to: "alice@clientdomain.com",
        subject: "Verify your email address",
        text: "Please verify your email: https://outreachos.dev/verify",
        html: "<p>Please verify your email: <a href='https://outreachos.dev/verify'>Verify</a></p>",
      };

      const result = await provider.sendEmail(options);

      // Verify delivery result
      assert.equal(result.success, true);
      assert.equal(result.messageId, "<20260918.brevo-msg-123@smtp-relay.brevo.com>");

      // Verify payload
      assert.ok(capturedPayload, "Payload should have been sent to Brevo");
      const payload = capturedPayload as {
        sender?: { email?: string; name?: string };
        to?: Array<{ email?: string }>;
        subject?: string;
        htmlContent?: string;
        textContent?: string;
      };

      assert.deepEqual(payload.sender, {
        email: "studio@outreachos.dev",
        name: "OutreachOS Team",
      });
      assert.deepEqual(payload.to, [{ email: "alice@clientdomain.com" }]);
      assert.equal(payload.subject, "Verify your email address");
      assert.equal(
        payload.htmlContent,
        "<p>Please verify your email: <a href='https://outreachos.dev/verify'>Verify</a></p>"
      );
      assert.equal(payload.textContent, "Please verify your email: https://outreachos.dev/verify");

      // Verify authorization header sent by SDK
      assert.equal((capturedHeaders as Headers | null)?.get("api-key"), "xkeysib-test-secret-key-abcdef");
    });

    it("falls back to default sender name when BREVO_FROM_NAME is not set", async () => {
      let capturedPayload: Record<string, unknown> | null = null;

      const mockFetch: typeof fetch = async (_input, init) => {
        if (init?.body && typeof init.body === "string") {
          capturedPayload = JSON.parse(init.body);
        }
        return new Response(JSON.stringify({ messageId: "<default-name-test@brevo.com>" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      };

      const provider = new BrevoEmailProvider({
        apiKey: "xkeysib-test",
        fromEmail: "system@outreachos.dev",
        fetchFn: mockFetch,
        baseDelayMs: 1,
      });

      await provider.sendEmail({
        to: "bob@example.com",
        subject: "Test Subject",
        text: "Test content",
        html: "<p>Test content</p>",
      });

      const payload = capturedPayload as unknown as { sender?: { name?: string } };
      assert.equal(payload.sender?.name, "OutreachOS Studio");
    });
  });

  // ==========================================
  // SECTION 3: ERROR HANDLING & RETRY POLICY
  // ==========================================
  describe("3. Error Handling, Non-Retryable Failures & Bounded Retries", () => {
    it("HTTP 401 fails immediately with zero retries", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response(
          JSON.stringify({ message: "Key not found", code: "unauthorized" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      };

      const provider = new BrevoEmailProvider({
        apiKey: "invalid-key",
        fromEmail: "outreach@outreachos.dev",
        fetchFn: mockFetch,
        baseDelayMs: 1,
      });

      const result = await provider.sendEmail({
        to: "test@example.com",
        subject: "Auth test",
        text: "Test",
        html: "<p>Test</p>",
      });

      assert.equal(result.success, false);
      assert.equal(callCount, 1, "401 must fail immediately with exactly 1 call and 0 retries");
      assert.ok(result.error?.includes("authentication error"));
    });

    it("HTTP 403 fails immediately with zero retries", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response(
          JSON.stringify({ message: "IP not authorized", code: "forbidden" }),
          { status: 403, headers: { "content-type": "application/json" } }
        );
      };

      const provider = new BrevoEmailProvider({
        apiKey: "restricted-key",
        fromEmail: "outreach@outreachos.dev",
        fetchFn: mockFetch,
        baseDelayMs: 1,
      });

      const result = await provider.sendEmail({
        to: "test@example.com",
        subject: "Forbidden test",
        text: "Test",
        html: "<p>Test</p>",
      });

      assert.equal(result.success, false);
      assert.equal(callCount, 1, "403 must fail immediately with exactly 1 call and 0 retries");
      assert.ok(result.error?.includes("forbidden"));
    });

    it("HTTP 400 fails immediately with zero retries", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response(
          JSON.stringify({ message: "Invalid email format", code: "invalid_parameter" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      };

      const provider = new BrevoEmailProvider({
        apiKey: "valid-key",
        fromEmail: "outreach@outreachos.dev",
        fetchFn: mockFetch,
        baseDelayMs: 1,
      });

      const result = await provider.sendEmail({
        to: "bad-email",
        subject: "Bad request test",
        text: "Test",
        html: "<p>Test</p>",
      });

      assert.equal(result.success, false);
      assert.equal(callCount, 1, "400 must fail immediately without retry");
      assert.ok(result.error?.includes("Invalid email parameters"));
    });

    it("HTTP 400 with unverified sender detects sender issue and advises verification", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response(
          JSON.stringify({ message: "Sender domain not verified", code: "unverified_sender" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      };

      const provider = new BrevoEmailProvider({
        apiKey: "valid-key",
        fromEmail: "unverified@randomdomain.xyz",
        fetchFn: mockFetch,
        baseDelayMs: 1,
      });

      const result = await provider.sendEmail({
        to: "recipient@example.com",
        subject: "Sender verification test",
        text: "Test",
        html: "<p>Test</p>",
      });

      assert.equal(result.success, false);
      assert.equal(callCount, 1);
      assert.ok(result.error?.includes("BREVO_FROM_EMAIL"));
      assert.ok(result.error?.includes("verified"));
    });

    it("HTTP 500 retries and succeeds if subsequent attempt succeeds", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ message: "Internal server error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ messageId: "<msg-retry-success@brevo.com>" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      };

      const provider = new BrevoEmailProvider({
        apiKey: "valid-key",
        fromEmail: "outreach@outreachos.dev",
        fetchFn: mockFetch,
        baseDelayMs: 5,
      });

      const result = await provider.sendEmail({
        to: "recipient@example.com",
        subject: "Transient 500 test",
        text: "Test",
        html: "<p>Test</p>",
      });

      assert.equal(result.success, true);
      assert.equal(result.messageId, "<msg-retry-success@brevo.com>");
      assert.equal(callCount, 2, "Should succeed on second attempt after 1 retry");
    });

    it("HTTP 503 retries and succeeds on subsequent attempt", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ message: "Service Unavailable" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ messageId: "<msg-503-retry-success@brevo.com>" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      };

      const provider = new BrevoEmailProvider({
        apiKey: "valid-key",
        fromEmail: "outreach@outreachos.dev",
        fetchFn: mockFetch,
        baseDelayMs: 5,
      });

      const result = await provider.sendEmail({
        to: "recipient@example.com",
        subject: "Transient 503 test",
        text: "Test",
        html: "<p>Test</p>",
      });

      assert.equal(result.success, true);
      assert.equal(callCount, 2);
    });

    it("HTTP 504 retries up to maxRetries (2 retries = 3 attempts total) and fails if exhausted", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        return new Response(JSON.stringify({ message: "Gateway Timeout" }), {
          status: 504,
          headers: { "content-type": "application/json" },
        });
      };

      const provider = new BrevoEmailProvider({
        apiKey: "valid-key",
        fromEmail: "outreach@outreachos.dev",
        maxRetries: 2,
        baseDelayMs: 5,
        fetchFn: mockFetch,
      });

      const result = await provider.sendEmail({
        to: "recipient@example.com",
        subject: "Transient 504 test",
        text: "Test",
        html: "<p>Test</p>",
      });

      assert.equal(result.success, false);
      assert.equal(callCount, 3, "Total attempts must be exactly 3 (initial attempt + 2 retries)");
      assert.ok(result.error?.includes("temporarily unavailable"));
    });

    it("transient network disconnect retries according to policy", async () => {
      let callCount = 0;

      const mockFetch: typeof fetch = async () => {
        callCount++;
        if (callCount === 1) {
          throw new TypeError("fetch failed");
        }
        return new Response(
          JSON.stringify({ messageId: "<msg-network-recovery@brevo.com>" }),
          { status: 201, headers: { "content-type": "application/json" } }
        );
      };

      const provider = new BrevoEmailProvider({
        apiKey: "valid-key",
        fromEmail: "outreach@outreachos.dev",
        baseDelayMs: 5,
        fetchFn: mockFetch,
      });

      const result = await provider.sendEmail({
        to: "recipient@example.com",
        subject: "Network disconnect test",
        text: "Test",
        html: "<p>Test</p>",
      });

      assert.equal(result.success, true);
      assert.equal(result.messageId, "<msg-network-recovery@brevo.com>");
      assert.equal(callCount, 2);
    });

    it("timeout is enforced and bounded", async () => {
      const mockFetch: typeof fetch = async (_input, init) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve(new Response(JSON.stringify({ messageId: "<late@brevo.com>" }), { status: 201 }));
          }, 300);

          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              clearTimeout(timeoutId);
              reject(new Error("The user aborted a request"));
            });
          }
        });
      };

      const provider = new BrevoEmailProvider({
        apiKey: "valid-key",
        fromEmail: "outreach@outreachos.dev",
        timeoutMs: 40,
        maxRetries: 1,
        baseDelayMs: 5,
        fetchFn: mockFetch,
      });

      const startTime = Date.now();
      const result = await provider.sendEmail({
        to: "recipient@example.com",
        subject: "Timeout test",
        text: "Test",
        html: "<p>Test</p>",
      });
      const elapsedMs = Date.now() - startTime;

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("timed out") || result.error?.includes("failed"));
      assert.ok(elapsedMs < 1000, `Execution should complete promptly on timeout, took ${elapsedMs}ms`);
    });
  });

  // ==========================================
  // SECTION 4: PROVIDER SELECTION PRECEDENCE
  // ==========================================
  describe("4. Provider Selection Hierarchy", () => {
    it("EMAIL_DEV_MODE=true always selects DevelopmentEmailProvider even when Brevo is configured", () => {
      process.env.EMAIL_DEV_MODE = "true";
      process.env.BREVO_API_KEY = "real-looking-brevo-key";
      process.env.BREVO_FROM_EMAIL = "studio@outreachos.dev";

      const provider = getEmailProvider();
      assert.equal(provider.name, developmentEmailProvider.name);
    });

    it("Brevo is preferred when configured and EMAIL_DEV_MODE is false", () => {
      process.env.EMAIL_DEV_MODE = "false";
      process.env.BREVO_API_KEY = "real-looking-brevo-key";
      process.env.BREVO_FROM_EMAIL = "studio@outreachos.dev";
      process.env.RESEND_API_KEY = "legacy-resend-key";

      const provider = getEmailProvider();
      assert.equal(provider.name, brevoEmailProvider.name);
    });

    it("existing legacy provider is used when Brevo is not configured and legacy provider is configured", () => {
      process.env.EMAIL_DEV_MODE = "false";
      delete process.env.BREVO_API_KEY;
      delete process.env.BREVO_FROM_EMAIL;
      process.env.RESEND_API_KEY = "legacy-resend-key";

      const provider = getEmailProvider();
      assert.equal(provider.name, productionEmailProvider.name);
    });

    it("development falls back to DevelopmentEmailProvider when no production provider is configured", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      process.env.EMAIL_DEV_MODE = "false";
      delete process.env.BREVO_API_KEY;
      delete process.env.BREVO_FROM_EMAIL;
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_SERVER_HOST;

      const provider = getEmailProvider();
      assert.equal(provider.name, developmentEmailProvider.name);
    });

    it("production with no provider configured returns safe error behavior without throwing", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.EMAIL_DEV_MODE = "false";
      delete process.env.BREVO_API_KEY;
      delete process.env.BREVO_FROM_EMAIL;
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_SERVER_HOST;

      const provider = getEmailProvider();
      assert.equal(provider.isConfigured, false);

      const result = await provider.sendEmail({
        to: "user@example.com",
        subject: "Unconfigured test",
        text: "Test",
        html: "<p>Test</p>",
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("not configured"));
    });
  });

  // ==========================================
  // SECTION 5: SECURITY & SECRET PROTECTION
  // ==========================================
  describe("5. Security & Zero Secret Leakage", () => {
    it("BREVO_API_KEY never appears in returned errors", async () => {
      const sensitiveSecret = "xkeysib-super-secret-production-key-999";
      const mockFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({ message: `API key ${sensitiveSecret} unauthorized`, code: "unauthorized" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      };

      const provider = new BrevoEmailProvider({
        apiKey: sensitiveSecret,
        fromEmail: "studio@outreachos.dev",
        fetchFn: mockFetch,
        baseDelayMs: 1,
      });

      const result = await provider.sendEmail({
        to: "victim@example.com",
        subject: "Secret check",
        text: "Secret test",
        html: "<p>Secret test</p>",
      });

      assert.equal(result.success, false);
      assert.ok(!result.error?.includes(sensitiveSecret), "Secret key must not appear in result.error");
    });

    it("verification and password reset tokens never appear in result error or logger output", async () => {
      const verificationToken = "sec_tok_verif_987654321_secret_token";
      const resetToken = "sec_tok_reset_123456789_secret_token";

      const consoleErrors: string[] = [];
      const origError = console.error;
      console.error = (...args: unknown[]) => {
        consoleErrors.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
      };

      try {
        const mockFetch: typeof fetch = async () => {
          return new Response(JSON.stringify({ message: "Bad Request" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        };

        const provider = new BrevoEmailProvider({
          apiKey: "xkeysib-secret-key",
          fromEmail: "studio@outreachos.dev",
          fetchFn: mockFetch,
          baseDelayMs: 1,
        });

        const result = await provider.sendEmail({
          to: "user@example.com",
          subject: "Reset your password",
          text: `Use this token to reset: ${resetToken} and verify: ${verificationToken}`,
          html: `<p>Token: ${resetToken} ${verificationToken}</p>`,
        });

        assert.equal(result.success, false);
        assert.ok(!result.error?.includes(resetToken));
        assert.ok(!result.error?.includes(verificationToken));

        const logged = consoleErrors.join(" ");
        assert.ok(!logged.includes(resetToken), "Password reset token must never appear in logs");
        assert.ok(!logged.includes(verificationToken), "Verification token must never appear in logs");
      } finally {
        console.error = origError;
      }
    });

    it("health endpoint exposes only safe configuration status without secrets", async () => {
      process.env.BREVO_API_KEY = "xkeysib-health-check-secret";
      process.env.BREVO_FROM_EMAIL = "outreach@verifieddomain.dev";
      delete process.env.EMAIL_DEV_MODE;

      const req = new NextRequest("http://localhost:3000/api/health");
      const res = await getHealth(req);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.emailConfigured, true);
      assert.equal(data.providers.email.name, "BrevoEmailProvider");
      assert.equal(data.providers.email.isConfigured, true);

      // Verify no secrets exposed in JSON response
      const jsonStr = JSON.stringify(data);
      assert.ok(!jsonStr.includes("xkeysib-health-check-secret"));
      assert.ok(!jsonStr.includes("BREVO_API_KEY"));
    });
  });
});
