import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { Calendar, Video } from "lucide-react";

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
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle>Upcoming Meetings</CardTitle>
          <CardDescription>Scheduled prospect calls</CardDescription>
        </div>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {meetings.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-5 w-5" />}
            title="No upcoming meetings"
            description="When prospects schedule meetings via booking links, details appear here."
            className="py-8 border-0 bg-transparent"
          />
        ) : (
          <div className="space-y-2.5">
            {meetings.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {m.title}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {formatDate(m.startTime)} • {m.leadName || "Attendee"}
                  </span>
                </div>
                {m.meetUrl && (
                  <a
                    href={m.meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 shrink-0"
                    title="Join Meeting"
                  >
                    <Video className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
