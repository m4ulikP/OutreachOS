"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  children,
  title,
  description,
  className,
}: DialogProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity animate-in fade-in"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-desc" : undefined}
        className={cn(
          "relative z-50 w-full max-w-lg rounded-xl border border-border bg-surface-elevated p-6 shadow-md animate-in zoom-in-95 duration-150",
          className
        )}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm text-foreground-muted opacity-70 transition-opacity hover:opacity-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        {(title || description) && (
          <div className="mb-4 space-y-1">
            {title && (
              <h2 id="dialog-title" className="text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p id="dialog-desc" className="text-xs text-foreground-muted">
                {description}
              </p>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
