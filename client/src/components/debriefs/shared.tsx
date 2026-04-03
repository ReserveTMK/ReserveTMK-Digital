import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Search,
  UserPlus,
  User,
  Loader2,
  Link2,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ImpactLog, Contact } from "@shared/schema";
import { format } from "date-fns";

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  pending_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  confirmed: "bg-green-500/15 text-green-700 dark:text-green-300",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  confirmed: "Confirmed",
};

export const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-green-500/15 text-green-700 dark:text-green-300",
  neutral: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  negative: "bg-red-500/15 text-red-700 dark:text-red-300",
  mixed: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

export const SENTIMENTS = ["positive", "neutral", "negative", "mixed"];

export type QueueItem = {
  id: number;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  location: string | null;
  attendeeCount: number | null;
  description: string | null;
  linkedProgrammeId: number | null;
  calendarAttendees: Array<{ email: string; displayName?: string; responseStatus?: string; organizer?: boolean }> | null;
  queueStatus: "overdue" | "due" | "in_progress";
  existingDebriefId: number | null;
  existingDebriefStatus: string | null;
};

export type DismissedQueueItem = {
  id: number;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  location: string | null;
  attendeeCount: number | null;
  description: string | null;
  linkedProgrammeId: number | null;
  calendarAttendees: Array<{ email: string; displayName?: string; responseStatus?: string; organizer?: boolean }> | null;
  queueStatus: "dismissed";
  existingDebriefId: null;
  existingDebriefStatus: null;
  dismissReason: string | null;
};

export type WeeklyDebrief = {
  id: number;
  userId: number;
  weekStartDate: string;
  weekEndDate: string;
  status: string;
  generatedSummaryText: string | null;
  finalSummaryText: string | null;
  metricsJson: {
    confirmedDebriefs?: number | null;
    completedProgrammes?: number | null;
    completedBookings?: number | null;
    milestonesCreated?: number | null;
    outstandingDebriefs?: number | null;
    backlogDebriefs?: number | null;
    upcomingEventsNextWeek?: number | null;
    actionsCreated?: number | null;
    actionsCompleted?: number | null;
    averagedDevelopmentMetrics?: Record<string, number> | null;
    keyQuotes?: string[] | null;
  } | null;
  themesJson: string[] | null;
  sentimentJson: {
    average: number | null;
    sampleSize: number;
    breakdown: { positive: number; neutral: number; negative: number };
  } | null;
  createdAt: string;
  confirmedAt: string | null;
};

export function getSentimentLabel(avg: number | null): string {
  if (avg === null) return "N/A";
  if (avg >= 2.5) return "Positive";
  if (avg >= 1.5) return "Neutral";
  return "Negative";
}

export function formatMetric(val: number | null | undefined): string {
  if (val === null || val === undefined) return "not tracked";
  return String(val);
}

export function formatWeekPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${format(s, "EEE dd MMM")} – ${format(e, "EEE dd MMM yyyy")}`;
}


export function ContactSearchPicker({
  contacts,
  onSelect,
  testId,
  compact = false,
}: {
  contacts: Contact[];
  onSelect: (contactId: number) => void;
  testId: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleQuickCreate = async () => {
    if (!searchValue.trim()) return;
    setIsCreating(true);
    try {
      const res = await apiRequest("POST", "/api/contacts", {
        name: searchValue.trim(),
      });
      const newContact = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      onSelect(newContact.id);
      setSearchValue("");
      setOpen(false);
    } catch (err: any) {}
    setIsCreating(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {compact ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            data-testid={testId}
          >
            <Link2 className="w-3 h-3 mr-1" />
            Link
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start text-muted-foreground font-normal"
            data-testid={testId}
          >
            <Search className="w-3.5 h-3.5 mr-2 shrink-0" />
            Search and link a community member...
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[min(300px,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Type a name to search..."
            data-testid={`${testId}-input`}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-2 px-1">
                <p className="text-xs text-muted-foreground mb-2">No contacts found</p>
                {searchValue.trim() && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={handleQuickCreate}
                    disabled={isCreating}
                    data-testid={`${testId}-quick-add`}
                  >
                    {isCreating ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <User className="w-3 h-3 mr-1" />
                    )}
                    Create contact "{searchValue.trim()}"
                  </Button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    onSelect(c.id);
                    setOpen(false);
                  }}
                  data-testid={`${testId}-option-${c.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {c.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
