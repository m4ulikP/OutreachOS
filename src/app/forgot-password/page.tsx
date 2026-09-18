"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Failed to submit request. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/10 text-primary text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Account Security</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Reset your password
          </h1>
          <p className="text-xs text-foreground-muted">
            Enter your email to receive a secure, single-use password reset link.
          </p>
        </div>

        {/* Card */}
        <div className="p-6 rounded-xl border border-border bg-surface shadow-md space-y-5">
          {submitted ? (
            <div className="text-center space-y-4 py-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary border border-primary/25">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">Reset link dispatched</h3>
                <p className="text-xs text-foreground-muted">
                  If an account exists for <strong className="text-foreground">{email}</strong>, a
                  password reset link has been sent. The link expires in 1 hour.
                </p>
              </div>
              <div className="pt-3 border-t border-border">
                <Link href="/login">
                  <Button variant="outline" className="w-full text-xs gap-1.5">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to sign in
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-danger/10 border border-danger/25 text-xs text-danger">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-medium text-foreground">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourdomain.com"
                    required
                    autoFocus
                    className="h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-9 text-xs font-semibold gap-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Sending reset link…</span>
                    </>
                  ) : (
                    <>
                      <span>Send reset link</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </form>

              <div className="text-center pt-2 border-t border-border">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-muted hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
