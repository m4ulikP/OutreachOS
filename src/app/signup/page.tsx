"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Sparkles,
} from "lucide-react";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function SignupPage() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [oauthLoading, setOauthLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Signup failed. Please check your information.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl: "/leads" });
    } catch {
      setError("Failed to initiate Google sign in. Please try again.");
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/10 text-primary text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Freelancer Sales Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="text-xs text-foreground-muted">
            Start finding high-value prospects and streamlining your client outreach.
          </p>
        </div>

        {/* Card */}
        <div className="p-6 rounded-xl border border-border bg-surface shadow-md space-y-5">
          {success ? (
            <div className="text-center space-y-4 py-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success border border-success/25">
                <Mail className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">Check your inbox</h3>
                <p className="text-xs text-foreground-muted">
                  We sent a verification link to{" "}
                  <strong className="text-foreground">{email}</strong>. Please click the link to
                  verify your account.
                </p>
              </div>
              <div className="pt-3 border-t border-border flex flex-col gap-2">
                <Link href="/login">
                  <Button variant="outline" className="w-full text-xs">
                    Return to sign in
                  </Button>
                </Link>
                <p className="text-[11px] text-foreground-subtle">
                  Didn&apos;t receive it? Check spam or resend from the{" "}
                  <Link href="/verify-email" className="text-primary hover:underline">
                    verification page
                  </Link>
                  .
                </p>
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

              {/* Google OAuth Button */}
              <Button
                type="button"
                variant="outline"
                disabled={loading || oauthLoading}
                onClick={handleGoogleSignIn}
                className="w-full h-9 text-xs font-medium gap-2 justify-center border-border hover:bg-surface-elevated"
              >
                {oauthLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-foreground-muted" />
                ) : (
                  <GoogleIcon className="h-4 w-4" />
                )}
                <span>Continue with Google</span>
              </Button>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-border w-full" />
                <span className="bg-surface px-2 text-[11px] text-foreground-muted uppercase tracking-wider shrink-0">
                  or sign up with email
                </span>
                <div className="border-t border-border w-full" />
              </div>

              {/* Signup Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="block text-xs font-medium text-foreground">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                    autoFocus
                    autoComplete="name"
                    className="h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

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
                    autoComplete="email"
                    className="h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-xs font-medium text-foreground">
                    Password
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
                      autoComplete="new-password"
                      className="h-9 w-full rounded-md border border-border bg-surface-elevated pl-3 pr-9 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-foreground-muted">
                    At least 8 characters with 1 uppercase, 1 lowercase, and 1 number.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-medium text-foreground"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || oauthLoading}
                  className="w-full h-9 text-xs font-semibold gap-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating account…</span>
                    </>
                  ) : (
                    <>
                      <span>Create account</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </form>

              {/* Sign in redirect */}
              <div className="text-center pt-2 border-t border-border">
                <p className="text-xs text-foreground-muted">
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Security assurance */}
        <p className="text-center text-[11px] text-foreground-subtle">
          Tenant data is isolated and protected by strict server-side encryption and authentication.
        </p>
      </div>
    </div>
  );
}
