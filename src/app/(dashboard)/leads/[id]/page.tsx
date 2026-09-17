"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  PenLine,
  Send,
  PlusCircle,
  Clock,
  Save,
  CheckCircle2,
  AlertCircle,
  Tag as TagIcon,
  X,
  Copy,
  Check,
  MessageSquare,
  PhoneCall,
  Loader2,
} from "lucide-react";
import { LeadStage, TagType } from "@prisma/client";

interface TagItem {
  id: string;
  name: string;
  type: TagType;
  color?: string | null;
}

interface InteractionItem {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  createdAt: string;
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = React.useState(false);

  // Available tags for tenant
  const [allTags, setAllTags] = React.useState<TagItem[]>([]);
  const [assigningTag, setAssigningTag] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState("");
  const [creatingTag, setCreatingTag] = React.useState(false);

  // Editable notes state
  const [notes, setNotes] = React.useState("");
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [notesSavedNotice, setNotesSavedNotice] = React.useState(false);

  // Stage change state
  const [updatingStage, setUpdatingStage] = React.useState(false);
  const [stageUpdatedNotice, setStageUpdatedNotice] = React.useState(false);

  // Interactions list state
  const [interactions, setInteractions] = React.useState<InteractionItem[]>([]);
  const [loadingInteractions, setLoadingInteractions] = React.useState(false);

  // Add interaction form state
  const [interactionType, setInteractionType] = React.useState<string>("NOTE");
  const [noteTitle, setNoteTitle] = React.useState("");
  const [noteDescription, setNoteDescription] = React.useState("");
  const [addingInteraction, setAddingInteraction] = React.useState(false);
  const [interactionError, setInteractionError] = React.useState<string | null>(null);

