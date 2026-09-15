"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  Search,
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

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
    jobTitle: "Founder, Co-Founder, CEO",
    companySize: "1-10",
    industry: "B2B SaaS & Cloud",
    location: "United States, Remote",
    keywords: "Next.js, AI, Stripe, Hiring",
  },
  {
    id: "ecom-growth",
    name: "E-commerce growth heads",
    description: "Marketing directors scaling D2C consumer brands",
    jobTitle: "VP Marketing, Head of Growth",
    companySize: "11-50",
    industry: "E-Commerce & D2C Retail",
    location: "United States, UK",
    keywords: "Shopify, Klaviyo, Meta Ads, Retention",
  },
  {
    id: "agency-leaders",
    name: "Agency principals",
    description: "Creative & digital agency owners needing senior talent",
    jobTitle: "Creative Director, Managing Partner",
    companySize: "1-10",
    industry: "Design & Digital Agencies",
    location: "Remote, London, New York",
    keywords: "Figma, Webflow, Branding, Retainers",
  },
  {
    id: "fintech-product",
    name: "Fintech product leaders",
    description: "Product leaders scaling compliance & payment rails",
    jobTitle: "VP Product, Chief Product Officer",
    companySize: "51-200",
    industry: "Financial Services & Payments",
    location: "San Francisco, New York",
    keywords: "Payments, Banking API, Mobile, Security",
  },
];

export default function ClientFinderPage() {
  const [jobTitle, setJobTitle] = React.useState("");
  const [companySize, setCompanySize] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [keywords, setKeywords] = React.useState("");
  const [activeArchetype, setActiveArchetype] = React.useState<string | null>(null);

  const [searching, setSearching] = React.useState(false);
  const [providerInfo, setProviderInfo] = React.useState<{
    isConfigured: boolean;
    providerName: string;
    message?: string;
  } | null>(null);

  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [searchExecuted, setSearchExecuted] = React.useState(false);

  // Initial provider status check
  React.useEffect(() => {
    async function checkProvider() {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setProviderInfo({
            isConfigured: data.providers?.leadSource?.isConfigured ?? false,
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
  };

  const handleClear = () => {
    setActiveArchetype(null);
    setJobTitle("");
    setCompanySize("");
    setIndustry("");
    setLocation("");
    setKeywords("");
    setSearchResults([]);
    setSearchExecuted(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setSearchExecuted(true);

    try {
      const res = await fetch("/api/finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          companySize,
          industry,
          location,
          keywords,
        }),
      });

      const data = await res.json();
      setProviderInfo({
        isConfigured: data.isConfigured,
        providerName: data.providerName,
        message: data.message,
      });
      setSearchResults(data.leads || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl">
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
        <Link href="/settings">
          <Button variant="outline" size="sm" className="text-xs gap-1.5 self-start sm:self-auto h-8">
            Configure provider
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Button>
        </Link>
      </div>

      {/* Provider Status Notification */}
      {providerInfo && !providerInfo.isConfigured && (
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
              OutreachOS strictly prohibits scraping and simulated profiles.
              To execute live prospect queries, connect an approved B2B provider API in{" "}
              <Link href="/settings" className="underline font-medium text-foreground hover:text-primary">
                Settings → Lead sources
              </Link>
              . You can test your query filters below in advance.
            </p>
          </div>
        </div>
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
            Criteria
          </h2>
          {activeArchetype && (
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
                placeholder="e.g. Founder, Chief Marketing Officer…"
                value={jobTitle}
                onChange={(e) => {
                  setJobTitle(e.target.value);
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
                placeholder="e.g. Fintech, HealthTech, AI, SaaS…"
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
                placeholder="e.g. United States, London, Remote…"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setActiveArchetype(null);
                }}
              />

              <div className="sm:col-span-2 lg:col-span-2">
                <Input
                  label="Keywords / Tech stack"
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

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={searching}
                className="h-8 text-xs"
              >
                Clear filters
              </Button>
              <Button type="submit" size="sm" disabled={searching} className="gap-1.5 h-8 text-xs">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                {searching ? "Searching…" : "Search prospects"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Discovery Results Area */}
      <section aria-label="Results" className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Results
        </h2>

        {!searchExecuted ? (
          <div className="rounded-md border border-border bg-surface p-12 text-center">
            <Search className="h-5 w-5 mx-auto text-foreground-subtle mb-1.5" />
            <p className="text-xs font-medium text-foreground">Configure criteria or pick an archetype</p>
            <p className="text-[11px] text-foreground-muted mt-0.5 max-w-sm mx-auto">
              Select an archetype preset above or customize search filters to query verified prospects.
            </p>
          </div>
        ) : providerInfo && !providerInfo.isConfigured ? (
          <div className="rounded-md border border-border bg-surface p-12 text-center">
            <ShieldCheck className="h-5 w-5 mx-auto text-warning mb-1.5" />
            <p className="text-xs font-medium text-foreground">Provider API key required</p>
            <p className="text-[11px] text-foreground-muted mt-0.5 max-w-md mx-auto">
              {providerInfo.message ||
                "Connect an approved B2B provider API key in Settings to execute live queries."}
            </p>
            <div className="mt-3">
              <Link href="/settings">
                <Button size="sm" className="h-8 text-xs">Connect provider</Button>
              </Link>
            </div>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="rounded-md border border-border bg-surface p-12 text-center">
            <Search className="h-5 w-5 mx-auto text-foreground-subtle mb-1.5" />
            <p className="text-xs font-medium text-foreground">No leads matched these criteria</p>
            <p className="text-[11px] text-foreground-muted mt-0.5">
              Try broadening your job titles, locations, or company size filters.
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-md border border-border bg-surface">
            <span className="text-xs text-foreground-muted tabular-nums font-mono">
              Found {searchResults.length} matching prospects.
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
