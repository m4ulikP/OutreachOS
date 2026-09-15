"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search,
  UserPlus,
  Send,
  UploadCloud,
  CheckCircle2,
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

  // If there are zero leads, render the practical Next Steps checklist
  if (totalLeads === 0) {
    return (
      <section aria-label="Next steps" className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Next steps
          </h2>
          <span className="text-[11px] text-foreground-subtle">
            Setup checklist
          </span>
        </div>

        <div className="rounded-md border border-border bg-surface p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Step 1: Database */}
            <div className="flex flex-col justify-between p-3 rounded border border-border bg-surface-elevated">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                  <span>1. Database</span>
                  {dbConnected ? (
                    <span className="flex items-center gap-1 text-[11px] text-success font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Connected
                    </span>
                  ) : (
                    <span className="text-[10px] text-warning font-mono">Offline</span>
                  )}
                </div>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  {dbConnected
                    ? "PostgreSQL database is running and ready for leads."
                    : "Start your local database to store and track outreach."}
                </p>
              </div>
              {!dbConnected && (
                <div className="mt-2.5 pt-2 border-t border-border">
                  <button
                    onClick={copyCommand}
                    className="flex items-center justify-between w-full px-2 py-1 rounded bg-surface text-[11px] font-mono text-foreground hover:bg-surface-elevated border border-border transition-colors"
                  >
                    <span className="truncate">docker compose up -d</span>
                    {copied ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3 text-foreground-muted" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Discover Targets */}
            <div className="flex flex-col justify-between p-3 rounded border border-border bg-surface-elevated">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                  <span>2. Find targets</span>
                  <Search className="h-3.5 w-3.5 text-foreground-muted" />
                </div>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  Define your target criteria or use a preset in Client Finder.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-border">
                <Link href="/finder">
                  <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1">
                    Open Finder
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Step 3: Add First Prospect */}
            <div className="flex flex-col justify-between p-3 rounded border border-border bg-surface-elevated">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                  <span>3. Add first lead</span>
                  <UserPlus className="h-3.5 w-3.5 text-foreground-muted" />
                </div>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  Add a prospect manually or import an existing contact CSV list.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-border">
                <Link href="/leads">
                  <Button size="sm" className="w-full text-xs h-7 gap-1">
                    Add Lead
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Step 4: Launch Campaign */}
            <div className="flex flex-col justify-between p-3 rounded border border-border bg-surface-elevated">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                  <span>4. Campaigns</span>
                  <Send className="h-3.5 w-3.5 text-foreground-muted" />
                </div>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  Set up automated outreach cadences with follow-up timing.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-border">
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
      </section>
    );
  }

  // If leads already exist, render the simple inline actions strip
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 p-3 rounded-md border border-border bg-surface",
        className
      )}
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-foreground tracking-tight">
          Quick actions
        </span>
        <span className="text-[11px] text-foreground-subtle">
          • Pipeline shortcuts
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/finder">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Search className="h-3.5 w-3.5 text-foreground-muted" aria-hidden="true" />
            Find clients
          </Button>
        </Link>
        <Link href="/leads">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <UploadCloud className="h-3.5 w-3.5 text-foreground-muted" aria-hidden="true" />
            Import CSV
          </Button>
        </Link>
        <Link href="/leads">
          <Button size="sm" className="h-8 text-xs gap-1.5">
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Add lead
          </Button>
        </Link>
      </div>
    </div>
  );
}
