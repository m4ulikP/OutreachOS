import { BrevoClient, BrevoTimeoutError } from "@getbrevo/brevo";
import { EmailProvider, SendEmailOptions, SendEmailResult } from "./types";
import { logger } from "@/lib/logger";

export interface BrevoProviderConfig {
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  fetchFn?: typeof fetch;
  client?: BrevoClient;
}

/**
 * Helper delay function for exponential backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts numeric HTTP status code from unknown errors.
 */
function extractStatusCode(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  if ("statusCode" in err && typeof (err as { statusCode: unknown }).statusCode === "number") {
    return (err as { statusCode: number }).statusCode;
  }
  if ("status" in err && typeof (err as { status: unknown }).status === "number") {
    return (err as { status: number }).status;
  }
  return undefined;
}

/**
 * Determines whether an error is transient and eligible for retry.
 * - Retry: HTTP 500, 502, 503, 504, and transient network disconnects/timeouts
 * - Do NOT retry: HTTP 400, 401, 403, 404, etc.
 */
function isTransientError(err: unknown, statusCode?: number): boolean {
  if (statusCode !== undefined) {
    return [500, 502, 503, 504].includes(statusCode);
  }

  if (err instanceof BrevoTimeoutError) {
    return true;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const name = err.name.toLowerCase();
    return (
      name.includes("abort") ||
      name.includes("timeout") ||
      msg.includes("fetch failed") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("enotfound") ||
      msg.includes("socket hang up") ||
      msg.includes("aborted") ||
      msg.includes("timeout")
    );
  }

  return false;
}

/**
 * Sanitizes Brevo API errors so that raw keys, tokens, PII, and sensitive internals
 * are never leaked to server logs or client responses.
 */
function sanitizeBrevoError(err: unknown, statusCode?: number): {
  logMessage: string;
  userMessage: string;
} {
  if (statusCode === 401) {
    return {
      logMessage: "Brevo authentication failed (HTTP 401). Invalid or unauthorized API key.",
      userMessage: "Email delivery failed: Brevo authentication error. Check BREVO_API_KEY.",
    };
  }

  if (statusCode === 403) {
    return {
      logMessage: "Brevo request forbidden (HTTP 403). Account or IP access restricted.",
      userMessage: "Email delivery failed: Brevo access forbidden.",
    };
  }

  if (statusCode === 400) {
    let errBodyStr = "";
    if (err && typeof err === "object") {
      const body = (err as Record<string, unknown>).body;
      if (body && typeof body === "object") {
        errBodyStr = JSON.stringify(body).toLowerCase();
      } else if (typeof body === "string") {
        errBodyStr = body.toLowerCase();
      }
      if (typeof (err as Error).message === "string") {
        errBodyStr += " " + (err as Error).message.toLowerCase();
      }
    }

    const isSenderIssue =
      errBodyStr.includes("sender") ||
      errBodyStr.includes("domain") ||
      errBodyStr.includes("from");

    if (isSenderIssue) {
      return {
        logMessage: "Brevo rejected unverified or invalid sender email (HTTP 400).",
        userMessage:
          "Email delivery failed: Brevo sender email is unverified or invalid. Ensure BREVO_FROM_EMAIL corresponds to a verified sender domain in Brevo.",
      };
    }

    return {
      logMessage: "Bad request sent to Brevo API (HTTP 400).",
      userMessage: "Email delivery failed: Invalid email parameters.",
    };
  }

  if (statusCode && [500, 502, 503, 504].includes(statusCode)) {
    return {
      logMessage: `Brevo service returned server error (HTTP ${statusCode}).`,
      userMessage: `Email delivery failed: Brevo service temporarily unavailable (HTTP ${statusCode}).`,
    };
  }

  if (
    err instanceof BrevoTimeoutError ||
    (err instanceof Error &&
      (err.name.toLowerCase().includes("abort") ||
        err.name.toLowerCase().includes("timeout") ||
        err.message.toLowerCase().includes("timeout") ||
        err.message.toLowerCase().includes("aborted")))
  ) {
    return {
      logMessage: "Brevo request timed out after 8 seconds.",
      userMessage: "Email delivery timed out after 8 seconds.",
    };
  }

  return {
    logMessage: "Network or connection error communicating with Brevo.",
    userMessage: "Email delivery failed due to network connection error.",
  };
}

/**
 * Production Transactional Email Provider for Brevo.
 * Implements the standard EmailProvider interface with strict bounded retries,
 * 8-second timeout, structured logging, and zero credential leakage.
 */
export class BrevoEmailProvider implements EmailProvider {
  readonly name = "BrevoEmailProvider";

  constructor(private config: BrevoProviderConfig = {}) {}

