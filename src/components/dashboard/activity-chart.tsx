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
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Outreach Activity
            </CardTitle>
            <CardDescription className="text-xs">
              Daily email dispatches, replies received, and meetings held
            </CardDescription>
          </div>
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex-1 flex flex-col justify-center">
        {!hasData ? (
          <EmptyState
            title="No outreach activity recorded"
            description="When email campaigns run or prospect meetings are scheduled, your daily volume trends will appear here."
            className="py-10 border-0 bg-transparent"
          />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  className="tabular-nums"
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
                <Bar dataKey="emails" name="Emails Sent" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="replies" name="Replies" fill="#a855f7" radius={[3, 3, 0, 0]} />
                <Bar dataKey="meetings" name="Meetings" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
