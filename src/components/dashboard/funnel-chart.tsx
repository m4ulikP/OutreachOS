"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Filter } from "lucide-react";

export interface FunnelItem {
  stage: string;
  label: string;
  count: number;
}

const STAGE_BAR_COLORS: Record<string, string> = {
  NEW: "bg-sky-500",
  CONTACTED: "bg-indigo-500",
  REPLIED: "bg-violet-500",
  POSITIVE_REPLY: "bg-amber-500",
  MEETING_SCHEDULED: "bg-emerald-500",
  CLIENT: "bg-emerald-600",
};

export function FunnelChart({ funnel }: { funnel: FunnelItem[] }) {
  const total = funnel.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Lead Conversion Funnel
            </CardTitle>
            <CardDescription className="text-xs">
              Prospect progression from discovery to closed client
            </CardDescription>
          </div>
          <Filter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex-1 flex flex-col justify-center">
        {total === 0 ? (
          <EmptyState
            title="Funnel is waiting for data"
            description="As leads are added and advance through outreach stages, your conversion velocity will populate here."
            className="py-10 border-0 bg-transparent"
          />
        ) : (
          <div className="space-y-3">
            {funnel.map((step) => {
              const maxCount = Math.max(...funnel.map((f) => f.count), 1);
              const percentage = total > 0 ? (step.count / maxCount) * 100 : 0;
              const barColor = STAGE_BAR_COLORS[step.stage] || "bg-primary";

              return (
                <div key={step.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground tracking-tight">
                      {step.label}
                    </span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {step.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${Math.max(percentage, step.count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
