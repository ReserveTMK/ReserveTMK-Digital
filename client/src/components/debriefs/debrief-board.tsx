import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/beautiful-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useImpactLogs } from "@/hooks/use-impact-logs";
import { format, formatDistanceToNow, isFuture } from "date-fns";
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
  id: string;
  name: string;
  type: string;
  startTime: string;
  isPast: boolean;
  internalId: number;
  existingDebriefId?: number;
  existingDebriefStatus?: string;
};

// ── Board ────────────────────────────────────────────────────────────────────

export function DebriefBoard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Events needing debriefs — single source from internal events table
  const { data: queueItems, isLoading: queueLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/events/needs-debrief"],
    staleTime: 0,
  });

  // All debriefs
  const { data: allLogs, isLoading: logsLoading } = useImpactLogs() as { data: ImpactLog[] | undefined; isLoading: boolean };

  const isLoading = queueLoading || logsLoading;

  const isRealDebrief = (log: ImpactLog) =>
    log.status === "pending_review" ||
    (log.transcript && log.transcript.trim().length > 0) ||
    (log.audioUrl && log.audioUrl.trim().length > 0);

  // Debrief lookup by eventId — single path
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

  // Build board events from ALL past events (debrief queue)
  const allBoardEvents = useMemo(() => {
    return (queueItems || []).map(q => {
      const log = debriefByEventId.get(q.id);
      return {
        id: `app-${q.id}`,
        name: q.name,
        type: q.type,
        startTime: q.startTime,
        isPast: new Date(q.endTime) < new Date(),
        internalId: q.id,
        existingDebriefId: log?.id ?? q.existingDebriefId ?? undefined,
        existingDebriefStatus: log?.status ?? q.existingDebriefStatus ?? undefined,
      } as BoardEvent;
    });
  }, [queueItems, debriefByEventId]);

  // Column 1: To Debrief — no debrief text or recording saved
  const toDebrief = useMemo(() => allBoardEvents.filter(e => {
    if (!e.existingDebriefId) return true;
    const log = allLogs?.find(l => l.id === e.existingDebriefId);
    return log ? !isRealDebrief(log) : true;
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()), [allBoardEvents, allLogs]);

  // Column 2: Recorded & Reviewing — something entered but not confirmed
  const inProgress = useMemo(() => {
    // Event-linked debriefs in progress
    const eventLinked = allBoardEvents.filter(e => {
      if (!e.existingDebriefId) return false;
      const log = allLogs?.find(l => l.id === e.existingDebriefId);
      return log ? isRealDebrief(log) && log.status !== "confirmed" : false;
    });
    const eventLinkedIds = new Set(eventLinked.map(e => e.existingDebriefId));
    // Standalone logs (manual updates, paste debriefs) not linked to events
    const standalone = (allLogs || [])
      .filter(l => l.status !== "confirmed" && !l.eventId && isRealDebrief(l) && !eventLinkedIds.has(l.id));
    return { eventLinked, standalone };
  }, [allBoardEvents, allLogs]);

  // Column 3: Completed — confirmed debriefs (from board events + standalone logs)
  const completed = useMemo(() => {
    // Events with confirmed debriefs
    const confirmedFromBoard = allBoardEvents.filter(e => e.existingDebriefStatus === "confirmed");
    const confirmedEventIds = new Set(confirmedFromBoard.map(e => e.internalId));
    // Also include confirmed logs not linked to board events (standalone debriefs)
    const standaloneLogs = (allLogs || [])
      .filter(l => l.status === "confirmed" && (!l.eventId || !confirmedEventIds.has(l.eventId)));
    return [
      ...confirmedFromBoard.map(e => {
        const log = allLogs?.find(l => l.id === e.existingDebriefId);
        return log || { id: e.existingDebriefId, title: e.name, status: "confirmed", createdAt: e.startTime } as any;
      }),
      ...standaloneLogs,
    ].sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()).slice(0, 50);
  }, [allBoardEvents, allLogs]);

  // Actions
  const handleDebrief = async (event: BoardEvent) => {
    try {
      const res = await apiRequest("POST", "/api/impact-logs", {
        title: event.name,
        status: "draft",
        eventId: event.internalId,
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
      await apiRequest("POST", `/api/events/${event.internalId}/skip-debrief`, { reason });
      queryClient.invalidateQueries({ queryKey: ["/api/events/needs-debrief"] });
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

  const inProgressCount = inProgress.eventLinked.length + inProgress.standalone.length;
  const columnCounts = [toDebrief.length, inProgressCount, completed.length];

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
                {columnCounts[idx]}
              </Badge>
            </div>

            <div className={`rounded-lg border-t-2 ${col.color} bg-muted/30 p-3 space-y-2 min-h-[200px]`}>
              {columnCounts[idx] === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {idx === 0 ? "All caught up" : idx === 1 ? "Nothing in review" : "No completed debriefs yet"}
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

              {idx === 1 && (
                <>
                  {inProgress.eventLinked.map(event => (
                    <InProgressCard
                      key={event.id}
                      event={event}
                      onOpen={() => event.existingDebriefId && setLocation(`/debriefs/${event.existingDebriefId}?from=board`)}
                    />
                  ))}
                  {inProgress.standalone.map(log => (
                    <InProgressLogCard
                      key={log.id}
                      log={log}
                      onOpen={() => setLocation(`/debriefs/${log.id}?from=board`)}
                    />
                  ))}
                </>
              )}

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

// ── In progress log card (column 2 — standalone logs) ────────────────────────

function InProgressLogCard({ log, onOpen }: {
  log: ImpactLog;
  onOpen: () => void;
}) {
  const statusLabel = log.status === "pending_review" ? "Pending Review" : "Draft";
  const statusColor = log.status === "pending_review"
    ? "bg-blue-500/15 text-blue-700"
    : "bg-gray-500/15 text-gray-700";
  const isManual = log.type === "manual_update";

  return (
    <Card className="p-3 space-y-2 border-l-2 border-l-blue-400 cursor-pointer hover:bg-muted/50" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{log.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`text-[10px] px-1.5 py-0 ${statusColor}`}>{statusLabel}</Badge>
            {isManual && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Manual Update</Badge>}
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
