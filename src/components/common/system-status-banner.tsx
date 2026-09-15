"use client";

import * as React from "react";
import { AlertCircle, Terminal, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SystemStatusBannerProps {
  error?: string | null;
}

export function SystemStatusBanner({ error }: SystemStatusBannerProps) {
  const [copied, setCopied] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);

  const dockerCommand = "docker compose up -d";

  const handleCopy = () => {
    navigator.clipboard.writeText(dockerCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative overflow-hidden rounded-md border border-warning/30 bg-warning-tint p-3.5 transition-all text-xs text-foreground"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-warning/15 text-warning">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-foreground tracking-tight">
                PostgreSQL connection required
              </h3>
              <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-medium bg-warning/20 text-warning">
                Setup needed
              </span>
            </div>
            <p className="text-xs text-foreground-muted mt-0.5 leading-relaxed">
              OutreachOS is running in preview mode. Start your PostgreSQL database container or configure{" "}
              <code className="rounded bg-surface-elevated px-1 py-0.2 font-mono text-[11px] text-foreground border border-border">
                DATABASE_URL
              </code>{" "}
              in your environment to persist leads.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-elevated transition-colors focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
            aria-label="Copy Docker command to clipboard"
          >
            <Terminal className="h-3.5 w-3.5 text-foreground-muted" aria-hidden="true" />
            <span className="font-mono text-[11px]">{dockerCommand}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-foreground-muted" aria-hidden="true" />
            )}
          </button>

          {error && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="h-7 px-2 text-xs text-foreground-muted hover:text-foreground gap-1"
              aria-expanded={showDetails}
            >
              <span>{showDetails ? "Hide details" : "Details"}</span>
              {showDetails ? (
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible Technical Error Diagnostics */}
      {showDetails && error && (
        <div className="mt-3 pt-3 border-t border-warning/20 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
              Diagnostic log
            </span>
          </div>
          <pre className="rounded bg-surface-elevated p-2.5 font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40 border border-border">
            {error}
          </pre>
        </div>
      )}
    </div>
  );
}
