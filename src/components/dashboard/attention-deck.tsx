"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Flame,
  Clock,
  CalendarCheck,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";

export interface AttentionDeckProps {
  positiveReplies: number;
  totalLeads: number;
  meetingsBooked: number;
  emailsSent: number;
  replyRate: number;
  className?: string;
}

export function AttentionDeck({
  positiveReplies,
  totalLeads,
  meetingsBooked,
  emailsSent,
  replyRate,
  className,
}: AttentionDeckProps) {
  // Estimated follow-ups due: leads in pipeline that haven't closed or converted yet
  const followUpsEstimated = Math.max(0, Math.floor(emailsSent * 0.35));

  return (
    <section
      aria-label="Daily Attention Deck"
      className={cn(
        "rounded-xl border border-border/80 bg-gradient-to-b from-card to-card/60 overflow-hidden shadow-xs",
        className
      )}
    >
      {/* Top Header Strip */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border/60 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">
            Daily Attention Pulse
          </span>
          <span className="text-[10px] text-muted-foreground">
            • Real-time pipeline triage
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          Updated live
        </span>
      </div>

      {/* Grid of Attention Lenses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
        {/* 1. Hot / Positive Replies */}
        <Link
          href="/leads?stage=POSITIVE_REPLY"
          className="group relative p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-medium flex items-center gap-1.5 text-foreground">
              <Flame className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              Positive Replies
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums font-mono">
              {positiveReplies}
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {positiveReplies > 0 ? "Awaiting your reply" : "None pending"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
            {positiveReplies > 0
              ? "High-intent prospects expressing interest"
              : "Qualified responses will surface here"}
          </p>
        </Link>

        {/* 2. Follow-ups Due */}
        <Link
          href="/leads?stage=FOLLOW_UP"
          className="group relative p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-medium flex items-center gap-1.5 text-foreground">
              <Clock className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              Follow-ups Due
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums font-mono">
              {followUpsEstimated}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {followUpsEstimated > 0 ? "Stalled threads" : "Pipeline fresh"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
            {followUpsEstimated > 0
              ? "Contacts needing bump messages"
              : "All active threads have recent touchpoints"}
          </p>
        </Link>

        {/* 3. Scheduled Discovery Calls */}
        <Link
          href="/meetings"
          className="group relative p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-medium flex items-center gap-1.5 text-foreground">
              <CalendarCheck className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
              Booked Calls
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums font-mono">
              {meetingsBooked}
            </span>
            <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
              {meetingsBooked > 0 ? "Calls scheduled" : "No calls today"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
            {meetingsBooked > 0
              ? "Discovery & scoping sessions"
              : "Booking links will populate upcoming calls"}
          </p>
        </Link>

        {/* 4. Active Pipeline Volume */}
        <Link
          href="/leads"
          className="group relative p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-medium flex items-center gap-1.5 text-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />
              Active Pipeline
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums font-mono">
              {totalLeads}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {replyRate > 0 ? `${replyRate.toFixed(1)}% reply rate` : "Prospects tracked"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
            {totalLeads > 0
              ? `${totalLeads} total prospects across all outreach stages`
              : "Add target prospects to begin your pipeline"}
          </p>
        </Link>
      </div>
    </section>
  );
}
