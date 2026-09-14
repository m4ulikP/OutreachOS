"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LeadStageBadge, TemperatureBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadFilters, FilterState } from "@/components/leads/lead-filters";
import { LeadModal } from "@/components/leads/lead-modal";
import { LeadDeleteDialog } from "@/components/leads/lead-delete-dialog";
import { formatDate, formatRelativeTime } from "@/lib/utils";
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
  UploadCloud,
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
      type: TagType;
      name: string;
    };
  }[];
}

const DEFAULT_FILTERS: FilterState = {
  search: "",
  stage: "",
  temperature: "",
  industry: "",
  location: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};

const STAGE_TABS: { label: string; stage: string; countKey?: string }[] = [
  { label: "All Prospects", stage: "" },
  { label: "New", stage: LeadStage.NEW },
  { label: "Contacted", stage: LeadStage.CONTACTED },
  { label: "Follow-up", stage: LeadStage.FOLLOW_UP },
  { label: "Replied", stage: LeadStage.REPLIED },
  { label: "Warm Positive", stage: LeadStage.POSITIVE_REPLY },
  { label: "Calls Booked", stage: LeadStage.MEETING_SCHEDULED },
  { label: "Clients Won", stage: LeadStage.CLIENT },
];

export default function LeadsPage() {
  const [leads, setLeads] = React.useState<LeadItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [dbError, setDbError] = React.useState<boolean>(false);
  const [copiedEmailId, setCopiedEmailId] = React.useState<string | null>(null);

  const [filters, setFilters] = React.useState<FilterState>(DEFAULT_FILTERS);

  // Sync stage if query parameter is present in URL on mount
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const paramStage = new URLSearchParams(window.location.search).get("stage");
      if (paramStage) {
        setFilters((prev) => ({ ...prev, stage: paramStage }));
      }
    }
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
        pageSize: "15",
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });

      if (filters.search) params.set("search", filters.search);
      if (filters.stage) params.set("stage", filters.stage);
      if (filters.temperature) params.set("temperature", filters.temperature);
      if (filters.industry) params.set("industry", filters.industry);
      if (filters.location) params.set("location", filters.location);

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load leads from database");
      }

      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      setDbError(true);
      setLeads([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  React.useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
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

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
            <span className="font-semibold text-foreground">Pipeline Core</span>
            <span>•</span>
            <span className="tabular-nums font-mono">{total} prospects tracked</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Lead Database
          </h1>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link href="/finder">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
              <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              Find Prospects
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => {
              setEditLead(null);
              setAddModalOpen(true);
            }}
            className="h-9 gap-1.5 text-xs"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Tactile Stage Selector Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/60 scrollbar-none">
        {STAGE_TABS.map((tab) => {
          const isActive = filters.stage === tab.stage;
          return (
            <button
              key={tab.label}
              onClick={() => {
                setFilters((prev) => ({ ...prev, stage: tab.stage }));
                setPage(1);
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors select-none",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter Bar (Search + Dropdowns) */}
      <LeadFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Content Rendering */}
      {loading ? (
        <div className="space-y-2 rounded-xl border border-border p-4 bg-card">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : dbError ? (
        /* Database Offline State */
        <EmptyState
          icon={<AlertCircle className="h-6 w-6 text-amber-500" aria-hidden="true" />}
          title="Database Connection Needed"
          description="OutreachOS requires an active PostgreSQL database to store and query leads. Start your local database with 'docker compose up -d' or configure DATABASE_URL."
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLeads}
                className="text-xs"
              >
                Retry Connection
              </Button>
            </div>
          }
          className="py-16"
        />
      ) : leads.length === 0 ? (
        /* Empty State */
        <EmptyState
          icon={<Users className="h-6 w-6" aria-hidden="true" />}
          title={
            filters.search || filters.stage || filters.temperature
              ? "No prospects match your filter criteria"
              : "Your lead pipeline is empty"
          }
          description={
            filters.search || filters.stage || filters.temperature
              ? "Try broadening your search query or selecting a different stage tab above."
              : "Capture prospects manually or discover target clients in the Client Finder."
          }
          action={
            filters.search || filters.stage || filters.temperature ? (
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
        /* Data Table with Rich Freelancer Context */
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[240px]">Prospect & Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact Channel</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Temperature</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const tempTag = lead.tagAssignments?.[0]?.tag?.type || "WARM";
                  const isCopied = copiedEmailId === lead.id;

                  return (
                    <TableRow key={lead.id} className="group hover:bg-muted/30">
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
                          <div className="flex items-center gap-1.5 max-w-[170px]">
                            <a
                              href={`mailto:${lead.email}`}
                              className="text-xs text-muted-foreground hover:text-foreground truncate"
                            >
                              {lead.email}
                            </a>
                            <button
                              type="button"
                              onClick={(e) => handleCopyEmail(lead.id, lead.email!, e)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                              title="Copy email to clipboard"
                              aria-label={`Copy email for ${lead.fullName}`}
                            >
                              {isCopied ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Stage */}
                      <TableCell>
                        <LeadStageBadge stage={lead.stage} />
                      </TableCell>

                      {/* Temperature */}
                      <TableCell>
                        <TemperatureBadge temperature={tempTag} />
                      </TableCell>

                      {/* Last Activity */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground tabular-nums font-mono">
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
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            aria-label={`Edit prospect ${lead.fullName}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteLeadTarget(lead)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <div className="tabular-nums font-mono">
                Page {page} of {totalPages} ({total} total prospects)
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
          )}
        </div>
      )}

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
