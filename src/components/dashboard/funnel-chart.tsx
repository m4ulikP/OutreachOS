"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRight, Filter } from "lucide-react";

export interface FunnelItem {
  stage: string;
  label: string;
  count: number;
}

export function FunnelChart({ funnel }: { funnel: FunnelItem[] }) {
  const total = funnel.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Lead Conversion Funnel</CardTitle>
            <CardDescription>
              Prospect progression from discovery to closed contract
            </CardDescription>
          </div>
          <Filter className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {total === 0 ? (
          <EmptyState
            title="Funnel is waiting for data"
            description="As leads are added and advance through outreach stages, your conversion velocity will populate here."
            className="py-10 border-0 bg-transparent"
          />
        ) : (
          <div className="space-y-2.5">
            {funnel.map((step, idx) => {
              const maxCount = Math.max(...funnel.map((f) => f.count), 1);
              const percentage = total > 0 ? (step.count / maxCount) * 100 : 0;

              return (
                <div key={step.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <span className="text-muted-foreground text-[10px]">0{idx + 1}.</span>
                      {step.label}
                    </span>
                    <span className="font-semibold text-foreground">
                      {step.count}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
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
