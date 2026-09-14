"use client";

import * as React from "react";
import { AlertCircle, Terminal, Copy, Check, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
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
      className="relative overflow-hidden rounded-lg border border-amber-500/25 bg-amber-500/[0.04] dark:bg-amber-950/20 p-4 transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-foreground tracking-tight">
                PostgreSQL Connection Required
              </h3>
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                Setup Needed
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              OutreachOS is running in preview mode. Start your PostgreSQL database container or configure{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
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
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-xs hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Copy Docker command to clipboard"
          >
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="font-mono text-[11px]">{dockerCommand}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            )}
          </button>

          {error && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              aria-expanded={showDetails}
            >
              <span>{showDetails ? "Hide Details" : "Details"}</span>
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
        <div className="mt-3 pt-3 border-t border-amber-500/15 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Diagnostic Log
            </span>
          </div>
          <pre className="rounded bg-muted/70 p-2.5 font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40 border border-border">
            {error}
          </pre>
        </div>
      )}
    </div>
  );
}
