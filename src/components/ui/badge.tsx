import * as React from "react";
import { cn } from "@/lib/utils";
import { LeadStage, TagType } from "@prisma/client";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "info";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full transition-colors border",
        size === "sm" ? "px-2 py-0.5 text-[11px] leading-none" : "px-2.5 py-0.5 text-xs",
        variant === "default" && "bg-secondary text-secondary-foreground border-border",
        variant === "secondary" && "bg-muted text-muted-foreground border-transparent",
        variant === "outline" && "border-border text-foreground",
        variant === "success" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
        variant === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
        variant === "destructive" && "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
        variant === "info" && "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function LeadStageBadge({ stage }: { stage: LeadStage | string }) {
  switch (stage) {
    case "NEW":
      return <Badge variant="info">New Lead</Badge>;
    case "CONTACTED":
      return <Badge variant="secondary">Contacted</Badge>;
    case "FOLLOW_UP":
      return <Badge variant="warning">Follow-up</Badge>;
    case "REPLIED":
      return <Badge variant="default" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20">Replied</Badge>;
    case "POSITIVE_REPLY":
      return <Badge variant="success">Positive Reply</Badge>;
    case "MEETING_SCHEDULED":
      return <Badge variant="success" className="font-semibold">Meeting Booked</Badge>;
    case "CLIENT":
      return <Badge variant="success" className="bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950 font-semibold">Client</Badge>;
    case "CLOSED_LOST":
      return <Badge variant="destructive">Closed Lost</Badge>;
    default:
      return <Badge variant="outline">{stage}</Badge>;
  }
}

export function TemperatureBadge({ temperature }: { temperature: TagType | string }) {
  switch (temperature) {
    case "HOT":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
          Hot
        </span>
      );
    case "WARM":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Warm
        </span>
      );
    case "COLD":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-500/10 px-2 py-0.5 rounded-full border border-zinc-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          Cold
        </span>
      );
    case "FOLLOW_UP_NEEDED":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
          Follow-up Needed
        </span>
      );
    case "CLIENT":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          Client
        </span>
      );
    default:
      return <Badge variant="outline">{temperature}</Badge>;
  }
}
