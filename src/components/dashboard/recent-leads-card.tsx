import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LeadStageBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
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
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle>Recent Leads</CardTitle>
          <CardDescription>Latest additions to your pipeline</CardDescription>
        </div>
        <Link href="/leads">
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            View all
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {leads.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No leads added yet"
            description="Add your first freelance prospect to track communication and automate outreach."
            action={
              onAddLead ? (
                <Button size="sm" onClick={onAddLead} className="gap-1.5 text-xs">
                  <UserPlus className="h-3.5 w-3.5" />
                  Add First Lead
                </Button>
              ) : (
                <Link href="/leads">
                  <Button size="sm" className="gap-1.5 text-xs">
                    <UserPlus className="h-3.5 w-3.5" />
                    Go to Leads
                  </Button>
                </Link>
              )
            }
            className="py-8 border-0 bg-transparent"
          />
        ) : (
          <div className="divide-y divide-border">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between py-2.5 transition-colors hover:bg-muted/30 -mx-2 px-2 rounded-md"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="text-xs font-semibold text-foreground hover:underline truncate"
                  >
                    {lead.fullName}
                  </Link>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {lead.jobTitle
                      ? `${lead.jobTitle}${lead.companyName ? ` at ${lead.companyName}` : ""}`
                      : lead.companyName || "No title specified"}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <LeadStageBadge stage={lead.stage} />
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(lead.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
