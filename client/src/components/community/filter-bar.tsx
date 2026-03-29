import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Filter, ChevronDown } from "lucide-react";
import { CONNECTION_LEVELS, SUPPORT_OPTIONS, SUPPORT_LABEL_MAP } from "./inline-cells";
import { VENTURE_TYPES } from "@shared/schema";

const ETHNIC_GROUPS = [
  "European", "Māori", "Pacific Peoples", "Samoan", "Tongan",
  "Cook Island Māori", "Niuean", "Chinese", "Indian", "South East Asian",
  "Other Asian", "Middle Eastern", "Latin American", "African", "Other",
];

const STAGE_OPTIONS = [
  { value: "kakano", label: "Kakano" },
  { value: "tipu", label: "Tipu" },
  { value: "ora", label: "Ora" },
  { value: "inactive", label: "Inactive" },
];

const VENTURE_LABELS: Record<string, string> = {
  commercial_business: "Commercial Business",
  social_enterprise: "Social Enterprise",
  creative_movement: "Creative Movement",
  community_initiative: "Community Initiative",
  exploring: "Exploring",
};

const CONNECTION_LABELS: Record<string, string> = {
  known: "Known",
  connected: "Connected",
  engaged: "Engaged",
  embedded: "Embedded",
  partnering: "Partnering",
};

export interface ContactFilters {
  ethnicities: string[];
  suburbs: string[];
  supportTypes: string[];
  connectionStrengths: string[];
  ventureTypes: string[];
  stages: string[];
  onCatchUpList: boolean;
}

export const EMPTY_FILTERS: ContactFilters = {
  ethnicities: [],
  suburbs: [],
  supportTypes: [],
  connectionStrengths: [],
  ventureTypes: [],
  stages: [],
  onCatchUpList: false,
};

export function hasActiveFilters(f: ContactFilters): boolean {
  return f.ethnicities.length > 0 || f.suburbs.length > 0 || f.supportTypes.length > 0 ||
    f.connectionStrengths.length > 0 || f.ventureTypes.length > 0 || f.stages.length > 0 || f.onCatchUpList;
}

function MultiPill({ label, options, selected, onChange, labelMap }: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  labelMap?: Record<string, string>;
}) {
  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };
  const isActive = selected.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          isActive
            ? "bg-primary/10 border-primary/30 text-primary"
            : "bg-muted/50 border-border hover:bg-muted"
        }`}>
          {label}
          {isActive && <Badge variant="secondary" className="h-4 px-1 text-[10px] min-w-[16px] justify-center">{selected.length}</Badge>}
          <ChevronDown className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 max-h-64 overflow-y-auto" align="start">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent/50 rounded px-2 py-1">
            <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} />
            {labelMap?.[opt] || opt}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function ContactFilterBar({ filters, onChange, availableSuburbs, catchUpCount }: {
  filters: ContactFilters;
  onChange: (filters: ContactFilters) => void;
  availableSuburbs: string[];
  catchUpCount: number;
}) {
  const active = hasActiveFilters(filters);

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="contact-filter-bar">
      <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

      <MultiPill
        label="Ethnicity"
        options={ETHNIC_GROUPS}
        selected={filters.ethnicities}
        onChange={(ethnicities) => onChange({ ...filters, ethnicities })}
      />

      {availableSuburbs.length > 0 && (
        <MultiPill
          label="Suburb"
          options={availableSuburbs}
          selected={filters.suburbs}
          onChange={(suburbs) => onChange({ ...filters, suburbs })}
        />
      )}

      <MultiPill
        label="Stage"
        options={STAGE_OPTIONS.map(s => s.value)}
        selected={filters.stages}
        onChange={(stages) => onChange({ ...filters, stages })}
        labelMap={Object.fromEntries(STAGE_OPTIONS.map(s => [s.value, s.label]))}
      />

      <MultiPill
        label="Support"
        options={SUPPORT_OPTIONS as unknown as string[]}
        selected={filters.supportTypes}
        onChange={(supportTypes) => onChange({ ...filters, supportTypes })}
        labelMap={SUPPORT_LABEL_MAP}
      />

      <MultiPill
        label="Connection"
        options={CONNECTION_LEVELS as unknown as string[]}
        selected={filters.connectionStrengths}
        onChange={(connectionStrengths) => onChange({ ...filters, connectionStrengths })}
        labelMap={CONNECTION_LABELS}
      />

      <MultiPill
        label="Venture"
        options={VENTURE_TYPES as unknown as string[]}
        selected={filters.ventureTypes}
        onChange={(ventureTypes) => onChange({ ...filters, ventureTypes })}
        labelMap={VENTURE_LABELS}
      />

      <button
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          filters.onCatchUpList
            ? "bg-primary/10 border-primary/30 text-primary"
            : "bg-muted/50 border-border hover:bg-muted"
        }`}
        onClick={() => onChange({ ...filters, onCatchUpList: !filters.onCatchUpList })}
      >
        Catch-up
        {catchUpCount > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{catchUpCount}</Badge>}
      </button>

      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
