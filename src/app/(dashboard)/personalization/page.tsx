"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PenLine, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function PersonalizationPage() {
  return (
    <div className="space-y-6 pb-12 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Personalization
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Research verified prospect facts and generate tailored cold pitches
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            Personalization Settings
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Fact-Based Pitch Architecture
            </h2>
            <p className="text-xs text-foreground-muted">
              OutreachOS grounds every generated email in verified client signals to avoid generic templates
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3.5 rounded-md border border-border bg-surface-elevated space-y-1">
            <span className="font-semibold text-foreground">1. Fact Extraction</span>
            <p className="text-foreground-muted leading-relaxed">
              Extract company stack, hiring needs, and role scope directly from verified prospect data.
            </p>
          </div>
          <div className="p-3.5 rounded-md border border-border bg-surface-elevated space-y-1">
            <span className="font-semibold text-foreground">2. Tailored Pitch Generation</span>
            <p className="text-foreground-muted leading-relaxed">
              Connect your freelance service offering to prospect pain points in concise, 3-sentence notes.
            </p>
          </div>
          <div className="p-3.5 rounded-md border border-border bg-surface-elevated space-y-1">
            <span className="font-semibold text-foreground">3. Studio Review</span>
            <p className="text-foreground-muted leading-relaxed">
              Review, edit, and approve every pitch before anything is dispatched to prospects.
            </p>
          </div>
        </div>
      </section>

      <EmptyState
        icon={<PenLine className="h-6 w-6" />}
        title="Ready to personalize outreach"
        description="Select any prospect from your Leads workspace to review their company profile and draft personalized pitches."
        action={
          <Link href="/leads">
            <Button size="sm">Browse Leads to Personalize</Button>
          </Link>
        }
        className="py-16"
      />
    </div>
  );
}
