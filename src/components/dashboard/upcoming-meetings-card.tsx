"use client";

import * as React from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Calendar, Video, ArrowRight } from "lucide-react";

export interface UpcomingMeetingItem {
  id: string;
  title: string;
  startTime: Date | string;
  endTime: Date | string;
  leadName?: string;
  meetUrl?: string | null;
}

export function UpcomingMeetingsCard({
  meetings,
}: {
  meetings: UpcomingMeetingItem[];
}) {
  return (
    <section aria-label="Upcoming calls" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Upcoming calls
        </h2>
        <Link
          href="/meetings"
          className="text-xs font-medium text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
        >
          <span>All meetings</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        {meetings.length === 0 ? (
          <div className="py-6 text-center">
            <Calendar className="h-5 w-5 mx-auto text-foreground-subtle mb-1.5" />
            <p className="text-xs font-medium text-foreground">No calls scheduled</p>
            <p className="text-[11px] text-foreground-muted mt-0.5">
              Prospect calls booked via scheduling links will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {meetings.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2.5 rounded border border-border bg-surface-elevated"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {m.title}
                  </span>
                  <span className="text-[11px] text-foreground-muted truncate">
                    {formatDate(m.startTime)} • {m.leadName || "Prospect"}
                  </span>
                </div>
                {m.meetUrl && (
                  <a
                    href={m.meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-primary hover:bg-primary/20 shrink-0"
                    title="Join Meeting"
                  >
                    <Video className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
