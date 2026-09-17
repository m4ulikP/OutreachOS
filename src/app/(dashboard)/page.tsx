import * as React from "react";
import { getAuthSession } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/lib/services/analytics-service";
import { AttentionDeck } from "@/components/dashboard/attention-deck";
import { PipelineRibbon } from "@/components/dashboard/pipeline-ribbon";
import { OutreachLaunchpad } from "@/components/dashboard/outreach-launchpad";
import { RecentLeadsCard } from "@/components/dashboard/recent-leads-card";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
import { UpcomingMeetingsCard } from "@/components/dashboard/upcoming-meetings-card";
import { SystemStatusBanner } from "@/components/common/system-status-banner";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { UserPlus, Search, Calendar } from "lucide-react";
import { checkDatabaseConnection } from "@/lib/db";

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getAuthSession();
  if (!user) {
    redirect("/login");
  }

  const dbStatus = await checkDatabaseConnection();
  const metrics = await getDashboardMetrics(user.id);

  const totalLeads = metrics?.totalLeads ?? 0;
  const emailsSent = metrics?.emailsSent ?? 0;
  const positiveReplies = metrics?.positiveReplies ?? 0;
  const meetingsBooked = metrics?.meetingsBooked ?? 0;
  const replyRate = metrics?.replyRate ?? 0;

  // Today's date for editorial header
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Contextual System Status Banner (if PostgreSQL offline) */}
      {!dbStatus.connected && (
        <SystemStatusBanner error={dbStatus.error} />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted mb-0.5">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-foreground-subtle" aria-hidden="true" />
              {today}
            </span>
            <span>•</span>
            <span className="text-foreground font-semibold">Freelancer Sales Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Good morning, {user.name ? user.name.split(" ")[0] : "Alex"}.
          </h1>
          <p className="text-xs text-foreground-muted mt-1">
            {positiveReplies > 0
              ? `You have ${positiveReplies} qualified reply awaiting response.`
              : totalLeads > 0
              ? `${totalLeads} prospects currently moving through your pipeline.`
              : "Welcome to your outreach studio. Follow the steps below to begin."}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <Link href="/finder">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Search className="h-3.5 w-3.5 text-foreground-muted" aria-hidden="true" />
              Find prospects
            </Button>
          </Link>
          <Link href="/leads">
            <Button size="sm" className="h-8 gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Add lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Section 1: Today */}
      <AttentionDeck
        positiveReplies={positiveReplies}
        totalLeads={totalLeads}
        meetingsBooked={meetingsBooked}
        emailsSent={emailsSent}
        replyRate={replyRate}
      />

      {/* Section 2: Pipeline */}
      <PipelineRibbon funnel={metrics?.funnel ?? []} />

      {/* Section 3: Next steps / Quick actions */}
      <OutreachLaunchpad
        totalLeads={totalLeads}
        dbConnected={dbStatus.connected}
      />

      {/* Section 4: Workspace Feeds (Recent leads + Upcoming & Activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Recent leads (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <RecentLeadsCard leads={metrics?.recentLeads ?? []} />
        </div>

        {/* Right Column: Upcoming calls & Activity (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <UpcomingMeetingsCard meetings={metrics?.upcomingMeetings ?? []} />
          <RecentActivityCard activities={metrics?.recentInteractions ?? []} />
        </div>
      </div>
    </div>
  );
}
