"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Search,
  SlidersHorizontal,
  Building2,
  Briefcase,
  MapPin,
  Sparkles,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

export default function ClientFinderPage() {
  const [jobTitle, setJobTitle] = React.useState("");
  const [companySize, setCompanySize] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [keywords, setKeywords] = React.useState("");

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Client Finder
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Discover and qualify high-intent freelance clients using compliant B2B data providers
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            Configure Provider
            <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      {/* Provider Status Banner */}
      {providerInfo && !providerInfo.isConfigured && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block text-sm">
              External Lead Discovery Provider Not Connected
            </span>
            <p className="leading-relaxed">
              OutreachOS strictly adheres to product safety principles: we do not scrape LinkedIn or fabricate fake profiles.
              To unlock live prospecting, connect a permitted B2B data provider API (such as Apollo, Clearbit, or Hunter) in{" "}
              <Link href="/settings" className="underline font-semibold hover:text-foreground">
                Settings → Lead Sources
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* Search Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            Prospect Discovery Criteria
          </CardTitle>
          <CardDescription>
            Filter target prospects by seniority, company profile, and specialization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input
                label="Target Job Title"
                placeholder="e.g. Chief Marketing Officer, Founder"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />

              <Select
                label="Company Size"
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
              >
                <option value="">Any company size</option>
                <option value="1-10">1-10 employees (Early Stage)</option>
                <option value="11-50">11-50 employees (Seed / Growth)</option>
                <option value="51-200">51-200 employees (Scaleup)</option>
                <option value="201-500">201-500 employees (Mid-Market)</option>
                <option value="500+">500+ employees (Enterprise)</option>
              </Select>

              <Input
                label="Industry"
                placeholder="e.g. Fintech, HealthTech, AI"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />

              <Input
                label="Geographic Location"
                placeholder="e.g. United States, London, Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />

              <div className="sm:col-span-2 lg:col-span-2">
                <Input
                  label="Keywords / Tech Stack"
                  placeholder="e.g. Next.js, Stripe, B2B SaaS, Hiring"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setJobTitle("");
                  setCompanySize("");
                  setIndustry("");
                  setLocation("");
                  setKeywords("");
                  setSearchResults([]);
                  setSearchExecuted(false);
                }}
                disabled={searching}
              >
                Clear Criteria
              </Button>
              <Button type="submit" size="sm" disabled={searching} className="gap-1.5">
                <Search className="h-3.5 w-3.5" />
                {searching ? "Searching Provider..." : "Search Prospects"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Discovery Results Area */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">
          Discovery Results
        </h2>

        {!searchExecuted ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="Configure criteria to find target clients"
            description="Use the search filters above to query your connected B2B data provider for qualified leads."
            className="py-14"
          />
        ) : providerInfo && !providerInfo.isConfigured ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="External Provider Connection Required"
            description={
              providerInfo.message ||
              "To protect your deliverability and maintain compliant outreach, OutreachOS requires a valid B2B lead provider API key before live prospect queries can be dispatched."
            }
            action={
              <Link href="/settings">
                <Button size="sm">Connect Provider in Settings</Button>
              </Link>
            }
            className="py-14"
          />
        ) : searchResults.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No leads matched these criteria"
            description="Try broadening your job titles, locations, or company size filters."
            className="py-14"
          />
        ) : (
          <div className="p-4 rounded-lg border border-border bg-card">
            {/* When results are returned from provider */}
            <span className="text-xs text-muted-foreground">Found {searchResults.length} matching prospects.</span>
          </div>
        )}
      </div>
    </div>
  );
}
