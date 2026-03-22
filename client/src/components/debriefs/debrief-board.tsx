import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/beautiful-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useImpactLogs } from "@/hooks/use-impact-logs";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";
import {
  Mic,
  CheckCircle2,
  Clock,
  ChevronRight,
  EyeOff,
  Calendar,
  Users,
} from "lucide-react";
import { DismissPopover } from "@/components/dismiss-popover";
import type { QueueItem } from "./shared";
import type { ImpactLog } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ── Column config ────────────────────────────────────────────────────────────

const COLUMNS = [
  {
    id: "to_debrief",
    label: "To Debrief",
    icon: Mic,
    color: "border-t-orange-500",
  },
  {
    id: "in_progress",
    label: "Recorded & Reviewing",
    icon: Clock,
    color: "border-t-blue-500",
  },
  {
    id: "completed",
    label: "Completed",
    icon: CheckCircle2,
    color: "border-t-green-500",
  },
];

// ── Unified event type ────────────────────────────────────────────────────────

type BoardEvent = {
  id: string; // "app-123" or "gcal-abc123"
  name: string;
  type: string;
  startTime: string;
  isPast: boolean;
  internalId?: number; // internal event DB id
  gcalId?: string;
  existingDebriefId?: number;
  existingDebriefStatus?: string;
};

// ── Board ────────────────────────────────────────────────────────────────────

