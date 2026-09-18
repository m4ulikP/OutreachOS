"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Search,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Building2,
  MapPin,
  Mail,
  Linkedin,
  Globe,
  Sparkles,
  Layers,
  Check,
} from "lucide-react";
import Link from "next/link";
import { DiscoveredLead } from "@/lib/providers/lead-source/types";

interface Archetype {
  id: string;
  name: string;
  description: string;
  jobTitle: string;
  companySize: string;
  industry: string;
  location: string;
  keywords: string;
}

const FREELANCER_ARCHETYPES: Archetype[] = [
  {
    id: "saas-founders",
    name: "SaaS founders",
    description: "Seed & Series A founders building software products",
    jobTitle: "Founder, CEO",
    companySize: "1-10",
    industry: "B2B SaaS & Cloud",
    location: "San Francisco, Remote",
    keywords: "Next.js, AI, Stripe, Hiring",
  },
  {
    id: "ecom-growth",
    name: "E-commerce growth heads",
    description: "Marketing directors scaling D2C consumer brands",
    jobTitle: "VP Marketing, Growth",
    companySize: "11-50",
    industry: "E-Commerce & D2C Retail",
    location: "Austin, United States",
    keywords: "Shopify, Klaviyo, Meta Ads",
  },
  {
    id: "agency-leaders",
    name: "Agency principals",
    description: "Creative & digital agency owners needing senior talent",
    jobTitle: "Managing Director, Creative Director",
    companySize: "1-10",
    industry: "Design & Digital Agencies",
    location: "London, Berlin",
    keywords: "Figma, Webflow, Retainers",
  },
  {
    id: "fintech-product",
    name: "Fintech product leaders",
    description: "Product leaders scaling compliance & payment rails",
    jobTitle: "Chief Product Officer, VP Engineering",
    companySize: "51-200",
    industry: "Financial Services & Payments",
    location: "San Francisco, New York",
    keywords: "Payments, Banking API, Rails",
  },
];

