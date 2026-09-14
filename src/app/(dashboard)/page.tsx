import * as React from "react";
import { getAuthSession } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/lib/services/analytics-service";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { RecentLeadsCard } from "@/components/dashboard/recent-leads-card";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
import { UpcomingMeetingsCard } from "@/components/dashboard/upcoming-meetings-card";
import { SystemStatusBanner } from "@/components/common/system-status-banner";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { UserPlus, Sparkles } from "lucide-react";
import { checkDatabaseConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getAuthSession();
  const dbStatus = await checkDatabaseConnection();
  const metrics = user ? await getDashboardMetrics(user.id) : null;

  return (
    <div className="space-y-5 pb-12">
      {/* Contextual System Status Banner (Non-overwhelming, clear remediation) */}
      {!dbStatus.connected && (
        <SystemStatusBanner error={dbStatus.error} />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Pipeline Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time outreach velocity, lead conversions, and sales metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/finder">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
              Find Prospects
            </Button>
          </Link>
          <Link href="/leads">
            <Button size="sm" className="gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Manage Leads
            </Button>
          </Link>
        </div>
      </div>

      {/* 7 KPI Cards with tabular-nums and responsive grid */}
      <KpiCards
        totalLeads={metrics?.totalLeads ?? 0}
        emailsSent={metrics?.emailsSent ?? 0}
        replyRate={metrics?.replyRate ?? 0}
        positiveReplies={metrics?.positiveReplies ?? 0}
        meetingsBooked={metrics?.meetingsBooked ?? 0}
        clientsClosed={metrics?.clientsClosed ?? 0}
        monthlyConversionRate={metrics?.monthlyConversionRate ?? 0}
      />

      {/* Charts Row: Funnel & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelChart funnel={metrics?.funnel ?? []} />
        <ActivityChart data={metrics?.outreachActivity ?? []} />
      </div>

      {/* Feeds Row: Recent Leads, Recent Activity, Upcoming Meetings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RecentLeadsCard leads={metrics?.recentLeads ?? []} />
        <RecentActivityCard activities={metrics?.recentInteractions ?? []} />
        <UpcomingMeetingsCard meetings={metrics?.upcomingMeetings ?? []} />
      </div>
    </div>
  );
}
