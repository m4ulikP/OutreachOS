import { EmailProvider, SendEmailOptions, SendEmailResult } from "./types";
import { logger } from "@/lib/logger";

/**
 * Production email provider supporting Resend / standard transactional API.
 * Gracefully reports when unconfigured without throwing uncaught exceptions.
 */
export class ProductionEmailProvider implements EmailProvider {
  readonly name = "ProductionEmailProvider";

  get isConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_SERVER_HOST);
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.isConfigured) {
      logger.warn("[ProductionEmailProvider] Outbound email requested but no provider configured", {
        to: options.to,
        subject: options.subject,
      });
      return {
        success: false,
        error: "Production email provider is not configured. Set RESEND_API_KEY or SMTP credentials in environment.",
      };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.EMAIL_FROM || "OutreachOS <outreach@outreachos.dev>";

    if (resendApiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [options.to],
            subject: options.subject,
            text: options.text,
            html: options.html,
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          logger.error("[ProductionEmailProvider] Resend API error", {
            status: response.status,
            error: errText,
          });
          return {
            success: false,
            error: `Resend API returned status ${response.status}`,
          };
        }

        const data = (await response.json()) as { id?: string };
        return {
          success: true,
          messageId: data.id,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("[ProductionEmailProvider] Failed to dispatch email via Resend", {
          error: msg,
        });
        return {
          success: false,
          error: msg,
        };
      }
    }

    return {
      success: false,
      error: "No supported production email provider adapter available.",
    };
  }
}
