"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { LeadStageBadge, TemperatureBadge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  Linkedin,
  MapPin,
  Building2,
  Calendar,
  Sparkles,
  Send,
  PlusCircle,
  Clock,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { LeadStage, TagType } from "@prisma/client";

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Editable notes state
  const [notes, setNotes] = React.useState("");
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [notesSavedNotice, setNotesSavedNotice] = React.useState(false);

  // Stage change state
  const [updatingStage, setUpdatingStage] = React.useState(false);

  // Add interaction state
  const [noteTitle, setNoteTitle] = React.useState("");
  const [noteDescription, setNoteDescription] = React.useState("");
  const [addingNote, setAddingNote] = React.useState(false);

  const fetchLead = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) {
        throw new Error("Lead not found or database error");
      }
      const data = await res.json();
      setLead(data.lead);
      setNotes(data.lead.notes || "");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading lead";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  React.useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error("Failed to save notes");
      setNotesSavedNotice(true);
      setTimeout(() => setNotesSavedNotice(false), 2500);
    } catch {
      alert("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleStageChange = async (newStage: LeadStage) => {
    setUpdatingStage(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error("Failed to update stage");
      await fetchLead();
    } catch {
      alert("Failed to update pipeline stage");
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "NOTE",
          title: noteTitle.trim(),
          description: noteDescription.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to log note");
      setNoteTitle("");
      setNoteDescription("");
      await fetchLead();
    } catch {
      alert("Failed to add interaction note");
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-64 md:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-12 text-center">
        <EmptyState
          icon={<AlertCircle className="h-6 w-6 text-rose-500" aria-hidden="true" />}
          title="Lead Not Found"
          description={error || "The requested prospect profile does not exist or you do not have permission to access it."}
          action={
            <Link href="/leads">
              <Button size="sm" variant="outline">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                Back to Leads Database
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const tempTag = lead.tagAssignments?.[0]?.tag?.type || TagType.WARM;

  return (
    <div className="space-y-6 pb-16 max-w-6xl">
      {/* Top Bar with Back Link and Quick Stage Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/leads">
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Back to Leads list">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                {lead.fullName}
              </h1>
              <LeadStageBadge stage={lead.stage} />
              <TemperatureBadge temperature={tempTag} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Added on {formatDate(lead.createdAt)} • Source: {lead.source || "Direct"}
            </p>
          </div>
        </div>

        {/* Pipeline Stage Quick Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Stage:</span>
          <Select
            name="leadStageQuickSwitch"
            value={lead.stage}
            disabled={updatingStage}
            onChange={(e) => handleStageChange(e.target.value as LeadStage)}
            className="h-8 text-xs w-44"
            aria-label="Change lead pipeline stage"
          >
            <option value={LeadStage.NEW}>NEW</option>
            <option value={LeadStage.CONTACTED}>CONTACTED</option>
            <option value={LeadStage.FOLLOW_UP}>FOLLOW_UP</option>
            <option value={LeadStage.REPLIED}>REPLIED</option>
            <option value={LeadStage.POSITIVE_REPLY}>POSITIVE_REPLY</option>
            <option value={LeadStage.MEETING_SCHEDULED}>MEETING_SCHEDULED</option>
            <option value={LeadStage.CLIENT}>CLIENT</option>
            <option value={LeadStage.CLOSED_LOST}>CLOSED_LOST</option>
          </Select>
        </div>
      </div>

      {/* Main Grid: Left Column Details & Right Column Company/Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols wide on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Contact details and prospect identifiers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium">Job Title</span>
                  <div className="text-foreground font-medium">
                    {lead.jobTitle || "—"}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium">Email</span>
                  <div>
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-primary font-medium hover:underline flex items-center gap-1.5"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{lead.email}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium">Phone</span>
                  <div>
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        className="text-primary font-medium hover:underline flex items-center gap-1.5"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{lead.phone}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium">Location</span>
                  <div className="text-foreground font-medium flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span>{lead.location || "—"}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium">LinkedIn Profile</span>
                  <div>
                    {lead.linkedInUrl ? (
                      <a
                        href={lead.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium hover:underline flex items-center gap-1.5"
                      >
                        <Linkedin className="h-3.5 w-3.5 shrink-0 text-[#0077b5]" aria-hidden="true" />
                        <span className="truncate max-w-[200px]">{lead.linkedInUrl}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium">Website</span>
                  <div>
                    {lead.website ? (
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium hover:underline flex items-center gap-1.5"
                      >
                        <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate max-w-[200px]">{lead.website}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes Card with Real-Time Persistence */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Prospect Notes & Context</CardTitle>
                <CardDescription>Pain points, project scope, budget, and meeting takeaways</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="gap-1.5 text-xs h-8"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                {savingNotes ? "Saving…" : "Save Notes"}
              </Button>
            </CardHeader>
            <CardContent>
              {notesSavedNotice && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-1.5 mb-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Notes saved to database.</span>
                </div>
              )}
              <textarea
                rows={4}
                name="leadNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add background intelligence or notes about this prospect…"
                className="w-full rounded-md border border-input bg-card p-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </CardContent>
          </Card>

          {/* Tabbed Modules: Timeline, Outreach, Meetings */}
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList>
              <TabsTrigger value="timeline">Interaction Timeline ({lead.interactions?.length || 0})</TabsTrigger>
              <TabsTrigger value="outreach">Outreach History</TabsTrigger>
              <TabsTrigger value="meetings">Meetings ({lead.meetings?.length || 0})</TabsTrigger>
            </TabsList>

            {/* Interaction Timeline Content */}
            <TabsContent value="timeline" className="space-y-4">
              {/* Add Note Form */}
              <Card className="p-4 bg-muted/20">
                <form onSubmit={handleAddInteraction} className="space-y-3">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <PlusCircle className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Log Interaction or Note
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      name="noteTitle"
                      placeholder="Title (e.g. Discovery Call, Sent Proposal)…"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="h-8 rounded-md border border-input bg-card px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <input
                      type="text"
                      name="noteDescription"
                      placeholder="Details / outcome description (optional)…"
                      value={noteDescription}
                      onChange={(e) => setNoteDescription(e.target.value)}
                      className="h-8 rounded-md border border-input bg-card px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={addingNote || !noteTitle.trim()} className="h-7 text-xs">
                      {addingNote ? "Logging…" : "Log Note"}
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Interaction List */}
              <div className="space-y-2.5">
                {!lead.interactions || lead.interactions.length === 0 ? (
                  <EmptyState
                    icon={<Clock className="h-5 w-5" aria-hidden="true" />}
                    title="No interactions logged"
                    description="Status updates, calls, and email messages will automatically form an audit timeline here."
                    className="py-8"
                  />
                ) : (
                  lead.interactions.map((interaction: any) => (
                    <div
                      key={interaction.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card text-xs"
                    >
                      <div className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {interaction.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {formatRelativeTime(interaction.createdAt)}
                          </span>
                        </div>
                        {interaction.description && (
                          <p className="text-muted-foreground mt-0.5 whitespace-pre-line">
                            {interaction.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Outreach History Tab */}
            <TabsContent value="outreach">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Outreach History</CardTitle>
                  <CardDescription>Email campaigns, touches, and AI generated pitches</CardDescription>
                </CardHeader>
                <CardContent>
                  {!lead.emailMessages || lead.emailMessages.length === 0 ? (
                    <EmptyState
                      icon={<Send className="h-5 w-5" aria-hidden="true" />}
                      title="No outreach sent to this prospect yet"
                      description="When campaigns are dispatched or 1-to-1 emails sent, delivery and reply logs will appear here."
                      className="py-8 border-0"
                    />
                  ) : (
                    <div className="space-y-2">
                      {lead.emailMessages.map((msg: any) => (
                        <div key={msg.id} className="p-3 border border-border rounded-lg text-xs space-y-1">
                          <div className="font-semibold text-foreground">{msg.subject}</div>
                          <div className="text-muted-foreground">{msg.body}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Meetings Tab */}
            <TabsContent value="meetings">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Scheduled Meetings</CardTitle>
                  <CardDescription>Calendar appointments and booking records</CardDescription>
                </CardHeader>
                <CardContent>
                  {!lead.meetings || lead.meetings.length === 0 ? (
                    <EmptyState
                      icon={<Calendar className="h-5 w-5" aria-hidden="true" />}
                      title="No meetings booked with this prospect"
                      description="Booking links and synced Google Calendar events will be listed here."
                      className="py-8 border-0"
                    />
                  ) : (
                    <div className="space-y-2">
                      {lead.meetings.map((m: any) => (
                        <div key={m.id} className="p-3 border border-border rounded-lg text-xs">
                          <span className="font-semibold text-foreground">{m.title}</span>
                          <span className="text-muted-foreground block tabular-nums">{formatDate(m.startTime)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Company & Tags Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Company Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {lead.company ? (
                <>
                  <div>
                    <span className="text-muted-foreground font-medium">Company Name</span>
                    <div className="text-foreground font-semibold text-sm mt-0.5">
                      {lead.company.name}
                    </div>
                  </div>

                  {lead.company.domain && (
                    <div>
                      <span className="text-muted-foreground font-medium">Domain</span>
                      <div className="text-foreground">{lead.company.domain}</div>
                    </div>
                  )}

                  {lead.company.industry && (
                    <div>
                      <span className="text-muted-foreground font-medium">Industry</span>
                      <div className="text-foreground">{lead.company.industry}</div>
                    </div>
                  )}

                  {lead.company.companySize && (
                    <div>
                      <span className="text-muted-foreground font-medium">Company Size</span>
                      <div className="text-foreground tabular-nums">{lead.company.companySize} employees</div>
                    </div>
                  )}

                  {lead.company.location && (
                    <div>
                      <span className="text-muted-foreground font-medium">Headquarters</span>
                      <div className="text-foreground">{lead.company.location}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground py-2">
                  No company record linked to this lead.
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Actions Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1.5 text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                AI Personalization Engine
              </CardTitle>
              <CardDescription className="text-[11px]">
                Research company profile and draft tailored outreach pitches.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/personalization">
                <Button size="sm" variant="outline" className="w-full text-xs gap-1.5">
                  Open Personalization Studio
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
