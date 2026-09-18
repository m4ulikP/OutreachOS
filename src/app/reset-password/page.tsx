"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  if (!token || !email) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/15 text-danger border border-danger/25">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Invalid Reset Link</h3>
          <p className="text-xs text-foreground-muted">
            This password reset link is missing required parameters or is malformed.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/forgot-password">
            <Button variant="outline" className="w-full text-xs">
              Request a new password reset link
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Password reset failed. The link may have expired.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success border border-success/25">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Password Reset Complete</h3>
          <p className="text-xs text-foreground-muted">
            Your password has been updated and any prior sessions have been revoked. You can now sign
            in with your new password.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/login">
            <Button className="w-full text-xs gap-1.5 font-semibold">
              Sign in to OutreachOS
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-danger/10 border border-danger/25 text-xs text-danger">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="leading-snug">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-2 rounded bg-surface-elevated border border-border text-[11px] text-foreground-muted">
          Resetting password for: <strong className="text-foreground">{email}</strong>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs font-medium text-foreground">
            New Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoFocus
              className="h-9 w-full rounded-md border border-border bg-surface-elevated pl-3 pr-9 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-foreground-muted">
            Minimum 8 characters with 1 uppercase, 1 lowercase, and 1 number.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-xs font-medium text-foreground">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full h-9 text-xs font-semibold gap-1.5">
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Updating password…</span>
            </>
          ) : (
            <>
              <span>Save new password</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/10 text-primary text-xs font-semibold">
            <Lock className="h-3.5 w-3.5" />
            <span>Secure Password Reset</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Choose a new password
          </h1>
          <p className="text-xs text-foreground-muted">
            Enter a strong password to secure your OutreachOS studio account.
          </p>
        </div>

        {/* Card */}
        <div className="p-6 rounded-xl border border-border bg-surface shadow-md space-y-5">
          <React.Suspense
            fallback={
              <div className="text-xs text-foreground-muted text-center py-4">
                Loading password reset…
              </div>
            }
          >
            <ResetPasswordForm />
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}
