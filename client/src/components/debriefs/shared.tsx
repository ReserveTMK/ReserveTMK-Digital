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
import { Card } from "@/components/ui/card";
import { useState } from "react";
import {
  Search,
  UserPlus,
  User,
  Loader2,
  Trash2,
  Mic,
  HeartHandshake,
  RotateCcw,
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

export function DebriefCardList({
  logs,
  isLoading,
  onSelect,
  onDelete,
  onCreateNew,
  onReanalyse,
  reanalysingId,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyButtonText,
}: {
  logs: ImpactLog[];
  isLoading: boolean;
  onSelect: (id: number) => void;
  onDelete: (log: ImpactLog) => void;
  onCreateNew: () => void;
  onReanalyse?: (log: ImpactLog) => void;
  reanalysingId?: number | null;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyButtonText?: string;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          {emptyIcon || <Mic className="w-8 h-8 text-muted-foreground" />}
        </div>
        <h3 className="text-lg font-semibold mb-2">{emptyTitle || "No debriefs yet"}</h3>
        <p className="text-muted-foreground mb-6">{emptyDescription || "Record or paste a debrief to get started."}</p>
        <Button onClick={onCreateNew} variant="outline" data-testid="button-new-debrief-empty">
          {emptyButtonText || "New Debrief"}
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {logs.map((log) => (
        <Card
          key={log.id}
          className="p-5 cursor-pointer hover-elevate transition-all duration-200"
          onClick={() => onSelect(log.id)}
          data-testid={`card-debrief-${log.id}`}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {log.type === "manual_update" && (
                <HeartHandshake className="w-4 h-4 text-pink-500 shrink-0" />
              )}
              <h3 className="font-bold text-lg font-display truncate" data-testid={`text-debrief-title-${log.id}`}>
                {log.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {log.type === "manual_update" && (
                <Badge variant="secondary" className="text-xs bg-pink-500/15 text-pink-700 dark:text-pink-300" data-testid={`badge-type-${log.id}`}>
                  Manual Update
                </Badge>
              )}
              <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[log.status] || ""}`} data-testid={`badge-status-${log.id}`}>
                {STATUS_LABELS[log.status] || log.status}
              </Badge>
              {log.sentiment && (
                <Badge variant="secondary" className={`text-xs ${SENTIMENT_COLORS[log.sentiment] || ""}`} data-testid={`badge-sentiment-${log.id}`}>
                  {log.sentiment}
                </Badge>
              )}
              {onReanalyse && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 min-h-[44px] min-w-[44px]"
                  disabled={reanalysingId === log.id}
                  onClick={(e) => { e.stopPropagation(); onReanalyse(log); }}
                  data-testid={`button-reanalyse-debrief-${log.id}`}
                >
                  <RotateCcw className={`w-4 h-4 text-muted-foreground ${reanalysingId === log.id ? "animate-spin" : ""}`} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 min-h-[44px] min-w-[44px]"
                onClick={(e) => { e.stopPropagation(); onDelete(log); }}
                data-testid={`button-delete-debrief-${log.id}`}
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
          {log.summary && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3" data-testid={`text-summary-${log.id}`}>
              {log.summary}
            </p>
          )}
          <p className="text-xs text-muted-foreground" data-testid={`text-date-${log.id}`}>
            {log.createdAt ? new Date(log.createdAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : ""}
          </p>
        </Card>
      ))}
    </div>
  );
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
