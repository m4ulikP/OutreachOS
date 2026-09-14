"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { X } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar className="h-screen sticky top-0" />
      </div>

      {/* Mobile Drawer Backdrop & Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex flex-col w-64 max-w-[80vw] bg-card h-full z-10 border-r border-border shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="absolute right-2.5 top-3">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Sidebar className="w-full h-full border-r-0" />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <TopNav onMobileMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
