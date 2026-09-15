import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  Mail,
  MessageSquareReply,
  CheckCircle2,
  Calendar,
  Briefcase,
  TrendingUp,
} from "lucide-react";

export interface KpiCardsProps {
  totalLeads: number;
  emailsSent: number;
  replyRate: number;
  positiveReplies: number;
  meetingsBooked: number;
  clientsClosed: number;
  monthlyConversionRate: number;
}

export function KpiCards({
  totalLeads,
  emailsSent,
  replyRate,
  positiveReplies,
  meetingsBooked,
  clientsClosed,
  monthlyConversionRate,
}: KpiCardsProps) {
  const cards = [
    {
      title: "Total Leads",
      value: totalLeads.toLocaleString(),
      subtext: totalLeads === 0 ? "No leads in pipeline" : "Active in database",
      icon: Users,
      trend: totalLeads > 0 ? "Active" : undefined,
    },
    {
      title: "Emails Sent",
      value: emailsSent.toLocaleString(),
      subtext: emailsSent === 0 ? "Awaiting first dispatch" : "Outreach volume",
      icon: Mail,
      trend: undefined,
    },
    {
      title: "Reply Rate",
      value: `${replyRate.toFixed(1)}%`,
      subtext: emailsSent === 0 ? "No replies yet" : "Overall response rate",
      icon: MessageSquareReply,
      trend: replyRate > 0 ? `${replyRate.toFixed(1)}%` : undefined,
    },
    {
      title: "Positive Replies",
      value: positiveReplies.toLocaleString(),
      subtext: positiveReplies === 0 ? "Qualified interest" : "Warm sales signals",
      icon: CheckCircle2,
      trend: positiveReplies > 0 ? `${positiveReplies} warm` : undefined,
    },
    {
      title: "Meetings Booked",
      value: meetingsBooked.toLocaleString(),
      subtext: meetingsBooked === 0 ? "No calls scheduled" : "Discovery calls",
      icon: Calendar,
      trend: meetingsBooked > 0 ? `${meetingsBooked} calls` : undefined,
    },
    {
      title: "Clients Closed",
      value: clientsClosed.toLocaleString(),
      subtext: clientsClosed === 0 ? "Target: 1st client" : "Won engagements",
      icon: Briefcase,
      trend: clientsClosed > 0 ? `${clientsClosed} won` : undefined,
    },
    {
      title: "Monthly Conversion",
      value: `${monthlyConversionRate.toFixed(1)}%`,
      subtext: totalLeads === 0 ? "Lead-to-client ratio" : "End-to-end velocity",
      icon: TrendingUp,
      trend: monthlyConversionRate > 0 ? "Healthy" : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="p-3.5 rounded-lg border border-border bg-surface transition-colors hover:border-border-subtle"
          >
            <div className="flex items-center justify-between text-foreground-muted mb-1">
              <span className="text-[11px] font-medium tracking-tight text-foreground-muted truncate">
                {card.title}
              </span>
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-70 text-foreground-muted" aria-hidden="true" />
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
              {card.value}
            </div>
            <div className="flex items-center justify-between text-[10px] text-foreground-muted mt-1">
              <span className="truncate">{card.subtext}</span>
              {card.trend && (
                <span className="font-semibold text-success shrink-0 ml-1">
                  {card.trend}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