export default function ClientFinderPage() {
  const [jobTitle, setJobTitle] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [companyDomain, setCompanyDomain] = React.useState("");
  const [companySize, setCompanySize] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [keywords, setKeywords] = React.useState("");
  const [hasEmail, setHasEmail] = React.useState(false);
  const [hasLinkedIn, setHasLinkedIn] = React.useState(false);
  const [activeArchetype, setActiveArchetype] = React.useState<string | null>(null);

  const [searching, setSearching] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const [providerInfo, setProviderInfo] = React.useState<{
    isConfigured: boolean;
    isDevelopmentMock?: boolean;
    providerName: string;
    message?: string;
  } | null>(null);

  const [searchResults, setSearchResults] = React.useState<DiscoveredLead[]>([]);
  const [totalMatches, setTotalMatches] = React.useState(0);
  const [searchExecuted, setSearchExecuted] = React.useState(false);

  // Selection state
  const [selectedLeadIds, setSelectedLeadIds] = React.useState<Set<string>>(new Set());
  const [importedLeadIds, setImportedLeadIds] = React.useState<Set<string>>(new Set());

  // Import summary state
  const [importSummary, setImportSummary] = React.useState<{
    totalSubmitted: number;
    importedCount: number;
    alreadyExistedCount: number;
    failedCount: number;
  } | null>(null);

  // Initial provider status check
  React.useEffect(() => {
    async function checkProvider() {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setProviderInfo({
            isConfigured: data.providers?.leadSource?.isConfigured ?? false,
            isDevelopmentMock: data.providers?.leadSource?.isDevelopmentMock ?? false,
            providerName: data.providers?.leadSource?.name || "B2B Lead Source",
          });
        }
      } catch {}
    }
    checkProvider();
  }, []);

  const handleSelectArchetype = (archetype: Archetype) => {
    setActiveArchetype(archetype.id);
    setJobTitle(archetype.jobTitle);
    setCompanySize(archetype.companySize);
    setIndustry(archetype.industry);
    setLocation(archetype.location);
    setKeywords(archetype.keywords);
    setCompanyName("");
    setCompanyDomain("");
  };

  const handleClear = () => {
    setActiveArchetype(null);
    setJobTitle("");
    setCompanyName("");
    setCompanyDomain("");
    setCompanySize("");
    setIndustry("");
    setLocation("");
    setKeywords("");
    setHasEmail(false);
    setHasLinkedIn(false);
    setSearchResults([]);
    setSelectedLeadIds(new Set());
    setSearchExecuted(false);
    setImportSummary(null);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setSearchExecuted(true);
    setImportSummary(null);
    setSelectedLeadIds(new Set());

    try {
      const res = await fetch("/api/finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: jobTitle.trim() || undefined,
          companyName: companyName.trim() || undefined,
          companyDomain: companyDomain.trim() || undefined,
          companySize: companySize.trim() || undefined,
          industry: industry.trim() || undefined,
          location: location.trim() || undefined,
          keywords: keywords.trim() || undefined,
          hasEmail: hasEmail || undefined,
          hasLinkedIn: hasLinkedIn || undefined,
          providerId: providerInfo?.isConfigured ? undefined : "mock",
          limit: 25,
        }),
      });

      const data = await res.json();
      setProviderInfo({
        isConfigured: data.isConfigured,
        isDevelopmentMock: data.isDevelopmentMock,
        providerName: data.providerName,
        message: data.message,
      });

      const leads: DiscoveredLead[] = data.leads || [];
      setSearchResults(leads);
      setTotalMatches(data.totalMatches ?? leads.length);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  // Toggle single lead selection
  const toggleSelectLead = (id: string) => {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedLeadIds(next);
  };

  // Select all importable leads
  const importableLeads = searchResults.filter(
    (l) => !l.isExistingLead && !importedLeadIds.has(l.id)
  );

  const handleToggleSelectAll = () => {
    if (selectedLeadIds.size === importableLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(importableLeads.map((l) => l.id)));
    }
  };

  // Import selected prospects
  const handleImportSelected = async () => {
    if (selectedLeadIds.size === 0) return;

    const leadsToImport = searchResults
      .filter((l) => selectedLeadIds.has(l.id))
      .map((l) => ({
        id: l.id,
        fullName: l.fullName,
        firstName: l.firstName,
        lastName: l.lastName,
        jobTitle: l.jobTitle,
        companyName: l.companyName,
        companyDomain: l.companyDomain,
        companySize: l.companySize,
        industry: l.industry,
        location: l.location,
        email: l.email,
        phone: l.phone,
        linkedInUrl: l.linkedInUrl,
        website: l.website,
        sourceProvider: l.sourceProvider,
      }));

    setImporting(true);
    try {
      const res = await fetch("/api/finder/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospects: leadsToImport }),
      });

      if (res.ok) {
        const summary = await res.json();
        setImportSummary(summary);

        // Track newly imported leads
        const nextImported = new Set(importedLeadIds);
        summary.results?.forEach((r: any) => {
          if (r.status === "imported" || r.status === "already_exists") {
            nextImported.add(r.id);
          }
        });
        setImportedLeadIds(nextImported);

        // Update searchResults in-memory to reflect isExistingLead
        setSearchResults((prev) =>
          prev.map((l) => {
            const match = summary.results?.find((r: any) => r.id === l.id);
            if (match && (match.status === "imported" || match.status === "already_exists")) {
              return {
                ...l,
                isExistingLead: true,
                existingLeadId: match.leadId || l.existingLeadId,
              };
            }
            return l;
          })
        );

        setSelectedLeadIds(new Set());
      } else {
        const errorData = await res.json();
        alert(errorData.error?.message || "Failed to import selected prospects.");
      }
    } catch (err) {
      console.error("Import error:", err);
      alert("Network error while importing prospects.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-foreground-muted mb-0.5">
            <span className="font-semibold text-foreground">Discovery</span>
            <span>•</span>
            <span>Prospect queries</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Client finder
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Query decision-makers by seniority, company profile, and specialization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/leads">
            <Button variant="ghost" size="sm" className="text-xs h-8">
              View CRM Leads
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8">
              Configure provider
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Provider Status Notification Banner */}
      {providerInfo && (
        <>
          {providerInfo.isDevelopmentMock ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 p-3.5 rounded-md border border-purple-500/30 bg-purple-500/10 text-xs text-foreground"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-purple-500/20 text-purple-600 dark:text-purple-400 mt-0.5">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    Development Discovery Provider (Offline Simulation Active)
                  </span>
                  <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-medium bg-purple-500/20 text-purple-700 dark:text-purple-300">
                    Dev Fallback
                  </span>
                </div>
                <p className="text-foreground-muted leading-relaxed">
                  Prospect queries are currently executing against OutreachOS&apos;s safe offline simulation dataset with realistic decision-maker profiles. To connect a live external B2B provider (e.g. Apollo, Clearbit, Hunter), add your API key in Settings.
                </p>
              </div>
            </div>
          ) : !providerInfo.isConfigured ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 p-3.5 rounded-md border border-warning/30 bg-warning-tint text-xs text-foreground"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-warning/15 text-warning mt-0.5">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    B2B data provider not connected
                  </span>
                  <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-medium bg-warning/20 text-warning">
                    Setup required
                  </span>
                </div>
                <p className="text-foreground-muted leading-relaxed">
                  OutreachOS strictly prohibits scraping and unauthorized automation.
                  To execute live prospect queries, connect an approved B2B provider API in{" "}
                  <Link href="/settings" className="underline font-medium text-foreground hover:text-primary">
                    Settings → Lead sources
                  </Link>
                  .
                </p>
              </div>
            </div>
          ) : (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 p-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-xs text-foreground"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {providerInfo.providerName} Connected
                  </span>
                  <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-medium bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    Live Provider
                  </span>
                </div>
                <p className="text-foreground-muted leading-relaxed">
                  Queries are routed to your configured third-party B2B prospect provider with server-side rate-limit protection and multi-tenant deduplication.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Target Archetypes */}
      <section aria-label="Target archetypes" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Target archetypes
          </h2>
          <span className="text-[11px] text-foreground-subtle">
            Select to pre-fill search filters
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {FREELANCER_ARCHETYPES.map((arch) => {
            const isSelected = activeArchetype === arch.id;
            return (
              <button
                key={arch.id}
                type="button"
                onClick={() => handleSelectArchetype(arch)}
                className={cn(
                  "flex flex-col text-left p-3 rounded-md border transition-all text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  isSelected
                    ? "border-primary bg-primary-soft/20 ring-1 ring-primary/30"
                    : "border-border bg-surface hover:bg-surface-elevated"
                )}
              >
                <span className="font-semibold text-foreground tracking-tight">
                  {arch.name}
                </span>
                <span className="text-[11px] text-foreground-muted mt-0.5 line-clamp-2 leading-relaxed">
                  {arch.description}
                </span>
                <span className="text-[10px] font-mono text-primary font-medium mt-2">
                  {arch.industry}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Discovery Criteria Form */}
      <section aria-label="Discovery criteria" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Criteria & Filters
          </h2>
          {(activeArchetype || jobTitle || companyName || industry || location || keywords) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 px-2 text-xs text-foreground-muted gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>

        <div className="rounded-md border border-border bg-surface p-4">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input
                label="Target job title"
                name="finderJobTitle"
                spellCheck={false}
                placeholder="e.g. Founder, CEO, VP Marketing…"
                value={jobTitle}
                onChange={(e) => {
                  setJobTitle(e.target.value);
                  setActiveArchetype(null);
                }}
              />

              <Input
                label="Company name"
                name="finderCompanyName"
                spellCheck={false}
                placeholder="e.g. CloudScale, Nexora…"
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  setActiveArchetype(null);
                }}
              />

              <Select
                label="Company size"
                name="finderCompanySize"
                value={companySize}
                onChange={(e) => {
                  setCompanySize(e.target.value);
                  setActiveArchetype(null);
                }}
              >
                <option value="">Any company size</option>
                <option value="1-10">1-10 employees (Early stage)</option>
                <option value="11-50">11-50 employees (Seed / Growth)</option>
                <option value="51-200">51-200 employees (Scaleup)</option>
                <option value="201-500">201-500 employees (Mid-market)</option>
                <option value="500+">500+ employees (Enterprise)</option>
              </Select>

              <Input
                label="Industry"
                name="finderIndustry"
                spellCheck={false}
                placeholder="e.g. Fintech, AI, B2B SaaS, E-Commerce…"
                value={industry}
                onChange={(e) => {
                  setIndustry(e.target.value);
                  setActiveArchetype(null);
                }}
              />

              <Input
                label="Geographic location"
                name="finderLocation"
                spellCheck={false}
                placeholder="e.g. San Francisco, London, Remote…"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setActiveArchetype(null);
                }}
              />

              <Input
                label="Company domain"
                name="finderCompanyDomain"
                spellCheck={false}
                placeholder="e.g. acme.com, cloudscale.io…"
                value={companyDomain}
                onChange={(e) => {
                  setCompanyDomain(e.target.value);
                  setActiveArchetype(null);
                }}
              />

              <div className="sm:col-span-2 lg:col-span-3">
                <Input
                  label="Keywords / Specialization"
                  name="finderKeywords"
                  spellCheck={false}
                  placeholder="e.g. Next.js, Stripe, B2B SaaS, Hiring…"
                  value={keywords}
                  onChange={(e) => {
                    setKeywords(e.target.value);
                    setActiveArchetype(null);
                  }}
                />
              </div>
            </div>

            {/* Quality Filters */}
            <div className="flex flex-wrap items-center gap-5 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-foreground-muted hover:text-foreground">
                <input
                  type="checkbox"
                  checked={hasEmail}
                  onChange={(e) => setHasEmail(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span>Must have verified email</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-foreground-muted hover:text-foreground">
                <input
                  type="checkbox"
                  checked={hasLinkedIn}
                  onChange={(e) => setHasLinkedIn(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span>Must have LinkedIn profile</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={searching || importing}
                className="h-8 text-xs"
              >
                Clear filters
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={searching || importing}
                className="gap-1.5 h-8 text-xs"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                {searching ? "Searching…" : "Search prospects"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Import Summary Notification */}
      {importSummary && (
        <div
          role="status"
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-xs text-foreground">
                Import completed successfully
              </span>
            </div>
            <Link href="/leads">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                View in CRM Leads
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
            <div className="p-2 rounded bg-surface border border-border">
              <div className="text-foreground-muted text-[10px] uppercase font-mono">Selected</div>
              <div className="font-bold text-sm text-foreground">{importSummary.totalSubmitted}</div>
            </div>
            <div className="p-2 rounded bg-surface border border-border">
              <div className="text-foreground-muted text-[10px] uppercase font-mono">Imported as New</div>
              <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{importSummary.importedCount}</div>
            </div>
            <div className="p-2 rounded bg-surface border border-border">
              <div className="text-foreground-muted text-[10px] uppercase font-mono">Already Existed (Preserved)</div>
              <div className="font-bold text-sm text-foreground-muted">{importSummary.alreadyExistedCount}</div>
            </div>
            <div className="p-2 rounded bg-surface border border-border">
              <div className="text-foreground-muted text-[10px] uppercase font-mono">Skipped / Failed</div>
              <div className="font-bold text-sm text-warning">{importSummary.failedCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Discovery Results Area */}
      <section aria-label="Results" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              Results
            </h2>
            {searchExecuted && searchResults.length > 0 && (
              <span className="text-xs text-foreground-muted font-mono">
                ({totalMatches} matched, {searchResults.length} visible)
              </span>
            )}
          </div>

          {searchExecuted && searchResults.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleSelectAll}
                disabled={importing || importableLeads.length === 0}
                className="h-8 text-xs gap-1"
              >
                <Check className="h-3 w-3" />
                {selectedLeadIds.size === importableLeads.length && importableLeads.length > 0
                  ? "Deselect all"
                  : `Select all new (${importableLeads.length})`}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleImportSelected}
                disabled={importing || selectedLeadIds.size === 0}
                className="h-8 text-xs gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {importing
                  ? "Importing…"
                  : `Add to Leads (${selectedLeadIds.size})`}
              </Button>
            </div>
          )}
        </div>

        {!searchExecuted ? (
          <div className="rounded-md border border-border bg-surface p-12 text-center">
            <Search className="h-6 w-6 mx-auto text-foreground-subtle mb-2" />
            <p className="text-xs font-medium text-foreground">Configure criteria or pick an archetype</p>
            <p className="text-[11px] text-foreground-muted mt-0.5 max-w-sm mx-auto">
              Select an archetype preset above or customize search filters to query verified prospects.
            </p>
          </div>
        ) : providerInfo && !providerInfo.isConfigured && !providerInfo.isDevelopmentMock ? (
          <div className="rounded-md border border-border bg-surface p-12 text-center">
            <ShieldCheck className="h-6 w-6 mx-auto text-warning mb-2" />
            <p className="text-xs font-medium text-foreground">Provider API key required</p>
            <p className="text-[11px] text-foreground-muted mt-0.5 max-w-md mx-auto">
              {providerInfo.message ||
                "Connect an approved B2B provider API key in Settings to execute live queries."}
            </p>
            <div className="mt-4">
              <Link href="/settings">
                <Button size="sm" className="h-8 text-xs">Connect provider</Button>
              </Link>
            </div>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="rounded-md border border-border bg-surface p-12 text-center">
            <Search className="h-6 w-6 mx-auto text-foreground-subtle mb-2" />
            <p className="text-xs font-medium text-foreground">No leads matched these criteria</p>
            <p className="text-[11px] text-foreground-muted mt-0.5">
              Try broadening your job titles, locations, or company size filters.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {searchResults.map((prospect) => {
              const isSelected = selectedLeadIds.has(prospect.id);
              const isAlreadyInLeads = Boolean(prospect.isExistingLead);
              const isRecentlyImported = importedLeadIds.has(prospect.id);

              return (
                <div
                  key={prospect.id}
                  className={cn(
                    "p-3.5 rounded-md border transition-all text-xs bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                    isSelected && "border-primary ring-1 ring-primary/20 bg-primary-soft/10",
                    isAlreadyInLeads && "bg-surface-elevated/40 border-border/70"
                  )}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Checkbox */}
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        disabled={isAlreadyInLeads || importing}
                        checked={isSelected}
                        onChange={() => toggleSelectLead(prospect.id)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          isAlreadyInLeads
                            ? "Prospect is already present in your OutreachOS leads database"
                            : "Select prospect to import"
                        }
                      />
                    </div>

                    {/* Prospect Details */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground text-sm tracking-tight">
                          {prospect.fullName}
                        </span>
                        <span className="text-foreground-muted">•</span>
                        <span className="text-foreground font-medium">{prospect.jobTitle}</span>

                        {/* Status Badges */}
                        {isRecentlyImported ? (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Imported
                          </span>
                        ) : isAlreadyInLeads ? (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-secondary text-foreground-muted"
                            title="Lead deduplication matched this record in your database"
                          >
                            Already in Leads
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                            New Prospect
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-[11px] text-foreground-muted">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-foreground-subtle" />
                          <span className="font-medium text-foreground">{prospect.companyName}</span>
                          {prospect.companySize && (
                            <span className="text-foreground-subtle font-mono">({prospect.companySize} emp)</span>
                          )}
                        </div>

                        {prospect.industry && (
                          <div className="flex items-center gap-1">
                            <Layers className="h-3 w-3 text-foreground-subtle" />
                            <span>{prospect.industry}</span>
                          </div>
                        )}

                        {prospect.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-foreground-subtle" />
                            <span>{prospect.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Contact Indicators & Links */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                        {prospect.email && (
                          <div className="flex items-center gap-1 font-mono text-foreground-muted">
                            <Mail className="h-3 w-3 text-primary" />
                            <span>{prospect.email}</span>
                          </div>
                        )}

                        {prospect.linkedInUrl && (
                          <a
                            href={prospect.linkedInUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Linkedin className="h-3 w-3" />
                            <span>LinkedIn Profile</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}

                        {prospect.website && (
                          <a
                            href={prospect.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-foreground-muted hover:text-foreground"
                          >
                            <Globe className="h-3 w-3 text-foreground-subtle" />
                            <span>Website</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}

                        <span className="text-[10px] text-foreground-subtle font-mono ml-auto">
                          Source: {prospect.sourceProvider}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                    {isAlreadyInLeads ? (
                      prospect.existingLeadId ? (
                        <Link href={`/leads/${prospect.existingLeadId}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-foreground-muted">
                            Open Lead
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-[11px] text-foreground-subtle italic">Exists in CRM</span>
                      )
                    ) : (
                      <Button
                        type="button"
                        variant={isSelected ? "primary" : "outline"}
                        size="sm"
                        onClick={() => toggleSelectLead(prospect.id)}
                        disabled={importing}
                        className="h-7 text-xs"
                      >
                        {isSelected ? "Selected" : "Select"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
