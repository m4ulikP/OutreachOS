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
import { UserPlus, Sparkles, Calendar, ArrowRight } from "lucide-react";
import { checkDatabaseConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getAuthSession();
  const dbStatus = await checkDatabaseConnection();
  const metrics = user ? await getDashboardMetrics(user.id) : null;

  const totalLeads = metrics?.totalLeads ?? 0;
  const emailsSent = metrics?.emailsSent ?? 0;
  const positiveReplies = metrics?.positiveReplies ?? 0;
  const meetingsBooked = metrics?.meetingsBooked ?? 0;
  const replyRate = metrics?.replyRate ?? 0;

  // Format today's date nicely for the freelancer greeting
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

      {/* Daily Workspace Header & Briefing */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-0.5">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {today}
            </span>
            <span>•</span>
            <span className="text-foreground font-semibold">Freelancer Sales Cockpit</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Good morning, Alex.
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {positiveReplies > 0
              ? `You have ${positiveReplies} qualified reply awaiting response. Keep your deal momentum high.`
              : totalLeads > 0
              ? `${totalLeads} prospects currently in motion across your sales pipeline.`
              : "Welcome to OutreachOS. Activate your outreach engine below."}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <Link href="/finder">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
              Find Prospects
            </Button>
          </Link>
          <Link href="/leads">
            <Button size="sm" className="h-9 gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Capture Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* 1. Daily Attention Deck: Priorities at a Glance */}
      <AttentionDeck
        positiveReplies={positiveReplies}
        totalLeads={totalLeads}
        meetingsBooked={meetingsBooked}
        emailsSent={emailsSent}
        replyRate={replyRate}
      />

      {/* 2. Interactive Pipeline Ribbon: Connected Stage Highway */}
      <PipelineRibbon funnel={metrics?.funnel ?? []} />

      {/* 3. Outreach Launchpad / Action Accelerator */}
      <OutreachLaunchpad
        totalLeads={totalLeads}
        dbConnected={dbStatus.connected}
      />

      {/* 4. Two-Column Work Center: Recent Prospects + Outreach Radar Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Priority Prospects (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <RecentLeadsCard leads={metrics?.recentLeads ?? []} />
        </div>

        {/* Right Column: Live Outreach Radar & Meetings Stream (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <UpcomingMeetingsCard meetings={metrics?.upcomingMeetings ?? []} />
          <RecentActivityCard activities={metrics?.recentInteractions ?? []} />
        </div>
      </div>
    </div>
  );
}
