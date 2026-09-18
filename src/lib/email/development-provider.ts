import { EmailProvider, SendEmailOptions, SendEmailResult } from "./types";
import { logger } from "@/lib/logger";

export interface RecordedEmail extends SendEmailOptions {
  id: string;
  timestamp: Date;
}

/**
 * Development & Testing email provider.
 * Keeps an in-memory queue of recent outbound emails for test assertions and local verification.
 * Never leaks raw secrets or passwords to production logs.
 */
export class DevelopmentEmailProvider implements EmailProvider {
  readonly name = "DevelopmentEmailProvider";
  readonly isConfigured = true;

  private sentEmails: RecordedEmail[] = [];

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const id = `dev_mail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const recorded: RecordedEmail = {
      ...options,
      id,
      timestamp: new Date(),
    };

    this.sentEmails.push(recorded);

    // Keep queue bounded
    if (this.sentEmails.length > 200) {
      this.sentEmails.shift();
    }

    logger.info("[DevelopmentEmailProvider] Email recorded in development store", {
      messageId: id,
      to: options.to,
      subject: options.subject,
    });

    return {
      success: true,
      messageId: id,
    };
  }

  /**
   * Retrieves all recorded emails.
   */
  getSentEmails(): RecordedEmail[] {
    return [...this.sentEmails];
  }

  /**
   * Retrieves the most recent email sent to a specific recipient, or overall.
   */
  getLatestEmail(to?: string): RecordedEmail | undefined {
    if (to) {
      const normalized = to.toLowerCase().trim();
      return [...this.sentEmails]
        .reverse()
        .find((e) => e.to.toLowerCase().trim() === normalized);
    }
    return this.sentEmails[this.sentEmails.length - 1];
  }

  /**
   * Clears the in-memory recorded emails (useful for test isolation).
   */
  clear(): void {
    this.sentEmails = [];
  }
}