  /**
   * Indicates whether required Brevo credentials are configured in the environment or constructor.
   * Server-side only: never reads or exposes NEXT_PUBLIC_ variables.
   */
  get isConfigured(): boolean {
    const apiKey = this.config.apiKey ?? process.env.BREVO_API_KEY;
    const fromEmail = this.config.fromEmail ?? process.env.BREVO_FROM_EMAIL;
    return Boolean(apiKey && apiKey.trim() && fromEmail && fromEmail.trim());
  }

  /**
   * Sends an outbound transactional email through Brevo's official API.
   * Implements a single bounded application-level retry policy:
   * - Max 2 retries (total 3 attempts) for HTTP 500, 502, 503, 504 and network disconnects
   * - Fails fast immediately without retrying on 400, 401, 403, and unverified senders
   * - Enforces an 8-second timeout via AbortController
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.isConfigured) {
      const recipientDomain = options.to.includes("@") ? options.to.split("@")[1] : undefined;
      logger.warn("[BrevoEmailProvider] Outbound email requested but Brevo is not configured", {
        recipientDomain,
        subject: options.subject,
      });
      return {
        success: false,
        error: "Brevo email provider is not configured. Set BREVO_API_KEY and BREVO_FROM_EMAIL in environment variables.",
      };
    }

    const apiKey = (this.config.apiKey ?? process.env.BREVO_API_KEY ?? "").trim();
    const fromEmail = (this.config.fromEmail ?? process.env.BREVO_FROM_EMAIL ?? "").trim();
    const fromName = (this.config.fromName ?? process.env.BREVO_FROM_NAME ?? "OutreachOS Studio").trim();
    const timeoutMs = this.config.timeoutMs ?? 8000;
    const maxRetries = this.config.maxRetries ?? 2;
    const baseDelayMs = this.config.baseDelayMs ?? 250;

    let attempt = 0;
    let lastError: unknown = null;

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(new Error(`Brevo request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        // Instantiate BrevoClient with maxRetries: 0 to prevent SDK-level retry stacking
        const client =
          this.config.client ??
          new BrevoClient({
            apiKey,
            maxRetries: 0,
            timeoutInSeconds: Math.ceil(timeoutMs / 1000),
            fetch: this.config.fetchFn,
          });

        const response = await client.transactionalEmails.sendTransacEmail(
          {
            sender: {
              email: fromEmail,
              name: fromName,
            },
            to: [{ email: options.to }],
            subject: options.subject,
            htmlContent: options.html,
            textContent: options.text,
          },
          {
            abortSignal: controller.signal,
            timeoutInSeconds: Math.ceil(timeoutMs / 1000),
          }
        );

        clearTimeout(timeoutId);

        const messageId = response?.messageId;
        const recipientDomain = options.to.includes("@") ? options.to.split("@")[1] : undefined;

        logger.info("[BrevoEmailProvider] Outbound email dispatched successfully via Brevo", {
          messageId,
          recipientDomain,
          subject: options.subject,
        });

        return {
          success: true,
          messageId,
        };
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        lastError = err;

        const statusCode = extractStatusCode(err);
        const isTransient = isTransientError(err, statusCode);
        const recipientDomain = options.to.includes("@") ? options.to.split("@")[1] : undefined;

        // Fail fast immediately on non-transient errors (e.g. 400, 401, 403, 404)
        if (!isTransient) {
          const sanitized = sanitizeBrevoError(err, statusCode);
          logger.error("[BrevoEmailProvider] Non-retryable error dispatching email via Brevo", {
            statusCode,
            error: sanitized.logMessage,
            recipientDomain,
            subject: options.subject,
          });

          return {
            success: false,
            error: sanitized.userMessage,
          };
        }

        // Retry on transient failure if retries remain
        if (attempt < maxRetries) {
          const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 2000);
          logger.warn(
            `[BrevoEmailProvider] Transient failure dispatching email via Brevo (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`,
            {
              statusCode,
              attempt: attempt + 1,
            }
          );
          await sleep(delay);
          attempt++;
        } else {
          break;
        }
      }
    }

    // All retries exhausted
    const statusCode = extractStatusCode(lastError);
    const sanitized = sanitizeBrevoError(lastError, statusCode);
    const recipientDomain = options.to.includes("@") ? options.to.split("@")[1] : undefined;

    logger.error(
      `[BrevoEmailProvider] Exhausted retries dispatching email via Brevo (${maxRetries + 1} attempts)`,
      {
        statusCode,
        error: sanitized.logMessage,
        recipientDomain,
        subject: options.subject,
      }
    );

    return {
      success: false,
      error: sanitized.userMessage,
    };
  }
}
