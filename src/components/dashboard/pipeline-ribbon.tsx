"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight } from "lucide-react";

export interface PipelineStageData {
  stage: string;
  label: string;
  count: number;
}

export interface PipelineRibbonProps {
  funnel: PipelineStageData[];
  className?: string;
}

// Connected visual progression stages: New → Contacted → Replied → Positive → Discovery Call → Client
const STAGE_ORDER: {
  key: string;
  label: string;
  shortDesc: string;
  indicatorColor: string;
  progressColor: string;
}[] = [
  {
    key: "NEW",
    label: "New",
    shortDesc: "Identified targets",
    indicatorColor: "bg-foreground-muted",
    progressColor: "bg-foreground-muted",
  },
  {
    key: "CONTACTED",
    label: "Contacted",
    shortDesc: "First touch sent",
    indicatorColor: "bg-primary",
    progressColor: "bg-primary",
  },
  {
    key: "REPLIED",
    label: "Replied",
    shortDesc: "Active threads",
    indicatorColor: "bg-warning",
    progressColor: "bg-warning",
  },
  {
    key: "POSITIVE_REPLY",
    label: "Positive",
    shortDesc: "Warm interest",
    indicatorColor: "bg-success",
    progressColor: "bg-success",
  },
  {
    key: "MEETING_SCHEDULED",
    label: "Discovery Call",
    shortDesc: "Booked sessions",
    indicatorColor: "bg-info",
    progressColor: "bg-info",
  },
  {
    key: "CLIENT",
    label: "Client",
    shortDesc: "Won contracts",
    indicatorColor: "bg-success",
    progressColor: "bg-success",
  },
];

export function PipelineRibbon({ funnel, className }: PipelineRibbonProps) {
  // Map funnel counts by stage key
  const countMap = React.useMemo(() => {
    const map = new Map<string, number>();
    funnel.forEach((f) => {
      // Map analytics funnel stage names if they differ
      const key =
        f.stage === "PROSPECT"
          ? "NEW"
          : f.stage === "ENGAGED"
          ? "REPLIED"
          : f.stage;
      map.set(key, f.count);
    });
    return map;
  }, [funnel]);

  const totalInPipeline = Array.from(countMap.values()).reduce((a, b) => a + b, 0);

  return (
    <section aria-label="Pipeline" className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Pipeline
        </h2>
        <Link
          href="/leads"
          className="text-xs font-medium text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
        >
          <span>All leads</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Connected Progression Strip */}
      <div className="rounded-md border border-border bg-surface overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {STAGE_ORDER.map((stage, idx) => {
            const count = countMap.get(stage.key) ?? 0;
            const percentage = totalInPipeline > 0 ? (count / totalInPipeline) * 100 : 0;
            const isLast = idx === STAGE_ORDER.length - 1;

            return (
              <Link
                key={stage.key}
                href={`/leads?stage=${stage.key}`}
                className="group relative flex flex-col justify-between p-3.5 transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                {/* Stage Header */}
                <div>
                  <div className="flex items-center justify-between text-xs text-foreground-muted mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", stage.indicatorColor)} />
                      <span className="font-semibold text-foreground truncate text-xs">
                        {stage.label}
                      </span>
                    </div>
                    {!isLast && (
                      <ChevronRight className="h-3 w-3 text-border-subtle group-hover:text-primary transition-colors shrink-0 hidden lg:block" />
                    )}
                  </div>
                  <p className="text-[10px] text-foreground-subtle truncate">
                    {stage.shortDesc}
                  </p>
                </div>

                {/* Numbers and Connected Flow Bar */}
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-xs mb-1.5">
                    <span className="text-xl font-bold font-mono tracking-tight text-foreground tabular-nums">
                      {count}
                    </span>
                    <span className="text-[10px] font-mono text-foreground-subtle tabular-nums">
                      {totalInPipeline > 0 ? `${percentage.toFixed(0)}%` : "0%"}
                    </span>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-300", stage.progressColor)}
                      style={{
                        width: `${Math.max(percentage, 5)}%`,
                      }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
