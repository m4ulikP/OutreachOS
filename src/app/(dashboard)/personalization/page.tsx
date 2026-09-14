"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function PersonalizationPage() {
  return (
    <div className="space-y-6 pb-12 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AI Personalization Studio
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Extract verified prospect facts and generate tailored cold pitches
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            AI Settings
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Verified Facts Safeguard Architecture
          </CardTitle>
          <CardDescription>
            OutreachOS strictly prohibits AI hallucinations and unverified claims
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-border bg-card space-y-1">
              <span className="font-semibold text-foreground">1. Fact Extraction</span>
              <p className="text-muted-foreground leading-relaxed">
                Extract verified company tech stack, recent funding, and role scope from authorized sources.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card space-y-1">
              <span className="font-semibold text-foreground">2. Tailored Pitch Generation</span>
              <p className="text-muted-foreground leading-relaxed">
                Combine your freelance offer with prospect pain points to craft short, high-converting messages.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card space-y-1">
              <span className="font-semibold text-foreground">3. Human Review & Editing</span>
              <p className="text-muted-foreground leading-relaxed">
                Full review and manual editing before any message is queued or dispatched.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <EmptyState
        icon={<Sparkles className="h-6 w-6" />}
        title="Ready to personalize outreach"
        description="Select any prospect from your Lead Database to research company context and generate tailored pitches."
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
