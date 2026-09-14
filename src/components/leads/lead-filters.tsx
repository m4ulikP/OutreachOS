"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw, SlidersHorizontal } from "lucide-react";
import { LeadStage, TagType } from "@prisma/client";

export interface FilterState {
  search: string;
  stage: string;
  temperature: string;
  industry: string;
  location: string;
  sortBy: "createdAt" | "name" | "lastInteractionAt" | "stage";
  sortOrder: "asc" | "desc";
}

export interface LeadFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
}

export function LeadFilters({ filters, onChange, onReset }: LeadFiltersProps) {
  const [expanded, setExpanded] = React.useState(false);

  const update = (key: keyof FilterState, val: string) => {
    onChange({ ...filters, [key]: val });
  };

  const hasActiveFilters =
    filters.search ||
    filters.stage ||
    filters.temperature ||
    filters.industry ||
    filters.location;

  return (
    <div className="space-y-2.5">
      {/* Primary Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            placeholder="Search by name, email, company, or job title…"
            name="leadSearch"
            spellCheck={false}
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Select
            name="stageFilter"
            value={filters.stage}
            onChange={(e) => update("stage", e.target.value)}
            className="h-9 text-xs w-36"
            aria-label="Filter by pipeline stage"
          >
            <option value="">All Stages</option>
            <option value={LeadStage.NEW}>NEW</option>
            <option value={LeadStage.CONTACTED}>CONTACTED</option>
            <option value={LeadStage.FOLLOW_UP}>FOLLOW_UP</option>
            <option value={LeadStage.REPLIED}>REPLIED</option>
            <option value={LeadStage.POSITIVE_REPLY}>POSITIVE_REPLY</option>
            <option value={LeadStage.MEETING_SCHEDULED}>MEETING_SCHEDULED</option>
            <option value={LeadStage.CLIENT}>CLIENT</option>
            <option value={LeadStage.CLOSED_LOST}>CLOSED_LOST</option>
          </Select>

          <Select
            name="temperatureFilter"
            value={filters.temperature}
            onChange={(e) => update("temperature", e.target.value)}
            className="h-9 text-xs w-36"
            aria-label="Filter by lead temperature"
          >
            <option value="">All Temperatures</option>
            <option value={TagType.HOT}>HOT</option>
            <option value={TagType.WARM}>WARM</option>
            <option value={TagType.COLD}>COLD</option>
            <option value={TagType.FOLLOW_UP_NEEDED}>FOLLOW_UP_NEEDED</option>
            <option value={TagType.CLIENT}>CLIENT</option>
          </Select>

          <Button
            variant={expanded ? "secondary" : "outline"}
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-9 px-2.5 text-xs gap-1.5"
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
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Reset Filters"
              aria-label="Reset all search filters"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Secondary Filters */}
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-3 rounded-lg border border-border bg-card/60 animate-in fade-in-50 duration-150">
          <Input
            placeholder="Filter by industry…"
            name="industryFilter"
            spellCheck={false}
            value={filters.industry}
            onChange={(e) => update("industry", e.target.value)}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Filter by location…"
            name="locationFilter"
            spellCheck={false}
            value={filters.location}
            onChange={(e) => update("location", e.target.value)}
            className="h-8 text-xs"
          />
          <Select
            name="sortBy"
            value={filters.sortBy}
            onChange={(e) => update("sortBy", e.target.value)}
            className="h-8 text-xs"
            aria-label="Sort leads by"
          >
            <option value="createdAt">Sort: Date Created</option>
            <option value="lastInteractionAt">Sort: Last Activity</option>
            <option value="name">Sort: Name</option>
            <option value="stage">Sort: Stage</option>
          </Select>
          <Select
            name="sortOrder"
            value={filters.sortOrder}
            onChange={(e) => update("sortOrder", e.target.value)}
            className="h-8 text-xs"
            aria-label="Sort direction"
          >
            <option value="desc">Order: Descending</option>
            <option value="asc">Order: Ascending</option>
          </Select>
        </div>
      )}
    </div>
  );
}
