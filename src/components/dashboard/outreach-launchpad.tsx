"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Search,
  UserPlus,
  Send,
  UploadCloud,
  CheckCircle2,
  Terminal,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";

export interface OutreachLaunchpadProps {
  totalLeads: number;
  dbConnected: boolean;
  className?: string;
}

export function OutreachLaunchpad({
  totalLeads,
  dbConnected,
  className,
}: OutreachLaunchpadProps) {
  const [copied, setCopied] = React.useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText("docker compose up -d");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If there are zero leads, render the 4-step Action Playbook
  if (totalLeads === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/[0.03] p-5 shadow-xs",
          className
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                Outreach Engine Accelerator
              </h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Quick Start
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Complete these steps to activate your autonomous freelancer sales pipeline
            </p>
          </div>
        </div>

        {/* 4 Interactive Playbook Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {/* Step 1: Database */}
          <div className="flex flex-col justify-between p-3.5 rounded-lg border border-border/70 bg-card/60">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                <span>1. Connect Database</span>
                {dbConnected ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <span className="text-[10px] text-amber-500 font-mono">Needed</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {dbConnected
                  ? "PostgreSQL is online and ready for persistence."
                  : "Launch your local PostgreSQL instance for persistent storage."}
              </p>
            </div>
            {!dbConnected && (
              <div className="mt-3 pt-2 border-t border-border/40">
                <button
                  onClick={copyCommand}
                  className="flex items-center justify-between w-full px-2 py-1 rounded bg-muted/60 text-[11px] font-mono text-foreground hover:bg-muted transition-colors"
                >
                  <span className="truncate">docker compose up -d</span>
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Discover Clients */}
          <div className="flex flex-col justify-between p-3.5 rounded-lg border border-border/70 bg-card/60">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                <span>2. Discover Targets</span>
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Query decision-makers by seniority, industry, and tech stack in Client Finder.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-border/40">
              <Link href="/finder">
                <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1">
                  Open Finder
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Step 3: Add First Prospect */}
          <div className="flex flex-col justify-between p-3.5 rounded-lg border border-border/70 bg-card/60">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                <span>3. Add First Lead</span>
                <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Manually record a prospect or import an existing CSV contact list.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-border/40">
              <Link href="/leads">
                <Button size="sm" className="w-full text-xs h-7 gap-1">
                  Add Lead
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Step 4: Launch Campaign */}
          <div className="flex flex-col justify-between p-3.5 rounded-lg border border-border/70 bg-card/60">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                <span>4. Craft Sequences</span>
                <Send className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Set up automated multi-touch email cadences with smart follow-up intervals.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-border/40">
              <Link href="/campaigns">
                <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1">
                  Campaigns
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If leads already exist, render the fast action command strip
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-card shadow-xs",
        className
      )}
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-foreground tracking-tight">
          Quick Actions
        </span>
        <span className="text-[10px] text-muted-foreground">
          • Rapid pipeline execution
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/finder">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Find Clients
          </Button>
        </Link>
        <Link href="/leads">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <UploadCloud className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Import CSV
          </Button>
        </Link>
        <Link href="/leads">
          <Button size="sm" className="h-8 text-xs gap-1.5">
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Add Lead
          </Button>
        </Link>
      </div>
    </div>
  );
}
