"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar, Plus, Link as LinkIcon } from "lucide-react";
import Link from "next/link";

export default function MeetingsPage() {
  return (
    <div className="space-y-6 pb-12 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Meeting Scheduler
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Booking links, Google Calendar synchronization, and automatic stage updates
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <LinkIcon className="h-3.5 w-3.5" />
            Calendar Settings
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Automated Meeting Workflow</CardTitle>
          <CardDescription>
            When a prospect books through your link, their stage automatically transitions to MEETING_SCHEDULED
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Eliminate scheduling ping-pong. Connect your Google Calendar to generate personalized 15-minute and 30-minute discovery booking links that embed directly into your automated emails.
          </p>
        </CardContent>
      </Card>

      <EmptyState
        icon={<Calendar className="h-6 w-6" />}
        title="No meetings currently scheduled"
        description="Connect Google Calendar in Settings to enable real-time calendar synchronization and generate booking links."
        action={
          <Link href="/settings">
            <Button size="sm">Connect Google Calendar</Button>
          </Link>
        }
        className="py-16"
      />
    </div>
  );
}