export function DebriefBoard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Internal queue events
  const { data: queueItems, isLoading: queueLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/events/needs-debrief"],
    staleTime: 0,
  });

  // GCal events (last 90 days + next 30 days)
  const { data: gcalEvents, isLoading: gcalLoading } = useQuery<any[]>({
    queryKey: ["/api/google-calendar/events"],
    staleTime: 0,
  });

  // Dismissed GCal events
  const { data: dismissedEvents } = useQuery<{ id: number; gcalEventId: string; reason: string }[]>({
    queryKey: ["/api/dismissed-calendar-events"],
  });

  // All debriefs
  const { data: allLogs, isLoading: logsLoading } = useImpactLogs() as { data: ImpactLog[] | undefined; isLoading: boolean };

  const isLoading = queueLoading || gcalLoading || logsLoading;

  // Build lookup sets
  const dismissedGcalIds = useMemo(() =>
    new Set((dismissedEvents || []).map(d => d.gcalEventId)),
    [dismissedEvents]
  );

  // Confirmed debrief titles (for fuzzy matching when no eventId/gcalId)
  const confirmedTitles = useMemo(() =>
    new Set((allLogs || [])
      .filter(l => l.status === "confirmed")
      .map(l => l.title.toLowerCase().trim())
    ),
    [allLogs]
  );

  const isRealDebrief = (log: ImpactLog) =>
    log.status === "pending_review" ||
    (log.transcript && log.transcript.trim().length > 0) ||
    (log.audioUrl && log.audioUrl.trim().length > 0);

  // Maps for debrief lookup
  const debriefByEventId = useMemo(() => {
    const map = new Map<number, ImpactLog>();
    for (const log of (allLogs || [])) {
      if (!log.eventId) continue;
      const existing = map.get(log.eventId);
      if (!existing || log.status === "confirmed" || (isRealDebrief(log) && existing.status === "draft" && !isRealDebrief(existing))) {
        map.set(log.eventId, log);
      }
    }
    return map;
  }, [allLogs]);

  const debriefByGcalId = useMemo(() => {
    const map = new Map<string, ImpactLog>();
    for (const log of (allLogs || [])) {
      const gcalId = (log as any).gcalEventId;
      if (!gcalId) continue;
      const existing = map.get(gcalId);
      if (!existing || log.status === "confirmed") {
        map.set(gcalId, log);
      }
    }
    return map;
  }, [allLogs]);

  // Build unified event list from internal + GCal
  const allBoardEvents = useMemo(() => {
    const events: BoardEvent[] = [];
    const seenKeys = new Set<string>();

    // Internal queue events
    for (const q of (queueItems || [])) {
      const key = `app-${q.id}`;
      seenKeys.add(key);
      const log = debriefByEventId.get(q.id);
      events.push({
        id: key,
        name: q.name,
        type: q.type,
        startTime: q.startTime,
        isPast: new Date(q.endTime) < new Date(),
        internalId: q.id,
        existingDebriefId: log?.id,
        existingDebriefStatus: log?.status,
      });
    }

    // GCal events not already covered
    for (const e of (gcalEvents || [])) {
      if (dismissedGcalIds.has(e.id)) continue;
      const nameKey = `${(e.summary || "").trim().toLowerCase()}|${new Date(e.start).toDateString()}`;
      // Skip if an internal event covers this (by name+date)
      const alreadyCovered = [...seenKeys].some(k => {
        const q = (queueItems || []).find(q => `app-${q.id}` === k);
        return q && `${q.name.toLowerCase()}|${new Date(q.startTime).toDateString()}` === nameKey;
      });
      if (alreadyCovered) continue;

      const log = debriefByGcalId.get(e.id);
      if (log?.status === "confirmed") continue; // already done, skip column 1
      // Also skip if a confirmed debrief has matching title
      if (confirmedTitles.has((e.summary || "").toLowerCase().trim())) continue;

      events.push({
        id: `gcal-${e.id}`,
        name: e.summary || "Untitled Event",
        type: e.calendarId?.includes("@") ? "Meeting" : "Event",
        startTime: e.start,
        isPast: new Date(e.end || e.start) < new Date(),
        gcalId: e.id,
        existingDebriefId: log?.id,
        existingDebriefStatus: log?.status,
      });
    }

    return events;
  }, [queueItems, gcalEvents, dismissedGcalIds, debriefByEventId, debriefByGcalId]);

  // Column 1: No debrief or empty draft
  const toDebrief = useMemo(() => allBoardEvents.filter(e => {
    if (!e.existingDebriefId) return true;
    const log = allLogs?.find(l => l.id === e.existingDebriefId);
    return log ? !isRealDebrief(log) : true;
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()), [allBoardEvents, allLogs]);

  // Column 2: Real debrief in progress
  const inProgress = useMemo(() => allBoardEvents.filter(e => {
    if (!e.existingDebriefId) return false;
    const log = allLogs?.find(l => l.id === e.existingDebriefId);
    return log ? isRealDebrief(log) && log.status !== "confirmed" : false;
  }), [allBoardEvents, allLogs]);

  // Column 3: Confirmed
  const completed = useMemo(() => (allLogs || [])
    .filter(l => l.status === "confirmed")
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 30),
    [allLogs]);

  // Actions
  const handleDebrief = async (event: BoardEvent) => {
    try {
      const res = await apiRequest("POST", "/api/impact-logs", {
        title: event.name,
        status: "draft",
        eventId: event.internalId || null,
        gcalEventId: event.gcalId || null,
      });
      const log = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/impact-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      setLocation(`/debriefs/${log.id}?from=board`);
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to create debrief", variant: "destructive" });
    }
  };

  const handleDismiss = async (event: BoardEvent, reason: string) => {
    try {
      if (event.internalId) {
        await apiRequest("POST", `/api/events/${event.internalId}/skip-debrief`, { reason });
        queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
      } else if (event.gcalId) {
        await apiRequest("POST", "/api/dismissed-calendar-events", { gcalEventId: event.gcalId, reason });
        queryClient.invalidateQueries({ queryKey: ["/api/dismissed-calendar-events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/events"] });
      }
      toast({ title: "Dismissed", description: "Event removed from queue." });
    } catch {
      toast({ title: "Error", description: "Failed to dismiss", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <div key={col.id} className="space-y-3">
            <Skeleton className="h-8 w-32" />
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ))}
      </div>
    );
  }

  const columnData = [toDebrief, inProgress, completed];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col, idx) => {
        const Icon = col.icon;
        return (
          <div key={col.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{col.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {columnData[idx].length}
              </Badge>
            </div>

            <div className={`rounded-lg border-t-2 ${col.color} bg-muted/30 p-3 space-y-2 min-h-[200px]`}>
              {columnData[idx].length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {idx === 0 ? "All caught up 🎉" : idx === 1 ? "Nothing in review" : "No completed debriefs yet"}
                </p>
              )}

              {idx === 0 && (toDebrief as BoardEvent[]).map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  onDebrief={() => handleDebrief(event)}
                  onDismiss={(reason) => handleDismiss(event, reason)}
                />
              ))}

              {idx === 1 && (inProgress as BoardEvent[]).map(event => (
                <InProgressCard
                  key={event.id}
                  event={event}
                  onOpen={() => event.existingDebriefId && setLocation(`/debriefs/${event.existingDebriefId}?from=board`)}
                />
              ))}

              {idx === 2 && (completed as ImpactLog[]).map(log => (
                <CompletedCard
                  key={log.id}
                  log={log}
                  onOpen={() => setLocation(`/debriefs/${log.id}`)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Event card (column 1) ─────────────────────────────────────────────────────

function EventCard({ event, onDebrief, onDismiss }: {
  event: BoardEvent;
  onDebrief: () => void;
  onDismiss: (reason: string) => void;
}) {
  const dateStr = format(new Date(event.startTime), "EEE d MMM");
  const isFutureEvent = isFuture(new Date(event.startTime));

  return (
    <Card className={`p-3 space-y-2 border-l-2 ${isFutureEvent ? "border-l-gray-300 opacity-60" : "border-l-orange-400"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{event.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{dateStr}</span>
            {isFutureEvent && <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">Upcoming</Badge>}
            {!isFutureEvent && new Date(event.startTime) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-1">Overdue</Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1 h-7 text-xs" onClick={onDebrief} disabled={isFutureEvent}>
          <Mic className="w-3 h-3 mr-1" />
          Debrief
        </Button>
        <DismissPopover
          reasons={["Duplicate", "Ignore", "Personal"]}
          onDismiss={onDismiss}
        >
          <Button size="sm" variant="ghost" className="h-7 px-2">
            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </DismissPopover>
      </div>
    </Card>
  );
}

// ── In progress card (column 2) ───────────────────────────────────────────────

function InProgressCard({ event, onOpen }: {
  event: BoardEvent;
  onOpen: () => void;
}) {
  const statusLabel = event.existingDebriefStatus === "pending_review" ? "Pending Review" : "Draft";
  const statusColor = event.existingDebriefStatus === "pending_review"
    ? "bg-blue-500/15 text-blue-700"
    : "bg-gray-500/15 text-gray-700";

  return (
    <Card className="p-3 space-y-2 border-l-2 border-l-blue-400 cursor-pointer hover:bg-muted/50" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{event.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`text-[10px] px-1.5 py-0 ${statusColor}`}>{statusLabel}</Badge>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>
      <p className="text-xs text-muted-foreground">Tap to review and confirm →</p>
    </Card>
  );
}

// ── Completed card (column 3) ─────────────────────────────────────────────────

function CompletedCard({ log, onOpen }: {
  log: ImpactLog;
  onOpen: () => void;
}) {
  const dateStr = log.createdAt ? format(new Date(log.createdAt), "d MMM") : "";
  return (
    <Card className="p-3 space-y-1 border-l-2 border-l-green-500 cursor-pointer hover:bg-muted/50" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium truncate flex-1">{log.title}</p>
        <span className="text-xs text-muted-foreground shrink-0">{dateStr}</span>
      </div>
      <div className="flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-green-600" />
        <span className="text-xs text-green-700">Confirmed</span>
      </div>
    </Card>
  );
}
