"use client";

import * as React from "react";
import { formatRelativeTime } from "@/lib/utils";
import { Activity } from "lucide-react";

export interface RecentInteractionItem {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  leadName?: string;
  createdAt: Date | string;
}

export function RecentActivityCard({
  activities,
}: {
  activities: RecentInteractionItem[];
}) {
  return (
    <section aria-label="Recent activity" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Recent activity
        </h2>
        <span className="text-[11px] text-foreground-subtle">
          Interaction log
        </span>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        {activities.length === 0 ? (
          <div className="py-6 text-center">
            <Activity className="h-5 w-5 mx-auto text-foreground-subtle mb-1.5" />
            <p className="text-xs font-medium text-foreground">No recent activity</p>
            <p className="text-[11px] text-foreground-muted mt-0.5">
              Dispatched emails, replies, and stage updates will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((act) => (
              <div key={act.id} className="flex items-start gap-2.5 text-xs">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-semibold text-foreground truncate">
                    {act.title}
                  </span>
                  {act.description && (
                    <span className="text-[11px] text-foreground-muted truncate">
                      {act.description}
                    </span>
                  )}
                  {act.leadName && (
                    <span className="text-[10px] text-foreground-subtle font-medium mt-0.5">
                      Lead: {act.leadName}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-foreground-subtle shrink-0 font-mono tabular-nums">
                  {formatRelativeTime(act.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
