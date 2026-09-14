"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight, Layers, Users } from "lucide-react";

export interface PipelineStageData {
  stage: string;
  label: string;
  count: number;
}

export interface PipelineRibbonProps {
  funnel: PipelineStageData[];
  className?: string;
}

const STAGE_META: Record<
  string,
  { label: string; desc: string; color: string; tint: string; stageKey: string }
> = {
  PROSPECT: {
    label: "Prospects",
    desc: "Identified targets",
    color: "bg-sky-500",
    tint: "hover:border-sky-500/50 hover:bg-sky-500/[0.04]",
    stageKey: "NEW",
  },
  CONTACTED: {
    label: "Contacted",
    desc: "Dispatched initial pitch",
    color: "bg-indigo-500",
    tint: "hover:border-indigo-500/50 hover:bg-indigo-500/[0.04]",
    stageKey: "CONTACTED",
  },
  ENGAGED: {
    label: "In Conversation",
    desc: "Replied & interested",
    color: "bg-violet-500",
    tint: "hover:border-violet-500/50 hover:bg-violet-500/[0.04]",
    stageKey: "REPLIED",
  },
  MEETING_SCHEDULED: {
    label: "Discovery Calls",
    desc: "Booked sales calls",
    color: "bg-amber-500",
    tint: "hover:border-amber-500/50 hover:bg-amber-500/[0.04]",
    stageKey: "MEETING_SCHEDULED",
  },
  CLIENT: {
    label: "Clients Won",
    desc: "Retained contracts",
    color: "bg-emerald-500",
    tint: "hover:border-emerald-500/50 hover:bg-emerald-500/[0.04]",
    stageKey: "CLIENT",
  },
};

export function PipelineRibbon({ funnel, className }: PipelineRibbonProps) {
  // If funnel is empty or all counts are 0, prepare default stage structure
  const stages =
    funnel.length > 0
      ? funnel
      : [
          { stage: "PROSPECT", label: "Prospects", count: 0 },
          { stage: "CONTACTED", label: "Contacted", count: 0 },
          { stage: "ENGAGED", label: "In Conversation", count: 0 },
          { stage: "MEETING_SCHEDULED", label: "Discovery Calls", count: 0 },
          { stage: "CLIENT", label: "Clients Won", count: 0 },
        ];

  const totalInPipeline = stages.reduce((acc, s) => acc + s.count, 0);

  return (
    <section
      aria-label="Interactive Pipeline Ribbon"
      className={cn(
        "rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-xs font-semibold text-foreground tracking-tight">
            Pipeline Flow & Conversion Velocity
          </h2>
          <span className="text-[10px] text-muted-foreground">
            • Click any stage to filter leads
          </span>
        </div>
        <Link
          href="/leads"
          className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <span>View all leads</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Horizontal Flow Strip */}
      <div className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {stages.map((stage) => {
            const meta = STAGE_META[stage.stage] || {
              label: stage.label,
              desc: "Pipeline stage",
              color: "bg-primary",
              tint: "hover:bg-muted/40",
              stageKey: stage.stage,
            };

            return (
              <Link
                key={stage.stage}
                href={`/leads?stage=${meta.stageKey}`}
                className={cn(
                  "group relative flex flex-col justify-between p-3 rounded-lg border border-border/70 bg-card/60 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  meta.tint
                )}
              >
                {/* Stage Header */}
                <div>
                  <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", meta.color)} />
                      <span className="font-semibold text-foreground truncate">
                        {meta.label}
                      </span>
                    </div>
                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground shrink-0" />
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    {meta.desc}
                  </p>
                </div>

                {/* Metrics */}
                <div className="mt-3 pt-2 border-t border-border/40 flex items-baseline justify-between">
                  <span className="text-xl font-bold font-mono tracking-tight text-foreground tabular-nums">
                    {stage.count}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                    {totalInPipeline > 0
                      ? `${((stage.count / totalInPipeline) * 100).toFixed(0)}%`
                      : "0%"}
                  </span>
                </div>

                {/* Visual Progress Tint Bar */}
                <div className="w-full bg-muted/60 h-1 rounded-full mt-2 overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-300", meta.color)}
                    style={{
                      width: `${Math.max(totalInPipeline > 0 ? (stage.count / totalInPipeline) * 100 : 0, 4)}%`,
                    }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
