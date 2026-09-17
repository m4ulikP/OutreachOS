"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { LeadStageBadge, TemperatureBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadFilters, FilterState } from "@/components/leads/lead-filters";
import { LeadModal } from "@/components/leads/lead-modal";
import { LeadDeleteDialog } from "@/components/leads/lead-delete-dialog";
import { BulkActionBar } from "@/components/leads/bulk-action-bar";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  UserPlus,
  Users,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  ExternalLink,
  Mail,
  AlertCircle,
  Copy,
  Check,
  Search,
  Building,
  Calendar,
  Layers,
} from "lucide-react";
import { LeadStage, TagType } from "@prisma/client";

interface LeadItem {
  id: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedInUrl?: string | null;
  stage: LeadStage;
  notes?: string | null;
  createdAt: string;
  lastInteractionAt?: string | null;
  company?: {
    id: string;
    name: string;
    domain?: string | null;
    industry?: string | null;
  } | null;
  tagAssignments?: {
    tag: {
      id: string;
      type: TagType;
      name: string;
    };
  }[];
}

interface TagItem {
  id: string;
  name: string;
  type: TagType;
}

const DEFAULT_FILTERS: FilterState = {
  search: "",
  stage: "",
  temperature: "",
  tag: "",
  company: "",
  createdAfter: "",
  createdBefore: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};

const STAGE_CONFIG: { stage: string; label: string; key: LeadStage | "ALL" }[] = [
  { stage: "", label: "All Prospects", key: "ALL" },
  { stage: LeadStage.NEW, label: "New", key: LeadStage.NEW },
  { stage: LeadStage.CONTACTED, label: "Contacted", key: LeadStage.CONTACTED },
  { stage: LeadStage.FOLLOW_UP, label: "Follow-up", key: LeadStage.FOLLOW_UP },
  { stage: LeadStage.REPLIED, label: "Replied", key: LeadStage.REPLIED },
  { stage: LeadStage.POSITIVE_REPLY, label: "Positive Reply", key: LeadStage.POSITIVE_REPLY },
  { stage: LeadStage.MEETING_SCHEDULED, label: "Discovery Call", key: LeadStage.MEETING_SCHEDULED },
  { stage: LeadStage.CLIENT, label: "Client Won", key: LeadStage.CLIENT },
  { stage: LeadStage.CLOSED_LOST, label: "Closed Lost", key: LeadStage.CLOSED_LOST },
];

