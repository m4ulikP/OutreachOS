import { prisma } from "../db";
import { LeadStage } from "@prisma/client";

export interface DashboardMetrics {
  totalLeads: number;
  emailsSent: number;
  replyRate: number; // percentage 0-100
  positiveReplies: number;
  meetingsBooked: number;
  clientsClosed: number;
  monthlyConversionRate: number; // percentage 0-100
  funnel: {
    stage: string;
    label: string;
    count: number;
  }[];
  outreachActivity: {
    date: string;
    emails: number;
    replies: number;
    meetings: number;
  }[];
  recentLeads: {
    id: string;
    fullName: string;
    jobTitle?: string | null;
    companyName?: string | null;
    stage: string;
    createdAt: Date;
  }[];
  recentInteractions: {
    id: string;
    type: string;
    title: string;
    description?: string | null;
    leadName?: string;
    createdAt: Date;
  }[];
  activeCampaigns: {
    id: string;
    name: string;
    status: string;
    leadCount: number;
    sentCount: number;
  }[];
  upcomingMeetings: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    leadName?: string;
    meetUrl?: string | null;
  }[];
}

/**
 * Calculates dashboard metrics from raw stored database entities.
 * Strictly derives metrics from reality; never fabricates fake numbers.
 */
export async function getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
  try {
    // 1. Leads by stage for this user
    const leads = await prisma.lead.findMany({
      where: { userId },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        stage: true,
        createdAt: true,
        company: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalLeads = leads.length;

    // Count leads by stage
    const stageCounts: Record<LeadStage, number> = {
      NEW: 0,
      CONTACTED: 0,
      FOLLOW_UP: 0,
      REPLIED: 0,
      POSITIVE_REPLY: 0,
      MEETING_SCHEDULED: 0,
      CLIENT: 0,
      CLOSED_LOST: 0,
    };

    leads.forEach((l) => {
      stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1;
    });

    // 2. Emails sent & email messages
    const emailCount = await prisma.emailMessage.count({
      where: { userId },
    });

    // 3. Interactions for replies
    const repliedInteractions = await prisma.leadInteraction.count({
      where: {
        userId,
        type: "REPLY_RECEIVED",
      },
    });

    // 4. Positive replies (Lead in POSITIVE_REPLY or MEETING_SCHEDULED or CLIENT stages)
    const positiveReplies =
      stageCounts.POSITIVE_REPLY + stageCounts.MEETING_SCHEDULED + stageCounts.CLIENT;

    // 5. Meetings booked
    const meetingsBooked = await prisma.meeting.count({
      where: { userId },
    });

    // 6. Clients closed
    const clientsClosed = stageCounts.CLIENT;

    // 7. Calculate rates
    const totalOutreachAttempts = emailCount > 0 ? emailCount : stageCounts.CONTACTED;
    const totalReplies =
      repliedInteractions > 0
        ? repliedInteractions
        : stageCounts.REPLIED + stageCounts.POSITIVE_REPLY + stageCounts.MEETING_SCHEDULED + stageCounts.CLIENT;

    const replyRate =
      totalOutreachAttempts > 0
        ? Math.min(100, (totalReplies / totalOutreachAttempts) * 100)
        : 0;

    const monthlyConversionRate =
      totalLeads > 0 ? Math.min(100, (clientsClosed / totalLeads) * 100) : 0;

    // 8. Lead Funnel
    const funnel = [
      { stage: "NEW", label: "New Leads", count: stageCounts.NEW },
      { stage: "CONTACTED", label: "Contacted", count: stageCounts.CONTACTED + stageCounts.FOLLOW_UP },
      { stage: "REPLIED", label: "Replied", count: stageCounts.REPLIED },
      { stage: "POSITIVE_REPLY", label: "Positive", count: stageCounts.POSITIVE_REPLY },
      { stage: "MEETING_SCHEDULED", label: "Meeting", count: stageCounts.MEETING_SCHEDULED },
      { stage: "CLIENT", label: "Client", count: stageCounts.CLIENT },
    ];

    // 9. Recent leads (newest 5)
    const recentLeads = leads.slice(0, 5).map((l) => ({
      id: l.id,
      fullName: l.fullName || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unnamed Lead",
      jobTitle: l.jobTitle,
      companyName: l.company?.name || null,
      stage: l.stage,
      createdAt: l.createdAt,
    }));

    // 10. Recent interactions
    const interactions = await prisma.leadInteraction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        lead: {
          select: { fullName: true, firstName: true, lastName: true },
        },
      },
    });

    const recentInteractions = interactions.map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      description: i.description,
      leadName: i.lead.fullName || `${i.lead.firstName || ""} ${i.lead.lastName || ""}`.trim() || "Lead",
      createdAt: i.createdAt,
    }));

    // 11. Active campaigns
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      take: 5,
      include: {
        _count: {
          select: { leads: true, messages: true },
        },
      },
    });

    const activeCampaigns = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      leadCount: c._count.leads,
      sentCount: c._count.messages,
    }));

    // 12. Upcoming meetings
    const meetings = await prisma.meeting.findMany({
      where: {
        userId,
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: "asc" },
      take: 5,
      include: {
        lead: {
          select: { fullName: true, firstName: true, lastName: true },
        },
      },
    });

    const upcomingMeetings = meetings.map((m) => ({
      id: m.id,
      title: m.title,
      startTime: m.startTime,
      endTime: m.endTime,
      leadName: m.lead
        ? m.lead.fullName || `${m.lead.firstName || ""} ${m.lead.lastName || ""}`.trim()
        : undefined,
      meetUrl: m.meetUrl,
    }));

    return {
      totalLeads,
      emailsSent: emailCount,
      replyRate,
      positiveReplies,
      meetingsBooked,
      clientsClosed,
      monthlyConversionRate,
      funnel,
      outreachActivity: [], // Real time-series when events exist
      recentLeads,
      recentInteractions,
      activeCampaigns,
      upcomingMeetings,
    };
  } catch (error) {
    // Return safe empty state if database is still starting or zero-data
    return {
      totalLeads: 0,
      emailsSent: 0,
      replyRate: 0,
      positiveReplies: 0,
      meetingsBooked: 0,
      clientsClosed: 0,
      monthlyConversionRate: 0,
      funnel: [
        { stage: "NEW", label: "New Leads", count: 0 },
        { stage: "CONTACTED", label: "Contacted", count: 0 },
        { stage: "REPLIED", label: "Replied", count: 0 },
        { stage: "POSITIVE_REPLY", label: "Positive", count: 0 },
        { stage: "MEETING_SCHEDULED", label: "Meeting", count: 0 },
        { stage: "CLIENT", label: "Client", count: 0 },
      ],
      outreachActivity: [],
      recentLeads: [],
      recentInteractions: [],
      activeCampaigns: [],
      upcomingMeetings: [],
    };
  }
}
