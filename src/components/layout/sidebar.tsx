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
} from "lucide-react";

export const NAV_ITEMS = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Client Finder",
    href: "/finder",
    icon: Search,
  },
  {
    name: "Leads",
    href: "/leads",
    icon: Users,
  },
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
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col w-64 border-r border-border bg-card/80 backdrop-blur-md shrink-0 select-none",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center px-5 border-b border-border gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs tracking-wider shadow-sm">
          OS
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm tracking-tight text-foreground">
            OutreachOS
          </span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
            Sales Engine
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </div>
        {NAV_ITEMS.map((item) => {
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
                "group flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors",
                isActive
                  ? "bg-secondary text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span>{item.name}</span>
              </div>
              {isActive && (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-md bg-muted/40 border border-border/50">
          <div className="flex h-7 w-7 rounded-full bg-primary/10 text-primary items-center justify-center font-semibold text-xs border border-border">
            AV
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-semibold text-foreground truncate">
              Alex Vance
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              Freelance Consultant
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
