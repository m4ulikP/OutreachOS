"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export interface LeadDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  leadId: string;
  onSuccess: () => void;
}

export function LeadDeleteDialog({
  open,
  onOpenChange,
  leadName,
  leadId,
  onSuccess,
}: LeadDeleteDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete lead");
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete lead";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Lead"
      description="Are you sure you want to delete this lead? This action cannot be undone."
      className="max-w-md"
    >
      <div className="space-y-4 pt-2">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-xs text-foreground-muted">
          You are about to permanently delete <strong className="text-foreground">{leadName}</strong> and all associated audit interactions from your pipeline.
        </p>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Confirm Delete"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
