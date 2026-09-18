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
import { formatDate, formatRelativeTime, cn } from "@/lib/utils";
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
  CalendarClock,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Bot,
  Lightbulb,
  CheckCircle,
  Code2,
} from "lucide-react";
import { LeadStage, TagType, FollowUpStatus } from "@prisma/client";

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

  // Follow-ups state
  const [followUps, setFollowUps] = React.useState<any[]>([]);
  const [loadingFollowUps, setLoadingFollowUps] = React.useState(false);
  const [showScheduleForm, setShowScheduleForm] = React.useState(false);
  const [followUpDate, setFollowUpDate] = React.useState("");
  const [followUpTime, setFollowUpTime] = React.useState("09:00");
  const [followUpNotes, setFollowUpNotes] = React.useState("");
  const [savingFollowUp, setSavingFollowUp] = React.useState(false);
  const [showFollowUpHistory, setShowFollowUpHistory] = React.useState(false);

  // Interactions list state
  const [interactions, setInteractions] = React.useState<InteractionItem[]>([]);
  const [loadingInteractions, setLoadingInteractions] = React.useState(false);

  // Add interaction form state
  const [interactionType, setInteractionType] = React.useState<string>("NOTE");
  const [noteTitle, setNoteTitle] = React.useState("");
  const [noteDescription, setNoteDescription] = React.useState("");
  const [addingInteraction, setAddingInteraction] = React.useState(false);
  const [interactionError, setInteractionError] = React.useState<string | null>(null);

  // Active Tab state
  const [activeTab, setActiveTab] = React.useState("research");

  // Website Research state
  const [research, setResearch] = React.useState<any>(null);
  const [loadingResearch, setLoadingResearch] = React.useState(false);
  const [researchError, setResearchError] = React.useState<string | null>(null);
  const [customWebsiteUrl, setCustomWebsiteUrl] = React.useState("");

  // AI Personalization state
  const [personalization, setPersonalization] = React.useState<any>(null);
  const [loadingPersonalization, setLoadingPersonalization] = React.useState(false);
  const [personalizationError, setPersonalizationError] = React.useState<string | null>(null);
  const [draftSubject, setDraftSubject] = React.useState("");
  const [draftEmailBody, setDraftEmailBody] = React.useState("");
  const [draftLinkedInMessage, setDraftLinkedInMessage] = React.useState("");
  const [savingPersonalization, setSavingPersonalization] = React.useState(false);
  const [personalizationSavedNotice, setPersonalizationSavedNotice] = React.useState(false);
  const [copiedSubject, setCopiedSubject] = React.useState(false);
  const [copiedBody, setCopiedBody] = React.useState(false);
  const [copiedLinkedIn, setCopiedLinkedIn] = React.useState(false);

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
      if (data.lead.website || data.lead.company?.domain || data.lead.company?.website) {
        setCustomWebsiteUrl((prev) => prev || data.lead.website || data.lead.company?.domain || data.lead.company?.website || "");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading lead";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  // Fetch research details (cached or latest)
  const fetchResearch = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/research`);
      if (res.ok) {
        const data = await res.json();
        setResearch(data.research || null);
        if (data.research?.url) {
          setCustomWebsiteUrl((prev) => prev || data.research.url);
        }
      }
    } catch {
      // Non-fatal
    }
  }, [leadId]);

  // Fetch personalization details
  const fetchPersonalization = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/personalization`);
      if (res.ok) {
        const data = await res.json();
        const p = data.personalization;
        setPersonalization(p || null);
        if (p) {
          setDraftSubject(p.subject || "");
          setDraftEmailBody(p.emailBody || p.generatedText || "");
          setDraftLinkedInMessage(p.linkedInMessage || "");
        }
      }
    } catch {
      // Non-fatal
    }
  }, [leadId]);

  // Run or re-run research
  const handleRunResearch = async (forceRefresh = false) => {
    setLoadingResearch(true);
    setResearchError(null);
    try {
      const targetUrl = customWebsiteUrl.trim() || lead?.website || lead?.company?.domain || lead?.company?.website;
      if (!targetUrl) {
        throw new Error("Please enter a website URL to research.");
      }
      const res = await fetch(`/api/leads/${leadId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: targetUrl,
          serviceProfile: "web-development",
          forceRefresh,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || "Website research failed");
      }
      setResearch(data.research);
    } catch (err: unknown) {
      setResearchError(err instanceof Error ? err.message : "Failed to run website research");
    } finally {
      setLoadingResearch(false);
    }
  };

  // Generate or re-generate personalization
  const handleGeneratePersonalization = async (forceRegenerate = false) => {
    setLoadingPersonalization(true);
    setPersonalizationError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/personalization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceProfile: "web-development",
          forceRegenerate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || "Personalization generation failed");
      }
      const p = data.personalization;
      setPersonalization(p);
      setDraftSubject(p.subject || "");
      setDraftEmailBody(p.emailBody || p.generatedText || "");
      setDraftLinkedInMessage(p.linkedInMessage || "");
    } catch (err: unknown) {
      setPersonalizationError(err instanceof Error ? err.message : "Failed to generate outreach");
    } finally {
      setLoadingPersonalization(false);
    }
  };

  // Save personalization edits (PUT)
  const handleSavePersonalization = async () => {
    setSavingPersonalization(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/personalization`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: personalization?.id,
          subject: draftSubject,
          emailBody: draftEmailBody,
          linkedInMessage: draftLinkedInMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || "Failed to save outreach draft");
      }
      setPersonalization(data.personalization);
      setPersonalizationSavedNotice(true);
      setTimeout(() => setPersonalizationSavedNotice(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save outreach edits");
    } finally {
      setSavingPersonalization(false);
    }
  };

  const handleCopySubject = () => {
    if (!draftSubject) return;
    navigator.clipboard.writeText(draftSubject);
    setCopiedSubject(true);
    setTimeout(() => setCopiedSubject(false), 2000);
  };

  const handleCopyBody = () => {
    if (!draftEmailBody) return;
    navigator.clipboard.writeText(draftEmailBody);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const handleCopyLinkedIn = () => {
    if (!draftLinkedInMessage) return;
    navigator.clipboard.writeText(draftLinkedInMessage);
    setCopiedLinkedIn(true);
    setTimeout(() => setCopiedLinkedIn(false), 2000);
  };

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

  // Fetch follow-ups from dedicated endpoint
  const fetchFollowUps = React.useCallback(async () => {
    setLoadingFollowUps(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/follow-ups`);
      if (res.ok) {
        const data = await res.json();
        setFollowUps(data.followUps || []);
      }
    } catch {
      // Non-fatal fallback
    } finally {
      setLoadingFollowUps(false);
    }
  }, [leadId]);

  React.useEffect(() => {
    fetchLead();
    fetchInteractions();
    fetchFollowUps();
    fetchTags();
    fetchResearch();
    fetchPersonalization();
  }, [fetchLead, fetchInteractions, fetchFollowUps, fetchTags, fetchResearch, fetchPersonalization]);

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

  // Stage change handler via centralized lifecycle endpoint
  const handleStageChange = async (newStage: LeadStage) => {
    if (newStage === lead?.stage) return;
    setUpdatingStage(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "POST",
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

  // Follow-up handlers
  const handleScheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpDate) return;
    setSavingFollowUp(true);
    try {
      const dateTimeString = `${followUpDate}T${followUpTime || "09:00"}:00`;
      const scheduledDate = new Date(dateTimeString);
      if (isNaN(scheduledDate.getTime())) {
        throw new Error("Invalid date selected");
      }

      const res = await fetch(`/api/leads/${leadId}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledFor: scheduledDate.toISOString(),
          notes: followUpNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to schedule follow-up");
      }

      setFollowUpDate("");
      setFollowUpNotes("");
      setShowScheduleForm(false);
      await fetchFollowUps();
      await fetchInteractions();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to schedule follow-up");
    } finally {
      setSavingFollowUp(false);
    }
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/follow-ups/${followUpId}/complete`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to complete follow-up");
      await fetchFollowUps();
      await fetchLead();
      await fetchInteractions();
    } catch {
      alert("Failed to complete follow-up");
    }
  };

  const handleCancelFollowUp = async (followUpId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/follow-ups/${followUpId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to cancel follow-up");
      await fetchFollowUps();
      await fetchInteractions();
    } catch {
      alert("Failed to cancel follow-up");
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

          {/* Tabbed Modules: Research, Personalization, Timeline, Outreach, Meetings */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex flex-wrap gap-1">
              <TabsTrigger value="research" className="gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span>Website Research</span>
                {research?.status === "COMPLETED" && (
                  <span className="ml-1 h-2 w-2 rounded-full bg-emerald-500 inline-block" title="Research completed" />
                )}
              </TabsTrigger>
              <TabsTrigger value="personalization" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>AI Outreach</span>
                {personalization && (
                  <span className="ml-1 h-2 w-2 rounded-full bg-primary inline-block" title="Outreach generated" />
                )}
              </TabsTrigger>
              <TabsTrigger value="timeline">
                Timeline ({displayInteractions.length})
              </TabsTrigger>
              <TabsTrigger value="outreach">Outreach History</TabsTrigger>
              <TabsTrigger value="meetings">
                Meetings ({lead.meetings?.length || 0})
              </TabsTrigger>
            </TabsList>

            {/* Website Research Tab */}
            <TabsContent value="research" className="space-y-4">
              {/* Research Header / Control Card */}
              <Card className="p-4 border-border bg-card space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        Public Website Audit & Intelligence
                      </span>
                      {research?.status === "COMPLETED" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Researched
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      SSRF-safe, public-data scanner tailored for Maulik&apos;s Web Development freelance services.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {research?.status === "COMPLETED" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loadingResearch}
                        onClick={() => handleRunResearch(true)}
                        className="h-7 text-xs gap-1.5"
                        title="Bypass 7-day cache and fetch fresh website data"
                      >
                        {loadingResearch ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        <span>Re-run Research</span>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={customWebsiteUrl}
                    onChange={(e) => setCustomWebsiteUrl(e.target.value)}
                    disabled={loadingResearch}
                    className="h-8 flex-1 rounded-md border border-input bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={loadingResearch || !customWebsiteUrl.trim()}
                    onClick={() => handleRunResearch(false)}
                    className="h-8 text-xs gap-1.5 px-3"
                  >
                    {loadingResearch ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Auditing Website…</span>
                      </>
                    ) : (
                      <>
                        <Globe className="h-3.5 w-3.5" />
                        <span>{research ? "Refresh Research" : "Run Website Research"}</span>
                      </>
                    )}
                  </Button>
                </div>

                {researchError && (
                  <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/25 text-xs text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{researchError}</span>
                  </div>
                )}
              </Card>

              {/* Research Results */}
              {!research ? (
                <EmptyState
                  icon={<Globe className="h-6 w-6 text-primary/70" aria-hidden="true" />}
                  title="No website research performed yet"
                  description="Run an automated audit to extract technical diagnostics, mobile viewport check, public contact information, and pitch-ready web development opportunities."
                  className="py-10 border-border bg-card/50"
                  action={
                    <Button
                      size="sm"
                      onClick={() => handleRunResearch(false)}
                      disabled={loadingResearch || !customWebsiteUrl.trim()}
                      className="gap-1.5 text-xs"
                    >
                      {loadingResearch ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Auditing…</span>
                        </>
                      ) : (
                        <>
                          <Globe className="h-3.5 w-3.5" />
                          <span>Run Research Now</span>
                        </>
                      )}
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4 animate-in fade-in">
                  {/* Summary Card */}
                  <Card className="p-4 border-border bg-card space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-foreground">Target URL:</span>
                        <a
                          href={research.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                        >
                          <span>{research.url}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        Researched: {formatDate(research.researchedAt)}
                      </div>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed pt-1">
                      {research.summary}
                    </p>
                  </Card>

                  {/* Opportunities Detected */}
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-foreground font-semibold">
                          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                          Detected Web Development Opportunities
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-elevated border border-border text-foreground font-mono">
                          {research.opportunitySignals?.length || 0} Identified
                        </span>
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        Factually backed improvements Maulik can pitch to increase conversions and site performance.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2.5 pt-1">
                      {(!research.opportunitySignals || research.opportunitySignals.length === 0) ? (
                        <div className="text-xs text-muted-foreground italic py-2">
                          No major technical or UX deficits detected on the public homepage.
                        </div>
                      ) : (
                        research.opportunitySignals.map((opp: any, idx: number) => {
                          const isHigh = opp.confidence === "HIGH";
                          const isMed = opp.confidence === "MEDIUM";
                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-lg border border-border bg-surface/60 space-y-2 hover:border-primary/30 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                  <AlertCircle className={cn(
                                    "h-3.5 w-3.5 shrink-0",
                                    isHigh ? "text-amber-500" : isMed ? "text-blue-500" : "text-muted-foreground"
                                  )} />
                                  <span>{opp.issue}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase font-mono",
                                      isHigh
                                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                        : isMed
                                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                                        : "bg-muted text-muted-foreground"
                                    )}
                                  >
                                    {opp.confidence} Confidence
                                  </span>
                                </div>
                              </div>
                              <div className="text-[11px] bg-card p-2 rounded border border-border/80 text-foreground/80 font-mono">
                                <span className="text-muted-foreground text-[10px] uppercase block font-sans font-medium mb-0.5">
                                  Observed Evidence:
                                </span>
                                {opp.evidence}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="font-semibold text-foreground shrink-0">Recommendation:</span>
                                <span>{opp.recommendation}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>

                  {/* Structured Technical & Business Evidence */}
                  {research.structuredEvidence && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Technical Health */}
                      <Card className="border-border bg-card">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                            <Code2 className="h-3.5 w-3.5 text-primary" />
                            Technical Diagnostics
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs">
                          <div className="flex items-center justify-between py-1 border-b border-border/60">
                            <span className="text-muted-foreground">Mobile Viewport</span>
                            {research.structuredEvidence.technical?.hasMobileViewport ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                                <Check className="h-3 w-3" /> Present
                              </span>
                            ) : (
                              <span className="text-rose-500 font-medium flex items-center gap-1 text-[11px]">
                                <X className="h-3 w-3" /> Missing
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-border/60">
                            <span className="text-muted-foreground">Final HTTPS</span>
                            {research.structuredEvidence.technical?.isFinalHttps ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                                <ShieldCheck className="h-3 w-3" /> Secure
                              </span>
                            ) : (
                              <span className="text-rose-500 font-medium flex items-center gap-1 text-[11px]">
                                <ShieldAlert className="h-3 w-3" /> Insecure HTTP
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-border/60">
                            <span className="text-muted-foreground">Image Alt Text</span>
                            <span className="font-mono text-[11px] text-foreground">
                              {research.structuredEvidence.technical?.imagesWithAlt ?? 0} /{" "}
                              {research.structuredEvidence.technical?.totalImages ?? 0}
                            </span>
                          </div>

                          <div className="py-1">
                            <span className="text-muted-foreground block text-[11px] mb-0.5">Page Title</span>
                            <span className="font-medium text-foreground text-[11px] line-clamp-1">
                              {research.structuredEvidence.identity?.pageTitle || "—"}
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Business & Public Contacts */}
                      <Card className="border-border bg-card">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                            Public Business Signals
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs">
                          <div className="flex items-center justify-between py-1 border-b border-border/60">
                            <span className="text-muted-foreground">Online Booking</span>
                            <span className="font-medium text-[11px]">
                              {research.structuredEvidence.business?.hasOnlineBooking ? "Yes" : "Not Found"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-border/60">
                            <span className="text-muted-foreground">Ecommerce Store</span>
                            <span className="font-medium text-[11px]">
                              {research.structuredEvidence.business?.hasEcommerce ? "Yes" : "No"}
                            </span>
                          </div>

                          <div className="py-1 border-b border-border/60">
                            <span className="text-muted-foreground block text-[11px] mb-0.5">Public Emails</span>
                            {research.structuredEvidence.business?.publicEmails?.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {research.structuredEvidence.business.publicEmails.map((e: string, i: number) => (
                                  <span key={i} className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-[10px] font-mono">
                                    {e}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px] italic">None listed on homepage</span>
                            )}
                          </div>

                          <div className="py-1">
                            <span className="text-muted-foreground block text-[11px] mb-0.5">Public Phones</span>
                            {research.structuredEvidence.business?.phoneNumbers?.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {research.structuredEvidence.business.phoneNumbers.map((p: string, i: number) => (
                                  <span key={i} className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-[10px] font-mono">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px] italic">None listed on homepage</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Transition to Personalization */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5">
                    <div className="text-xs">
                      <span className="font-semibold text-foreground block">Ready to draft high-converting outreach?</span>
                      <span className="text-muted-foreground text-[11px]">
                        Feed these verified website opportunities into OutreachOS&apos;s AI personalization engine.
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setActiveTab("personalization");
                        if (!personalization) {
                          handleGeneratePersonalization(false);
                        }
                      }}
                      className="gap-1.5 text-xs shrink-0"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Draft Outreach Pitch →</span>
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* AI Personalization Tab */}
            <TabsContent value="personalization" className="space-y-4">
              {/* Header / Service Profile banner */}
              <Card className="p-4 border-border bg-card space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                        AI Multi-Channel Outreach Studio
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        Web Development Service
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Factual, evidence-grounded copy for cold emails and LinkedIn messages with zero hallucinations.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {personalization && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loadingPersonalization}
                        onClick={() => handleGeneratePersonalization(true)}
                        className="h-7 text-xs gap-1.5"
                        title="Regenerate copy using current website evidence"
                      >
                        {loadingPersonalization ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        <span>Regenerate</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={loadingPersonalization}
                      onClick={() => handleGeneratePersonalization(false)}
                      className="h-7 text-xs gap-1.5"
                    >
                      {loadingPersonalization ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Generating…</span>
                        </>
                      ) : (
                        <>
                          <Bot className="h-3.5 w-3.5" />
                          <span>{personalization ? "Reload Draft" : "Generate Outreach"}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {personalizationError && (
                  <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/25 text-xs text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{personalizationError}</span>
                  </div>
                )}
              </Card>

              {!personalization ? (
                <EmptyState
                  icon={<Sparkles className="h-6 w-6 text-amber-500" aria-hidden="true" />}
                  title="No personalized outreach generated yet"
                  description="Generate high-converting, tailored email and LinkedIn pitches backed by verified website audit findings."
                  className="py-10 border-border bg-card/50"
                  action={
                    <Button
                      size="sm"
                      onClick={() => handleGeneratePersonalization(false)}
                      disabled={loadingPersonalization}
                      className="gap-1.5 text-xs"
                    >
                      {loadingPersonalization ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Crafting Outreach…</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Generate Outreach Draft</span>
                        </>
                      )}
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4 animate-in fade-in">
                  {/* Why this prospect rationale & Evidence pills */}
                  <Card className="p-4 border-border bg-card space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                        Strategic Pitch Rationale
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-surface-elevated border border-border text-foreground font-semibold">
                        {personalization.confidence || "HIGH"} Confidence
                      </span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed italic bg-surface/50 p-2.5 rounded border border-border/60">
                      &ldquo;{personalization.whyProspect}&rdquo;
                    </p>
                    {personalization.evidenceUsed && personalization.evidenceUsed.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Website Evidence Grounding This Pitch:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {personalization.evidenceUsed.map((ev: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-surface-elevated border border-border text-[10px] font-medium text-foreground flex items-center gap-1"
                            >
                              <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />
                              <span>{ev}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Channel 1: Cold Email */}
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                          <Mail className="h-3.5 w-3.5 text-primary" />
                          Channel 1: Personalized Cold Email
                        </CardTitle>
                        <CardDescription className="text-[11px]">
                          Tailored value proposition highlighting specific website opportunities
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={handleCopyBody}
                        >
                          {copiedBody ? <Check className="h-3 w-3 text-emerald-500 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                          <span>{copiedBody ? "Copied" : "Copy Body"}</span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-1">
                      {/* Subject input */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <label className="font-medium text-muted-foreground">Subject Line</label>
                          <button
                            type="button"
                            onClick={handleCopySubject}
                            className="text-primary hover:underline flex items-center gap-0.5 text-[10px]"
                          >
                            {copiedSubject ? "Copied!" : "Copy Subject"}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={draftSubject}
                          onChange={(e) => setDraftSubject(e.target.value)}
                          className="h-8 w-full rounded border border-input bg-card px-2.5 text-xs text-foreground font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>

                      {/* Email Body textarea */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <label className="font-medium text-muted-foreground">Email Body</label>
                          <span className="text-muted-foreground text-[10px] font-mono">
                            {draftEmailBody.trim() ? draftEmailBody.trim().split(/\s+/).length : 0} words
                          </span>
                        </div>
                        <textarea
                          rows={8}
                          value={draftEmailBody}
                          onChange={(e) => setDraftEmailBody(e.target.value)}
                          className="w-full rounded border border-input bg-card p-2.5 text-xs text-foreground font-sans leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Channel 2: LinkedIn Message */}
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                          <Linkedin className="h-3.5 w-3.5 text-[#0077b5]" />
                          Channel 2: LinkedIn Connection Request / InMail
                        </CardTitle>
                        <CardDescription className="text-[11px]">
                          Concise, direct note referencing their website audit
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={handleCopyLinkedIn}
                      >
                        {copiedLinkedIn ? <Check className="h-3 w-3 text-emerald-500 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        <span>{copiedLinkedIn ? "Copied" : "Copy Note"}</span>
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <label className="font-medium text-muted-foreground">Connection Note</label>
                        <span className={cn(
                          "text-[10px] font-mono",
                          draftLinkedInMessage.length > 300 ? "text-amber-500 font-semibold" : "text-muted-foreground"
                        )}>
                          {draftLinkedInMessage.length} / 300 chars
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={draftLinkedInMessage}
                        onChange={(e) => setDraftLinkedInMessage(e.target.value)}
                        className="w-full rounded border border-input bg-card p-2.5 text-xs text-foreground font-sans leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </CardContent>
                  </Card>

                  {/* Save Draft Action Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface-elevated">
                    <div>
                      {personalizationSavedNotice ? (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Outreach draft saved successfully to database!
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Phase 5 Review Mode: All modifications are persisted to PostgreSQL upon saving.
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSavePersonalization}
                      disabled={savingPersonalization}
                      className="gap-1.5 text-xs w-full sm:w-auto h-8 px-4"
                    >
                      {savingPersonalization ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving…</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>Save Outreach Edits</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

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

        {/* Right Column: Follow-Up Workflow & Company Overview */}
        <div className="space-y-6">
          {/* Follow-Up Management Card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
                  Follow-Up Workflow
                </CardTitle>
                <CardDescription className="text-xs">
                  Schedule reminders and manage touchpoint lifecycle
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 px-2.5"
                onClick={() => setShowScheduleForm(!showScheduleForm)}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                {showScheduleForm ? "Cancel" : "Schedule"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {/* Inline Schedule Form */}
              {showScheduleForm && (
                <form
                  onSubmit={handleScheduleFollowUp}
                  className="p-3 border border-border rounded-lg bg-surface-elevated space-y-2.5 animate-in fade-in"
                >
                  <div className="font-semibold text-foreground text-xs">
                    Schedule Next Follow-Up
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Date</label>
                      <input
                        type="date"
                        required
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="h-8 w-full rounded border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Time</label>
                      <input
                        type="time"
                        value={followUpTime}
                        onChange={(e) => setFollowUpTime(e.target.value)}
                        className="h-8 w-full rounded border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Check in on contract proposal, send portfolio..."
                      value={followUpNotes}
                      onChange={(e) => setFollowUpNotes(e.target.value)}
                      className="h-8 w-full rounded border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setShowScheduleForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={savingFollowUp || !followUpDate}
                      className="h-7 text-xs px-3"
                    >
                      {savingFollowUp ? "Saving…" : "Save Follow-Up"}
                    </Button>
                  </div>
                </form>
              )}

              {/* Active Follow-Ups */}
              {(() => {
                const active = followUps.filter((f) => f.status === "SCHEDULED");
                const hasOverdue = active.some((f) => f.isOverdue);

                if (active.length === 0) {
                  return (
                    <div className="p-3 rounded-lg border border-dashed border-border text-center text-muted-foreground py-4">
                      <span>No follow-up currently scheduled.</span>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {hasOverdue && (
                      <div className="flex items-center gap-1.5 p-2 rounded-md bg-destructive/10 border border-destructive/25 text-xs text-destructive font-medium">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>You have overdue follow-up tasks for this prospect!</span>
                      </div>
                    )}
                    {active.map((f) => (
                      <div
                        key={f.id}
                        className={cn(
                          "p-2.5 rounded-lg border flex flex-col gap-1.5 transition-colors",
                          f.isOverdue
                            ? "border-destructive/40 bg-destructive/5"
                            : "border-border bg-surface"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">
                              Step #{f.stepNumber}
                            </span>
                            {f.isOverdue ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-destructive text-destructive-foreground">
                                Overdue
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">
                                Scheduled
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {formatDate(f.scheduledFor)}
                          </span>
                        </div>

                        {f.notes && (
                          <p className="text-muted-foreground text-[11px] italic">
                            &ldquo;{f.notes}&rdquo;
                          </p>
                        )}

                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/50">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                            onClick={() => handleCancelFollowUp(f.id)}
                            title="Cancel follow-up"
                          >
                            <X className="h-3 w-3 mr-0.5" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2.5 text-[11px] text-success border-success/30 hover:bg-success/10"
                            onClick={() => handleCompleteFollowUp(f.id)}
                            title="Mark follow-up completed"
                          >
                            <Check className="h-3 w-3 mr-0.5" /> Complete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* History Toggle for Completed / Cancelled */}
              {(() => {
                const history = followUps.filter((f) => f.status !== "SCHEDULED");
                if (history.length === 0) return null;

                return (
                  <div className="pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setShowFollowUpHistory(!showFollowUpHistory)}
                      className="w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground font-medium"
                    >
                      <span>Follow-Up History ({history.length})</span>
                      <span>{showFollowUpHistory ? "Hide" : "Show"}</span>
                    </button>
                    {showFollowUpHistory && (
                      <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                        {history.map((h) => (
                          <div
                            key={h.id}
                            className="p-2 rounded bg-surface/50 border border-border/60 text-[11px] flex items-center justify-between"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase",
                                  h.status === "SENT"
                                    ? "bg-success/15 text-success"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {h.status === "SENT" ? "Completed" : "Cancelled"}
                              </span>
                              <span className="text-foreground">Step #{h.stepNumber}</span>
                            </div>
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {formatDate(h.sentAt || h.scheduledFor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

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
                <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                Tailored Outreach Pitch
              </CardTitle>
              <CardDescription className="text-[11px]">
                Review website audit findings and generate a fact-grounded cold pitch.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs gap-1.5"
                onClick={() => setActiveTab("personalization")}
              >
                <PenLine className="h-3.5 w-3.5" />
                <span>Open Outreach Studio</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