  // Fetch lead details
  const fetchLead = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) {
        throw new Error("Lead not found or you do not have permission to view it");
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

  // Fetch interactions from dedicated endpoint
  const fetchInteractions = React.useCallback(async () => {
    setLoadingInteractions(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/interactions?pageSize=50`);
      if (res.ok) {
        const data = await res.json();
        setInteractions(data.interactions || []);
      }
    } catch {
      // Fallback: lead.interactions is also available from lead fetch
    } finally {
      setLoadingInteractions(false);
    }
  }, [leadId]);

  // Fetch tenant tags
  const fetchTags = React.useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const data = await res.json();
        setAllTags(data.tags || []);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  React.useEffect(() => {
    fetchLead();
    fetchInteractions();
    fetchTags();
  }, [fetchLead, fetchInteractions, fetchTags]);

  // Copy email
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // Notes saver
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
      alert("Failed to save notes to database");
    } finally {
      setSavingNotes(false);
    }
  };

  // Stage change handler
  const handleStageChange = async (newStage: LeadStage) => {
    setUpdatingStage(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error("Failed to update stage");
      setStageUpdatedNotice(true);
      setTimeout(() => setStageUpdatedNotice(false), 2000);
      await fetchLead();
      await fetchInteractions();
    } catch {
      alert("Failed to update pipeline stage");
    } finally {
      setUpdatingStage(false);
    }
  };

  // Assign tag handler
  const handleAssignTag = async (tagId: string) => {
    if (!tagId) return;
    setAssigningTag(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      if (!res.ok) throw new Error("Failed to assign tag");
      await fetchLead();
    } catch {
      alert("Failed to assign tag");
    } finally {
      setAssigningTag(false);
    }
  };

  // Remove tag handler
  const handleRemoveTag = async (tagId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/tags/${tagId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove tag");
      await fetchLead();
    } catch {
      alert("Failed to remove tag");
    }
  };

  // Create new tag & assign handler
  const handleCreateAndAssignTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    try {
      const createRes = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim(), type: "CUSTOM" }),
      });
      if (!createRes.ok) throw new Error("Failed to create tag");
      const { tag } = await createRes.json();

      await fetch(`/api/leads/${leadId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: tag.id }),
      });

      setNewTagName("");
      await fetchTags();
      await fetchLead();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create and assign tag";
      alert(msg);
    } finally {
      setCreatingTag(false);
    }
  };

  // Add interaction handler
  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    setInteractionError(null);
    if (!noteTitle.trim()) {
      setInteractionError("Please enter a title for the interaction.");
      return;
    }
    setAddingInteraction(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: interactionType,
          title: noteTitle.trim(),
          description: noteDescription.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error?.message || "Failed to log interaction");
      }
      setNoteTitle("");
      setNoteDescription("");
      await fetchInteractions();
      await fetchLead();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add interaction";
      setInteractionError(msg);
    } finally {
      setAddingInteraction(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl pb-16">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-64 md:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-16 text-center">
        <EmptyState
          icon={<AlertCircle className="h-8 w-8 text-rose-500" aria-hidden="true" />}
          title="Lead Not Found"
          description={
            error ||
            "The requested prospect profile does not exist or you do not have permission to access it."
          }
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
  const assignedTagIds = new Set(
    (lead.tagAssignments || []).map((ta: any) => ta.tag.id)
  );
  const unassignedTags = allTags.filter((t) => !assignedTagIds.has(t.id));

  // Display interactions from state if loaded, otherwise fallback to lead.interactions
  const displayInteractions =
    interactions.length > 0 ? interactions : lead.interactions || [];

  return (
    <div className="space-y-6 pb-20 max-w-6xl">
      {/* Top Bar with Back Link and Quick Stage Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/leads">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Back to Leads list"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {lead.fullName}
              </h1>
              <LeadStageBadge stage={lead.stage} />
              <TemperatureBadge temperature={tempTag} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Added on {formatDate(lead.createdAt)} • Source: {lead.source || "Direct Lead"}
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
            className="h-8 text-xs w-44 font-medium bg-surface border-border"
            aria-label="Change lead pipeline stage"
          >
            <option value={LeadStage.NEW}>New</option>
            <option value={LeadStage.CONTACTED}>Contacted</option>
            <option value={LeadStage.FOLLOW_UP}>Follow-up</option>
            <option value={LeadStage.REPLIED}>Replied</option>
            <option value={LeadStage.POSITIVE_REPLY}>Positive Reply</option>
            <option value={LeadStage.MEETING_SCHEDULED}>Discovery Call</option>
            <option value={LeadStage.CLIENT}>Client Won</option>
            <option value={LeadStage.CLOSED_LOST}>Closed Lost</option>
          </Select>
          {stageUpdatedNotice && (
            <span
              role="status"
              className="text-xs text-success flex items-center gap-1 font-medium"
            >
              <Check className="h-3.5 w-3.5" /> Updated
            </span>
          )}
        </div>
      </div>

      {/* Tag Management Ribbon */}
      <div className="p-3 rounded-xl border border-border bg-card flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground flex items-center gap-1">
            <TagIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Tags:
          </span>

          {lead.tagAssignments && lead.tagAssignments.length > 0 ? (
            lead.tagAssignments.map((ta: any) => (
              <span
                key={ta.tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-elevated border border-border text-foreground font-medium"
              >
                <span>{ta.tag.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(ta.tag.id)}
                  className="text-foreground-muted hover:text-danger ml-0.5 transition-colors"
                  aria-label={`Remove tag ${ta.tag.name}`}
                  title="Remove tag"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          ) : (
            <span className="text-muted-foreground italic">No tags assigned yet.</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Assign existing tag dropdown */}
          {unassignedTags.length > 0 && (
            <Select
              name="assignExistingTag"
              disabled={assigningTag}
              onChange={(e) => {
                handleAssignTag(e.target.value);
                e.target.value = "";
              }}
              className="h-7 text-xs w-32 bg-surface"
              defaultValue=""
              aria-label="Assign existing tag"
            >
              <option value="" disabled>
                + Assign Tag…
              </option>
              {unassignedTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}

          {/* Create tag inline */}
          <form onSubmit={handleCreateAndAssignTag} className="flex items-center gap-1.5">
            <input
              type="text"
              name="newTagInput"
              placeholder="New tag…"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="h-7 w-24 rounded border border-border bg-surface px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
            <Button
              type="submit"
              size="sm"
              disabled={creatingTag || !newTagName.trim()}
              className="h-7 px-2 text-xs"
            >
              Add
            </Button>
          </form>
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
                  <div className="text-foreground font-semibold">
                    {lead.jobTitle || "Freelance Prospect"}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium">Email Address</span>
                  <div>
                    {lead.email ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={`mailto:${lead.email}`}
                          className="text-primary font-medium hover:underline flex items-center gap-1.5 truncate"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{lead.email}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyEmail(lead.email)}
                          className="text-foreground-muted hover:text-foreground"
                          title="Copy email"
                          aria-label="Copy email"
                        >
                          {copiedEmail ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium">Phone Number</span>
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
                        className="text-primary font-medium hover:underline flex items-center gap-1.5 truncate max-w-[240px]"
                      >
                        <Linkedin className="h-3.5 w-3.5 shrink-0 text-[#0077b5]" aria-hidden="true" />
                        <span className="truncate">{lead.linkedInUrl}</span>
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
                        className="text-primary font-medium hover:underline flex items-center gap-1.5 truncate max-w-[240px]"
                      >
                        <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{lead.website}</span>
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
                <CardDescription>
                  Pain points, project scope, budget, and call takeaways
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="gap-1.5 text-xs h-8"
              >
                {savingNotes ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Save Notes</span>
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {notesSavedNotice && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-1.5 mb-2 text-xs text-success font-medium animate-in fade-in"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Notes saved successfully to database.</span>
                </div>
              )}
              <textarea
                rows={4}
                name="leadNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add background intelligence, tech stack, or budget notes about this prospect…"
                className="w-full rounded-md border border-input bg-card p-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring leading-relaxed"
              />
            </CardContent>
          </Card>

          {/* Tabbed Modules: Timeline, Outreach, Meetings */}
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="flex flex-wrap gap-1">
              <TabsTrigger value="timeline">
                Timeline ({displayInteractions.length})
              </TabsTrigger>
              <TabsTrigger value="outreach">Outreach History</TabsTrigger>
              <TabsTrigger value="meetings">
                Meetings ({lead.meetings?.length || 0})
              </TabsTrigger>
            </TabsList>

            {/* Interaction Timeline Content */}
            <TabsContent value="timeline" className="space-y-4">
              {/* Add Interaction Form */}
              <Card className="p-4 bg-muted/20 border-border">
                <form onSubmit={handleAddInteraction} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <PlusCircle className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      Log Interaction or Activity
                    </span>
                    <Select
                      value={interactionType}
                      onChange={(e) => setInteractionType(e.target.value)}
                      className="h-7 text-xs w-32 bg-surface"
                      aria-label="Interaction type"
                    >
                      <option value="NOTE">Note 📝</option>
                      <option value="CALL">Call 📞</option>
                      <option value="MEETING">Meeting 🤝</option>
                      <option value="EMAIL_SENT">Email Sent ✉️</option>
                      <option value="REPLY_RECEIVED">Reply Received 💬</option>
                    </Select>
                  </div>

                  {interactionError && (
                    <div className="text-xs text-danger flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{interactionError}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <input
                      type="text"
                      name="noteTitle"
                      placeholder="Title (e.g. Discovery Call with Head of Product, Sent initial estimate)…"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <textarea
                      rows={2}
                      name="noteDescription"
                      placeholder="Details / discussion notes / outcome description (optional)…"
                      value={noteDescription}
                      onChange={(e) => setNoteDescription(e.target.value)}
                      className="w-full rounded-md border border-input bg-card p-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={addingInteraction || !noteTitle.trim()}
                      className="h-7 text-xs gap-1"
                    >
                      {addingInteraction ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Logging…</span>
                        </>
                      ) : (
                        "Log Interaction"
                      )}
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Interaction List */}
              <div className="space-y-2.5">
                {displayInteractions.length === 0 ? (
                  <EmptyState
                    icon={<Clock className="h-5 w-5" aria-hidden="true" />}
                    title="No interactions logged yet"
                    description="Calls, notes, emails, and meetings will automatically form an audit timeline here."
                    className="py-8"
                  />
                ) : (
                  displayInteractions.map((interaction: any) => {
                    const isCall = interaction.type === "CALL";
                    const isEmail =
                      interaction.type === "EMAIL_SENT" ||
                      interaction.type === "REPLY_RECEIVED";
                    const isMeeting = interaction.type === "MEETING";

                    return (
                      <div
                        key={interaction.id}
                        className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card text-xs hover:border-primary/30 transition-colors"
                      >
                        <div
                          className="h-7 w-7 rounded-lg bg-surface-elevated border border-border flex items-center justify-center text-foreground-muted shrink-0 mt-0.5"
                          aria-hidden="true"
                        >
                          {isCall ? (
                            <PhoneCall className="h-3.5 w-3.5 text-primary" />
                          ) : isEmail ? (
                            <Send className="h-3.5 w-3.5 text-info" />
                          ) : isMeeting ? (
                            <Calendar className="h-3.5 w-3.5 text-warning" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5 text-foreground-muted" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">
                                {interaction.title}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-surface-elevated border border-border text-foreground-muted font-mono uppercase">
                                {interaction.type}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap font-mono">
                              {formatRelativeTime(interaction.createdAt)}
                            </span>
                          </div>
                          {interaction.description && (
                            <p className="text-muted-foreground mt-1 whitespace-pre-line leading-relaxed">
                              {interaction.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* Outreach History Tab */}
            <TabsContent value="outreach">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Outreach History</CardTitle>
                  <CardDescription>Email campaigns, touches, and pitches sent</CardDescription>
                </CardHeader>
                <CardContent>
                  {!lead.emailMessages || lead.emailMessages.length === 0 ? (
                    <EmptyState
                      icon={<Send className="h-5 w-5" aria-hidden="true" />}
                      title="No outreach sent to this prospect yet"
                      description="When campaigns are dispatched or direct emails sent, delivery and reply logs will appear here."
                      className="py-8 border-0"
                    />
                  ) : (
                    <div className="space-y-2">
                      {lead.emailMessages.map((msg: any) => (
                        <div
                          key={msg.id}
                          className="p-3 border border-border rounded-lg text-xs space-y-1"
                        >
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
                      description="Booking links and synchronized Google Calendar events will be listed here."
                      className="py-8 border-0"
                    />
                  ) : (
                    <div className="space-y-2">
                      {lead.meetings.map((m: any) => (
                        <div
                          key={m.id}
                          className="p-3 border border-border rounded-lg text-xs"
                        >
                          <span className="font-semibold text-foreground">{m.title}</span>
                          <span className="text-muted-foreground block tabular-nums">
                            {formatDate(m.startTime)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Company & Quick Actions */}
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
                      <div className="text-foreground font-mono">{lead.company.domain}</div>
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
                      <div className="text-foreground tabular-nums">
                        {lead.company.companySize} employees
                      </div>
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
                <div className="text-muted-foreground py-2 italic">
                  No company record associated with this lead.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Personalization Studio Quick Link */}
          <Card className="border-border bg-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1.5 text-foreground">
                <PenLine className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Tailored Outreach Pitch
              </CardTitle>
              <CardDescription className="text-[11px]">
                Generate a fact-grounded cold outreach email for this prospect.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/personalization">
                <Button size="sm" variant="outline" className="w-full text-xs gap-1.5">
                  Draft Personalized Pitch
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
