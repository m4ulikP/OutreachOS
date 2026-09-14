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
    },
    {
      title: "Emails Sent",
      value: emailsSent.toLocaleString(),
      subtext: emailsSent === 0 ? "No campaigns dispatched" : "Outreach volume",
      icon: Mail,
    },
    {
      title: "Reply Rate",
      value: `${replyRate.toFixed(1)}%`,
      subtext: emailsSent === 0 ? "Awaiting first campaign" : "Overall response rate",
      icon: MessageSquareReply,
    },
    {
      title: "Positive Replies",
      value: positiveReplies.toLocaleString(),
      subtext: positiveReplies === 0 ? "Qualified interest" : "Warm sales signals",
      icon: CheckCircle2,
    },
    {
      title: "Meetings Booked",
      value: meetingsBooked.toLocaleString(),
      subtext: meetingsBooked === 0 ? "No meetings booked" : "Scheduled calls",
      icon: Calendar,
    },
    {
      title: "Clients Closed",
      value: clientsClosed.toLocaleString(),
      subtext: clientsClosed === 0 ? "Target: 1st client" : "Won contracts",
      icon: Briefcase,
    },
    {
      title: "Monthly Conversion",
      value: `${monthlyConversionRate.toFixed(1)}%`,
      subtext: totalLeads === 0 ? "Lead to client ratio" : "End-to-end conversion",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="p-3.5">
            <CardContent className="p-0">
              <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                <span className="text-[11px] font-medium tracking-tight truncate">
                  {card.title}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
              </div>
              <div className="text-xl font-bold tracking-tight text-foreground">
                {card.value}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {card.subtext}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
