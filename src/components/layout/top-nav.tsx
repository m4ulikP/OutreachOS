"use client";

import * as React from "react";
import { Search, Bell, Menu } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export interface TopNavProps {
  onMobileMenuToggle?: () => void;
}

export function TopNav({ onMobileMenuToggle }: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-secondary text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open sidebar navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        {/* Global Search */}
        <div className="relative w-64 md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search leads, companies, notes..."
            className="h-8 w-full rounded-md border border-input bg-muted/40 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-card transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </button>

        {/* Theme switcher */}
        <ThemeToggle />

        {/* Account indicator */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border ml-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary border border-border text-foreground font-medium text-xs">
            A
          </div>
          <span className="text-xs font-medium text-foreground">
            alex@outreachos.dev
          </span>
        </div>
      </div>
    </header>
  );
}