export default function LeadsPage() {
  const [leads, setLeads] = React.useState<LeadItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [dbError, setDbError] = React.useState<boolean>(false);
  const [copiedEmailId, setCopiedEmailId] = React.useState<string | null>(null);

  // Tenant-scoped stage counts for ribbon
  const [stageCounts, setStageCounts] = React.useState<Record<LeadStage, number>>({
    NEW: 0,
    CONTACTED: 0,
    FOLLOW_UP: 0,
    REPLIED: 0,
    POSITIVE_REPLY: 0,
    MEETING_SCHEDULED: 0,
    CLIENT: 0,
    CLOSED_LOST: 0,
  });

  // Available tags for filters and bulk actions
  const [availableTags, setAvailableTags] = React.useState<TagItem[]>([]);

  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Filter state
  const [filters, setFilters] = React.useState<FilterState>(DEFAULT_FILTERS);

  // Debounced search query
  const [debouncedSearch, setDebouncedSearch] = React.useState(filters.search);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => clearTimeout(handler);
  }, [filters.search]);

  // Sync stage if query parameter is in URL on mount
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const paramStage = new URLSearchParams(window.location.search).get("stage");
      if (paramStage) {
        setFilters((prev) => ({ ...prev, stage: paramStage }));
      }
    }
  }, []);

  // Fetch available tags once on mount
  React.useEffect(() => {
    async function loadTags() {
      try {
        const res = await fetch("/api/tags");
        if (res.ok) {
          const data = await res.json();
          setAvailableTags(data.tags || []);
        }
      } catch {
        // Non-fatal if tags fail to load
      }
    }
    loadTags();
  }, []);

  // Modals
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [editLead, setEditLead] = React.useState<LeadItem | null>(null);
  const [deleteLeadTarget, setDeleteLeadTarget] = React.useState<LeadItem | null>(null);

  const fetchLeads = React.useCallback(async () => {
    setLoading(true);
    setDbError(false);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });

      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filters.stage) params.set("stage", filters.stage);
      if (filters.temperature) params.set("temperature", filters.temperature);
      if (filters.tag) params.set("tag", filters.tag);
      if (filters.company) params.set("companyName", filters.company);
      if (filters.createdAfter) params.set("createdAfter", filters.createdAfter);
      if (filters.createdBefore) params.set("createdBefore", filters.createdBefore);

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load leads from database");
      }

      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);

      if (data.stageCounts) {
        setStageCounts(data.stageCounts);
      }
    } catch {
      setDbError(true);
      setLeads([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters.sortBy, filters.sortOrder, filters.stage, filters.temperature, filters.tag, filters.company, filters.createdAfter, filters.createdBefore, debouncedSearch]);

  React.useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Clean selection if leads change or page changes
  React.useEffect(() => {
    setSelectedIds([]);
  }, [page, filters.stage]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  // Selection handlers
  const handleSelectAllOnPage = () => {
    if (selectedIds.length === leads.length && leads.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map((l) => l.id));
    }
  };

  const handleToggleSelectLead = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCopyEmail = (leadId: string, email: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopiedEmailId(leadId);
    setTimeout(() => {
      setCopiedEmailId(null);
    }, 1800);
  };

  // Calculate global pipeline total across all stages
  const totalPipelineCount = React.useMemo(() => {
    return Object.values(stageCounts).reduce((acc, count) => acc + count, 0);
  }, [stageCounts]);

  const isAllOnPageSelected = leads.length > 0 && selectedIds.length === leads.length;

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-foreground-muted mb-0.5">
            <span className="font-semibold text-foreground">Pipeline</span>
            <span>•</span>
            <span className="tabular-nums font-mono">
              {totalPipelineCount} total prospects tracked
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Lead Management
          </h1>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link href="/finder">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Search className="h-3.5 w-3.5 text-foreground-muted" aria-hidden="true" />
              Find prospects
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => {
              setEditLead(null);
              setAddModalOpen(true);
            }}
            className="h-8 gap-1.5 text-xs"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Add lead
          </Button>
        </div>
      </div>

      {/* Stage Navigation Ribbon with Live Tenant Counts */}
      <div
        role="tablist"
        aria-label="Lead stages"
        className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-border scrollbar-none"
      >
        {STAGE_CONFIG.map((tab) => {
          const isActive = filters.stage === tab.stage;
          const count =
            tab.key === "ALL" ? totalPipelineCount : stageCounts[tab.key] || 0;

          return (
            <button
              key={tab.label}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setFilters((prev) => ({ ...prev, stage: tab.stage }));
                setPage(1);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all select-none",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-foreground-muted hover:bg-surface-elevated hover:text-foreground"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground font-bold"
                    : "bg-surface-elevated border border-border/80 text-foreground-muted"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar (Search, Temperature, Tag, Company, Date, Sort) */}
      <LeadFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
        availableTags={availableTags}
      />

      {/* Content Area */}
      {loading ? (
        <div className="space-y-2.5 rounded-xl border border-border p-4 bg-card">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : dbError ? (
        /* Database Offline / Connection Error */
        <EmptyState
          icon={<AlertCircle className="h-6 w-6 text-warning" aria-hidden="true" />}
          title="Database Connection Needed"
          description="OutreachOS requires an active PostgreSQL database to store and query leads. Please verify your connection status."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLeads}
              className="text-xs"
            >
              Retry Connection
            </Button>
          }
          className="py-16"
        />
      ) : leads.length === 0 ? (
        /* Empty State */
        <EmptyState
          icon={<Users className="h-6 w-6" aria-hidden="true" />}
          title={
            filters.search || filters.stage || filters.temperature || filters.tag || filters.company
              ? "No prospects match your filter criteria"
              : "Maulik, your lead pipeline is empty"
          }
          description={
            filters.search || filters.stage || filters.temperature || filters.tag || filters.company
              ? "Try broadening your search query or selecting a different stage tab above."
              : "Capture prospects manually or discover target clients in the Client Finder to begin booking meetings."
          }
          action={
            filters.search || filters.stage || filters.temperature || filters.tag || filters.company ? (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Reset All Filters
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/finder">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    Discover Targets
                  </Button>
                </Link>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditLead(null);
                    setAddModalOpen(true);
                  }}
                  className="gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add First Prospect
                </Button>
              </div>
            )
          }
          className="py-16"
        />
      ) : (
        /* Lead Data Presentation */
        <div className="space-y-3">
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Select All Checkbox */}
                  <TableHead className="w-10 px-3">
                    <input
                      type="checkbox"
                      aria-label="Select all leads on current page"
                      checked={isAllOnPageSelected}
                      onChange={handleSelectAllOnPage}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="w-[230px]">Prospect & Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact Channel</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Temperature & Tags</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="text-right w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const tempTag = lead.tagAssignments?.[0]?.tag?.type || "WARM";
                  const isCopied = copiedEmailId === lead.id;
                  const isSelected = selectedIds.includes(lead.id);

                  return (
                    <TableRow
                      key={lead.id}
                      className={cn(
                        "group transition-colors",
                        isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                      )}
                    >
                      {/* Selection Checkbox */}
                      <TableCell className="px-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${lead.fullName}`}
                          checked={isSelected}
                          onChange={() => handleToggleSelectLead(lead.id)}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                        />
                      </TableCell>

                      {/* Name & Title */}
                      <TableCell className="font-medium">
                        <div className="flex flex-col min-w-0">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="font-semibold text-foreground hover:underline flex items-center gap-1.5 truncate"
                          >
                            <span>{lead.fullName}</span>
                            <ExternalLink
                              className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
                              aria-hidden="true"
                            />
                          </Link>
                          <span className="text-xs text-muted-foreground truncate">
                            {lead.jobTitle || "Freelance Prospect"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Company */}
                      <TableCell>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-foreground font-semibold truncate max-w-[150px]">
                            {lead.company?.name || "Independent"}
                          </span>
                          {lead.company?.industry && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {lead.company.industry}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Email + Quick Copy */}
                      <TableCell>
                        {lead.email ? (
                          <div className="flex items-center gap-1.5 max-w-[180px]">
                            <a
                              href={`mailto:${lead.email}`}
                              className="text-xs text-foreground-muted hover:text-foreground truncate"
                            >
                              {lead.email}
                            </a>
                            <button
                              type="button"
                              onClick={(e) => handleCopyEmail(lead.id, lead.email!, e)}
                              className="p-1 rounded text-foreground-subtle hover:text-foreground hover:bg-surface-elevated transition-colors shrink-0"
                              title="Copy email"
                              aria-label={`Copy email for ${lead.fullName}`}
                            >
                              {isCopied ? (
                                <Check className="h-3 w-3 text-success" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-foreground-subtle">—</span>
                        )}
                      </TableCell>

                      {/* Stage */}
                      <TableCell>
                        <LeadStageBadge stage={lead.stage} />
                      </TableCell>

                      {/* Temperature & Tags */}
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <TemperatureBadge temperature={tempTag} />
                          {lead.tagAssignments &&
                            lead.tagAssignments
                              .filter((ta) => ta.tag.name && ta.tag.type === "CUSTOM")
                              .slice(0, 2)
                              .map((ta) => (
                                <span
                                  key={ta.tag.id}
                                  className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-[10px] text-foreground-muted truncate max-w-[90px]"
                                >
                                  {ta.tag.name}
                                </span>
                              ))}
                        </div>
                      </TableCell>

                      {/* Last Activity */}
                      <TableCell>
                        <span className="text-xs text-foreground-subtle tabular-nums font-mono">
                          {formatRelativeTime(lead.lastInteractionAt || lead.createdAt)}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditLead(lead);
                              setAddModalOpen(true);
                            }}
                            className="h-7 w-7 text-foreground-muted hover:text-foreground"
                            aria-label={`Edit prospect ${lead.fullName}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteLeadTarget(lead)}
                            className="h-7 w-7 text-foreground-muted hover:text-danger"
                            aria-label={`Delete prospect ${lead.fullName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Responsive Card View */}
          <div className="md:hidden space-y-2.5">
            <div className="flex items-center justify-between px-1 text-xs text-foreground-muted">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAllOnPageSelected}
                  onChange={handleSelectAllOnPage}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span>Select all on page</span>
              </label>
              <span className="font-mono tabular-nums">{leads.length} leads</span>
            </div>

            {leads.map((lead) => {
              const tempTag = lead.tagAssignments?.[0]?.tag?.type || "WARM";
              const isSelected = selectedIds.includes(lead.id);

              return (
                <div
                  key={lead.id}
                  className={cn(
                    "p-3.5 rounded-xl border bg-card space-y-2.5 transition-colors",
                    isSelected ? "border-primary/50 bg-primary/5" : "border-border"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectLead(lead.id)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 mt-0.5"
                        aria-label={`Select ${lead.fullName}`}
                      />
                      <div>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-semibold text-sm text-foreground hover:underline"
                        >
                          {lead.fullName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {lead.jobTitle || "Freelance Prospect"} • {lead.company?.name || "Independent"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditLead(lead);
                          setAddModalOpen(true);
                        }}
                        className="h-7 w-7 text-foreground-muted"
                        aria-label={`Edit ${lead.fullName}`}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteLeadTarget(lead)}
                        className="h-7 w-7 text-foreground-muted hover:text-danger"
                        aria-label={`Delete ${lead.fullName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <LeadStageBadge stage={lead.stage} />
                      <TemperatureBadge temperature={tempTag} />
                    </div>
                    <span className="text-[11px] text-foreground-muted tabular-nums">
                      {formatRelativeTime(lead.lastInteractionAt || lead.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination & Page Size Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
            <div className="flex items-center gap-2">
              <span className="tabular-nums font-mono">
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, total)} of {total} leads
              </span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <span className="text-foreground-muted">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-7 rounded border border-border bg-surface px-1.5 text-xs text-foreground"
                  aria-label="Leads per page"
                >
                  <option value="15">15</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-8 px-2.5 gap-1"
                aria-label="Go to previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Previous
              </Button>
              <span className="px-2 font-mono tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="h-8 px-2.5 gap-1"
                aria-label="Go to next page"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        onSuccess={fetchLeads}
        availableTags={availableTags}
      />

      {/* Add / Edit Lead Modal */}
      <LeadModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={fetchLeads}
        editLead={
          editLead
            ? {
                id: editLead.id,
                firstName: editLead.firstName,
                lastName: editLead.lastName,
                jobTitle: editLead.jobTitle,
                email: editLead.email,
                phone: editLead.phone,
                website: editLead.website,
                linkedInUrl: editLead.linkedInUrl,
                companyName: editLead.company?.name,
                companyDomain: editLead.company?.domain,
                industry: editLead.company?.industry,
                stage: editLead.stage,
                notes: editLead.notes,
              }
            : undefined
        }
      />

      {/* Delete Confirmation Dialog */}
      {deleteLeadTarget && (
        <LeadDeleteDialog
          open={Boolean(deleteLeadTarget)}
          onOpenChange={(open) => !open && setDeleteLeadTarget(null)}
          leadName={deleteLeadTarget.fullName}
          leadId={deleteLeadTarget.id}
          onSuccess={() => {
            setDeleteLeadTarget(null);
            fetchLeads();
          }}
        />
      )}
    </div>
  );
}
