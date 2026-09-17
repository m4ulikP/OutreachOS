import * as React from "react";
import { cn } from "@/lib/utils";
import { LeadStage, TagType } from "@prisma/client";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "info" | "primary";
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
        "inline-flex items-center font-medium rounded-full transition-colors border select-none",
        size === "sm" ? "px-2 py-0.5 text-[11px] leading-none" : "px-2.5 py-0.5 text-xs",
        variant === "default" && "bg-secondary text-foreground border-border",
        variant === "secondary" && "bg-muted text-foreground-muted border-transparent",
        variant === "outline" && "border-border text-foreground",
        variant === "primary" && "bg-primary/10 text-primary border-primary/25",
        variant === "success" && "bg-success-tint text-success border-success/25",
        variant === "warning" && "bg-warning-tint text-warning border-warning/25",
        variant === "destructive" && "bg-danger-tint text-danger border-danger/25",
        variant === "info" && "bg-info-tint text-info border-info/25",
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
      return <Badge variant="primary">Replied</Badge>;
    case "POSITIVE_REPLY":
      return <Badge variant="success">Positive Reply</Badge>;
    case "MEETING_SCHEDULED":
      return <Badge variant="primary" className="font-semibold bg-primary/15 border-primary/30">Meeting Booked</Badge>;
    case "CLIENT":
      return <Badge variant="success" className="bg-success text-success-foreground font-semibold border-success">Client Won</Badge>;
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
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger bg-danger-tint px-2 py-0.5 rounded-full border border-danger/25">
          <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
          Hot
        </span>
      );
    case "WARM":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning bg-warning-tint px-2 py-0.5 rounded-full border border-warning/25">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          Warm
        </span>
      );
    case "COLD":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground-muted bg-muted px-2 py-0.5 rounded-full border border-border">
          <span className="h-1.5 w-1.5 rounded-full bg-foreground-muted" />
          Cold
        </span>
      );
    case "FOLLOW_UP_NEEDED":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning bg-warning-tint px-2 py-0.5 rounded-full border border-warning/25">
          Follow-up Needed
        </span>
      );
    case "CLIENT":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success-tint px-2 py-0.5 rounded-full border border-success/25">
          Client
        </span>
      );
    default:
      return <Badge variant="outline">{temperature}</Badge>;
  }
}
