"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Send, Plus, CalendarClock } from "lucide-react";
import Link from "next/link";

export default function CampaignsPage() {
  return (
    <div className="space-y-6 pb-12 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Email Campaigns
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated multi-step outreach sequences with smart follow-up logic
          </p>
        </div>
        <Link href="/leads">
          <Button size="sm" className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Create Campaign from Leads
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Follow-up Cadence Architecture</CardTitle>
          <CardDescription>
            Engine stops automatically upon reply detection, bounce, or unsubscribe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground py-2">
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
              <span className="font-semibold text-foreground">Step 1:</span> Initial Email
            </div>
            <span>→</span>
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
              <span className="font-semibold text-foreground">Step 2:</span> Wait 3 days → Follow-up 1
            </div>
            <span>→</span>
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
              <span className="font-semibold text-foreground">Step 3:</span> Wait 4 days → Follow-up 2
            </div>
            <span>→</span>
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
              <span className="font-semibold text-foreground">Step 4:</span> Wait 7 days → Break-up Email
            </div>
          </div>
        </CardContent>
      </Card>

      <EmptyState
        icon={<Send className="h-6 w-6" />}
        title="No active outreach campaigns"
        description="Select prospects from your Lead Database to initiate a multi-touch sequence. Connect your sending account in Settings to activate background jobs."
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
