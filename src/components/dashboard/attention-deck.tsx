"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

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
  // Estimated follow-ups due: contacted prospects awaiting next touchpoint
  const followUpsEstimated = Math.max(0, Math.floor(emailsSent * 0.35));

  const items = [
    {
      label: "Positive replies",
      count: positiveReplies,
      status: positiveReplies > 0 ? "Requires response" : "None pending",
      hint: "Qualified interest",
      href: "/leads?stage=POSITIVE_REPLY",
      indicatorColor: "bg-success",
      countColor: positiveReplies > 0 ? "text-success" : "text-foreground",
    },
    {
      label: "Follow-ups due",
      count: followUpsEstimated,
      status: followUpsEstimated > 0 ? "Awaiting touchpoint" : "Up to date",
      hint: "Stalled threads",
      href: "/leads?stage=FOLLOW_UP",
      indicatorColor: "bg-warning",
      countColor: followUpsEstimated > 0 ? "text-warning" : "text-foreground",
    },
    {
      label: "Upcoming calls",
      count: meetingsBooked,
      status: meetingsBooked > 0 ? "Scheduled calls" : "No calls today",
      hint: "Discovery sessions",
      href: "/meetings",
      indicatorColor: "bg-info",
      countColor: "text-foreground",
    },
    {
      label: "Active pipeline",
      count: totalLeads,
      status: replyRate > 0 ? `${replyRate.toFixed(1)}% reply rate` : "Prospects tracked",
      hint: "Total volume",
      href: "/leads",
      indicatorColor: "bg-primary",
      countColor: "text-foreground",
    },
  ];

  return (
    <section aria-label="Today" className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Today
        </h2>
        <span className="text-[11px] text-foreground-subtle">
          Pipeline status
        </span>
      </div>

      {/* Clean low-chrome grid with warm dividers instead of floating card walls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-md border border-border bg-surface divide-y sm:divide-y-0 sm:divide-x divide-border">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group relative p-3.5 transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <div className="flex items-center justify-between text-xs text-foreground-muted mb-1">
              <span className="font-medium flex items-center gap-1.5 text-foreground">
                <span className={cn("h-2 w-2 rounded-full shrink-0", item.indicatorColor)} />
                {item.label}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className={cn("text-2xl font-bold font-mono tracking-tight tabular-nums", item.countColor)}>
                {item.count}
              </span>
              <span className="text-[11px] text-foreground-muted">
                {item.status}
              </span>
            </div>

            <p className="text-[11px] text-foreground-subtle mt-0.5 truncate">
              {item.hint}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
