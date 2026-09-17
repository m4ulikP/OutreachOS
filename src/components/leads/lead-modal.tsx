"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LeadStage, TagType } from "@prisma/client";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";

export interface LeadFormData {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
  website: string;
  linkedInUrl: string;
  companyName: string;
  companyDomain: string;
  companySize: string;
  industry: string;
  location: string;
  stage: LeadStage;
  tagType: TagType;
  notes: string;
}

const INITIAL_FORM: LeadFormData = {
  firstName: "",
  lastName: "",
  jobTitle: "",
  email: "",
  phone: "",
  website: "",
  linkedInUrl: "",
  companyName: "",
  companyDomain: "",
  companySize: "",
  industry: "",
  location: "",
  stage: LeadStage.NEW,
  tagType: TagType.WARM,
  notes: "",
};

export interface LeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editLead?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    jobTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    linkedInUrl?: string | null;
    companyName?: string | null;
    companyDomain?: string | null;
    companySize?: string | null;
    industry?: string | null;
    location?: string | null;
    stage: LeadStage;
    notes?: string | null;
  };
}

export function LeadModal({
  open,
  onOpenChange,
  onSuccess,
  editLead,
}: LeadModalProps) {
  const [form, setForm] = React.useState<LeadFormData>(INITIAL_FORM);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (editLead) {
      setForm({
        firstName: editLead.firstName || "",
        lastName: editLead.lastName || "",
        jobTitle: editLead.jobTitle || "",
        email: editLead.email || "",
        phone: editLead.phone || "",
        website: editLead.website || "",
        linkedInUrl: editLead.linkedInUrl || "",
        companyName: editLead.companyName || "",
        companyDomain: editLead.companyDomain || "",
        companySize: editLead.companySize || "",
        industry: editLead.industry || "",
        location: editLead.location || "",
        stage: editLead.stage,
        tagType: TagType.WARM,
        notes: editLead.notes || "",
      });
    } else {
      setForm(INITIAL_FORM);
    }
    setError(null);
    setDuplicateWarning(null);
  }, [editLead, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDuplicateWarning(null);

    // Client-side validation:
    // 1. Email format if provided
    if (form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        setError("Please enter a valid email address format.");
        return;
      }
    }

    // 2. LinkedIn format if provided
    if (form.linkedInUrl.trim()) {
      const val = form.linkedInUrl.trim();
      const withProto = val.startsWith("http://") || val.startsWith("https://") ? val : `https://${val}`;
      try {
        const parsed = new URL(withProto);
        if (!parsed.hostname.toLowerCase().includes("linkedin.com")) {
          setError("LinkedIn URL must be a valid linkedin.com profile URL.");
          return;
        }
      } catch {
        setError("Please enter a valid LinkedIn URL.");
        return;
      }
    }

    // 3. Minimum identity info required
    if (
      !form.firstName.trim() &&
      !form.lastName.trim() &&
      !form.email.trim() &&
      !form.linkedInUrl.trim()
    ) {
      setError("Please provide at least a name, email, or LinkedIn URL for this lead.");
      return;
    }

    setLoading(true);

    try {
      const isEdit = Boolean(editLead?.id);
      const url = isEdit ? `/api/leads/${editLead!.id}` : "/api/leads";
      const method = isEdit ? "PATCH" : "POST";

      // Construct clean payload strictly adhering to server schema
      const payload: Record<string, unknown> = {};

      if (form.firstName.trim()) payload.firstName = form.firstName.trim();
      if (form.lastName.trim()) payload.lastName = form.lastName.trim();
      if (form.jobTitle.trim()) payload.jobTitle = form.jobTitle.trim();
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.website.trim()) payload.website = form.website.trim();
      if (form.linkedInUrl.trim()) payload.linkedInUrl = form.linkedInUrl.trim();
      if (form.companyName.trim()) payload.companyName = form.companyName.trim();
      if (form.companyDomain.trim()) payload.companyDomain = form.companyDomain.trim();
      if (form.companySize.trim()) payload.companySize = form.companySize.trim();
      if (form.industry.trim()) payload.industry = form.industry.trim();
      if (form.location.trim()) payload.location = form.location.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();
      payload.stage = form.stage;

      if (!isEdit && form.tagType) {
        payload.tagType = form.tagType;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.deduplication) {
          setDuplicateWarning(data.deduplication.reason || "A duplicate lead already exists in your workspace.");
          setLoading(false);
          return;
        }
        const errorMsg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || data.message || "Failed to save lead";
        throw new Error(errorMsg);
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editLead ? "Edit Lead Profile" : "Add New Prospect"}
      description={
        editLead
          ? "Update contact details, pipeline stage, and notes."
          : "Create a prospect record. Server-side deduplication will check email, LinkedIn, and name."
      }
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger animate-in fade-in duration-150"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {duplicateWarning && (
          <div
            role="alert"
            className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-xs text-warning animate-in fade-in duration-150"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-semibold">Duplicate Lead Detected: </span>
              <span>{duplicateWarning}</span>
            </div>
          </div>
        )}

        {/* Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="First Name"
            name="firstName"
            autoComplete="given-name"
            placeholder="e.g. Sarah…"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            disabled={loading}
          />
          <Input
            label="Last Name"
            name="lastName"
            autoComplete="family-name"
            placeholder="e.g. Connor…"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            disabled={loading}
          />
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Email Address"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="sarah@example.com…"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={loading}
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            spellCheck={false}
            placeholder="+1 (555) 019-2834…"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            disabled={loading}
          />
        </div>

        {/* Job Title & Company */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Job Title"
            name="jobTitle"
            placeholder="e.g. VP of Product…"
            value={form.jobTitle}
            onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            disabled={loading}
          />
          <Input
            label="Company Name"
            name="companyName"
            autoComplete="organization"
            placeholder="e.g. Acme Corp…"
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            disabled={loading}
          />
        </div>

        {/* LinkedIn & Website */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="LinkedIn Profile URL"
            name="linkedInUrl"
            type="url"
            spellCheck={false}
            placeholder="https://linkedin.com/in/sarah-connor…"
            value={form.linkedInUrl}
            onChange={(e) => setForm({ ...form, linkedInUrl: e.target.value })}
            disabled={loading}
          />
          <Input
            label="Website or Domain"
            name="website"
            type="url"
            spellCheck={false}
            placeholder="https://acme.com…"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            disabled={loading}
          />
        </div>

        {/* Industry, Location & Company Size */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Industry"
            name="industry"
            placeholder="e.g. B2B SaaS…"
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            disabled={loading}
          />
          <Input
            label="Location"
            name="location"
            placeholder="e.g. Austin, TX…"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            disabled={loading}
          />
          <Select
            label="Company Size"
            name="companySize"
            value={form.companySize}
            onChange={(e) => setForm({ ...form, companySize: e.target.value })}
            disabled={loading}
          >
            <option value="">Select size</option>
            <option value="1-10">1-10 employees</option>
            <option value="11-50">11-50 employees</option>
            <option value="51-200">51-200 employees</option>
            <option value="201-500">201-500 employees</option>
            <option value="500+">500+ employees</option>
          </Select>
        </div>

        {/* Stage & Temperature */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Pipeline Stage"
            name="stage"
            value={form.stage}
            onChange={(e) => setForm({ ...form, stage: e.target.value as LeadStage })}
            disabled={loading}
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

          {!editLead && (
            <Select
              label="Initial Temperature"
              name="tagType"
              value={form.tagType}
              onChange={(e) => setForm({ ...form, tagType: e.target.value as TagType })}
              disabled={loading}
            >
              <option value={TagType.HOT}>HOT (Active buying intent)</option>
              <option value={TagType.WARM}>WARM (Standard prospect)</option>
              <option value={TagType.COLD}>COLD (Long-term nurture)</option>
              <option value={TagType.FOLLOW_UP_NEEDED}>FOLLOW_UP_NEEDED</option>
              <option value={TagType.CLIENT}>CLIENT (Active client)</option>
            </Select>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground" htmlFor="leadNotesInput">
            Prospect Notes & Context
          </label>
          <textarea
            id="leadNotesInput"
            name="notes"
            rows={3}
            placeholder="Specific freelance opportunities, project budget notes, tech stack details…"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            disabled={loading}
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving…</span>
              </>
            ) : editLead ? (
              "Update Lead"
            ) : (
              "Create Lead"
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
