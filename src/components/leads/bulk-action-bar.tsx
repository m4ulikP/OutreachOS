"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { LeadStage } from "@prisma/client";
import {
  CheckSquare,
  Layers,
  Tag,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export interface BulkActionBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onSuccess: () => void;
  availableTags?: { id: string; name: string }[];
}

export function BulkActionBar({
  selectedIds,
  onClearSelection,
  onSuccess,
  availableTags = [],
}: BulkActionBarProps) {
  const [loading, setLoading] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Clear feedback after 4 seconds
  React.useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  if (selectedIds.length === 0) return null;

  const count = selectedIds.length;

  const executeBulkAction = async (payload: {
    action: "UPDATE_STAGE" | "ASSIGN_TAG" | "REMOVE_TAG" | "DELETE";
    stage?: LeadStage;
    tagId?: string;
  }) => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: payload.action,
          leadIds: selectedIds,
          stage: payload.stage,
          tagId: payload.tagId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || data.message || "Bulk operation failed";
        throw new Error(errorMsg);
      }

      setFeedback({
        type: "success",
        message: `Successfully updated ${data.affectedCount || count} lead${
          (data.affectedCount || count) > 1 ? "s" : ""
        }.`,
      });
      onSuccess();
      onClearSelection();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bulk operation failed";
      setFeedback({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = (stage: string) => {
    if (!stage) return;
    executeBulkAction({ action: "UPDATE_STAGE", stage: stage as LeadStage });
  };

  const handleAssignTag = (tagId: string) => {
    if (!tagId) return;
    executeBulkAction({ action: "ASSIGN_TAG", tagId });
  };

  const handleRemoveTag = (tagId: string) => {
    if (!tagId) return;
    executeBulkAction({ action: "REMOVE_TAG", tagId });
  };

  const handleDelete = async () => {
    setDeleteConfirmOpen(false);
    await executeBulkAction({ action: "DELETE" });
  };

  return (
    <>
      <div
        role="region"
        aria-label="Bulk actions for selected leads"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94vw] max-w-3xl rounded-xl border border-border/80 bg-surface-elevated/95 backdrop-blur-md p-3 shadow-xl animate-in slide-in-from-bottom-4 duration-200"
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Count & Status */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold tabular-nums">
              <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{count} selected</span>
            </span>

            {feedback && (
              <span
                role="status"
                aria-live="polite"
                className={`text-xs font-medium flex items-center gap-1 truncate max-w-[220px] sm:max-w-none ${
                  feedback.type === "success" ? "text-success" : "text-danger"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                )}
                {feedback.message}
              </span>
            )}
          </div>

          {/* Action Dropdowns & Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Stage Selector */}
            <div className="flex items-center gap-1">
              <Select
                name="bulkStageSelector"
                disabled={loading}
                onChange={(e) => {
                  handleStageChange(e.target.value);
                  e.target.value = "";
                }}
                className="h-8 text-xs w-36 bg-surface border-border font-medium"
                aria-label="Change stage for selected leads"
                defaultValue=""
              >
                <option value="" disabled>
                  Update Stage…
                </option>
                <option value={LeadStage.NEW}>New</option>
                <option value={LeadStage.CONTACTED}>Contacted</option>
                <option value={LeadStage.FOLLOW_UP}>Follow-up</option>
                <option value={LeadStage.REPLIED}>Replied</option>
                <option value={LeadStage.POSITIVE_REPLY}>Positive Reply</option>
                <option value={LeadStage.MEETING_SCHEDULED}>Discovery Call</option>
                <option value={LeadStage.CLIENT}>Client Won</option>
                <option value={LeadStage.CLOSED_LOST}>Closed Lost</option>
              </Select>
            </div>

            {/* Tag Selector */}
            {availableTags.length > 0 && (
              <div className="flex items-center gap-1">
                <Select
                  name="bulkTagAssign"
                  disabled={loading}
                  onChange={(e) => {
                    handleAssignTag(e.target.value);
                    e.target.value = "";
                  }}
                  className="h-8 text-xs w-32 bg-surface border-border font-medium"
                  aria-label="Assign tag to selected leads"
                  defaultValue=""
                >
                  <option value="" disabled>
                    + Add Tag…
                  </option>
                  {availableTags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>

                <Select
                  name="bulkTagRemove"
                  disabled={loading}
                  onChange={(e) => {
                    handleRemoveTag(e.target.value);
                    e.target.value = "";
                  }}
                  className="h-8 text-xs w-32 bg-surface border-border font-medium"
                  aria-label="Remove tag from selected leads"
                  defaultValue=""
                >
                  <option value="" disabled>
                    - Remove Tag…
                  </option>
                  {availableTags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Bulk Delete */}
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => setDeleteConfirmOpen(true)}
              className="h-8 px-2.5 text-xs text-danger hover:text-danger hover:bg-danger/10 border-border"
              aria-label={`Delete ${count} selected leads`}
            >
              <Trash2 className="h-3.5 w-3.5 sm:mr-1" aria-hidden="true" />
              <span className="hidden sm:inline">Delete</span>
            </Button>

            {/* Clear Selection */}
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={onClearSelection}
              className="h-8 px-2 text-xs text-foreground-muted hover:text-foreground"
              aria-label="Clear selection"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Bulk Delete */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Selected Leads"
        description={`Are you sure you want to delete ${count} selected prospect record${
          count > 1 ? "s" : ""
        }? This action will remove their activity history and cannot be undone.`}
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/25 text-xs text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-semibold">Permanent Deletion: </span>
              <span>
                All associated interaction history, notes, and campaign tags for these {count} leads
                will be permanently deleted.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={loading}
              onClick={handleDelete}
              className="gap-1.5 bg-danger hover:bg-danger/90 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Deleting…</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Confirm Delete ({count})</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
