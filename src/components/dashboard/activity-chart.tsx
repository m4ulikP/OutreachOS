"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";

export interface ActivityDataPoint {
  date: string;
  emails: number;
  replies: number;
  meetings: number;
}

export function ActivityChart({ data }: { data: ActivityDataPoint[] }) {
  const hasData = data && data.length > 0 && data.some((d) => d.emails > 0 || d.replies > 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Outreach Activity</CardTitle>
            <CardDescription>
              Emails dispatched, replies received, and meetings held
            </CardDescription>
          </div>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {!hasData ? (
          <EmptyState
            title="No outreach activity recorded"
            description="When email campaigns run or prospect meetings are scheduled, your daily volume trends will appear here."
            className="py-12 border-0 bg-transparent"
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="emails" name="Emails" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="replies" name="Replies" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="meetings" name="Meetings" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
