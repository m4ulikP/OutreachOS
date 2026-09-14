"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
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
    name: "SaaS Tech Founders",
    description: "Seed & Series A founders building software",
    jobTitle: "Founder, Co-Founder, CEO",
    companySize: "1-10",
    industry: "B2B SaaS & Cloud",
    location: "United States, Remote",
    keywords: "Next.js, AI, Stripe, Hiring",
  },
  {
    id: "ecom-growth",
    name: "E-Commerce Growth Heads",
    description: "Marketing directors scaling D2C brands",
    jobTitle: "VP Marketing, Head of Growth",
    companySize: "11-50",
    industry: "E-Commerce & D2C Retail",
    location: "United States, UK",
    keywords: "Shopify, Klaviyo, Meta Ads, Retention",
  },
  {
    id: "agency-leaders",
    name: "Agency Principals",
    description: "Creative & digital agency owners needing senior talent",
    jobTitle: "Creative Director, Managing Partner",
    companySize: "1-10",
    industry: "Design & Digital Agencies",
    location: "Remote, London, New York",
    keywords: "Figma, Webflow, Branding, Retainers",
  },
  {
    id: "fintech-product",
    name: "Fintech Product VP",
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
            <span className="font-semibold text-foreground">Outreach Radar</span>
            <span>•</span>
            <span>Decision-Maker Discovery</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Client Finder
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Query high-intent freelance clients using compliant B2B provider APIs
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline" size="sm" className="text-xs gap-1.5 self-start sm:self-auto h-9">
            Configure Provider
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Button>
        </Link>
      </div>

      {/* Provider Status Notification */}
      {providerInfo && !providerInfo.isConfigured && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] dark:bg-amber-950/20 text-xs text-foreground shadow-xs"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                External B2B Lead Provider Not Connected
              </span>
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.2 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                Setup Required
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              OutreachOS strictly prohibits unauthorized scraping and simulated profiles.
              To execute live queries against real decision-makers, connect an approved B2B provider API (such as Apollo, Clearbit, or Hunter) in{" "}
              <Link href="/settings" className="underline font-medium text-foreground hover:text-primary">
                Settings → Lead Sources
              </Link>
              . You can test your query filters below in advance.
            </p>
          </div>
        </div>
      )}

      {/* Freelancer ICP Archetype Quick-Picks */}
      <section aria-label="Freelancer Target Archetypes" className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            Instant Freelance ICP Presets
          </span>
          <span className="text-[11px] text-muted-foreground">
            Click to auto-fill search filters
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FREELANCER_ARCHETYPES.map((arch) => {
            const isSelected = activeArchetype === arch.id;
            return (
              <button
                key={arch.id}
                type="button"
                onClick={() => handleSelectArchetype(arch)}
                className={cn(
                  "flex flex-col text-left p-3.5 rounded-xl border transition-all text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs",
                  isSelected
                    ? "border-primary bg-primary/[0.05] ring-1 ring-primary/30"
                    : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
                )}
              >
                <span className="font-semibold text-foreground tracking-tight">
                  {arch.name}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
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

      {/* Discovery Criteria Form Card */}
      <Card className="rounded-xl shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Prospect Discovery Criteria
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Target prospects by executive title, headcount, specialization, and geography
              </CardDescription>
            </div>
            {activeArchetype && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 px-2 text-xs text-muted-foreground gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input
                label="Target Job Title"
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
                label="Company Size"
                name="finderCompanySize"
                value={companySize}
                onChange={(e) => {
                  setCompanySize(e.target.value);
                  setActiveArchetype(null);
                }}
              >
                <option value="">Any company size</option>
                <option value="1-10">1-10 employees (Early Stage)</option>
                <option value="11-50">11-50 employees (Seed / Growth)</option>
                <option value="51-200">51-200 employees (Scaleup)</option>
                <option value="201-500">201-500 employees (Mid-Market)</option>
                <option value="500+">500+ employees (Enterprise)</option>
              </Select>

              <Input
                label="Target Industry"
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
                label="Geographic Location"
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
                  label="Keywords / Tech Stack"
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
                Clear Filters
              </Button>
              <Button type="submit" size="sm" disabled={searching} className="gap-1.5 h-8 text-xs">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                {searching ? "Dispatching Query…" : "Search Prospects"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Discovery Results Area */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-foreground tracking-tight">
          Discovery Results
        </h2>

        {!searchExecuted ? (
          <EmptyState
            icon={<Search className="h-6 w-6" aria-hidden="true" />}
            title="Configure criteria or pick an archetype above"
            description="Use an instant preset or tailor your search filters to discover verified prospect profiles."
            className="py-14 rounded-xl"
          />
        ) : providerInfo && !providerInfo.isConfigured ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6 text-amber-500" aria-hidden="true" />}
            title="Provider API Key Required for Live Dispatch"
            description={
              providerInfo.message ||
              "OutreachOS is ready to dispatch this search query once your B2B provider key is configured in Settings."
            }
            action={
              <Link href="/settings">
                <Button size="sm" className="h-8 text-xs">Connect Provider in Settings</Button>
              </Link>
            }
            className="py-14 rounded-xl"
          />
        ) : searchResults.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" aria-hidden="true" />}
            title="No leads matched these criteria"
            description="Try broadening your job titles, locations, or company size filters."
            className="py-14 rounded-xl"
          />
        ) : (
          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-xs text-muted-foreground tabular-nums font-mono">
              Found {searchResults.length} matching prospects.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
