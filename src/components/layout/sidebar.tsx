"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  Users,
  Send,
  Sparkles,
  Calendar,
  BarChart3,
  Settings,
  ChevronRight,
  PlusCircle,
  Command,
} from "lucide-react";

export interface NavSection {
  title: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Daily Workspace",
    items: [
      {
        name: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
      },
      {
        name: "Lead Database",
        href: "/leads",
        icon: Users,
      },
      {
        name: "Client Finder",
        href: "/finder",
        icon: Search,
      },
    ],
  },
  {
    title: "Outreach Engine",
    items: [
      {
        name: "Campaigns",
        href: "/campaigns",
        icon: Send,
      },
      {
        name: "AI Personalization",
        href: "/personalization",
        icon: Sparkles,
      },
      {
        name: "Meetings",
        href: "/meetings",
        icon: Calendar,
      },
    ],
  },
  {
    title: "System & Insights",
    items: [
      {
        name: "Analytics",
        href: "/analytics",
        icon: BarChart3,
      },
      {
        name: "Settings",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
];

// Flat list for legacy or mobile references
export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col w-64 border-r border-border bg-card/90 backdrop-blur-md shrink-0 select-none",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs tracking-wider shadow-xs transition-transform group-hover:scale-105">
            OS
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-foreground leading-none">
              OutreachOS
            </span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-tight mt-0.5">
              Freelancer Sales Studio
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/60">
          <Command className="h-2.5 w-2.5" />
          <span>K</span>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="px-3 pt-3 pb-1">
        <Link
          href="/leads"
          className="flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs active:scale-[0.99]"
        >
          <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Capture Lead</span>
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto" aria-label="Main Navigation">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {section.title}
            </div>
            {section.items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-secondary text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-semibold">
                      {item.badge}
                    </span>
                  ) : isActive ? (
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-border bg-card/50">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md bg-muted/30 border border-border/50">
          <div className="flex h-7 w-7 rounded-full bg-primary/15 text-primary items-center justify-center font-bold text-xs border border-primary/20 shrink-0">
            AV
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-foreground truncate leading-tight">
              Alex Vance
            </span>
            <span className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
              Freelance Consultant
            </span>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Workspace Active" />
        </div>
      </div>
    </aside>
  );
}
