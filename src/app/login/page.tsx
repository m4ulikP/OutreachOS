"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/leads";
  const urlError = searchParams.get("error");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [oauthLoading, setOauthLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (urlError === "OAuthAccountNotLinked") {
      setError(
        "This email is already associated with an account. Please sign in with your email and password, or use the provider initially used."
      );
    } else if (urlError === "OAuthCallback" || urlError === "OAuthSignin") {
      setError("Unable to authenticate with Google. Please try again or sign in with email.");
    } else if (urlError === "CredentialsSignin") {
      setError("Invalid email or password. Please check your credentials.");
    }
  }, [urlError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        setError("Invalid email or password. Please verify your credentials and try again.");
      } else if (res?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An unexpected authentication error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("Failed to initiate Google sign in. Please try again.");
      setOauthLoading(false);
    }
  };

  const handleDevSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email: "maulik@outreachos.dev",
        password: "dev-quick-access",
        redirect: false,
        callbackUrl,
      });

      if (res?.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        setError("Dev sign-in failed.");
      }
    } catch {
      setError("Dev sign-in error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/10 text-primary text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Freelancer Sales Studio</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Sign in to OutreachOS
        </h1>
        <p className="text-xs text-foreground-muted">
          Access your high-conversion prospect pipeline and outreach studio.
        </p>
      </div>

      {/* Card */}
      <div className="p-6 rounded-xl border border-border bg-surface shadow-md space-y-5">
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
            or sign in with email
          </span>
          <div className="border-t border-border w-full" />
        </div>

        {/* Credentials Form */}
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
              autoComplete="email"
              className="h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-xs font-medium text-foreground">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
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
          </div>

          <Button
            type="submit"
            disabled={loading || oauthLoading}
            className="w-full h-9 text-xs font-semibold gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </form>

        {/* Signup Redirect */}
        <div className="text-center pt-2 border-t border-border">
          <p className="text-xs text-foreground-muted">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">
              Create account
            </Link>
          </p>
        </div>

        {/* Quick Dev Login for local usability */}
        {process.env.NODE_ENV !== "production" && (
          <div className="pt-2 border-t border-dashed border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-foreground-muted uppercase tracking-wider">
                Quick Dev Access
              </span>
              <span className="text-[10px] text-foreground-subtle">Local Testing Only</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading || oauthLoading}
              onClick={handleDevSignIn}
              className="w-full text-xs gap-1.5 justify-center"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Sign in as Maulik Pandey (Dev Seed)
            </Button>
          </div>
        )}
      </div>

      {/* Security assurance */}
      <p className="text-center text-[11px] text-foreground-subtle">
        Protected by cryptographically signed HTTP-only sessions with multi-tenant isolation.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <React.Suspense
        fallback={
          <div className="text-xs text-foreground-muted">Loading studio sign-in…</div>
        }
      >
        <LoginForm />
      </React.Suspense>
    </div>
  );
}
