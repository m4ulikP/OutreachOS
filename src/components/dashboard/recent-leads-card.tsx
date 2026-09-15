"use client";

import * as React from "react";
import Link from "next/link";
import { LeadStageBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { ArrowRight, UserPlus, Users } from "lucide-react";

export interface RecentLeadItem {
  id: string;
  fullName: string;
  jobTitle?: string | null;
  companyName?: string | null;
  stage: string;
  createdAt: Date | string;
}

export function RecentLeadsCard({
  leads,
  onAddLead,
}: {
  leads: RecentLeadItem[];
  onAddLead?: () => void;
}) {
  return (
    <section aria-label="Recent leads" className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Recent leads
          </h2>
        </div>
        <Link
          href="/leads"
          className="text-xs font-medium text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
        >
          <span>View all</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        {leads.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="h-5 w-5 mx-auto text-foreground-subtle mb-2" />
            <p className="text-xs font-medium text-foreground">No leads recorded yet</p>
            <p className="text-[11px] text-foreground-muted mt-0.5 max-w-sm mx-auto">
              Add your first prospect manually or discover decision-makers in Client Finder.
            </p>
            <div className="mt-3">
              {onAddLead ? (
                <Button size="sm" onClick={onAddLead} className="gap-1.5 text-xs">
                  <UserPlus className="h-3.5 w-3.5" />
                  Add lead
                </Button>
              ) : (
                <Link href="/leads">
                  <Button size="sm" className="gap-1.5 text-xs">
                    <UserPlus className="h-3.5 w-3.5" />
                    Add lead
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border -my-1">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between py-2.5 transition-colors hover:bg-surface-elevated -mx-2 px-2 rounded"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="text-xs font-semibold text-foreground hover:text-primary transition-colors truncate"
                  >
                    {lead.fullName}
                  </Link>
                  <span className="text-[11px] text-foreground-muted truncate">
                    {lead.jobTitle
                      ? `${lead.jobTitle}${lead.companyName ? ` • ${lead.companyName}` : ""}`
                      : lead.companyName || "No title specified"}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <LeadStageBadge stage={lead.stage} />
                  <span className="text-[10px] text-foreground-subtle font-mono tabular-nums">
                    {formatRelativeTime(lead.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
