"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Building2,
  Search,
  Globe,
  MapPin,
  Tag,
  Users,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  Star,
  Zap,
  Info,
} from "lucide-react";
import type {
  DiscoveredBusiness,
  BusinessSearchResult,
  PersistedCompanySummary,
} from "@/lib/providers/business-discovery/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QualificationSignal {
  type: string;
  label: string;
  evidence?: string | null;
}

interface QualificationOpportunity {
  id: string;
  type: string;
  score?: number | null;
  status: string;
}

interface QualificationData {
  websiteStatus: string;
  websiteUrl?: string | null;
  confidence?: string;
  opportunityCreated: boolean;
  action: string;
  opportunity?: QualificationOpportunity | null;
  signals: QualificationSignal[];
  summary?: string | null;
}

interface QualificationResult {
  companyId: string;
  companyName: string;
  qualification: QualificationData;
}

interface BusinessCardState {
  persisting: boolean;
  qualifying: boolean;
  persistedCompany: PersistedCompanySummary | null;
  qualificationResult: QualificationResult | null;
  qualifyError: string | null;
  expanded: boolean;
}

interface SearchFormState {
  query: string;
  location: string;
  industry: string;
  keywords: string;
  limit: number;
  providerId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_OPTIONS = [
  { value: "", label: "Auto (env default)" },
  { value: "google-places", label: "Google Places" },
  { value: "hunter", label: "Hunter Discover" },
  { value: "mock", label: "Mock / Dev" },
] as const;

const PRESET_SEARCHES = [
  {
    id: "local-restaurants",
    name: "Restaurants",
    params: { query: "restaurant", industry: "food and beverage", limit: 20 },
  },
  {
    id: "retail-shops",
    name: "Retail shops",
    params: { query: "retail shop store", industry: "retail", limit: 20 },
  },
  {
    id: "professional-services",
    name: "Professional services",
    params: {
      query: "professional services",
      industry: "professional services",
      limit: 20,
    },
  },
  {
    id: "healthcare",
    name: "Healthcare & clinics",
    params: { query: "clinic medical dental", industry: "healthcare", limit: 20 },
  },
];

const SOURCE_LABELS: Record<string, string> = {
  GOOGLE_PLACES: "Google Places",
  HUNTER_DISCOVER: "Hunter Discover",
  MOCK_SIMULATION: "Mock / Dev",
  PUBLIC_FEED: "Public Feed",
  MANUAL: "Manual",
  CSV_IMPORT: "CSV Import",
};

interface WsStatusMeta {
  label: string;
  colorClass: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const WEBSITE_STATUS_META: Record<string, WsStatusMeta> = {
  WEBSITE_FOUND: {
    label: "Website found",
    colorClass: "text-success",
    Icon: CheckCircle2,
  },
  WEBSITE_UNVERIFIED: {
    label: "Unverified — no candidate",
    colorClass: "text-warning",
    Icon: AlertCircle,
  },
  WEBSITE_UNREACHABLE: {
    label: "Website unreachable",
    colorClass: "text-warning",
    Icon: AlertCircle,
  },
  WEBSITE_NOT_FOUND: {
    label: "No website confirmed",
    colorClass: "text-danger",
    Icon: AlertCircle,
  },
};

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({
  searched,
  configured,
  mockMode,
  message,
}: {
  searched: boolean;
  configured: boolean;
  mockMode: boolean;
  message?: string;
}) {
  if (!searched) {
    return (
      <div className="rounded-md border border-border bg-surface p-12 text-center">
        <Building2 className="h-6 w-6 mx-auto text-foreground-subtle mb-3" />
        <p className="text-sm font-semibold text-foreground">
          Configure criteria or pick a preset to begin
        </p>
        <p className="text-xs text-foreground-muted mt-1 max-w-sm mx-auto leading-relaxed">
          Discover local businesses and companies that may need your services.
        </p>
      </div>
    );
  }

  if (!configured && !mockMode) {
    return (
      <div className="rounded-md border border-border bg-surface p-12 text-center">
        <ShieldCheck className="h-6 w-6 mx-auto text-warning mb-3" />
        <p className="text-sm font-semibold text-foreground">
          Provider API key required
        </p>
        <p className="text-xs text-foreground-muted mt-1 max-w-md mx-auto leading-relaxed">
          {message ??
            "Connect a Google Places or Hunter API key in Settings to run live business discovery."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface p-12 text-center">
      <Search className="h-6 w-6 mx-auto text-foreground-subtle mb-3" />
      <p className="text-sm font-semibold text-foreground">No businesses matched</p>
      <p className="text-xs text-foreground-muted mt-1">
        Try different keywords, a broader location, or switch providers.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Qualification Result Panel
// ---------------------------------------------------------------------------

function QualificationResultPanel({ result }: { result: QualificationResult }) {
  const meta: WsStatusMeta =
    WEBSITE_STATUS_META[result.qualification.websiteStatus] ??
    WEBSITE_STATUS_META["WEBSITE_UNVERIFIED"];
  const { Icon } = meta;

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.colorClass)} />
        <span className={cn("text-xs font-semibold", meta.colorClass)}>
          {meta.label}
        </span>
        {result.qualification.confidence && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground-muted">
            {result.qualification.confidence} confidence
          </span>
        )}
      </div>

      {result.qualification.summary && (
        <p className="text-xs text-foreground-muted leading-relaxed">
          {result.qualification.summary}
        </p>
      )}

      {result.qualification.opportunity && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-success/10 border border-success/20">
          <Sparkles className="h-3 w-3 text-success shrink-0" />
          <span className="text-xs text-success font-semibold">
            Opportunity created
          </span>
          <span className="text-[10px] text-foreground-muted font-mono ml-auto">
            {result.qualification.opportunity.type}
          </span>
        </div>
      )}

      {result.qualification.signals.length > 0 && (
        <ul className="space-y-1">
          {result.qualification.signals.map((sig, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-foreground-muted">
              <span className="text-foreground-subtle mt-0.5">•</span>
              <span>
                <span className="font-medium text-foreground">{sig.label}</span>
                {sig.evidence && <span> — {sig.evidence}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Business Card
// ---------------------------------------------------------------------------

interface BusinessCardProps {
  business: DiscoveredBusiness;
  persistedCompanySummary: PersistedCompanySummary | null;
  onPersist: (business: DiscoveredBusiness) => Promise<PersistedCompanySummary>;
  onQualify: (companyId: string, companyName: string) => Promise<QualificationResult>;
}

function BusinessCard({
  business,
  persistedCompanySummary,
  onPersist,
  onQualify,
}: BusinessCardProps) {
  const [state, setState] = React.useState<BusinessCardState>({
    persisting: false,
    qualifying: false,
    persistedCompany: persistedCompanySummary,
    qualificationResult: null,
    qualifyError: null,
    expanded: false,
  });

  React.useEffect(() => {
    if (persistedCompanySummary && !state.persistedCompany) {
      setState((s) => ({ ...s, persistedCompany: persistedCompanySummary }));
    }
  }, [persistedCompanySummary, state.persistedCompany]);

  const handlePersist = async () => {
    setState((s) => ({ ...s, persisting: true }));
    try {
      const company = await onPersist(business);
      setState((s) => ({ ...s, persisting: false, persistedCompany: company }));
    } catch {
      setState((s) => ({ ...s, persisting: false }));
    }
  };

  const handleQualify = async () => {
    if (!state.persistedCompany) return;
    setState((s) => ({ ...s, qualifying: true, qualifyError: null }));
    try {
      const result = await onQualify(state.persistedCompany.id, business.name);
      setState((s) => ({
        ...s,
        qualifying: false,
        qualificationResult: result,
        expanded: true,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Qualification failed";
      setState((s) => ({ ...s, qualifying: false, qualifyError: msg }));
    }
  };

  const sourceLabel = SOURCE_LABELS[business.source] ?? business.source ?? "Unknown";
  const locationStr =
    business.headquarters?.formattedAddress ??
    [business.headquarters?.city, business.headquarters?.country]
      .filter(Boolean)
      .join(", ");

  const isPersisted = !!state.persistedCompany;
  const action = state.persistedCompany?.action;
  const hasExpandable = !!(business.description || state.qualificationResult);

  return (
    <div
      className={cn(
        "p-3.5 rounded-md border border-border bg-surface text-xs transition-colors",
        isPersisted && "border-primary/30 bg-primary/5"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-foreground-muted",
              isPersisted && "bg-primary/10 border-primary/25 text-primary"
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            {/* Name + action badge */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground text-sm tracking-tight">
                {business.name}
              </span>
              {action && (
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold",
                    action === "created"
                      ? "bg-success/15 text-success"
                      : action === "updated"
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-foreground-muted"
                  )}
                >
                  {action}
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-muted">
              {locationStr && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  {locationStr}
                </span>
              )}
              {business.industry && (
                <span className="flex items-center gap-1">
                  <Tag className="h-2.5 w-2.5 shrink-0" />
                  {business.industry}
                </span>
              )}
              {business.headcountRange && (
                <span className="flex items-center gap-1">
                  <Users className="h-2.5 w-2.5 shrink-0" />
                  {business.headcountRange}
                </span>
              )}
              {business.rating !== undefined && business.rating !== null && (
                <span className="flex items-center gap-1">
                  <Star className="h-2.5 w-2.5 shrink-0" />
                  {business.rating.toFixed(1)}
                  {business.userRatingCount && ` (${business.userRatingCount})`}
                </span>
              )}
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground-muted">
                {sourceLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Right icon cluster */}
        <div className="flex items-center gap-1 shrink-0">
          {business.websiteUrl && (
            <a
              href={business.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open website"
              className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Globe className="h-3 w-3" />
            </a>
          )}
          {business.sourceUrl && (
            <a
              href={business.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="View source listing"
              className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {hasExpandable && (
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, expanded: !s.expanded }))}
              className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-secondary transition-colors"
              aria-label={state.expanded ? "Collapse" : "Expand"}
            >
              {state.expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expandable content */}
      {state.expanded && (
        <div className="mt-2 pl-10">
          {business.description && (
            <p className="text-[11px] text-foreground-muted leading-relaxed">
              {business.description}
            </p>
          )}
          {state.qualificationResult && (
            <QualificationResultPanel result={state.qualificationResult} />
          )}
        </div>
      )}

      {/* Action row */}
      <div className="mt-2.5 flex items-center gap-2 pl-10 flex-wrap">
        {!isPersisted ? (
          <Button
            size="sm"
            variant="outline"
            disabled={state.persisting}
            onClick={handlePersist}
            className="h-7 text-xs gap-1"
            id={`persist-btn-${business.externalId ?? encodeURIComponent(business.name)}`}
          >
            {state.persisting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Building2 className="h-3 w-3" />
            )}
            {state.persisting ? "Saving..." : "Save company"}
          </Button>
        ) : (
          <>
            <span className="flex items-center gap-1 text-xs text-success font-medium">
              <CheckCircle2 className="h-3 w-3" />
              Saved as company
            </span>
            {!state.qualificationResult ? (
              <Button
                size="sm"
                variant="outline"
                disabled={state.qualifying}
                onClick={handleQualify}
                className="h-7 text-xs gap-1"
                id={`qualify-btn-${state.persistedCompany?.id}`}
              >
                {state.qualifying ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {state.qualifying ? "Qualifying..." : "Qualify opportunity"}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={state.qualifying}
                onClick={handleQualify}
                className="h-7 text-xs gap-1 text-foreground-muted"
                id={`requalify-btn-${state.persistedCompany?.id}`}
              >
                {state.qualifying ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Re-qualify
              </Button>
            )}
            {state.qualifyError && (
              <span className="text-xs text-danger flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {state.qualifyError}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BusinessDiscoveryPage() {
  const [form, setForm] = React.useState<SearchFormState>({
    query: "",
    location: "",
    industry: "",
    keywords: "",
    limit: 20,
    providerId: "",
  });

  const [searching, setSearching] = React.useState(false);
  const [searchResult, setSearchResult] =
    React.useState<BusinessSearchResult | null>(null);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [searched, setSearched] = React.useState(false);

  const [bulkPersistedMap, setBulkPersistedMap] = React.useState<
    Record<string, PersistedCompanySummary>
  >({});

  const setField = <K extends keyof SearchFormState>(
    key: K,
    val: SearchFormState[K]
  ) => setForm((f) => ({ ...f, [key]: val }));

  const businessKey = (b: DiscoveredBusiness) =>
    b.externalId ?? `${b.name}__${b.domain ?? ""}`;

  React.useEffect(() => {
    if (!searchResult?.persisted) {
      setBulkPersistedMap({});
      return;
    }
    const map: Record<string, PersistedCompanySummary> = {};
    for (const c of searchResult.persisted.companies) {
      const match = searchResult.businesses.find(
        (b) => b.name.toLowerCase() === c.name.toLowerCase()
      );
      if (match) map[businessKey(match)] = c;
    }
    setBulkPersistedMap(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResult]);

  const buildSearchBody = (params: SearchFormState, persist = false) => {
    const body: Record<string, unknown> = { limit: params.limit, offset: 0 };
    if (persist) body.persist = true;
    if (params.query.trim()) body.query = params.query.trim();
    if (params.location.trim()) body.location = params.location.trim();
    if (params.industry.trim()) body.industry = params.industry.trim();
    if (params.keywords.trim())
      body.keywords = params.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
    if (params.providerId) body.providerId = params.providerId;
    return body;
  };

  const runSearch = async (params: SearchFormState, persist = false) => {
    setSearching(true);
    setSearchError(null);
    setSearched(true);
    setBulkPersistedMap({});
    try {
      const res = await fetch("/api/opportunities/discover/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSearchBody(params, persist)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string })?.error ?? `HTTP ${res.status}`);
      }
      setSearchResult(await res.json());
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : "Discovery failed");
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  const handlePreset = (preset: (typeof PRESET_SEARCHES)[number]) => {
    const updated: SearchFormState = {
      ...form,
      query: preset.params.query ?? form.query,
      industry: preset.params.industry ?? form.industry,
      limit: preset.params.limit ?? form.limit,
    };
    setForm(updated);
    runSearch(updated);
  };

  /**
   * Individual persist: sends the exact DiscoveredBusiness to the direct-persist
   * endpoint — does NOT trigger a second provider search.
   */
  const handlePersist = async (
    business: DiscoveredBusiness
  ): Promise<PersistedCompanySummary> => {
    const payload: Record<string, unknown> = {
      name: business.name,
      source: business.source,
    };
    if (business.externalId) payload.externalId = business.externalId;
    if (business.domain) payload.domain = business.domain;
    if (business.websiteUrl) payload.websiteUrl = business.websiteUrl;
    if (business.industry) payload.industry = business.industry;
    if (business.description) payload.description = business.description;
    if (business.headquarters) payload.headquarters = business.headquarters;
    if (business.employeeCount !== undefined) payload.employeeCount = business.employeeCount;
    if (business.headcountRange) payload.headcountRange = business.headcountRange;
    if (business.companyType) payload.companyType = business.companyType;
    if (business.yearFounded !== undefined) payload.yearFounded = business.yearFounded;
    if (business.technologies?.length) payload.technologies = business.technologies;
    if (business.keywords?.length) payload.keywords = business.keywords;
    if (business.emailsCount) payload.emailsCount = business.emailsCount;
    if (business.phoneNumber) payload.phoneNumber = business.phoneNumber;
    if (business.rating !== undefined) payload.rating = business.rating;
    if (business.userRatingCount !== undefined) payload.userRatingCount = business.userRatingCount;
    if (business.primaryType) payload.primaryType = business.primaryType;
    if (business.sourceUrl) payload.sourceUrl = business.sourceUrl;

    const res = await fetch("/api/opportunities/discover/businesses/persist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string })?.error ?? `HTTP ${res.status}`);
    }
    const result = await res.json();
    const company = result.companies?.[0];
    if (!company) throw new Error("Company was not persisted");
    const key = businessKey(business);
    setBulkPersistedMap((m) => ({ ...m, [key]: company }));
    return company;
  };

  const handleQualify = async (
    companyId: string,
    companyName: string
  ): Promise<QualificationResult> => {
    const res = await fetch("/api/opportunities/qualify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, forceRefresh: false }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string })?.error ?? `HTTP ${res.status}`);
    }
    const raw = await res.json();
    return { companyId, companyName, qualification: raw.qualification };
  };

  const businesses = searchResult?.businesses ?? [];
  const isConfigured = searchResult?.isConfigured ?? true;
  const isMock = searchResult?.isDevelopmentMock ?? false;
  const persisted = searchResult?.persisted;

  const hasFilters = !!(form.query || form.location || form.industry || form.keywords);

  return (
    <div className="space-y-6">
      {/* ─── Page Header ───────────────────────────────────────────────────── */}
      <section aria-label="Business Discovery header">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary text-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground tracking-tight">
                Business Discovery
              </h1>
              <p className="text-xs text-foreground-muted mt-0.5">
                Discover local businesses and qualify website opportunities
              </p>
            </div>
          </div>

          {searchResult && (
            <div className="flex items-center gap-3 text-[11px] text-foreground-muted">
              <span className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                {searchResult.providerName}
              </span>
              {isMock && (
                <span className="font-mono px-1.5 py-0.5 rounded bg-warning/10 text-warning font-semibold text-[10px]">
                  DEV / MOCK
                </span>
              )}
              <span className="font-mono">
                {businesses.length} of {searchResult.totalMatches} results
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ─── Search panel ──────────────────────────────────────────────────── */}
      <section aria-label="Business discovery search">
        {/* Preset pills */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
            Presets
          </span>
          {PRESET_SEARCHES.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={searching}
              onClick={() => handlePreset(p)}
              className="text-xs font-medium px-3 py-1 rounded-full border border-border bg-secondary text-foreground-muted hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="rounded-md border border-border bg-surface p-4 space-y-4">
          {/* Fields grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground-muted pointer-events-none" />
              <Input
                id="discovery-query"
                placeholder="Query (e.g. restaurant)"
                value={form.query}
                onChange={(e) => setField("query", e.target.value)}
                className="pl-7 h-9 text-xs"
                onKeyDown={(e) => e.key === "Enter" && runSearch(form)}
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground-muted pointer-events-none" />
              <Input
                id="discovery-location"
                placeholder="Location (e.g. Austin, TX)"
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
                className="pl-7 h-9 text-xs"
                onKeyDown={(e) => e.key === "Enter" && runSearch(form)}
              />
            </div>
            <div className="relative">
              <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground-muted pointer-events-none" />
              <Input
                id="discovery-industry"
                placeholder="Industry"
                value={form.industry}
                onChange={(e) => setField("industry", e.target.value)}
                className="pl-7 h-9 text-xs"
                onKeyDown={(e) => e.key === "Enter" && runSearch(form)}
              />
            </div>
            <Input
              id="discovery-keywords"
              placeholder="Keywords, comma-separated"
              value={form.keywords}
              onChange={(e) => setField("keywords", e.target.value)}
              className="h-9 text-xs"
              onKeyDown={(e) => e.key === "Enter" && runSearch(form)}
            />
          </div>

          {/* Provider + actions row */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-border flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Provider selector */}
              <label
                htmlFor="discovery-provider"
                className="text-xs text-foreground-muted font-medium shrink-0"
              >
                Provider:
              </label>
              <select
                id="discovery-provider"
                value={form.providerId}
                onChange={(e) => setField("providerId", e.target.value)}
                className="h-8 text-xs px-2 rounded-md border border-border bg-secondary text-foreground appearance-none pr-6 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {hasFilters && (
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      query: "",
                      location: "",
                      industry: "",
                      keywords: "",
                    }))
                  }
                  className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                id="discovery-search-btn"
                size="sm"
                disabled={searching}
                onClick={() => runSearch(form)}
                className="h-8 text-xs gap-1.5"
              >
                {searching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
                {searching ? "Searching..." : "Discover businesses"}
              </Button>

              <Button
                id="discovery-persist-btn"
                size="sm"
                variant="outline"
                disabled={searching}
                onClick={() => runSearch(form, true)}
                className="h-8 text-xs gap-1.5"
                title="Discover and immediately save all results as companies"
              >
                {searching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Building2 className="h-3 w-3" />
                )}
                Discover &amp; save all
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Persist summary banner ────────────────────────────────────────── */}
      {persisted && (
        <div
          role="status"
          className="rounded-md border border-success/30 bg-success/10 px-4 py-3 flex items-center gap-4 flex-wrap text-xs"
        >
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <span className="font-semibold text-success">Batch saved</span>
          {persisted.created > 0 && (
            <span className="text-success">{persisted.created} created</span>
          )}
          {persisted.updated > 0 && (
            <span className="text-primary">{persisted.updated} updated</span>
          )}
          {persisted.matched > 0 && (
            <span className="text-foreground-muted">{persisted.matched} matched</span>
          )}
          {persisted.failed > 0 && (
            <span className="text-danger">{persisted.failed} failed</span>
          )}
        </div>
      )}

      {/* ─── Error banner ──────────────────────────────────────────────────── */}
      {searchError && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 flex items-start gap-2"
        >
          <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-danger">Discovery error</p>
            <p className="text-xs text-danger/80 mt-0.5">{searchError}</p>
          </div>
        </div>
      )}

      {/* ─── Results ───────────────────────────────────────────────────────── */}
      <section aria-label="Results" className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Results
          </h2>
          {searched && businesses.length > 0 && (
            <span className="text-xs text-foreground-muted font-mono">
              ({businesses.length} shown)
            </span>
          )}
        </div>

        {!searchError && businesses.length === 0 ? (
          <EmptyState
            searched={searched}
            configured={isConfigured}
            mockMode={isMock}
            message={searchResult?.message}
          />
        ) : (
          <div className="space-y-2.5">
            {businesses.map((business) => {
              const key = businessKey(business);
              return (
                <BusinessCard
                  key={key}
                  business={business}
                  persistedCompanySummary={bulkPersistedMap[key] ?? null}
                  onPersist={handlePersist}
                  onQualify={handleQualify}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
