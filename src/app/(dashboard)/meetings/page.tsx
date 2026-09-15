"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function MeetingsPage() {
  return (
    <div className="space-y-6 pb-12 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Meetings
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Booking links, calendar synchronization, and automated stage transitions
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <LinkIcon className="h-3.5 w-3.5" />
            Calendar Settings
          </Button>
        </Link>
      </div>

      <section className="rounded-lg border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold text-foreground">
            Automated Meeting Transitions
          </h2>
        </div>
        <p className="text-xs text-foreground-muted leading-relaxed max-w-2xl">
          When a prospect reserves a 15-minute or 30-minute discovery call using your personalized booking link, OutreachOS automatically advances their pipeline status to <span className="font-semibold text-foreground">Discovery Call</span> and logs the event in your activity feed.
        </p>
      </section>

      <EmptyState
        icon={<Calendar className="h-6 w-6" />}
        title="No meetings currently scheduled"
        description="Connect Google Calendar in Settings to enable real-time synchronization and generate personalized discovery links."
        action={
          <Link href="/settings">
            <Button size="sm">Connect Google Calendar</Button>
          </Link>
        }
        className="py-16"
      />
    </div>
  );
}
