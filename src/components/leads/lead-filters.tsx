"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Search,
  RotateCcw,
  SlidersHorizontal,
  X,
  Calendar,
  Building,
  Tag as TagIcon,
  Flame,
} from "lucide-react";
import { LeadStage, TagType } from "@prisma/client";

export interface FilterState {
  search: string;
  stage: string;
  temperature: string;
  tag: string;
  company: string;
  createdAfter: string;
  createdBefore: string;
  sortBy: "createdAt" | "updatedAt" | "name" | "company" | "lastInteractionAt" | "stage";
  sortOrder: "asc" | "desc";
}

export interface LeadFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  availableTags?: { id: string; name: string }[];
}

export function LeadFilters({
  filters,
  onChange,
  onReset,
  availableTags = [],
}: LeadFiltersProps) {
  const [expanded, setExpanded] = React.useState(false);

  const update = (key: keyof FilterState, val: string) => {
    onChange({ ...filters, [key]: val });
  };

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.stage ||
      filters.temperature ||
      filters.tag ||
      filters.company ||
      filters.createdAfter ||
      filters.createdBefore
  );

  return (
    <div className="space-y-2.5">
      {/* Primary Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        {/* Search with inline clear */}
        <div className="relative flex-1 w-full">
          <Search
            className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-foreground-muted pointer-events-none"
            aria-hidden="true"
          />
          <Input
            placeholder="Search by name, email, company, or role…"
            name="leadSearch"
            spellCheck={false}
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            className="pl-8 pr-8 h-8 text-xs bg-surface border-border"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => update("search", "")}
              className="absolute right-2.5 top-2.5 text-foreground-muted hover:text-foreground"
              aria-label="Clear search text"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap">
          {/* Temperature Dropdown */}
          <Select
            name="temperatureFilter"
            value={filters.temperature}
            onChange={(e) => update("temperature", e.target.value)}
            className="h-8 text-xs w-32 bg-surface border-border"
            aria-label="Filter by temperature"
          >
            <option value="">All temps</option>
            <option value={TagType.HOT}>Hot 🔥</option>
            <option value={TagType.WARM}>Warm ⚡</option>
            <option value={TagType.COLD}>Cold ❄️</option>
            <option value={TagType.FOLLOW_UP_NEEDED}>Follow-up needed</option>
            <option value={TagType.CLIENT}>Client 🏆</option>
          </Select>

          {/* Tag Dropdown */}
          {availableTags.length > 0 && (
            <Select
              name="tagFilter"
              value={filters.tag}
              onChange={(e) => update("tag", e.target.value)}
              className="h-8 text-xs w-32 bg-surface border-border"
              aria-label="Filter by tag"
            >
              <option value="">All tags</option>
              {availableTags.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}

          {/* Toggle More Filters */}
          <Button
            variant={expanded ? "secondary" : "outline"}
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-8 px-2.5 text-xs gap-1.5"
            aria-expanded={expanded}
            aria-label="Toggle additional filter options"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Filters</span>
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-8 px-2 text-xs text-foreground-muted hover:text-foreground"
              title="Reset All Filters"
              aria-label="Reset all search filters"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Secondary Filters */}
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-3 rounded-lg border border-border bg-surface animate-in fade-in-50 duration-150">
          {/* Company filter */}
          <div>
            <label className="block text-[10px] font-medium text-foreground-muted mb-1">
              Company Name
            </label>
            <Input
              placeholder="e.g. Acme…"
              name="companyFilter"
              spellCheck={false}
              value={filters.company}
              onChange={(e) => update("company", e.target.value)}
              className="h-8 text-xs bg-surface-elevated border-border"
            />
          </div>

          {/* Created After */}
          <div>
            <label className="block text-[10px] font-medium text-foreground-muted mb-1">
              Created After
            </label>
            <Input
              type="date"
              name="createdAfterFilter"
              value={filters.createdAfter}
              onChange={(e) => update("createdAfter", e.target.value)}
              className="h-8 text-xs bg-surface-elevated border-border"
            />
          </div>

          {/* Sort Field */}
          <div>
            <label className="block text-[10px] font-medium text-foreground-muted mb-1">
              Sort By
            </label>
            <Select
              name="sortBy"
              value={filters.sortBy}
              onChange={(e) => update("sortBy", e.target.value)}
              className="h-8 text-xs bg-surface-elevated border-border w-full"
              aria-label="Sort leads by"
            >
              <option value="createdAt">Date created</option>
              <option value="lastInteractionAt">Last activity</option>
              <option value="name">Prospect name</option>
              <option value="company">Company name</option>
              <option value="updatedAt">Last updated</option>
              <option value="stage">Pipeline stage</option>
            </Select>
          </div>

          {/* Sort Direction */}
          <div>
            <label className="block text-[10px] font-medium text-foreground-muted mb-1">
              Sort Order
            </label>
            <Select
              name="sortOrder"
              value={filters.sortOrder}
              onChange={(e) => update("sortOrder", e.target.value)}
              className="h-8 text-xs bg-surface-elevated border-border w-full"
              aria-label="Sort direction"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </Select>
          </div>
        </div>
      )}

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] font-medium text-foreground-muted">Active:</span>

          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-[11px] text-foreground">
              <Search className="h-2.5 w-2.5 text-foreground-muted" />
              <span>&ldquo;{filters.search}&rdquo;</span>
              <button
                type="button"
                onClick={() => update("search", "")}
                className="hover:text-danger ml-0.5"
                aria-label="Remove search filter"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}

          {filters.temperature && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-[11px] text-foreground">
              <Flame className="h-2.5 w-2.5 text-warning" />
              <span>{filters.temperature}</span>
              <button
                type="button"
                onClick={() => update("temperature", "")}
                className="hover:text-danger ml-0.5"
                aria-label="Remove temperature filter"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}

          {filters.tag && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-[11px] text-foreground">
              <TagIcon className="h-2.5 w-2.5 text-primary" />
              <span>tag: {filters.tag}</span>
              <button
                type="button"
                onClick={() => update("tag", "")}
                className="hover:text-danger ml-0.5"
                aria-label="Remove tag filter"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}

          {filters.company && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-[11px] text-foreground">
              <Building className="h-2.5 w-2.5 text-foreground-muted" />
              <span>company: {filters.company}</span>
              <button
                type="button"
                onClick={() => update("company", "")}
                className="hover:text-danger ml-0.5"
                aria-label="Remove company filter"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}

          {filters.createdAfter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-[11px] text-foreground">
              <Calendar className="h-2.5 w-2.5 text-foreground-muted" />
              <span>after {filters.createdAfter}</span>
              <button
                type="button"
                onClick={() => update("createdAfter", "")}
                className="hover:text-danger ml-0.5"
                aria-label="Remove date filter"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-foreground-muted hover:text-danger underline ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
