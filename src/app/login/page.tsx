"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        name: name.trim() || undefined,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        setError("Sign-in failed. Please check your credentials and try again.");
      } else if (res?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDevSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email: "maulik@outreachos.dev",
        name: "Maulik Pandey",
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
          Secure, server-signed session access to your outreach pipeline.
        </p>
      </div>

      {/* Card */}
      <div className="p-6 rounded-xl border border-border bg-surface shadow-md space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-danger/10 border border-danger/25 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
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

          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-xs font-medium text-foreground">
              Full Name <span className="text-foreground-muted font-normal">(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maulik Pandey"
              className="h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-9 text-xs font-semibold gap-1.5"
          >
            {loading ? "Signing in…" : "Sign In to Studio"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </form>

        {/* Quick Dev Login for local usability */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-foreground-muted uppercase tracking-wider">
              Quick Access
            </span>
            <span className="text-[10px] text-foreground-subtle">Local Workspace</span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={handleDevSignIn}
            className="w-full text-xs gap-1.5 justify-center"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Sign in as Maulik Pandey (Dev Account)
          </Button>
        </div>
      </div>

      {/* Security assurance */}
      <p className="text-center text-[11px] text-foreground-subtle">
        Protected by cryptographically signed HTTP-only session cookies.
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
