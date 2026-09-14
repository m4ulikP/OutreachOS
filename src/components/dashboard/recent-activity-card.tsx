import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeTime } from "@/lib/utils";
import { Activity, Clock } from "lucide-react";

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
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Timeline of interactions and stage changes</CardDescription>
        </div>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {activities.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-5 w-5" />}
            title="No activity recorded"
            description="Interaction notes, email sends, and stage updates will create a live audit log here."
            className="py-8 border-0 bg-transparent"
          />
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
                    <span className="text-[11px] text-muted-foreground truncate">
                      {act.description}
                    </span>
                  )}
                  {act.leadName && (
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Lead: {act.leadName}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatRelativeTime(act.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
