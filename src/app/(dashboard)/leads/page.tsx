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
  const [error, setError] = React.useState<string | null>(null);

  const [filters, setFilters] = React.useState<FilterState>(DEFAULT_FILTERS);

  // Modals
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [editLead, setEditLead] = React.useState<LeadItem | null>(null);
  const [deleteLeadTarget, setDeleteLeadTarget] = React.useState<LeadItem | null>(null);

  const fetchLeads = React.useCallback(async () => {
    setLoading(true);
    setError(null);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error fetching leads";
      setError(msg);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
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
          className="gap-1.5 text-xs shrink-0"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add Lead
        </Button>
      </div>

      {/* Filter Bar */}
      <LeadFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-2 rounded-lg border border-border p-4 bg-card">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : leads.length === 0 ? (
        /* Empty State */
        <EmptyState
          icon={<Users className="h-6 w-6" />}
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
                <UserPlus className="h-3.5 w-3.5" />
                Add First Lead
              </Button>
            )
          }
          className="py-16"
        />
      ) : (
        /* Data Table */
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name & Title</TableHead>
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
                      <div className="flex flex-col">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-semibold text-foreground hover:underline flex items-center gap-1.5"
                        >
                          {lead.fullName}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {lead.jobTitle || "—"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-foreground font-medium">
                        {lead.company?.name || "—"}
                      </span>
                    </TableCell>

                    <TableCell>
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[150px]">{lead.email}</span>
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
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(lead.lastInteractionAt)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground">
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
                          title="Edit Lead"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteLeadTarget(lead)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Delete Lead"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <div>
                Page {page} of {totalPages} ({total} total leads)
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="h-8 px-2.5 gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="h-8 px-2.5 gap-1"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
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
