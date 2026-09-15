"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Send, Plus, Clock } from "lucide-react";
import Link from "next/link";

export default function CampaignsPage() {
  return (
    <div className="space-y-6 pb-12 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Campaigns
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Multi-step email sequences with automatic reply detection and follow-up stopping
          </p>
        </div>
        <Link href="/leads">
          <Button size="sm" className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            New Campaign from Leads
          </Button>
        </Link>
      </div>

      <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-warning" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Follow-up Sequence Cadence
            </h2>
            <p className="text-xs text-foreground-muted">
              Outreach sequences automatically halt upon prospect reply, bounce, or unsubscribe
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs pt-1">
          <div className="p-3 rounded-md border border-border bg-surface-elevated space-y-1">
            <span className="font-semibold text-foreground">Step 1: Introduction</span>
            <p className="text-foreground-muted">Initial personalized value pitch to verified decision maker.</p>
          </div>
          <div className="p-3 rounded-md border border-border bg-surface-elevated space-y-1">
            <span className="font-semibold text-foreground">Step 2: 3-Day Check</span>
            <p className="text-foreground-muted">Polite reminder referencing a relevant portfolio case study.</p>
          </div>
          <div className="p-3 rounded-md border border-border bg-surface-elevated space-y-1">
            <span className="font-semibold text-foreground">Step 3: 4-Day Bump</span>
            <p className="text-foreground-muted">Concise question confirming if this falls under their current priority.</p>
          </div>
          <div className="p-3 rounded-md border border-border bg-surface-elevated space-y-1">
            <span className="font-semibold text-foreground">Step 4: Break-Up</span>
            <p className="text-foreground-muted">Graceful closing note keeping the door open for future collaboration.</p>
          </div>
        </div>
      </section>

      <EmptyState
        icon={<Send className="h-6 w-6" />}
        title="No active outreach campaigns"
        description="Select prospects from your Leads workspace to start an automated sequence. Connect your sending account in Settings to activate email dispatch."
        action={
          <Link href="/leads">
            <Button size="sm">Select Leads to Begin</Button>
          </Link>
        }
        className="py-16"
      />
    </div>
  );
}
