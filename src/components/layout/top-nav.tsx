"use client";

import * as React from "react";
import { Search, Bell, Menu, Database } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export interface TopNavProps {
  onMobileMenuToggle?: () => void;
}

export function TopNav({ onMobileMenuToggle }: TopNavProps) {
  const [dbConnected, setDbConnected] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setDbConnected(data.database?.connected ?? false);
        }
      } catch {
        setDbConnected(false);
      }
    }
    checkHealth();
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-card/85 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-secondary text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {/* Global Search */}
        <div className="relative w-64 md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            name="globalSearch"
            spellCheck={false}
            placeholder="Search leads, companies, notes…"
            className="h-8 w-full rounded-md border border-input bg-muted/40 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-card transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* System Status Pill */}
        {dbConnected !== null && (
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-border bg-secondary/60 text-muted-foreground"
            title={dbConnected ? "PostgreSQL database connected" : "Database requires configuration"}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                dbConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
              }`}
              aria-hidden="true"
            />
            <span>{dbConnected ? "DB Connected" : "DB Offline"}</span>
          </div>
        )}

        {/* Notifications */}
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="View notifications (1 unread)"
        >
          <Bell className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
        </button>

        {/* Theme switcher */}
        <ThemeToggle />

        {/* Account indicator */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border ml-1">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary border border-border text-foreground font-medium text-xs select-none"
            aria-hidden="true"
          >
            A
          </div>
          <span className="text-xs font-medium text-foreground truncate max-w-[130px]">
            alex@outreachos.dev
          </span>
        </div>
      </div>
    </header>
  );
}
