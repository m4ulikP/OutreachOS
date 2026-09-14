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
  Terminal,
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

export default function LeadsPage() {
  const [leads, setLeads] = React.useState<LeadItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [dbError, setDbError] = React.useState<boolean>(false);

  const [filters, setFilters] = React.useState<FilterState>(DEFAULT_FILTERS);

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

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Lead Database
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} total prospects tracked across all outreach stages
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditLead(null);
            setAddModalOpen(true);
          }}
          className="gap-1.5 text-xs shrink-0 self-start sm:self-auto"
        >
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Add Lead
        </Button>
      </div>

      {/* Filter Bar */}
      <LeadFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-2 rounded-lg border border-border p-4 bg-card">
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
          description="OutreachOS requires an active PostgreSQL database to store and query leads. Start your local database with 'docker compose up -d' or configure DATABASE_URL in your environment."
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
              ? "No leads matched your filters"
              : "Your lead pipeline is empty"
          }
          description={
            filters.search || filters.stage || filters.temperature
              ? "Try adjusting your search criteria or resetting filters."
              : "Start adding freelance prospects manually or discover leads in Client Finder."
          }
          action={
            filters.search || filters.stage || filters.temperature ? (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Reset Filters
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setEditLead(null);
                  setAddModalOpen(true);
                }}
                className="gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Add First Lead
              </Button>
            )
          }
          className="py-16"
        />
      ) : (
        /* Data Table */
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Name & Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Temperature</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const tempTag = lead.tagAssignments?.[0]?.tag?.type || "WARM";
                  return (
                    <TableRow key={lead.id} className="group">
                      <TableCell className="font-medium">
                        <div className="flex flex-col min-w-0">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="font-semibold text-foreground hover:underline flex items-center gap-1.5 truncate"
                          >
                            <span>{lead.fullName}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" aria-hidden="true" />
                          </Link>
                          <span className="text-xs text-muted-foreground truncate">
                            {lead.jobTitle || "—"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-foreground font-medium truncate block max-w-[160px]">
                          {lead.company?.name || "—"}
                        </span>
                      </TableCell>

                      <TableCell>
                        {lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 max-w-[160px] truncate"
                          >
                            <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{lead.email}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <LeadStageBadge stage={lead.stage} />
                      </TableCell>

                      <TableCell>
                        <TemperatureBadge temperature={tempTag} />
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatRelativeTime(lead.lastInteractionAt)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(lead.createdAt)}
                        </span>
                      </TableCell>

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
                            aria-label={`Edit lead ${lead.fullName}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteLeadTarget(lead)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Delete lead ${lead.fullName}`}
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
              <div className="tabular-nums">
                Page {page} of {totalPages} ({total} total leads)
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
