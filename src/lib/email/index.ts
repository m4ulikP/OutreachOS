import { EmailProvider } from "./types";
import { DevelopmentEmailProvider } from "./development-provider";
import { ProductionEmailProvider } from "./production-provider";
import { BrevoEmailProvider } from "./brevo-provider";

export * from "./types";
export * from "./development-provider";
export * from "./production-provider";
export * from "./brevo-provider";

// Singleton provider instances for local inspection, testing, and production runtime
export const developmentEmailProvider = new DevelopmentEmailProvider();
export const brevoEmailProvider = new BrevoEmailProvider();
export const productionEmailProvider = new ProductionEmailProvider();

/**
 * Returns the active email provider based on environment and configuration.
 * Order of precedence:
 * 1. EMAIL_DEV_MODE === "true" -> DevelopmentEmailProvider (offline test/mock precedence)
 * 2. Brevo configured (BREVO_API_KEY + BREVO_FROM_EMAIL) -> BrevoEmailProvider
 * 3. Legacy Resend/SMTP configured -> ProductionEmailProvider
 * 4. Production environment with no provider configured -> safe unconfigured provider error
 * 5. Development environment without Brevo configured -> DevelopmentEmailProvider
 */
export function getEmailProvider(): EmailProvider {
  if (process.env.EMAIL_DEV_MODE === "true") {
    return developmentEmailProvider;
  }

  if (brevoEmailProvider.isConfigured) {
    return brevoEmailProvider;
  }

  if (productionEmailProvider.isConfigured) {
    return productionEmailProvider;
  }

  if (process.env.NODE_ENV === "production") {
    return productionEmailProvider;
  }

  return developmentEmailProvider;
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * Dispatches an email verification message containing a secure one-time verification link.
 * Note: Never logs the token.
 */
export async function sendVerificationEmail(params: {
  email: string;
  rawToken: string;
  name?: string | null;
}) {
  const provider = getEmailProvider();
  const appUrl = getAppUrl();
  const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(params.rawToken)}&email=${encodeURIComponent(params.email)}`;
  const displayName = params.name?.trim() || params.email.split("@")[0];

  return provider.sendEmail({
    to: params.email,
    subject: "Verify your OutreachOS Studio account",
    text: `Hello ${displayName},\n\nPlease verify your email address for OutreachOS by clicking the following link:\n${verifyUrl}\n\nThis verification link will expire in 24 hours.\n\nIf you did not create an OutreachOS account, you can safely ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
        <h2 style="color: #ff5a1f; margin-bottom: 16px;">Verify your OutreachOS account</h2>
        <p>Hello ${displayName},</p>
        <p>Thank you for signing up for OutreachOS Freelancer Sales Studio. Please verify your email address to confirm your identity.</p>
        <div style="margin: 28px 0;">
          <a href="${verifyUrl}" style="background-color: #ff5a1f; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="font-size: 13px; color: #666;">Or copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #888; word-break: break-all;">${verifyUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 11px; color: #999;">This link will expire in 24 hours. If you did not sign up for OutreachOS, please ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Dispatches a password reset email containing a secure one-time reset link.
 * Note: Never logs the token.
 */
export async function sendPasswordResetEmail(params: {
  email: string;
  rawToken: string;
  name?: string | null;
}) {
  const provider = getEmailProvider();
  const appUrl = getAppUrl();
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(params.rawToken)}&email=${encodeURIComponent(params.email)}`;
  const displayName = params.name?.trim() || params.email.split("@")[0];

  return provider.sendEmail({
    to: params.email,
    subject: "Reset your OutreachOS password",
    text: `Hello ${displayName},\n\nA password reset was requested for your OutreachOS account. Please click the link below to set a new password:\n${resetUrl}\n\nThis reset link is valid for 1 hour and can only be used once.\n\nIf you did not request a password reset, please ignore this email or review your account security.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
        <h2 style="color: #ff5a1f; margin-bottom: 16px;">Reset your OutreachOS password</h2>
        <p>Hello ${displayName},</p>
        <p>We received a request to reset your password for your OutreachOS account. Click the button below to choose a new password.</p>
        <div style="margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #ff5a1f; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
        </div>
        <p style="font-size: 13px; color: #666;">Or copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #888; word-break: break-all;">${resetUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 11px; color: #999;">This link will expire in 1 hour and can only be used once. If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });
}
