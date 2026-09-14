"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Filter } from "lucide-react";

export default function AnalyticsPage() {
  const [metrics, setMetrics] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Sales & Outreach Analytics
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time metrics derived directly from verified database events
        </p>
      </div>

      <KpiCards
        totalLeads={metrics?.totalLeads ?? 0}
        emailsSent={metrics?.emailsSent ?? 0}
        replyRate={metrics?.replyRate ?? 0}
        positiveReplies={metrics?.positiveReplies ?? 0}
        meetingsBooked={metrics?.meetingsBooked ?? 0}
        clientsClosed={metrics?.clientsClosed ?? 0}
        monthlyConversionRate={metrics?.monthlyConversionRate ?? 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelChart funnel={metrics?.funnel ?? []} />
        <ActivityChart data={metrics?.outreachActivity ?? []} />
      </div>
    </div>
  );
}
