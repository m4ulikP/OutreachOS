"use client";

import * as React from "react";
import {
  Globe,
  Search,
  ExternalLink,
  Bookmark,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  User,
  Info,
  SlidersHorizontal,
  X,
  Building,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface DiscoveredPublicOpportunity {
  externalId?: string;
  source: string;
  sourceUrl: string;
  title: string;
  description?: string;
  authorName?: string;
  authorProfileUrl?: string;
  publishedAt?: string;
  sourceName?: string;
  sourceCommunity?: string;
  companyName?: string;
  budget?: number;
  currency?: string;
  location?: { country?: string };
  tags?: string[];
  classification?: {
    intent: string;
    demandStrength: string;
    relevant: boolean;
    matchedSignals: string[];
    reason: string;
    requestedServices: string[];
    confidence: number;
  };
  qualification?: {
    relevant: boolean;
    intent: string;
    demandStrength: string;
    reason: string;
    requestedServices: string[];
    budgetMentioned?: string | null;
    urgency?: string;
    businessContext?: string | null;
    confidence: number;
  } | null;
  whyFound?: string[];
}

interface DiscoveryResponse {
  opportunities: DiscoveredPublicOpportunity[];
  totalMatches: number;
  relevantCount: number;
  providerName: string;
  providerId: string;
  isConfigured: boolean;
  isDevelopmentMock: boolean;
  persisted?: {
    total: number;
    persistedCount: number;
    created: number;
    matched: number;
    failed: number;
  } | null;
}

const SEARCH_PRESETS = [
  { label: "Website Requests", query: "looking for website developer" },
  { label: "Web Developers Wanted", query: "need a web developer" },
  { label: "Website Redesign", query: "redesign company website" },
  { label: "Ecommerce Projects", query: "need ecommerce website shopify" },
  { label: "Landing Page Projects", query: "landing page developer" },
  { label: "Freelance Web Dev", query: "freelance web developer" },
  { label: "React / Next.js", query: "react nextjs developer" },
];

export default function PublicOpportunitiesPage() {
  const [provider, setProvider] = React.useState<string>("auto");
  const [query, setQuery] = React.useState<string>("looking for web developer");
  const [days, setDays] = React.useState<number>(14);
  const [qualify, setQualify] = React.useState<boolean>(false);
  const [limit, setLimit] = React.useState<number>(20);

  const [loading, setLoading] = React.useState<boolean>(false);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [savedIds, setSavedIds] = React.useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = React.useState<boolean>(false);

  const [response, setResponse] = React.useState<DiscoveryResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<DiscoveredPublicOpportunity | null>(null);

  // Filters
  const [intentFilter, setIntentFilter] = React.useState<string>("ALL");
  const [demandFilter, setDemandFilter] = React.useState<string>("ALL");

  const handleDiscover = async (overrideQuery?: string) => {
    setLoading(true);
    setError(null);

    const searchQuery = overrideQuery !== undefined ? overrideQuery : query;

    try {
      const res = await fetch("/api/opportunities/discover/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          query: searchQuery,
          days,
          limit,
          qualify,
          persist: false,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Discovery failed with status ${res.status}`);
      }

      const data: DiscoveryResponse = await res.json();
      setResponse(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred during discovery");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIndividual = async (item: DiscoveredPublicOpportunity) => {
    const key = item.externalId || item.sourceUrl;
    setSavingId(key);

    try {
      const res = await fetch("/api/opportunities/discover/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "mock", // use single item payload execution
          query: item.title,
          days: 30,
          limit: 1,
          qualify: false,
          persist: true,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save opportunity");
      }

      setSavedIds((prev) => new Set(prev).add(key));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save opportunity");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    if (!response || response.opportunities.length === 0) return;
    setSavingAll(true);

    try {
      const res = await fetch("/api/opportunities/discover/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          query,
          days,
          limit: response.opportunities.length,
          qualify,
          persist: true,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to bulk save opportunities");
      }

      const data: DiscoveryResponse = await res.json();
      setResponse(data);
      const allKeys = new Set(data.opportunities.map((o) => o.externalId || o.sourceUrl));
      setSavedIds(allKeys);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to bulk save");
    } finally {
      setSavingAll(false);
    }
  };

  React.useEffect(() => {
    handleDiscover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opportunities = response?.opportunities || [];

  const filteredOpportunities = opportunities.filter((op) => {
    const intent = op.qualification?.intent || op.classification?.intent || "UNKNOWN";
    const demand = op.qualification?.demandStrength || op.classification?.demandStrength || "UNKNOWN";

    if (intentFilter !== "ALL" && intent !== intentFilter) return false;
    if (demandFilter !== "ALL" && demand !== demandFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Public Opportunities
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              Public Demand Discovery
            </Badge>
          </div>
          <p className="text-xs text-foreground-muted mt-1">
            Find people and businesses publicly looking for web developers across public feeds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {response && response.opportunities.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveAll}
              disabled={savingAll}
              className="text-xs gap-1.5"
            >
              <Bookmark className="h-3.5 w-3.5 text-primary" />
              <span>{savingAll ? "Saving..." : "Save All to Opportunities"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Provider Status Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-border bg-surface-elevated text-xs">
        <div className="flex items-center gap-2.5">
          <Globe className="h-4 w-4 text-primary shrink-0" />
          <div>
            <span className="font-semibold text-foreground">Active Providers: </span>
            <span className="text-foreground-muted">
              Hacker News (Algolia API) • Remote OK (Public Feed) • Mock Simulator
            </span>
          </div>
        </div>
        <Badge variant="secondary" className="bg-success/15 text-success font-mono text-[10px]">
          Configured / No API key required
        </Badge>
      </div>

      {/* Search Controls Card */}
      <Card className="p-4 bg-surface border-border space-y-4">
        {/* Preset Query Badges */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wider">
            Quick Search Presets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SEARCH_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setQuery(preset.query);
                  handleDiscover(preset.query);
                }}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  query === preset.query
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "bg-surface-elevated text-foreground-muted border-border hover:text-foreground hover:bg-secondary"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-medium text-foreground">Search Query / Keywords</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-foreground-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. looking for web developer"
                className="pl-8 text-xs bg-surface-elevated border-border"
                onKeyDown={(e) => e.key === "Enter" && handleDiscover()}
              />
            </div>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-medium text-foreground">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-surface-elevated border border-border text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="auto">Auto (Recommended)</option>
              <option value="hacker_news">Hacker News (Algolia API)</option>
              <option value="remote_ok">Remote OK (Public Feed)</option>
              <option value="mock">Mock Simulation Provider</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-medium text-foreground">Recency</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full h-9 px-3 rounded-md bg-surface-elevated border border-border text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value={7}>Past 7 days</option>
              <option value={14}>Past 14 days</option>
              <option value={30}>Past 30 days</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none border border-border bg-surface-elevated px-3 py-2 rounded-md w-full justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-warning" />
                <span>Qualify with AI</span>
              </span>
              <input
                type="checkbox"
                checked={qualify}
                onChange={(e) => setQualify(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
            </label>

            <Button
              onClick={() => handleDiscover()}
              disabled={loading}
              className="h-9 px-4 bg-primary text-primary-foreground hover:bg-primary-hover text-xs font-semibold shrink-0"
            >
              {loading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span>Discover</span>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Filter Toolbar */}
      {response && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs bg-surface-elevated px-4 py-2.5 rounded-lg border border-border">
          <div className="flex items-center gap-2 text-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5 text-foreground-muted" />
            <span className="font-semibold">
              Found {response.relevantCount} relevant opportunities
            </span>
            <span className="text-foreground-muted">
              (from {response.totalMatches} total posts via {response.providerName})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-foreground-muted">Intent:</span>
              <select
                value={intentFilter}
                onChange={(e) => setIntentFilter(e.target.value)}
                className="h-7 px-2 rounded bg-surface border border-border text-xs text-foreground"
              >
                <option value="ALL">All Intents</option>
                <option value="WEBSITE_BUILD">Website Build</option>
                <option value="WEBSITE_REDESIGN">Website Redesign</option>
                <option value="ECOMMERCE_BUILD">Ecommerce Build</option>
                <option value="LANDING_PAGE">Landing Page</option>
                <option value="WEB_APPLICATION">Web Application</option>
                <option value="FRONTEND_DEVELOPMENT">Frontend Dev</option>
                <option value="FULL_STACK_DEVELOPMENT">Full Stack Dev</option>
                <option value="WORDPRESS_CMS">WordPress / CMS</option>
                <option value="GENERAL_DEVELOPER_REQUEST">General Request</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-foreground-muted">Demand:</span>
              <select
                value={demandFilter}
                onChange={(e) => setDemandFilter(e.target.value)}
                className="h-7 px-2 rounded bg-surface border border-border text-xs text-foreground"
              >
                <option value="ALL">All Demand</option>
                <option value="EXPLICIT">Explicit</option>
                <option value="STRONG">Strong</option>
                <option value="POSSIBLE">Possible</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-danger/15 border border-danger/30 text-danger rounded-md text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton Grid */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 bg-surface border-border animate-pulse space-y-3">
              <div className="h-4 bg-secondary rounded w-3/4" />
              <div className="h-3 bg-secondary rounded w-full" />
              <div className="h-3 bg-secondary rounded w-5/6" />
              <div className="h-6 bg-secondary rounded w-1/3 mt-2" />
            </Card>
          ))}
        </div>
      )}

      {/* Results List */}
      {!loading && response && filteredOpportunities.length === 0 && (
        <Card className="p-8 text-center bg-surface border-border space-y-2">
          <Info className="h-8 w-8 text-foreground-muted mx-auto" />
          <h3 className="text-sm font-semibold text-foreground">No matching public opportunities found</h3>
          <p className="text-xs text-foreground-muted max-w-md mx-auto">
            Try adjusting your search query, switching providers, or widening the recency window.
          </p>
        </Card>
      )}

      {!loading && response && filteredOpportunities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOpportunities.map((op) => {
            const key = op.externalId || op.sourceUrl;
            const isSaved = savedIds.has(key);
            const isSaving = savingId === key;

            const intent = op.qualification?.intent || op.classification?.intent || "GENERAL_DEVELOPER_REQUEST";
            const demand = op.qualification?.demandStrength || op.classification?.demandStrength || "POSSIBLE";
            const confidence = op.qualification?.confidence ?? op.classification?.confidence ?? 0.8;

            return (
              <Card
                key={key}
                className="p-4 bg-surface border-border hover:border-primary/40 transition-colors flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  {/* Card Header & Source Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-mono">
                        {op.sourceName || op.source}
                      </Badge>

                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-medium ${
                          demand === "EXPLICIT"
                            ? "bg-success/15 text-success"
                            : demand === "STRONG"
                            ? "bg-warning/15 text-warning"
                            : "bg-surface-elevated text-foreground-muted"
                        }`}
                      >
                        {demand} DEMAND
                      </Badge>

                      <Badge variant="outline" className="text-[10px] bg-surface-elevated border-border text-foreground-muted">
                        {intent.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <a
                      href={op.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-foreground-muted hover:text-primary transition-colors shrink-0"
                      title="Open original posting"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                    {op.title}
                  </h3>

                  {/* Description snippet */}
                  {op.description && (
                    <p className="text-xs text-foreground-muted line-clamp-3 leading-relaxed">
                      {op.description}
                    </p>
                  )}

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-foreground-muted pt-1">
                    {op.authorName && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-foreground-muted" />
                        <span>{op.authorName}</span>
                      </span>
                    )}

                    {op.companyName && (
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3 text-foreground-muted" />
                        <span>{op.companyName}</span>
                      </span>
                    )}

                    {op.budget && (
                      <span className="flex items-center gap-1 font-semibold text-success">
                        <DollarSign className="h-3 w-3" />
                        <span>{op.budget.toLocaleString()} {op.currency || "USD"}</span>
                      </span>
                    )}

                    {op.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(op.publishedAt).toLocaleDateString()}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer CTAs */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(op)}
                    className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                  >
                    <Info className="h-3.5 w-3.5" />
                    <span>View Evidence</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <a
                      href={op.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-surface-elevated text-foreground hover:bg-secondary border border-border transition-colors"
                    >
                      <span>Open Source</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>

                    <Button
                      size="sm"
                      variant={isSaved ? "secondary" : "primary"}
                      disabled={isSaving || isSaved}
                      onClick={() => handleSaveIndividual(op)}
                      className="h-7 text-xs px-2.5 gap-1 bg-primary text-primary-foreground hover:bg-primary-hover"
                    >
                      {isSaved ? (
                        <>
                          <Check className="h-3 w-3 text-success" />
                          <span>Saved</span>
                        </>
                      ) : isSaving ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Bookmark className="h-3 w-3" />
                          <span>Save</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail & Evidence Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl bg-surface border-border p-6 space-y-5 relative shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="absolute right-4 top-4 text-foreground-muted hover:text-foreground p-1 rounded-md bg-surface-elevated"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                  {selectedItem.sourceName || selectedItem.source}
                </Badge>
                {selectedItem.sourceCommunity && (
                  <Badge variant="secondary" className="text-xs bg-surface-elevated text-foreground-muted">
                    {selectedItem.sourceCommunity}
                  </Badge>
                )}
              </div>
              <h2 className="text-lg font-bold text-foreground pr-8 leading-tight">
                {selectedItem.title}
              </h2>
            </div>

            {/* Why OutreachOS Found This */}
            <div className="p-3.5 rounded-lg bg-surface-elevated border border-border space-y-2">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span>Why OutreachOS Found This</span>
              </h4>
              <ul className="text-xs text-foreground space-y-1 pl-5 list-disc">
                {(selectedItem.whyFound || [
                  `Matched active web development demand signals for ${selectedItem.classification?.intent}`,
                  selectedItem.classification?.reason,
                ])
                  .filter(Boolean)
                  .map((reason, idx) => (
                    <li key={idx} className="leading-normal">{reason}</li>
                  ))}
              </ul>
            </div>

            {/* Full Post Description */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                Original Post Text
              </h4>
              <div className="p-3 rounded-md bg-surface-elevated border border-border text-xs text-foreground font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                {selectedItem.description || "No extended body text available."}
              </div>
            </div>

            {/* Classification & AI Qualification Metadata */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-md bg-surface-elevated border border-border space-y-1">
                <span className="text-foreground-muted font-medium">Detected Intent</span>
                <p className="font-semibold text-foreground">
                  {(selectedItem.qualification?.intent || selectedItem.classification?.intent || "N/A").replace(/_/g, " ")}
                </p>
              </div>

              <div className="p-3 rounded-md bg-surface-elevated border border-border space-y-1">
                <span className="text-foreground-muted font-medium">Demand Strength</span>
                <p className="font-semibold text-foreground">
                  {selectedItem.qualification?.demandStrength || selectedItem.classification?.demandStrength || "N/A"}
                </p>
              </div>
            </div>

            {/* Footer CTAs */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedItem(null)}
                className="text-xs"
              >
                Close
              </Button>
              <a
                href={selectedItem.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover"
              >
                <span>Open Original Post</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
