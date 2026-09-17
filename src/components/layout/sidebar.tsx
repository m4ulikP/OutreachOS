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
  Calendar,
  PenLine,
  BarChart3,
  Settings,
  Command,
  ChevronRight,
  PlusCircle,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface SidebarProps {
  className?: string;
  user?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Workspace",
    items: [
      {
        name: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
      },
      {
        name: "Leads",
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
    title: "Outreach",
    items: [
      {
        name: "Campaigns",
        href: "/campaigns",
        icon: Send,
      },
      {
        name: "Personalization",
        href: "/personalization",
        icon: PenLine,
      },
      {
        name: "Meetings",
        href: "/meetings",
        icon: Calendar,
      },
    ],
  },
  {
    title: "Reports & System",
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

export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export function Sidebar({ className, user }: SidebarProps) {
  const pathname = usePathname();

  const displayName = user?.name || user?.email?.split("@")[0] || "Maulik Pandey";
  const displayEmail = user?.email || "maulik@outreachos.dev";
  const initials = (
    displayName
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2) || "MP"
  ).toUpperCase();

  return (
    <aside
      className={cn(
        "flex flex-col w-64 border-r border-border bg-surface shrink-0 select-none",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-border bg-surface">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs tracking-wider shadow-xs transition-transform group-hover:scale-105">
            OS
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-foreground leading-none">
              OutreachOS
            </span>
            <span className="text-[10px] text-foreground-muted font-medium tracking-tight mt-0.5">
              Freelancer Sales Studio
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-1 text-[10px] font-mono text-foreground-muted bg-surface-elevated px-1.5 py-0.5 rounded border border-border">
          <Command className="h-2.5 w-2.5" />
          <span>K</span>
        </div>
      </div>

      {/* Quick Action Button */}
      <div className="px-3 pt-3 pb-1">
        <Link
          href="/leads"
          className="flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary-hover transition-all shadow-xs active:scale-[0.98]"
        >
          <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Capture Lead</span>
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto" aria-label="Main Navigation">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted/80">
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
                      ? "bg-primary/10 text-foreground font-semibold border-l-2 border-primary pl-2 shadow-2xs"
                      : "text-foreground-muted hover:bg-surface-elevated hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-primary"
                          : "text-foreground-muted group-hover:text-foreground"
                      )}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-semibold">
                      {item.badge}
                    </span>
                  ) : isActive ? (
                    <ChevronRight className="h-3 w-3 text-primary shrink-0" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-border bg-surface">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md bg-surface-elevated border border-border">
          <div className="flex h-7 w-7 rounded-full bg-primary/15 text-primary items-center justify-center font-bold text-xs border border-primary/25 shrink-0">
            {initials}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-foreground truncate leading-tight">
              {displayName}
            </span>
            <span className="text-[10px] text-foreground-muted truncate leading-tight mt-0.5">
              {displayEmail}
            </span>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out of OutreachOS"
            className="p-1 text-foreground-muted hover:text-danger rounded hover:bg-surface transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
