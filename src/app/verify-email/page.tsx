"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  MailCheck,
  RefreshCw,
  Sparkles,
} from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const emailParam = searchParams.get("email") || "";

  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Resend state
  const [resendEmail, setResendEmail] = React.useState(emailParam);
  const [resending, setResending] = React.useState(false);
  const [resendSuccess, setResendSuccess] = React.useState(false);
  const [resendError, setResendError] = React.useState<string | null>(null);

  // Attempt verification when token and email are present in URL
  React.useEffect(() => {
    if (!token || !emailParam) return;

    let isMounted = true;
    async function verify() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, email: emailParam }),
        });

        const data = await res.json().catch(() => ({}));
        if (isMounted) {
          if (!res.ok) {
            setError(data.error || "Verification failed. The link may have expired or already been used.");
          } else {
            setSuccess(true);
          }
        }
      } catch {
        if (isMounted) {
          setError("Network error while verifying email. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    verify();
    return () => {
      isMounted = false;
    };
  }, [token, emailParam]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail || !resendEmail.includes("@")) {
      setResendError("Please provide a valid email address.");
      return;
    }

    setResending(true);
    setResendError(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail.trim() }),
      });

      if (res.ok) {
        setResendSuccess(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setResendError(data.error || "Failed to resend verification email.");
      }
    } catch {
      setResendError("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // State 1: Verification in progress
  if (loading) {
    return (
      <div className="text-center space-y-4 py-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Verifying your email…</h3>
          <p className="text-xs text-foreground-muted">
            Checking verification token against OutreachOS security authority.
          </p>
        </div>
      </div>
    );
  }

  // State 2: Verification succeeded
  if (success) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success border border-success/25">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Email Verified Successfully!</h3>
          <p className="text-xs text-foreground-muted">
            Your OutreachOS Studio account is now verified and active. You can now sign in to start
            finding leads and orchestrating campaigns.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/login">
            <Button className="w-full text-xs font-semibold gap-1.5">
              <span>Sign in to Studio</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // State 3: Error or Manual Resend form
  return (
    <div className="space-y-5">
      {error ? (
        <div className="flex items-start gap-2 p-3 rounded-md bg-danger/10 border border-danger/25 text-xs text-danger">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="leading-snug">{error}</span>
        </div>
      ) : !token ? (
        <div className="text-center space-y-1 py-1">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary border border-primary/25 mb-2">
            <Mail className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Email Verification</h3>
          <p className="text-xs text-foreground-muted">
            Enter your account email to receive a new verification link.
          </p>
        </div>
      ) : null}

      {resendSuccess ? (
        <div className="text-center space-y-3 py-3 border-t border-border">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MailCheck className="h-4 w-4" />
          </div>
          <p className="text-xs text-foreground">
            A new verification link has been sent to{" "}
            <strong className="text-primary">{resendEmail}</strong>. Please check your inbox and
            spam folder.
          </p>
          <Link href="/login">
            <Button variant="outline" size="sm" className="text-xs mt-1">
              Return to sign in
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleResend} className="space-y-3 pt-2 border-t border-border">
          <span className="block text-[11px] font-medium text-foreground-muted uppercase tracking-wider">
            Resend Verification Link
          </span>

          {resendError && (
            <div className="flex items-start gap-2 p-2.5 rounded bg-danger/10 text-[11px] text-danger">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{resendError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="you@yourdomain.com"
              required
              className="h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <Button
            type="submit"
            disabled={resending}
            variant="outline"
            className="w-full h-8 text-xs font-medium gap-1.5 justify-center"
          >
            {resending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Sending link…</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Resend Verification Email</span>
              </>
            )}
          </Button>

          <div className="text-center pt-2">
            <Link href="/login" className="text-xs text-foreground-muted hover:text-foreground">
              Return to sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/10 text-primary text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>OutreachOS Security</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Verify your email
          </h1>
          <p className="text-xs text-foreground-muted">
            Confirm your account ownership to unlock full freelancer sales studio features.
          </p>
        </div>

        {/* Card */}
        <div className="p-6 rounded-xl border border-border bg-surface shadow-md space-y-4">
          <React.Suspense
            fallback={
              <div className="text-xs text-foreground-muted text-center py-4">
                Loading verification status…
              </div>
            }
          >
            <VerifyEmailContent />
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}
